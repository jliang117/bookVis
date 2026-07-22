import { create } from 'zustand';
import { AppState, ArtStyle, GenerationStatus, SceneJSON, DeveloperTelemetry, ApiKeys } from '../types';
import { extractTextWindow, countWords, EXTRACTOR_CONFIG } from './reader/textExtractor';
import { buildPrompt } from './prompts/promptBuilder';
import { ImageCache, generateCacheKey, CacheEntry, hashString } from './cache/imageCache';

interface AppActions {
  setPageTexts: (texts: string[], fileName: string, fileHash: string) => void;
  setCurrentPage: (page: number) => void;
  setSelectedStyle: (style: ArtStyle) => void;
  generateVisualization: (forceRegenerate?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  resetStore: () => void;
  setApiKeys: (keys: ApiKeys) => void;
}

const initialTelemetry: DeveloperTelemetry = {
  currentPage: 1,
  windowSize: 0,
  expansionAttempts: 0,
  contextAccepted: false,
  sceneJson: null,
  finalPrompt: '',
  cacheHit: false,
  generationTimeMs: 0,
  approxTokenUsage: 0,
};

const getInitialApiKeys = (): ApiKeys => {
  try {
    const keys = localStorage.getItem('visual_reader_api_keys');
    return keys ? JSON.parse(keys) : { gemini: '' };
  } catch {
    return { gemini: '' };
  }
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // State
  fileHash: null,
  fileName: null,
  currentPage: 1,
  totalPages: 0,
  extractedWindow: '',
  extractedScene: null,
  selectedStyle: 'Fantasy Illustration',
  imageUrl: null,
  generationStatus: 'idle',
  generatedAt: null,
  telemetry: null,
  error: null,
  apiKeys: getInitialApiKeys(),

  // Private states not exposed directly in AppState
  pageTexts: [] as string[],

  // Actions
  setApiKeys: (keys) => {
    try {
      localStorage.setItem('visual_reader_api_keys', JSON.stringify(keys));
    } catch (e) {
      console.error(e);
    }
    set({ apiKeys: keys });
  },

  setPageTexts: async (texts, fileName, fileHash) => {
    set({
      pageTexts: texts,
      fileName,
      fileHash,
      currentPage: 1,
      totalPages: texts.length,
      extractedWindow: '',
      extractedScene: null,
      imageUrl: null,
      generationStatus: 'idle',
      generatedAt: null,
      telemetry: null,
      error: null,
    });

    // Check if we already have a cached visualization for page 1
    if (fileHash && texts.length > 0) {
      const selectedStyle = get().selectedStyle;
      const { text } = extractTextWindow(texts, 1, EXTRACTOR_CONFIG.INITIAL_WORD_COUNT, 0);
      const cacheKey = generateCacheKey(fileHash, 1, text, selectedStyle);
      const cached = await ImageCache.get(cacheKey);
      if (cached) {
        set({
          imageUrl: cached.imageUrl,
          generationStatus: 'success',
          generatedAt: new Date(cached.generatedAt).toLocaleTimeString(),
          telemetry: {
            currentPage: 1,
            windowSize: countWords(text),
            expansionAttempts: 0,
            contextAccepted: true,
            sceneJson: cached.sceneJson,
            finalPrompt: buildPrompt(cached.sceneJson, selectedStyle),
            cacheHit: true,
            generationTimeMs: 0,
            approxTokenUsage: 0,
          }
        });
      }
    }
  },

  setCurrentPage: async (page) => {
    const { totalPages, currentPage, selectedStyle, fileHash, pageTexts } = get();
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    set({ currentPage: page, error: null, imageUrl: null, generationStatus: 'idle', telemetry: null });
    
    // Check if we already have a cached visualization for this page
    if (fileHash && pageTexts.length > 0 && pageTexts[page - 1]) {
      const { text } = extractTextWindow(pageTexts, page, EXTRACTOR_CONFIG.INITIAL_WORD_COUNT, 0);
      const cacheKey = generateCacheKey(fileHash, page, text, selectedStyle);
      const cached = await ImageCache.get(cacheKey);
      if (cached) {
        set({
          imageUrl: cached.imageUrl,
          generationStatus: 'success',
          generatedAt: new Date(cached.generatedAt).toLocaleTimeString(),
          telemetry: {
            currentPage: page,
            windowSize: countWords(text),
            expansionAttempts: 0,
            contextAccepted: true,
            sceneJson: cached.sceneJson,
            finalPrompt: buildPrompt(cached.sceneJson, selectedStyle),
            cacheHit: true,
            generationTimeMs: 0,
            approxTokenUsage: 0,
          }
        });
      }
    }
  },

  setSelectedStyle: async (style) => {
    if (style === get().selectedStyle) return;
    set({ selectedStyle: style, error: null, imageUrl: null, generationStatus: 'idle', telemetry: null });
    
    // Check if we already have a cached visualization for this style
    const { fileHash, currentPage, pageTexts } = get();
    if (fileHash && pageTexts.length > 0 && pageTexts[currentPage - 1]) {
      const { text } = extractTextWindow(pageTexts, currentPage, EXTRACTOR_CONFIG.INITIAL_WORD_COUNT, 0);
      const cacheKey = generateCacheKey(fileHash, currentPage, text, style);
      const cached = await ImageCache.get(cacheKey);
      if (cached) {
        set({
          imageUrl: cached.imageUrl,
          generationStatus: 'success',
          generatedAt: new Date(cached.generatedAt).toLocaleTimeString(),
          telemetry: {
            currentPage,
            windowSize: countWords(text),
            expansionAttempts: 0,
            contextAccepted: true,
            sceneJson: cached.sceneJson,
            finalPrompt: buildPrompt(cached.sceneJson, style),
            cacheHit: true,
            generationTimeMs: 0,
            approxTokenUsage: 0,
          }
        });
      }
    }
  },

  clearCache: async () => {
    const { fileHash } = get();
    if (!fileHash) return;
    await ImageCache.clearForBook(fileHash);
    set({ imageUrl: null, generationStatus: 'idle', telemetry: null });
  },

  resetStore: () => {
    set({
      fileHash: null,
      fileName: null,
      currentPage: 1,
      totalPages: 0,
      extractedWindow: '',
      extractedScene: null,
      selectedStyle: 'Fantasy Illustration',
      imageUrl: null,
      generationStatus: 'idle',
      generatedAt: null,
      telemetry: null,
      error: null,
      pageTexts: [],
    });
  },

  generateVisualization: async (forceRegenerate = false) => {
    const { pageTexts, currentPage, selectedStyle, fileHash, generationStatus, apiKeys } = get();
    
    if (pageTexts.length === 0 || !fileHash) return;
    if (generationStatus === 'extracting_scene' || generationStatus === 'generating_image') return;

    set({ generationStatus: 'extracting_scene', error: null });

    const pipelineStart = Date.now();
    let currentExpansionWords = 0;
    let expansionAttempts = 0;
    let finalSceneJson: SceneJSON | null = null;
    let finalExtractedWindow = '';
    let contextAccepted = false;
    let telemetryTokenUsage = 0;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKeys?.gemini) {
      requestHeaders['x-gemini-api-key'] = apiKeys.gemini;
    }

    // --- PIPELINE STEP 1: Text Slicing & Scene Extraction (LLM) ---
    try {
      while (expansionAttempts <= 5) { // 5 max attempts, up to ~500 extra words on each side
        const { text, actualWordCount } = extractTextWindow(
          pageTexts,
          currentPage,
          EXTRACTOR_CONFIG.INITIAL_WORD_COUNT,
          currentExpansionWords
        );
        
        finalExtractedWindow = text;

        // Call our server API for scene extraction
        console.log('[CLIENT DEBUG] Calling /api/extract-scene with payload text length:', text.length);
        const extractRes = await fetch('/api/extract-scene', {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ text }),
        });

        const extractRawText = await extractRes.text();
        console.log('[CLIENT DEBUG] Raw response from /api/extract-scene:', extractRawText);

        let extractData;
        try {
          extractData = JSON.parse(extractRawText);
        } catch (parseErr: any) {
          console.error('[CLIENT ERROR] Failed to parse scene extraction response as JSON:', parseErr, 'Raw response text:', extractRawText);
          throw new Error(`Failed to parse scene extraction response from server (Status ${extractRes.status}). ${parseErr.message || ''}`);
        }

        if (!extractRes.ok) {
          throw new Error(extractData.error || `Server error during scene extraction (Status ${extractRes.status}).`);
        }

        const sceneData: SceneJSON = extractData.data;
        telemetryTokenUsage += extractData.approxTokens || 0;

        if (sceneData.enoughContext) {
          finalSceneJson = sceneData;
          contextAccepted = true;
          break;
        } else {
          // Expand the sliding window text
          expansionAttempts++;
          currentExpansionWords += EXTRACTOR_CONFIG.EXPANSION_WORD_COUNT;
          
          if (currentExpansionWords > EXTRACTOR_CONFIG.MAX_EXPANSION_LIMIT) {
            // Reached maximum allowed expansion limit, proceed with what we have
            finalSceneJson = sceneData;
            contextAccepted = false;
            break;
          }
        }
      }

