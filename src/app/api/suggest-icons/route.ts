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

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Create the prompt
    const prompt = `Given the following text query and list of icons with their metadata, analyze which icons are thematically related to the text query.

Text Query: "${query}"

Icons Data (${icons.length} total):
${JSON.stringify(iconsData, null, 2)}

Return ONLY a JSON array of icon paths (the "path" field values) that are thematically related to the text query. 
Do not include any explanation, markdown formatting, or additional text - only the JSON array.
Example format: ["/icons/ibm/example@2x.png", "/icons/streamline/another@2x.png"]`;

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

