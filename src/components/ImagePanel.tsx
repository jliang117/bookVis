import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Sparkles, Image as ImageIcon, AlertCircle, Eye, Calendar, ShieldCheck, Menu, Check, Download, FolderDown, Maximize2, Minimize2, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';
import { useAppStore } from '../lib/store';
import { ImageCache } from '../lib/cache/imageCache';
import { BookImagesMenu } from './BookImagesMenu';

const REASSURING_MESSAGES = [
  'Skimming through adjacent pages for environmental markers...',
  'Sifting characters, clothing, and details...',
  'Extracting structured scene properties...',
  'Composing visual layout parameters...',
  'Applying the selected artistic style palette...',
  'Synthesizing high-fidelity illustration using Gemini...',
  'Polishing lighting highlights and atmospheric mood...',
];

export default function ImagePanel() {
  const imageUrl = useAppStore((state) => state.imageUrl);
  const generationStatus = useAppStore((state) => state.generationStatus);
  const generatedAt = useAppStore((state) => state.generatedAt);
  const selectedStyle = useAppStore((state) => state.selectedStyle);
  const error = useAppStore((state) => state.error);
  const generateVisualization = useAppStore((state) => state.generateVisualization);
  const cachedImages = useAppStore((state) => state.cachedImages);
  const activeCacheKey = useAppStore((state) => state.activeCacheKey);
  const selectCachedImage = useAppStore((state) => state.selectCachedImage);
  const fileName = useAppStore((state) => state.fileName);
  const fileHash = useAppStore((state) => state.fileHash);
  const currentPage = useAppStore((state) => state.currentPage);
  
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle keyboard Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Sync state if user exits browser native fullscreen via browser controls/ESC
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (panelRef.current && !document.fullscreenElement) {
          panelRef.current.requestFullscreen?.().catch(() => {});
        }
      } catch {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch {}
    }
  };

  // Close hamburger dropdown menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Close download dropdown menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    }
    if (isDownloadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDownloadMenuOpen]);

  // Rotate reassuring loading messages during generation
  useEffect(() => {
    let interval: any;
    if (generationStatus === 'extracting_scene' || generationStatus === 'generating_image') {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % REASSURING_MESSAGES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [generationStatus]);

  const handleRegenerate = () => {
    generateVisualization(true); // force regenerate, bypass cache
  };

  const handleDownloadCurrent = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const cleanBookName = (fileName || 'book').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanStyle = selectedStyle.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${cleanBookName}_page${currentPage}_${cleanStyle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    if (isZipping) return;
    setIsZipping(true);
    try {
      const allEntries = fileHash ? await ImageCache.getAllForBook(fileHash) : [];
      
      // Fallback to active in-memory cached or active imageUrl if IndexedDB list is empty
      const entriesToZip = allEntries.length > 0 
        ? allEntries 
        : (imageUrl ? [{
            currentPage,
            selectedStyle,
            imageUrl,
            generatedAt: Date.now()
          }] : []);

      if (entriesToZip.length === 0) {
        setIsZipping(false);
        return;
      }

      const zip = new JSZip();
      const cleanBookName = (fileName || 'book').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      
      // Sort chronologically/by page
      entriesToZip.sort((a, b) => (a.currentPage || 0) - (b.currentPage || 0));

      const nameCounts: Record<string, number> = {};

      entriesToZip.forEach((entry, idx) => {
        const pageNum = entry.currentPage || (idx + 1);
        const styleName = (entry.selectedStyle || 'illustration').replace(/[^a-zA-Z0-9_-]/g, '_');
        const baseName = `Page_${pageNum}_${styleName}`;
        
        const count = nameCounts[baseName] || 0;
        nameCounts[baseName] = count + 1;
        const entryFileName = count === 0 
          ? `${baseName}.png` 
          : `${baseName}_v${count + 1}.png`;

        const rawBase64 = entry.imageUrl.includes(',') 
          ? entry.imageUrl.split(',')[1] 
          : entry.imageUrl;

        zip.file(entryFileName, rawBase64, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cleanBookName}_all_pages_visualizations.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
      console.error('Failed to create ZIP of all generated images:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const isLoading = generationStatus === 'extracting_scene' || generationStatus === 'generating_image';

  return (
    <div
      ref={panelRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-[#080808] w-screen h-screen overflow-hidden animate-fade-in"
          : "flex flex-col h-full bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-lg overflow-hidden"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-white/5 bg-[#141414] relative gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider hidden sm:inline">
            AI Companion Canvas {isFullscreen && '• Fullscreen'}
          </span>
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider sm:hidden">
            {isFullscreen ? 'Fullscreen' : 'Canvas'}
          </span>
          {/* Book / Leaflet menu right after title header (icon and count only) */}
          <BookImagesMenu />
        </div>
        
        {/* Right side controls: Downloads + Cached image switcher + Regenerate button + Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Condensed Download Dropdown Menu */}
          {(imageUrl || cachedImages.length > 0) && (
            <div className="relative" ref={downloadMenuRef}>
              <button
                onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                disabled={isLoading || isZipping}
                className={`flex items-center justify-center p-1.5 sm:px-2 sm:py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                  isDownloadMenuOpen
                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 shadow-md'
                    : 'bg-[#161616] hover:bg-[#222222] border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Download options (Current page or All pages)"
                aria-label="Download options"
              >
                {isZipping ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <ChevronDown className={`w-3 h-3 text-slate-400 ml-0.5 transition-transform duration-200 ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Download Dropdown Popover */}
              {isDownloadMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#161616] border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-2.5 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Download Options
                    </span>
                    {isZipping && (
                      <span className="text-[10px] text-indigo-400 font-mono animate-pulse">
                        Zipping...
                      </span>
                    )}
                  </div>

                  {/* Option 1: Download Current Page */}
                  <button
                    onClick={() => {
                      setIsDownloadMenuOpen(false);
                      handleDownloadCurrent();
                    }}
                    disabled={!imageUrl || isZipping}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-100 truncate">
                        Download current page
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        Page {currentPage} • {selectedStyle}
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Download All Pages (ZIP) */}
                  <button
                    onClick={() => {
                      setIsDownloadMenuOpen(false);
                      handleDownloadAll();
                    }}
                    disabled={isZipping}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isZipping ? (
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                    ) : (
                      <FolderDown className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-100 truncate">
                        Download all pages (ZIP)
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        Archive of all generated illustrations
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {cachedImages.length > 0 && (
            <>
              {cachedImages.length <= 3 ? (
                /* Numerical buttons when 3 or fewer cached versions exist */
                <div className="flex items-center gap-1 bg-[#101010] p-0.5 rounded-lg border border-white/10 shadow-inner">
                  {cachedImages.map((entry, idx) => {
                    const isActive = entry.key === activeCacheKey;
                    const formattedTime = entry.generatedAt 
                      ? new Date(entry.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <button
                        key={entry.key}
                        onClick={() => selectCachedImage(entry.key)}
                        disabled={isLoading}
                        title={`Version ${idx + 1}: ${entry.selectedStyle}${formattedTime ? ` (${formattedTime})` : ''}`}
                        className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40 scale-105'
                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Hamburger menu when more than 3 cached versions exist */
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      isMenuOpen
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                        : 'bg-[#161616] hover:bg-[#222222] border-white/10 text-slate-300 hover:text-white'
                    }`}
                    title="View all cached versions and art styles"
                  >
                    <Menu className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Versions ({cachedImages.length})</span>
                    <span className="sm:hidden font-mono text-[11px]">v({cachedImages.length})</span>
                  </button>

                  {/* Hamburger Dropdown Popover */}
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-[#161616] border border-white/15 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 mb-1.5">
                        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                          Cached Versions
                        </span>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                          {cachedImages.length} images
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
                        {cachedImages.map((entry, idx) => {
                          const isActive = entry.key === activeCacheKey;
                          const formattedTime = entry.generatedAt
                            ? new Date(entry.generatedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '';
                          return (
                            <button
                              key={entry.key}
                              onClick={() => {
                                selectCachedImage(entry.key);
                                setIsMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-950/70 border border-indigo-500/40 text-white'
                                  : 'hover:bg-white/5 border border-transparent text-slate-300'
                              }`}
                            >
                              {/* Mini image thumbnail */}
                              <div className="relative w-9 h-9 rounded-md overflow-hidden bg-black/50 border border-white/10 shrink-0">
                                <img
                                  src={entry.imageUrl}
                                  alt={`Version ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>

                              {/* Details: Number, Style Name, Timestamp */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold truncate text-slate-100">
                                    #{idx + 1} {entry.selectedStyle}
                                  </span>
                                  {isActive && (
                                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  )}
                                </div>
                                {formattedTime && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                    <Calendar className="w-3 h-3 text-slate-500" />
                                    <span>{formattedTime}</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {generationStatus === 'success' && (
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 rounded-lg bg-[#161616] hover:bg-[#222222] transition-all hover:shadow-md cursor-pointer"
              title="Force regenerate, bypassing local IndexedDB cache"
            >
              <RefreshCw className="w-3 h-3 animate-hover-spin text-indigo-400" />
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center p-1.5 sm:px-2 sm:py-1 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 rounded-lg bg-[#161616] hover:bg-[#222222] transition-all hover:shadow-md cursor-pointer shrink-0"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className={`flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden ${
          isFullscreen
            ? 'p-3 sm:p-6 h-[calc(100vh-60px)]'
            : 'p-4 sm:p-6 min-h-[420px] max-h-[700px] lg:max-h-[calc(100vh-220px)]'
        }`}
      >
        
        {/* IDLE State with no image */}
        {generationStatus === 'idle' && !imageUrl && (
          <div className="flex flex-col items-center text-center p-8 max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#141414] flex items-center justify-center text-slate-500 mb-4 border border-white/5">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1">No Scene Generated</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click the <strong className="text-indigo-400 font-semibold">Generate</strong> button in the top bar to analyze the current page and visualize it with AI.
            </p>
          </div>
        )}

        {/* LOADING State with no previous image */}
        {isLoading && !imageUrl && (
          <div className="flex flex-col items-center text-center p-8 max-w-md w-full">
            <div className="relative w-16 h-16 mb-6">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-pulse" />
              {/* Spinning active indicator */}
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              {/* Tiny center dot */}
              <div className="absolute inset-4 rounded-full bg-[#111111] border border-white/5 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-100">
                {generationStatus === 'extracting_scene' 
                  ? 'Performing Scene Extraction...' 
                  : 'Generating Style Canvas...'}
              </h3>
              
              {/* Crossfade reassured instruction message */}
              <p className="text-xs text-slate-400 italic max-w-xs mx-auto min-h-[32px] transition-all duration-300">
                "{REASSURING_MESSAGES[loadingMessageIndex]}"
              </p>
            </div>
          </div>
        )}

        {/* IMAGE DISPLAY (Active Success, Idle with retained last image, or Loading with retained last image backdrop) */}
        {imageUrl && generationStatus !== 'failed' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#111111] max-w-full ${
              isFullscreen ? 'max-h-full flex items-center justify-center' : ''
            }`}>
              <img
                src={imageUrl}
                alt="Visualized Scene"
                className={`${
                  isFullscreen
                    ? 'max-h-[calc(100vh-130px)] max-w-[calc(100vw-48px)]'
                    : 'max-h-[500px] max-w-full'
                } w-auto block object-contain select-none transition-all duration-300 ${
                  isLoading ? 'filter brightness-40 scale-[0.99]' : ''
                }`}
                referrerPolicy="no-referrer"
              />
              
              {/* Loading Overlay when generating new image while keeping last image displayed */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="relative w-12 h-12 mb-3">
                    <div className="absolute inset-0 rounded-full border-3 border-white/10 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-3 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-[#111111] border border-white/5 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-slate-100 mb-1">
                    {generationStatus === 'extracting_scene' 
                      ? 'Extracting New Scene...' 
                      : 'Generating Style Canvas...'}
                  </h3>
                  <p className="text-[11px] text-slate-300 italic max-w-xs mx-auto">
                    "{REASSURING_MESSAGES[loadingMessageIndex]}"
                  </p>
                </div>
              )}

              {/* Image Info Overlay on bottom */}
              {!isLoading && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-white">
                    <Eye className="w-3.5 h-3.5 text-indigo-300" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                      {generationStatus === 'idle' ? 'Previous Scene' : `${selectedStyle} Style`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {generatedAt && (
                      <div className="flex items-center gap-1 text-slate-400 text-[9px] font-mono">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span>Rendered {generatedAt}</span>
                      </div>
                    )}
                    <button
                      onClick={toggleFullscreen}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
                      aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FAILED State */}
        {generationStatus === 'failed' && (
          <div className="flex flex-col items-center text-center p-8 max-w-md w-full">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/20 border border-rose-900/30 flex items-center justify-center text-rose-400 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1.5">Visualization Pipeline Halted</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {error || 'An unexpected error occurred during rendering.'}
            </p>
            
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={handleRegenerate}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/40 transition-all active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Rendering</span>
              </button>
              
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Requires a valid Gemini secret key</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
