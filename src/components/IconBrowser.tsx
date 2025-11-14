'use client';

import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { IconInfo, CategoryInfo } from '@/lib/icons';

interface IconBrowserProps {
  icons: IconInfo[];
  categories: CategoryInfo[];
}

export default function IconBrowser({ icons, categories }: IconBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState(64);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState<IconInfo | null>(null);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [isPanelOpening, setIsPanelOpening] = useState(false);
  const [downloadedIcon, setDownloadedIcon] = useState<string | null>(null);
  const [columns, setColumns] = useState(2);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredIcons = useMemo(() => {
    let filtered = icons;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(icon => icon.category === selectedCategory);
    }

    // Filter by search query (search in keywords, fallback to filename if no keywords)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(icon => {
        // If keywords exist, search in keywords
        if (icon.keywords && icon.keywords.length > 0) {
          return icon.keywords.some(keyword => 
            keyword.toLowerCase().includes(query)
          );
        }
        // Fallback to filename search if no keywords available
        return icon.filename.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [icons, searchQuery, selectedCategory]);

  // Calculate columns based on container width
  useLayoutEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) {
        // Retry after a short delay if element not ready
        setTimeout(updateColumns, 100);
        return;
      }
      const width = parentRef.current.offsetWidth;
      let cols = 2;
      if (width >= 1536) cols = 10; // 2xl
      else if (width >= 1280) cols = 8; // xl
      else if (width >= 1024) cols = 6; // lg
      else if (width >= 768) cols = 4; // md
      else if (width >= 640) cols = 3; // sm
      setColumns(cols);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    // Also update when sidebar toggles
    const timeoutId = setTimeout(updateColumns, 100);
    return () => {
      window.removeEventListener('resize', updateColumns);
      clearTimeout(timeoutId);
    };
  }, [showSidebar]);

  // Calculate rows for virtualization
  const rows = useMemo(() => Math.ceil(filteredIcons.length / columns), [filteredIcons.length, columns]);
  
  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Estimated height per row (icon + padding)
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  const getDisplayName = (filename: string) => {
    return filename
      .replace('@2x.png', '')
      .replace('.png', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleIconClick = (icon: IconInfo) => {
    if (selectedIcon && selectedIcon.path !== icon.path) {
      // If panel is already open with a different icon, close it first, then open with new icon
      setIsPanelClosing(true);
      setTimeout(() => {
        setSelectedIcon(icon);
        setIsPanelClosing(false);
        setIsPanelOpening(true);
        // Trigger animation after a brief moment to ensure DOM update
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsPanelOpening(false);
          });
        });
      }, 300);
    } else if (!selectedIcon) {
      // Opening for the first time
      setIsPanelClosing(false);
      setSelectedIcon(icon);
      setIsPanelOpening(true);
      // Trigger animation after a brief moment to ensure DOM update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsPanelOpening(false);
        });
      });
    }
    // If clicking the same icon, do nothing
  };

  const handleClosePanel = () => {
    setIsPanelClosing(true);
    setIsPanelOpening(false);
    setTimeout(() => {
      setSelectedIcon(null);
      setIsPanelClosing(false);
    }, 300); // Match the animation duration
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedIcon(path);
      setTimeout(() => setCopiedIcon(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyFilename = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename);
      setCopiedIcon(filename);
      setTimeout(() => setCopiedIcon(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = async (icon: IconInfo) => {
    try {
      const response = await fetch(icon.path);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = icon.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloadedIcon(icon.filename);
      setTimeout(() => setDownloadedIcon(null), 2000);
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 relative">
      {/* Mobile Overlay */}
      {showSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`${showSidebar ? 'block' : 'hidden'} lg:block fixed lg:relative inset-y-0 left-0 z-50 w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-950`}>
        <div className="p-4 sticky top-0 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 z-10">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Categories
          </h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selectedCategory === null
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All ({icons.length})
          </button>
        </div>
        <nav className="p-2">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-1 ${
                selectedCategory === category.name
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center justify-between">
                <span>{category.displayName}</span>
                <span className="text-xs opacity-70">{category.count}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search */}
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20">
          <div className="px-4 sm:px-6 py-4">
            {/* Site Title */}
            <div className="mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Apolitical Image Finder
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Search through {icons.length} icons by filename
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Toggle sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Customizer
              </button>
            </div>
            {showCustomizer && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Icon Size: {iconSize}px
                    </label>
                    <input
                      type="range"
                      min="32"
                      max="128"
                      step="8"
                      value={iconSize}
                      onChange={(e) => setIconSize(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredIcons.length} of {icons.length} icons
            </p>
          </div>
        </header>

        {/* Icon Grid */}
        <main 
          ref={parentRef}
          className={`flex-1 overflow-y-auto bg-white dark:bg-gray-900 ${selectedIcon ? 'pb-96 sm:pb-80' : ''}`}
        >
          {filteredIcons.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                  No icons found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {searchQuery ? `No icons match "${searchQuery}"` : 'Try selecting a different category'}
                </p>
              </div>
            </div>
          ) : (
            <div 
              className="relative p-6"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columns;
                const endIndex = Math.min(startIndex + columns, filteredIcons.length);
                const rowIcons = filteredIcons.slice(startIndex, endIndex);

                return (
                  <div
                    key={virtualRow.key}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid gap-4 min-w-0" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                      {rowIcons.map((icon) => (
                        <div
                          key={icon.path}
                          onClick={() => handleIconClick(icon)}
                          className={`group relative flex flex-col items-center p-4 rounded-lg border transition-all bg-white dark:bg-gray-800 cursor-pointer min-w-0 w-full ${
                            selectedIcon?.path === icon.path
                              ? 'border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-500 dark:ring-blue-400'
                              : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md'
                          }`}
                          title={getDisplayName(icon.filename)}
                        >
                          <div
                            className="relative flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                            style={{ width: iconSize, height: iconSize }}
                          >
                            <Image
                              src={icon.path}
                              alt={getDisplayName(icon.filename)}
                              fill
                              className="object-contain"
                              sizes={`${iconSize}px`}
                            />
                          </div>
                          <p className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate w-full px-1 min-w-0">
                            {getDisplayName(icon.filename)}
                          </p>
                          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate w-full min-w-0">
                            {icon.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
      
      {/* Icon Detail Panel (Bottom Modal) */}
      {selectedIcon && (
        <div 
          className={`fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-2xl transform transition-transform duration-300 ease-out ${
            isPanelClosing ? 'translate-y-full' : isPanelOpening ? 'translate-y-full' : 'translate-y-0'
          }`}
          onTransitionEnd={() => {
            if (isPanelOpening) {
              setIsPanelOpening(false);
            }
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
              {/* Icon Preview */}
              <div className="flex-shrink-0 w-full sm:w-auto">
                <div className="w-full sm:w-32 sm:h-32 md:w-40 md:h-40 aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 sm:mb-0">
                  <div className="relative w-full h-full">
                    <Image
                      src={selectedIcon.path}
                      alt={getDisplayName(selectedIcon.filename)}
                      fill
                      className="object-contain"
                      sizes="160px"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(selectedIcon)}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Image
                </button>
              </div>

              {/* Icon Details */}
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 truncate">
                      {getDisplayName(selectedIcon.filename)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Category: <span className="font-medium">{selectedIcon.category}</span>
                    </p>
                  </div>
                  <button
                    onClick={handleClosePanel}
                    className="flex-shrink-0 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 ml-2"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Copy Options */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon Path
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
                        {selectedIcon.path}
                      </code>
                      <button
                        onClick={() => handleCopyPath(selectedIcon.path)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        {copiedIcon === selectedIcon.path ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filename
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
                        {selectedIcon.filename}
                      </code>
                      <button
                        onClick={() => handleCopyFilename(selectedIcon.filename)}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        {copiedIcon === selectedIcon.filename ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notifications */}
      {copiedIcon && !selectedIcon && (
        <div className={`fixed right-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg z-[60] transition-opacity duration-300 ${
          selectedIcon ? 'bottom-96 sm:bottom-80' : 'bottom-4'
        }`}>
          Copied to clipboard!
        </div>
      )}
      {downloadedIcon && (
        <div className={`fixed right-4 bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60] transition-opacity duration-300 ${
          selectedIcon ? 'bottom-96 sm:bottom-80' : 'bottom-4'
        }`}>
          Image downloaded: {downloadedIcon}
        </div>
      )}
    </div>
  );
}

