import { useRef, useState, type TouchEvent } from 'react';
import type { Piece as PieceType, Square as SquareType, TileEffectType } from '@pigeon-chess/game-core';
import { MODIFIER_IDS } from '@pigeon-chess/game-core';
import type { SquareView } from '../Board/boardView';
import styles from './Square.module.css';

/**
 * The Phaser board draws every square. This transparent square sits on top of
 * it and handles clicks, tooltips, accessibility and test hooks.
 */
interface SquareProps extends SquareView {
  onClick: (square: SquareType) => void;
}

const GERALD_ID = MODIFIER_IDS.gerald;
const WINTER_ID = MODIFIER_IDS.winterIsComing;
const SWAMP_ID = MODIFIER_IDS.thisIsMySwamp;

function getPieceTooltipLines(piece: PieceType | undefined, infectedReach: number | undefined): string[] {
  if (!piece) return [];

  const lines: string[] = [];

  if (infectedReach !== undefined) {
    lines.push(`Cordyceptic Spread: Slowed by infection. Can move ${infectedReach} square${infectedReach === 1 ? '' : 's'}.`);
  }

  if ((piece.cooldowns[GERALD_ID] ?? 0) > 0) {
    lines.push('Gerald: This piece is blocked and clearing it costs the turn.');
  }
  if ((piece.cooldowns[WINTER_ID] ?? 0) > 0) {
    lines.push('Winter Is Coming: This piece is frozen for one turn.');
  }
  if ((piece.cooldowns[SWAMP_ID] ?? 0) > 0) {
    lines.push('This Is My Swamp: This knight is stuck in the Swamp.');
  }
  if (piece.isPacifist) {
    lines.push('Conscientious Objector: This piece refuses to capture.');
  }
  if (piece.type === 'pigeon') {
    lines.push('Pigeon: Moves like a knight. Every 5 rounds it picks a square and hops there on its own.');
  }
  if (piece.type === 'chancellor') {
    lines.push('Chancellor: Moves like a rook or a knight.');
  }
  if (piece.type === 'royal_guard') {
    lines.push('Royal Guard: Steps one square like a king. Losing it does not lose the game.');
  }
  if (piece.isTraitor) {
    lines.push('They Were The Traitor: This piece defects at the start of its owner\'s next turn.');
  }
  if (piece.hasPromotionChain) {
    lines.push('Reject Queen: This piece chains one extra capture on its next capture.');
  }
  if (piece.isBerserker) {
    lines.push('Berserker: This piece chain-captures when another capture exists.');
  }

  return lines;
}

function getTileTooltipLines(
  tileEffects: TileEffectType[],
  isFrozenZone: boolean,
  isSwamp: boolean,
  isShaft: boolean,
  storm: 'warning' | 'active' | undefined,
  quietZone: 'white' | 'black' | undefined,
  noFlyZone: 'white' | 'black' | undefined,
): string[] {
  const lines: string[] = [];

  if (tileEffects.includes('infected')) {
    lines.push('Cordyceptic Spread: Infected. Pieces standing still here lose reach each round. A bishop or queen crossing clears it.');
  }
  if (tileEffects.includes('lava')) {
    lines.push('Floor Is Lava: Non-king pieces landing here are destroyed.');
  }
  if (isFrozenZone) {
    lines.push('Winter Is Coming: Pieces entering this zone must thaw before moving again.');
  }
  if (isShaft) {
    lines.push('Vent Tiles: An empty shaft. No piece can enter or cross it.');
  }
  if (storm === 'warning') {
    lines.push('The Storm Closes In: The storm takes this square soon. Pieces left here are lost.');
  }
  if (storm === 'active') {
    lines.push('The Storm Closes In: Lost to the storm. No piece can enter or cross it.');
  }
  if (isSwamp) {
    lines.push('This Is My Swamp: Pieces here move only 1 square. Knights landing here are stuck for 2 turns.');
  }

  if (noFlyZone) {
    lines.push(`I Hereby Declare: The ${noFlyZone} king closed this line. Enemy pieces cannot land on or cross it.`);
  }
  if (quietZone) {
    lines.push(`Quiet Quitting: The ${quietZone} queen's zone. Enemy pieces cannot enter.`);
  }

  return lines;
}