      if (!finalSceneJson) {
        throw new Error('Pipeline failed during scene extraction.');
      }

      set({ 
        extractedWindow: finalExtractedWindow,
        extractedScene: finalSceneJson
      });

      // --- PIPELINE STEP 2: Prompt Builder & Caching Check ---
      const finalPrompt = buildPrompt(finalSceneJson, selectedStyle);
      const textHash = hashString(finalExtractedWindow);
      const cacheKey = generateCacheKey(fileHash, currentPage, finalExtractedWindow, selectedStyle);

      // Check IndexedDB cache unless we are explicitly force-regenerating
      if (!forceRegenerate) {
        const cachedEntry = await ImageCache.get(cacheKey);
        if (cachedEntry) {
          const duration = Date.now() - pipelineStart;
          set({
            imageUrl: cachedEntry.imageUrl,
            generationStatus: 'success',
            generatedAt: new Date(cachedEntry.generatedAt).toLocaleTimeString(),
            telemetry: {
              currentPage,
              windowSize: countWords(finalExtractedWindow),
              expansionAttempts,
              contextAccepted,
              sceneJson: finalSceneJson,
              finalPrompt,
              cacheHit: true,
              generationTimeMs: duration,
              approxTokenUsage: telemetryTokenUsage,
            }
          });
          return;
        }
      }

