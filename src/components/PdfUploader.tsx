import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, FileText, Loader2, AlertCircle, Sparkles, Type, BookOpen } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { parseEpub } from '../lib/epubParser';

// Set up PDFJS Worker using Vite's URL asset loader for offline-safe compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const SAMPLE_EXCERPT = `The ancient library was carved directly into the petrified roots of the Great Willow. Shafts of amber sunlight filtered down through emerald glass skylights, illuminating swirling motes of dust and towering shelves packed with leather-bound grimoires. At the center of the moss-carpeted chamber, a brass astrolabe rotated silently, casting intricate geometric shadows across the cobblestone floor where young scholar Dennis stood in awe, clutching a glowing sapphire crystal.`;

export default function PdfUploader() {
  const setPageTexts = useAppStore((state) => state.setPageTexts);
  const generateVisualization = useAppStore((state) => state.generateVisualization);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [directText, setDirectText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [parsingStatusText, setParsingStatusText] = useState<string>('Parsing book content...');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');

    if (!isPdf && !isEpub) {
      setError('Please upload a valid .pdf or .epub ebook file.');
      return;
    }

    setError(null);
    setParsingProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bookHash = `${file.name.replace(/\s+/g, '_')}_${file.size}_${file.lastModified}`;

      if (isPdf) {
        setParsingStatusText('Extracting PDF pages...');
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        setTotalPages(numPages);

        const extractedPageTexts: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          extractedPageTexts.push(pageText);
          setParsingProgress(i);
        }

        // Keep reference to PDF document in window for canvas-based page rendering
        (window as any).__CURRENT_PDF_DOC__ = pdf;

        // Store in global state (which automatically kicks off page 1 generation)
        setPageTexts(extractedPageTexts, file.name, bookHash);

      } else if (isEpub) {
        setParsingStatusText('Unpacking & parsing EPUB chapters...');
        (window as any).__CURRENT_PDF_DOC__ = null;

        const defaultTitle = file.name.replace(/\.epub$/i, '');
        const { title, pages, chapters } = await parseEpub(arrayBuffer, defaultTitle);

        setTotalPages(pages.length);
        setParsingProgress(pages.length);

        // Store in global state with structured chapters
        setPageTexts(pages, title, bookHash, chapters);
      }

    } catch (err: any) {
      console.error('Book parsing failed:', err);
      setError(
        err.message || 'Failed to parse the uploaded ebook. Ensure the file is not corrupted or DRM protected.'
      );
      setParsingProgress(null);
    }
  };

  const handleDirectTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = directText.trim();
    if (!text) {
      setError('Please enter or paste some descriptive text to visualize.');
      return;
    }

    setError(null);
    (window as any).__CURRENT_PDF_DOC__ = null;

    // Simple deterministic hash based on text content
    const textHash = 'text_' + Math.abs(text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)).toString(36);
    
    // Set page texts and immediately generate visualization
    setPageTexts([text], 'Direct Text Excerpt', textHash);
    setTimeout(() => {
      generateVisualization();
    }, 100);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mb-2">
          AI Book Visualizer
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Transform your books and scene descriptions into AI-illustrated visual companions dynamically.
        </p>
      </div>

      {/* Mode Toggle Bar */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1 bg-[#141414] border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => { setMode('file'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'file'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Upload Ebook (PDF, EPUB)</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('text'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'text'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Direct Text Excerpt</span>
          </button>
        </div>
      </div>

      {mode === 'file' ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-10 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[280px] ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/20 shadow-inner scale-[0.99]'
              : 'border-white/10 hover:border-white/20 bg-[#111111] hover:bg-[#141414]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            className="hidden"
          />

          {parsingProgress === null ? (
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Upload className="w-7 h-7 text-indigo-400" />
              </div>
              <p className="text-base font-semibold text-slate-200 mb-1">
                Drag & drop your PDF or EPUB book here
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Or click to browse your computer (.pdf, .epub)
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-[#161616] px-3 py-1.5 rounded-full border border-white/5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supports PDF & EPUB documents up to 50MB</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center w-full max-w-md">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <p className="text-base font-semibold text-slate-200 mb-1">
                {parsingStatusText}
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Extracting searchable text pages for companion rendering
              </p>
              
              <div className="w-full bg-[#1a1a1a] border border-white/5 rounded-full h-2.5 mb-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${totalPages ? (parsingProgress / totalPages) * 100 : 0}%`,
                  }}
                />
              </div>
              
              <span className="text-xs font-mono font-bold text-slate-400">
                {totalPages ? `Page ${parsingProgress} of ${totalPages}` : 'Processing chapters...'}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Direct Text Input Form */
        <form onSubmit={handleDirectTextSubmit} className="space-y-4">
          <div className="relative bg-[#111111] border border-white/10 rounded-2xl p-4 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              rows={7}
              value={directText}
              onChange={(e) => setDirectText(e.target.value)}
              placeholder="Paste or write a book excerpt, story scene, character interaction, or descriptive paragraph to generate an illustration..."
              className="w-full bg-transparent text-slate-200 placeholder-slate-500 text-sm focus:outline-none resize-none leading-relaxed font-serif"
            />
            
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setDirectText(SAMPLE_EXCERPT)}
                className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer text-xs font-medium"
              >
                Insert sample fantasy scene
              </button>
              <span>{directText.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!directText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-950/40 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Generate Direct Visualization</span>
          </button>
        </form>
      )}

      {error && (
        <div className="mt-5 p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-200 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-0.5">Notice</h4>
            <p className="text-rose-300/90">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

