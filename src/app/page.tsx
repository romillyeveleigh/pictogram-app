import { getAllIcons, getCategories } from '@/lib/icons';
import IconBrowser from '@/components/IconBrowser';

export default async function Home() {
  const icons = await getAllIcons();
  const categories = getCategories(icons);

  return <IconBrowser icons={icons} categories={categories} />;
}
