import { ArtStyle } from '../../types';

export const STYLE_MODIFIERS: Record<ArtStyle, string> = {
  'Realistic': 'A highly detailed, photorealistic digital photograph, 8k resolution, dramatic natural lighting, highly detailed textures, realistic skin and clothing, sharp focus, volumetric depth.',
  'Studio Ghibli': 'An enchanting hand-painted anime style reminiscent of Studio Ghibli backgrounds, soft watercolor and gouache textures, lush detailed foliage, warm nostalgic lighting, whimsical and highly detailed.',
  'Oil Painting': 'A masterfully crafted oil on canvas painting, rich thick brushstrokes, dramatic chiaroscuro lighting with deep shadows and warm highlights, classical fine art style, visible canvas texture.',
  'Watercolor': 'A delicate, expressive watercolor painting, soft color washes, beautiful organic pigment blooms, elegant fluid lines, clean paper texture, dreamlike atmospheric quality.',
  'Anime': 'A gorgeous high-quality modern anime key visual illustration, vibrant colors, clean crisp lines, cinematic lighting, dramatic shading, detailed background elements.',
  'Dark Fantasy': 'A dark, brooding gothic fantasy illustration, eerie atmospheric fog, deep rich shadows, mysterious magical glowing runes, intricate details, moody and intense.',
  'Comic Book': 'A dynamic graphic novel comic book panel, bold clean ink outline, hand-drawn hatching textures, high contrast cell shading, vibrant stylized colors.',
  'Children\'s Book': 'A whimsical children\'s book illustration, charming characters, soft cozy color palette, gentle hand-painted textures, clean friendly shapes, full of warmth and magic.',
  'Pixel Art': 'A detailed, high-quality 16-bit pixel art scene, vibrant color palette, crisp deliberate pixel placement, retro game background aesthetic, gorgeous atmospheric shading.',
  'Cinematic': 'A dramatic cinematic movie still, anamorphic widescreen 16:9, volumetric shafts of light, cinematic color grading, rich textures, shallow depth of field, blockbuster production design.',
  'Concept Art': 'A professional video game concept art illustration, majestic scale, dramatic atmospheric perspective, speedpaint brushwork, epic lighting, highly imaginative setting.',
  'Impressionist': 'An impressionist painting with thick, rapid impasto brushstrokes, capturing the vibrant play of light and shadow, rich unblended color details, expressive and artistic.',
  'Noir': 'A classic 1940s film noir style, monochrome black and white, dramatic high-contrast chiaroscuro shadows, wet rain-slicked streets reflecting dim lights, moody and mysterious.',
  'Cyberpunk': 'A futuristic cyberpunk scene, neon-drenched night streets, glowing holographic signs, wet street reflections, high-tech details, atmospheric rain, purple and cyan color accents.',
  'Fantasy Illustration': 'A classic epic fantasy book cover illustration, magical particle effects, glowing elements, intricate ornamental details, heroic scale, legendary and wondrous atmosphere.'
};

/**
 * Returns the prompt modifier for a given style name
 */
export function getStyleModifier(style: ArtStyle): string {
  return STYLE_MODIFIERS[style] || STYLE_MODIFIERS['Fantasy Illustration'];
}