export default function Square({
  square,
  piece,
  isLegalTarget,
  tileEffects,
  isFrozenZone,
  isSwamp,
  infectedReach,
  crownOrder,
  pigeonHop,
  isHidden,
  blindSpot,
  surveillance,
  smoke,
  susAs,
  ghost,
  confession,
  isShaft,
  storm,
  quietZone,
  noFlyZone,
  onClick,
}: SquareProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const pieceTooltipLines = getPieceTooltipLines(piece, infectedReach);
  const tileTooltipLines = getTileTooltipLines(tileEffects, isFrozenZone, isSwamp, isShaft, storm, quietZone, noFlyZone);
  const tooltipLines = [
    ...pieceTooltipLines,
    ...tileTooltipLines,
    ...(blindSpot ? ['Known Unknowns: your Blind Spot. You cannot see enemy pieces here.'] : isHidden ? ['Dark: you cannot see this square.'] : []),
    ...(smoke ? [`What's In The Cloud, Bro: smoke. Only the ${smoke} side sees inside.`] : []),
    ...(confession === 'piece' ? ['Forgive Me: this piece is confessing. Its next move is declared first, then made a turn later.'] : []),
    ...(confession === 'target' ? ['Forgive Me: the confessing piece declared it will move here.'] : []),
    ...(ghost ? ['I\'m Literally Right Here: your Ghost. It looks real to your opponent, but it cannot capture or give check.'] : []),
    ...(susAs ? [`Sus: your opponent sees this piece as a ${susAs}.`] : []),
    ...(surveillance ? ['Big Beak Is Watching: a piece that moves here or next to here is shown to both players for 3 rounds.'] : []),
    ...(pigeonHop ? [`Hatoful Gambit: the ${pigeonHop} pigeon hops here on the next move.`] : []),
    ...(crownOrder ? [`Heavy Is The Crown: the ${crownOrder} king is ordered here. It can move here on its next turn.`] : []),
  ];
  const hasTooltip = tooltipLines.length > 0;

  function clearTouchTimer() {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  // Touch: hold to read a square, let go to close it. A hold never counts as a tap.
  function handleTouchStart() {
    longPressTriggeredRef.current = false;
    if (!hasTooltip) return;
    clearTouchTimer();
    touchTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowTooltip(true);
    }, 400);
  }

  function handleTouchEnd(event: TouchEvent) {
    clearTouchTimer();
    if (longPressTriggeredRef.current) {
      // Stop the browser turning the hold into a tap that selects or moves.
      event.preventDefault();
      setShowTooltip(false);
    }
  }

  function handleClick() {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onClick(square);
  }

  const tooltip = hasTooltip && showTooltip && (
    <div className={styles.tooltip} role="tooltip">
      {tooltipLines.map(line => (
        <div key={line} className={styles.tooltipLine}>
          {line}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={styles.square}
      onClick={handleClick}
      // Hover is for a mouse only. Phones fake a hover on every tap, which
      // used to leave a box open after selecting a piece.
      onPointerEnter={event => event.pointerType === 'mouse' && hasTooltip && setShowTooltip(true)}
      onPointerLeave={event => event.pointerType === 'mouse' && setShowTooltip(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        clearTouchTimer();
        setShowTooltip(false);
      }}
      onContextMenu={event => event.preventDefault()}
      data-square={square}
      data-piece={piece ? `${piece.color}-${piece.type}` : undefined}
      data-legal={isLegalTarget || undefined}
      role="button"
      aria-label={tooltipLines.length > 0 ? `${square}, ${tooltipLines.join(' ')}` : square}
      tabIndex={-1}
    >
      {tooltip}
    </div>
  );
}
