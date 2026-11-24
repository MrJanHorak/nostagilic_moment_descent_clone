import { CAMPAIGN_LIMITS, exportCampaignBundle, nextCampaignMission } from '../core/UserCampaignLibrary.js';

/** @typedef {import('../core/UserCampaignLibrary.js').UserCampaign} UserCampaign */
/** @typedef {{levels: import('../core/UserLevelLibrary.js').default, campaigns: import('../core/UserCampaignLibrary.js').default,
 * play: (campaignKey: string, index: number) => void, run: (action: () => void) => void, notify: (message: string) => void, rerender: (focus?: string) => void}} CampaignContext */

/** @param {number} index */
export const missionLabel = index => `Mission ${String(index + 1).padStart(2, '0')}`;

/** @param {string} tag @param {string} [text] @param {string} [className] */
function node(tag, text = '', className = '') {
  const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element;
}
/** @param {HTMLElement} parent @param {string} label @param {() => void} action @param {CampaignContext} context @param {string} [aria] */
function button(parent, label, action, context, aria) {
  const element = /** @type {HTMLButtonElement} */ (node('button', label)); element.type = 'button';
  if (aria) element.setAttribute('aria-label', aria);
  element.onclick = () => context.run(action); parent.append(element); return element;
}

/** Download text as a file without leaving a URL behind.
 * @param {string} text @param {string} name */
export function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One campaign card: progress, play, mission order, briefings and sharing.
 * @param {UserCampaign} campaign @param {CampaignContext} context */
