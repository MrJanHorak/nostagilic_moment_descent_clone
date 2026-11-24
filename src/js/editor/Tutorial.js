import { storyOf } from './StoryContent.js';

/** @typedef {import('../levelDocument.js').LevelDocument} LevelDocument */
/** @typedef {{playtested: boolean, saved: boolean}} TutorialProgress */
/** @typedef {{title: string, body: string[], done?: (document: LevelDocument, progress: TutorialProgress) => boolean}} TutorialStep */

/** A first mission in ten short steps. Each step's check reads the level itself,
 * so it ticks off whichever way the author does the job. Steps without a check
 * are read-and-continue. */
export const TUTORIAL_STEPS = /** @type {readonly TutorialStep[]} */ (Object.freeze([
  { title: 'Look around', body: [
    'Drag in the view to orbit, right-drag to pan and scroll to zoom.',
    'Press 2 for a top view and 1 to return to 3D. F focuses whatever is selected.',
    'Click a wall, the floor or an item to select it; the panel on the right shows its properties.',
  ] },
  { title: 'Add a second room', body: [
    'Right-click one of the starter room\'s walls and choose "Attach room at this point".',
    'The new room is joined by a cyan-framed passage. "Attach corridor" and "Attach ramp or diagonal corridor…" work the same way.',
  ], done: document => document.rooms.length >= 2 },
  { title: 'Name a room', body: [
    'Click the room you want to name. On the right-hand side of the screen, directly under the selected room\'s title, click the Room name box, type a name such as "Pump hall" and press Enter. Or right-click inside the room and choose "Name this room…".',
    'Mine name at the top left is different: it names the whole level.',
    'Typing while the 3D view has focus triggers shortcuts (Q/W/E/R switch tools), so click into the box first.',
    'Names appear in the room list, in story triggers and in the pilot\'s on-screen guide.',
  ], done: document => document.rooms.some(room => !!room.label) },
  { title: 'Place an enemy', body: [
    'Right-click the floor of the new room and choose "Place enemy…", pick a type and press Place enemy.',
    'The white or red marker shows where it will go before you commit. Enemies are required kills unless you untick "Required for completion".',
  ], done: document => document.entities.some(entity => entity.kind === 'enemy') },
  { title: 'Lock the way with a door', body: [
    'Right-click the cyan passage frame between the rooms and choose "Add or edit door…".',
    'A shot door opens when the pilot shoots it; a relay gate needs a relay (R in game) somewhere reachable. The dialog can place that relay for you.',
  ], done: document => document.formatVersion !== 1 && document.doors.length > 0 },
  { title: 'Move the exit', body: [
    'Right-click the floor of the far room and choose "Move exit here".',
    'The pilot must clear the required enemies and relays, then fly into the green exit ring.',
  ], done: document => document.entities.some(entity => entity.kind === 'exit' && entity.roomId !== document.playerSpawn.roomId) },
  { title: 'Tell the story', body: [
    'Open "Story & radio…" in the top bar and add a radio message that plays at mission start.',
    'Add more that play when the pilot enters a room, activates a relay or destroys a robot.',
  ], done: document => (storyOf(document)?.messages.length ?? 0) > 0 },
  { title: 'Hide a log or a miner', body: [
    'Right-click a floor and choose "Place data log here…" or "Place trapped miner here…".',
    'Logs are read later in the mission log; miners count as rescued when the pilot flies close and then extracts.',
  ], done: document => { const story = storyOf(document); return !!story && story.logs.length + story.survivors.length > 0; } },
  { title: 'Playtest it', body: [
    'Press "Playtest level" to fly the mission as it stands. "Playtest from this room" on the Room tab starts somewhere else.',
    'Validation at the bottom lists anything blocking a playtest; click an issue to jump to it.',
  ], done: (_document, progress) => progress.playtested },
  { title: 'Save and share', body: [
    'Press "Save to My Levels". Back in the game, MY LEVELS plays it, and New campaign chains several levels with briefings.',
    'Export JSON (or Export campaign) makes a file you can share. That is the whole loop. Good hunting, pilot.',
  ], done: (_document, progress) => progress.saved },
]));

const STORAGE_KEY = 'descended.designer.tutorial.v1';

/** A small, non-modal guide card over the viewport's top-right corner. */
export default class TutorialPanel {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.index = 0;
    this.root = document.createElement('aside'); this.root.id = 'tutorial'; this.root.hidden = true; this.root.setAttribute('aria-label', 'Level editor tutorial');
    this.counter = document.createElement('p'); this.counter.className = 'tutorial-counter';
    this.title = document.createElement('h2'); this.title.id = 'tutorial-title';
    this.body = document.createElement('div');
    this.status = document.createElement('p'); this.status.className = 'tutorial-status'; this.status.setAttribute('role', 'status');
    const buttons = document.createElement('div'); buttons.className = 'tutorial-buttons';
    this.back = document.createElement('button'); this.back.type = 'button'; this.back.textContent = 'Back';
    this.next = document.createElement('button'); this.next.type = 'button'; this.next.textContent = 'Next';
    this.close = document.createElement('button'); this.close.type = 'button'; this.close.textContent = 'Close tutorial';
    buttons.append(this.back, this.next, this.close);
    this.root.append(this.counter, this.title, this.body, this.status, buttons);
    host.append(this.root);
    /** @type {LevelDocument | null} */ this.document = null;
    /** @type {TutorialProgress} */ this.progress = { playtested: false, saved: false };
    this.back.onclick = () => this.go(this.index - 1);
    this.next.onclick = () => { if (this.index === TUTORIAL_STEPS.length - 1) this.hide(); else this.go(this.index + 1); };
    this.close.onclick = () => this.hide();
    this.root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.hide(); } });
  }
  get open() { return !this.root.hidden; }
  /** @param {number} [index] */
  show(index = this.saved()) { this.root.hidden = false; this.progress = { playtested: false, saved: false }; this.go(index); this.title.tabIndex = -1; this.title.focus(); }
  hide() { this.root.hidden = true; this.remember(); }
  /** @param {number} index */
  go(index) {
    this.index = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index)); this.remember(); this.render();
  }
  /** Re-check the current step against the latest document.
   * @param {LevelDocument} document @param {Partial<TutorialProgress>} [progress] */
  update(document, progress = {}) {
    this.document = document; Object.assign(this.progress, Object.fromEntries(Object.entries(progress).filter(([, value]) => value)));
    if (this.open) this.render();
  }
  render() {
    const step = TUTORIAL_STEPS[this.index], done = !!(this.document && step.done?.(this.document, this.progress));
    this.counter.textContent = `Tutorial · step ${this.index + 1} of ${TUTORIAL_STEPS.length}`;
    this.title.textContent = step.title;
    this.body.replaceChildren(...step.body.map(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph; }));
    this.status.textContent = !step.done ? 'Press Next when you are ready.' : done ? '✓ Done. Press Next to continue.' : 'Waiting for you to do this. You can also skip with Next.';
    this.status.classList.toggle('done', done);
    this.back.disabled = this.index === 0;
    this.next.textContent = this.index === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next';
    this.next.classList.toggle('primary', done || !step.done);
  }
  saved() { try { const value = Number(localStorage.getItem(STORAGE_KEY)); return Number.isInteger(value) ? value : 0; } catch { return 0; } }
  remember() { try { localStorage.setItem(STORAGE_KEY, String(this.index)); } catch { /* Progress is kept for this visit only. */ } }
}
