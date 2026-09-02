import JSZip from 'jszip';
import { ChapterInfo } from '../types';

export interface ParsedEpub {
  title: string;
  pages: string[];
  chapters: ChapterInfo[];
}

interface RawChapter {
  title: string;
  paragraphs: string[];
}

/**
 * Parses an EPUB file buffer and extracts ordered text pages suitable for reading and visual generation,
 * along with chapter/act structure and page mappings.
 */
export async function parseEpub(arrayBuffer: ArrayBuffer, defaultTitle: string): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found.');
  }

  const containerXmlStr = await containerFile.async('text');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXmlStr, 'application/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Invalid EPUB: Rootfile path missing in container.xml.');
  }

  // 2. Read OPF Package Document
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: Package file not found at ${opfPath}`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXmlStr = await opfFile.async('text');
  const opfDoc = parser.parseFromString(opfXmlStr, 'application/xml');

  // Extract Book Title
  const titleEl = opfDoc.querySelector('title') || opfDoc.querySelector('dc\\:title');
  const bookTitle = titleEl?.textContent?.trim() || defaultTitle;

  // Build manifest map: id -> href
  const manifestMap = new Map<string, string>();
  const itemEls = opfDoc.querySelectorAll('manifest > item');
  itemEls.forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifestMap.set(id, href);
    }
  });

  // Read spine in order
  const spineItemRefs = opfDoc.querySelectorAll('spine > itemref');
  const rawChapters: RawChapter[] = [];
  let chapterIndex = 1;

  for (let i = 0; i < spineItemRefs.length; i++) {
    const itemref = spineItemRefs[i];
    const idref = itemref.getAttribute('idref');
    if (!idref) continue;

    const href = manifestMap.get(idref);
    if (!href) continue;

    // Resolve relative path against OPF directory
    const resolvedPath = normalizePath(opfDir + decodeURIComponent(href));
    const chapterFile = zip.file(resolvedPath);
    if (!chapterFile) continue;

    const chapterContent = await chapterFile.async('text');
    const chapterDoc = parser.parseFromString(chapterContent, 'text/html');

    // Extract chapter title before removing elements
    let chapterTitle = extractChapterTitle(chapterDoc, bookTitle);

    // Extract clean paragraphs from block elements
    const paragraphs = extractParagraphsFromHtml(chapterDoc);

    if (paragraphs.length > 0) {
      const fullText = paragraphs.join(' ');
      if (fullText.length > 30) {
        if (!chapterTitle) {
          const firstPara = paragraphs[0]?.trim() || '';
          if (/^(chapter|act|scene|part|prologue|epilogue|book|preface|introduction)\b/i.test(firstPara)) {
            chapterTitle = firstPara.slice(0, 60);
          } else {
            chapterTitle = `Chapter ${chapterIndex}`;
          }
        }

        rawChapters.push({
          title: chapterTitle,
          paragraphs
        });
        chapterIndex++;
      }
    }
  }

  if (rawChapters.length === 0) {
    throw new Error('Could not extract readable text content from this EPUB file.');
  }

  // 3. Paginate chapters into authentic page-sized chunks (~250-300 words per page)
  const pages: string[] = [];
  const chapters: ChapterInfo[] = [];
  const TARGET_WORDS_PER_PAGE = 260; // Standard book page size

  for (const rawChapter of rawChapters) {
    const chapterStartPage = pages.length + 1;
    let currentPageParagraphs: string[] = [];
    let currentPageWordCount = 0;

    for (const paragraph of rawChapter.paragraphs) {
      const paraWordCount = countWords(paragraph);

      // If a single paragraph is larger than a page, split it by sentences
      if (paraWordCount > TARGET_WORDS_PER_PAGE + 50) {
        const sentences = splitIntoSentences(paragraph);
        for (const sentence of sentences) {
          const sentenceWordCount = countWords(sentence);
          if (currentPageWordCount + sentenceWordCount > TARGET_WORDS_PER_PAGE && currentPageWordCount > 80) {
            pages.push(currentPageParagraphs.join('\n\n').trim());
            currentPageParagraphs = [sentence];
            currentPageWordCount = sentenceWordCount;
          } else {
            if (currentPageParagraphs.length > 0) {
              const lastIdx = currentPageParagraphs.length - 1;
              currentPageParagraphs[lastIdx] = `${currentPageParagraphs[lastIdx]} ${sentence}`;
            } else {
              currentPageParagraphs.push(sentence);
            }
            currentPageWordCount += sentenceWordCount;
          }
        }
      } else {
        // Standard paragraph handling
        if (currentPageWordCount + paraWordCount > TARGET_WORDS_PER_PAGE && currentPageWordCount > 80) {
          pages.push(currentPageParagraphs.join('\n\n').trim());
          currentPageParagraphs = [paragraph];
          currentPageWordCount = paraWordCount;
        } else {
          currentPageParagraphs.push(paragraph);
          currentPageWordCount += paraWordCount;
        }
      }
    }

    // Push trailing page of chapter
    if (currentPageParagraphs.length > 0) {
      pages.push(currentPageParagraphs.join('\n\n').trim());
    }

    const chapterEndPage = pages.length;

    chapters.push({
      title: rawChapter.title,
      startPage: chapterStartPage,
      endPage: Math.max(chapterStartPage, chapterEndPage)
    });
  }

  return {
    title: bookTitle,
    pages: pages.length > 0 ? pages : ['No readable content found.'],
    chapters
  };
}

/**
 * Extracts structured paragraph text from an HTML document
 */
function extractParagraphsFromHtml(doc: Document): string[] {
  // Remove non-content tags
  doc.querySelectorAll('script, style, head, nav, svg, noscript, header, footer').forEach((el) => el.remove());

  const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, dd, dt, pre, div');
  const paragraphs: string[] = [];

  if (blocks.length > 0) {
    blocks.forEach((el) => {
      // Avoid nested containers duplicate text (e.g. div containing p)
      if (el.tagName.toLowerCase() === 'div' && el.querySelector('p, div, h1, h2, h3, h4, h5, h6')) {
        return;
      }
      const text = (el.textContent || '').replace(/[ \t\r\n]+/g, ' ').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    });
  }

  // Fallback if no block elements were found
  if (paragraphs.length === 0) {
    const raw = (doc.body?.innerHTML || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n\n');
    const temp = doc.createElement('div');
    temp.innerHTML = raw;
    const text = temp.textContent || '';
    const split = text.split(/\n+/).map((t) => t.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
    paragraphs.push(...split);
  }

  return paragraphs;
}

/**
 * Splits text cleanly into sentences
 */
function splitIntoSentences(text: string): string[] {
  const matched = text.match(/[^.!?]+(?:[.!?]+["'’”)]*|\s*$)/g);
  if (!matched || matched.length === 0) {
    return [text];
  }
  return matched.map((s) => s.trim()).filter(Boolean);
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractChapterTitle(doc: Document, bookTitle: string): string | null {
  // Check heading tags in order of priority
  const candidates = doc.querySelectorAll('h1, h2, h3, [class*="chapter-title"], [class*="title"], [class*="chapter"]');
  for (let i = 0; i < candidates.length; i++) {
    const text = candidates[i]?.textContent?.trim();
    if (text && text.length > 1 && text.length < 80 && text.toLowerCase() !== bookTitle.toLowerCase()) {
      return text.replace(/\s+/g, ' ');
    }
  }

  const docTitle = doc.querySelector('title')?.textContent?.trim();
  if (docTitle && docTitle.length > 1 && docTitle.length < 80 && docTitle.toLowerCase() !== bookTitle.toLowerCase()) {
    return docTitle.replace(/\s+/g, ' ');
  }

  return null;
}

function normalizePath(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}
