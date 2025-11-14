import { getAllIcons, getCategories } from '@/lib/icons';
import IconBrowser from '@/components/IconBrowser';

// Force dynamic rendering to avoid Turbopack warnings about dynamic file system reads
export const dynamic = 'force-dynamic';

export default async function Home() {
  const icons = await getAllIcons();
  const categories = getCategories(icons);

  return <IconBrowser icons={icons} categories={categories} />;
}
