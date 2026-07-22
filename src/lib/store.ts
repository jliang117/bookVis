import { create } from 'zustand';
import { AppState, ArtStyle, GenerationStatus, SceneJSON, DeveloperTelemetry } from '../types';
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

  // Private states not exposed directly in AppState
  pageTexts: [] as string[],

  // Actions
  setPageTexts: (texts, fileName, fileHash) => {
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

    // Try to pre-load a visualization for page 1 if text is available
    get().generateVisualization();
  },

  setCurrentPage: (page) => {
    const { totalPages, currentPage } = get();
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    set({ currentPage: page, error: null });
    
    // Automatically attempt to fetch/generate for the new page
    get().generateVisualization();
  },

  setSelectedStyle: (style) => {
    if (style === get().selectedStyle) return;
    set({ selectedStyle: style, error: null });
    
    // Regenerate when style changes
    get().generateVisualization();
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
    const { pageTexts, currentPage, selectedStyle, fileHash, generationStatus } = get();
    
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
        const extractRes = await fetch('/api/extract-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!extractRes.ok) {
          const errData = await extractRes.json();
          throw new Error(errData.error || 'Failed to extract scene descriptors from server.');
        }

        const extractData = await extractRes.json();
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

      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      if (!imageRes.ok) {
        const errData = await imageRes.json();
        throw new Error(errData.error || 'Failed to generate scene illustration from server.');
      }

      const imageData = await imageRes.json();
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
