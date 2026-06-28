import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  loadEmbeddings,
  embedQuery,
  findSimilarIcons,
  getFilteredKeywords,
} from '@/lib/embeddings';
import { readFile as readFileAsync } from 'fs/promises';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory cache for keywords
let cachedKeywords: Record<string, string[]> | null = null;

async function loadKeywords(): Promise<Record<string, string[]>> {
  // Return cached keywords if available
  if (cachedKeywords !== null) {
    return cachedKeywords;
  }

  const keywordsFilePath = join(process.cwd(), 'keywords.json');
  
  if (!existsSync(keywordsFilePath)) {
    cachedKeywords = {};
    return cachedKeywords;
  }

  try {
    const keywordsData = await readFile(keywordsFilePath, 'utf-8');
    cachedKeywords = JSON.parse(keywordsData) as Record<string, string[]>;
    return cachedKeywords;
  } catch (error) {
    console.error('Error loading keywords:', error);
    cachedKeywords = {};
    return cachedKeywords;
  }
}


export async function POST(request: NextRequest) {
  try {
    const { query, icons } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    if (!icons || !Array.isArray(icons)) {
      return NextResponse.json(
        { error: 'icons is required and must be an array' },
        { status: 400 }
      );
    }

    // Load keywords.json file (cached after first load)
    const allKeywords = await loadKeywords();
    const totalCount = Object.keys(allKeywords).length;

    // Try to use embeddings for pre-filtering (Hybrid RAG approach)
    let filteredKeywords: Record<string, string[]> = {};
    let useEmbeddings = false;
    let filteredCount = totalCount;

    try {
      // Load pre-computed embeddings
      const iconEmbeddings = await loadEmbeddings();
      
      if (iconEmbeddings.length > 0) {
        useEmbeddings = true;
        console.log(`Using embeddings: found ${iconEmbeddings.length} icon embeddings`);
        
        // Embed the user query
        const queryEmbedding = await embedQuery(query);
        
        // Find top 100 most similar icons using cosine similarity
        const similarIcons = findSimilarIcons(queryEmbedding, iconEmbeddings, 250);
        filteredCount = similarIcons.length;
        
        if (filteredCount > 0) {
          // Get filtered keywords object
          filteredKeywords = getFilteredKeywords(similarIcons);
          console.log(`Pre-filtered to ${filteredCount} most relevant icons using embeddings`);
        } else {
          // Fallback to full context if no matches found
          console.warn('No similar icons found via embeddings, falling back to full context');
          filteredKeywords = allKeywords;
          useEmbeddings = false;
        }
      } else {
        console.warn('No embeddings found, using full context. Run generate-embeddings script first.');
        filteredKeywords = allKeywords;
      }
    } catch (error: unknown) {
      // Fallback to full context if embeddings fail
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Error using embeddings, falling back to full context:', errorMessage);
      filteredKeywords = allKeywords;
      useEmbeddings = false;
    }

    // Get the generative model with temperature set to 0 for deterministic results
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2, // Set to 0 for deterministic results
      }
    });

    // Load SVG mapping to translate PNG paths from AI/embeddings to current SVG paths
    let svgMapping: Record<string, string> = {};
    try {
      const mappingData = await readFileAsync(join(process.cwd(), 'svg-mapping.json'), 'utf-8');
      svgMapping = JSON.parse(mappingData);
    } catch {}

    // Create a set of valid icon paths for validation
    const validPaths = new Set(icons.map(icon => icon.path));

    // Create optimized prompt with filtered keywords (or full context as fallback)
    const prompt = useEmbeddings
      ? `From this pre-filtered list of ${filteredCount} semantically relevant icons, select the top icons that best match the query.

Text Query: "${query}"

Icons (${filteredCount} of ${totalCount} pre-filtered by semantic similarity):
${JSON.stringify(filteredKeywords, null, 2)}

Return ONLY a JSON array of icon paths (keys from above) that match the query. Each path must:
- Include ".png" extension
- Exist in the icons data above
- Appear exactly once (no duplicates)

Format: ["/icons/ibm/example@2x.png", "/icons/streamline/another@2x.png"]`
      : `Given the following text query and the complete keywords.json data, analyze which icons are thematically related and could be used to illustrate the text query.

Text Query: "${query}"

Keywords Data (${totalCount} total icons):
${JSON.stringify(filteredKeywords, null, 2)}

CRITICAL REQUIREMENTS:
1. Return ONLY a JSON array of icon paths (the keys from the keywords.json object) that are thematically related and could be used to illustrate the text query.
2. Each path must include the extension ".png".
3. NO DUPLICATES - Each path must appear exactly once in the array. Use a Set-like approach mentally to ensure uniqueness.
4. Only return paths that exist as keys in the keywords.json data above. Do not invent or guess paths.
5. Do not include any explanation, markdown formatting, or additional text - only the JSON array.

Example format: ["/icons/ibm/example@2x.png", "/icons/streamline/another@2x.png"]`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Check if response was truncated
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS' || finishReason === 'OTHER') {
      console.warn('Response may have been truncated. Finish reason:', finishReason);
    }
    
    const responseText = response.text().trim();

    console.log('responseText', responseText);

    // Try to extract JSON array from the response
    // Handle cases where response might have markdown code blocks or extra text
    let jsonText = responseText;
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n');
      const startIndex = lines.findIndex(line => line.trim().startsWith('['));
      const endIndex = lines.findLastIndex(line => line.trim().endsWith(']'));
      if (startIndex !== -1 && endIndex !== -1) {
        jsonText = lines.slice(startIndex, endIndex + 1).join('\n');
      }
    }
    
    // Extract JSON array (find first [ and last ])
    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');
    
    if (firstBracket === -1) {
      throw new Error('Could not find start of JSON array in response');
    }
    
    // Handle incomplete JSON (truncated response)
    if (lastBracket === -1 || lastBracket < firstBracket) {
      console.warn('Response appears to be truncated - JSON array is incomplete');
      // Try to extract what we can by finding the last complete entry
      const partialJson = jsonText.substring(firstBracket);
      // Find the last complete string entry (ends with " followed by , or ])
      const lastCompleteMatch = partialJson.match(/(".*?")(?:,\s*|\s*])/g);
      if (lastCompleteMatch && lastCompleteMatch.length > 0) {
        // Reconstruct a valid JSON array with what we have
        const entries = lastCompleteMatch.map(m => m.replace(/[,\]]/g, '').trim());
        jsonText = '[' + entries.join(', ') + ']';
        console.warn(`Extracted ${entries.length} complete entries from truncated response`);
      } else {
        throw new Error('Response was truncated and could not extract valid JSON array');
      }
    } else {
      jsonText = jsonText.substring(firstBracket, lastBracket + 1);
    }
    
    const suggestedPaths = JSON.parse(jsonText);
    
    if (!Array.isArray(suggestedPaths)) {
      throw new Error('Response is not an array');
    }

    // Remove duplicates - AI models sometimes don't follow uniqueness instructions
    const uniqueSuggestedPaths = Array.from(new Set(suggestedPaths));

    // Translate PNG paths from AI to SVG paths, then validate
    const validSuggestedPaths = uniqueSuggestedPaths
      .map((path: string) => svgMapping[path] || path)
      .filter((path: string) => {
        const isValid = validPaths.has(path);
        if (!isValid) {
          console.warn(`Invalid path returned by AI: ${path}`);
        }
        return isValid;
      });

    return NextResponse.json({ suggestedPaths: validSuggestedPaths });
  } catch (error) {
    console.error('Error generating icon suggestions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate icon suggestions', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

