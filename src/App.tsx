/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, BookOpen, LogOut, ArrowRight, Book, RefreshCw, Key } from 'lucide-react';
import { useAppStore } from './lib/store';
import PdfUploader from './components/PdfUploader';
import ReaderPanel from './components/ReaderPanel';
import ImagePanel from './components/ImagePanel';
import ArtStyleSelector from './components/ArtStyleSelector';
import DeveloperPanel from './components/DeveloperPanel';
import ApiKeysModal from './components/ApiKeysModal';
import { motion } from 'motion/react';

export default function App() {
  const fileHash = useAppStore((state) => state.fileHash);
  const fileName = useAppStore((state) => state.fileName);
  const resetStore = useAppStore((state) => state.resetStore);
  const totalPages = useAppStore((state) => state.totalPages);
  const currentPage = useAppStore((state) => state.currentPage);
  const generateVisualization = useAppStore((state) => state.generateVisualization);
  const generationStatus = useAppStore((state) => state.generationStatus);

  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);

  const isLoading = generationStatus === 'extracting_scene' || generationStatus === 'generating_image';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-slate-200 font-sans animate-fade-in">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/90 border-b border-white/10 backdrop-blur-md px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/30">
              <Book className="w-5 h-5 text-slate-100 fill-white/10" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-100 tracking-tight leading-none">
                AI Book Visualizer
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-1">
                Visual companion platform
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-3">
            {/* API Keys Configuration Button */}
            <button
              onClick={() => setIsApiKeysOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#161616] text-slate-400 hover:text-slate-100 hover:bg-[#222222] border border-white/10 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Configure Custom API Keys"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">API Keys</span>
            </button>

            {/* Loaded Book Info Toolbar */}
            {fileHash && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <div className="hidden lg:flex items-center gap-2 text-xs border border-white/5 rounded-xl bg-[#161616] px-3.5 py-1.5 font-medium text-slate-400">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span className="max-w-[150px] truncate">{fileName}</span>
                </div>

                {/* Generate button */}
                <button
                  onClick={() => generateVisualization()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/20 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/40 transition-all active:scale-95 cursor-pointer"
                >
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-200" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>Generate</span>
                </button>

                {/* Art style controller */}
                <ArtStyleSelector />

                {/* Reset layout */}
                <button
                  onClick={resetStore}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#161616] text-slate-400 hover:text-slate-100 hover:bg-[#222222] border border-white/10 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Close Book</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto justify-center">
        {!fileHash ? (
          // UPLOAD WORKFLOW
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full flex justify-center py-12"
          >
            <PdfUploader />
          </motion.div>
        ) : (
          // READING & GENERATING WORKFLOW
          <div className="space-y-6 w-full">
            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left: Reader Column */}
              <div className="lg:col-span-7 h-full flex flex-col">
                <ReaderPanel />
              </div>

              {/* Right: Companion Canvas Column */}
              <div className="lg:col-span-5 h-full flex flex-col">
                <ImagePanel />
              </div>
            </div>

            {/* Bottom: Telemetry developer panel */}
            <DeveloperPanel />
          </div>
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="py-6 px-6 border-t border-white/10 bg-[#0f0f0f] mt-12 text-center text-xs text-slate-500">
        <p>© 2026 AI Book Visualizer. Driven by Gemini 3.6 & Imagen 3 models.</p>
      </footer>

      {/* API Keys Configuration Modal */}
      <ApiKeysModal isOpen={isApiKeysOpen} onClose={() => setIsApiKeysOpen(false)} />
    </div>
  );
}

