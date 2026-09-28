# Current State

## Status (2026-09-28, mid-way through the "Adventure RPG upgrade" task)

The Adventure RPG upgrade (AP economy, HP/potion/XP campaign, RPG quiz UI,
persistent AP meter, new late-16-bit art, tiered effects, synthesized music)
is **implemented and working**, but the task is **not yet finished or pushed**.
A local checkpoint commit exists; nothing has been pushed to
`origin` (github.com/nolancasama/esl-verbs) for this task yet.

Verified this session:
- `npm test` — 47 unit tests pass (battle, campaign, balance ladder, art, quiz).
- `PLAYWRIGHT_PATH=C:/Users/nolan/ui-verify/node_modules/playwright npm run test:browser`
  passes with zero console errors: Adventure quiz → stage clear → same AP meter
  in battle → victory with XP / LEVEL UP / NEW SKILL, a 0-AP recovery battle,
  music toggle persistence, Study mode 1.
- Headless screenshots at 1366×768 and 1366×635 of quiz, stage clear, battle
  (all bosses, trio fights), fire breath / earthquake / dark blast / fireball /
  shadow strike sequences, victory — layouts fit with no scrolling.
- Not heard: music/SFX were never listened to (no audio device). Not tried on a
  real Chromebook or with students.

## What the upgrade changed (see DESIGN_DECISIONS.md 2026-09-28 "Adventure RPG upgrade")

- **AP economy** (`src/battle-data.js`, `src/battle-engine.js`): quiz score =
  starting AP (0–10, cap 10). Every skill and the Potion cost AP (basic/defend 1,
  specials 2, big AoE/shadow 3, potion 1). At 0 AP the turn becomes
  RECOVERING: +1 AP, the enemies still act (`recover`, `mustRecover`).
  Tactical AP: Guard/Barrier up when a big attack lands +1 (Dodge avoids fully
  instead, no refund); Mage Magic Bolt on a charging/tired enemy +1.
- **Balance** (tuned by simulation, `test/balance-sim.js`,
  `node test/balance-report.mjs [seeds] [thresholds|detail]`): tiers 3–4,
  hint-following play wins ≈ 27% / 57% / 75% / 90% / 100% at 5/6/7/8/10 AP;
  smart play slightly higher; button-mashing ≈ 0–10%. Full campaigns: stage-4
  first-try wins 3% / 33% / 53% / 73% / 100% at 5/6/7/8/10 AP. Heavy-attack
  cycles are odd lengths on purpose (avoids rest/act parity traps).
- **Campaign** (`src/campaign.js`): HP carries over; victory heals 28% of max
  with a 40% floor; potions start 2, +1 per victory, cap 2; retries restart from
  the battle's entry HP/potions with +1/+3/+6/+10 AP assist; XP from defeated
  (non-summoned) enemies, +5 for a perfect quiz; levels L2/L3/L4/L5 after
  battles 1/2/3/4 on every path (L2 tier-1 skill, L3 tier-2 skill, L4 class
  passive: Iron Guard / Great Heal / Keen Eye, L5 mastery). Max HP +3/+6/+10/+14.
- **UI** (`src/app.js`, `src/battle-ui.js`, `src/ap-meter.js`, `rpg.css`):
  one persistent top-centre ACTION POINTS meter (single DOM node, 500 ms fill /
  drain with +N/−N chip) across Adventure quiz, stage clear, battle and defeat;
  RPG-framed Adventure quiz (Study unchanged); 5th ITEM button + potion menu;
  hints (big attack → defend, low HP → potion, powering up → keep 1 AP);
  victory screen with animated XP bar, level-ups, HP/potion restock;
  defeat screen shows retry AP; expanded `?debug=battle` (AP presets
  0/5/6/7/8/10, level, HP, potions, skill tier override) and `?debug=art`
  previews. The battle view shows a pre-turn snapshot during playback so HP bars
  drop per hit; it picks an integer `--px` (2–4) that fits the field.
- **Art** (`src/pixel-rig.js`, `src/pixel-heroes.js`, `src/pixel-enemies.js`,
  `src/pixel-sprites.js`): shaded part rig with hue-shifted 6-step material
  ramps, auto lighting, interior lines, outlines. Heroes 72×72 with full pose
  sets; enemies 46–84 px; bosses 104–132 × 114–128 with phase-2 variants.
  Sprite-state CSS is generated from the frame table (`spriteStateCss` in
  `src/battle-art.js`). Enemy defeat rows end on an empty frame and dead enemies
  are not rendered (fragment bug fixed; regression test in `test/art.test.js`).
- **Effects** (`src/pixel-effects.js` art, `src/fx-player.js` sequencer,
  `fx.css`): tier 1/2/3 effects, hero dash, lighting shifts, shake s/m/l, zoom
  punch, boss signatures (Fire Breath, Earthquake, Dark Blast, Blood Moon);
  reduced motion keeps only static hit flashes.
- **Audio** (`src/audio.js`): Web Audio synth + step sequencer, SNES-style echo,
  7 original tracks (title, field, battle, boss, victory, defeat, finale) and
  SFX; ♫ MUSIC ON/OFF saved in localStorage (`esl-verbs-music`); music ducks
  under TTS (`src/tts.js` onStart/onEnd) and is silenced while the mic listens
  (`TapToTalk` `onListenChange`). Study mode has no music.

## Next Steps (in order)

1. Review the last screenshots that were captured but not yet looked at:
   recovery turn, item menu, low-HP potion hint, victory with passive, final
   victory, defeat screen (re-run: debug battle with AP 0; `?debug=art` preview
   buttons). Fix anything that overflows or reads badly.
2. Small known UI nits: victory level-up icons sit on the XP panel's left edge
   at 1366×635; the enemy-plate/intents can crowd on very short screens.
3. Performance: pre-build sprite sheets in idle time (hero trio after the main
   menu paints; the upcoming encounter's sheets on the stage-clear screen) so
   Chromebooks don't hitch; measured desktop cost ≈ 50–70 ms per sheet.
4. Add `test/audio.test.js` (tracks parse, every channel bar-aligned, loops
   whole bars) and package scripts `"art:png": "node tools/render-sprites.mjs"`
   and `"balance": "node test/balance-report.mjs"`.
5. Update `SPEC.md` Adventure sections (Power → AP, costs, recovery, items,
   XP/levels, HP carry-over, retry assist) — still describes the old Power rules.
6. Optional polish if time: richer stage backdrops; smart-vs-hint margin is small
   (tactical rewards could be raised a little, then re-run the balance report).
7. Final: `npm test`, `npm run test:browser`, commit, push to origin.

## Manual Chromebook / classroom checks still needed

- Music volume/mix and ducking under ja-JP/en-US TTS; mic silencing during STT.
- Sprite-sheet build time and effect smoothness on a school Chromebook.
- Real microphone grant/denial, mic-free fallback, IME Enter behaviour (unchanged).
- Whether 5/10 students find stage 3–4 "hard but possible", and whether the
  RECOVERING turn and the keep-1-AP hint are understood without explanation.

## Tools

- `node tools/render-sprites.mjs <outDir> [scale] [ids...]` writes sprite /
  effect / backdrop sheets as PNGs (no browser) for art review.
- `node test/balance-report.mjs 12` prints win-rate tables; add `thresholds`
  or `detail` for per-encounter views.
- Run locally: `npm run serve` → http://localhost:8010 (`?debug=battle`, `?debug=art`).
