import { Box3, BufferGeometry, Float32BufferAttribute, Plane, Triangle, Vector3 } from 'three';
import { BOX_FACES } from './BoxTopology.js';

/** Affine box hull: the same eight points generate rendering and collision.
 * @param {readonly import('../levelDocument.js').Vec3[]} points
 * @returns {import('../contracts.js').ConvexHull} */
export function convexHull(points) {
  const vertices = points.map(point => new Vector3(...point));
  const planes = [], triangles = [];
  for (const [a, b, c, d] of Object.values(BOX_FACES)) {
    planes.push(new Plane().setFromCoplanarPoints(vertices[a], vertices[b], vertices[c]));
    triangles.push(new Triangle(vertices[a], vertices[b], vertices[c]), new Triangle(vertices[a], vertices[c], vertices[d]));
  }
  return { vertices, planes, triangles, box: new Box3().setFromPoints(vertices) };
}

/** Flat shaded world-space geometry, with deterministic world-plane UVs.
 * @param {readonly import('../levelDocument.js').Vec3[]} points */
export function convexGeometry(points) {
  const positions = [], uv = [];
  for (const indices of Object.values(BOX_FACES)) {
    const [a, b, c, d] = indices, normal = new Triangle(...[a, b, c].map(index => new Vector3(...points[index]))).getNormal(new Vector3());
    const components = normal.toArray().map(Math.abs), axis = components.indexOf(Math.max(...components));
    const u = axis === 0 ? 2 : 0, v = axis === 1 ? 2 : 1;
    for (const index of [a, b, c, a, c, d]) { positions.push(...points[index]); uv.push(points[index][u] / 4, points[index][v] / 4); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Exact sphere/convex-polyhedron contact, including rounded edges/corners.
 * @param {Vector3} position @param {number} radius @param {import('../contracts.js').ConvexHull} hull */
export function convexContact(position, radius, hull) {
  if (hull.box.distanceToPoint(position) >= radius) return null;
  const distances = hull.planes.map(plane => plane.distanceToPoint(position));
  const closest = Math.max(...distances);
  if (closest <= 1e-10) return { normal: hull.planes[distances.indexOf(closest)].normal.clone(), depth: radius - closest };
  const nearest = new Vector3(), candidate = new Vector3(); let squared = Infinity;
  for (const triangle of hull.triangles) {
    triangle.closestPointToPoint(position, candidate);
    const value = position.distanceToSquared(candidate);
    if (value < squared) { squared = value; nearest.copy(candidate); }
  }
  const distance = Math.sqrt(squared);
  if (distance >= radius) return null;
  return { normal: position.clone().sub(nearest).divideScalar(distance), depth: radius - distance };
}

/** Segment clipped against all outward planes. Radius expands face planes,
 * retaining the existing shot system's conservative edge clearance.
 * @param {Vector3} start @param {Vector3} end @param {import('../contracts.js').ConvexHull} hull @param {number} radius */
export function convexSegmentFraction(start, end, hull, radius) {
  let enter = 0, leave = 1;
  for (const plane of hull.planes) {
    const a = plane.distanceToPoint(start) - radius, b = plane.distanceToPoint(end) - radius, travel = b - a;
    if (Math.abs(travel) < 1e-12) { if (a > 0) return null; continue; }
    const fraction = -a / travel;
    if (travel < 0) enter = Math.max(enter, fraction); else leave = Math.min(leave, fraction);
    if (enter > leave) return null;
  }
  return enter;
}
