import type { Color, PieceType } from '@pigeon-chess/game-core';
import styles from './PieceArt.module.css';

// Piece art lives behind this one component. Each piece is a 48x48 SVG in
// assets/pieces, coloured by CSS variables, so a sprite sheet or animated
// art can replace it later without touching the board.
const files = import.meta.glob('../../assets/pieces/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ART = new Map(
  Object.entries(files).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -4), svg]),
);

export function hasPieceArt(type: PieceType): boolean {
  return ART.has(type);
}

interface PieceArtProps {
  type: PieceType;
  color: Color;
  className?: string;
}

export default function PieceArt({ type, color, className }: PieceArtProps) {
  return (
    <span
      className={[styles.art, styles[color], className].filter(Boolean).join(' ')}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ART.get(type) ?? ART.get('pawn') ?? '' }}
    />
  );
}
