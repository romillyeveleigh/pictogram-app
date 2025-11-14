import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function listModels() {
  try {
    // The Google Generative AI SDK doesn't have a listModels() method.
    // Instead, we test common model names to see which are available.
    const modelNames = [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp-001',
    ];

    console.log('Testing model availability:');
    console.log('(Note: This tests if models can be instantiated, not if they work)\n');

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // Model object created successfully
        console.log(`✓ ${modelName}`);
      } catch (error: any) {
        console.log(`✗ ${modelName} - ${error.message?.substring(0, 60) || 'Error'}`);
      }
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();

