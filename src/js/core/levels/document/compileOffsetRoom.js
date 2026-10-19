import wallOpenings from './WallOpenings.js';
import { FACES, MATERIALS, WALL_THICKNESS } from './LevelContent.js';
import { inverseOrient, portFrame, toWorld } from './RoomMath.js';
import { boxCorners } from '../../../utils/BoxTopology.js';

/** Convex shear of the rectangular shell. Only the two rectangular end caps
 * accept portals; sloped side faces stay solid and independently styleable.
 * @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {Map<string, {size: readonly [number, number], offset: readonly [number, number]}[]>} openings */
export default function compileOffsetRoom(room, openings) {
  /** @type {import('../../../levelDocument.js').SolidDefinition[]} */ const solids = [];
  const preset = MATERIALS[room.materialPreset];
  for (const face of FACES) {
    const frame = portFrame(room, face), style = room.surfaces?.[face];
    const color = style?.color ?? (frame.axis === 1 ? frame.direction < 0 ? preset.floor : preset.ceiling : preset.wall);
    /** @param {import('../../../levelDocument.js').Vec3[]} vertices @param {string} part */
    const add = (vertices, part) => {
      const min = [0, 1, 2].map(axis => Math.min(...vertices.map(point => point[axis]))), max = [0, 1, 2].map(axis => Math.max(...vertices.map(point => point[axis])));
      solids.push(Object.freeze({ id: `@solid/${room.id}/${face}/${part}`, color, ...(style ? { pattern: style.pattern } : {}),
        center: Object.freeze(/** @type {[number, number, number]} */ (min.map((value, axis) => (value + max[axis]) / 2))),
        size: Object.freeze(/** @type {[number, number, number]} */ (min.map((value, axis) => max[axis] - value))),
        vertices: Object.freeze(vertices.map(point => Object.freeze(point))) }));
    };
    if (!face.endsWith('Z')) {
      const axis = face.endsWith('X') ? 0 : 1, sign = face.startsWith('positive') ? 1 : -1;
      const center = [0, 0, 0], size = [...room.size]; center[axis] = sign * (size[axis] - WALL_THICKNESS) / 2; size[axis] = WALL_THICKNESS;
      add(boxCorners(center, size).map(point => toWorld(room, point)), 'wall'); continue;
    }
    /** @param {number} u0 @param {number} u1 @param {number} v0 @param {number} v1 @param {string} part */
    const rectangle = (u0, u1, v0, v1, part) => {
      const center = [...frame.center], size = [0, 0, 0];
      center[frame.axis] -= frame.direction * WALL_THICKNESS / 2;
      center[frame.u] += (u0 + u1) / 2; center[frame.v] += (v0 + v1) / 2;
      size[frame.axis] = WALL_THICKNESS; size[frame.u] = u1 - u0; size[frame.v] = v1 - v0;
      add(boxCorners(center, size).map(point => {
        const local = inverseOrient(/** @type {[number, number, number]} */ (point.map((value, axis) => value - frame.center[axis])), room);
        local[2] += (face === 'positiveZ' ? 1 : -1) * room.size[2] / 2;
        return toWorld(room, local);
      }), part);
    };
    wallOpenings(frame.width, frame.height, openings.get(`${room.id}/${face}`) ?? [], rectangle);
  }
  return solids;
}
