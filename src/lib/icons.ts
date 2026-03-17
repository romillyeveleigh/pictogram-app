import { readFile } from 'fs/promises';
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

async function loadSvgMapping(): Promise<Record<string, string>> {
  const mappingPath = join(process.cwd(), 'svg-mapping.json');

  if (!existsSync(mappingPath)) {
    return {};
  }

  try {
    const data = await readFile(mappingPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading svg-mapping.json:', error);
    return {};
  }
}

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
  const icons: IconInfo[] = [];

  // Load keywords and SVG mapping
  const keywords = await loadKeywords();
  const svgMapping = await loadSvgMapping();

  // Build icons from SVG mapping (keyed by old PNG paths like /icons/ibm/Account@2x.png)
  for (const [pngPath, svgPath] of Object.entries(svgMapping)) {
    // Extract category from path: /icons/{category}/{filename}
    const parts = pngPath.split('/');
    const category = parts[2];
    const filename = svgPath.split('/').pop()!;

    icons.push({
      path: svgPath,
      filename,
      category,
      keywords: keywords[pngPath] || undefined,
    });
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

