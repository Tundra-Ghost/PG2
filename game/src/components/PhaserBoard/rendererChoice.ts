/**
 * Which board renderer to use. The Phaser board is opt-in while it catches up
 * with the DOM board: add ?board=phaser to the URL (remembered on this device),
 * or ?board=dom to switch back.
 */
export type BoardRenderer = 'dom' | 'phaser';

const KEY = 'pigeon-chess.board-renderer';

export function readBoardRenderer(): BoardRenderer {
  try {
    const param = new URLSearchParams(window.location.search).get('board');
    if (param === 'phaser' || param === 'dom') {
      window.localStorage.setItem(KEY, param);
      return param;
    }
    return window.localStorage.getItem(KEY) === 'phaser' ? 'phaser' : 'dom';
  } catch {
    return 'dom';
  }
}
