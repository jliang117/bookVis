import { ArtStyle } from '../../types';

export const STYLE_MODIFIERS: Record<ArtStyle, string> = {
  'Dark & Epic Fantasy': 'A masterwork epic dark fantasy book illustration, atmospheric mist, mysterious magical glowing runes and particles, intricate armor and ornamental details, heroic legendary scale, moody chiaroscuro contrast.',
  'Cinematic Realism': 'A dramatic cinematic 35mm movie still, ultra-detailed photorealistic textures, atmospheric volumetric shafts of light, cinematic depth of field, blockbuster production design, rich color grading.',
  'Anime & Ghibli': 'An enchanting hand-painted anime key visual reminiscent of Studio Ghibli, rich watercolor and gouache background scenery, lush foliage, warm nostalgic golden-hour lighting, crisp expressive linework.',
  'Oil Painting': 'A masterfully crafted classical oil on canvas painting, rich impasto brushstrokes, dramatic Rembrandt chiaroscuro lighting with deep shadows and luminous highlights, visible fine art linen texture.',
  'Watercolor': 'A delicate, expressive watercolor painting, soft translucent washes, organic pigment blooms, elegant fluid ink contours, deckled cold-pressed cotton paper texture, dreamlike atmospheric quality.',
  'Comic Book & Graphic Novel': 'A dynamic modern graphic novel panel, bold stylized ink outlines, fine cross-hatching and halftone dot screen textures, high-contrast cell shading, expressive punchy colors.',
  'Children\'s Storybook': 'A charming whimsical children\'s storybook illustration, soft cozy pastel palette, gentle textured gouache and colored pencil strokes, friendly rounded shapes, full of wonder and warmth.',
  'Pixel Art (16-Bit)': 'A crisp, high-detail 16-bit retro pixel art scene, deliberate dithered shading, vibrant nostalgic color palette, atmospheric SNES/PC-98 adventure game aesthetic.',
  'Vintage Woodcut & Engraving': 'An antique 19th-century Victorian book engraving, intricate hand-carved woodcut and linocut lines, fine dense cross-hatching, monochrome sepia ink on aged parchment paper.',
  'Stained Glass & Mosaic': 'A luminous cathedral stained glass window and intricate tesserae mosaic, glowing radiant jewel tones, bold black lead came contours, vibrant light refraction and prismatic glow.',
  'Claymation & Stop-Motion': 'A tactile handmade stop-motion clay animation set, sculpted plasticine clay figures with subtle artisan fingerprint textures, physical miniature diorama, warm studio spot lighting, shallow macro depth of field.',
  'Ukiyo-e Woodblock': 'A traditional Japanese Edo-period Ukiyo-e woodblock print, elegant sweeping calligraphic outlines, flat mineral pigment color blocks, delicate washi paper grain, reminiscent of Hokusai and Hiroshige.',
  'Papercraft Diorama': 'A multi-layered cut paper shadowbox diorama, textured cardstock crafts with dimensional stacked paper layers, realistic cast drop shadows between levels, warm soft backlit illumination.',
  'Cyberpunk & Neon': 'A futuristic cyberpunk sci-fi scene, neon-drenched night rain, glowing holographic signs, wet asphalt reflections, high-tech dystopian details, vivid cyan and magenta contrast.',
  'Film Noir': 'A classic 1940s black-and-white film noir still, dramatic Venetian blind shadow patterns, rainy smoke-filled alley, high-contrast chiaroscuro, mysterious brooding atmosphere.',
  'Impressionist': 'An impressionist oil painting with thick, rapid impasto palette knife strokes, capturing the lively play of natural light, rich unblended color dabs, expressive artistic movement.',
  'Concept Art': 'A professional sci-fi and fantasy video game concept art speedpaint, majestic wide-angle environmental scale, dynamic brushwork, dramatic atmospheric perspective.'
};

/**
 * Returns the prompt modifier for a given style name
 */
export function getStyleModifier(style: ArtStyle): string {
  return STYLE_MODIFIERS[style] || STYLE_MODIFIERS['Dark & Epic Fantasy'];
}

