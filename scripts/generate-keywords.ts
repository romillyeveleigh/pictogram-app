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

const RATE_LIMIT_DELAY = 4100; // ~15 requests per minute (60s / 15 = 4s, add buffer)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateKeywordsForImage(imagePath: string, retries = 0): Promise<string[]> {
  try {
    const imageFilePath = join(process.cwd(), 'public', imagePath);
    const imageBuffer = await readFile(imageFilePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Analyze this icon image and generate 5-10 descriptive keywords that would help someone find this icon. 
    Return only a comma-separated list of keywords, no other text. 
    Focus on what the icon represents, its purpose, and visual elements. 
    Keywords should be concise (1-3 words each).`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const keywordsText = response.text().trim();
    
    const keywords = keywordsText
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    return keywords;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`  Retrying... (${retries + 1}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY);
      return generateKeywordsForImage(imagePath, retries + 1);
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
    } catch (error) {
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

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    
    // Skip if already processed
    if (keywords[icon.path]) {
      skipped++;
      console.log(`[${i + 1}/${icons.length}] Skipping ${icon.filename} (already processed)`);
      continue;
    }

    try {
      console.log(`[${i + 1}/${icons.length}] Processing ${icon.filename}...`);
      const iconKeywords = await generateKeywordsForImage(icon.path);
      keywords[icon.path] = iconKeywords;
      processed++;
      console.log(`  ✓ Generated keywords: ${iconKeywords.join(', ')}`);

      // Save progress every 10 images (or after each image in test mode)
      const shouldSave = isTest || limit ? true : (i + 1) % 10 === 0;
      if (shouldSave) {
        await writeFile(keywordsFilePath, JSON.stringify(keywords, null, 2));
        if (!isTest && !limit) {
          console.log(`  Progress saved (${processed} processed, ${skipped} skipped, ${errors} errors)`);
        }
      }

      // Rate limiting - wait between requests
      if (i < icons.length - 1) {
        await delay(RATE_LIMIT_DELAY);
      }
    } catch (error) {
      errors++;
      console.error(`  ✗ Error processing ${icon.filename}:`, error instanceof Error ? error.message : error);
      // Continue with next image
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

