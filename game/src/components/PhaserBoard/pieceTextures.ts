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

/** A data URI of one piece, coloured for one side. */
export function pieceSvgDataUri(type: string, color: Color): string | null {
  const entry = Object.entries(files).find(([path]) => path.endsWith(`/${type}.svg`));
  if (!entry) return null;
  const c = PALETTE[color];
  const svg = entry[1]
    .split('currentColor').join(c.stroke)
    .split('var(--pc-fill)').join(c.fill)
    .split('var(--pc-hatch)').join(c.hatch)
    .split('var(--pc-xhatch,0)').join(c.xhatch);
  // Phaser's SVG loader decodes data URIs with atob, so they must be base64.
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
