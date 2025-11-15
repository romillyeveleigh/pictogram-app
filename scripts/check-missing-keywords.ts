import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface IconInfo {
  path: string;
  filename: string;
  category: string;
}

async function getAllIcons(): Promise<IconInfo[]> {
  const iconsDir = join(process.cwd(), 'public', 'icons');
  const categories = ['ibm', 'ibm-pictograms', 'streamline', 'themed'];
  const icons: IconInfo[] = [];

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
  console.log('Checking for images missing keywords...\n');

  // Load keywords
  const keywordsFilePath = join(process.cwd(), 'keywords.json');
  let keywords: Record<string, string[]> = {};
  
  if (existsSync(keywordsFilePath)) {
    try {
      const keywordsData = await readFile(keywordsFilePath, 'utf-8');
      keywords = JSON.parse(keywordsData);
      console.log(`Loaded ${Object.keys(keywords).length} keyword entries\n`);
    } catch (error) {
      console.error('Error loading keywords.json:', error);
      process.exit(1);
    }
  } else {
    console.error('keywords.json not found!');
    process.exit(1);
  }

  // Get all icons
  const icons = await getAllIcons();
  console.log(`Found ${icons.length} total images\n`);

  // Find missing keywords
  const missingKeywords: IconInfo[] = [];
  const categoryCounts: Record<string, { total: number; missing: number }> = {};

  for (const icon of icons) {
    if (!categoryCounts[icon.category]) {
      categoryCounts[icon.category] = { total: 0, missing: 0 };
    }
    categoryCounts[icon.category].total++;

    if (!keywords[icon.path] || keywords[icon.path].length === 0) {
      missingKeywords.push(icon);
      categoryCounts[icon.category].missing++;
    }
  }

  // Report results
  console.log('=== Results by Category ===');
  for (const [category, counts] of Object.entries(categoryCounts)) {
    const percentage = ((counts.total - counts.missing) / counts.total * 100).toFixed(1);
    console.log(`${category}:`);
    console.log(`  Total: ${counts.total}`);
    console.log(`  With keywords: ${counts.total - counts.missing} (${percentage}%)`);
    console.log(`  Missing keywords: ${counts.missing}`);
    console.log('');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total images: ${icons.length}`);
  console.log(`Images with keywords: ${icons.length - missingKeywords.length}`);
  console.log(`Images missing keywords: ${missingKeywords.length}`);

  if (missingKeywords.length > 0) {
    console.log(`\n=== Images Missing Keywords ===`);
    
    // Group by category
    const byCategory: Record<string, IconInfo[]> = {};
    for (const icon of missingKeywords) {
      if (!byCategory[icon.category]) {
        byCategory[icon.category] = [];
      }
      byCategory[icon.category].push(icon);
    }

    for (const [category, icons] of Object.entries(byCategory)) {
      console.log(`\n${category} (${icons.length} missing):`);
      for (const icon of icons) {
        console.log(`  - ${icon.path}`);
      }
    }

    // Save to file
    const outputFile = join(process.cwd(), 'missing-keywords.json');
    const output = {
      total: missingKeywords.length,
      byCategory: byCategory,
      all: missingKeywords.map(i => i.path)
    };
    await writeFile(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n✓ Missing keywords list saved to: missing-keywords.json`);
  } else {
    console.log('\n✓ All images have keywords!');
  }
}

main().catch(console.error);

