import Phaser from 'phaser';
import type { Color } from '@pigeon-chess/game-core';
import { SPRITES } from '../../characters';
import type { SquareView } from '../Board/boardView';
import { getPieceMarkers } from '../Piece/pieceMarkers';
import { PIECE_GLYPHS, PIECE_TYPES, pieceTextureKey, renderPieceCanvas } from './pieceTextures';
import { prefersCalm } from '../../settings';

/** Square size the scene is laid out at; the canvas scales to fit. */
export const CELL = 80;
const PIECE_PX = 64;
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const CHESS_GLYPH = /[\u2654-\u265F]/;

// Draw order, bottom to top.
const DEPTH = { squares: 0, tiles: 1, pulse: 2, tileIcons: 2.5, fog: 2.8, pieces: 3, badges: 4, marks: 5, bursts: 6 };
const MOVE_MS = 140;
const REMOVE_MS = 180;
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
/** Smoke puffs in one cell: [x, y, radius] as fractions of a cell. */
const SMOKE_PUFFS: [number, number, number][] = [[0.3, 0.35, 0.24], [0.68, 0.3, 0.2], [0.5, 0.68, 0.26], [0.85, 0.75, 0.16]];
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
  private fogLayer!: Phaser.GameObjects.Graphics;
  private markLayer!: Phaser.GameObjects.Graphics;
  private badgeLayer!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.GameObject[] = [];
  private pieceSprites = new Map<string, Phaser.GameObjects.Image>();
  private geraldSprites = new Map<string, Phaser.GameObjects.Image>();
  /** MOD-A016: Gerald's statue, a grey Gerald on a stone plinth. */
  private statueSprite: Phaser.GameObjects.Image | null = null;
  /** Burst keys already played, so a redraw never replays a flash. */
  private playedBursts = new Set<string>();
  /** Reduce Motion: the device setting or the in-game one, read live so a mid-match toggle applies. */
  private get calm(): boolean {
    return prefersCalm();
  }
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('board');
  }

  preload() {
    this.load.image('gerald', SPRITES.gerald);
  }

  /**
   * Piece images are drawn to canvases here rather than through Phaser's SVG
   * loader, so one browser quirk cannot leave the board empty. Until a piece's
   * texture is ready, the board shows a glyph for it.
   */
  private loadPieceTextures() {
    const jobs: Promise<void>[] = [];
    for (const type of PIECE_TYPES) {
      for (const color of ['white', 'black'] as Color[]) {
        jobs.push(renderPieceCanvas(type, color, PIECE_PX * 2).then(canvas => {
          const key = pieceTextureKey(type, color);
          if (!canvas) console.warn(`Piece image failed to load: ${key}`);
          else if (this.sys.isActive() && !this.textures.exists(key)) this.textures.addCanvas(key, canvas);
        }));
      }
    }
    void Promise.all(jobs).then(() => {
      if (!this.sys.isActive()) return;
      // Sprites made before their texture existed are rebuilt with it.
      for (const sprite of this.pieceSprites.values()) sprite.destroy();
      this.pieceSprites.clear();
      this.redraw();
    });
  }

  create() {
    this.squareLayer = this.add.graphics().setDepth(DEPTH.squares);
    this.tileLayer = this.add.graphics().setDepth(DEPTH.tiles);
    this.fogLayer = this.add.graphics().setDepth(DEPTH.fog);
    this.pulseLayer = this.add.graphics().setDepth(DEPTH.pulse);
    this.badgeLayer = this.add.graphics().setDepth(DEPTH.badges);
    this.markLayer = this.add.graphics().setDepth(DEPTH.marks);
    // Flashes already on screen when the board opens are not replayed.
    for (const view of this.views) if (view.burst) this.playedBursts.add(`${view.burst.key}:${view.square}`);
    this.ready = true;
    this.loadPieceTextures();
    this.redraw();
  }

  setBoard(views: SquareView[]) {
    this.views = views;
    if (this.ready) this.redraw();
  }

  /** Lava and storm warnings breathe, like their CSS versions, unless motion is reduced. */
  private syncPulse() {
    if (this.calm) {
      if (this.pulseTween) {
        this.pulseTween.remove();
        this.pulseTween = null;
        this.pulseLayer.setAlpha(1);
      }
    } else if (!this.pulseTween) {
      this.pulseTween = this.tweens.add({ targets: this.pulseLayer, alpha: 0.55, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private redraw() {
    this.syncPulse();
    const theme = readTheme();
    const g = this.squareLayer.clear();
    const tiles = this.tileLayer.clear();
    const fog = this.fogLayer.clear();
    const pulse = this.pulseLayer.clear();
    const marks = this.markLayer.clear();
    const badges = this.badgeLayer.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    const seenPieces = new Set<string>();
    const seenGerald = new Set<string>();
    let seenStatue = false;

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
      if (view.statue) {
        seenStatue = true;
        this.drawStatue(tiles, x, y);
      }
      // Fog of war: dark, with a faint grain so the board still reads.
      if (view.isHidden) {
        fog.fillStyle(0x07060a, 0.86).fillRect(x, y, CELL, CELL);
        fog.fillStyle(0x2a2440, 0.25).fillCircle(x + CELL * 0.3, y + CELL * 0.35, CELL * 0.22);
        fog.fillStyle(0x2a2440, 0.18).fillCircle(x + CELL * 0.7, y + CELL * 0.65, CELL * 0.26);
      }
      if (view.blindSpot) this.drawBlindSpotEdges(index, x, y);
      if (view.smoke) this.drawSmoke(x, y);
      if (view.tide) this.drawTide(view.tide, x, y);
      if (view.cropCircle) this.drawCrop(view.cropCircle, x, y);
      if (view.portal) this.drawPortal(view.portal, cx, cy);
      if (view.lavaNext) this.drawLavaNext(x, y);
      if (view.taxed) this.drawTaxed(x, y);
      if (view.wall) this.drawWall(x, y);
      // Drawn over the fog: both players always see the flock (like the eye).
      if (view.flock) this.drawFlock(view.flock, x, y);
      if (view.confession) this.drawConfession(view.confession, cx, cy);
      if (view.mirrorEdge) this.drawMirrorEdge(view.mirrorEdge === 'right' ? x + CELL : x, y);
      // Drawn over the fog: both players always see the eye.
      if (view.surveillance) this.drawEye(cx, cy);
      if (view.burst) this.playBurst(view, cx, cy);

      if (view.isLegalTarget) {
        marks.fillStyle(theme.legal[0], theme.legal[1]);
        marks.lineStyle(4, theme.legal[0], theme.legal[1]);
        if (view.piece || view.statue) marks.strokeCircle(cx, cy, CELL / 2 - 4);
        else marks.fillCircle(cx, cy, CELL * 0.15);
      }

      if (!view.piece) return;
      const piece = view.piece;
      const worn = getPieceMarkers(piece);
      // Keyed by piece id so a piece keeps its sprite as it moves (ready for tweens later).
      seenPieces.add(piece.id);
      const texture = pieceTextureKey(piece.type, piece.color);
      if (!this.textures.exists(texture)) {
        this.labels.push(
          this.add.text(cx, cy, PIECE_GLYPHS[piece.type] ?? '?', {
            fontFamily: 'serif',
            fontSize: '52px',
            color: piece.color === 'white' ? '#f2ead8' : '#2a1c0e',
            stroke: piece.color === 'white' ? '#18120a' : '#c8a870',
            strokeThickness: 3,
          }).setOrigin(0.5).setDepth(DEPTH.pieces).setAlpha(view.ghost ? 0.55 : 1),
        );
      } else {
        let sprite = this.pieceSprites.get(piece.id);
        if (!sprite) {
          sprite = this.add.image(0, 0, texture).setDepth(DEPTH.pieces).setDisplaySize(PIECE_PX, PIECE_PX);
          this.pieceSprites.set(piece.id, sprite);
        }
        this.placeSprite(sprite, cx, cy, texture);
        // Your own Ghosts are faded; the opponent sees them solid.
        sprite.setAlpha(view.ghost ? 0.55 : 1);
      }
      // A red glow under Traitors and Berserkers. Drawn as shapes, not WebGL
      // effects: some phone browsers render those effects as solid boxes.
      if (worn.traitor) glow(tiles, cx, cy, CELL * 0.46, 0xff2828, 0.75);
      else if (worn.berserker) glow(tiles, cx, cy, CELL * 0.42, 0xd64a2c, 0.6);

      if (worn.gerald) {
        seenGerald.add(piece.id);
        let bird = this.geraldSprites.get(piece.id);
        if (!bird) {
          bird = this.add.image(0, 0, 'gerald').setDepth(DEPTH.badges);
          bird.setScale((CELL * 0.62) / bird.width);
          this.geraldSprites.set(piece.id, bird);
          // He lands from above, like the DOM version.
          if (this.calm) {
            bird.setPosition(x + CELL * 0.19, y + CELL * 0.16);
          } else {
            bird.setPosition(x + CELL * 0.19, y + CELL * 0.02).setAlpha(0);
            this.tweens.add({ targets: bird, y: y + CELL * 0.16, alpha: 1, duration: 280, ease: 'Cubic.easeOut' });
          }
        } else {
          bird.setPosition(x + CELL * 0.19, y + CELL * 0.16);
        }
      }

      // Sus: a ? badge so the owner knows which piece is disguised.
      const badgeMarks = view.susAs ? [...worn.marks, '?'] : worn.marks;
      badgeMarks.forEach((mark, i) => {
        // Two-character marks (an Egg's count) get a wider badge.
        const bw = mark.length > 1 ? 26 : 18;
        const bx = x + CELL - 3 - bw;
        const by = y + 3 + i * 20;
        const hot = mark === 'B' ? 0x8a2410 : mark === '!' ? 0xc41e1e : 0xf5e8c0;
        badges.fillStyle(hot, 0.97).fillRect(bx, by, bw, 18);
        badges.lineStyle(1, 0x18120a, 0.5).strokeRect(bx, by, bw, 18);
        this.labels.push(
          this.add.text(bx + bw / 2, by + 9, mark, {
            // Chess glyphs (the Amazon's ♞) draw small in the mono font, so they get a size up.
            fontFamily: CHESS_GLYPH.test(mark) ? 'serif' : MONO,
            fontSize: CHESS_GLYPH.test(mark) ? '20px' : '12px',
            color: hot === 0xf5e8c0 ? '#18120a' : '#fff2de',
          }).setOrigin(0.5).setDepth(DEPTH.marks),
        );
      });
    });

    for (const [id, sprite] of this.pieceSprites) {
      if (!seenPieces.has(id)) {
        this.pieceSprites.delete(id);
        this.removeSprite(sprite);
      }
    }
    for (const [id, bird] of this.geraldSprites) {
      if (!seenGerald.has(id)) {
        bird.destroy();
        this.geraldSprites.delete(id);
      }
    }
    if (!seenStatue && this.statueSprite) {
      this.statueSprite.destroy();
      this.statueSprite = null;
    }
  }

  /** MOD-A016: a stone plinth with a grey Gerald on top. */
  private drawStatue(tiles: Phaser.GameObjects.Graphics, x: number, y: number) {
    const cx = x + CELL / 2;
    tiles.fillStyle(0x6e6a64, 1).fillRect(x + CELL * 0.18, y + CELL * 0.66, CELL * 0.64, CELL * 0.2);
    tiles.fillStyle(0x8e8a82, 1).fillRect(x + CELL * 0.24, y + CELL * 0.58, CELL * 0.52, CELL * 0.1);
    tiles.lineStyle(2, 0x2a2622, 0.8).strokeRect(x + CELL * 0.18, y + CELL * 0.66, CELL * 0.64, CELL * 0.2);
    if (!this.statueSprite) {
      this.statueSprite = this.add.image(0, 0, 'gerald').setDepth(DEPTH.pieces);
      this.statueSprite.setScale((CELL * 0.6) / this.statueSprite.width).setTint(0xb4b0a8);
    }
    this.statueSprite.setPosition(cx, y + CELL * 0.36);
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
    if (view.sneezeIn !== undefined) {
      // Bless You: moves left before a sneeze, top-left (the top-right is for other badges). Red when it is the next one.
      this.labels.push(
        this.add.text(x + 5, y + 3, String(view.sneezeIn), {
          fontFamily: MONO, fontSize: '13px', fontStyle: 'bold',
          color: '#ffffff', backgroundColor: view.sneezeIn === 1 ? 'rgba(170,24,20,0.95)' : 'rgba(20,33,61,0.85)',
          padding: { x: 3, y: 1 },
        }).setOrigin(0, 0).setDepth(DEPTH.badges),
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

  /**
   * Pieces glide to their new square instead of jumping. A new look (a pawn
   * promoting) shows when the piece lands, not before it sets off.
   */
  private placeSprite(sprite: Phaser.GameObjects.Image, x: number, y: number, texture: string) {
    this.tweens.killTweensOf(sprite);
    const restyle = () => {
      if (sprite.texture.key !== texture) sprite.setTexture(texture).setDisplaySize(PIECE_PX, PIECE_PX);
    };
    const fresh = sprite.x === 0 && sprite.y === 0;
    if (this.calm || fresh || (sprite.x === x && sprite.y === y)) {
      sprite.setPosition(x, y).setDepth(DEPTH.pieces);
      restyle();
      return;
    }
    sprite.setDepth(DEPTH.pieces + 0.5);
    this.tweens.add({
      targets: sprite,
      x,
      y,
      duration: MOVE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sprite.setDepth(DEPTH.pieces);
        restyle();
      },
    });
  }

  /** A taken or removed piece shrinks and fades on its square, under the piece that moves in. */
  private removeSprite(sprite: Phaser.GameObjects.Image) {
    this.tweens.killTweensOf(sprite);
    if (this.calm) {
      sprite.destroy();
      return;
    }
    sprite.setDepth(DEPTH.pieces - 0.1);
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: sprite.scaleX * 0.6,
      scaleY: sprite.scaleY * 0.6,
      duration: REMOVE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => sprite.destroy(),
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

  /** Known Unknowns: a dashed violet line around the viewer's Blind Spot. */
  private drawBlindSpotEdges(index: number, x: number, y: number) {
    const col = index % 8;
    const inSpot = (i: number) => i >= 0 && i < 64 && this.views[i]?.blindSpot === true;
    const g = this.fogLayer;
    g.lineStyle(3, 0x9a7ad8, 0.95);
    const dashed = (x1: number, y1: number, x2: number, y2: number) => {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 0.6) / steps;
        g.lineBetween(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      }
    };
    if (!inSpot(index - 8)) dashed(x, y + 1.5, x + CELL, y + 1.5);
    if (!inSpot(index + 8)) dashed(x, y + CELL - 1.5, x + CELL, y + CELL - 1.5);
    if (col === 0 || !inSpot(index - 1)) dashed(x + 1.5, y, x + 1.5, y + CELL);
    if (col === 7 || !inSpot(index + 1)) dashed(x + CELL - 1.5, y, x + CELL - 1.5, y + CELL);
  }

  /** The Birds: dark birds on a grey patch, or grey stripes a round before they land. */
  private drawFlock(kind: 'warning' | 'active', x: number, y: number) {
    const g = this.fogLayer;
    if (kind === 'warning') {
      // Solid dark stripes and a frame, so it never reads as the faint storm warning.
      g.lineStyle(4, 0x1f2633, 0.8);
      stripes(g, x, y, 12, 1);
      g.lineStyle(3, 0x1f2633, 0.9).strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      return;
    }
    g.fillStyle(0x5a6272, 0.85).fillRect(x, y, CELL, CELL);
    g.lineStyle(4, 0x14181f, 1);
    for (const [px, py, s] of [[0.32, 0.34, 0.16], [0.68, 0.44, 0.14], [0.42, 0.7, 0.15]] as const) {
      const cx = x + CELL * px;
      const cy = y + CELL * py;
      const w = CELL * s;
      g.beginPath();
      g.moveTo(cx - w, cy - w * 0.4);
      g.lineTo(cx, cy + w * 0.2);
      g.lineTo(cx + w, cy - w * 0.4);
      g.strokePath();
    }
  }

  /** Dirt Hut: a block of packed dirt with a grassy top. */
  private drawWall(x: number, y: number) {
    const g = this.tileLayer;
    const inset = CELL * 0.1;
    const size = CELL - inset * 2;
    g.fillStyle(0x6b4423, 1).fillRect(x + inset, y + inset, size, size);
    g.fillStyle(0x5c9a3a, 1).fillRect(x + inset, y + inset, size, size * 0.22);
    g.fillStyle(0x4a2e16, 1);
    for (const [px, py] of [[0.3, 0.5], [0.65, 0.42], [0.45, 0.72], [0.75, 0.75], [0.22, 0.8]] as const) {
      g.fillRect(x + CELL * px - 3, y + CELL * py - 3, 6, 6);
    }
    g.lineStyle(3, 0x2e1c0c, 1).strokeRect(x + inset, y + inset, size, size);
  }

  /** The Floor Is Lava: a dashed amber square where lava goes next. */
  private drawLavaNext(x: number, y: number) {
    const g = this.tileLayer;
    const inset = CELL * 0.12;
    const size = CELL - inset * 2;
    g.fillStyle(0xff7a1a, 0.18).fillRect(x + inset, y + inset, size, size);
    g.lineStyle(3, 0xe8660c, 0.95);
    const steps = 5;
    const side = (x1: number, y1: number, x2: number, y2: number) => {
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 0.55) / steps;
        g.lineBetween(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      }
    };
    const l = x + inset, t = y + inset, r = x + inset + size, b = y + inset + size;
    side(l, t, r, t);
    side(r, t, r, b);
    side(r, b, l, b);
    side(l, b, l, t);
  }

  /** Tide Goes In: blue water with wave lines, or just the wave lines as a warning. */
  private drawTide(kind: 'warning' | 'active', x: number, y: number) {
    const g = this.tileLayer;
    if (kind === 'active') g.fillStyle(0x1a5fb4, 0.38).fillRect(x, y, CELL, CELL);
    g.lineStyle(3, 0x0c3a78, kind === 'active' ? 0.9 : 0.75);
    for (const row of [0.35, 0.65]) {
      const wy = y + CELL * row;
      g.beginPath();
      g.moveTo(x + CELL * 0.15, wy);
      for (let i = 1; i <= 4; i++) {
        g.lineTo(x + CELL * (0.15 + i * 0.175), wy + (i % 2 === 0 ? 0 : -CELL * 0.06));
      }
      g.strokePath();
    }
  }

  /** Crop Circles: wheat-gold square with flattened rings; just the rings, dashed-looking, as a warning. */
  private drawCrop(kind: 'warning' | 'active', x: number, y: number) {
    const g = this.tileLayer;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    if (kind === 'active') g.fillStyle(0xd9b24a, 0.42).fillRect(x, y, CELL, CELL);
    g.lineStyle(3, 0x6b4a0c, kind === 'active' ? 0.85 : 0.6);
    g.strokeCircle(cx, cy, CELL * 0.4);
    if (kind === 'active') g.strokeCircle(cx, cy, CELL * 0.22);
  }

  /** Thinking With Portals: a glowing oval ring, blue or orange, under the piece. */
  private drawPortal(kind: 'blue' | 'orange', cx: number, cy: number) {
    const g = this.tileLayer;
    const color = kind === 'blue' ? 0x1f6fe0 : 0xf07a12;
    const w = CELL * 0.84;
    const h = CELL * 0.84;
    g.fillStyle(color, 0.16).fillEllipse(cx, cy, w, h);
    // A navy outline keeps the ring clear on light and dark squares.
    g.lineStyle(7, 0x14213d, 0.85).strokeEllipse(cx, cy, w, h);
    g.lineStyle(4, color, 1).strokeEllipse(cx, cy, w, h);
  }

  /** Death And Taxes: a dashed red frame on navy with a coin, on the pawn taxed after this move. */
  private drawTaxed(x: number, y: number) {
    const g = this.fogLayer;
    const inset = CELL * 0.08;
    const size = CELL - inset * 2;
    // A solid navy line under the red dashes keeps the frame clear on dark squares too.
    g.lineStyle(5, 0x14213d, 0.9).strokeRect(x + inset, y + inset, size, size);
    g.lineStyle(3, 0xe8463c, 1);
    const steps = 4;
    const side = (x1: number, y1: number, x2: number, y2: number) => {
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 0.6) / steps;
        g.lineBetween(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      }
    };
    const l = x + inset, t = y + inset, r = x + inset + size, b = y + inset + size;
    side(l, t, r, t);
    side(r, t, r, b);
    side(r, b, l, b);
    side(l, b, l, t);
    // A gold coin in the bottom-left corner (badges use the top-right), so the mark reads as "tax".
    g.fillStyle(0xe0b040, 1).fillCircle(l + CELL * 0.12, b - CELL * 0.12, CELL * 0.1);
    g.lineStyle(2, 0x14213d, 1).strokeCircle(l + CELL * 0.12, b - CELL * 0.12, CELL * 0.1);
  }

  /** Big Beak Is Watching: a golden eye on the Surveillance Square. */
  private drawEye(cx: number, cy: number) {
    const g = this.fogLayer;
    g.fillStyle(0xd8a838, 0.18).fillEllipse(cx, cy, CELL * 0.86, CELL * 0.5);
    g.lineStyle(3, 0xe0b040, 0.95).strokeEllipse(cx, cy, CELL * 0.86, CELL * 0.5);
    g.fillStyle(0xe0b040, 0.95).fillCircle(cx, cy, CELL * 0.14);
    g.fillStyle(0x18120a, 1).fillCircle(cx, cy, CELL * 0.06);
  }

  /** What's In The Cloud, Bro: grey puffs, seen by both sides. */
  private drawSmoke(x: number, y: number) {
    const g = this.fogLayer;
    g.fillStyle(0x9a9490, 0.28).fillRect(x, y, CELL, CELL);
    for (const [sx, sy, r] of SMOKE_PUFFS) {
      g.fillStyle(0xc8c2bc, 0.32).fillCircle(x + CELL * sx, y + CELL * sy, CELL * r);
    }
  }

  /** Forgive Me: a violet ring on the confessing piece, a dashed ghost ring where it declared. */
  private drawConfession(kind: 'piece' | 'target', cx: number, cy: number) {
    const g = this.fogLayer;
    const r = CELL * 0.42;
    if (kind === 'piece') {
      g.lineStyle(3, 0xb07ae0, 0.95).strokeCircle(cx, cy, r);
      return;
    }
    g.fillStyle(0xb07ae0, 0.16).fillCircle(cx, cy, r);
    g.lineStyle(3, 0xb07ae0, 0.95);
    const dashes = 12;
    for (let i = 0; i < dashes; i++) {
      const a = (i / dashes) * Math.PI * 2;
      g.beginPath();
      g.arc(cx, cy, r, a, a + Math.PI / dashes);
      g.strokePath();
    }
  }

  /** Bandersnatch Protocol: a glowing cyan seam down the middle of the board. */
  private drawMirrorEdge(x: number, y: number) {
    const g = this.fogLayer;
    g.fillStyle(0x5ad8e6, 0.18).fillRect(x - 4, y, 8, CELL);
    g.lineStyle(2, 0x5ad8e6, 0.9).lineBetween(x, y, x, y + CELL);
  }
}
