import { SceneJSON, ArtStyle } from '../../types';
import { getStyleModifier } from './styles';

/**
 * Filters and sanitizes style notes to ensure they do not contradict the selected art style.
 */
export function filterStyleNotes(notes: string[] | undefined, targetStyle: ArtStyle): string[] {
  if (!notes || !Array.isArray(notes)) return [];

  // Patterns that directly contradict specific art styles
  const conflictPatterns: { [key in ArtStyle]?: RegExp } = {
    'Anime & Ghibli': /\b(photoreal|35mm|photograph|oil impasto|chiaroscuro|heavy impasto|3d render|hyperrealistic)\b/i,
    'Watercolor': /\b(photoreal|35mm|photograph|pixel art|vector cartoon|3d render|cgi|hyperrealistic)\b/i,
    'Pixel Art (16-Bit)': /\b(photoreal|35mm|photograph|watercolor wash|oil impasto|hyperrealistic|3d render|smooth brush)\b/i,
    'Cinematic Realism': /\b(anime|cartoon|pixel art|stained glass|woodcut|claymation|papercraft)\b/i,
    'Oil Painting': /\b(pixel art|vector|anime|photograph|35mm film|3d render|cgi)\b/i,
    'Children\'s Storybook': /\b(photoreal|35mm|gritty realism|hyperrealistic|noir)\b/i,
    'Comic Book & Graphic Novel': /\b(photoreal|35mm photograph|oil painting|fine art linen)\b/i,
    'Vintage Woodcut & Engraving': /\b(photoreal|35mm|anime|neon glow|cyberpunk|vibrant rainbow)\b/i,
    'Claymation & Stop-Motion': /\b(photoreal|2d anime|pixel art|watercolor wash|oil canvas)\b/i,
    'Stained Glass & Mosaic': /\b(photoreal|35mm|film still|pencil sketch)\b/i,
    'Papercraft Diorama': /\b(photoreal|35mm|oil canvas|anime cel)\b/i,
    'Cyberpunk & Neon': /\b(rustic 19th century|medieval woodcut|traditional oil canvas|sepia parchment)\b/i,
    'Film Noir': /\b(neon rainbow|bright vibrant pastel|anime kawaii|cheerful)\b/i,
    'Impressionist': /\b(pixel art|vector flat|35mm photograph|clean vector)\b/i,
    'Ukiyo-e Woodblock': /\b(photoreal|35mm|3d render|cgi|oil impasto)\b/i,
  };

  const conflictRegex = conflictPatterns[targetStyle];

  return notes
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => {
      if (!n) return false;
      if (conflictRegex && conflictRegex.test(n)) {
        return false;
      }
      return true;
    });
}

/**
 * Builds the final prompt for the image generation model using the structured scene JSON and selected art style
 */
export function buildPrompt(sceneJson: SceneJSON, style: ArtStyle): string {
  if (!sceneJson || !sceneJson.enoughContext || !sceneJson.scene) {
    return `An elegant, highly detailed illustration in ${style} style. Illustrated style: ${getStyleModifier(style)}`;
  }

  const s = sceneJson.scene;
  
  // Format character descriptions if available
  const charactersPart = s.characters && s.characters.length > 0
    ? `Featuring characters: ${s.characters.join(', ')}`
    : '';

  // Format important objects if available
  const objectsPart = s.importantObjects && s.importantObjects.length > 0
    ? `Important elements: ${s.importantObjects.join(', ')}`
    : '';

  // Format visual details
  const detailsPart = s.visualDetails && s.visualDetails.length > 0
    ? `Visual details: ${s.visualDetails.join(', ')}`
    : '';

  // Filter style notes to ensure zero contradictions with the selected art style
  const sanitizedNotes = filterStyleNotes(s.styleNotes, style);
  const notesPart = sanitizedNotes.length > 0
    ? `Style notes (${style}): ${sanitizedNotes.join(', ')}`
    : '';

  // Assemble into a structured description
  const elements = [
    `Scene Location: ${s.location || 'Atmospheric setting'}`,
    s.time ? `Time of day: ${s.time}` : '',
    s.lighting ? `Lighting: ${s.lighting}` : '',
    s.weather ? `Weather & atmosphere: ${s.weather}` : '',
    s.mood ? `Mood: ${s.mood}` : '',
    charactersPart,
    s.action ? `Action occurring: ${s.action}` : '',
    objectsPart,
    detailsPart,
    s.cameraFocus ? `Composition & framing: ${s.cameraFocus}` : '',
  ].filter(Boolean);

  const sceneDescription = elements.join('. ');
  const styleModifier = getStyleModifier(style);

  // Group the selected art style and matching style notes together
  const styleParts = [
    `Illustrated style: ${styleModifier}`,
    notesPart
  ].filter(Boolean);

  // Return the combined prompt
  return `${sceneDescription}. ${styleParts.join('. ')}.`;
}

