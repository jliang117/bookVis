import React, { useState, useRef, useEffect } from 'react';
import { Settings, Image as ImageIcon, Terminal, X, Sliders, Layers, Plus, Minus, ZoomIn, Type, BookOpen } from 'lucide-react';
import { useAppStore } from '../lib/store';

interface SettingsMenuProps {
  fullWidth?: boolean;
  showLabel?: boolean;
  className?: string;
  openUp?: boolean;
}

const FONT_SIZE_STEPS = [50, 60, 75, 85, 100, 115, 125, 140, 150, 175, 200];
const ZOOM_STEPS = [50, 60, 75, 85, 100, 115, 125, 140, 150, 175, 200];

export default function SettingsMenu({ fullWidth = false, showLabel, className = '', openUp = false }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showLastImageOnPageChange = useAppStore((state) => state.showLastImageOnPageChange);
  const setShowLastImageOnPageChange = useAppStore((state) => state.setShowLastImageOnPageChange);
  const showDeveloperTelemetry = useAppStore((state) => state.showDeveloperTelemetry);
  const setShowDeveloperTelemetry = useAppStore((state) => state.setShowDeveloperTelemetry);
  const windowSize = useAppStore((state) => state.windowSize);
  const setWindowSize = useAppStore((state) => state.setWindowSize);
  const epubFontSize = useAppStore((state) => state.epubFontSize);
  const setEpubFontSize = useAppStore((state) => state.setEpubFontSize);
  const pdfZoom = useAppStore((state) => state.pdfZoom);
  const setPdfZoom = useAppStore((state) => state.setPdfZoom);
  const documentType = useAppStore((state) => state.documentType);
  const fileName = useAppStore((state) => state.fileName);

  // Close popup on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleWindowSizeChange = (val: number) => {
    const clamped = Math.max(0, Math.min(5, val));
    setWindowSize(clamped);
  };

  const handleDecreaseFontSize = () => {
    const currentIndex = FONT_SIZE_STEPS.findIndex((s) => s >= epubFontSize);
    const nextIndex = Math.max(0, (currentIndex === -1 ? FONT_SIZE_STEPS.length - 1 : currentIndex) - 1);
    setEpubFontSize(FONT_SIZE_STEPS[nextIndex]);
  };

  const handleIncreaseFontSize = () => {
    const currentIndex = [...FONT_SIZE_STEPS].reverse().findIndex((s) => s <= epubFontSize);
    const realIndex = currentIndex === -1 ? 0 : FONT_SIZE_STEPS.length - 1 - currentIndex;
    const nextIndex = Math.min(FONT_SIZE_STEPS.length - 1, realIndex + 1);
    setEpubFontSize(FONT_SIZE_STEPS[nextIndex]);
  };

  const handleDecreasePdfZoom = () => {
    const currentIndex = ZOOM_STEPS.findIndex((s) => s >= pdfZoom);
    const nextIndex = Math.max(0, (currentIndex === -1 ? ZOOM_STEPS.length - 1 : currentIndex) - 1);
    setPdfZoom(ZOOM_STEPS[nextIndex]);
  };

  const handleIncreasePdfZoom = () => {
    const currentIndex = [...ZOOM_STEPS].reverse().findIndex((s) => s <= pdfZoom);
    const realIndex = currentIndex === -1 ? 0 : ZOOM_STEPS.length - 1 - currentIndex;
    const nextIndex = Math.min(ZOOM_STEPS.length - 1, realIndex + 1);
    setPdfZoom(ZOOM_STEPS[nextIndex]);
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={menuRef}>
      {/* Settings Gear Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 border rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer ${
          fullWidth ? 'w-full' : ''
        } ${
          isOpen
            ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 shadow-md'
            : 'bg-[#161616] text-slate-300 hover:text-white hover:bg-[#222222] border-white/10'
        } ${className}`}
        title="Visualizer Settings & Preferences"
        aria-label="Settings"
      >
        <Settings className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-400' : 'text-slate-400'}`} />
        {showLabel !== undefined ? (
          showLabel && <span className="text-[11px]">Settings</span>
        ) : (
          <span className="hidden sm:inline text-[11px] font-semibold">Settings</span>
        )}
      </button>

      {/* Settings Dropdown Popover */}
      {isOpen && (
        <div className={`absolute right-0 ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'} w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-[#141414] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl animate-fade-in scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sliders className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Visualizer Settings
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Section 1: Readability & Document Sizing */}
            <div className="space-y-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Readability Controls</span>
                </div>
                {fileName && (
                  <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 truncate max-w-[120px]" title={fileName}>
                    {fileName}
                  </span>
                )}
              </div>

              {/* Setting: Font size (Matches uploaded design) */}
              <div className={`p-3 rounded-xl border transition-all ${
                documentType === 'epub' || documentType === 'text'
                  ? 'bg-indigo-950/25 border-indigo-500/40 ring-1 ring-indigo-500/20'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Font size</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(documentType === 'epub' || documentType === 'text') && (
                      <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                        Active
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">EPUB & Text</span>
                  </div>
                </div>

                {/* Percentage control layout: [ T ]    {epubFontSize}%    [ T ] */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDecreaseFontSize}
                    disabled={epubFontSize <= FONT_SIZE_STEPS[0]}
                    className="flex-1 h-12 rounded-xl border border-white/15 bg-[#181818] hover:bg-[#222222] hover:border-white/30 disabled:opacity-25 disabled:hover:bg-[#181818] disabled:hover:border-white/15 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95 shadow-sm"
                    title="Decrease font size"
                    aria-label="Decrease font size"
                  >
                    <span className="text-sm font-normal text-slate-400 select-none">T</span>
                  </button>

                  <span className="font-mono font-bold text-sm sm:text-base text-slate-100 min-w-[56px] text-center select-none">
                    {epubFontSize}%
                  </span>

                  <button
                    type="button"
                    onClick={handleIncreaseFontSize}
                    disabled={epubFontSize >= FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]}
                    className="flex-1 h-12 rounded-xl border border-white/15 bg-[#181818] hover:bg-[#222222] hover:border-white/30 disabled:opacity-25 disabled:hover:bg-[#181818] disabled:hover:border-white/15 text-slate-100 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95 shadow-sm"
                    title="Increase font size"
                    aria-label="Increase font size"
                  >
                    <span className="text-xl font-black text-slate-100 select-none">T</span>
                  </button>
                </div>
              </div>

              {/* Setting: PDF Zoom */}
              <div className={`p-3 rounded-xl border transition-all ${
                documentType === 'pdf'
                  ? 'bg-indigo-950/25 border-indigo-500/40 ring-1 ring-indigo-500/20'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
                    <span>PDF zoom</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {documentType === 'pdf' && (
                      <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                        Active
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">PDF Pages</span>
                  </div>
                </div>

                {/* Percentage Zoom control layout: [ − ]    {pdfZoom}%    [ + ] */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDecreasePdfZoom}
                    disabled={pdfZoom <= ZOOM_STEPS[0]}
                    className="flex-1 h-12 rounded-xl border border-white/15 bg-[#181818] hover:bg-[#222222] hover:border-white/30 disabled:opacity-25 disabled:hover:bg-[#181818] disabled:hover:border-white/15 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95 shadow-sm"
                    title="Zoom out PDF"
                    aria-label="Zoom out PDF"
                  >
                    <span className="text-base font-semibold text-slate-400 select-none leading-none">−</span>
                  </button>

                  <span className="font-mono font-bold text-sm sm:text-base text-slate-100 min-w-[56px] text-center select-none">
                    {pdfZoom}%
                  </span>

                  <button
                    type="button"
                    onClick={handleIncreasePdfZoom}
                    disabled={pdfZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                    className="flex-1 h-12 rounded-xl border border-white/15 bg-[#181818] hover:bg-[#222222] hover:border-white/30 disabled:opacity-25 disabled:hover:bg-[#181818] disabled:hover:border-white/15 text-slate-100 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95 shadow-sm"
                    title="Zoom in PDF"
                    aria-label="Zoom in PDF"
                  >
                    <span className="text-xl font-bold text-slate-100 select-none leading-none">+</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Zoom level is kept automatically when changing pages or going left/right.
                </p>
              </div>
            </div>

            {/* Section 2: Visualizer & Telemetry Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Visualizer Settings</span>
              </div>

              {/* Setting: Show last image when changing pages */}
              <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/50 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <label
                      htmlFor="toggle-show-last-image"
                      className="text-xs font-semibold text-slate-100 block cursor-pointer"
                    >
                      Show last image when changing pages
                    </label>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Keep previous image visible while navigating pages or changing styles until a new illustration completes.
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  id="toggle-show-last-image"
                  role="switch"
                  aria-checked={showLastImageOnPageChange}
                  onClick={() => setShowLastImageOnPageChange(!showLastImageOnPageChange)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 mt-1 ${
                    showLastImageOnPageChange ? 'bg-indigo-600' : 'bg-[#2a2a2a]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      showLastImageOnPageChange ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting: Window Size (Integer Input 0-5) */}
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-950/50 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <label
                        htmlFor="input-window-size"
                        className="text-xs font-semibold text-slate-100 block cursor-pointer"
                      >
                        Context window size
                      </label>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                        Pages before & after current page (0 = current page only, 1 = ±1 page, max 5 = ±5 pages).
                      </p>
                    </div>
                  </div>

                  {/* Integer Step Controls & Input */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-[#0e0e0e] border border-white/10 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => handleWindowSizeChange(windowSize - 1)}
                      disabled={windowSize <= 0}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Decrease window size"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <input
                      id="input-window-size"
                      type="number"
                      min={0}
                      max={5}
                      value={windowSize}
                      onChange={(e) => handleWindowSizeChange(parseInt(e.target.value, 10) || 0)}
                      className="w-8 text-center text-xs font-bold font-mono text-white bg-transparent border-none outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleWindowSizeChange(windowSize + 1)}
                      disabled={windowSize >= 5}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Increase window size"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Status Pill / Context Range Preview */}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Context coverage:</span>
                  <span className="font-mono font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    {windowSize === 0
                      ? 'Current page only'
                      : `±${windowSize} page${windowSize > 1 ? 's' : ''} (up to ${windowSize * 2} surrounding)`}
                  </span>
                </div>
              </div>

              {/* Setting: Developer Telemetry Panel */}
              <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <label
                      htmlFor="toggle-developer-telemetry"
                      className="text-xs font-semibold text-slate-100 block cursor-pointer"
                    >
                      Developer telemetry panel
                    </label>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Display LLM sliding-window metrics, extracted JSON data, and prompt logs below the reader.
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  id="toggle-developer-telemetry"
                  role="switch"
                  aria-checked={showDeveloperTelemetry}
                  onClick={() => setShowDeveloperTelemetry(!showDeveloperTelemetry)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 mt-1 ${
                    showDeveloperTelemetry ? 'bg-indigo-600' : 'bg-[#2a2a2a]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      showDeveloperTelemetry ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
