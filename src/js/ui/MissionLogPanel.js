import { formatMissionTime } from '../core/CampaignProgress.js';

/** Pause-menu mission status and comms log. Rebuilt from read-only data every time
 * the pause menu opens; it never changes game state. */
export default class MissionLogPanel {
  constructor() {
    this.root = document.createElement('section');
    this.root.id = 'mission-log';
    this.root.setAttribute('aria-label', 'Mission status and comms log');
    Object.assign(this.root.style, { textAlign: 'left', margin: '0 0 18px', color: '#cfeff6', font: '14px/1.45 system-ui, sans-serif' });
    const style = document.createElement('style');
    style.textContent = `
      #mission-log details { border: 1px solid #1f4d63; border-radius: 6px; padding: 8px 12px; margin: 8px 0; background: #04121dcc; }
      #mission-log summary { cursor: pointer; font-weight: bold; letter-spacing: .1em; color: #8be8f0; font-size: 13px; }
      #mission-log summary:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      #mission-log ul { list-style: none; margin: 8px 0 0; padding: 0; }
      #mission-log li { margin: 5px 0; }
      #mission-log .done { color: #7ff0a8; }
      #mission-log .todo { color: #ffd27a; }
      #mission-log .detail { display: block; color: #8fb2c2; font-size: 12px; margin-left: 22px; }
      #mission-log .meta { color: #8fb2c2; font-size: 12px; margin-top: 8px; }
      #mission-log .entry { border-left: 3px solid #59d7e6; padding: 2px 0 2px 8px; margin: 8px 0; }
      #mission-log .entry.log { border-left-color: #ffc04d; }
      #mission-log .entry b { display: block; font-size: 12px; letter-spacing: .1em; color: #8be8f0; }
      #mission-log .entry.log b { color: #ffd27a; }
      #mission-log .comms-list { max-height: 240px; overflow-y: auto; }
    `;
    this.status = document.createElement('details'); this.status.open = true;
    this.comms = document.createElement('details');
    this.root.append(style, this.status, this.comms);
  }

  /** @param {import('../core/MissionStatus.js').MissionStatus | null} status
   * @param {readonly import('../core/StoryController.js').StoryHistoryEntry[]} history
   * @param {{ openComms?: boolean }} [options] */
  render(status, history, options = {}) {
    this.root.hidden = !status;
    if (!status) return;
    const summary = document.createElement('summary'); summary.textContent = 'MISSION STATUS';
    const list = document.createElement('ul');
    for (const item of status.required) {
      const li = document.createElement('li');
      const mark = document.createElement('span'); mark.className = item.done ? 'done' : 'todo';
      mark.textContent = item.done ? '✓ ' : '○ ';
      li.append(mark, item.label);
      if (item.detail && !item.done) { const detail = document.createElement('span'); detail.className = 'detail'; detail.textContent = item.detail; li.append(detail); }
      list.append(li);
    }
    const optional = document.createElement('ul');
    for (const item of status.optional) {
      const li = document.createElement('li');
      li.textContent = `${item.count === item.total ? '★' : '·'} ${item.label}: ${item.count}/${item.total}`;
      if (item.count === item.total) li.className = 'done';
      optional.append(li);
    }
    const optionalTitle = document.createElement('div'); optionalTitle.className = 'meta'; optionalTitle.textContent = status.optional.length ? 'Optional' : '';
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = `${status.name} · ${formatMissionTime(status.timeMs)} elapsed · ${status.difficulty}${status.escapeMs !== null ? ` · Escape: ${formatMissionTime(status.escapeMs)} left` : ''}`;
    this.status.replaceChildren(summary, list, optionalTitle, optional, meta);

    const commsSummary = document.createElement('summary');
    commsSummary.textContent = `COMMS LOG (${history.length})`;
    const entries = document.createElement('div'); entries.className = 'comms-list';
    if (!history.length) { const empty = document.createElement('p'); empty.className = 'meta'; empty.textContent = 'No transmissions or data logs yet.'; entries.append(empty); }
    for (const entry of [...history].reverse()) {
      const item = document.createElement('div'); item.className = `entry ${entry.kind}`;
      const label = document.createElement('b'); label.textContent = `${entry.kind === 'log' ? 'LOG · ' : ''}${entry.label.toUpperCase()} · ${formatMissionTime(entry.timeMs)}`;
      item.append(label, entry.text);
      entries.append(item);
    }
    this.comms.replaceChildren(commsSummary, entries);
    if (options.openComms) this.comms.open = true;
  }
}
