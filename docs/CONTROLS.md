# Controls: key remapping and controllers

Added November 23, 2026. Sources: `src/js/core/ControlBindings.js`, `src/js/core/GamepadInput.js`, `src/js/core/InputManager.js`, `src/js/ui/ControlsPanel.js`.

## Keyboard remapping

**Settings → Controls: keyboard and controller** lists every remappable action. Select a control, press a key. Escape cancels; Delete/Backspace clears it.

- Defaults are the original layout (W/S/A/D, Space, Left Shift/Ctrl, arrows, Q/E, F, R, M, C, L, H, 1–4), plus J for the mission log (added November 24), and T for quick-chat and G to ping where you aim (added November 25, for online and co-op play).
- Each action holds up to two keys. A new key becomes the primary key and the previous primary stays as the secondary.
- A key belongs to one action. Binding it elsewhere removes it from its old action, and the panel says so (and warns if that action now has no key).
- Escape (pause/back), Tab, OS/meta keys, F5, F11 and F12 cannot be bound. The mouse always aims, and click always captures and fires.
- **Reset controls** restores the original layout. Settings' own **Reset to defaults** does not touch controls.
- Bindings are saved separately as `descended.controls.v1`. Malformed, future-version or duplicate data falls back safely. If storage is blocked, changes still apply for the visit.
- The flight status legend (camera/lights/HUD/map) shows your current keys. Mission briefings and the mission library still name the default keys.

## Controllers

Any controller the browser reports with the standard mapping (Xbox, PlayStation and most USB pads) works with no setup. Press any button after the page loads; a message confirms the connection. Mouse capture is not needed: the "click to capture" prompt stays quiet while a controller is in use.

| Input | Action |
| --- | --- |
| Left stick | Thrust forward/back, slide left/right (analog) |
| Right stick | Turn and pitch (analog, gentle response curve) |
| A / Cross · B / Circle | Slide up · slide down |
| LB / L1 · RB / R1 | Roll left · roll right |
| RT / R2 | Fire (one shot per pull, same as F/click) |
| LT / L2 · Y / Triangle | Previous · next unlocked weapon |
| X / Square | Activate relay |
| D-pad ↑ ↓ ← → | Map · headlights · camera · HUD |
| Menu / Options | Pause / resume |
| View / Share | Mission log (pauses); D-pad ↑ still expands the map |
| L3 (left stick click) | Open quick chat; while it is open, D-pad ↑ ↓ ← → and A B X Y send phrases 1–8 |
| R3 (right stick click) | Mark target (ping) for the team |
| In menus | D-pad ↑ ↓ moves focus · A selects · B goes back |

- **Stick look sensitivity** (0.25–3×) and **Invert stick Y** are in the Controls section. They are separate from the mouse settings.
- Sticks use a 15% radial deadzone with rescaling. Triggers count as pressed past half travel.
- Buttons already held when a controller connects don't fire. Pausing or disconnecting clears all stick input immediately.
- Keyboard and controller can be used together; for each direction the stronger input wins.
- A partly deflected stick gives partial thrust. Diagonal keys still give exactly full thrust, so keyboard flight is unchanged. Full right-stick deflection turns up to 1.5× faster than a held key at sensitivity 1.

## Not yet included

Remapping controller buttons, a hold-to-autofire option, haptics, and controller glyphs in prompts. Local split-screen would also need per-player controller assignment; that belongs to the multiplayer refactor.

## Verification

`tests/controls.test.mjs` (eight cases) covers:
- default layout and single key ownership
- rebinding, displacement and persistence
- reserved keys and hostile storage
- remapped flight and actions through `InputManager`
- analog thrust/turn scaling with unchanged keyboard behavior
- deadzone, stick mapping and inversion
- button edges, including held-on-connect and reconnect cases
- a polled controller that flies, fires, cycles weapons, pauses (going neutral), resumes and disconnects

All earlier input tests pass unchanged.
