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

// Helper function to extract scene directly from browser using Gemini API
async function clientExtractScene(text: string, apiKey: string): Promise<SceneJSON> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Please analyze this book excerpt and extract visual descriptors for scene rendering:\n\n"""\n${text}\n"""`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: `You are an expert literary scene visualizer. Your task is to analyze a book excerpt and extract the detailed visual elements needed to generate a high-fidelity, accurate illustration of the current scene. 

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
                description: 'What should be the main focal point or composition style? (e.g. Close-up on the wooden box, medium shot of Elizabeth with the bookshelves)'
              },
              styleNotes: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: "Additional notes about the physical environment or composition structure (e.g. ['high ceilinged room', 'shadowy corners'])"
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

        let sceneData: SceneJSON;
        let tokensUsed = 0;

        try {
          const payload = { text };
          console.log('[CLIENT DEBUG] Sending scene extraction payload:', JSON.stringify(payload, null, 2));
          
          const extractRes = await fetch('/api/extract-scene', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(payload),
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

          sceneData = extractData.data;
          tokensUsed = extractData.approxTokens || 0;

        } catch (serverError: any) {
          console.warn('[CLIENT WARNING] Server scene extraction failed or returned error. Checking direct client fallback...', serverError);
          
          if (apiKeys?.gemini) {
            console.log('[CLIENT DEBUG] Fallback: Performing scene extraction directly from browser with client Gemini API key...');
            try {
              sceneData = await clientExtractScene(text, apiKeys.gemini);
              tokensUsed = Math.ceil(text.length / 4) + 500;
            } catch (clientErr: any) {
              console.error('[CLIENT ERROR] Direct client scene extraction failed as well:', clientErr);
              throw new Error(`Scene extraction failed: Server error (${serverError.message}) AND Direct Client Fallback error (${clientErr.message})`);
            }
          } else {
            if (serverError.message.includes('Status 405') || serverError.message.includes('Method Not Allowed') || serverError.message.includes('405')) {
              throw new Error(`Visualization Pipeline Error: Cloudflare/static environment detected (Method Not Allowed 405).\n\nTo run the applet on this custom hosting domain, please configure your own Gemini API Key in the top-right 'API Keys' modal!`);
            }
            throw serverError;
          }
        }

        telemetryTokenUsage += tokensUsed;

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

      let generatedImageUrl = '';
      const imagePayload = { prompt: finalPrompt };

      try {
        console.log('[CLIENT DEBUG] Sending image generation payload:', JSON.stringify(imagePayload, null, 2));

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

        generatedImageUrl = imageData.imageUrl;

      } catch (serverError: any) {
        console.warn('[CLIENT WARNING] Server image generation failed or returned error. Checking direct client fallback...', serverError);

        if (apiKeys?.gemini) {
          console.log('[CLIENT DEBUG] Fallback: Generating image directly from browser with client Gemini API key...');
          try {
            generatedImageUrl = await clientGenerateImage(finalPrompt, apiKeys.gemini);
          } catch (clientErr: any) {
            console.error('[CLIENT ERROR] Direct client image generation failed as well:', clientErr);
            throw new Error(`Image generation failed: Server error (${serverError.message}) AND Direct Client Fallback error (${clientErr.message})`);
          }
        } else {
          if (serverError.message.includes('Status 405') || serverError.message.includes('Method Not Allowed') || serverError.message.includes('405')) {
            throw new Error(`Visualization Pipeline Error: Cloudflare/static environment detected (Method Not Allowed 405).\n\nTo run the applet on this custom hosting domain, please configure your own Gemini API Key in the top-right 'API Keys' modal!`);
          }
          throw serverError;
        }
      }

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
