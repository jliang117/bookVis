import { AppState } from '../../types';

export const EXTRACTOR_CONFIG = {
  INITIAL_WORD_COUNT: 350, // Focused on current page (standard ~250-350 words page)
  EXPANSION_WORD_COUNT: 120, // ~120 words expanded on each side per attempt if context is insufficient
  MAX_EXPANSION_LIMIT: 400,  // Max total expansion on each side
};

/**
 * Helper to count words in a string
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts a window of text centered around the current page based on pageWindowRadius
 * @param pageTexts Array of text for each page (0-indexed)
 * @param currentPage 1-indexed current page number
 * @param pageWindowRadius Number of pages before and after current page to include (0 = current only, 1 = ±1, max 5 = ±5)
 * @param extraWordsSide Additional words to include on each side if context needs expansion
 */
export function extractTextWindow(
  pageTexts: string[],
  currentPage: number,
  pageWindowRadius: number = 0,
  extraWordsSide: number = 0
): { text: string; actualWordCount: number; pagesIncluded: number[] } {
  if (pageTexts.length === 0) {
    return { text: '', actualWordCount: 0, pagesIncluded: [] };
  }

  const centerPageIndex = Math.max(0, Math.min(currentPage - 1, pageTexts.length - 1));
  const radius = Math.max(0, Math.min(5, pageWindowRadius));
  
  const minPageIndex = Math.max(0, centerPageIndex - radius);
  const maxPageIndex = Math.min(pageTexts.length - 1, centerPageIndex + radius);

  const pagesIncluded = new Set<number>();
  const textChunks: string[] = [];

  for (let idx = minPageIndex; idx <= maxPageIndex; idx++) {
    pagesIncluded.add(idx);
    const chunk = pageTexts[idx]?.trim();
    if (chunk) {
      textChunks.push(chunk);
    }
  }

  let currentText = textChunks.join('\n\n');

  // If automatic context expansion is needed beyond the user's configured radius
  if (extraWordsSide > 0) {
    let leftPage = minPageIndex - 1;
    let rightPage = maxPageIndex + 1;
    const extraPagesNeeded = Math.ceil(extraWordsSide / 300); // approx ~300 words per page
    
    for (let i = 0; i < extraPagesNeeded; i++) {
      if (leftPage >= 0) {
        const leftText = pageTexts[leftPage]?.trim() || '';
        if (leftText) {
          currentText = leftText + '\n\n' + currentText;
        }
        pagesIncluded.add(leftPage);
        leftPage--;
      }
      if (rightPage < pageTexts.length) {
        const rightText = pageTexts[rightPage]?.trim() || '';
        if (rightText) {
          currentText = currentText + '\n\n' + rightText;
        }
        pagesIncluded.add(rightPage);
        rightPage++;
      }
    }
  }

  const finalWordCount = countWords(currentText);
  const sortedPages = Array.from(pagesIncluded).sort((a, b) => a - b);

  return {
    text: currentText,
    actualWordCount: finalWordCount,
    pagesIncluded: sortedPages,
  };
}
