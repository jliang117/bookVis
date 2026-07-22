import { Check, ChevronDown, Palette } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { ArtStyle } from '../types';
import { useAppStore } from '../lib/store';
import { STYLE_MODIFIERS } from '../lib/prompts/styles';

const STYLES: ArtStyle[] = [
  'Fantasy Illustration',
  'Realistic',
  'Studio Ghibli',
  'Oil Painting',
  'Watercolor',
  'Anime',
  'Dark Fantasy',
  'Comic Book',
  'Children\'s Book',
  'Pixel Art',
  'Cinematic',
  'Concept Art',
  'Impressionist',
  'Noir',
  'Cyberpunk',
];

export default function ArtStyleSelector() {
  const selectedStyle = useAppStore((state) => state.selectedStyle);
  const setSelectedStyle = useAppStore((state) => state.setSelectedStyle);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#161616] border border-white/10 hover:border-white/20 hover:bg-[#222222] rounded-xl font-medium text-sm text-slate-200 transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <Palette className="w-4 h-4 text-indigo-400" />
        <span className="truncate max-w-[120px] sm:max-w-none">{selectedStyle}</span>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-50 py-1.5 scrollbar-thin scrollbar-thumb-white/5">
          <div className="px-3.5 py-1.5 border-b border-white/5 mb-1">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
              Visual Rendering Styles
            </span>
          </div>
          {STYLES.map((style) => (
            <button
              key={style}
              onClick={() => {
                setSelectedStyle(style);
                setIsOpen(false);
              }}
              className="w-full flex items-start gap-3 px-4 py-2.5 text-left text-slate-300 hover:bg-[#161616] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                {style === selectedStyle ? (
                  <Check className="w-4 h-4 text-indigo-400 stroke-[3]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${style === selectedStyle ? 'text-slate-100' : 'text-slate-300'}`}>
                  {style}
                </span>
                <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {STYLE_MODIFIERS[style]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
