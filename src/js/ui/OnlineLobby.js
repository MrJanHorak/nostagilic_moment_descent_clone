/// <reference types="vite/client" />
/** The online lobby: pilot name, game server address, and create or join a room
 * by its four-letter code. Invite links (?room=ABCD&server=...) open it filled in. */
import { cleanName, isRoomCode, ROOM_CODE_LENGTH } from '../net/Protocol.js';
import { PILOT_COLOURS } from '../net/OnlineMatch.js';

const STORAGE_KEY = 'descended.online.v1';
export const DEFAULT_PORT = 8787;

/** Turn what a player types into a WebSocket play address: "host", "host:port",
 * http(s):// or ws(s):// all work; the /play path is added; a page served over
 * https gets wss. Returns null when it cannot be an address.
 * @param {string} input @param {{protocol?: string} | null} [page] */
export function normalizeServerUrl(input, page = null) {
  let text = String(input ?? '').trim();
  if (!text) return null;
  const secure = page?.protocol === 'https:';
  if (/^https?:\/\//i.test(text)) text = text.replace(/^http/i, 'ws');
  else if (!/^wss?:\/\//i.test(text))
    text = `${secure ? 'wss' : 'ws'}://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!url.hostname) return null;
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/play';
  url.hash = '';
  return url.toString();
}

/** The address to suggest: an invite's, the last one used, a build-time default
 * (VITE_GAME_SERVER), or this machine on the default port when playing locally.
 * @param {{hostname?: string, protocol?: string} | null} page @param {string | undefined} [configured] @param {string | null} [saved] */
export function defaultServerUrl(page, configured, saved = null) {
  if (saved) return saved;
  if (configured) return normalizeServerUrl(configured, page) ?? '';
  const host = page?.hostname;
  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^192\.168\.|^10\./.test(host)
  )
    return `ws://${host || 'localhost'}:${DEFAULT_PORT}/play`;
  return '';
}

/** Room code and server from an invite link's query string. @param {string} search */
export function parseInvite(search) {
  const params = new URLSearchParams(search);
  const room = (params.get('room') ?? '').toUpperCase();
  return {
    room: isRoomCode(room) ? room : null,
    server: params.get('server') || null,
  };
}

/** An invite link for this page. @param {string} href @param {string} room @param {string} server */
export function inviteLink(href, room, server) {
  const url = new URL(href);
  url.searchParams.set('room', room);
  url.searchParams.set('server', server);
  url.hash = '';
  return url.toString();
}

/** Missions a team can fly online: campaign missions first, then the rest with an objective.
 * @param {any} game @returns {{id: string, name: string}[]} */
export function coopMissions(game) {
  const levels = (game?.levelManager?.levels ?? []).filter(
    /** @param {any} level */ (level) =>
      level.mission && level.mode !== 'anarchy' && level.sourceDocument,
  );
  // Team missions first (built for co-op), then the campaign in order, then the rest.
  const rank = /** @param {any} level */ (level) =>
    level.team ? 0 : (level.campaignOrder ?? 99);
  return [...levels]
    .sort((a, b) => rank(a) - rank(b))
    .map((level) => ({
      id: level.id,
      name: `${level.name ?? level.id}${level.team ? ' (team)' : ''}`,
    }));
}

/** @param {any} storage */
function loadSaved(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** Open the lobby. @param {any} game @param {{onBack: () => void, storage?: any}} options
 * @returns {HTMLElement} */
export default function createOnlineLobby(
  game,
  { onBack, storage = globalThis.localStorage },
) {
  const page = globalThis.location ?? null;
  const invite = parseInvite(page?.search ?? '');
  const saved = loadSaved(storage);
  const configured = import.meta.env?.VITE_GAME_SERVER;

  const overlay = document.createElement('div');
  overlay.id = 'online-lobby';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Play online');
  // Above the game's overlays (including development panels); the panel scrolls on short screens.
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2500',
    background: 'rgba(0, 8, 20, 0.94)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#cafaff',
    font: '16px system-ui, sans-serif',
  });
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    width: 'min(520px, 92vw)',
    padding: '20px 24px',
    border: '1px solid #00aaff',
    borderRadius: '10px',
    boxSizing: 'border-box',
    maxHeight: 'calc(100dvh - 24px)',
    overflowY: 'auto',
    background: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,10,20,0.9))',
    boxShadow: '0 0 20px #0066aa',
    display: 'grid',
    gap: '10px',
  });
  overlay.appendChild(panel);

  const heading = document.createElement('h2');
  heading.textContent = 'PLAY ONLINE';
  Object.assign(heading.style, {
    margin: '0',
    color: '#fff',
    letterSpacing: '2px',
    textShadow: '0 0 8px #00aaff',
  });
  const intro = document.createElement('p');
  intro.textContent =
    "Anarchy: free-for-all in Foundry Ring, up to 8 pilots. Co-op: fly a mission as a team of up to 4. Create a room and share its code, or join a friend's.";
  Object.assign(intro.style, { margin: '0', color: '#9fd8ea' });

  /** @param {string} label @param {string} id @param {string} value @param {Partial<HTMLInputElement>} [extra] */
  const field = (label, id, value, extra = {}) => {
    const wrap = document.createElement('label');
    Object.assign(wrap.style, { display: 'grid', gap: '4px' });
    const caption = document.createElement('span');
    caption.textContent = label;
    caption.style.color = '#fff';
    const input = document.createElement('input');
    input.id = id;
    input.value = value;
    Object.assign(input, extra);
    Object.assign(input.style, {
      padding: '9px 10px',
      font: '16px system-ui',
      color: '#e8fbff',
      background: '#0b2433',
      border: '1px solid #3f7f95',
      borderRadius: '5px',
    });
    wrap.append(caption, input);
    return { wrap, input };
  };
  const name = field('Pilot name', 'online-name', saved.name ?? '', {
    maxLength: 16,
    placeholder: 'Pilot',
    autocomplete: 'off',
  });
  const server = field(
    'Game server',
    'online-server',
    invite.server ?? defaultServerUrl(page, configured, saved.server ?? null),
    { placeholder: 'wss://your-server.example.com/play', spellcheck: false },
  );
  const hint = document.createElement('small');
  hint.textContent =
    'Run one with "npm run server" (port 8787). Online sites need a wss:// address.';
  hint.style.color = '#7fb9cc';
  server.wrap.appendChild(hint);
  // What a new room plays: Anarchy, or a co-op mission. Joining takes the room's choice.
  const modeWrap = document.createElement('label');
  Object.assign(modeWrap.style, { display: 'grid', gap: '4px' });
  const modeCaption = document.createElement('span');
  modeCaption.textContent = 'New room plays';
  modeCaption.style.color = '#fff';
  const mode = document.createElement('select');
  mode.id = 'online-mode';
  Object.assign(mode.style, {
    padding: '9px 10px',
    font: '16px system-ui',
    color: '#e8fbff',
    background: '#0b2433',
    border: '1px solid #3f7f95',
    borderRadius: '5px',
  });
  mode.add(
    new Option('Anarchy · Foundry Ring (deathmatch)', 'anarchy:foundry-ring'),
  );
  for (const level of coopMissions(game))
    mode.add(new Option(`Co-op · ${level.name}`, `coop:${level.id}`));
  mode.value = [...mode.options].some((option) => option.value === saved.mode)
    ? saved.mode
    : 'anarchy:foundry-ring';
  modeWrap.append(modeCaption, mode);
  const room = field('Room code (to join)', 'online-room', invite.room ?? '', {
    maxLength: ROOM_CODE_LENGTH,
    placeholder: 'ABCD',
    autocomplete: 'off',
    spellcheck: false,
  });
  room.input.style.textTransform = 'uppercase';
  room.input.style.letterSpacing = '4px';

  const status = document.createElement('p');
  status.id = 'online-status';
  status.setAttribute('role', 'status');
  Object.assign(status.style, {
    margin: '0',
    minHeight: '1.3em',
    color: '#ffce77',
  });

  /** @param {string} label @param {string} id @param {boolean} [primary] */
  const button = (label, id, primary = false) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.id = id;
    element.textContent = label;
    Object.assign(element.style, {
      padding: '11px 18px',
      font: 'bold 15px system-ui',
      cursor: 'pointer',
      borderRadius: '5px',
      letterSpacing: '1px',
      color: primary ? '#001018' : '#dcf8ff',
      background: primary ? '#38d0f0' : '#24485c',
      border: '1px solid #5e9cae',
    });
    return element;
  };
  const create = button('CREATE ROOM', 'online-create', !invite.room),
    join = button('JOIN ROOM', 'online-join', !!invite.room),
    back = button('BACK', 'online-back');
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });
  row.append(create, join, back);
  panel.append(
    heading,
    intro,
    name.wrap,
    server.wrap,
    modeWrap,
    room.wrap,
    status,
    row,
  );

  let busy = false;
  /** @param {boolean} value */
  const setBusy = (value) => {
    busy = value;
    for (const element of [
      create,
      join,
      name.input,
      server.input,
      room.input,
      mode,
    ])
      element.disabled = value;
  };

  /** @param {string | null} code */
  async function go(code) {
    if (busy) return;
    const url = normalizeServerUrl(server.input.value, page);
    if (!url) {
      status.textContent =
        'Enter the game server address, for example ws://localhost:8787.';
      server.input.focus();
      return;
    }
    if (page?.protocol === 'https:' && url.startsWith('ws:')) {
      status.textContent =
        'This page is served over https, so the server address must start with wss://.';
      server.input.focus();
      return;
    }
    if (code !== null && !isRoomCode(code)) {
      status.textContent = 'Room codes are four letters (no I, L or O).';
      room.input.focus();
      return;
    }
    const pilotName = cleanName(name.input.value);
    try {
      storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: name.input.value.trim(),
          server: url,
          mode: mode.value,
        }),
      );
    } catch {
      /* storage unavailable */
    }
    const [roomMode, map] = mode.value.split(':');
    setBusy(true);
    status.textContent = code ? `Joining room ${code}…` : 'Creating a room…';
    try {
      const match = await game.joinOnline({
        url,
        name: pilotName,
        room: code,
        mode: roomMode === 'coop' ? 'coop' : 'anarchy',
        map,
        lobby: true,
      });
      // The address bar becomes an invite link for this room.
      try {
        globalThis.history?.replaceState?.(
          null,
          '',
          inviteLink(page.href, match.room, url),
        );
      } catch {
        /* not in a browser */
      }
      if (!match.waiting) { overlay.remove(); return; }
      panel.replaceChildren();
      heading.textContent = 'WAITING ROOM';
      const detail = document.createElement('p');
      detail.textContent = `Room ${match.room} · ${match.mode === 'coop' ? 'Co-op' : 'Anarchy'} · ${match.mapId}`;
      const link = field('Invite link', 'online-invite', inviteLink(page.href, match.room, url), { readOnly: true });
      const copy = button('COPY INVITE LINK', 'online-copy');
      const players = document.createElement('ul');
      players.id = 'online-players';
      Object.assign(players.style, { listStyle: 'none', padding: '0', margin: '4px 0', display: 'grid', gap: '8px' });
      const botWrap = document.createElement('label');
      Object.assign(botWrap.style, { display: 'grid', gap: '5px', color: '#fff' });
      botWrap.textContent = 'Computer opponents';
      const bots = document.createElement('select');
      bots.id = 'online-bots';
      Object.assign(bots.style, { padding: '9px', color: '#e8fbff', background: '#0b2433', border: '1px solid #3f7f95', borderRadius: '5px', font: '16px system-ui' });
      for (let i = 0; i <= 7; i++) bots.add(new Option(i === 0 ? 'None' : `${i} ${i === 1 ? 'bot' : 'bots'}`, String(i)));
      botWrap.append(bots);
      const waitingStatus = document.createElement('p');
      waitingStatus.id = 'online-waiting-status';
      waitingStatus.setAttribute('role', 'status');
      const start = button('START GAME', 'online-start', true);
      const leave = button('LEAVE ROOM', 'online-leave');
      const controls = document.createElement('div');
      Object.assign(controls.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });
      controls.append(start, leave);
      panel.append(heading, detail, link.wrap, copy, players, botWrap, waitingStatus, controls);
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link.input.value); waitingStatus.textContent = 'Invite link copied.'; }
        catch { link.input.focus(); link.input.select(); waitingStatus.textContent = 'Select and copy the invite link above.'; }
      });
      const refresh = () => {
        players.replaceChildren(...match.roster.map(/** @param {{id: string, name: string}} player */ player => {
          const item = document.createElement('li');
          const colour = PILOT_COLOURS[(Number(player.id.slice(1)) - 1 + PILOT_COLOURS.length) % PILOT_COLOURS.length] ?? PILOT_COLOURS[0];
          const css = `#${colour.toString(16).padStart(6, '0')}`;
          Object.assign(item.style, { display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', border: `1px solid ${css}77`, borderRadius: '8px', background: 'linear-gradient(90deg, #142e3e, #091925)' });
          const ship = document.createElement('span');
          ship.setAttribute('aria-hidden', 'true');
          ship.innerHTML = `<svg width="52" height="32" viewBox="0 0 52 32"><path d="M26 2 L33 17 L47 24 L47 28 L30 24 L26 30 L22 24 L5 28 L5 24 L19 17 Z" fill="${css}" stroke="#e9faff" stroke-width="1.2"/><path d="M26 8 L29 19 L26 22 L23 19 Z" fill="#132c3b"/></svg>`;
          const label = document.createElement('span');
          label.textContent = `${player.name}${player.id === match.hostId ? ' (host)' : ''}${player.id === match.id ? ' (you)' : ''}`;
          item.append(ship, label);
          return item;
        }));
        const host = match.hostId === match.id;
        start.hidden = !host;
        botWrap.style.display = host && match.mode === 'anarchy' ? 'grid' : 'none';
        const available = Math.max(0, 8 - match.roster.length);
        for (const option of bots.options) option.disabled = Number(option.value) > available;
        if (Number(bots.value) > available) bots.value = String(available);
        waitingStatus.textContent = host ? 'Invite your friends, then start when everyone is ready.' : 'Waiting for the host to start the game.';
      };
      match.onLobbyChange = refresh;
      match.onStarted = () => overlay.remove();
      match.onDisconnected = () => overlay.remove();
      start.addEventListener('click', () => { start.disabled = true; match.send({ t: 'start', bots: match.mode === 'anarchy' ? Number(bots.value) : 0 }); });
      leave.addEventListener('click', () => { match.onDisconnected = null; game.leaveOnline(); overlay.remove(); onBack(); });
      refresh();
      start.hidden ? leave.focus() : start.focus();
    } catch (error) {
      status.textContent =
        /** @type {Error} */ (error).message || 'Unable to connect.';
      setBusy(false);
    }
  }

  create.addEventListener('click', () => go(null));
  join.addEventListener('click', () =>
    go(room.input.value.trim().toUpperCase()),
  );
  room.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') go(room.input.value.trim().toUpperCase());
  });
  back.addEventListener('click', () => {
    if (!busy) {
      overlay.remove();
      onBack();
    }
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      overlay.remove();
      onBack();
    }
  });
  document.body.appendChild(overlay);
  (invite.room ? join : name.input.value ? create : name.input).focus();
  return overlay;
}
