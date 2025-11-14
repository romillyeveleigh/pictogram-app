import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface KeywordsData {
  [iconPath: string]: string[];
}

const IMAGES_PER_REQUEST = 16; // Gemini supports up to 16 images per request
const BATCH_DELAY = 10000; // Wait 10 seconds between batches (rate limiting)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

interface IconInfo {
  path: string;
  filename: string;
  category: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateKeywordsForImages(
  icons: IconInfo[], 
  retries = 0
): Promise<Map<string, string[]>> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Build the prompt with image references
    let prompt = `Analyze the following ${icons.length} icon images and generate 5-10 descriptive keywords for each icon that would help someone find it.\n\n`;
    prompt += `For each image, provide keywords that focus on what the icon represents, its purpose, and visual elements. Keywords should be concise (1-3 words each).\n\n`;
    prompt += `Return a JSON object where each key is the filename (without path) and the value is an array of keywords.\n`;
    prompt += `Example format: {"icon1.png": ["keyword1", "keyword2"], "icon2.png": ["keyword3", "keyword4"]}\n\n`;
    prompt += `Filenames to analyze:\n`;
    icons.forEach((icon, index) => {
      prompt += `${index + 1}. ${icon.filename}\n`;
    });

    // Build the content array with prompt and all images
    const contentParts: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];
    
    for (const icon of icons) {
      const imageFilePath = join(process.cwd(), 'public', icon.path);
      const imageBuffer = await readFile(imageFilePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/png';

      contentParts.push({
        inlineData: {
          data: base64Image,
          mimeType,
        },
      });
    }

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const responseText = response.text().trim();
    
    // Try to parse JSON response
    let keywordsMap: Record<string, string[]> = {};
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      keywordsMap = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }

    // Convert to Map with full paths as keys
    const resultMap = new Map<string, string[]>();
    for (const icon of icons) {
      const keywords = keywordsMap[icon.filename] || [];
      resultMap.set(icon.path, keywords.filter((k: string) => k && k.trim().length > 0));
    }

    return resultMap;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`  Retrying batch... (${retries + 1}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY);
      return generateKeywordsForImages(icons, retries + 1);
    }
    throw error;
  }
}

async function getAllIcons(): Promise<Array<{ path: string; filename: string; category: string }>> {
  const iconsDir = join(process.cwd(), 'public', 'icons');
  const categories = ['ibm', 'ibm-pictograms', 'streamline', 'themed'];
  const icons: Array<{ path: string; filename: string; category: string }> = [];

  for (const category of categories) {
    const categoryPath = join(iconsDir, category);
    try {
      const files = await readdir(categoryPath);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      for (const file of pngFiles) {
        icons.push({
          path: `/icons/${category}/${file}`,
          filename: file,
          category,
        });
      }
    } catch (error) {
      console.error(`Error reading category ${category}:`, error);
    }
  }

  return icons;
}

async function main() {
  // Parse command-line arguments
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const isTest = process.argv.includes('--test');

  console.log('Starting keyword generation...');
  if (limit || isTest) {
    const testLimit = limit || (isTest ? 5 : undefined);
    console.log(`🧪 TEST MODE: Processing only ${testLimit} images`);
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Load existing keywords if they exist
  const keywordsFilePath = join(process.cwd(), 'keywords.json');
  let existingKeywords: KeywordsData = {};
  
  if (existsSync(keywordsFilePath)) {
    try {
      const existingData = await readFile(keywordsFilePath, 'utf-8');
      existingKeywords = JSON.parse(existingData);
      console.log(`Loaded ${Object.keys(existingKeywords).length} existing keywords`);
    } catch {
      console.log('No existing keywords file found, starting fresh');
    }
  }

  let icons = await getAllIcons();
  
  // Apply limit for test mode
  if (limit || isTest) {
    const testLimit = limit || (isTest ? 5 : undefined);
    if (testLimit) {
      icons = icons.slice(0, testLimit);
      console.log(`Limited to first ${testLimit} icons for testing`);
    }
  }
  
  console.log(`Found ${icons.length} icons to process`);

  const keywords: KeywordsData = { ...existingKeywords };
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Filter out already processed icons
  const iconsToProcess = icons.filter(icon => !keywords[icon.path]);
  skipped = icons.length - iconsToProcess.length;
  
  if (skipped > 0) {
    console.log(`Skipping ${skipped} icons that already have keywords`);
  }

  console.log(`Processing ${iconsToProcess.length} icons in batches of ${IMAGES_PER_REQUEST} per API call...`);

  // Process in batches of up to 16 images per API call
  for (let batchStart = 0; batchStart < iconsToProcess.length; batchStart += IMAGES_PER_REQUEST) {
    const batchEnd = Math.min(batchStart + IMAGES_PER_REQUEST, iconsToProcess.length);
    const batch = iconsToProcess.slice(batchStart, batchEnd);
    const batchNumber = Math.floor(batchStart / IMAGES_PER_REQUEST) + 1;
    const totalBatches = Math.ceil(iconsToProcess.length / IMAGES_PER_REQUEST);

    console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (processing ${batch.length} images in one API call)...`);

    try {
      const keywordsMap = await generateKeywordsForImages(batch);
      
      // Store results
      for (let i = 0; i < batch.length; i++) {
        const icon = batch[i];
        const globalIndex = batchStart + i + 1;
        const iconKeywords = keywordsMap.get(icon.path) || [];
        if (iconKeywords.length > 0) {
          keywords[icon.path] = iconKeywords;
          processed++;
          console.log(`  ✓ [${globalIndex}/${iconsToProcess.length}] ${icon.filename}: ${iconKeywords.join(', ')}`);
        } else {
          errors++;
          console.error(`  ⚠ [${globalIndex}/${iconsToProcess.length}] ${icon.filename}: No keywords returned`);
        }
      }
    } catch (error) {
      errors += batch.length;
      console.error(`  ✗ Error processing batch:`, error instanceof Error ? error.message : error);
      // Mark all icons in the failed batch as errors
      for (let i = 0; i < batch.length; i++) {
        const icon = batch[i];
        const globalIndex = batchStart + i + 1;
        console.error(`  ✗ [${globalIndex}/${iconsToProcess.length}] ${icon.filename}: Batch failed`);
      }
    }

    // Save progress after each batch
    await writeFile(keywordsFilePath, JSON.stringify(keywords, null, 2));
    console.log(`  💾 Progress saved (${processed} processed, ${skipped} skipped, ${errors} errors)`);

    // Rate limiting - wait between batches (except for the last batch)
    if (batchEnd < iconsToProcess.length) {
      const waitSeconds = Math.ceil(BATCH_DELAY / 1000);
      console.log(`  ⏳ Waiting ${waitSeconds} seconds before next batch (rate limiting)...`);
      await delay(BATCH_DELAY);
    }
  }

  // Final save
  await writeFile(keywordsFilePath, JSON.stringify(keywords, null, 2));
  
  console.log('\n=== Summary ===');
  console.log(`Total icons: ${icons.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped (already had keywords): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Keywords saved to: ${keywordsFilePath}`);
}

main().catch(console.error);