      // --- PIPELINE STEP 3: Image Generation ---
      set({ generationStatus: 'generating_image' });
      const imageStart = Date.now();

      const imagePayload = { prompt: finalPrompt };
      console.log('[CLIENT DEBUG] Calling /api/generate-image with JSON payload:', JSON.stringify(imagePayload, null, 2));

      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(imagePayload),
      });

      const imageRawText = await imageRes.text();
      console.log('[CLIENT DEBUG] Raw response from /api/generate-image (text length):', imageRawText.length);

      let imageData;
      try {
        imageData = JSON.parse(imageRawText);
      } catch (parseErr: any) {
        console.error('[CLIENT ERROR] Failed to parse image generation response as JSON:', parseErr, 'Raw response text snippet:', imageRawText.substring(0, 500));
        throw new Error(`Failed to parse image generation response from server (Status ${imageRes.status}). ${parseErr.message || ''}`);
      }

      if (!imageRes.ok) {
        throw new Error(imageData.error || `Server error during image generation (Status ${imageRes.status}).`);
      }

      const generatedImageUrl = imageData.imageUrl;

      // Save to IndexedDB cache
      const cacheEntry: CacheEntry = {
        key: cacheKey,
        bookHash: fileHash,
        currentPage,
        textHash,
        sceneJson: finalSceneJson,
        selectedStyle,
        imageUrl: generatedImageUrl,
        generatedAt: Date.now()
      };
      await ImageCache.set(cacheEntry);

      const pipelineDuration = Date.now() - pipelineStart;

      set({
        imageUrl: generatedImageUrl,
        generationStatus: 'success',
        generatedAt: new Date().toLocaleTimeString(),
        telemetry: {
          currentPage,
          windowSize: countWords(finalExtractedWindow),
          expansionAttempts,
          contextAccepted,
          sceneJson: finalSceneJson,
          finalPrompt,
          cacheHit: false,
          generationTimeMs: pipelineDuration,
          approxTokenUsage: telemetryTokenUsage,
        }
      });

    } catch (err: any) {
      console.error('Visualization pipeline failure:', err);
      set({
        generationStatus: 'failed',
        error: err.message || 'An unexpected error occurred during the visual pipeline.'
      });
    }
  }
}));