function campaignCard(campaign, context) {
  const { levels, campaigns } = context;
  const card = node('section', '', 'campaign-card'); card.dataset.campaignKey = campaign.key; card.setAttribute('aria-label', `Campaign: ${campaign.name}`);
  const heading = node('h2', campaign.name); card.append(heading);
  if (campaign.description) card.append(node('p', campaign.description));
  const next = nextCampaignMission(campaign), total = campaign.missions.length, done = campaign.missions.filter(mission => campaign.completed.includes(mission.id)).length;
  const nextLevel = next === null ? null : levels.get(campaign.missions[next].levelKey);
  card.append(node('p', !total ? 'No missions yet. Add levels from My Levels below.'
    : next === null ? `Campaign complete: all ${total} missions extracted.`
    : `Progress: ${done} of ${total} missions extracted · Next: ${missionLabel(next)} · ${nextLevel?.document.name ?? 'missing level'}`, 'campaign-progress'));

  const actions = node('div', '', 'level-actions');
  const start = next ?? 0, missing = campaign.missions.findIndex(mission => !levels.get(mission.levelKey));
  const play = button(actions, !total ? 'Play campaign' : done === 0 ? 'Start campaign' : next === null ? 'Replay campaign' : `Continue · ${missionLabel(start)}`,
    () => context.play(campaign.key, start), context, `Play campaign ${campaign.name}`);
  play.disabled = !total || !levels.get(campaign.missions[start]?.levelKey ?? '');
  const exportButton = button(actions, 'Export campaign', () => {
    download(exportCampaignBundle(campaign, levels), `${campaign.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'campaign'}.campaign.json`);
    context.notify(`Exported ${campaign.name} with ${total} embedded level(s).`);
  }, context, `Export campaign ${campaign.name}`);
  exportButton.disabled = !total || missing >= 0;
  const details = node('form', '', 'campaign-details'); details.hidden = true;
  button(actions, 'Edit details', () => { details.hidden = false; name.focus(); name.select(); }, context, `Edit details of ${campaign.name}`);
  if (done) button(actions, 'Reset progress', () => {
    if (!window.confirm(`Reset progress for "${campaign.name}"? Levels and briefings are kept.`)) return;
    campaigns.resetProgress(campaign.key); context.rerender(campaign.key);
  }, context, `Reset progress of ${campaign.name}`);
  button(actions, 'Delete campaign', () => {
    if (!window.confirm(`Delete the campaign "${campaign.name}"? Its levels stay in My Levels.`)) return;
    campaigns.remove(campaign.key); context.notify(`Deleted campaign ${campaign.name}. ${campaigns.status}`); context.rerender();
  }, context, `Delete campaign ${campaign.name}`);
  card.append(actions);
  if (missing >= 0) card.append(node('p', `${missionLabel(missing)} uses a level that was deleted from My Levels. Remove it or add a replacement.`, 'campaign-warning'));

  const nameLabel = node('label', 'Campaign name '), name = /** @type {HTMLInputElement} */ (node('input'));
  name.value = campaign.name; name.required = true; name.maxLength = CAMPAIGN_LIMITS.name; nameLabel.append(name);
  const descriptionLabel = node('label', 'Description '), description = /** @type {HTMLTextAreaElement} */ (node('textarea'));
  description.value = campaign.description; description.maxLength = CAMPAIGN_LIMITS.description; description.rows = 3; descriptionLabel.append(description);
  const save = node('button', 'Save details'); /** @type {HTMLButtonElement} */ (save).type = 'submit';
  const cancel = /** @type {HTMLButtonElement} */ (node('button', 'Cancel')); cancel.type = 'button'; cancel.onclick = () => { details.hidden = true; };
  details.append(nameLabel, descriptionLabel, save, cancel);
  details.onsubmit = event => { event.preventDefault(); context.run(() => { campaigns.update(campaign.key, { name: name.value, description: description.value }); context.rerender(campaign.key); }); };
  details.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); details.hidden = true; } };
  card.append(details);

  const list = node('ol', '', 'campaign-missions');
  for (const [index, mission] of campaign.missions.entries()) {
    const entry = levels.get(mission.levelKey), item = node('li'); item.dataset.missionId = mission.id;
    const title = `${missionLabel(index)} · ${entry?.document.name ?? 'Missing level'}${campaign.completed.includes(mission.id) ? ' · extracted' : ''}`;
    item.append(node('strong', title), node('p', mission.briefing || 'No briefing yet. Choose Briefing to write what the pilot hears before launch.', mission.briefing ? 'campaign-briefing' : 'campaign-briefing empty'));
    const row = node('div', '', 'level-actions');
    button(row, 'Play', () => context.play(campaign.key, index), context, `Play ${missionLabel(index)} of ${campaign.name}`).disabled = !entry;
    const form = node('form', '', 'campaign-briefing-form'); form.hidden = true;
    const briefingLabel = node('label', `Briefing (up to ${CAMPAIGN_LIMITS.briefing} characters) `), briefing = /** @type {HTMLTextAreaElement} */ (node('textarea'));
    briefing.value = mission.briefing; briefing.maxLength = CAMPAIGN_LIMITS.briefing; briefing.rows = 4; briefingLabel.append(briefing);
    const saveBriefing = /** @type {HTMLButtonElement} */ (node('button', 'Save briefing')); saveBriefing.type = 'submit';
    const cancelBriefing = /** @type {HTMLButtonElement} */ (node('button', 'Cancel')); cancelBriefing.type = 'button';
    const edit = button(row, 'Briefing', () => { form.hidden = false; briefing.focus(); }, context, `Edit briefing for ${missionLabel(index)} of ${campaign.name}`);
    cancelBriefing.onclick = () => { form.hidden = true; edit.focus(); };
    form.onsubmit = event => { event.preventDefault(); context.run(() => { campaigns.setBriefing(campaign.key, mission.id, briefing.value); context.rerender(campaign.key); }); };
    form.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); form.hidden = true; edit.focus(); } };
    form.append(briefingLabel, saveBriefing, cancelBriefing);
    button(row, 'Earlier', () => { campaigns.moveMission(campaign.key, mission.id, -1); context.rerender(campaign.key); }, context, `Move ${missionLabel(index)} of ${campaign.name} earlier`).disabled = index === 0;
    button(row, 'Later', () => { campaigns.moveMission(campaign.key, mission.id, 1); context.rerender(campaign.key); }, context, `Move ${missionLabel(index)} of ${campaign.name} later`).disabled = index === campaign.missions.length - 1;
    button(row, 'Remove', () => { campaigns.removeMission(campaign.key, mission.id); context.rerender(campaign.key); }, context, `Remove ${missionLabel(index)} from ${campaign.name}`);
    item.append(row, form); list.append(item);
  }
  card.append(list);

  const add = node('div', '', 'level-actions campaign-add');
  const options = levels.list();
  if (!options.length) add.append(node('p', 'Save or import a level below to add it as a mission.'));
  else {
    const label = node('label', 'Level '), choice = /** @type {HTMLSelectElement} */ (node('select'));
    choice.setAttribute('aria-label', `Level to add to ${campaign.name}`);
    for (const option of options) choice.add(new Option(option.document.name, option.key));
    label.append(choice); add.append(label);
    button(add, 'Add mission', () => { campaigns.addMission(campaign.key, choice.value); context.rerender(campaign.key); }, context, `Add mission to ${campaign.name}`).disabled = total >= CAMPAIGN_LIMITS.missions;
  }
  card.append(add);
  return card;
}

/** The Campaigns section of My Levels. The focused campaign's heading becomes
 * focusable so the caller can return focus to it after a re-render.
 * @param {CampaignContext} context @param {string | null} [focusKey] */
export default function campaignSection(context, focusKey = null) {
  const section = node('div'); section.id = 'user-campaign-list';
  const list = context.campaigns.list();
  if (!list.length) section.append(node('p', 'No campaigns yet. Create one to chain your levels into an ordered story with briefings, or import a shared campaign file.'));
  for (const campaign of list) {
    const card = campaignCard(campaign, context); section.append(card);
    if (campaign.key === focusKey) card.querySelector('h2')?.setAttribute('tabindex', '-1');
  }
  return section;
}
