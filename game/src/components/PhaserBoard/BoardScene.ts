import Phaser from 'phaser';
import type { Color } from '@pigeon-chess/game-core';
import { SPRITES } from '../../characters';
import type { SquareView } from '../Board/boardView';
import { getPieceMarkers } from '../Piece/pieceMarkers';
import { PIECE_TYPES, pieceSvgDataUri, pieceTextureKey } from './pieceTextures';

/** Square size the scene is laid out at; the canvas scales to fit. */
export const CELL = 80;
const PIECE_PX = 64;
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// Draw order, bottom to top.
const DEPTH = { squares: 0, tiles: 1, pulse: 2, tileIcons: 2.5, pieces: 3, badges: 4, marks: 5, bursts: 6 };
const MOVE_MS = 140;
const BURST_MS = 1100;

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

/** Diagonal stripes clipped to one square. `slope` 1 runs like "/", -1 like "\". */
function stripes(g: Phaser.GameObjects.Graphics, x: number, y: number, spacing: number, slope: 1 | -1) {
  for (let c = -CELL; c < CELL * 2; c += spacing) {
    // Line through the square: points (t, c - slope * t) for t in [0, CELL], clipped to [0, CELL].
    const pts: [number, number][] = [];
    for (const t of [0, CELL]) {
      const v = slope === 1 ? c - t : c + t - CELL;
      if (v >= 0 && v <= CELL) pts.push([t, v]);
    }
    for (const v of [0, CELL]) {
      const t = slope === 1 ? c - v : v - c + CELL;
      if (t > 0 && t < CELL) pts.push([t, v]);
    }
    if (pts.length >= 2) g.lineBetween(x + pts[0][0], y + pts[0][1], x + pts[1][0], y + pts[1][1]);
  }
}

/** A soft radial blob, built from stacked circles. */
/** Fungal spots on an Infected tile: [x, y, radius] as fractions of a cell. */
const SPORES: [number, number, number][] = [[0.28, 0.3, 0.16], [0.7, 0.42, 0.13], [0.42, 0.74, 0.14], [0.8, 0.8, 0.09]];

function glow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, alpha: number) {
  const steps = 6;
  for (let i = steps; i >= 1; i--) {
    g.fillStyle(color, alpha / steps).fillCircle(cx, cy, (radius * i) / steps);
  }
}

/**
 * The board as a Phaser scene. It draws whatever SquareViews React hands it;
 * clicks, rules and tooltips stay in React and game-core.
 */
