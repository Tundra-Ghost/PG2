import Phaser from 'phaser';
import type { Color, Square } from '@pigeon-chess/game-core';
import type { SquareView } from '../Board/boardView';
import { PIECE_TYPES, pieceSvgDataUri, pieceTextureKey } from './pieceTextures';

/** Square size the scene is laid out at; the canvas scales to fit. */
export const CELL = 80;
const PIECE_PX = 64;

interface Theme {
  frame: number;
  light: number;
  dark: number;
  selected: [number, number];
  lastMove: [number, number];
  check: [number, number];
  legal: [number, number];
}

/** Reads a theme colour (hex or rgb/rgba) from the page's CSS variables. */
function cssColor(name: string, fallback: string): [number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(raw);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    return [(r << 16) | (g << 8) | b, rgb[4] ? Number(rgb[4]) : 1];
  }
  return [Phaser.Display.Color.HexStringToColor(raw).color, 1];
}

function readTheme(): Theme {
  return {
    frame: cssColor('--board-frame', '#100a04')[0],
    light: cssColor('--board-light-sq', '#c8a870')[0],
    dark: cssColor('--board-dark-sq', '#1e1408')[0],
    selected: cssColor('--sq-selected', 'rgba(200, 151, 58, 0.40)'),
    lastMove: cssColor('--sq-last-move', 'rgba(155, 199, 0, 0.35)'),
    check: cssColor('--sq-check', 'rgba(184, 50, 40, 0.65)'),
    legal: cssColor('--sq-legal-dot', 'rgba(200, 151, 58, 0.60)'),
  };
}

/**
 * The board as a Phaser scene. It draws whatever SquareViews React hands it
 * and reports clicks back; all rules stay in React and game-core.
 */
export class BoardScene extends Phaser.Scene {
  private views: SquareView[] = [];
  private onSquareClick: (square: Square) => void = () => {};
  private ready = false;
  private squareLayer!: Phaser.GameObjects.Graphics;
  private markLayer!: Phaser.GameObjects.Graphics;
  private pieceSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super('board');
  }

  preload() {
    for (const type of PIECE_TYPES) {
      for (const color of ['white', 'black'] as Color[]) {
        const uri = pieceSvgDataUri(type, color);
        if (uri) this.load.svg(pieceTextureKey(type, color), uri, { width: PIECE_PX * 2, height: PIECE_PX * 2 });
      }
    }
  }

  create() {
    this.squareLayer = this.add.graphics();
    this.markLayer = this.add.graphics().setDepth(2);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const col = Math.floor(pointer.x / CELL);
      const row = Math.floor(pointer.y / CELL);
      const view = this.views[row * 8 + col];
      if (view) this.onSquareClick(view.square);
    });
    this.ready = true;
    this.redraw();
  }

  setBoard(views: SquareView[], onSquareClick: (square: Square) => void) {
    this.views = views;
    this.onSquareClick = onSquareClick;
    if (this.ready) this.redraw();
  }

  private redraw() {
    const theme = readTheme();
    const g = this.squareLayer.clear();
    const marks = this.markLayer.clear();
    const seen = new Set<string>();

    this.views.forEach((view, index) => {
      const x = (index % 8) * CELL;
      const y = Math.floor(index / 8) * CELL;
      // Like the DOM board, a highlight replaces the square colour and is
      // tinted over the dark frame, not over the square.
      const overlay = view.isInCheck ? theme.check : view.isSelected ? theme.selected : view.isLastMove ? theme.lastMove : null;
      if (overlay) {
        g.fillStyle(theme.frame, 1).fillRect(x, y, CELL, CELL);
        g.fillStyle(overlay[0], overlay[1]).fillRect(x, y, CELL, CELL);
      } else {
        g.fillStyle(view.isLight ? theme.light : theme.dark, 1).fillRect(x, y, CELL, CELL);
      }

      if (view.isLegalTarget) {
        marks.fillStyle(theme.legal[0], theme.legal[1]);
        marks.lineStyle(4, theme.legal[0], theme.legal[1]);
        if (view.piece) marks.strokeCircle(x + CELL / 2, y + CELL / 2, CELL / 2 - 4);
        else marks.fillCircle(x + CELL / 2, y + CELL / 2, CELL * 0.15);
      }

      if (view.piece) {
        // Keyed by piece id so a piece keeps its sprite as it moves (ready for tweens later).
        const key = view.piece.id;
        seen.add(key);
        const texture = pieceTextureKey(view.piece.type, view.piece.color);
        let sprite = this.pieceSprites.get(key);
        if (!sprite) {
          sprite = this.add.image(0, 0, texture).setDepth(1).setDisplaySize(PIECE_PX, PIECE_PX);
          // Matches the DOM pieces' soft drop shadow (WebGL only).
          sprite.preFX?.addShadow(0, 0.6, 0.06, 1, 0x000000, 4, 0.5);
          this.pieceSprites.set(key, sprite);
        } else if (sprite.texture.key !== texture) {
          sprite.setTexture(texture).setDisplaySize(PIECE_PX, PIECE_PX);
        }
        sprite.setPosition(x + CELL / 2, y + CELL / 2);
      }
    });

    for (const [key, sprite] of this.pieceSprites) {
      if (!seen.has(key)) {
        sprite.destroy();
        this.pieceSprites.delete(key);
      }
    }
  }
}
