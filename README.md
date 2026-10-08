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
- Hand-built pixel-art characters with animation, eyes that track the player, and textured, themed floors and walls
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
| `js/sprites.js` | pixel-art painter that draws every character (player, enemies, bosses) in code | Artist / VFX |
| `js/fx.js`, `js/render.js` | particles, HUD, minimap, drawing | VFX |
| `js/data.js` | all weapons, upgrades, enemies and bosses as data, for balancing | QA / Balance |
| `js/util.js` | math helpers and input | shared |

## Who did what, and how it works

Each member's part is below. "What" is the job, and "How" explains the code in simple words, so anyone can read it and explain it. A short table is also in [TEAM.md](TEAM.md).

### Member 1: Project Lead & Game Director (`js/game.js`)
**What:** The "brain" of the game. It decides what is happening right now and ties every other part together.
**How it works:**
- There is one big object called `G` that holds everything: the player, the enemies, the bullets, the score and the current room.
- The game is a **state machine**. `G.state` is one of `title`, `play`, `pause`, `cards`, `dying`, `over` or `win`. Every frame, `G.tick()` checks the state and runs only the matching code.
- When you enter a room, `enterRoom()` locks the doors. `spawnWave()` then creates enemies from a **budget**: each enemy type has a cost (a grunt costs 1, a tank costs 4). The budget grows with the floor number, so later floors get more enemies. Each room has 2 waves.
- When every enemy is dead, `clearRoom()` opens the doors and drops an upgrade orb and some coins.
- **Score:** each kill adds points times a combo multiplier. The combo goes up with each kill and resets if you take damage or wait 3 seconds.
- Shops and treasure rooms use **pedestals**. Press `E` near one to buy or take the item.

### Member 2: Gameplay Programmer, Player & Weapons (`js/player.js`)
**What:** Everything the player does: moving, aiming, dashing, shooting, and the bullets.
**How it works:**
- Movement is **smoothed**: the speed moves toward the target speed a little each frame, so it feels slippery and not stiff.
- **Dash:** pressing Space gives a fast burst (0.17 seconds) with a short invincibility window, then a 1.1 second cooldown.
- **Shooting:** `fire()` makes one or more `Bullet` objects. The weapon's numbers (damage, speed, spread, pellets) come from `data.js`. A crit does 2.5x damage.
- **Bullets** move in small steps so fast bullets can't skip through walls or enemies. One bullet class handles every special effect: pierce (goes through enemies), bounce (ricochets off walls), homing (steers toward the nearest enemy) and explode (area damage).
- **Upgrades** just change numbers on the player (for example `dmgMul *= 1.2`). The bullet code reads those numbers when it fires.

### Member 3: AI Programmer, Enemies (`js/enemy.js`)
**What:** The 8 enemy types and how each one thinks.
**How it works:**
- One `Enemy` class. Inside `update()`, a `switch` on the enemy's `ai` field picks its behaviour:
  - **chase / swarm:** run at the player (swarmers wobble).
  - **shoot:** keep a distance, strafe, and fire aimed shots.
  - **dash:** a 4-step state machine: move, wind up (shows a yellow warning line), dash, rest.
  - **bomber:** runs close, starts a fuse, then explodes. It also explodes if you kill it, and the blast hurts other enemies.
  - **tank:** slow, and fires a 5-bullet spread after a short wind-up.
  - **turret:** stands still and fires rings of bullets while rotating.
  - **spawner:** floats around and spawns swarmers.
- Every enemy has a 0.85 second **spawn warning** so they never appear on top of you.
- **Elite enemies** (gold dashed ring) have more health and damage and give triple score.
- Enemy health and damage **scale with the floor number**, and enemies gently push each other apart so they don't stack.

### Member 4: Boss Designer & Programmer (`js/boss.js`)
**What:** The three bosses: The Warden, Hive Mother and The Void Core.
**How it works:**
- `Boss` extends `Enemy`, so it reuses health, damage and hit effects.
- Each attack is a **method** named `atk_<name>()` (for example `atk_ring`, `atk_spiral`, `atk_charge`). The method runs every frame and returns `true` when it is finished. The boss then waits a moment and picks the next attack.
- The boss has **3 phases**, which change at 62% and 30% of its health. In later phases, attacks fire more bullets and the waits get shorter.
- `data.js` lists which attacks each boss can use and in which phase. The Warden uses 4 attacks and the Void Core uses 6, all built from the same attack library, so adding a new boss is quick.
- Bosses have a 1.6 second intro where they can't be hurt, while the name banner shows.

