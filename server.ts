import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase request size limits for handling large book texts
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Lazy initializer for GoogleGenAI client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
      );
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Structured response schema for scene extraction matching the user request
const sceneExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    enoughContext: {
      type: Type.BOOLEAN,
      description: 'True if there is sufficient descriptive, narrative, or environmental detail in the text to create a vivid visual scene. False if the text is too brief, highly abstract, purely conversational, or lacks any concrete visual/environmental markers to anchor an illustration.'
    },
    scene: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'Where does this scene take place? (e.g. Victorian library, damp forest, high-tech control room)'
        },
        time: {
          type: Type.STRING,
          description: 'What time of day or time period is it? (e.g. sunset, late night, medieval era, dawn)'
        },
        lighting: {
          type: Type.STRING,
          description: 'How is the scene illuminated? (e.g. warm candlelight, harsh fluorescent light, shafts of golden sunlight)'
        },
        weather: {
          type: Type.STRING,
          description: 'What is the weather outside or ambient conditions? (e.g. heavy rain, dense fog, clear starry night)'
        },
        mood: {
          type: Type.STRING,
          description: 'What mood or emotional tone should the illustration convey? (e.g. tense anticipation, cozy serenity, melancholic isolation, grand wonder)'
        },
        characters: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of characters present, including descriptions of their appearance, clothing, and posture if mentioned (e.g., ['Elizabeth: mid-20s, dark coat, tense posture', 'An old librarian: silver hair, dusty suit'])"
        },
        importantObjects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Objects that are central to the action or setting (e.g., ['A half-opened wooden box with a glowing gemstone', 'Dusty leather-bound grimoire'])"
        },
        action: {
          type: Type.STRING,
          description: 'What specific action or event is occurring in this moment? (e.g., Elizabeth is sliding a secret shelf aside)'
        },
        visualDetails: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific textural, color-related, or background visual details (e.g., ['Motes of dust dancing in light shafts', 'Flaking gold leaf on book spines'])"
        },
        cameraFocus: {
          type: Type.STRING,
          description: 'What should be the main focal point or composition style? (e.g. Close-up on the wooden box, medium shot of Elizabeth with the bookshelves)'
        },
        styleNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Additional notes about the physical environment or composition structure (e.g. ['high ceilinged room', 'shadowy corners'])"
        }
      },
      required: [
        'location', 'time', 'lighting', 'weather', 'mood', 'characters', 'importantObjects', 'action', 'visualDetails', 'cameraFocus', 'styleNotes'
      ]
    }
  },
  required: ['enoughContext']
};

// --- API ROUTES ---

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Scene Extraction Endpoint
 * Takes book text snippet and extracts structured visual details using Gemini
 */
app.post('/api/extract-scene', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text content is required for scene extraction.' });
  }

  const startTime = Date.now();

  try {
    const ai = getAiClient();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Please analyze this book excerpt and extract visual descriptors for scene rendering:\n\n"""\n${text}\n"""`,
      config: {
        systemInstruction: `You are an expert literary scene visualizer. Your task is to analyze a book excerpt and extract the detailed visual elements needed to generate a high-fidelity, accurate illustration of the current scene. 

You must strictly evaluate if there is "enoughContext" (e.g. setting description, physical environment, character action, or visual markers). Set "enoughContext" to true ONLY if there is sufficient descriptive detail to create a vivid visual scene. If the text is too brief, highly abstract, purely conversational, or lacks any concrete visual/environmental markers to anchor an illustration, set "enoughContext" to false.

Be extremely descriptive in your visual details, clothing description, posture, and environmental atmosphere. Do not assume or hallucinate features not hinted at in the text. Ensure output is in strict JSON conforming to the schema.`,
        responseMimeType: 'application/json',
        responseSchema: sceneExtractionSchema,
      }
    });

    const duration = Date.now() - startTime;
    const responseText = response.text || '{}';
    const parsedScene = JSON.parse(responseText.trim());

    return res.json({
      success: true,
      data: parsedScene,
      timeMs: duration,
      approxTokens: Math.ceil(text.length / 4) + 500 // rough estimate for telemetry
    });

  } catch (error: any) {
    console.error('Scene extraction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract scene context using Gemini.'
    });
  }
});

/**
 * Image Generation Endpoint
 * Takes prompt and generates an image using gemini-3.1-flash-image
 */
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is required for image generation.' });
  }

  const startTime = Date.now();

  try {
    const ai = getAiClient();

    // Use gemini-3.1-flash-image which supports high-quality 1K images
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9', // Wide screen layout fits beside reader beautifully
          imageSize: '1K',
        },
      },
    });

    const duration = Date.now() - startTime;
    
    let imageUrl: string | null = null;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error('Image model did not return any inline image data.');
    }

    return res.json({
      success: true,
      imageUrl,
      timeMs: duration,
    });

  } catch (error: any) {
    console.error('Image generation error:', error);
    
    // Check for specific error types (e.g. paid API key / model permissions)
    let userFriendlyError = error.message || 'Failed to generate image using Gemini.';
    if (userFriendlyError.includes('quota') || userFriendlyError.includes('permission') || userFriendlyError.includes('api key')) {
      userFriendlyError = 'Could not access the image generation model. Please ensure you have set up a valid Gemini API Key in Settings > Secrets. Note: Some advanced visual models require a paid-tier key or specific billing config.';
    }

    return res.status(500).json({
      success: false,
      error: userFriendlyError,
    });
  }
});

// --- CLIENT AND VITE MIDDLEWARE INTEGRATION ---

async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite in middleware mode for seamless development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Server failed to start:', err);
});
