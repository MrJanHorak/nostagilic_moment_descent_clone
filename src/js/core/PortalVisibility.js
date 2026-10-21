import { Matrix4, Mesh, Vector3, Vector4 } from 'three';
import RoomNavigation from './levels/document/RoomNavigation.js';
import { openingFrame } from './levels/document/RoomMath.js';

/** Conservative portal rectangles, written independently for the WebGL mine.
 * Bounding windows can overdraw; they never intentionally clip a visible room.
 * Physics, discovery and simulation are independent of these render layers. */
export default class PortalVisibility {
  /** @param {import('../levelDocument.js').LevelDocument} document @param {import('three').Object3D} root */
  constructor(document, root) {
    this.navigation = new RoomNavigation(document);
    /** @type {Map<string, {to: string, corners: Vector4[], axis: number, plane: number}[]>} */ this.edges = new Map(document.rooms.map(room => [room.id, []]));
    for (const link of document.connections) {
      const room = this.navigation.rooms.get(link.a.roomId)?.room; if (!room) continue;
      const frame = openingFrame(room, link.a);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
        const p = [...frame.center]; p[frame.u] += u * link.openingSize[0] / 2; p[frame.v] += v * link.openingSize[1] / 2;
        return new Vector4(...p, 1);
      });
      this.edges.get(link.a.roomId)?.push({ to: link.b.roomId, corners, axis: frame.axis, plane: frame.center[frame.axis] });
      this.edges.get(link.b.roomId)?.push({ to: link.a.roomId, corners, axis: frame.axis, plane: frame.center[frame.axis] });
    }
    const owners = new Map();
    if (document.formatVersion !== 1) {
      for (const device of document.devices) owners.set(device.id, [device.roomId]);
      for (const door of document.doors) {
        const link = document.connections.find(link => link.id === door.connectionId); if (link) owners.set(door.id, [link.a.roomId, link.b.roomId]);
      }
    }
    for (const entity of document.entities) owners.set(entity.id, [entity.roomId]);
    /** @type {{mesh: Mesh, rooms: string[]}[]} */ this.bindings = [];
    for (const child of root.children) {
      const rooms = child.name.startsWith('@solid/') || child.name.startsWith('@detail/') ? [child.name.split('/')[1]] : owners.get(child.name);
      if (rooms) child.traverse(mesh => { if (mesh instanceof Mesh) this.bindings.push({ mesh, rooms }); });
    }
    this.visibleRooms = new Set(this.navigation.rooms.keys()); this.culledMeshes = 0;
  }

  /** Near-plane clipping is essential when the camera crosses a doorway.
   * @param {Vector4[]} corners @param {Matrix4} transform */
  window(corners, transform) {
    let polygon = corners.map(p => p.clone().applyMatrix4(transform));
    for (const distance of [(/** @type {Vector4} */ p) => p.z + p.w, (/** @type {Vector4} */ p) => p.w - 1e-5]) {
      /** @type {Vector4[]} */ const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
        if (da >= 0) clipped.push(a);
        if ((da < 0) !== (db < 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = clipped;
    }
    if (!polygon.length) return null;
    return [Math.max(-1, Math.min(...polygon.map(p => p.x / p.w))), Math.min(1, Math.max(...polygon.map(p => p.x / p.w))),
      Math.max(-1, Math.min(...polygon.map(p => p.y / p.w))), Math.min(1, Math.max(...polygon.map(p => p.y / p.w)))];
  }

  /** @param {import('three').Camera} camera */
  update(camera) {
    camera.updateWorldMatrix(true, false);
    const position = camera.getWorldPosition(new Vector3()), current = this.navigation.roomAt(position);
    if (!current) this.visibleRooms = new Set(this.navigation.rooms.keys()); // External/outside camera: fail open.
    else {
      const transform = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const windows = new Map([[current, [-1, 1, -1, 1]]]), queue = [current];
      const projected = new Map();
      for (let i = 0; i < queue.length && i < 4096; i++) {
        const from = queue[i], parent = windows.get(from); if (!parent) continue;
        for (const edge of this.edges.get(from) ?? []) {
          let bounds = projected.get(edge.corners);
          if (bounds === undefined) {
            const near = 'near' in camera && typeof camera.near === 'number' ? camera.near : 0.1;
            // Before the eye crosses a portal, that whole plane can already be
            // behind the camera near plane. Keep its neighbor through this seam.
            bounds = Math.abs(position.getComponent(edge.axis) - edge.plane) <= near + 0.02 ? [-1, 1, -1, 1] : this.window(edge.corners, transform);
            projected.set(edge.corners, bounds);
          }
          if (!bounds) continue;
          const visible = [Math.max(parent[0], bounds[0]), Math.min(parent[1], bounds[1]), Math.max(parent[2], bounds[2]), Math.min(parent[3], bounds[3])];
          if (visible[0] > visible[1] || visible[2] > visible[3]) continue;
          const old = windows.get(edge.to);
          if (old && visible[0] >= old[0] - 1e-6 && visible[1] <= old[1] + 1e-6 && visible[2] >= old[2] - 1e-6 && visible[3] <= old[3] + 1e-6) continue;
          windows.set(edge.to, old ? [Math.min(old[0], visible[0]), Math.max(old[1], visible[1]), Math.min(old[2], visible[2]), Math.max(old[3], visible[3])] : visible);
          queue.push(edge.to);
        }
      }
      this.visibleRooms = new Set(queue.length >= 4096 ? this.navigation.rooms.keys() : windows.keys());
    }
    this.culledMeshes = 0;
    for (const { mesh, rooms } of this.bindings) {
      const visible = rooms.some(room => this.visibleRooms.has(room));
      if (visible) mesh.layers.enable(0); else { mesh.layers.disable(0); this.culledMeshes++; }
    }
  }
}
