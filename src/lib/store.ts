import { create } from 'zustand';
import { AppState, ArtStyle, GenerationStatus, SceneJSON, DeveloperTelemetry, ApiKeys, ChapterInfo, CachedImageItem, GenerationTask } from '../types';
import { extractTextWindow, countWords, EXTRACTOR_CONFIG } from './reader/textExtractor';
import { buildPrompt } from './prompts/promptBuilder';
import { ImageCache, generateCacheKey, CacheEntry, hashString } from './cache/imageCache';

interface AppActions {
  setPageTexts: (texts: string[], fileName: string, fileHash: string, chapters?: ChapterInfo[]) => void;
  setCurrentPage: (page: number) => void;
  setSelectedStyle: (style: ArtStyle) => void;
  generateVisualization: (forceRegenerate?: boolean, targetPage?: number, targetStyle?: ArtStyle) => Promise<void>;
  selectCachedImage: (key: string) => void;
  selectBookImage: (entry: CachedImageItem) => void;
  clearCache: () => Promise<void>;
  resetStore: () => void;
  setApiKeys: (keys: ApiKeys) => void;
  setShowLastImageOnPageChange: (enabled: boolean) => void;
  setShowDeveloperTelemetry: (enabled: boolean) => void;
  setWindowSize: (size: number) => void;
  setPdfZoom: (zoom: number) => void;
  setEpubFontSize: (size: number) => void;
  setDocumentType: (type: 'pdf' | 'epub' | 'text' | null) => void;
  loadAllBookImages: () => Promise<void>;
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

const getInitialSettings = () => {
  try {
    const showLast = localStorage.getItem('visual_reader_show_last_image');
    const showTelemetry = localStorage.getItem('visual_reader_show_telemetry');
    const rawWindowSize = localStorage.getItem('visual_reader_window_size');
    const parsedWindowSize = rawWindowSize !== null ? parseInt(rawWindowSize, 10) : 0;
    const windowSize = !isNaN(parsedWindowSize) ? Math.max(0, Math.min(5, parsedWindowSize)) : 0;

    const rawPdfZoom = localStorage.getItem('visual_reader_pdf_zoom');
    const parsedPdfZoom = rawPdfZoom !== null ? parseInt(rawPdfZoom, 10) : 100;
    const pdfZoom = !isNaN(parsedPdfZoom) ? Math.max(50, Math.min(250, parsedPdfZoom)) : 100;

    const rawEpubFontSize = localStorage.getItem('visual_reader_epub_font_size');
    const parsedEpubFontSize = rawEpubFontSize !== null ? parseInt(rawEpubFontSize, 10) : 100;
    const epubFontSize = !isNaN(parsedEpubFontSize) ? Math.max(50, Math.min(250, parsedEpubFontSize)) : 100;

    return {
      showLastImageOnPageChange: showLast === 'true', // default false
      showDeveloperTelemetry: showTelemetry === 'true', // default false
      windowSize, // default 0, limit 0 to 5
      pdfZoom, // default 100%
      epubFontSize, // default 100%
    };
  } catch {
    return {
      showLastImageOnPageChange: false,
      showDeveloperTelemetry: false,
      windowSize: 0,
      pdfZoom: 100,
      epubFontSize: 100,
    };
  }
};

// Helper function to extract scene directly from browser using Gemini API
async function clientExtractScene(text: string, style: ArtStyle, apiKey: string): Promise<SceneJSON> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
  const targetStyle = style || 'Dark & Epic Fantasy';

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Please analyze this book excerpt and extract visual descriptors for scene rendering in the "${targetStyle}" art style:\n\n"""\n${text}\n"""`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: `You are an expert literary scene visualizer and art director. Your task is to analyze a book excerpt and extract the detailed visual elements needed to generate a high-fidelity, accurate illustration of the current scene. 

CRITICAL ART STYLE ALIGNMENT:
The user has selected the "${targetStyle}" art style for this illustration.
All visual scene elements, lighting, composition, and especially the "styleNotes" field MUST strictly match and harmonize with the "${targetStyle}" aesthetic.
- In "styleNotes", provide specific artistic rendering notes, color palette harmonies, and texture details that directly enhance and complement the "${targetStyle}" art style.
- Do NOT output style notes that contradict or clash with "${targetStyle}" (e.g. if the style is Anime & Ghibli, Watercolor, or Pixel Art, never suggest photorealism or 3D render; if the style is Pixel Art, do not specify smooth brushwork).

You must strictly evaluate if there is "enoughContext" (e.g. setting description, physical environment, character action, or visual markers). Set "enoughContext" to true ONLY if there is sufficient descriptive detail to create a vivid visual scene. If the text is too brief, highly abstract, purely conversational, or lacks any concrete visual/environmental markers to anchor an illustration, set "enoughContext" to false.

Be extremely descriptive in your visual details, clothing description, posture, and environmental atmosphere. Do not assume or hallucinate features not hinted at in the text. Ensure output is in strict JSON conforming to the schema.`
        }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          enoughContext: {
            type: 'BOOLEAN',
            description: 'True if there is sufficient descriptive, narrative, or environmental detail in the text to create a vivid visual scene. False if the text is too brief, highly abstract, purely conversational, or lacks any concrete visual/environmental markers to anchor an illustration.'
          },
          scene: {
            type: 'OBJECT',
            properties: {
              location: {
                type: 'STRING',
                description: 'Where does this scene take place? (e.g. Victorian library, damp forest, high-tech control room)'
              },
              time: {
                type: 'STRING',
                description: 'What time of day or time period is it? (e.g. sunset, late night, medieval era, dawn)'
              },
              lighting: {
                type: 'STRING',
                description: 'How is the scene illuminated? (e.g. warm candlelight, harsh fluorescent light, shafts of golden sunlight)'
              },
              weather: {
                type: 'STRING',
                description: 'What is the weather outside or ambient conditions? (e.g. heavy rain, dense fog, clear starry night)'
              },
              mood: {
                type: 'STRING',
                description: 'What mood or emotional tone should the illustration convey? (e.g. tense anticipation, cozy serenity, melancholic isolation, grand wonder)'
              },
              characters: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: "List of characters present, including descriptions of their appearance, clothing, and posture if mentioned (e.g., ['Elizabeth: mid-20s, dark coat, tense posture', 'An old librarian: silver hair, dusty suit'])"
              },
              importantObjects: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: "Objects that are central to the action or setting (e.g., ['A half-opened wooden box with a glowing gemstone', 'Dusty leather-bound grimoire'])"
              },
              action: {
                type: 'STRING',
                description: 'What specific action or event is occurring in this moment? (e.g., Elizabeth is sliding a secret shelf aside)'
              },
              visualDetails: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: "Specific textural, color-related, or background visual details (e.g., ['Motes of dust dancing in light shafts', 'Flaking gold leaf on book spines'])"
              },
              cameraFocus: {
                type: 'STRING',
                description: 'What should be the main focal point or camera composition? (e.g. Close-up on the wooden box, medium shot of Elizabeth with the bookshelves)'
              },
              styleNotes: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: `Artistic and stylistic rendering notes specifically matching and complementing the "${targetStyle}" art style (e.g. color harmony, aesthetic treatment, and visual mood tailored for this medium). Must strictly avoid contradictory styles or mediums.`
              }
            },
            required: [
              'location', 'time', 'lighting', 'weather', 'mood', 'characters', 'importantObjects', 'action', 'visualDetails', 'cameraFocus', 'styleNotes'
            ]
          }
        },
        required: ['enoughContext']
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resText = await res.text();
  if (!res.ok) {
    let errMsg = `Gemini API scene extraction error (Status ${res.status})`;
    try {
      const errJson = JSON.parse(resText);
      errMsg = errJson.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const resJson = JSON.parse(resText);
  const contentText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(contentText.trim());
}

// Helper function to generate image directly from browser using Gemini API
async function clientGenerateImage(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: '16:9',
        imageSize: '1K'
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resText = await res.text();
  if (!res.ok) {
    let errMsg = `Gemini API image generation error (Status ${res.status})`;
    try {
      const errJson = JSON.parse(resText);
      errMsg = errJson.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const resJson = JSON.parse(resText);
  let imageUrl: string | null = null;
  const parts = resJson.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) {
    throw new Error('Gemini direct API response did not contain inline image data.');
  }

  return imageUrl;
}

export const useAppStore = create<AppState & AppActions>((set, get) => {
  let isProcessingQueue = false;

  const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      while (true) {
        const { generationQueue, fileHash, pageTexts, windowSize, apiKeys } = get();
        if (!fileHash || pageTexts.length === 0) break;

        const nextTask = generationQueue.find((t) => t.status === 'queued');
        if (!nextTask) break;

        const taskId = nextTask.id;
        const taskPage = nextTask.page;
        const taskStyle = nextTask.style;

        // Mark task as extracting_scene
        set((state) => ({
          generationQueue: state.generationQueue.map((t) =>
            t.id === taskId ? { ...t, status: 'extracting_scene' as const } : t
          ),
          ...(get().currentPage === taskPage ? { generationStatus: 'extracting_scene', error: null } : {})
        }));

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

        try {
          // --- PIPELINE STEP 1: Text Slicing & Scene Extraction (LLM) ---
          while (expansionAttempts <= 5) {
            const { text } = extractTextWindow(
              pageTexts,
              taskPage, // ALWAYS USE the exact target page for this task
              windowSize,
              currentExpansionWords
            );
            finalExtractedWindow = text;

            let sceneData: SceneJSON;
            let tokensUsed = 0;

            try {
              const payload = { text, style: taskStyle };
              const extractRes = await fetch('/api/extract-scene', {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(payload),
              });
              const extractRawText = await extractRes.text();
              let extractData;
              try {
                extractData = JSON.parse(extractRawText);
              } catch (parseErr: any) {
                throw new Error(`Failed to parse scene extraction response from server (Status ${extractRes.status}).`);
              }
              if (!extractRes.ok) {
                throw new Error(extractData.error || `Server error during scene extraction (Status ${extractRes.status}).`);
              }
              sceneData = extractData.data;
              tokensUsed = extractData.approxTokens || 0;
            } catch (serverError: any) {
              if (apiKeys?.gemini) {
                sceneData = await clientExtractScene(text, taskStyle, apiKeys.gemini);
                tokensUsed = Math.ceil(text.length / 4) + 500;
              } else {
                throw serverError;
              }
            }

            telemetryTokenUsage += tokensUsed;

            if (sceneData.enoughContext) {
              finalSceneJson = sceneData;
              contextAccepted = true;
              break;
            } else {
              expansionAttempts++;
              currentExpansionWords += EXTRACTOR_CONFIG.EXPANSION_WORD_COUNT;
              if (currentExpansionWords > EXTRACTOR_CONFIG.MAX_EXPANSION_LIMIT) {
                finalSceneJson = sceneData;
                contextAccepted = false;
                break;
              }
            }
          }

          if (!finalSceneJson) {
            throw new Error('Pipeline failed during scene extraction.');
          }

          // --- PIPELINE STEP 2: Prompt Builder ---
          const finalPrompt = buildPrompt(finalSceneJson, taskStyle);
          const textHash = hashString(finalExtractedWindow);

          // Update task to generating_image
          set((state) => ({
            generationQueue: state.generationQueue.map((t) =>
              t.id === taskId
                ? { ...t, status: 'generating_image' as const, sceneJson: finalSceneJson, finalPrompt }
                : t
            ),
            ...(get().currentPage === taskPage
              ? {
                  generationStatus: 'generating_image',
                  extractedWindow: finalExtractedWindow,
                  extractedScene: finalSceneJson,
                }
              : {})
          }));

          // --- PIPELINE STEP 3: Image Generation ---
          let generatedImageUrl = '';
          const imagePayload = { prompt: finalPrompt };

          try {
            const imageRes = await fetch('/api/generate-image', {
              method: 'POST',
              headers: requestHeaders,
              body: JSON.stringify(imagePayload),
            });
            const imageRawText = await imageRes.text();
            let imageData;
            try {
              imageData = JSON.parse(imageRawText);
            } catch (parseErr: any) {
              throw new Error(`Failed to parse image generation response (Status ${imageRes.status}).`);
            }
            if (!imageRes.ok) {
              throw new Error(imageData.error || `Server error during image generation (Status ${imageRes.status}).`);
            }
            generatedImageUrl = imageData.imageUrl;
          } catch (serverError: any) {
            if (apiKeys?.gemini) {
              generatedImageUrl = await clientGenerateImage(finalPrompt, apiKeys.gemini);
            } else {
              throw serverError;
            }
          }

          // Save to IndexedDB cache
          const now = Date.now();
          const cacheKey = generateCacheKey(fileHash, taskPage, finalExtractedWindow, taskStyle, now);
          const cacheEntry: CacheEntry = {
            key: cacheKey,
            bookHash: fileHash,
            currentPage: taskPage,
            textHash,
            sceneJson: finalSceneJson,
            selectedStyle: taskStyle,
            imageUrl: generatedImageUrl,
            generatedAt: now,
          };
          await ImageCache.set(cacheEntry);

          const pipelineDuration = Date.now() - pipelineStart;

          // Update state
          set((state) => {
            const updatedQueue = state.generationQueue.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: 'success' as const,
                    imageUrl: generatedImageUrl,
                    completedAt: now,
                    cacheKey,
                  }
                : t
            );
            const updatedAll = [
              ...state.allBookImages.filter((e) => e.key !== cacheKey),
              cacheEntry,
            ];

            const isUserOnThisPage = state.currentPage === taskPage;
            if (isUserOnThisPage) {
              const updatedCached = [
                ...state.cachedImages.filter((e) => e.key !== cacheKey),
                cacheEntry,
              ];
              return {
                generationQueue: updatedQueue,
                allBookImages: updatedAll,
                cachedImages: updatedCached,
                activeCacheKey: cacheKey,
                imageUrl: generatedImageUrl,
                selectedStyle: taskStyle,
                generationStatus: 'success',
                generatedAt: new Date(now).toLocaleTimeString(),
                telemetry: {
                  currentPage: taskPage,
                  windowSize: countWords(finalExtractedWindow),
                  expansionAttempts,
                  contextAccepted,
                  sceneJson: finalSceneJson,
                  finalPrompt,
                  cacheHit: false,
                  generationTimeMs: pipelineDuration,
                  approxTokenUsage: telemetryTokenUsage,
                },
              };
            } else {
              // User has navigated to another page while background generation was in flight
              return {
                generationQueue: updatedQueue,
                allBookImages: updatedAll,
              };
            }
          });
        } catch (err: any) {
          console.error(`Queue task ${taskId} error:`, err);
          set((state) => ({
            generationQueue: state.generationQueue.map((t) =>
              t.id === taskId ? { ...t, status: 'failed' as const, error: err.message } : t
            ),
            ...(state.currentPage === taskPage
              ? {
                  generationStatus: 'failed',
                  error: err.message || 'Error generating illustration',
                }
              : {})
          }));
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  };

  return {
    // State
    fileHash: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    extractedWindow: '',
    extractedScene: null,
    selectedStyle: 'Dark & Epic Fantasy',
    imageUrl: null,
    generationStatus: 'idle',
    generatedAt: null,
    telemetry: null,
    error: null,
    apiKeys: getInitialApiKeys(),
    chapters: [],
    cachedImages: [],
    allBookImages: [],
    generationQueue: [],
    activeCacheKey: null,
    showLastImageOnPageChange: getInitialSettings().showLastImageOnPageChange,
    showDeveloperTelemetry: getInitialSettings().showDeveloperTelemetry,
    windowSize: getInitialSettings().windowSize,
    pdfZoom: getInitialSettings().pdfZoom,
    epubFontSize: getInitialSettings().epubFontSize,
    documentType: null,

    // Private states not exposed directly in AppState
    pageTexts: [] as string[],

    // Actions
    loadAllBookImages: async () => {
      const { fileHash } = get();
      if (!fileHash) return;
      const all = await ImageCache.getAllForBook(fileHash);
      set({ allBookImages: all });
    },

    setPdfZoom: (zoom) => {
      const clamped = Math.max(50, Math.min(250, Math.round(zoom)));
      try {
        localStorage.setItem('visual_reader_pdf_zoom', String(clamped));
      } catch (e) {
        console.error(e);
      }
      set({ pdfZoom: clamped });
    },

    setEpubFontSize: (size) => {
      const clamped = Math.max(50, Math.min(250, Math.round(size)));
      try {
        localStorage.setItem('visual_reader_epub_font_size', String(clamped));
      } catch (e) {
        console.error(e);
      }
      set({ epubFontSize: clamped });
    },

    setDocumentType: (type) => {
      set({ documentType: type });
    },

    setWindowSize: (size) => {
      const clamped = Math.max(0, Math.min(5, Math.floor(size) || 0));
      try {
        localStorage.setItem('visual_reader_window_size', String(clamped));
      } catch (e) {
        console.error(e);
      }
      set({ windowSize: clamped });
    },

    setShowLastImageOnPageChange: (enabled) => {
      try {
        localStorage.setItem('visual_reader_show_last_image', String(enabled));
      } catch (e) {
        console.error(e);
      }
      set({ showLastImageOnPageChange: enabled });
    },

    setShowDeveloperTelemetry: (enabled) => {
      try {
        localStorage.setItem('visual_reader_show_telemetry', String(enabled));
      } catch (e) {
        console.error(e);
      }
      set({ showDeveloperTelemetry: enabled });
    },

    setApiKeys: (keys) => {
      try {
        localStorage.setItem('visual_reader_api_keys', JSON.stringify(keys));
      } catch (e) {
        console.error(e);
      }
      set({ apiKeys: keys });
    },

    setPageTexts: async (texts, fileName, fileHash, chapters = []) => {
      const isPdf = Boolean((window as any).__CURRENT_PDF_DOC__) || (fileName ? fileName.toLowerCase().endsWith('.pdf') : false);
      const isEpub = fileName ? fileName.toLowerCase().endsWith('.epub') : false;
      const documentType = isPdf ? 'pdf' : (isEpub ? 'epub' : 'text');

      set({
        pageTexts: texts,
        fileName,
        fileHash,
        documentType,
        chapters: chapters || [],
        currentPage: 1,
        totalPages: texts.length,
        extractedWindow: '',
        extractedScene: null,
        imageUrl: null,
        generationStatus: 'idle',
        generatedAt: null,
        telemetry: null,
        error: null,
        cachedImages: [],
        allBookImages: [],
        generationQueue: [],
        activeCacheKey: null,
      });

      // Load all cached visualizations for this book
      if (fileHash) {
        const allEntries = await ImageCache.getAllForBook(fileHash);
        set({ allBookImages: allEntries });

        // Check page 1
        if (texts.length > 0) {
          const page1Entries = allEntries.filter((e) => e.currentPage === 1);
          if (page1Entries.length > 0) {
            const selectedStyle = get().selectedStyle;
            const matching = page1Entries.find((e) => e.selectedStyle === selectedStyle) || page1Entries[page1Entries.length - 1];
            set({
              cachedImages: page1Entries,
              activeCacheKey: matching.key,
              imageUrl: matching.imageUrl,
              selectedStyle: matching.selectedStyle as ArtStyle,
              generationStatus: 'success',
              generatedAt: new Date(matching.generatedAt).toLocaleTimeString(),
              telemetry: {
                currentPage: 1,
                windowSize: 0,
                expansionAttempts: 0,
                contextAccepted: true,
                sceneJson: matching.sceneJson,
                finalPrompt: buildPrompt(matching.sceneJson, matching.selectedStyle as ArtStyle),
                cacheHit: true,
                generationTimeMs: 0,
                approxTokenUsage: 0,
              }
            });
          }
        }
      }
    },

    setCurrentPage: async (page) => {
      const { totalPages, currentPage, selectedStyle, fileHash, pageTexts, imageUrl: prevImageUrl, showLastImageOnPageChange, generationQueue } = get();
      if (page < 1 || page > totalPages || page === currentPage) return;
      
      // Check if there is an active/queued task for this exact page
      const activeTask = generationQueue.find(
        (t) => t.page === page && (t.status === 'queued' || t.status === 'extracting_scene' || t.status === 'generating_image')
      );

      set({
        currentPage: page,
        error: null,
        imageUrl: showLastImageOnPageChange ? prevImageUrl : null,
        generationStatus: activeTask
          ? (activeTask.status === 'queued' ? 'extracting_scene' : activeTask.status)
          : 'idle',
        telemetry: null,
        cachedImages: [],
        activeCacheKey: null
      });
      
      // Check if we already have cached visualizations for this page
      if (fileHash && pageTexts.length > 0) {
        const pageEntries = await ImageCache.getForPage(fileHash, page);
        if (pageEntries.length > 0) {
          const exactMatching = pageEntries.find(e => e.selectedStyle === selectedStyle);
          const matching = exactMatching || pageEntries[pageEntries.length - 1];
          if (!activeTask) {
            set({
              cachedImages: pageEntries,
              activeCacheKey: matching.key,
              imageUrl: matching.imageUrl,
              // Only sync selectedStyle if exact match is found; never clobber the user's selected dropdown choice
              selectedStyle: exactMatching ? (exactMatching.selectedStyle as ArtStyle) : get().selectedStyle,
              generationStatus: 'success',
              generatedAt: new Date(matching.generatedAt).toLocaleTimeString(),
              telemetry: {
                currentPage: page,
                windowSize: 0,
                expansionAttempts: 0,
                contextAccepted: true,
                sceneJson: matching.sceneJson,
                finalPrompt: buildPrompt(matching.sceneJson, matching.selectedStyle as ArtStyle),
                cacheHit: true,
                generationTimeMs: 0,
                approxTokenUsage: 0,
              }
            });
          } else {
            set({ cachedImages: pageEntries });
          }
        }
      }
    },

    setSelectedStyle: async (style) => {
      if (style === get().selectedStyle) return;
      const { fileHash, currentPage, cachedImages, imageUrl: prevImageUrl, showLastImageOnPageChange, generationQueue } = get();
      
      // Check if there is an active task for this page & style
      const activeTask = generationQueue.find(
        (t) => t.page === currentPage && t.style === style && (t.status === 'queued' || t.status === 'extracting_scene' || t.status === 'generating_image')
      );

      // Check if we already have a cached image for this style on the current page
      const pageEntries = fileHash ? await ImageCache.getForPage(fileHash, currentPage) : cachedImages;
      const matching = pageEntries.find(e => e.selectedStyle === style);
      if (matching) {
        set({
          selectedStyle: style,
          cachedImages: pageEntries,
          activeCacheKey: matching.key,
          imageUrl: matching.imageUrl,
          generationStatus: 'success',
          generatedAt: new Date(matching.generatedAt).toLocaleTimeString(),
          telemetry: {
            currentPage,
            windowSize: 0,
            expansionAttempts: 0,
            contextAccepted: true,
            sceneJson: matching.sceneJson,
            finalPrompt: buildPrompt(matching.sceneJson, style),
            cacheHit: true,
            generationTimeMs: 0,
            approxTokenUsage: 0,
          }
        });
      } else {
        set({
          selectedStyle: style,
          cachedImages: pageEntries,
          error: null,
          imageUrl: showLastImageOnPageChange ? prevImageUrl : null,
          generationStatus: activeTask
            ? (activeTask.status === 'queued' ? 'extracting_scene' : activeTask.status)
            : 'idle',
          telemetry: null,
          activeCacheKey: null
        });
      }
    },

    selectCachedImage: (key: string) => {
      const { cachedImages } = get();
      const entry = cachedImages.find((c) => c.key === key);
      if (!entry) return;

      set({
        activeCacheKey: entry.key,
        imageUrl: entry.imageUrl,
        selectedStyle: entry.selectedStyle as ArtStyle,
        generationStatus: 'success',
        generatedAt: new Date(entry.generatedAt).toLocaleTimeString(),
        telemetry: {
          currentPage: entry.currentPage,
          windowSize: 0,
          expansionAttempts: 0,
          contextAccepted: true,
          sceneJson: entry.sceneJson,
          finalPrompt: buildPrompt(entry.sceneJson, entry.selectedStyle as ArtStyle),
          cacheHit: true,
          generationTimeMs: 0,
          approxTokenUsage: 0,
        }
      });
    },

    selectBookImage: async (entry: CachedImageItem) => {
      const { fileHash } = get();
      if (!fileHash) return;

      const pageEntries = await ImageCache.getForPage(fileHash, entry.currentPage);

      set({
        currentPage: entry.currentPage,
        cachedImages: pageEntries.length > 0 ? pageEntries : [entry],
        activeCacheKey: entry.key,
        imageUrl: entry.imageUrl,
        selectedStyle: entry.selectedStyle as ArtStyle,
        generationStatus: 'success',
        generatedAt: new Date(entry.generatedAt).toLocaleTimeString(),
        error: null,
        telemetry: {
          currentPage: entry.currentPage,
          windowSize: 0,
          expansionAttempts: 0,
          contextAccepted: true,
          sceneJson: entry.sceneJson,
          finalPrompt: buildPrompt(entry.sceneJson, entry.selectedStyle as ArtStyle),
          cacheHit: true,
          generationTimeMs: 0,
          approxTokenUsage: 0,
        }
      });
    },

    clearCache: async () => {
      const { fileHash } = get();
      if (!fileHash) return;
      await ImageCache.clearForBook(fileHash);
      set({
        cachedImages: [],
        allBookImages: [],
        generationQueue: [],
        activeCacheKey: null,
        imageUrl: null,
        generationStatus: 'idle',
        telemetry: null
      });
    },

    resetStore: () => {
      (window as any).__CURRENT_PDF_DOC__ = null;
      set({
        fileHash: null,
        fileName: null,
        documentType: null,
        currentPage: 1,
        totalPages: 0,
        extractedWindow: '',
        extractedScene: null,
        selectedStyle: 'Dark & Epic Fantasy',
        imageUrl: null,
        generationStatus: 'idle',
        generatedAt: null,
        telemetry: null,
        error: null,
        pageTexts: [],
        chapters: [],
        cachedImages: [],
        allBookImages: [],
        generationQueue: [],
        activeCacheKey: null,
      });
    },

    generateVisualization: async (forceRegenerate = false, targetPage?: number, targetStyle?: ArtStyle) => {
      const { pageTexts, currentPage, selectedStyle, fileHash, generationQueue } = get();
      if (pageTexts.length === 0 || !fileHash) return;

      const page = targetPage !== undefined ? targetPage : currentPage;
      const style = targetStyle !== undefined ? targetStyle : selectedStyle;

      // Check if there is already an active or queued generation task for this exact page and style
      const existingTask = generationQueue.find(
        (t) =>
          t.page === page &&
          t.style === style &&
          (t.status === 'queued' || t.status === 'extracting_scene' || t.status === 'generating_image')
      );

      if (existingTask) {
        // Already queued or generating in background
        return;
      }

      // If not forceRegenerate, check if an image for this style already exists in cache
      if (!forceRegenerate) {
        const pageEntries = await ImageCache.getForPage(fileHash, page);
        const existingForStyle = pageEntries.find((e) => e.selectedStyle === style);
        if (existingForStyle) {
          if (get().currentPage === page) {
            set({
              cachedImages: pageEntries,
              activeCacheKey: existingForStyle.key,
              imageUrl: existingForStyle.imageUrl,
              selectedStyle: style,
              generationStatus: 'success',
              generatedAt: new Date(existingForStyle.generatedAt).toLocaleTimeString(),
              telemetry: {
                currentPage: page,
                windowSize: 0,
                expansionAttempts: 0,
                contextAccepted: true,
                sceneJson: existingForStyle.sceneJson,
                finalPrompt: buildPrompt(existingForStyle.sceneJson, style),
                cacheHit: true,
                generationTimeMs: 0,
                approxTokenUsage: 0,
              }
            });
          }
          return;
        }
      }

      // Create new generation task and push to queue
      const taskId = `${fileHash}_p${page}_s${hashString(style)}_${Date.now()}`;
      const newTask: GenerationTask = {
        id: taskId,
        bookHash: fileHash,
        page,
        style,
        status: 'queued',
        createdAt: Date.now(),
      };

      set((state) => ({
        generationQueue: [...state.generationQueue, newTask],
        ...(state.currentPage === page ? { generationStatus: 'extracting_scene', error: null } : {})
      }));

      // Trigger background queue processing
      processQueue();
    }
  };
});
