import RoomNavigation from './RoomNavigation.js';

/** Read-only navigation hints from the same validated graph used for flight and AI. */
export default class MineGuide {
  /** @param {import('../../../levelDocument.js').LevelDocument} document */
  constructor(document) {
    this.document = document;
    this.navigation = new RoomNavigation(document);
    this.rooms = new Map(document.rooms.map(room => [room.id, room]));
  }

  /** IDs are already bounded plain text. No separate, drifting room-name registry.
   * @param {string} id */
  roomName(id) {
    const room = this.rooms.get(id);
    const color = { 'industrial-blue': 'Blue', 'industrial-red': 'Amber', 'industrial-green': 'Green' }[room?.materialPreset ?? 'industrial-blue'];
    return `${color} ${id.replace(/[:_-]+/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase())}`;
  }

  /** @param {import('three').Vector3} position @param {ReadonlySet<string>} activated
   * @param {ReadonlySet<string>} closed */
  describe(position, activated, closed) {
    const current = this.navigation.roomAt(position);
    if (!current) return '';
    // Breadth first search matches the portal graph, including rotated rooms and hatches.
    /** @type {Map<string, {first: string, vertical: number}>} */
    const routes = new Map();
    routes.set(current, { first: current, vertical: 0 });
    const queue = [current];
    for (let i = 0; i < queue.length; i++) {
      const from = queue[i];
      for (const edge of this.navigation.edges.get(from) ?? []) {
        if (closed.has(edge.id) || routes.has(edge.to)) continue;
        const previous = routes.get(from);
        if (!previous) continue;
        routes.set(edge.to, from === current ? { first: edge.to, vertical: edge.normal.y } : previous);
        queue.push(edge.to);
      }
    }
    const devices = this.document.formatVersion !== 1 ? this.document.devices : [];
    // Pick the closest reachable pending relay, rather than assuming array order is progression order.
    const target = queue.flatMap(roomId => devices.filter(device => device.roomId === roomId && !activated.has(device.id)))[0];
    const exit = this.document.entities.find(entity => entity.id === this.document.mission.exitId);
    const roomId = target?.roomId ?? exit?.roomId;
    const destination = target ? `${target.kind === 'reactor' ? 'Shoot reactor: ' : ''}${target.label} in ${this.roomName(target.roomId)}` : exit ? `Exit in ${this.roomName(exit.roomId)}` : '';
    const route = roomId ? routes.get(roomId) : null;
    const next = route && route.first !== current ? ` · Next: ${route.vertical > 0 ? 'ceiling hatch' : route.vertical < 0 ? 'floor hatch' : 'passage'} to ${this.roomName(route.first)}` : '';
    return `Location: ${this.roomName(current)} · ${destination}${next}${!route ? ' · Route locked: find a reachable cyan relay' : ''}`;
  }
}
