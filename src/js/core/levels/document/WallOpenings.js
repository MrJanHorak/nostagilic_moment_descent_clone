/** Multiple disjoint rectangular portals: sweep U strips and merge V holes.
 * Eight openings/face is enforced by validation; no unbounded cell grid.
 * @param {number} width @param {number} height
 * @param {{size: readonly [number, number], offset: readonly [number, number]}[]} openings
 * @param {(u0: number, u1: number, v0: number, v1: number, part: string) => void} rectangle */
export default function wallOpenings(width, height, openings, rectangle) {
  const halfW = width / 2, halfH = height / 2;
  if (!openings.length) { rectangle(-halfW, halfW, -halfH, halfH, 'wall'); return; }
  if (openings.length === 1) {
    const { size: [w, h], offset: [u, v] } = openings[0];
    rectangle(-halfW, u - w / 2, -halfH, halfH, 'left'); rectangle(u + w / 2, halfW, -halfH, halfH, 'right');
    rectangle(u - w / 2, u + w / 2, -halfH, v - h / 2, 'bottom'); rectangle(u - w / 2, u + w / 2, v + h / 2, halfH, 'top'); return;
  }
  const holes = openings.map(({ size: [w, h], offset: [u, v] }) => ({ u0: u - w / 2, u1: u + w / 2, v0: v - h / 2, v1: v + h / 2 }));
  const edges = [...new Set([-halfW, halfW, ...holes.flatMap(hole => [hole.u0, hole.u1])])].sort((a, b) => a - b);
  let part = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const u0 = edges[i], u1 = edges[i + 1], center = (u0 + u1) / 2;
    const cuts = holes.filter(hole => hole.u0 < center && hole.u1 > center).sort((a, b) => a.v0 - b.v0);
    let bottom = -halfH;
    for (const cut of cuts) { if (cut.v0 > bottom + 1e-6) rectangle(u0, u1, bottom, cut.v0, `segment-${part++}`); bottom = Math.max(bottom, cut.v1); }
    if (bottom < halfH - 1e-6) rectangle(u0, u1, bottom, halfH, `segment-${part++}`);
  }
}
