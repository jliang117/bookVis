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
  | 'Dark & Epic Fantasy'
  | 'Cinematic Realism'
  | 'Anime & Ghibli'
  | 'Oil Painting'
  | 'Watercolor'
  | 'Comic Book & Graphic Novel'
  | 'Children\'s Storybook'
  | 'Pixel Art (16-Bit)'
  | 'Vintage Woodcut & Engraving'
  | 'Stained Glass & Mosaic'
  | 'Claymation & Stop-Motion'
  | 'Ukiyo-e Woodblock'
  | 'Papercraft Diorama'
  | 'Cyberpunk & Neon'
  | 'Film Noir'
  | 'Impressionist'
  | 'Concept Art';

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

export interface ApiKeys {
  gemini: string;
  [key: string]: string;
}

export interface ChapterInfo {
  title: string;
  startPage: number;
  endPage: number;
}

export interface CachedImageItem {
  key: string;
  bookHash: string;
  currentPage: number;
  textHash: string;
  sceneJson: any;
  selectedStyle: string;
  imageUrl: string;
  generatedAt: number;
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
  chapters?: ChapterInfo[];
  apiKeys: ApiKeys;
  cachedImages: CachedImageItem[];
  activeCacheKey: string | null;
  showLastImageOnPageChange: boolean;
  showDeveloperTelemetry: boolean;
  windowSize: number;
}
