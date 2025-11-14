import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface IconInfo {
  path: string;
  filename: string;
  category: string;
  keywords?: string[];
}

export interface CategoryInfo {
  name: string;
  displayName: string;
  count: number;
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'ibm': 'IBM Icons',
  'ibm-pictograms': 'IBM Pictograms',
  'streamline': 'Streamline',
  'themed': 'Themed',
};

async function loadKeywords(): Promise<Record<string, string[]>> {
  const keywordsFilePath = join(process.cwd(), 'keywords.json');
  
  if (!existsSync(keywordsFilePath)) {
    return {};
  }

  try {
    const keywordsData = await readFile(keywordsFilePath, 'utf-8');
    return JSON.parse(keywordsData);
  } catch (error) {
    console.error('Error loading keywords:', error);
    return {};
  }
}

export async function getAllIcons(): Promise<IconInfo[]> {
  const iconsDir = join(process.cwd(), 'public', 'icons');
  const categories = ['ibm', 'ibm-pictograms', 'streamline', 'themed'];
  const icons: IconInfo[] = [];

  // Load keywords
  const keywords = await loadKeywords();

  for (const category of categories) {
    const categoryPath = join(iconsDir, category);
    try {
      const files = await readdir(categoryPath);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      for (const file of pngFiles) {
        const iconPath = `/icons/${category}/${file}`;
        icons.push({
          path: iconPath,
          filename: file,
          category,
          keywords: keywords[iconPath] || undefined,
        });
      }
    } catch (error) {
      console.error(`Error reading category ${category}:`, error);
    }
  }

  return icons;
}

export function getCategories(icons: IconInfo[]): CategoryInfo[] {
  const categoryCounts = icons.reduce((acc, icon) => {
    acc[icon.category] = (acc[icon.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(categoryCounts).map(([name, count]) => ({
    name,
    displayName: CATEGORY_DISPLAY_NAMES[name] || name,
    count,
  }));
}

