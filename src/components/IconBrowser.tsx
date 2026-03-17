"use client";

import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { IconInfo, CategoryInfo } from "@/lib/icons";

interface IconBrowserProps {
  icons: IconInfo[];
  categories: CategoryInfo[];
}

export default function IconBrowser({ icons, categories }: IconBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  // AI search state
  const [searchMode, setSearchMode] = useState<"keyword" | "ai">("keyword");
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestedPaths, setAiSuggestedPaths] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const filteredIcons = useMemo(() => {
    let filtered = icons;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((icon) => icon.category === selectedCategory);
    }

    // Filter based on search mode
    if (searchMode === "ai") {
      // AI search mode: filter by suggested paths
      if (aiSuggestedPaths.length > 0) {
        filtered = filtered.filter((icon) =>
          aiSuggestedPaths.includes(icon.path)
        );
      } else {
        // If no suggestions yet, show all (or empty if query exists but no results)
        if (aiSearchQuery.trim() && !aiLoading) {
          filtered = [];
        }
      }
    } else {
      // Keyword search mode: search in keywords, fallback to filename
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((icon) => {
          // If keywords exist, search in keywords
          if (icon.keywords && icon.keywords.length > 0) {
            return icon.keywords.some((keyword) =>
              keyword.toLowerCase().includes(query)
            );
          }
          // Fallback to filename search if no keywords available
          return icon.filename.toLowerCase().includes(query);
        });
      }
    }

    return filtered;
  }, [
    icons,
    searchQuery,
    selectedCategory,
    searchMode,
    aiSuggestedPaths,
    aiSearchQuery,
    aiLoading,
  ]);

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
    window.addEventListener("resize", updateColumns);
    // Also update when sidebar toggles
    const timeoutId = setTimeout(updateColumns, 100);
    return () => {
      window.removeEventListener("resize", updateColumns);
      clearTimeout(timeoutId);
    };
  }, [showSidebar]);

  // Calculate rows for virtualization
  const rows = useMemo(
    () => Math.ceil(filteredIcons.length / columns),
    [filteredIcons.length, columns]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Estimated height per row (icon + padding)
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  const getDisplayName = (filename: string) => {
    return filename
      .replace("@2x.png", "")
      .replace(".png", "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
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
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyFilename = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename);
      setCopiedIcon(filename);
      setTimeout(() => setCopiedIcon(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyKeywords = async (keywords: string[]) => {
    try {
      await navigator.clipboard.writeText(keywords.join(", "));
      setCopiedIcon("keywords");
      setTimeout(() => setCopiedIcon(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownloadSvg = async (icon: IconInfo) => {
    try {
      const response = await fetch(icon.path);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = icon.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloadedIcon(icon.filename);
      setTimeout(() => setDownloadedIcon(null), 2000);
    } catch (err) {
      console.error("Failed to download:", err);
    }
  };

  const handleDownloadPng = async (icon: IconInfo) => {
    try {
      const response = await fetch(icon.path);
      const svgText = await response.text();
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = icon.filename.replace(/\.svg$/i, ".png");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setDownloadedIcon(icon.filename);
          setTimeout(() => setDownloadedIcon(null), 2000);
        }, "image/png");
      };
      img.src = svgUrl;
    } catch (err) {
      console.error("Failed to download PNG:", err);
    }
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiError("Please enter some text to search");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuggestedPaths([]);

    try {
      const response = await fetch("/api/suggest-icons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: aiSearchQuery,
          icons: icons,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get suggestions");
      }

      const data = await response.json();
      setAiSuggestedPaths(data.suggestedPaths || []);
    } catch (err) {
      console.error("Error getting AI suggestions:", err);
      setAiError(
        err instanceof Error ? err.message : "Failed to get suggestions"
      );
      setAiSuggestedPaths([]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchModeChange = (mode: "keyword" | "ai") => {
    setSearchMode(mode);
    if (mode === "keyword") {
      // Clear AI search state when switching to keyword mode
      setAiSearchQuery("");
      setAiSuggestedPaths([]);
      setAiError(null);
    } else {
      // Clear keyword search when switching to AI mode
      setSearchQuery("");
    }
  };

  return (
    <div className="flex h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%)] -z-10" />

      {/* Mobile Overlay */}
      {showSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          showSidebar ? "block" : "hidden"
        } lg:block fixed lg:relative inset-y-0 left-0 z-50 w-64 overflow-y-auto glass animate-slide-in`}
      >
        <div className="p-4 sticky top-0 glass border-b border-white/20 dark:border-white/10 z-10">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Categories
          </h2>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-300 ${
              selectedCategory === null
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/30 scale-105"
                : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5 hover:scale-[1.02]"
            }`}
          >
            All ({icons.length})
          </button>
        </div>
        <nav className="p-3">
          {categories.map((category, idx) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-300 mb-2 animate-fade-in ${
                selectedCategory === category.name
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/30 scale-105"
                  : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5 hover:scale-[1.02]"
              }`}
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              <span className="flex items-center justify-between">
                <span>{category.displayName}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCategory === category.name
                      ? "bg-white/20 text-white"
                      : "opacity-60"
                  }`}
                >
                  {category.count}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search */}
        <header className="glass border-b border-white/20 dark:border-white/10 sticky top-0 z-20 backdrop-blur-xl">
          <div className="px-4 sm:px-6 py-5">
            {/* Site Title */}
            <div className="mb-5 animate-fade-in">
              <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2 pb-2">
                Apolitical Image Finder
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Search through{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {icons.length}
                </span>{" "}
                icons by keywords or AI
              </p>
            </div>

            {/* Search Mode Toggle */}
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => handleSearchModeChange("keyword")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  searchMode === "keyword"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                    : "glass border border-white/30 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10"
                }`}
              >
                Keyword Search
              </button>
              <button
                onClick={() => handleSearchModeChange("ai")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  searchMode === "ai"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                    : "glass border border-white/30 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10"
                }`}
              >
                AI Search
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-all duration-300 hover:scale-110"
                aria-label="Toggle sidebar"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              {searchMode === "keyword" ? (
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search icons by keywords or filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-11 border border-white/30 dark:border-white/10 rounded-xl glass text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300"
                  />
                  <svg
                    className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Describe what you're looking for (e.g., 'icons related to technology and innovation')..."
                      value={aiSearchQuery}
                      onChange={(e) => setAiSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !aiLoading) {
                          handleAiSearch();
                        }
                      }}
                      className="w-full px-4 py-3 pl-11 border border-white/30 dark:border-white/10 rounded-xl glass text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300"
                      disabled={aiLoading}
                    />
                    <svg
                      className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={handleAiSearch}
                    disabled={aiLoading || !aiSearchQuery.trim()}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
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
                        <span>Find Icons</span>
                      </>
                    )}
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="px-5 py-3 rounded-xl glass border border-white/30 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 transition-all duration-300 hover:scale-105 font-medium"
              >
                Customizer
              </button>
            </div>
            {aiError && (
              <div className="mt-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                {aiError}
              </div>
            )}
            {showCustomizer && (
              <div className="mt-4 p-5 glass rounded-xl border border-white/30 dark:border-white/10 animate-scale-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Icon Size:{" "}
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {iconSize}px
                      </span>
                    </label>
                    <input
                      type="range"
                      min="32"
                      max="128"
                      step="8"
                      value={iconSize}
                      onChange={(e) => setIconSize(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
            )}
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {searchMode === "ai" && aiSuggestedPaths.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {filteredIcons.length}
                  </span>{" "}
                  AI-suggested icons
                  {selectedCategory && ` in ${selectedCategory}`}
                </>
              ) : searchMode === "ai" && aiSearchQuery.trim() && !aiLoading ? (
                <>No icons found for &quot;{aiSearchQuery}&quot;</>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {filteredIcons.length}
                  </span>{" "}
                  of {icons.length} icons
                </>
              )}
            </p>
          </div>
        </header>

        {/* Icon Grid */}
        <main
          ref={parentRef}
          className={`flex-1 overflow-y-auto ${
            selectedIcon ? "pb-96 sm:pb-80" : ""
          }`}
        >
          {filteredIcons.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
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
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2 font-medium">
                  No icons found
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {searchQuery
                    ? `No icons match "${searchQuery}"`
                    : "Try selecting a different category"}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="relative p-6 mt-2 mx-2"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columns;
                const endIndex = Math.min(
                  startIndex + columns,
                  filteredIcons.length
                );
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
                    <div
                      className="grid gap-4 min-w-0"
                      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                    >
                      {rowIcons.map((icon, idx) => (
                        <div
                          key={icon.path}
                          onClick={() => handleIconClick(icon)}
                          className={`group relative flex flex-col items-center p-5 rounded-2xl border transition-all duration-300 cursor-pointer min-w-0 w-full animate-scale-in ${
                            selectedIcon?.path === icon.path
                              ? "border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-500/50 dark:ring-indigo-400/50 scale-105 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
                              : "border-white/30 dark:border-white/10 glass hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:scale-105 hover:-translate-y-1"
                          }`}
                          title={getDisplayName(icon.filename)}
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div
                            className="relative flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                            style={{ width: iconSize, height: iconSize }}
                          >
                            <img
                              src={icon.path}
                              alt={getDisplayName(icon.filename)}
                              className="absolute inset-0 w-full h-full object-contain transition-all duration-300"
                            />
                          </div>
                          <p className="text-xs text-center text-gray-700 dark:text-gray-300 font-semibold truncate w-full px-1 min-w-0">
                            {getDisplayName(icon.filename)}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full min-w-0 px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/5">
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
          className={`fixed left-0 lg:left-64 right-0 bottom-0 z-50 glass border-t border-white/30 dark:border-white/10 shadow-[0_-2px_12px_rgba(0,0,0,0.08),0_-4px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.15),0_-4px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl transform transition-transform duration-300 ease-out ${
            isPanelClosing
              ? "translate-y-full"
              : isPanelOpening
              ? "translate-y-full"
              : "translate-y-0"
          }`}
          onTransitionEnd={() => {
            if (isPanelOpening) {
              setIsPanelOpening(false);
            }
          }}
        >
          <div className="px-4 sm:px-6 py-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
              {/* Icon Preview */}
              <div className="shrink-0 w-full sm:w-auto animate-scale-in">
                <div className="w-full sm:w-40 sm:h-40 md:w-48 md:h-48 aspect-square flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl border border-white/30 dark:border-white/10 p-4 mb-4 sm:mb-0 shadow-lg">
                  <div className="relative w-full h-full">
                    <img
                      src={selectedIcon.path}
                      alt={getDisplayName(selectedIcon.filename)}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-40 md:w-48 mt-3">
                  <button
                    onClick={() => handleDownloadSvg(selectedIcon)}
                    className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/30 hover:scale-105"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    SVG
                  </button>
                  <button
                    onClick={() => handleDownloadPng(selectedIcon)}
                    className="flex-1 px-3 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/30 hover:scale-105"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PNG
                  </button>
                </div>
              </div>

              {/* Icon Details */}
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 truncate">
                      {getDisplayName(selectedIcon.filename)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Category:{" "}
                      <span className="font-medium">
                        {selectedIcon.category}
                      </span>
                    </p>
                    {selectedIcon.keywords &&
                      selectedIcon.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {selectedIcon.keywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full font-medium shadow-md "
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                  <button
                    onClick={handleClosePanel}
                    className="shrink-0 p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 ml-2 transition-all duration-300 hover:scale-110 hover:rotate-90"
                    aria-label="Close"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
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
                      <code className="flex-1 px-4 py-2.5 glass border border-white/30 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
                        {selectedIcon.path}
                      </code>
                      <button
                        onClick={() => handleCopyPath(selectedIcon.path)}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:scale-105"
                      >
                        {copiedIcon === selectedIcon.path ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filename
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-2.5 glass border border-white/30 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-gray-100 font-mono truncate">
                        {selectedIcon.filename}
                      </code>
                      <button
                        onClick={() =>
                          handleCopyFilename(selectedIcon.filename)
                        }
                        className="px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg hover:scale-105"
                      >
                        {copiedIcon === selectedIcon.filename
                          ? "Copied!"
                          : "Copy"}
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
        <div
          className={`fixed right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-xl shadow-2xl shadow-indigo-500/50 z-[60] transition-all duration-300 animate-scale-in ${
            selectedIcon ? "bottom-96 sm:bottom-80" : "bottom-4"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-semibold">Copied to clipboard!</span>
          </div>
        </div>
      )}
      {downloadedIcon && (
        <div
          className={`fixed right-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-3 rounded-xl shadow-2xl shadow-emerald-500/50 z-[60] transition-all duration-300 animate-scale-in ${
            selectedIcon ? "bottom-96 sm:bottom-80" : "bottom-4"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-semibold">
              Image downloaded: {downloadedIcon}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
