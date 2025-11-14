import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function testAPI() {
  try {
    console.log('Testing API key with text-only model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Say hello in one word');
    const response = await result.response;
    console.log('✓ API key works! Response:', response.text());
    
    console.log('\nTrying to find vision-capable models...');
    // Try common vision model names
    const visionModels = ['gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
    
    for (const modelName of visionModels) {
      try {
        console.log(`\nTrying model: ${modelName}...`);
        const testModel = genAI.getGenerativeModel({ model: modelName });
        // Just test if we can create the model object (won't make actual request)
        console.log(`  Model object created successfully`);
      } catch (error: any) {
        console.log(`  ✗ Error: ${error.message?.substring(0, 100)}`);
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testAPI();

