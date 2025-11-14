import { getAllIcons } from '@/lib/icons';
import IconGrid from '@/components/IconGrid';

export default async function Home() {
  const icons = await getAllIcons();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Icon Search
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Search through {icons.length} icons by filename
          </p>
        </div>
      </header>
      <main>
        <IconGrid icons={icons} />
      </main>
    </div>
  );
}
