import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    // Format icons data efficiently for the prompt
    const iconsData = icons.map(icon => ({
      path: icon.path,
      filename: icon.filename,
      keywords: icon.keywords || [],
      category: icon.category,
    }));

    // Get the generative model with temperature set to 0 for deterministic results
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0, // Set to 0 for deterministic results
      }
    });

    // Create a set of valid icon paths for validation
    const validPaths = new Set(icons.map(icon => icon.path));

    // Create the prompt
    const prompt = `Given the following text query and list of icons with their metadata, analyze which icons are thematically related to the text query.

Text Query: "${query}"

Icons Data (${icons.length} total):
${JSON.stringify(iconsData, null, 2)}

CRITICAL REQUIREMENTS:
1. Return ONLY a JSON array of icon paths (the "path" field values) that are thematically related to the text query.
2. Each path must include the extension ".png".
3. NO DUPLICATES - Each path must appear exactly once in the array. Use a Set-like approach mentally to ensure uniqueness.
4. Only return paths that exist in the Icons Data above. Do not invent or guess paths.
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

    // Validate and filter out invalid paths
    const validSuggestedPaths = uniqueSuggestedPaths.filter((path: string) => {
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

