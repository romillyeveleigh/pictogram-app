import { readdir } from 'fs/promises';
import { join } from 'path';

export interface IconInfo {
  path: string;
  filename: string;
  category: string;
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

export async function getAllIcons(): Promise<IconInfo[]> {
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

