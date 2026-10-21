import { Vector3 } from 'three';
import { drawExploration } from '../core/ExplorationMap.js';

/** Shared enlarged survey for all three flight views. M leaves flight active. */
export default class NavigationDisplay {
  constructor() {
    this.expanded = false;
    this.element = document.createElement('aside'); this.element.id = 'exploration-map';
    this.element.setAttribute('aria-label', 'Explored areas map'); this.element.hidden = true;
    Object.assign(this.element.style, { position: 'fixed', inset: '12% 14% 24%', zIndex: '110',
      background: '#04131df5', border: '1px solid #45798a', borderRadius: '8px', padding: '16px',
      color: '#bfe7eb', font: '13px/1.5 monospace', pointerEvents: 'none', boxShadow: '0 12px 70px #000a',
      boxSizing: 'border-box' });
    this.title = document.createElement('div'); this.title.textContent = 'EXPLORED VOLUME';
    this.canvas = document.createElement('canvas'); this.canvas.width = 1000; this.canvas.height = 540;
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { width: '100%', height: 'calc(100% - 70px)', display: 'block' });
    this.legend = document.createElement('div');
    this.legend.textContent = 'White: ship · Mint: current room · Blue: visited · Amber dashed: locked link · Cyan bars/diamond: field/control · Orange diamond: reactor · Green: disabled · M close · Flight remains active';
    this.element.append(this.title, this.legend); document.body.appendChild(this.element);
    this.summary = document.createElement('div'); this.summary.id = 'cockpit-instruments';
    this.summary.setAttribute('aria-label', 'Cockpit instruments');
    Object.assign(this.summary.style, { position: 'absolute', top: '0', left: '0', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
    document.body.appendChild(this.summary);
    this.lastUpdate = -Infinity;
  }
  toggle() {
    this.expanded = !this.expanded; this.lastUpdate = -Infinity;
    if (this.expanded) this.element.insertBefore(this.canvas, this.legend);
    else this.canvas.remove();
  }
  reset() { this.expanded = false; this.element.hidden = true; this.canvas.remove(); this.summary.hidden = true; this.lastUpdate = -Infinity; }

  /** @param {import('../core/GameState.js').default} state
   * @param {import('../entities/Spaceship.js').default} ship
   * @param {import('../core/ExplorationMap.js').default | null} map
   * @param {ReadonlySet<string>} closed @param {boolean} playing @param {boolean} cockpit @param {boolean} instruments */
  update(state, ship, map, closed, playing, cockpit, instruments) {
    this.element.hidden = !playing || !this.expanded;
    this.summary.hidden = !playing || !cockpit || !instruments;
    // DOM/canvas work is bounded to 10 Hz, independent of the simulation rate.
    if (state.session.timeMs >= this.lastUpdate && state.session.timeMs - this.lastUpdate < 100) return;
    this.lastUpdate = state.session.timeMs;
    const room = map?.current?.replaceAll('-', ' ') ?? 'Uncharted space';
    this.title.textContent = `EXPLORED VOLUME · ${map?.visited.size ?? 0} / ${map?.document.rooms.length ?? 0} rooms · ${room}`;
    const inventory = Object.entries(state.weaponInventory).map(([type, weapon], index) =>
      `${index + 1} ${type}: ${weapon.unlocked ? weapon.ammo === Infinity ? 'unlimited' : weapon.ammo : 'locked'}`).join(' · ');
    this.summary.textContent = `Shield ${Math.round(state.playerHealth / state.maxPlayerHealth * 100)}% · Selected ${state.currentWeapon} · ${inventory} · Speed ${ship.velocity.length().toFixed(1)} m/s · ${this.title.textContent}`;
    this.summary.dataset.visited = String(map?.visited.size ?? 0);
    this.summary.dataset.room = map?.current ?? '';
    if (this.element.hidden) return;
    const width = Math.max(1, Math.round(this.canvas.clientWidth)), height = Math.max(1, Math.round(this.canvas.clientHeight));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const ctx = this.canvas.getContext('2d');
    if (ctx) drawExploration(ctx, map, ship.group.position, new Vector3(0, 0, -1).applyQuaternion(ship.group.quaternion), closed, width, height);
  }
}