export class BoardScene extends Phaser.Scene {
  private views: SquareView[] = [];
  private ready = false;
  private squareLayer!: Phaser.GameObjects.Graphics;
  private tileLayer!: Phaser.GameObjects.Graphics;
  private pulseLayer!: Phaser.GameObjects.Graphics;
  private markLayer!: Phaser.GameObjects.Graphics;
  private badgeLayer!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.GameObject[] = [];
  private pieceSprites = new Map<string, Phaser.GameObjects.Image>();
  private geraldSprites = new Map<string, Phaser.GameObjects.Image>();
  /** Burst keys already played, so a redraw never replays a flash. */
  private playedBursts = new Set<string>();
  private calm = false;

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
    this.load.image('gerald', SPRITES.gerald);
  }

  create() {
    this.squareLayer = this.add.graphics().setDepth(DEPTH.squares);
    this.tileLayer = this.add.graphics().setDepth(DEPTH.tiles);
    this.pulseLayer = this.add.graphics().setDepth(DEPTH.pulse);
    this.badgeLayer = this.add.graphics().setDepth(DEPTH.badges);
    this.markLayer = this.add.graphics().setDepth(DEPTH.marks);
    this.calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Flashes already on screen when the board opens are not replayed.
    for (const view of this.views) if (view.burst) this.playedBursts.add(`${view.burst.key}:${view.square}`);
    if (!this.calm) {
      // Lava and storm warnings breathe, like their CSS versions.
      this.tweens.add({ targets: this.pulseLayer, alpha: 0.55, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.ready = true;
    this.redraw();
  }

  setBoard(views: SquareView[]) {
    this.views = views;
    if (this.ready) this.redraw();
  }

  private redraw() {
    const theme = readTheme();
    const g = this.squareLayer.clear();
    const tiles = this.tileLayer.clear();
    const pulse = this.pulseLayer.clear();
    const marks = this.markLayer.clear();
    const badges = this.badgeLayer.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    const seenPieces = new Set<string>();
    const seenGerald = new Set<string>();

    this.views.forEach((view, index) => {
      const x = (index % 8) * CELL;
      const y = Math.floor(index / 8) * CELL;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      // A highlight replaces the square colour and is
      // tinted over the dark frame, not over the square.
      const overlay = view.isInCheck ? theme.check : view.isSelected ? theme.selected : view.isLastMove ? theme.lastMove : null;
      if (view.isClosed) {
        // Outside this board's shape: the frame with faint hatching, so it
        // never reads as a dark square.
        g.fillStyle(0x070503, 1).fillRect(x, y, CELL, CELL);
        g.lineStyle(1, 0xc8973a, 0.12);
        stripes(g, x, y, 10, 1);
        return;
      }
      if (overlay) {
        g.fillStyle(theme.frame, 1).fillRect(x, y, CELL, CELL);
        g.fillStyle(overlay[0], overlay[1]).fillRect(x, y, CELL, CELL);
      } else {
        g.fillStyle(view.isLight ? theme.light : theme.dark, 1).fillRect(x, y, CELL, CELL);
      }

      this.drawTile(view, x, y, tiles, pulse);
      if (view.burst) this.playBurst(view, cx, cy);

      if (view.isLegalTarget) {
        marks.fillStyle(theme.legal[0], theme.legal[1]);
        marks.lineStyle(4, theme.legal[0], theme.legal[1]);
        if (view.piece) marks.strokeCircle(cx, cy, CELL / 2 - 4);
        else marks.fillCircle(cx, cy, CELL * 0.15);
      }

      if (!view.piece) return;
      const piece = view.piece;
      const worn = getPieceMarkers(piece);
      // Keyed by piece id so a piece keeps its sprite as it moves (ready for tweens later).
      seenPieces.add(piece.id);
      const texture = pieceTextureKey(piece.type, piece.color);
      let sprite = this.pieceSprites.get(piece.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, texture).setDepth(DEPTH.pieces).setDisplaySize(PIECE_PX, PIECE_PX);
        this.pieceSprites.set(piece.id, sprite);
      } else if (sprite.texture.key !== texture) {
        sprite.setTexture(texture).setDisplaySize(PIECE_PX, PIECE_PX);
      }
      this.placeSprite(sprite, cx, cy);
      this.styleSprite(sprite, worn.berserker, worn.traitor);

      if (worn.gerald) {
        seenGerald.add(piece.id);
        let bird = this.geraldSprites.get(piece.id);
        if (!bird) {
          bird = this.add.image(0, 0, 'gerald').setDepth(DEPTH.badges);
          bird.setScale((CELL * 0.62) / bird.width);
          this.geraldSprites.set(piece.id, bird);
          // He lands from above, like the DOM version.
          bird.setPosition(x + CELL * 0.19, y + CELL * 0.02).setAlpha(0);
          this.tweens.add({ targets: bird, y: y + CELL * 0.16, alpha: 1, duration: 280, ease: 'Cubic.easeOut' });
        } else {
          bird.setPosition(x + CELL * 0.19, y + CELL * 0.16);
        }
      }

      worn.marks.forEach((mark, i) => {
        const bx = x + CELL - 21;
        const by = y + 3 + i * 20;
        const hot = mark === 'B' ? 0x8a2410 : mark === '!' ? 0xc41e1e : 0xf5e8c0;
        badges.fillStyle(hot, 0.97).fillRect(bx, by, 18, 18);
        badges.lineStyle(1, 0x18120a, 0.5).strokeRect(bx, by, 18, 18);
        this.labels.push(
          this.add.text(bx + 9, by + 9, mark, {
            fontFamily: MONO,
            fontSize: '12px',
            color: hot === 0xf5e8c0 ? '#18120a' : '#fff2de',
          }).setOrigin(0.5).setDepth(DEPTH.marks),
        );
      });
    });

    for (const [id, sprite] of this.pieceSprites) {
      if (!seenPieces.has(id)) {
        sprite.destroy();
        this.pieceSprites.delete(id);
      }
    }
    for (const [id, bird] of this.geraldSprites) {
      if (!seenGerald.has(id)) {
        bird.destroy();
        this.geraldSprites.delete(id);
      }
    }
  }

  private drawTile(
    view: SquareView,
    x: number,
    y: number,
    tiles: Phaser.GameObjects.Graphics,
    pulse: Phaser.GameObjects.Graphics,
  ) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    if (view.isFrozenZone) tiles.fillStyle(0x96cdff, 0.2).fillRect(x, y, CELL, CELL);
    if (view.isShaft) {
      glow(tiles, cx, cy, CELL * 0.6, 0x1e1812, 0.9);
      tiles.fillStyle(0x050403, 1).fillCircle(cx, cy, CELL * 0.3);
    }
    if (view.storm === 'active') {
      tiles.fillGradientStyle(0x2a2f3d, 0x2a2f3d, 0x161922, 0x161922, 1).fillRect(x, y, CELL, CELL);
      glow(tiles, x + CELL * 0.3, y + CELL * 0.35, CELL * 0.32, 0x96a0be, 0.55);
      glow(tiles, x + CELL * 0.7, y + CELL * 0.6, CELL * 0.36, 0x7882a5, 0.5);
    } else if (view.storm === 'warning') {
      pulse.lineStyle(5, 0x788cbe, 0.35);
      stripes(pulse, x, y, 11, -1);
    }
    if (view.isSwamp) {
      tiles.fillStyle(0x5c8c3c, 0.32).fillRect(x, y, CELL, CELL);
      this.labels.push(
        this.add.text(x + 5, y + CELL - 4, '≈', { fontFamily: MONO, fontSize: '15px', color: 'rgba(196,230,150,0.85)' })
          .setOrigin(0, 1).setDepth(DEPTH.tileIcons),
      );
    }
    if (view.noFlyZone) {
      tiles.lineStyle(6, 0xd64034, 0.22);
      stripes(tiles, x, y, 12, 1);
    }
    if (view.quietZone) {
      const inset = CELL * 0.04;
      tiles.fillStyle(0xaa6ee6, 0.18).fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
      tiles.lineStyle(2, 0xdcaaff, 0.85).strokeRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
    }
    if (view.tileEffects.includes('infected')) {
      tiles.fillStyle(0x4e5a22, 0.45).fillRect(x, y, CELL, CELL);
      for (const [sx, sy, r] of SPORES) {
        glow(tiles, x + CELL * sx, y + CELL * sy, CELL * r, 0xb4d25a, 0.7);
      }
      this.labels.push(
        this.add.text(x + 5, y + 3, '✱', { fontFamily: MONO, fontSize: '13px', color: 'rgba(214,240,140,0.95)' })
          .setOrigin(0, 0).setDepth(DEPTH.tileIcons),
      );
    }
    if (view.pigeonHop) {
      // Dashed teal ring with a target dot: a Pigeon lands here next move.
      const steps = 12;
      tiles.lineStyle(3, 0x3ab0a0, 0.95);
      for (let i = 0; i < steps; i += 2) {
        const a0 = (i / steps) * Math.PI * 2;
        const a1 = ((i + 1) / steps) * Math.PI * 2;
        tiles.beginPath();
        tiles.arc(cx, cy, CELL * 0.36, a0, a1);
        tiles.strokePath();
      }
      tiles.fillStyle(0x3ab0a0, 0.9).fillCircle(cx, cy, CELL * 0.06);
    }
    if (view.crownOrder) {
      const inset = CELL * 0.12;
      const size = CELL - inset * 2;
      for (let i = 0; i < 4; i++) {
        // Dashed gold frame: two dashes per side.
        const t = (i % 2) * (size / 2);
        tiles.lineStyle(3, 0xc8902a, 1);
        tiles.lineBetween(x + inset + t + 4, y + inset, x + inset + t + size / 2 - 4, y + inset);
        tiles.lineBetween(x + inset + t + 4, y + CELL - inset, x + inset + t + size / 2 - 4, y + CELL - inset);
        tiles.lineBetween(x + inset, y + inset + t + 4, x + inset, y + inset + t + size / 2 - 4);
        tiles.lineBetween(x + CELL - inset, y + inset + t + 4, x + CELL - inset, y + inset + t + size / 2 - 4);
      }
      this.labels.push(
        this.add.text(cx, cy, '♔', { fontFamily: 'serif', fontSize: '34px', color: 'rgba(200,144,42,0.8)' })
          .setOrigin(0.5).setDepth(DEPTH.tileIcons),
      );
    }
    if (view.infectedReach !== undefined) {
      this.labels.push(
        this.add.text(x + CELL - 5, y + 3, String(view.infectedReach), {
          fontFamily: MONO, fontSize: '13px', fontStyle: 'bold', color: '#e6f5a0', backgroundColor: 'rgba(30,36,10,0.85)',
          padding: { x: 3, y: 1 },
        }).setOrigin(1, 0).setDepth(DEPTH.badges),
      );
    }
    if (view.tileEffects.includes('lava')) {
      const inset = CELL * 0.1;
      const size = CELL - inset * 2;
      pulse.fillStyle(0x2a0e04, 0.55).fillRect(x + inset, y + inset, size, size);
      glow(pulse, x + CELL * 0.3, y + CELL * 0.3, CELL * 0.34, 0xffdd78, 0.8);
      glow(pulse, x + CELL * 0.68, y + CELL * 0.7, CELL * 0.3, 0xff6b18, 0.75);
      // Outer glow, then the hot rim.
      for (let i = 4; i >= 1; i--) {
        pulse.lineStyle(i * 3, 0xff8429, 0.12).strokeRect(x + inset, y + inset, size, size);
      }
      pulse.lineStyle(2, 0xff8429, 0.9).strokeRect(x + inset, y + inset, size, size);
      this.labels.push(
        this.add.text(x + CELL - 5, y + CELL - 3, '▲', { fontFamily: MONO, fontSize: '13px', color: 'rgba(255,216,130,0.95)' })
          .setOrigin(1, 1).setDepth(DEPTH.tileIcons),
      );
    }
  }

  /** Pieces glide to their new square instead of jumping. */
  private placeSprite(sprite: Phaser.GameObjects.Image, x: number, y: number) {
    this.tweens.killTweensOf(sprite);
    const fresh = sprite.x === 0 && sprite.y === 0;
    if (this.calm || fresh || (sprite.x === x && sprite.y === y)) {
      sprite.setPosition(x, y);
      return;
    }
    sprite.setDepth(DEPTH.pieces + 0.5);
    this.tweens.add({
      targets: sprite,
      x,
      y,
      duration: MOVE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => sprite.setDepth(DEPTH.pieces),
    });
  }

  /** A one-shot flash where a modifier just struck. */
  private playBurst(view: SquareView, cx: number, cy: number) {
    const burst = view.burst!;
    const id = `${burst.key}:${view.square}`;
    if (this.playedBursts.has(id)) return;
    this.playedBursts.add(id);
    if (this.calm) return;

    const g = this.add.graphics().setDepth(DEPTH.bursts).setPosition(cx, cy);
    const half = CELL / 2;
    if (burst.kind === 'lava') {
      glow(g, 0, 0, half * 1.1, 0x961e0a, 0.6);
      glow(g, 0, 0, half * 0.8, 0xf06018, 0.85);
      glow(g, 0, 0, half * 0.4, 0xffd678, 0.95);
    } else if (burst.kind === 'berserker') {
      glow(g, 0, 0, half * 1.1, 0xc8141e, 0.5);
      glow(g, 0, 0, half * 0.6, 0xff7878, 0.55);
      g.lineStyle(3, 0xd21e28, 0.9).strokeRect(-half + 1.5, -half + 1.5, CELL - 3, CELL - 3);
    } else if (burst.kind === 'infection') {
      glow(g, 0, 0, half * 1.1, 0x3c4a14, 0.5);
      glow(g, 0, 0, half * 0.7, 0xb4d25a, 0.8);
    } else if (burst.kind === 'storm') {
      glow(g, 0, 0, half * 1.1, 0x283258, 0.4);
      glow(g, 0, 0, half * 0.7, 0x8c96dc, 0.6);
      glow(g, 0, 0, half * 0.35, 0xebf0ff, 0.9);
    } else {
      g.lineStyle(3, 0xc8973a, 1).strokeRect(-half + 1.5, -half + 1.5, CELL - 3, CELL - 3);
    }
    g.setScale(0.4).setAlpha(0);
    this.tweens.chain({
      targets: g,
      tweens: [
        { scale: 1.15, alpha: 1, duration: BURST_MS * 0.18, ease: 'Quad.easeOut' },
        { scale: 1.35, alpha: 0, duration: BURST_MS * 0.82, ease: 'Quad.easeOut' },
      ],
      onComplete: () => g.destroy(),
    });
  }

  /** Berserkers smoulder and warned traitors glow red (WebGL only). */
  private styleSprite(sprite: Phaser.GameObjects.Image, berserker: boolean, traitor: boolean) {
    const fx = sprite.preFX;
    if (!fx) return;
    const want = traitor ? 'traitor' : berserker ? 'berserker' : 'plain';
    if (sprite.getData('fx') === want) return;
    sprite.setData('fx', want);
    fx.clear();
    fx.addShadow(0, 0.6, 0.06, 1, 0x000000, 4, 0.5);
    if (want === 'traitor') fx.addGlow(0xff2828, 4, 0, false, 0.1, 12);
    if (want === 'berserker') fx.addGlow(0xd64a2c, 2, 0, false, 0.1, 10);
  }
}
