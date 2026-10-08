# VOID BREAKER

A neon roguelike twin-stick shooter that runs in the browser. Built with plain HTML5 Canvas and JavaScript. It needs no libraries, no build step and no image or audio files.

**How to run:** double-click `index.html`. Chrome or Edge works best.
Put your team name and members in `js/config.js`. They appear on the title screen and the Credits screen.

## The game
Descend through **3 procedurally generated floors**. Each floor is a maze of rooms: combat rooms, a treasure room, a shop and a boss room. Doors lock until every enemy is dead. Each cleared room drops an upgrade orb, so every run builds a different character. Defeat the three bosses to win.

| Controls | |
|---|---|
| WASD | move |
| Mouse / hold left click | aim and shoot |
| Space | dash (brief invincibility) |
| 1 2 3, Q, mouse wheel | switch weapon |
| E | buy / take from a pedestal |
| Esc | pause |
| M | mute |

## Features
- 3 themed floors, each with its own colours and generative music (tempo and key change)
- Random room graph generation and 7 room layouts
- 5 weapons: Pulse Pistol, Storm SMG, Scatter Cannon, Rail Lance and Nova Launcher
- 16 stackable upgrades (multishot, ricochet, piercing, explosive rounds, homing, orbital blades, shield, and more)
- 8 enemy types with different AI, plus elite variants
- 3 multi-phase bosses built from a reusable attack library
- Shop and treasure rooms, a coin economy, and a score combo system
- Procedural sound effects and adaptive music, all made with the WebAudio API
- Particles, screen shake, hit-stop, glow rendering, a minimap, CRT scanlines, menus and credits
- Best score saved with localStorage

## Code structure (one file per team role)
| File | What it does | Suggested owner |
|---|---|---|
| `js/game.js` | game loop, states, rooms, waves, pickups, scoring | Project Lead |
| `js/player.js` | player movement, dash, weapons, bullets | Gameplay Programmer |
| `js/enemy.js` | 8 enemy AIs | AI Programmer |
| `js/boss.js` | 3 bosses and the attack library | Boss Designer |
| `js/world.js` | floor generation, room layouts, background rendering | Level Designer |
| `js/ui.js`, `index.html`, `css/style.css` | menus, upgrade cards, overlays | UI/UX |
| `js/audio.js` | sound effects and music | Audio Designer |
| `js/fx.js`, `js/render.js` | particles, HUD, minimap, drawing | VFX |
| `js/data.js` | all weapons, upgrades, enemies and bosses as data, for balancing | QA / Balance |
| `js/util.js` | math helpers and input | shared |

## Tips for the presentation
- Show the title screen, then a run through at least one boss fight.
- Show `data.js` and say the game is data-driven: new content means adding an entry.
- Show the code split by role, and explain the procedural generation and the audio, which has no audio files.
- Say what you would add next: more floors, a meta-progression shop, gamepad support.
