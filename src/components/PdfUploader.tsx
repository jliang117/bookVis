import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../lib/store';

// Set up PDFJS Worker dynamically to ensure compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.js`;

export default function PdfUploader() {
  const setPageTexts = useAppStore((state) => state.setPageTexts);
  const [isDragging, setIsDragging] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported for reading and visualization.');
      return;
    }

    setError(null);
    setParsingProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setTotalPages(numPages);

      // Unique hash to identify this book for local caching
      const bookHash = `${file.name.replace(/\s+/g, '_')}_${file.size}_${file.lastModified}`;
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

      // Store in global state (which automatically kicks off page 1 generation)
      setPageTexts(extractedPageTexts, file.name, bookHash);

      // Keep reference to PDF document in window for canvas-based page rendering
      (window as any).__CURRENT_PDF_DOC__ = pdf;

    } catch (err: any) {
      console.error('PDF Parsing failed:', err);
      setError('Failed to parse PDF document. Ensure it is not password protected or corrupted.');
      setParsingProgress(null);
    }
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
    <div className="w-full max-w-2xl mx-auto py-12 px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mb-2">
          AI Book Visualizer
        </h1>
        <p className="text-slate-400 text-lg max-w-lg mx-auto">
          Upload a book to read in-browser and generate beautiful AI-driven visual scene companions dynamically.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-2xl p-12 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[300px] ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/20 shadow-inner scale-[0.99]'
            : 'border-white/10 hover:border-white/20 bg-[#111111] hover:bg-[#141414]'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
        />

        {parsingProgress === null ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-white/5 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-lg font-semibold text-slate-200 mb-1">
              Drag & drop your PDF book here
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Or click to browse your computer
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-[#161616] px-3 py-1.5 rounded-full border border-white/5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Supports files up to 50MB</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center w-full max-w-md">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-lg font-semibold text-slate-200 mb-1">
              Parsing book content...
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Extracting searchable text pages for local companion rendering
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
              Page {parsingProgress} of {totalPages || '?'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-200 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-0.5">Upload Failed</h4>
            <p className="text-rose-300/90">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
