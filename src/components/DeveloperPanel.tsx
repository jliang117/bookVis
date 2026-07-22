import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Copy, Check, Info, Cpu, Clock, HardDrive, Database, Hash } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function DeveloperPanel() {
  const telemetry = useAppStore((state) => state.telemetry);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!telemetry) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-6 bg-[#0f0f0f]/50 border border-white/5 rounded-xl p-4 flex items-center gap-2 text-xs text-slate-400 font-medium">
        <Info className="w-4 h-4 text-indigo-400" />
        <span>Developer telemetry will populate here once a book is parsed and a scene is evaluated.</span>
      </div>
    );
  }

  const jsonString = telemetry.sceneJson ? JSON.stringify(telemetry.sceneJson, null, 2) : '';

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 border border-white/10 rounded-2xl bg-[#0f0f0f] shadow-lg overflow-hidden">
      {/* Header Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#141414] border-b border-white/5 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Developer Pipeline Telemetry & Prompt Engineering Panel
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Panel Contents */}
      {isOpen && (
        <div className="p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-indigo-400" />
                Page No.
              </span>
              <span className="text-lg font-bold text-slate-200 font-mono">
                {telemetry.currentPage}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-indigo-400" />
                Window Size
              </span>
              <span className="text-lg font-bold text-slate-200 font-mono">
                {telemetry.windowSize} <span className="text-xs font-medium text-slate-500">words</span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" />
                Retries
              </span>
              <span className="text-lg font-bold text-slate-200 font-mono">
                {telemetry.expansionAttempts} <span className="text-xs font-medium text-slate-500">attempts</span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-400" />
                Context Status
              </span>
              <span className={`text-xs font-bold mt-1 inline-flex items-center rounded-md px-2 py-0.5 w-fit ${
                telemetry.contextAccepted 
                  ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40' 
                  : 'bg-amber-950/30 text-amber-400 border border-amber-900/40'
              }`}>
                {telemetry.contextAccepted ? 'Accepted' : 'Insufficient'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-400" />
                Cache Status
              </span>
              <span className={`text-xs font-bold mt-1 inline-flex items-center rounded-md px-2 py-0.5 w-fit ${
                telemetry.cacheHit 
                  ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/40' 
                  : 'bg-purple-950/30 text-purple-400 border border-purple-900/40'
              }`}>
                {telemetry.cacheHit ? 'HIT (Cached)' : 'MISS (Generated)'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" />
                Duration
              </span>
              <span className="text-lg font-bold text-slate-200 font-mono">
                {telemetry.generationTimeMs} <span className="text-xs font-medium text-slate-500">ms</span>
              </span>
            </div>
          </div>

          {/* Prompt & JSON splits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Structured Scene JSON */}
            <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-[#0d0d0d] text-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#141414]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Extracted Scene JSON
                </span>
                <button
                  onClick={() => handleCopy(jsonString, 'json')}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  {copiedText === 'json' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <pre className="p-4 text-[11px] text-indigo-300 font-mono leading-relaxed overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-white/5">
                {jsonString}
              </pre>
            </div>

            {/* Assembled Prompt */}
            <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-[#0d0d0d] text-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#141414]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Assembled Prompt Modifier
                </span>
                <button
                  onClick={() => handleCopy(telemetry.finalPrompt, 'prompt')}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  {copiedText === 'prompt' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-[11px] font-mono leading-relaxed text-slate-300 select-all max-h-[280px] overflow-y-auto">
                  {telemetry.finalPrompt}
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  <span>
                    Separated Prompt Engineering structure: structured JSON is generated first, and then combined with artistic prompt rules locally to generate the final illustration canvas.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
