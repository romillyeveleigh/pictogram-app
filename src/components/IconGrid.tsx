'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { IconInfo } from '@/lib/icons';

interface IconGridProps {
  icons: IconInfo[];
}

export default function IconGrid({ icons }: IconGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return icons;
    }
    
    const query = searchQuery.toLowerCase();
    return icons.filter(icon => 
      icon.filename.toLowerCase().includes(query)
    );
  }, [icons, searchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search icons by filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredIcons.length} of {icons.length} icons
        </p>
      </div>

      {filteredIcons.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No icons found matching &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filteredIcons.map((icon) => (
            <div
              key={icon.path}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 dark:border-gray-700 group cursor-pointer"
              title={icon.filename}
            >
              <div className="relative w-16 h-16 mb-2 flex items-center justify-center">
                <Image
                  src={icon.path}
                  alt={icon.filename}
                  fill
                  className="object-contain"
                  sizes="64px"
                />
              </div>
              <p className="text-xs text-center text-gray-600 dark:text-gray-400 truncate w-full px-1 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                {icon.filename.replace('@2x.png', '').replace('.png', '')}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {icon.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

