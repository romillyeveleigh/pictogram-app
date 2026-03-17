import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';

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
  console.log('Generating SVG mapping...\n');

  // Load all figma SVGs
  const figmaDir = join(process.cwd(), 'public', 'figma-icons');
  const svgFiles = await readdir(figmaDir);
  console.log(`Found ${svgFiles.length} SVG files in figma-icons/\n`);

  // Build a lowercase lookup: baseName -> svgFilename
  const svgByBaseName = new Map<string, string[]>();
  for (const svgFile of svgFiles) {
    if (!svgFile.endsWith('.svg')) continue;
    // Extract base name: everything before the last _XX-XXXXX.svg suffix
    const underscoreIdx = svgFile.lastIndexOf('_');
    if (underscoreIdx === -1) continue;
    const baseName = svgFile.substring(0, underscoreIdx).toLowerCase();
    if (!svgByBaseName.has(baseName)) {
      svgByBaseName.set(baseName, []);
    }
    svgByBaseName.get(baseName)!.push(svgFile);
  }

  // Get all PNG icons
  const icons = await getAllIcons();
  console.log(`Found ${icons.length} PNG icons\n`);

  // Build mapping: icon path -> SVG path
  const mapping: Record<string, string> = {};
  const matched: IconInfo[] = [];
  const unmatched: IconInfo[] = [];
  const ambiguous: { icon: IconInfo; candidates: string[] }[] = [];

  for (const icon of icons) {
    // Strip @2x.png to get base name
    const baseName = icon.filename.replace(/@2x\.png$/, '').toLowerCase();

    const candidates = svgByBaseName.get(baseName);
    if (!candidates || candidates.length === 0) {
      unmatched.push(icon);
    } else if (candidates.length === 1) {
      mapping[icon.path] = `/figma-icons/${candidates[0]}`;
      matched.push(icon);
    } else {
      // Multiple matches - flag as ambiguous but pick the first
      mapping[icon.path] = `/figma-icons/${candidates[0]}`;
      matched.push(icon);
      ambiguous.push({ icon, candidates });
    }
  }

  // Report by category
  const categoryCounts: Record<string, { total: number; matched: number; unmatched: number }> = {};
  for (const icon of icons) {
    if (!categoryCounts[icon.category]) {
      categoryCounts[icon.category] = { total: 0, matched: 0, unmatched: 0 };
    }
    categoryCounts[icon.category].total++;
  }
  for (const icon of matched) {
    categoryCounts[icon.category].matched++;
  }
  for (const icon of unmatched) {
    categoryCounts[icon.category].unmatched++;
  }

  console.log('=== Results by Category ===');
  for (const [category, counts] of Object.entries(categoryCounts)) {
    const pct = ((counts.matched / counts.total) * 100).toFixed(1);
    console.log(`${category}:`);
    console.log(`  Total: ${counts.total}`);
    console.log(`  Matched: ${counts.matched} (${pct}%)`);
    console.log(`  Unmatched: ${counts.unmatched}`);
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Total PNG icons: ${icons.length}`);
  console.log(`Matched to SVG:  ${matched.length}`);
  console.log(`Unmatched:       ${unmatched.length}`);
  console.log(`Ambiguous:       ${ambiguous.length}`);

  if (unmatched.length > 0) {
    console.log(`\n=== Unmatched Icons (no SVG found) ===`);
    const byCategory: Record<string, string[]> = {};
    for (const icon of unmatched) {
      if (!byCategory[icon.category]) byCategory[icon.category] = [];
      byCategory[icon.category].push(icon.filename);
    }
    for (const [category, filenames] of Object.entries(byCategory)) {
      console.log(`\n${category} (${filenames.length}):`);
      for (const f of filenames) {
        console.log(`  - ${f}`);
      }
    }
  }

  if (ambiguous.length > 0) {
    console.log(`\n=== Ambiguous Matches (multiple SVGs found) ===`);
    for (const { icon, candidates } of ambiguous) {
      console.log(`  ${icon.filename} -> ${candidates.join(', ')}`);
    }
  }

  // Save the mapping
  const outputFile = join(process.cwd(), 'svg-mapping.json');
  await writeFile(outputFile, JSON.stringify(mapping, null, 2));
  console.log(`\n✓ Mapping saved to svg-mapping.json (${Object.keys(mapping).length} entries)`);

  // Save unmatched list
  if (unmatched.length > 0) {
    const unmatchedFile = join(process.cwd(), 'svg-unmatched.json');
    await writeFile(unmatchedFile, JSON.stringify(unmatched.map(i => i.path), null, 2));
    console.log(`✓ Unmatched list saved to svg-unmatched.json`);
  }
}

main().catch(console.error);
