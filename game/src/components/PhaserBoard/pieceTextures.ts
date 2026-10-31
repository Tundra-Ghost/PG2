import type { Color } from '@pigeon-chess/game-core';

// Same art as PieceArt: the SVGs colour themselves with CSS variables, which
// a canvas cannot read, so the colours are baked in per side here.
const files = import.meta.glob('../../assets/pieces/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PALETTE: Record<Color, { stroke: string; fill: string; hatch: string; xhatch: string }> = {
  white: { stroke: '#18120a', fill: '#f2ead8', hatch: 'rgba(24,18,10,0.85)', xhatch: '0' },
  black: { stroke: '#c8a870', fill: '#4a3420', hatch: 'rgba(18,12,5,0.7)', xhatch: '1' },
};

export const PIECE_TYPES = Object.keys(files).map(path => path.slice(path.lastIndexOf('/') + 1, -4));

export function pieceTextureKey(type: string, color: Color): string {
  return `piece-${color}-${type}`;
}

/** The SVG of one piece, coloured for one side and sized in pixels. */
export function pieceSvgMarkup(type: string, color: Color, size: number): string | null {
  const entry = Object.entries(files).find(([path]) => path.endsWith(`/${type}.svg`));
  if (!entry) return null;
  const c = PALETTE[color];
  return entry[1]
    .split('currentColor').join(c.stroke)
    .split('var(--pc-fill)').join(c.fill)
    .split('var(--pc-hatch)').join(c.hatch)
    .split('var(--pc-xhatch,0)').join(c.xhatch)
    // Some browsers will not draw an SVG to a canvas without a pixel size.
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
}

/**
 * One piece drawn onto a canvas, ready to become a texture. Resolves null
 * when the browser cannot draw the SVG, so the board can fall back to a glyph.
 */
export function renderPieceCanvas(type: string, color: Color, size: number): Promise<HTMLCanvasElement | null> {
  const svg = pieceSvgMarkup(type, color, size);
  if (!svg) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      // The drop shadow is baked in here rather than added as a WebGL effect.
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = size * 0.05;
      ctx.shadowOffsetY = size * 0.025;
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Text stand-ins for when a piece image fails to load. */
export const PIECE_GLYPHS: Record<string, string> = {
  king: '\u265A', queen: '\u265B', rook: '\u265C', bishop: '\u265D', knight: '\u265E', pawn: '\u265F',
  chancellor: 'C', royal_guard: 'G', pigeon: 'P',
};
