import { SceneJSON, ArtStyle } from '../../types';
import { getStyleModifier } from './styles';

/**
 * Builds the final prompt for the image generation model using the structured scene JSON and selected art style
 */
export function buildPrompt(sceneJson: SceneJSON, style: ArtStyle): string {
  if (!sceneJson || !sceneJson.enoughContext || !sceneJson.scene) {
    return `An elegant, highly detailed illustration in ${style} style.`;
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

  // Format visual details and style notes
  const detailsPart = s.visualDetails && s.visualDetails.length > 0
    ? `Visual details: ${s.visualDetails.join(', ')}`
    : '';

  const notesPart = s.styleNotes && s.styleNotes.length > 0
    ? `Composition: ${s.styleNotes.join(', ')}`
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
    s.cameraFocus ? `Camera focus: ${s.cameraFocus}` : '',
    notesPart
  ].filter(Boolean);

  const sceneDescription = elements.join('. ');
  const styleModifier = getStyleModifier(style);

  // Return the combined prompt
  return `${sceneDescription}. Illustrated style: ${styleModifier}`;
}
