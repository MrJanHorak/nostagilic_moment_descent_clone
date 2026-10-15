// Small axis-aligned graybox. Each solid produces both its visible box and collider.
// This is an internal fixture, not the future editor/import document format.
const solid = (id, center, size, color) => Object.freeze({
  id, center: Object.freeze(center), size: Object.freeze(size), color,
});

export default function createFlightArena() {
  return Object.freeze({
    id: 'flight-arena', kind: 'arena', name: 'Flight Training Arena',
    rendering: Object.freeze({ enemyAccentLights: false }),
    spawn: Object.freeze([0, 0, 6]),
    enemySpawns: Object.freeze([]), powerupSpawns: Object.freeze([]),
    solids: Object.freeze([
      solid('floor', [0, -6.5, -8], [22, 1, 38], 0x344457),
      solid('ceiling', [0, 6.5, -8], [22, 1, 38], 0x465467),
      solid('west', [-10.5, 0, -8], [1, 12, 36], 0x4f6277),
      solid('east', [10.5, 0, -8], [1, 12, 36], 0x4f6277),
      solid('spawn-end', [0, 0, 10.5], [22, 12, 1], 0x3a6070),
      solid('far-end', [0, 0, -26.5], [22, 12, 1], 0x71604b),
      // Opening: X [-2.5, 2.5], Y [-3, 3], through Z [-8.5, -7.5].
      solid('door-west', [-6.25, 0, -8], [7.5, 12, 1], 0x405a6b),
      solid('door-east', [6.25, 0, -8], [7.5, 12, 1], 0x405a6b),
      solid('door-top', [0, 4.5, -8], [5, 3, 1], 0x405a6b),
      solid('door-bottom', [0, -4.5, -8], [5, 3, 1], 0x405a6b),
      solid('pillar', [5, -1, -18], [2, 10, 2], 0x987345),
    ]),
  });
}
