import React, { useState, useRef, useEffect } from 'react';
import { Settings, Image as ImageIcon, Terminal, X, Sliders, Layers, Plus, Minus } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showLastImageOnPageChange = useAppStore((state) => state.showLastImageOnPageChange);
  const setShowLastImageOnPageChange = useAppStore((state) => state.setShowLastImageOnPageChange);
  const showDeveloperTelemetry = useAppStore((state) => state.showDeveloperTelemetry);
  const setShowDeveloperTelemetry = useAppStore((state) => state.setShowDeveloperTelemetry);
  const windowSize = useAppStore((state) => state.windowSize);
  const setWindowSize = useAppStore((state) => state.setWindowSize);

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

  return (
    <div className="relative" ref={menuRef}>
      {/* Settings Gear Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 shadow-md'
            : 'bg-[#161616] text-slate-400 hover:text-slate-100 hover:bg-[#222222] border-white/10'
        }`}
        title="Visualizer Settings & Preferences"
        aria-label="Settings"
      >
        <Settings className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-400' : ''}`} />
        <span className="hidden sm:inline">Settings</span>
      </button>

      {/* Settings Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#141414] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl animate-fade-in">
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

          <div className="space-y-3.5">
            {/* Setting 1: Show last image when changing pages */}
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

            {/* Setting 2: Window Size (Integer Input 0-5) */}
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
                      Pages before & after current page (0 = current page only, 1 = ±1 page, max 5 = ±5 pages / up to 10 context pages).
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
                    ? 'Current page only (0 surrounding)'
                    : `±${windowSize} page${windowSize > 1 ? 's' : ''} (up to ${windowSize * 2} surrounding pages)`}
                </span>
              </div>
            </div>

            {/* Setting 3: Developer Telemetry Panel */}
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
                    Display LLM sliding-window metrics, extracted JSON data, and prompt engineering logs below the reader.
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
      )}
    </div>
  );
}
