import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { imagePath } = await request.json();

    if (!imagePath) {
      return NextResponse.json(
        { error: 'imagePath is required' },
        { status: 400 }
      );
    }

    // Read the image file from public directory
    const imageFilePath = join(process.cwd(), 'public', imagePath);
    const imageBuffer = await readFile(imageFilePath);
    const base64Image = imageBuffer.toString('base64');

    // Determine MIME type from file extension
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Create the prompt
    const prompt = `Analyze this icon image and generate 5-10 descriptive keywords that would help someone find this icon. 
    Return only a comma-separated list of keywords, no other text. 
    Focus on what the icon represents, its purpose, and visual elements. 
    Keywords should be concise (1-3 words each).`;

    // Generate content
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
    
    // Parse keywords (split by comma, trim, filter empty)
    const keywords = keywordsText
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('Error generating keywords:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

