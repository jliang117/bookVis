import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Search, ArrowRight } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function ReaderPanel() {
  const currentPage = useAppStore((state) => state.currentPage);
  const totalPages = useAppStore((state) => state.totalPages);
  const fileName = useAppStore((state) => state.fileName);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRenderTaskRef = useRef<any>(null);
  const [jumpPage, setJumpPage] = useState<string>('');
  const [isRendered, setIsRendered] = useState(false);

  const renderPage = async (pageNumber: number) => {
    const pdf = (window as any).__CURRENT_PDF_DOC__;
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      // Determine correct responsive scaling based on container element width
      const containerWidth = containerRef.current?.clientWidth || 550;
      const desiredWidth = Math.min(650, containerWidth - 24); // Cap width to keep it beautiful
      const tempViewport = page.getViewport({ scale: 1.0 });
      const computedScale = desiredWidth / tempViewport.width;

      const viewport = page.getViewport({ scale: computedScale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Cancel any ongoing rendering tasks to prevent overlaps
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      activeRenderTaskRef.current = renderTask;

      await renderTask.promise;
      activeRenderTaskRef.current = null;
      setIsRendered(true);

    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Failed to render PDF page on canvas:', err);
      }
    }
  };

  // Render page when page number or window size changes
  useEffect(() => {
    renderPage(currentPage);

    // Watch for window resize to scale PDF dynamically
    const handleResize = () => {
      renderPage(currentPage);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
      }
    };
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
      setJumpPage('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111111] border border-white/10 rounded-2xl shadow-lg overflow-hidden" ref={containerRef}>
      {/* Header Panel */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#141414]">
        <div className="flex items-center gap-2 max-w-[60%]">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-300 truncate" title={fileName || ''}>
            {fileName || 'Reading Material'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-white/5 px-3 py-1 rounded-full text-xs font-semibold font-mono text-slate-300">
          Page {currentPage} of {totalPages}
        </div>
      </div>

      {/* Reader Page Stage */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0d0d0d] overflow-y-auto min-h-[400px]">
        <div className="relative bg-[#1a1a1a] shadow-2xl rounded-lg overflow-hidden border border-white/10 max-w-full">
          <canvas ref={canvasRef} className="max-w-full h-auto block" />
          
          {!isRendered && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#111111]">
              <span className="text-sm font-semibold text-slate-500">Loading page canvas...</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3.5 border-t border-white/5 bg-[#141414]">
        {/* Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-[#161616] hover:bg-[#222222] hover:border-white/20 disabled:opacity-20 disabled:hover:bg-[#161616] text-slate-300 transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-slate-400 px-2 font-mono">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-[#161616] hover:bg-[#222222] hover:border-white/20 disabled:opacity-20 disabled:hover:bg-[#161616] text-slate-300 transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Page Jumping */}
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Jump to page..."
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-32 border border-white/10 hover:border-white/20 focus:border-indigo-500 focus:outline-none rounded-xl text-xs font-medium text-slate-300 placeholder-slate-500 bg-[#161616] transition-colors"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
