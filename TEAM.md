# DEEP BREAKER - Team Contributions

Group project: HTML Game Development | Team: YOUR TEAM NAME | Members: 8

Replace "Member 1" to "Member 8" with real names. Edit the "What they did" lines so they match what each person actually did.

| # | Member | Role | Files | What they did |
|---|--------|------|-------|---------------|
| 1 | Member 1 | **Project Lead & Game Director** | `js/game.js`, `README.md` | Designed the game concept and structure. Built the game loop and state machine (title, play, pause, cards, game over, victory). Built wave spawning, room locking and clearing, scoring and combos, pickups, and the shop and treasure logic. Managed the GitHub repo and the schedule. |
| 2 | Member 2 | **Gameplay Programmer - Player & Weapons** | `js/player.js` | Built player movement, aiming, dash with invincibility, and weapon switching. Built the 5 weapons (harpoon gun, sonar repeater, flak cannon, rail harpoon, torpedo launcher) and the bullet system: pierce, ricochet, homing, explosions and crits. Built the 16 stackable upgrades' behaviour. |
| 3 | Member 3 | **AI Programmer - Enemies** | `js/enemy.js` | Programmed the 8 sea creatures: piranha (chaser), minnow swarm, squid (ranged), swordfish (charges with warning), pufferfish (explodes), armored crab, urchin (turret) and giant clam (spawner). Added elite enemies, knockback, slow effects and enemy separation. |
| 4 | Member 4 | **Boss Designer & Programmer** | `js/boss.js` | Designed and built the 3 bosses (King Crab, The Angler, The Kraken) with 3 phases each. Built the reusable attack library: ring, aimed, spiral, beams, charge, summon, bombs and teleport. |
| 5 | Member 5 | **Level Designer - Floors & Rooms** | `js/world.js` | Built the procedural floor generator (random room maps), the 7 room layouts, and the treasure and shop room placement. Built the sandy/wooden/rock floor textures, rock walls, coral/crate/crystal obstacles and doors. |
| 6 | Member 6 | **UI / UX Designer & Programmer** | `index.html`, `css/style.css`, `js/ui.js`, `js/config.js` | Designed the title screen, how-to-play, credits, pause, upgrade-card selection, game over and victory screens. Wrote the CSS styling and animations and the scaling for different screen sizes. |
| 7 | Member 7 | **Audio Designer - SFX & Music** | `js/audio.js` | Built all sound effects and the adaptive music with the WebAudio API, with no audio files. Music tempo and key change per floor, and it gets more intense during fights. |
| 8 | Member 8 | **Pixel Artist, VFX & QA** | `js/sprites.js`, `js/fx.js`, `js/render.js`, `js/data.js` | Made all the pixel-art characters (submarine, 8 sea creatures, 3 bosses, deck guns, pickups) and the underwater look. Built the particles, screen shake, damage numbers, HUD and minimap. Balanced the numbers in `data.js` and tested the whole game. |

## Shared work
- **`js/util.js`**: math helpers and keyboard/mouse input (Members 1 and 2).
- **Everyone**: playtesting, bug reports, and the final presentation.

## Suggested talking points for the presentation (about 30 seconds each)
1. **Lead**: the idea, the 1-month plan, how the pieces connect.
2. **Player**: weapons and the upgrade system. Show a build with ricochet or homing torpedoes.
3. **Enemies**: show each enemy's behaviour and its warning signs.
4. **Bosses**: show a boss phase change.
5. **Levels**: show that every run has a different floor map.
6. **UI**: walk through the menus and the upgrade cards.
7. **Audio**: play it and mention there are no sound files.
8. **Art & QA**: show the sprite sheet and explain how the art was built.
