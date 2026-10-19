import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import compileLevelDocument from '../core/levels/document/compileLevelDocument.js';
import buildArena from '../core/ArenaGeometry.js';
import { openingFrame, orient, portFrame, shear, toWorld } from '../core/levels/document/RoomMath.js';
import { overlappingRoomIds } from '../core/levels/document/RoomOverlap.js';
import validateSemantics from '../core/levels/document/validateSemantics.js';
import resizeRoom from './ResizeRoom.js';
import { boxCorners, BOX_FACES } from '../utils/BoxTopology.js';
import { convexGeometry } from '../utils/ConvexSolid.js';
import disposeObject from '../utils/disposeObject.js';
import { snappedAngles, toLocal } from './EditorPicking.js';

export default class EditorViewport {
  /** @param {HTMLElement} host @param {(id: string) => void} select
   * @param {(id: string, values: {position: number[], yaw: number, pitch: number, roll: number}) => void} commit
   * @param {{selectTarget?: (target: import('./EditorPicking.js').ViewportTarget) => void, context?: (target: import('./EditorPicking.js').ViewportTarget) => void, dismiss?: () => void, resize?: (id: string, size: number[]) => void, resizePreview?: (size: number[], error?: string) => void}} [interaction] */
  constructor(host, select, commit, interaction = {}) {
    this.host = host; this.select = select; this.commit = commit;
    this.interaction = interaction;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.domElement.setAttribute('aria-label', '3D level viewport');
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x101923);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
    this.camera.position.set(32, 28, 32);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxDistance = 1500; this.controls.minDistance = 3;
    this.controls.addEventListener('change', () => { this.interaction.dismiss?.(); this.render(); });
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setTranslationSnap(0.5); this.transform.setRotationSnap(Math.PI / 2);
    this.transform.showY = true;
    this.scene.add(this.transform.getHelper());
    this.resizePivot = new THREE.Object3D(); this.scene.add(this.resizePivot);
    this.transform.addEventListener('objectChange', () => { if (this.mode === 'resize') this.previewResize(); });
    this.transform.addEventListener('change', () => this.render());
    this.transform.addEventListener('dragging-changed', event => { this.controls.enabled = !event.value; });
    this.transform.addEventListener('mouseUp', () => {
      const object = this.transform.object;
      if (object && this.mode === 'resize') { const size = this.resizeDimensions(); if (size) this.interaction.resize?.(String(object.userData.roomId), size); return; }
      if (object) this.commit(String(object.userData.roomId), {
        position: object.position.toArray().map(value => { const steps = this.document?.formatVersion === 6 ? 4 : 2; return Math.round(value * steps) / steps; }),
        ...snappedAngles(object.quaternion, this.document?.rooms.find(room => room.id === object.userData.roomId)),
      });
    });
    this.world = new THREE.Group(); this.scene.add(this.world);
    /** @type {THREE.Group | null} */ this.arenaGroup = null;
    /** @type {Map<string, THREE.LineSegments>} */ this.passages = new Map();
    /** @type {THREE.Mesh[]} */ this.rooms = [];
    /** @type {THREE.Mesh[]} */ this.walls = [];
    /** @type {THREE.Mesh[]} */ this.markers = [];
    /** @type {import('../levelDocument.js').Face | null} */ this.selectedFace = null;
    this.selectedContent = '';
    this.selectionOverlay = new THREE.Group(); this.scene.add(this.selectionOverlay);
    this.placementOverlay = new THREE.Group(); this.scene.add(this.placementOverlay);
    this.selected = '';
    this.mode = 'select';
    /** @type {'xray' | 'cutaway' | 'solid'} */ this.view = 'xray';
    /** @type {import('../levelDocument.js').LevelDocument | null} */ this.document = null;
    this.grid = new THREE.GridHelper(256, 128, 0x3a5b72, 0x203347); this.scene.add(this.grid);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    this.events = new AbortController();
    /** @type {{x: number, y: number} | null} */ let down = null;
    let dragged = false;
    this.renderer.domElement.addEventListener('pointerdown', event => { this.interaction.dismiss?.(); down = { x: event.clientX, y: event.clientY }; dragged = false; }, { signal: this.events.signal });
    this.renderer.domElement.addEventListener('pointermove', event => { if (down && event.buttons && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) dragged = true; }, { signal: this.events.signal });
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (event.button === 2) {
        if (!dragged) { const target = this.pick(event.clientX, event.clientY); if (target) this.interaction.context?.(target); }
        down = null; return;
      }
      if (event.button !== 0 || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4 || this.transform.axis) return;
      const target = this.pick(event.clientX, event.clientY);
      if (target) {
        if (this.interaction.selectTarget) this.interaction.selectTarget(target);
        else this.select(target.roomId);
      }
      down = null;
    }, { signal: this.events.signal });
    this.renderer.domElement.addEventListener('contextmenu', event => {
      event.preventDefault();
      // Native contextmenu may fire on mouse-down. Only pointer-up opens the
      // mouse menu, leaving the complete right-drag gesture available to pan.
      if (!event.clientX && !event.clientY) { const target = this.keyboardTarget(); if (target) this.interaction.context?.(target); }
    }, { signal: this.events.signal });
    this.renderer.domElement.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const target = this.keyboardTarget(); if (target) this.interaction.context?.(target); }
    }, { signal: this.events.signal });
    this.resize();
  }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.render();
  }
  render() { this.renderer.render(this.scene, this.camera); }
  resizeDimensions() {
    const room = this.document?.rooms.find(room => room.id === this.resizePivot.userData.roomId);
    return room ? room.size.map((value, axis) => Math.max(4, Math.min(256, Math.round(value * this.resizePivot.scale.getComponent(axis) * 2) / 2))) : null;
  }
  previewResize() {
    const size = this.resizeDimensions(), room = this.document?.rooms.find(room => room.id === this.resizePivot.userData.roomId);
    const proxy = this.rooms.find(proxy => proxy.userData.roomId === room?.id);
    if (!size || !room || !proxy || !this.document) return;
    const candidate = /** @type {import('./DraftTypes.js').EditorLevelDocument} */ (structuredClone(this.document));
    const link = this.document?.connections.find(link => link.a.roomId === room.id || link.b.roomId === room.id);
    let error = '';
    try {
      resizeRoom(candidate, room.id, size, link?.id ?? 'center');
      if (candidate.rooms.some(room => room.position.some(value => Math.abs(value) > 4096))) throw new Error('Positions must stay within ±4096.');
      validateSemantics(candidate, (_path, _code, message) => { throw new Error(message); });
    } catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
    const resized = candidate.rooms.find(value => value.id === room.id); if (!resized) return;
    const geometry = room.endOffset ? convexGeometry(boxCorners([0, 0, 0], resized.size).map(point => shear(resized, point))) : new THREE.BoxGeometry(...resized.size);
    proxy.geometry.dispose(); proxy.geometry = geometry;
    const edges = /** @type {THREE.LineSegments} */ (proxy.children[0]); edges.geometry.dispose(); edges.geometry = new THREE.EdgesGeometry(geometry);
    // Hide old solid walls while the snapped outlines, portals and content show
    // the proposed connected layout. Rebuild real geometry only on commit.
    if (this.arenaGroup) this.arenaGroup.visible = false;
    this.selectionOverlay.visible = false;
    const layout = error ? this.document : candidate, rooms = new Map(layout.rooms.map(room => [room.id, room]));
    for (const outline of this.rooms) {
      const source = outline === proxy ? resized : rooms.get(String(outline.userData.roomId)); if (!source) continue;
      outline.position.fromArray(source.position);
      const lines = /** @type {THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>} */ (outline.children[0]);
      lines.material.color.setHex(outline === proxy ? error ? 0xff5f69 : 0xffc16e : 0x7d9aaf);
    }
    for (const connection of layout.connections) {
      const source = rooms.get(connection.a.roomId); if (source) this.passages.get(connection.id)?.position.fromArray(openingFrame(source, connection.a).center);
    }
    for (const item of [{ ...layout.playerSpawn, id: '@spawn' }, ...layout.entities, ...(layout.formatVersion === 1 ? [] : layout.devices)]) {
      const source = rooms.get(item.roomId), marker = this.markers.find(marker => marker.userData.contentId === item.id);
      if (source && marker) marker.position.fromArray(toWorld(source, item.position));
    }
    this.interaction.resizePreview?.(size, error || undefined); this.render();
  }
  /** @param {import('../levelDocument.js').LevelDocument} document */
  show(document) {
    this.document = document; this.transform.setTranslationSnap(document.formatVersion === 6 ? 0.25 : 0.5);
    this.arenaGroup = null; this.passages.clear();
    this.transform.detach(); disposeObject(this.world); this.scene.remove(this.world);
    this.world = new THREE.Group(); this.scene.add(this.world); this.rooms = []; this.walls = []; this.markers = [];
    // Only the shared compiler generates walls/openings. Invalid drafts use
    // outlines until corrected; they never display stale valid-world geometry.
    try {
      const level = compileLevelDocument(document), arena = buildArena(level);
      arena.group.traverse(object => {
        if (object instanceof THREE.Mesh) {
          if (object.name.startsWith('@solid/')) {
            const [, roomId, face] = object.name.split('/'); object.userData.roomId = roomId; object.userData.face = face; this.walls.push(object);
          } else {
            const door = level.doors?.find(door => door.id === object.name), connection = door && document.connections.find(connection => connection.id === door.connectionId);
            if (connection) { object.userData.roomId = connection.a.roomId; object.userData.face = connection.a.port; this.walls.push(object); }
          }
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.transparent = this.view === 'xray'; material.opacity = this.view === 'xray' ? 0.22 : 1; material.depthWrite = this.view !== 'xray';
          }
          if (this.view === 'cutaway' && object.name.startsWith('@solid/')) {
            const [, roomId, face] = object.name.split('/'), room = document.rooms.find(room => room.id === roomId);
            if (room && portFrame(room, /** @type {import('../levelDocument.js').Face} */ (face)).direction > 0) object.visible = false;
          }
        }
      });
      this.world.add(arena.group);
      this.arenaGroup = arena.group;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'LevelDocumentError') throw error;
    }
    const overlappingIds = overlappingRoomIds(document.rooms);
    for (const room of document.rooms) {
      const overlaps = overlappingIds.has(room.id);
      const box = room.endOffset ? convexGeometry(boxCorners([0, 0, 0], room.size).map(point => shear(room, point))) : new THREE.BoxGeometry(...room.size);
      const proxy = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: overlaps, color: 0xff384b, transparent: true, opacity: 0.22, depthWrite: false }));
      proxy.position.fromArray(room.position); proxy.rotation.set((room.pitch ?? 0) * Math.PI / 180, room.yaw * Math.PI / 180, (room.roll ?? 0) * Math.PI / 180, 'YXZ'); proxy.userData.roomId = room.id; proxy.userData.overlaps = overlaps;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: overlaps ? 0xff5f69 : room.id === this.selected ? 0xffc16e : 0x7d9aaf }));
      proxy.add(edges); this.world.add(proxy); this.rooms.push(proxy);
    }
    const rooms = new Map(document.rooms.map(room => [room.id, room]));
    for (const connection of document.connections) {
      const room = rooms.get(connection.a.roomId); if (!room) continue;
      const frame = openingFrame(room, connection.a);
      const size = [0.16, 0.16, 0.16]; size[frame.u] = connection.openingSize[0]; size[frame.v] = connection.openingSize[1];
      const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x48dbd2 }));
      geometry.dispose(); edges.position.fromArray(frame.center); this.world.add(edges);
      this.passages.set(connection.id, edges);
    }
    for (const placement of [
      { ...document.playerSpawn, id: '@spawn', kind: 'spawn' }, ...document.entities,
      ...(document.formatVersion !== 1 ? document.devices.map(device => ({ ...device, kind: 'relay' })) : []),
    ]) {
      const room = rooms.get(placement.roomId); if (!room) continue;
      const colors = { spawn: 0x60dbff, enemy: 0xff7171, pickup: 0x9be16a, exit: 0xffc16e, relay: 0xc29cff };
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), new THREE.MeshBasicMaterial({ color: colors[/** @type {keyof typeof colors} */ (placement.kind)] }));
      marker.position.fromArray(toWorld(room, placement.position)); marker.userData.roomId = room.id; marker.userData.contentId = placement.id;
      this.world.add(marker); this.markers.push(marker);
    }
    this.setSelection(this.selected); this.render();
  }
  /** @param {string} id */
  setSelection(id) {
    if (this.selected !== id) this.selectedFace = null;
    this.selected = id;
    this.transform.detach();
    for (const proxy of this.rooms) {
      const edges = /** @type {THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>} */ (proxy.children[0]);
      edges.material.color.setHex(proxy.userData.overlaps ? 0xff5f69 : proxy.userData.roomId === id ? 0xffc16e : 0x7d9aaf);
      if (proxy.userData.roomId === id && this.mode !== 'select') {
        if (this.mode === 'resize') { this.resizePivot.position.copy(proxy.position); this.resizePivot.quaternion.copy(proxy.quaternion); this.resizePivot.scale.set(1, 1, 1); this.resizePivot.userData.roomId = id; this.transform.attach(this.resizePivot); }
        else this.transform.attach(proxy);
      }
    }
    this.drawSelection();
    this.render();
  }
  /** @param {import('../levelDocument.js').Face | null} face @param {string} [contentId] */
  setDetailSelection(face, contentId = '') {
    this.selectedFace = face; this.selectedContent = contentId; this.drawSelection(); this.render();
  }
  drawSelection() {
    disposeObject(this.selectionOverlay); this.selectionOverlay = new THREE.Group(); this.scene.add(this.selectionOverlay);
    for (const marker of this.markers) marker.scale.setScalar(marker.userData.contentId === this.selectedContent ? 1.5 : 1);
    const room = this.document?.rooms.find(room => room.id === this.selected);
    if (!room || !this.selectedFace) return;
    const frame = portFrame(room, this.selectedFace);
    let geometry = /** @type {THREE.BufferGeometry} */ (new THREE.PlaneGeometry(frame.width - 1, frame.height - 1));
    if (room.endOffset) {
      geometry.dispose();
      const normalAxis = this.selectedFace.endsWith('X') ? 0 : this.selectedFace.endsWith('Y') ? 1 : 2;
      const corners = boxCorners([0, 0, 0], room.size.map((value, axis) => value - (axis === normalAxis ? 0 : 1)));
      const points = BOX_FACES[this.selectedFace].map(index => new THREE.Vector3(...toWorld(room, corners[index])).addScaledVector(new THREE.Vector3(...frame.normal), -0.51));
      geometry = new THREE.BufferGeometry().setFromPoints([points[0], points[1], points[2], points[0], points[2], points[3]]);
    }
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x72e8f0, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    if (!room.endOffset) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...frame.normal));
      // PlaneGeometry's first axis follows the canonical opening U direction.
      if (frame.axis === 1) mesh.rotation.z += Math.PI;
      mesh.position.fromArray(frame.center).addScaledVector(new THREE.Vector3(...frame.normal), -0.51);
    }
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x72e8f0, depthTest: false })));
    this.selectionOverlay.add(mesh);
  }
  /** @param {number} clientX @param {number} clientY */
  pick(clientX, clientY) {
    if (!this.document) return null;
    const bounds = this.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(); this.scene.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1, -(clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
    /** @param {THREE.Object3D} object */
    const visible = object => { for (let node = /** @type {THREE.Object3D | null} */ (object); node; node = node.parent) if (!node.visible) return false; return true; };
    const hits = ray.intersectObjects([...this.walls.filter(visible), ...this.markers], false);
    const hit = (this.view === 'xray' ? hits.find(hit => hit.object.userData.contentId) : null) ?? hits[0];
    const fallback = hit ?? ray.intersectObjects(this.rooms, false)[0]; if (!fallback) return null;
    const roomId = String(fallback.object.userData.roomId), room = this.document.rooms.find(room => room.id === roomId); if (!room) return null;
    let point = fallback.point;
    if (!hit) {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...orient([0, 1, 0], room)), new THREE.Vector3(...room.position));
      const centerPlane = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (centerPlane && toLocal(room, centerPlane.toArray()).every((value, axis) => Math.abs(value) < room.size[axis] / 2)) point = centerPlane;
    }
    return { roomId, localPoint: toLocal(room, point.toArray()), clientX, clientY,
      ...(hit?.object.userData.face ? { face: /** @type {import('../levelDocument.js').Face} */ (hit.object.userData.face) } : {}),
      ...(hit?.object.userData.contentId ? { contentId: String(hit.object.userData.contentId) } : {}) };
  }
  keyboardTarget() {
    if (!this.selected) return null;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    return { roomId: this.selected, localPoint: [0, 0, 0], clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2, ...(this.selectedFace ? { face: this.selectedFace } : {}) };
  }
  /** @param {string} roomId @param {number[] | null} point @param {boolean} [valid] */
  showPlacement(roomId, point, valid = true) {
    disposeObject(this.placementOverlay); this.placementOverlay = new THREE.Group(); this.scene.add(this.placementOverlay);
    const room = this.document?.rooms.find(room => room.id === roomId);
    if (room && point) {
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: valid ? 0xffffff : 0xff4d66, depthTest: false, depthWrite: false }));
      marker.position.fromArray(toWorld(room, /** @type {[number, number, number]} */ (point))); this.placementOverlay.add(marker);
    }
    this.render();
  }
  /** @param {'select' | 'translate' | 'rotate' | 'resize'} mode */
  setMode(mode) {
    this.mode = mode;
    if (mode !== 'select') this.transform.setMode(mode === 'resize' ? 'scale' : mode);
    this.transform.setSpace(mode === 'resize' ? 'local' : 'world');
    this.transform.showX = true; this.transform.showY = true; this.transform.showZ = true;
    this.setSelection(this.selected);
  }
  /** @param {'xray' | 'cutaway' | 'solid'} view */
  setView(view) {
    this.view = view; this.grid.visible = view === 'xray';
    if (this.document) this.show(this.document);
  }
  /** @param {boolean} [selectedOnly] */
  frame(selectedOnly = false) {
    const targets = selectedOnly ? this.rooms.filter(room => room.userData.roomId === this.selected) : this.rooms;
    const bounds = new THREE.Box3();
    for (const room of targets) bounds.union(new THREE.Box3().setFromObject(room));
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3()).length();
    this.camera.far = Math.max(3000, size * 8); this.camera.updateProjectionMatrix(); this.controls.maxDistance = Math.max(1500, size * 4);
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(Math.max(20, size * 1.25)));
    this.controls.update(); this.render();
  }
  dispose() {
    this.events.abort(); this.observer.disconnect(); this.transform.dispose(); this.controls.dispose();
    disposeObject(this.world); disposeObject(this.grid); disposeObject(this.selectionOverlay); disposeObject(this.placementOverlay); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
