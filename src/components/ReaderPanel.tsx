import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Search, ArrowRight, Menu, X, Layers, Check, Bookmark } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function ReaderPanel() {
  const currentPage = useAppStore((state) => state.currentPage);
  const totalPages = useAppStore((state) => state.totalPages);
  const fileName = useAppStore((state) => state.fileName);
  const pageTexts = useAppStore((state) => state.pageTexts);
  const chapters = useAppStore((state) => state.chapters) || [];
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const activeRenderTaskRef = useRef<any>(null);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [isRendered, setIsRendered] = useState(false);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);
  const isPdf = Boolean((window as any).__CURRENT_PDF_DOC__);

  // Text Search State with 500ms debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // 500ms debounce effect on search query
  useEffect(() => {
    if (searchQuery.trim() !== debouncedQuery) {
      setIsSearching(true);
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Compute matching pages based on debounced search query
  const searchResults = useMemo(() => {
    if (!debouncedQuery) return [];
    const queryLower = debouncedQuery.toLowerCase();
    const results: { page: number; count: number }[] = [];

    pageTexts.forEach((text, index) => {
      if (text && text.toLowerCase().includes(queryLower)) {
        let count = 0;
        let pos = text.toLowerCase().indexOf(queryLower);
        while (pos !== -1) {
          count++;
          pos = text.toLowerCase().indexOf(queryLower, pos + queryLower.length);
        }
        results.push({ page: index + 1, count });
      }
    });

    return results;
  }, [debouncedQuery, pageTexts]);

  // Synchronize active match index and jump to first match when search query resolves
  useEffect(() => {
    if (searchResults.length > 0) {
      const matchIdx = searchResults.findIndex((r) => r.page === currentPage);
      if (matchIdx !== -1) {
        setCurrentMatchIndex(matchIdx);
      } else {
        setCurrentMatchIndex(0);
        setCurrentPage(searchResults[0].page);
      }
    } else {
      setCurrentMatchIndex(0);
    }
  }, [debouncedQuery, searchResults]);

  const handlePrevMatch = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIndex);
    setCurrentPage(searchResults[prevIndex].page);
  };

  const handleNextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIndex);
    setCurrentPage(searchResults[nextIndex].page);
  };

  // Reset scroll to top whenever changing reader pages (next, back, jump, chapter select)
  useEffect(() => {
    if (stageContainerRef.current) {
      stageContainerRef.current.scrollTop = 0;
    }
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const currentChapter = chapters.find(
    (ch) => currentPage >= ch.startPage && currentPage <= ch.endPage
  );

  // Close chapter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chapterMenuRef.current && !chapterMenuRef.current.contains(e.target as Node)) {
        setIsChapterMenuOpen(false);
      }
    };
    if (isChapterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChapterMenuOpen]);

  const renderPage = async (pageNumber: number) => {
    const pdf = (window as any).__CURRENT_PDF_DOC__;
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      // Determine correct responsive scaling based on container element width
      const containerWidth = containerRef.current?.clientWidth || 550;
      const desiredWidth = Math.min(650, containerWidth - 24); // Cap width to keep it beautiful
      const tempViewport = page.getViewport({ scale: 1.0 });
      const computedScale = desiredWidth / tempViewport.width;

      const viewport = page.getViewport({ scale: computedScale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Cancel any ongoing rendering tasks to prevent overlaps
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      activeRenderTaskRef.current = renderTask;

      await renderTask.promise;
      activeRenderTaskRef.current = null;
      setIsRendered(true);

    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Failed to render PDF page on canvas:', err);
      }
    }
  };

  // Render page when page number or window size changes
  useEffect(() => {
    if (isPdf) {
      renderPage(currentPage);
    }

    // Watch for window resize to scale PDF dynamically
    const handleResize = () => {
      if (isPdf) {
        renderPage(currentPage);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
      }
    };
  }, [currentPage, isPdf]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
      setJumpPage('');
    }
  };

  const handleSelectChapter = (startPage: number) => {
    setCurrentPage(startPage);
    setIsChapterMenuOpen(false);
  };

  const currentText = pageTexts[currentPage - 1] || '';

  const renderHighlightedText = (text: string, query: string) => {
    if (!query || !text) return text;
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return parts.map((part, index) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          return (
            <mark
              key={index}
              className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-semibold border-b border-amber-400/50"
            >
              {part}
            </mark>
          );
        }
        return part;
      });
    } catch {
      return text;
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-[#111111] border border-white/10 rounded-2xl shadow-lg overflow-hidden" ref={containerRef}>
      {/* Header Panel */}
      <div className="relative flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-white/5 bg-[#141414] z-20 gap-2">
        <div className="flex items-center gap-2 max-w-[50%] sm:max-w-[55%]">
          {/* Hamburger Chapter Drawer Toggle */}
          {chapters.length > 0 && (
            <button
              onClick={() => setIsChapterMenuOpen(!isChapterMenuOpen)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                isChapterMenuOpen
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-[#1a1a1a] hover:bg-[#242424] border-white/10 text-slate-300 hover:text-white'
              }`}
              title="Select Chapter / Act (Table of Contents)"
              aria-label="Table of Contents"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden md:inline text-[11px] font-medium">Chapters</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 truncate">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 truncate" title={fileName || ''}>
              {fileName || 'Reading Material'}
            </span>
          </div>
        </div>

        {/* Debounced Simple Text Search */}
        <div className="flex items-center gap-1.5 shrink-0 max-w-[50%] sm:max-w-[45%]">
          <div className="relative flex items-center w-full min-w-[130px] sm:min-w-[170px] max-w-[240px]">
            <Search
              className={`absolute left-2.5 w-3.5 h-3.5 pointer-events-none transition-colors ${
                isSearching ? 'text-indigo-400 animate-pulse' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              placeholder="Search text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 bg-[#1a1a1a] hover:bg-[#202020] focus:bg-[#202020] border border-white/10 hover:border-white/20 focus:border-indigo-500/60 focus:outline-none rounded-xl text-xs font-medium text-slate-200 placeholder-slate-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Result Counter & Prev/Next Match Stepper */}
          {debouncedQuery && (
            <div className="flex items-center gap-1 shrink-0">
              {searchResults.length > 0 ? (
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-2 py-1 text-[11px] font-mono text-slate-300">
                  <span className="text-indigo-300 font-semibold">
                    {currentMatchIndex + 1}/{searchResults.length}
                  </span>
                  <span className="text-slate-500 text-[10px] hidden sm:inline">pages</span>

                  {searchResults.length > 1 && (
                    <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1">
                      <button
                        type="button"
                        onClick={handlePrevMatch}
                        className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="Previous matching page"
                        aria-label="Previous matching page"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMatch}
                        className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="Next matching page"
                        aria-label="Next matching page"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                !isSearching && (
                  <span className="text-[10px] sm:text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/20 px-2 py-1 rounded-xl shrink-0 font-medium">
                    No matches
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chapters Overlay Drawer / Popover */}
      {isChapterMenuOpen && chapters.length > 0 && (
        <div
          ref={chapterMenuRef}
          className="absolute top-[49px] left-4 z-30 w-80 max-w-[calc(100%-2rem)] max-h-[420px] bg-[#161616] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Chapters & Acts ({chapters.length})
              </span>
            </div>
            <button
              onClick={() => setIsChapterMenuOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chapter List */}
          <div className="overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
            {chapters.map((ch, idx) => {
              const isActive = currentPage >= ch.startPage && currentPage <= ch.endPage;
              return (
                <button
                  key={`${ch.title}_${idx}`}
                  onClick={() => handleSelectChapter(ch.startPage)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40 font-semibold'
                      : 'text-slate-300 hover:bg-[#202020] hover:text-white border border-transparent font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    {isActive ? (
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 text-[10px] text-slate-500 font-mono shrink-0 text-center">
                        {idx + 1}
                      </span>
                    )}
                    <span className="truncate">{ch.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-[#121212] px-2 py-0.5 rounded-md shrink-0">
                    p.{ch.startPage}{ch.startPage !== ch.endPage ? `-${ch.endPage}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reader Page Stage */}
      <div ref={stageContainerRef} className="flex-1 flex items-center justify-center p-3 sm:p-5 bg-[#0d0d0d] overflow-y-auto min-h-[420px] max-h-[700px] lg:max-h-[calc(100vh-220px)]">
        <div className="w-full flex items-center justify-center gap-2 sm:gap-3.5 my-auto max-w-2xl">
          {/* Left Carat Button */}
          {totalPages > 1 && (
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-2 sm:p-2.5 rounded-2xl border border-white/10 bg-[#161616]/90 hover:bg-[#222222] hover:border-white/25 disabled:opacity-20 disabled:pointer-events-none text-slate-300 hover:text-white shadow-xl backdrop-blur-md transition-all active:scale-90 shrink-0 cursor-pointer"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
            </button>
          )}

          {/* Central Panel Content */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            {isPdf ? (
              <div className="relative bg-[#1a1a1a] shadow-2xl rounded-lg overflow-hidden border border-white/10 max-w-full my-auto">
                <canvas ref={canvasRef} className="max-w-full h-auto block" />
                
                {!isRendered && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#111111]">
                    <span className="text-sm font-semibold text-slate-500">Loading page canvas...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-xl max-h-full flex flex-col bg-[#141414] border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl my-auto">
                <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4 pb-2 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <span>Scene Excerpt</span>
                    {currentChapter && (
                      <span className="text-slate-400 font-normal text-[11px] truncate">
                        • {currentChapter.title}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-mono text-[11px] lowercase shrink-0">
                    {currentText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <div ref={textContainerRef} className="overflow-y-auto pr-2 max-h-[480px] lg:max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  <p className="font-serif text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap selection:bg-indigo-600/40">
                    {renderHighlightedText(currentText, debouncedQuery) || 'No text content available.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Carat Button */}
          {totalPages > 1 && (
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="p-2 sm:p-2.5 rounded-2xl border border-white/10 bg-[#161616]/90 hover:bg-[#222222] hover:border-white/25 disabled:opacity-20 disabled:pointer-events-none text-slate-300 hover:text-white shadow-xl backdrop-blur-md transition-all active:scale-90 shrink-0 cursor-pointer"
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Controls footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-white/5 bg-[#141414]">
          {/* Navigation Arrows */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-[#161616] hover:bg-[#222222] hover:border-white/20 disabled:opacity-20 disabled:hover:bg-[#161616] text-slate-300 transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400 px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-[#161616] hover:bg-[#222222] hover:border-white/20 disabled:opacity-20 disabled:hover:bg-[#161616] text-slate-300 transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Current Chapter/Act indicator in footer */}
          {currentChapter && (
            <button
              onClick={() => setIsChapterMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/10 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer max-w-[260px] md:max-w-[320px] truncate"
              title={`Current Chapter/Act: ${currentChapter.title} (Click to view all chapters)`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-semibold text-indigo-300 shrink-0">Act / Chapter:</span>
              <span className="truncate">{currentChapter.title}</span>
            </button>
          )}

          {/* Page Jumping */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Jump to page..."
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-28 sm:w-32 border border-white/10 hover:border-white/20 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-medium text-slate-300 placeholder-slate-500 bg-[#161616] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
