import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import compileLevelDocument from '../core/levels/document/compileLevelDocument.js';
import buildArena from '../core/ArenaGeometry.js';
import { openingFrame, portFrame, roomsOverlap, toWorld } from '../core/levels/document/RoomMath.js';
import disposeObject from '../utils/disposeObject.js';

export default class EditorViewport {
  /** @param {HTMLElement} host @param {(id: string) => void} select
   * @param {(id: string, values: {position: number[], yaw: number}) => void} commit */
  constructor(host, select, commit) {
    this.host = host; this.select = select; this.commit = commit;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.domElement.setAttribute('aria-label', '3D level viewport');
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x101923);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
    this.camera.position.set(32, 28, 32);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxDistance = 1500; this.controls.minDistance = 3;
    this.controls.addEventListener('change', () => this.render());
    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setTranslationSnap(0.5); this.transform.setRotationSnap(Math.PI / 2);
    this.transform.showY = true;
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener('change', () => this.render());
    this.transform.addEventListener('dragging-changed', event => { this.controls.enabled = !event.value; });
    this.transform.addEventListener('mouseUp', () => {
      const object = this.transform.object;
      if (object) this.commit(String(object.userData.roomId), {
        position: object.position.toArray().map(value => Math.round(value * 2) / 2),
        yaw: ((Math.round(object.rotation.y / (Math.PI / 2)) * 90) % 360 + 360) % 360,
      });
    });
    this.world = new THREE.Group(); this.scene.add(this.world);
    /** @type {THREE.Mesh[]} */ this.rooms = [];
    this.selected = '';
    this.mode = 'select';
    /** @type {'xray' | 'cutaway' | 'solid'} */ this.view = 'xray';
    /** @type {import('../levelDocument.js').LevelDocument | null} */ this.document = null;
    this.grid = new THREE.GridHelper(256, 128, 0x3a5b72, 0x203347); this.scene.add(this.grid);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    this.events = new AbortController();
    /** @type {{x: number, y: number} | null} */ let down = null;
    this.renderer.domElement.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; }, { signal: this.events.signal });
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (event.button !== 0 || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4 || this.transform.axis) return;
      const bounds = this.renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
      const hit = ray.intersectObjects(this.rooms, false)[0];
      if (hit) this.select(String(hit.object.userData.roomId));
      down = null;
    }, { signal: this.events.signal });
    this.resize();
  }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.render();
  }
  render() { this.renderer.render(this.scene, this.camera); }
  /** @param {import('../levelDocument.js').LevelDocument} document */
  show(document) {
    this.document = document;
    this.transform.detach(); disposeObject(this.world); this.scene.remove(this.world);
    this.world = new THREE.Group(); this.scene.add(this.world); this.rooms = [];
    // Only the shared compiler generates walls/openings. Invalid drafts use
    // outlines until corrected; they never display stale valid-world geometry.
    try {
      const arena = buildArena(compileLevelDocument(document));
      arena.group.traverse(object => {
        if (object instanceof THREE.Mesh) {
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
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'LevelDocumentError') throw error;
    }
    for (const room of document.rooms) {
      const overlaps = document.rooms.some(other => other.id !== room.id && roomsOverlap(room, other));
      const box = new THREE.BoxGeometry(...room.size);
      const proxy = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: overlaps, color: 0xff384b, transparent: true, opacity: 0.22, depthWrite: false }));
      proxy.position.fromArray(room.position); proxy.rotation.y = room.yaw * Math.PI / 180; proxy.userData.roomId = room.id; proxy.userData.overlaps = overlaps;
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
    }
    for (const placement of [
      { ...document.playerSpawn, kind: 'spawn' }, ...document.entities,
      ...(document.formatVersion !== 1 ? document.devices.map(device => ({ ...device, kind: 'relay' })) : []),
    ]) {
      const room = rooms.get(placement.roomId); if (!room) continue;
      const colors = { spawn: 0x60dbff, enemy: 0xff7171, pickup: 0x9be16a, exit: 0xffc16e, relay: 0xc29cff };
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), new THREE.MeshBasicMaterial({ color: colors[/** @type {keyof typeof colors} */ (placement.kind)] }));
      marker.position.fromArray(toWorld(room, placement.position)); this.world.add(marker);
    }
    this.setSelection(this.selected); this.render();
  }
  /** @param {string} id */
  setSelection(id) {
    this.selected = id;
    this.transform.detach();
    for (const proxy of this.rooms) {
      const edges = /** @type {THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>} */ (proxy.children[0]);
      edges.material.color.setHex(proxy.userData.overlaps ? 0xff5f69 : proxy.userData.roomId === id ? 0xffc16e : 0x7d9aaf);
      if (proxy.userData.roomId === id && this.mode !== 'select') this.transform.attach(proxy);
    }
    this.render();
  }
  /** @param {'select' | 'translate' | 'rotate'} mode */
  setMode(mode) {
    this.mode = mode;
    if (mode !== 'select') this.transform.setMode(mode);
    this.transform.showX = mode !== 'rotate'; this.transform.showY = true; this.transform.showZ = mode !== 'rotate';
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
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(Math.max(20, size * 1.25)));
    this.controls.update(); this.render();
  }
  dispose() {
    this.events.abort(); this.observer.disconnect(); this.transform.dispose(); this.controls.dispose();
    disposeObject(this.world); disposeObject(this.grid); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
