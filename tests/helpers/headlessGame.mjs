import createHeadlessGame, { disposeHeadlessGame } from '../../src/js/net/HeadlessGame.js';

/** A headless game with stub presentation (the same one the game server runs),
 * cleaned up after the test. */
export function headlessGame(t) {
  t.mock.method(console, 'log', () => {});
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = createHeadlessGame();
  t.after(() => disposeHeadlessGame(game));
  return game;
}
