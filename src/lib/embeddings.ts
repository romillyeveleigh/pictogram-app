import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { similarity } from 'ml-distance';

export interface IconEmbedding {
  path: string;
  keywords: string[];
  embedding: number[];
}

// In-memory cache for embeddings
let cachedEmbeddings: IconEmbedding[] | null = null;

/**
 * Load pre-computed embeddings from file
 */
export async function loadEmbeddings(): Promise<IconEmbedding[]> {
  // Return cached embeddings if available
  if (cachedEmbeddings !== null) {
    return cachedEmbeddings;
  }

  const embeddingsFilePath = join(process.cwd(), 'icon_embeddings.json');
  
  if (!existsSync(embeddingsFilePath)) {
    console.warn('icon_embeddings.json not found. Run generate-embeddings script first.');
    cachedEmbeddings = [];
    return cachedEmbeddings;
  }

  try {
    const embeddingsData = await readFile(embeddingsFilePath, 'utf-8');
    const parsed = JSON.parse(embeddingsData);
    cachedEmbeddings = Array.isArray(parsed) ? parsed : [];
    return cachedEmbeddings;
  } catch (error) {
    console.error('Error loading embeddings:', error);
    cachedEmbeddings = [];
    return cachedEmbeddings;
  }
}

/**
 * Embed a query string using Gemini API via REST API
 */
export async function embedQuery(query: string): Promise<number[]> {
  try {
    // Use REST API directly since SDK doesn't expose embedContent
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: query }],
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
    console.error('Error embedding query:', errorMessage);
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}

/**
 * Find top-K most similar icons using cosine similarity
 */
export function findSimilarIcons(
  queryEmbedding: number[],
  iconEmbeddings: IconEmbedding[],
  topK: number = 100
): Array<{ path: string; keywords: string[]; score: number }> {
  if (iconEmbeddings.length === 0) {
    return [];
  }

  // Compute cosine similarity for each icon
  const similarities = iconEmbeddings.map(icon => {
    // Cosine similarity: higher is more similar (range: -1 to 1)
    // We use 1 - cosine distance for similarity score
    const similarityScore = similarity.cosine(queryEmbedding, icon.embedding);
    return {
      path: icon.path,
      keywords: icon.keywords,
      score: similarityScore,
    };
  });

  // Sort by similarity (descending) and take top K
  similarities.sort((a, b) => b.score - a.score);
  
  return similarities.slice(0, topK);
}

/**
 * Get filtered keywords object for top-K similar icons
 */
export function getFilteredKeywords(
  similarIcons: Array<{ path: string; keywords: string[]; score: number }>
): Record<string, string[]> {
  const filtered: Record<string, string[]> = {};
  for (const icon of similarIcons) {
    filtered[icon.path] = icon.keywords;
  }
  return filtered;
}

