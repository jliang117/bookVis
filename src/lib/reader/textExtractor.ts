import { AppState } from '../../types';

export const EXTRACTOR_CONFIG = {
  INITIAL_WORD_COUNT: 1200, // 1000-1500 words centered around current page
  EXPANSION_WORD_COUNT: 100, // ~100 words expanded on each side per attempt
  MAX_EXPANSION_LIMIT: 500,  // Max total expansion on each side
};

/**
 * Helper to count words in a string
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts a window of text centered around the current page
 * @param pageTexts Array of text for each page (0-indexed)
 * @param currentPage 1-indexed current page number
 * @param targetWordCount Target total word count
 * @param extraWordsSide Additional words to include on each side (for expansion)
 */
export function extractTextWindow(
  pageTexts: string[],
  currentPage: number,
  targetWordCount: number = EXTRACTOR_CONFIG.INITIAL_WORD_COUNT,
  extraWordsSide: number = 0
): { text: string; actualWordCount: number; pagesIncluded: number[] } {
  if (pageTexts.length === 0) {
    return { text: '', actualWordCount: 0, pagesIncluded: [] };
  }

  const centerPageIndex = Math.max(0, Math.min(currentPage - 1, pageTexts.length - 1));
  const pagesIncluded = new Set<number>([centerPageIndex]);
  
  let leftPage = centerPageIndex - 1;
  let rightPage = centerPageIndex + 1;
  
  // Calculate total words in current centered page
  let currentText = pageTexts[centerPageIndex] || '';
  let currentWordCount = countWords(currentText);

  // Expand page by page until we reach the targetWordCount
  while (currentWordCount < targetWordCount && (leftPage >= 0 || rightPage < pageTexts.length)) {
    // Alternately add from left and right to keep it centered
    if (leftPage >= 0) {
      const leftText = pageTexts[leftPage] || '';
      currentText = leftText + '\n\n' + currentText;
      currentWordCount += countWords(leftText);
      pagesIncluded.add(leftPage);
      leftPage--;
    }
    
    if (currentWordCount >= targetWordCount) break;

    if (rightPage < pageTexts.length) {
      const rightText = pageTexts[rightPage] || '';
      currentText = currentText + '\n\n' + rightText;
      currentWordCount += countWords(rightText);
      pagesIncluded.add(rightPage);
      rightPage++;
    }
  }

  // If we have extra expansion words on each side requested, we can slice the text
  // or grab more words. Grabbing more words is simple: we can just increase our target
  // word count or we can slice from the text.
  // To keep it clean, let's expand the page boundaries further or slice characters.
  // Actually, adding more pages is the most robust way in a PDF because pages contain complete paragraphs.
  // Let's add extra words on each side if extraWordsSide is requested.
  if (extraWordsSide > 0) {
    const extraPagesNeeded = Math.ceil(extraWordsSide / 300); // assume ~300 words per page
    for (let i = 0; i < extraPagesNeeded; i++) {
      if (leftPage >= 0) {
        const leftText = pageTexts[leftPage] || '';
        currentText = leftText + '\n\n' + currentText;
        pagesIncluded.add(leftPage);
        leftPage--;
      }
      if (rightPage < pageTexts.length) {
        const rightText = pageTexts[rightPage] || '';
        currentText = currentText + '\n\n' + rightText;
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
