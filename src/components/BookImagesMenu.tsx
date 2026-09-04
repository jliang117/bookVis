import React, { useState, useRef, useEffect } from 'react';
import {
  BookMarked,
  Loader2,
  Check,
  Clock,
  X,
  Maximize2,
  Calendar,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Download,
} from 'lucide-react';
import JSZip from 'jszip';
import { useAppStore } from '../lib/store';
import { CacheEntry } from '../lib/cache/imageCache';

interface BookImagesMenuProps {
  className?: string;
  isFullscreenReader?: boolean;
  showLabel?: boolean;
}

type SortField = 'page' | 'date';
type SortOrder = 'asc' | 'desc';

export const BookImagesMenu: React.FC<BookImagesMenuProps> = ({
  className = '',
  isFullscreenReader = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('page');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [fullscreenModalImage, setFullscreenModalImage] = useState<CacheEntry | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isZipping, setIsZipping] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const {
    allBookImages,
    generationQueue,
    activeCacheKey,
    currentPage,
    fileName,
    selectBookImage,
    setCurrentPage,
    fileHash,
  } = useAppStore();

  const handleCloseFullscreenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFullscreenModalImage(null);
    if (isFullscreenReader) {
      setIsOpen(true);
    }
  };

  // Keep a periodic timer to update "newer than 1 minute" green dot live
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 3000); // every 3 seconds
    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fullscreenModalImage) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('#fullscreen-illustration-modal')) return;
      if (target?.closest?.('#book-images-popover')) return;
      if (target?.closest?.('#book-images-menu-button')) return;

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, fullscreenModalImage]);

  // Handle escape key to close modal or menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreenModalImage) {
          e.stopPropagation();
          e.preventDefault();
          handleCloseFullscreenModal();
        } else if (isOpen) {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [fullscreenModalImage, isOpen, isFullscreenReader]);

  // Active / processing tasks in queue
  const activeTasks = generationQueue.filter(
    (t) => t.status === 'queued' || t.status === 'extracting_scene' || t.status === 'generating_image'
  );

  const completedCount = allBookImages.length;
  const isGenerating = activeTasks.length > 0;

  // Check if any illustration in the book was generated in the last 60 seconds (< 1m)
  const hasNewIllustration = allBookImages.some(
    (item) => (currentTime - item.generatedAt) < 60000
  );

  // Sorting logic based on sortField and sortOrder
  const sortedImages = [...allBookImages].sort((a, b) => {
    if (sortField === 'page') {
      if (a.currentPage !== b.currentPage) {
        return sortOrder === 'asc'
          ? a.currentPage - b.currentPage
          : b.currentPage - a.currentPage;
      }
      // Secondary sort by date
      return sortOrder === 'asc'
        ? a.generatedAt - b.generatedAt
        : b.generatedAt - a.generatedAt;
    } else {
      // sort by date
      if (a.generatedAt !== b.generatedAt) {
        return sortOrder === 'asc'
          ? a.generatedAt - b.generatedAt
          : b.generatedAt - a.generatedAt;
      }
      // Secondary sort by page
      return sortOrder === 'asc'
        ? a.currentPage - b.currentPage
        : b.currentPage - a.currentPage;
    }
  });

  const handleSelectImage = (item: CacheEntry) => {
    selectBookImage(item);
    if (isFullscreenReader) {
      setFullscreenModalImage(item);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectTask = (taskPage: number) => {
    setCurrentPage(taskPage);
    setIsOpen(false);
  };

  const handleOpenFullscreenImage = (e: React.MouseEvent, item: CacheEntry) => {
    e.stopPropagation();
    selectBookImage(item);
    setFullscreenModalImage(item);
  };

  const handleDownloadCardImage = (e: React.MouseEvent, item: CacheEntry) => {
    e.stopPropagation();
    if (!item.imageUrl) return;
    const cleanBookName = (fileName || 'book').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanStyle = (item.selectedStyle || 'illustration').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.href = item.imageUrl;
    link.download = `${cleanBookName}_page${item.currentPage}_${cleanStyle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isZipping || allBookImages.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const cleanBookName = (fileName || 'book').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

      // Sort by page number
      const entriesToZip = [...allBookImages].sort((a, b) => (a.currentPage || 0) - (b.currentPage || 0));
      const nameCounts: Record<string, number> = {};

      entriesToZip.forEach((entry, idx) => {
        const pageNum = entry.currentPage || (idx + 1);
        const styleName = (entry.selectedStyle || 'illustration').replace(/[^a-zA-Z0-9_-]/g, '_');
        const baseName = `Page_${pageNum}_${styleName}`;

        const count = nameCounts[baseName] || 0;
        nameCounts[baseName] = count + 1;
        const entryFileName = count === 0 ? `${baseName}.png` : `${baseName}_v${count + 1}.png`;

        const rawBase64 = entry.imageUrl.includes(',')
          ? entry.imageUrl.split(',')[1]
          : entry.imageUrl;

        zip.file(entryFileName, rawBase64, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cleanBookName}_illustrations_book.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
      console.error('Failed to create ZIP of illustrations:', err);
    } finally {
      setIsZipping(false);
    }
  };

  if (!fileHash) return null;

  return (
    <>
      <div className={`relative inline-block ${className}`} ref={menuRef}>
        {/* Book / Leaflet Icon Button (Icon and number of images) */}
        <button
          id="book-images-menu-button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isOpen
              ? 'bg-indigo-600/30 border-indigo-500/60 text-white shadow-md'
              : isGenerating
              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/50'
              : 'bg-[#181818] hover:bg-[#222222] border-white/10 text-slate-300 hover:text-white'
          }`}
          title={
            hasNewIllustration
              ? `New illustration available! (${completedCount})`
              : `Illustrations (${completedCount})`
          }
          aria-label="Illustrations"
          aria-expanded={isOpen}
        >
          <div className="relative flex items-center justify-center shrink-0">
            <BookMarked
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                isGenerating ? 'text-amber-400' : 'text-indigo-400'
              }`}
            />
            {hasNewIllustration ? (
              <span className="absolute -top-1 -right-1 flex h-2 w-2 pointer-events-none" title="New illustration (<1m)">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
              </span>
            ) : isGenerating ? (
              <span className="absolute -top-1 -right-1 flex h-2 w-2 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : null}
          </div>

          {/* Number of images or processing spinner */}
          {isGenerating ? (
            <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono font-semibold">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>{activeTasks.length}</span>
            </span>
          ) : (
            <span className="text-[10px] bg-white/10 text-slate-200 px-1.5 py-0.5 rounded-full font-mono font-medium">
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Illustrations Book Modal Dialog */}
      {isOpen && (
        <div
          id="book-images-modal-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
            <div
              id="book-images-popover"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#121212] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[600px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Menu Header: Title "Illustrations Book" */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161616] shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center shrink-0">
                  <BookMarked className="w-4 h-4 text-indigo-400" />
                  {hasNewIllustration && (
                    <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5 pointer-events-none">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Illustrations Book
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {completedCount} generated{isGenerating ? ` • ${activeTasks.length} in progress` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Download All button at the top */}
                <button
                  id="download-all-illustrations-btn"
                  onClick={handleDownloadAll}
                  disabled={completedCount === 0 || isZipping}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm"
                  title={completedCount === 0 ? 'No illustrations to download' : 'Download all illustrations as a ZIP'}
                >
                  {isZipping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{isZipping ? 'Zipping...' : 'Download All'}</span>
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sorting Toolbar */}
            <div className="px-3.5 py-2 bg-[#181818] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sort by:</span>
                <button
                  onClick={() => setSortField('page')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    sortField === 'page'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                  title="Sort by page number"
                >
                  <FileText className="w-3 h-3" />
                  Page
                </button>
                <button
                  onClick={() => setSortField('date')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    sortField === 'date'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                  title="Sort by creation date"
                >
                  <Calendar className="w-3 h-3" />
                  Date
                </button>
              </div>

              {/* Ascending / Descending Toggle */}
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                title={`Currently sorted ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}. Click to toggle.`}
              >
                {sortOrder === 'asc' ? (
                  <>
                    <ArrowUp className="w-3 h-3 text-indigo-400" />
                    <span>Ascending</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3 h-3 text-indigo-400" />
                    <span>Descending</span>
                  </>
                )}
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
              {/* Active / Processing Queue Section */}
              {activeTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating in Background ({activeTasks.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleSelectTask(task.page)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all cursor-pointer"
                        title={`Click to jump to Page ${task.page}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-200">
                                Page {task.page}
                              </span>
                              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                                {task.status === 'extracting_scene'
                                  ? 'Extracting...'
                                  : task.status === 'generating_image'
                                  ? 'Painting...'
                                  : 'Queued'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 truncate">
                              {task.style}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Illustrations Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Generated Images ({completedCount})
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                    <span>New (&lt;1m)</span>
                  </div>
                </div>

                {completedCount === 0 && activeTasks.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <BookMarked className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-300">No illustrations generated yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                      Click &ldquo;Generate&rdquo; on any page to illustrate scenes in the background while you read.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sortedImages.map((item) => {
                      const isSelected = item.key === activeCacheKey;
                      const isCurrentPage = item.currentPage === currentPage;
                      // Check if newer than 1 minute (60,000 ms)
                      const isNewerThanOneMinute = currentTime - item.generatedAt < 1 * 60 * 1000;

                      return (
                        <div
                          key={item.key}
                          onClick={() => handleSelectImage(item)}
                          className={`group relative flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-950/50 border-indigo-500/60 shadow-sm'
                              : 'bg-[#181818] hover:bg-[#222222] border-white/5 hover:border-white/20'
                          }`}
                        >
                          {/* Thumbnail with optional green dot indicator */}
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/50 border border-white/10 shrink-0">
                            <img
                              src={item.imageUrl}
                              alt={`Page ${item.currentPage} - ${item.selectedStyle}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            )}

                            {/* Green dot badge if image is less than 1 minute old */}
                            {isNewerThanOneMinute && (
                              <div
                                className="absolute top-1 left-1 flex items-center justify-center"
                                title="Newly generated (less than 1 minute old)"
                              >
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-black/50 shadow-sm"></span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                Page {item.currentPage}
                                {isNewerThanOneMinute && (
                                  <span
                                    className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                    title="New (less than 1 minute old)"
                                  ></span>
                                )}
                              </span>
                              {isSelected ? (
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                                  Viewing
                                </span>
                              ) : isCurrentPage ? (
                                <span className="text-[9px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                  Current Page
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-slate-300 truncate font-medium mt-0.5">
                              {item.selectedStyle}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>
                                {new Date(item.generatedAt).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Actions: Download individual card + Optional Fullscreen modal button */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => handleDownloadCardImage(e, item)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Download illustration (PNG)"
                              aria-label={`Download illustration for page ${item.currentPage}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* Fullscreen Reader Mode Only: Button to view in fullscreen/large modal */}
                            {isFullscreenReader && (
                              <button
                                onClick={(e) => handleOpenFullscreenImage(e, item)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0 shadow-sm"
                                title="View this illustration in Fullscreen Modal"
                                aria-label="View illustration in fullscreen"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer note */}
            <div className="px-3.5 py-2 border-t border-white/5 bg-[#141414] text-[10px] text-slate-500 flex items-center justify-between shrink-0">
              <span>Background generation keeps working as you turn pages.</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal (for Fullscreen Reader Mode) */}
      {fullscreenModalImage && (
        <div
          id="fullscreen-illustration-modal"
          onClick={handleCloseFullscreenModal}
          className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label={`Illustration for Page ${fullscreenModalImage.currentPage}`}
        >
          {/* Header bar with Back / Close button */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#121212]/80 backdrop-blur-md cursor-default"
          >
            <div className="flex items-center gap-3">
              <button
                id="close-fullscreen-image-button"
                onClick={handleCloseFullscreenModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer shadow-md"
                title="Back to Fullscreen Reader (with Illustrations Book)"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Reader</span>
              </button>

              <div className="hidden sm:block h-4 w-px bg-white/20"></div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Page {fullscreenModalImage.currentPage}
                  </span>
                  <span className="text-[10px] sm:text-xs text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30 font-medium">
                    {fullscreenModalImage.selectedStyle}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                  Generated at {new Date(fullscreenModalImage.generatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleDownloadCardImage(e, fullscreenModalImage)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer shadow-md"
                title="Download this illustration (PNG)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>

              <button
                onClick={() => {
                  selectBookImage(fullscreenModalImage);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                title="Set as active companion illustration"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Set as Active</span>
              </button>

              <button
                onClick={handleCloseFullscreenModal}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Main Content: Large Image Display */}
          <div
            className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden relative cursor-zoom-out"
            onClick={handleCloseFullscreenModal}
          >
            <img
              onClick={(e) => e.stopPropagation()}
              src={fullscreenModalImage.imageUrl}
              alt={`Illustration for Page ${fullscreenModalImage.currentPage} - ${fullscreenModalImage.selectedStyle}`}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/15 animate-zoom-in cursor-default"
            />
          </div>

          {/* Bottom caption / scene detail bar */}
          {fullscreenModalImage.sceneJson && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-8 py-3 bg-[#121212]/90 border-t border-white/10 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 cursor-default"
            >
              <p className="text-xs text-slate-300 max-w-4xl truncate">
                <span className="font-semibold text-white">Scene summary: </span>
                {fullscreenModalImage.sceneJson.visualSceneSummary ||
                  fullscreenModalImage.sceneJson.locationEnvironment ||
                  'No description available'}
              </p>
              <div className="text-[11px] text-slate-400 shrink-0">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-slate-200">Esc</kbd> or click Back to return
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
