import { STORY_LIMITS } from '../core/levels/document/LevelContent.js';
import { describeTrigger, parseTrigger, storyOf, storyPlacements, triggerOptions, triggerValue } from './StoryContent.js';

/** @typedef {import('./EditorDocument.js').default} EditorDocument */
/** @typedef {import('./ViewportMenu.js').default} ViewportMenu */
/** @typedef {(action: () => void) => void} Commit */

/** The radio-message list: add, edit, reorder and delete. Data logs and miners
 * are placed from the viewport's right-click menu like other content.
 * @param {EditorDocument} model @param {ViewportMenu} menu @param {Commit} commit @param {string} [focusId] */
export default function storyDialog(model, menu, commit, focusId = '') {
  const messages = storyOf(model.document)?.messages ?? [];
  const placements = storyPlacements(model.document);
  const logs = placements.filter(item => item.kind === 'log').length, miners = placements.length - logs;
  const root = menu.panel('Story and radio', `Radio messages play once, when their trigger happens. Messages with the same trigger play in list order. ${logs} data log(s) and ${miners} trapped miner(s) placed: right-click inside a room to add more.${model.document.formatVersion < 13 ? ' Adding story content upgrades this level to format 13.' : ''}`, 'dialog');
  root.classList.add('story-dialog');
  const list = document.createElement('div'); list.className = 'story-list'; list.setAttribute('aria-label', 'Radio messages');
  if (!messages.length) { const empty = document.createElement('p'); empty.className = 'story-summary'; empty.textContent = 'No radio messages yet. Add a briefing that plays at mission start.'; list.append(empty); }
  /** @param {() => void} action @param {string} [next] */
  const run = (action, next = '') => { try { commit(action); storyDialog(model, menu, commit, next); } catch (error) { menu.error(error); } };
  for (const [index, message] of messages.entries()) {
    const row = document.createElement('div'); row.className = 'story-row'; row.dataset.messageId = message.id;
    const trigger = document.createElement('p'); trigger.className = 'story-trigger'; trigger.textContent = `#${index + 1} · ${describeTrigger(message.trigger, model.document)}`;
    const text = document.createElement('p'); text.textContent = `${message.speaker}: ${message.text}`;
    const actions = document.createElement('div'); actions.className = 'story-actions';
    /** @param {string} label @param {string} aria @param {() => void} onClick @param {boolean} [disabled] */
    const action = (label, aria, onClick, disabled = false) => {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.setAttribute('aria-label', aria); node.disabled = disabled; node.onclick = onClick; actions.append(node); return node;
    };
    action('Edit', `Edit ${message.id}`, () => editMessage(model, menu, commit, message));
    action('Earlier', `Move ${message.id} earlier`, () => run(() => model.moveStoryMessage(message.id, -1), message.id), index === 0);
    action('Later', `Move ${message.id} later`, () => run(() => model.moveStoryMessage(message.id, 1), message.id), index === messages.length - 1);
    action('Delete', `Delete ${message.id}`, () => run(() => model.deleteStoryMessage(message.id)));
    row.append(trigger, text, actions); list.append(row);
  }
  const buttons = document.createElement('div'); buttons.className = 'popover-buttons';
  const add = document.createElement('button'); add.type = 'button'; add.className = 'primary'; add.textContent = 'Add radio message';
  add.disabled = messages.length >= STORY_LIMITS.messages; add.onclick = () => editMessage(model, menu, commit);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.onclick = () => menu.close(true);
  buttons.append(add, close); root.append(list, buttons);
  menu.position();
  const focus = (focusId && list.querySelector(`[data-message-id="${CSS.escape(focusId)}"] button`)) || add;
  if (focus instanceof HTMLElement) focus.focus();
}

/** @param {EditorDocument} model @param {ViewportMenu} menu @param {Commit} commit
 * @param {import('../levelDocument.js').StoryMessage} [message] */
function editMessage(model, menu, commit, message) {
  menu.form(message ? `Edit ${message.id}` : 'New radio message', 'Shown in the comms panel with a chime and kept in the pause-menu mission log.', [
    { id: 'trigger', label: 'Plays when', value: message ? triggerValue(message.trigger) : 'start', options: triggerOptions(model.document) },
    { id: 'speaker', label: 'Speaker', value: message?.speaker ?? 'Control', maxLength: STORY_LIMITS.speaker },
    { id: 'text', label: `Message (up to ${STORY_LIMITS.message} characters)`, type: 'textarea', value: message?.text ?? '', maxLength: STORY_LIMITS.message },
  ], values => {
    const payload = { speaker: values.speaker, text: values.text, trigger: parseTrigger(values.trigger) };
    let id = message?.id ?? '';
    commit(() => { if (message) model.updateStoryMessage(message.id, payload); else id = model.addStoryMessage(payload); });
    storyDialog(model, menu, commit, id);
  }, message ? 'Save message' : 'Add message', undefined, () => storyDialog(model, menu, commit, message?.id));
}
