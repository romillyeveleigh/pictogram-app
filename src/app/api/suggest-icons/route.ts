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

    // Format icons data efficiently - only send path and keywords to minimize token usage
    // Use compact format without pretty printing to reduce token count
    const iconsData = icons.map(icon => ({
      p: icon.path, // 'p' instead of 'path' to save tokens
      k: (icon.keywords || []).join(', '), // 'k' instead of 'keywords', join to string
    }));

    // Get the generative model - use the suggested model with higher quota
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Create a more compact prompt
    const iconsJson = JSON.stringify(iconsData); // Compact JSON, no pretty printing
    
    const prompt = `Text query: "${query}"

Icons (${icons.length} total, format: {p: "path", k: "keywords"}):
${iconsJson}

Return ONLY a JSON array of icon paths (the "p" field values) thematically related to the query. No explanation, only JSON array.
Example: ["/icons/ibm/example@2x.png"]`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

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
    
    if (firstBracket === -1 || lastBracket === -1) {
      throw new Error('Could not find JSON array in response');
    }
    
    jsonText = jsonText.substring(firstBracket, lastBracket + 1);
    
    const suggestedPaths = JSON.parse(jsonText);
    
    if (!Array.isArray(suggestedPaths)) {
      throw new Error('Response is not an array');
    }

    return NextResponse.json({ suggestedPaths });
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

