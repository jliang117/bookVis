/**
 * Unified types for the AI Book Visualizer
 */

export interface SceneJSON {
  enoughContext: boolean;
  scene?: {
    location: string;
    time: string;
    lighting: string;
    weather: string;
    mood: string;
    characters: string[];
    importantObjects: string[];
    action: string;
    visualDetails: string[];
    cameraFocus: string;
    styleNotes: string[];
  };
}

export type ArtStyle =
  | 'Realistic'
  | 'Studio Ghibli'
  | 'Oil Painting'
  | 'Watercolor'
  | 'Anime'
  | 'Dark Fantasy'
  | 'Comic Book'
  | 'Children\'s Book'
  | 'Pixel Art'
  | 'Cinematic'
  | 'Concept Art'
  | 'Impressionist'
  | 'Noir'
  | 'Cyberpunk'
  | 'Fantasy Illustration';

export type GenerationStatus = 'idle' | 'extracting_scene' | 'generating_image' | 'success' | 'failed';

export interface DeveloperTelemetry {
  currentPage: number;
  windowSize: number;
  expansionAttempts: number;
  contextAccepted: boolean;
  sceneJson: SceneJSON | null;
  finalPrompt: string;
  cacheHit: boolean;
  generationTimeMs: number;
  approxTokenUsage: number;
}

export interface AppState {
  fileHash: string | null;
  fileName: string | null;
  currentPage: number;
  totalPages: number;
  extractedWindow: string;
  extractedScene: SceneJSON | null;
  selectedStyle: ArtStyle;
  imageUrl: string | null;
  generationStatus: GenerationStatus;
  generatedAt: string | null;
  telemetry: DeveloperTelemetry | null;
  error: string | null;
  pageTexts: string[];
}