### Member 5: Level Designer, Floors & Rooms (`js/world.js`)
**What:** Making a different dungeon every run, and making it look good.
**How it works:**
- `generateFloor()` starts with one room in the middle of a 5x5 grid. It repeatedly picks an existing room and tries to grow a new room next to it. A new room may only touch **one** existing room, so the map is a tree with no loops.
- The room farthest from the start becomes the **boss room**. Two other dead-end rooms become the **treasure room** and the **shop**.
- 7 room layouts (`ROOM_TEMPLATES` in `data.js`) place obstacles. Door lanes are kept clear so you can always walk through.
- For speed, `bakeRoom()` draws the room's background **once** onto a hidden canvas (floor tiles, brick walls, obstacles, door gaps). Each frame the game just copies that image.
- Each floor has its own decoration style: metal plates and hazard stripes (Foundry), moss and grass (Overgrowth), glowing cracks and crystals (Void).

### Member 6: UI / UX Designer & Programmer (`index.html`, `css/style.css`, `js/ui.js`, `js/config.js`)
**What:** All the menus and screens.
**How it works:**
- The menus are normal **HTML and CSS** laid on top of the game canvas. Showing a screen means adding a `show` CSS class to it.
- The upgrade screen builds 3 cards with JavaScript and handles both clicks and the number keys 1, 2 and 3.
- The whole game scales to any window size. `G.init()` measures the window and sets the size of the game box and its font size. All menu sizes use `em` units, so they scale with it.
- `config.js` holds the team name and members. The Credits screen reads it, so you only edit one file.

### Member 7: Audio Designer (`js/audio.js`)
**What:** All sound effects and music. There are no audio files.
**How it works:**
- It uses the browser's **WebAudio** API. A sound effect is an oscillator (a wave such as square or sawtooth) whose pitch slides down and whose volume fades out quickly. Explosions and hits add filtered noise.
- `Sound.play('name')` has one `case` per sound, so adding a sound is one new line.
- **Music is generated.** A timer runs every 60 ms and schedules the next few notes slightly ahead of time, which keeps the beat steady. Each floor has its own tempo and chord pattern.
- The music is **adaptive**. It starts calm (bass and a soft pulse). When a fight starts, drums and an arpeggio fade in. The game sets an `intensity` value and the music reacts.

### Member 8: Pixel Artist, VFX & QA (`js/sprites.js`, `js/fx.js`, `js/render.js`, `js/data.js`)
**What:** The look of the game, plus testing and balancing.
**How it works:**
- **Pixel art in code:** a small painter class (`Px`) draws each character pixel by pixel into a small image, once at start-up. It has tools for shaded rectangles, shaded ellipses (lit from above in 4 tones so they look round), polygons and an automatic dark outline. Characters are painted on the left half and **mirrored**, so they are symmetrical.
- **Living characters:** sprites bob and squash while moving, flash white when hit, and the **pupils follow the player**.
- **`fx.js`:** particles (sparks, explosions), floating damage numbers, expanding rings, screen shake and a short slow-motion "hit-stop" when the player is hurt. Glow is a pre-made soft sprite, which is much faster than real blur.
- **`render.js`:** draws everything in layers (background, doors, pickups, enemies, player, bullets, effects), then the vignette, HUD, minimap and banners.
- **`data.js`:** every weapon, upgrade, enemy and boss is listed as data (health, speed, damage, color). Balancing the game means editing numbers here, with no code changes.
- **QA:** the whole game was played through repeatedly to find bugs and tune difficulty.

## Tips for the presentation
- Show the title screen, then a run through at least one boss fight.
- Show `data.js` and say the game is data-driven: new content means adding an entry.
- Show the code split by role, and explain the procedural generation and the audio, which has no audio files.
- Say what you would add next: more floors, a meta-progression shop, gamepad support.
