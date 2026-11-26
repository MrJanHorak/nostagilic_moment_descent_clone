# Phase 6: first impressions and reasons to come back

Added November 25, 2026. Four pieces: a balance pass on the first three missions, lag compensation for online shots, a daily challenge and a hangar of ship upgrades.

## 1. Early-mission balance

The first three missions had 1–2 robots each. `scripts/rebalance-act1.mjs` adds robots and ammunition to the authored JSON. The script is safe to re-run: it only adds ids that are missing, and it validates every file.

| Mission | Before | After | Added |
| --- | --- | --- | --- |
| Signal Breach | 1 scout, 1 fighter | 3 scouts, 1 fighter | a second scout in the optional maintenance loop; a scout waiting in extraction behind the signal door; ammo in the signal hall |
| Vector Foundry | 1 scout | 2 scouts, 1 fighter | a scout in the upper works; the campaign's first open-room fighter, guarding lift control; ammo in the upper works |
| Nightfall Reactor | 2 scouts | 3 scouts, 1 fighter | a fighter in the lift junction; a scout in upper control, which also chases the escape; ammo in the junction |

- **The arrival stays safe:** nothing can see or reach the spawn room. A first try put a scout in the Signal Breach supply bay, which can see the arrival; it moved to the maintenance loop.
- Scouts still come before fighters, one new fighter per mission.
- Updated tests: the Signal Breach encounter now counts the extra robots, and the mission status shows 4 robots.

## 2. Lag compensation (`src/js/net/LagCompensation.js`)

On your screen, other ships and robots are shown about **one round trip plus 100 ms** in the past: the snapshot delay plus the interpolation buffer. Before this change, the server checked your shots against where targets were *now*, so a clean hit on your screen could miss.

- **History:** the server records every live pilot's position and every robot's hit box after each simulation step. It keeps about 350 ms.
- **Rewind per shot:** each input carries the client's measured round trip (`rtt`, clamped to 0–1000 ms by the protocol). A pilot's shot is traced against targets rewound by `min(250 ms, rtt + 100 ms)`, interpolated between the two recorded steps.
- **Limits:** the 250 ms cap means a slow or faked connection gets no extra help. Walls, splash damage and robot fire are never rewound. A respawn teleport is never interpolated, and targets with no history are checked where they are now.
- **Where:** `ProjectileManager.sweepPlayerProjectile` asks the combat world for `rewindView(ms)`. Only the game server provides one (`MatchRoom` sets `game.lagHistory`); single player and clients never rewind.
- **Tests** (`tests/lag-compensation.test.mjs`):
  - the rewind formula and cap;
  - the protocol field;
  - interpolation, respawn jumps and history reset;
  - a live Anarchy duel: the target sidesteps about 100 ms before impact; with compensation the shot hits (rewind 150 ms for a 50 ms round trip), and without it the same shot misses.

## 3. Daily challenge (`src/js/core/DailyChallenge.js`)

- **One a day, the same for everyone:** each UTC day picks one campaign or team mission, a seed and a modifier, all from a hash of the date.
- **Missions rotate in shuffled cycles:** every mission comes up once per 13 days, and a mission never repeats on two days in a row.
- **Modifiers:**
  - **Ironclad robots:** robots take 50% more hits.
  - **Glass hull:** you take 80% more damage but carry 20% more ammunition.
  - **Ammo drought:** half the ammunition.
  - **Rapid fire:** robots fire 40% more often.
  - **Veteran run:** the full Veteran balance.
  - **Clean run:** the authored balance.
  - Each is a difficulty tier on top of Pilot, so saved progress still records a real tier.
- **Main menu:** a gold **DAILY CHALLENGE · mission · modifier** button. Under it: today's best time and medal, and the streak.
- **Replays:** restarting replays the same seed. Choosing any other mission leaves the daily behind.
- **Results:** today's best time, runs today and the streak (consecutive days finished), saved in the browser (`descended.daily.v1`, last 60 days). "Next mission" is hidden.
- **Leaderboard:** with a server and pilot name set, the run is posted to board `daily-YYYY-MM-DD`. The server accepts a daily board from the day before to the day after (for time zones) and keeps the last 30.
- **Fairness:** the daily always uses the stock ship (no hangar upgrades).
- **Tests** (`tests/daily-challenge.test.mjs`): same all day, changes daily, no repeats over 90 days, every modifier used; modifier tiers; server date window; local records and streaks; in the game, mission, seed and modifier hold on restart and the result is recorded.

## 4. The hangar (`src/js/core/Hangar.js`, `src/js/ui/HangarPanel.js`)

- **Credits:** every finished mission pays 50, plus 10 per robot destroyed, 40 per miner rescued and 20 per data log. A silver medal adds 50 and gold adds 120.
  - The first clear of each campaign or team mission pays in full. Replays pay half, and player-made levels a quarter, so nothing is worth farming.
  - Online play pays nothing.
- **Upgrades** (three levels each):

| Upgrade | Per level | Costs |
| --- | --- | --- |
| Shield plating | +10 shields | 150 · 300 · 500 |
| Weapon capacitor | +10% damage, all weapons | 200 · 400 · 650 |
| Ammo racks | +15% starting and maximum pulse ammo | 120 · 250 · 400 |
| Thrusters | +5% acceleration and top speed | 180 · 350 · 550 |

- Fully upgraded: 130 shields, ×1.3 damage, ×1.45 pulse ammo and ×1.15 speed, for 4,550 credits. A first clear of all 13 authored missions pays roughly 3,000–4,500, depending on kills, rescues and medals, so the last levels come from replays.
- **Where they apply:** single player only. The daily challenge, Anarchy and online co-op always use the stock ship, so leaderboards and team balance stay fair.
- The capacitor stacks with the timed weapon power-up.
- **Screens:** **HANGAR · N CREDITS** on the main menu, and **HANGAR** on the results screen, which also shows "+N credits". **Sell all upgrades** refunds everything at full price.
- **Storage:** saved in `descended.hangar.v1`, including which missions have paid their first clear. Tampered values are clamped on load.
- **Tests** (`tests/hangar.test.mjs`): credit rules; buying, caps, saving, first-clear memory, refunds and clamping; effects; in the game, the upgrades apply (shields, ammo, shot power, speed), the daily uses the stock ship, and first-clear and replay payouts work.

## Still open

- Tuning: par times, credit rates and upgrade prices should follow real playtests.
- A server-side daily leaderboard view on the main menu (today it shows after a run).
- Controller button remapping; generator markers in the editor; the epilogue online.
