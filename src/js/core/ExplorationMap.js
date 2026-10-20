import RoomNavigation from './levels/document/RoomNavigation.js';
import { openingFrame, toWorld } from './levels/document/RoomMath.js';

/** Session-local discovery; the authored document is never modified. */
export default class ExplorationMap {
  /** @param {import('../levelDocument.js').LevelDocument} document */
  constructor(document) {
    this.document = document;
    this.navigation = new RoomNavigation(document);
    /** @type {Set<string>} */ this.visited = new Set();
    /** @type {string | null} */ this.current = null;
    this.outlines = new Map(document.rooms.map(room => [room.id,
      Array.from({ length: 8 }, (_, i) => toWorld(room, /** @type {[number, number, number]} */ (
        room.size.map((size, axis) => size * ((i >> axis & 1) ? 0.5 : -0.5)))))]));
  }
  /** @param {import('three').Vector3} position */
  update(position) {
    this.current = this.navigation.roomAt(position);
    if (this.current) this.visited.add(this.current);
  }
}

/** Fixed isometric survey preserves height, including shafts and tilted rooms.
 * Only entered rooms and links between them are disclosed.
 * @param {CanvasRenderingContext2D} ctx @param {ExplorationMap | null} map
 * @param {import('three').Vector3} position @param {import('three').Vector3} forward
 * @param {ReadonlySet<string>} closed @param {number} width @param {number} height */
export function drawExploration(ctx, map, position, forward, closed, width, height) {
  ctx.fillStyle = '#04131d'; ctx.fillRect(0, 0, width, height);
  if (!map || !map.visited.size) {
    ctx.fillStyle = '#8cb1bd'; ctx.font = '16px monospace';
    ctx.fillText('NO ROOM SURVEY', 20, height / 2);
    return;
  }
  const project = (/** @type {readonly number[]} */ p) => [p[0] * 0.86 - p[2] * 0.5, p[0] * 0.25 + p[2] * 0.43 - p[1]];
  const rooms = map.document.rooms.filter(room => map.visited.has(room.id));
  const points = rooms.flatMap(room => map.outlines.get(room.id) ?? []).map(project);
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const scale = Math.min((width - 56) / Math.max(1, maxX - minX), (height - 56) / Math.max(1, maxY - minY));
  const screen = (/** @type {readonly number[]} */ p) => {
    const [x, y] = project(p);
    return [width / 2 + (x - (minX + maxX) / 2) * scale, height / 2 + (y - (minY + maxY) / 2) * scale];
  };
  const line = (/** @type {number[]} */ a, /** @type {number[]} */ b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  ctx.lineWidth = 1.2;
  for (const room of rooms) {
    const corners = map.outlines.get(room.id) ?? [];
    ctx.strokeStyle = room.id === map.current ? '#81f5df' : '#326c7c';
    for (let i = 0; i < 8; i++) for (let axis = 0; axis < 3; axis++) {
      const j = i ^ (1 << axis);
      if (i < j) line(screen(corners[i]), screen(corners[j]));
    }
  }
  for (const link of map.document.connections) {
    if (!map.visited.has(link.a.roomId) || !map.visited.has(link.b.roomId)) continue;
    const a = map.navigation.rooms.get(link.a.roomId)?.room, b = map.navigation.rooms.get(link.b.roomId)?.room;
    if (!a || !b) continue;
    ctx.strokeStyle = closed.has(link.id) ? '#ffae58' : '#62c4de';
    ctx.lineWidth = 2; ctx.setLineDash(closed.has(link.id) ? [4, 4] : []);
    line(screen(a.position), screen(b.position));
  }
  ctx.setLineDash([]);
  // A visited room reveals its field boundary without disclosing the room
  // beyond it. Relay markers appear only after entering their own room.
  const doors = map.document.formatVersion === 1 ? [] : map.document.doors;
  const fields = doors.filter(door => door.kind === 'force-field');
  ctx.lineWidth = 2;
  for (const field of fields) {
    const link = map.document.connections.find(link => link.id === field.connectionId);
    if (!link || ![link.a.roomId, link.b.roomId].some(id => map.visited.has(id))) continue;
    const room = map.navigation.rooms.get(link.a.roomId)?.room; if (!room) continue;
    const [x, y] = screen(openingFrame(room, link.a).center);
    ctx.strokeStyle = closed.has(link.id) ? '#65f4ff' : '#45ff96';
    line([x - 4, y - 6], [x - 4, y + 6]); line([x + 4, y - 6], [x + 4, y + 6]);
  }
  for (const device of map.document.formatVersion === 1 ? [] : map.document.devices) {
    const controlled = fields.filter(field => field.deviceId === device.id);
    const room = map.navigation.rooms.get(device.roomId)?.room;
    if (!controlled.length || !room || !map.visited.has(device.roomId)) continue;
    const [x, y] = screen(toWorld(room, device.position));
    ctx.strokeStyle = controlled.some(field => closed.has(field.connectionId)) ? '#65f4ff' : '#45ff96';
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.stroke();
    if (width > 500) { ctx.fillStyle = ctx.strokeStyle; ctx.font = '11px monospace'; ctx.fillText(device.label, x + 9, y - 7); }
  }
  const player = screen(position.toArray()), heading = screen(position.clone().addScaledVector(forward, 20 / scale).toArray());
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; line(player, heading);
  const angle = Math.atan2(heading[1] - player[1], heading[0] - player[0]);
  for (const turn of [-0.6, 0.6]) line(heading, [heading[0] - Math.cos(angle + turn) * 7, heading[1] - Math.sin(angle + turn) * 7]);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(player[0], player[1], 4, 0, Math.PI * 2); ctx.fill();
}
