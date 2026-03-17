import { readFile, writeFile } from 'fs/promises';
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

interface IconEmbedding {
  path: string;
  keywords: string[];
  embedding: number[];
}

const BATCH_SIZE = 100; // Process embeddings in batches to avoid rate limits
const BATCH_DELAY = 1000; // Wait 1 second between batches
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbedding(text: string, retries = 0): Promise<number[]> {
  try {
    // Use REST API directly since SDK doesn't expose embedContent
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Extract embedding values from response
    if (result.embedding && result.embedding.values) {
      return result.embedding.values;
    } else if (Array.isArray(result.embedding)) {
      return result.embedding;
    } else {
      throw new Error('Unexpected embedding response format');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (retries < MAX_RETRIES && (errorMessage.includes('rate limit') || errorMessage.includes('429'))) {
      console.log(`Rate limited, retrying in ${RETRY_DELAY}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY * (retries + 1));
      return generateEmbedding(text, retries + 1);
    }
    throw error;
  }
}

async function generateEmbeddingsForIcons(keywords: KeywordsData): Promise<IconEmbedding[]> {
  const embeddings: IconEmbedding[] = [];
  const entries = Object.entries(keywords);
  const total = entries.length;

  console.log(`Generating embeddings for ${total} icons...`);

  // Process in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} icons)...`);

    // Process batch in parallel (with some concurrency control)
    const batchPromises = batch.map(async ([path, iconKeywords]) => {
      try {
        // Concatenate keywords into a single string
        const keywordsText = iconKeywords.join(', ');
        
        // Generate embedding
        const embedding = await generateEmbedding(keywordsText);
        
        return {
          path,
          keywords: iconKeywords,
          embedding,
        };
      } catch (error: any) {
        console.error(`Error generating embedding for ${path}:`, error.message);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Filter out null results and add to embeddings array
    const validResults = batchResults.filter((result): result is IconEmbedding => result !== null);
    embeddings.push(...validResults);

    // Save progress after each batch
    const embeddingsFilePath = join(process.cwd(), 'icon_embeddings.json');
    await writeFile(embeddingsFilePath, JSON.stringify(embeddings, null, 2));
    console.log(`Saved progress: ${embeddings.length}/${total} embeddings`);

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < entries.length) {
      await delay(BATCH_DELAY);
    }
  }

  return embeddings;
}

async function main() {
  try {
    const keywordsFilePath = join(process.cwd(), 'keywords.json');
    
    if (!existsSync(keywordsFilePath)) {
      console.error('Error: keywords.json not found. Please run generate-keywords first.');
      process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('Error: GEMINI_API_KEY not found in .env.local');
      process.exit(1);
    }

    console.log('Loading keywords.json...');
    const keywordsData = await readFile(keywordsFilePath, 'utf-8');
    const keywords: KeywordsData = JSON.parse(keywordsData);

    const totalIcons = Object.keys(keywords).length;
    console.log(`Found ${totalIcons} icons with keywords`);

    // Check if embeddings already exist
    const embeddingsFilePath = join(process.cwd(), 'icon_embeddings.json');
    let existingEmbeddings: IconEmbedding[] = [];

    if (existsSync(embeddingsFilePath)) {
      console.log('Found existing embeddings file. Loading...');
      const existingData = await readFile(embeddingsFilePath, 'utf-8');
      existingEmbeddings = JSON.parse(existingData);
      console.log(`Found ${existingEmbeddings.length} existing embeddings`);

      // Filter out icons that already have embeddings
      const existingPaths = new Set(existingEmbeddings.map(e => e.path));
      const missingEntries = Object.entries(keywords).filter(([path]) => !existingPaths.has(path));
      
      if (missingEntries.length > 0) {
        console.log(`Generating embeddings for ${missingEntries.length} missing icons...`);
        const newKeywords: KeywordsData = Object.fromEntries(missingEntries);
        const newEmbeddings = await generateEmbeddingsForIcons(newKeywords);
        existingEmbeddings.push(...newEmbeddings);
      } else {
        console.log('All icons already have embeddings!');
      }
    } else {
      // Generate all embeddings
      existingEmbeddings = await generateEmbeddingsForIcons(keywords);
    }

    // Final save
    await writeFile(embeddingsFilePath, JSON.stringify(existingEmbeddings, null, 2));
    console.log(`\n✓ Successfully generated ${existingEmbeddings.length} embeddings`);
    console.log(`Saved to: ${embeddingsFilePath}`);
  } catch (error: any) {
    console.error('Error generating embeddings:', error);
    process.exit(1);
  }
}

main();

