# DESCENDED — Zero Gravity Shooter

DESCENDED is a browser-based six-degree-of-freedom shooter inspired by Descent. Fly through connected mines, fight robots, rescue miners, restore systems and find your way out. Play the campaign alone or online with friends, compete in Anarchy, or build your own missions.

**[Play DESCENDED](https://aishootergame.netlify.app/)** · [Developer guide](DEVELOPER_GUIDE.md) · [Controls](docs/CONTROLS.md) · [Level editor tutorial](docs/LEVEL_EDITOR_TUTORIAL.md)

## Play

The campaign has **11 missions across three acts**: Signal Breach, Vector Foundry, Nightfall Reactor, Asterion Deepworks, The Seal, Witness, Fabricator, Moving Day, Dead Signal, Breaker Yard and Core of the Matter. Its story includes radio messages, collectible logs, miner rescues and a final choice. Mission progress, best results and collected records are saved in browser storage.

To move built-in campaign progress, hangar upgrades and daily records to another computer, choose **EXPORT PROGRESS** on the main menu, copy the downloaded file, then choose **IMPORT PROGRESS** on the other computer. Import replaces those three records on that browser; export a backup there first if you want to keep them. This is a manual transfer, not automatic account synchronization. Custom levels, custom campaigns, settings and an in-progress mission are not included.

- **Single player:** Continue the campaign, select a mission or try the practice and prototype levels. Earn credits for the hangar and buy ship upgrades. Four difficulty settings adjust the challenge.
- **Online co-op:** Create or join a room for up to four pilots. Share the invite link from the waiting room, see who has joined, and start when the host is ready. Fly campaign missions or the two dedicated team missions, Twin Valves and Deep Freight. Teams share lives and can revive teammates, send quick messages and mark targets.
- **Online Anarchy:** Free-for-all in Foundry Ring for up to eight pilots. The host starts the match from the waiting room after sharing the room code or invite link.
- **Daily challenge:** Each UTC day selects an authored mission and modifier. The challenge uses the stock ship and saves local results and streaks.
- **My Levels:** Play, import, export and organize custom missions and user campaigns. With a configured game server, players can also share and browse levels online.

Online play requires a separate running game server. The website alone does not host matches. See [Online setup](#online-setup) and the [co-op](docs/COOP.md) and [Anarchy](docs/ANARCHY.md) guides.

## Default controls

| Input | Action |
| --- | --- |
| W / S | Thrust forward / backward |
| A / D | Slide left / right |
| Space / Shift or Ctrl | Slide up / down |
| Mouse or arrow keys | Look / turn |
| Q / E | Roll left / right |
| Left click / F | Fire; one shot per press |
| R | Activate a nearby relay |
| 1–4 | Select an unlocked weapon |
| M | Toggle the explored-area map |
| J | Mission and communications log |
| C / L / H | Cycle camera / toggle headlights / toggle HUD |
| T / G | Quick chat / mark a target online |
| Escape | Pause |

The first click captures the mouse. Keyboard bindings can be changed in **Settings → Controls**. Standard-mapping gamepads are supported, including analog flight and menu navigation; see [the controller layout and current limitations](docs/CONTROLS.md).

## Combat and progression

Scouts lunge and retreat; fighters reposition and fire in telegraphed bursts; bombers threaten an area; destroyers have directional armor; and bosses change phases. Defeated robots can drop weapon salvage. Laser shots can penetrate, while missile and plasma blasts have falloff and are blocked by walls. Missions also use relays, doors, force fields, generators, lava and timed reactor escapes.

Mission medals consider time, rescues and logs. Single-player completions award hangar credits for shield, damage, ammunition and thruster upgrades. Online play and daily challenges use a stock ship. Server leaderboards are **unverified** and mission boards mix difficulty levels and upgrades; times are not necessarily directly comparable. See [mission ratings and sharing](docs/PHASE_5.md) and [daily challenges and hangar](docs/PHASE_6.md).

## Level designer

Choose **Level Designer** from the menu or open `/editor.html` when running the development server. Create connected rooms, place mission content, validate, and playtest in the game runtime. Drafts and the My Levels library are stored in the browser; export JSON for a portable backup. The editor supports linked team relays, choice relays and robot generators; generator locations are managed through the list rather than drawn as markers.

Start with the [editor tutorial](docs/LEVEL_EDITOR_TUTORIAL.md), [My Levels guide](docs/USER_LEVELS.md), and [level document format](docs/LEVEL_DOCUMENT_FORMAT.md).

## Local development

Use Node.js **24.22.0** and npm **11.21.1**, as pinned in the project configuration:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The designer is at `/editor.html`.

```sh
npm run verify          # scoped lint, typecheck, tests and production build
npm run browser:install # install Chromium for Playwright
npm run test:browser    # build and run browser tests
npm run server          # separate multiplayer and sharing server
```

See [toolchain and verification](docs/TOOLCHAIN.md) for CI, profiling and the scope of the checks. Historical acceptance and performance reports describe the revisions on which they were recorded, not necessarily the current build.

## Online setup

Run `npm run server` on a publicly reachable host. A site served over HTTPS needs a secure WebSocket endpoint, for example `wss://your-server.example.com/play`. Set `VITE_GAME_SERVER` to that address in Netlify with the **Builds** scope and the appropriate deploy context, then trigger a new build and deploy. Vite embeds this value in the client at build time; it is public. The lobby uses an invite's address first, then a previously saved address, then this build-time default.

For a GCP VM with TLS, origin configuration, health checks and server updates, follow [the hosting guide](deploy/gcp/README.md). The health endpoint checks that the HTTP service responds; a successful room connection also depends on WebSocket access and the allowed origin.

Scores and shared levels use the same server. A pilot name and server address from the online lobby are needed to submit scores. Server data persists only when the server is configured with a data directory; the GCP guide describes backups.

## Project layout

- `src/js/core/` — game session, controls, campaign, missions and progression.
- `src/js/entities/` — ship, robots, projectiles and pickups.
- `src/js/net/` and `server/` — online client, authoritative rooms and HTTP API.
- `src/js/ui/` and `src/js/editor/` — game interfaces and level designer.
- `tests/` — simulation, server, contract and browser tests.
- `docs/` — feature guides and dated development and verification records.

Built with JavaScript, Three.js, Vite and Web Audio. Some older roadmap and checkpoint documents describe historical states; use their dates and the current source when evaluating present behavior.
