import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, Image as ImageIcon, AlertCircle, Eye, Calendar, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../lib/store';

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
  
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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

  const isLoading = generationStatus === 'extracting_scene' || generationStatus === 'generating_image';

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#141414]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            AI Companion Canvas
          </span>
        </div>
        
        {generationStatus === 'success' && (
          <button
            onClick={handleRegenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 rounded-lg bg-[#161616] hover:bg-[#222222] transition-all hover:shadow-md cursor-pointer"
            title="Force regenerate, bypassing local IndexedDB cache"
          >
            <RefreshCw className="w-3 h-3 animate-hover-spin text-indigo-400" />
            <span>Regenerate</span>
          </button>
        )}
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a] min-h-[400px]">
        
        {/* IDLE State */}
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

        {/* LOADING State */}
        {isLoading && (
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

        {/* SUCCESS State */}
        {generationStatus === 'success' && imageUrl && (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-905 max-w-full">
              <img
                src={imageUrl}
                alt="Generated Scene"
                className="max-h-[500px] w-auto max-w-full block object-contain select-none"
                referrerPolicy="no-referrer"
              />
              
              {/* Image Info Overlay on bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-white">
                  <Eye className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                    {selectedStyle} Style
                  </span>
                </div>
                {generatedAt && (
                  <div className="flex items-center gap-1 text-slate-400 text-[9px] font-mono">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    <span>Rendered {generatedAt}</span>
                  </div>
                )}
              </div>
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
