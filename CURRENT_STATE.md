# Current State

## Status (2026-10-01)

The Osaka expansion is implemented on `master`: the Osaka campaign map,
regional saves, and Sakai as the first full post-Matsubara city (40 questions,
four battles with Horde waves and the Osaka Defender ally). The 2026-10-01 pass
moved the story lore from the opening to the Matsubara ending and rebuilt the
Adventure quiz as a hero / word / dummy scene. Battles, AP, XP and balance are
unchanged. Pushing `master` deploys live (GitHub Pages,
https://nolancasama.github.io/esl-verbs/).

What a player sees now:
- Hero select → short intro (~10 s, four title beats: まつばら市 → あぶない！ with
  the Horde → the chosen hero, まもろう！ → STAGE 1) → Matsubara stages 1–4.
- Adventure quiz: menu / AP / music strip on top (the only AP display), a quiet
  stage / mode / count strip, then one scene: hero | word (speaker beneath) |
  training dummy, the hero's LV / HP / potions under the hero, the answer box
  centred below. A correct answer is a class strike on the dummy and +1 on the
  top meter as it hits; a wrong answer is a stumble.
- Matsubara ending: victory (darkness clears, MATSUBARA CITY IS SAFE!, YOU
  PROTECTED THE CITY!) → six lore cards (Action Energy, Black Star / Lake Biwa,
  Shadow Horde, why it attacked, the Action Core, 「きみだ！」) → Osaka reveal
  (the Horde has spread, 大阪を まもれ！) → results with `つづける つぎの まちへ！`
  → Osaka map (Matsubara ★, Sakai きけん！, Yao / Higashiosaka / Osaka City locked).
- Sakai: short intro → quiz modes 1–4 (fresh random words) → battles
  First Assault / Horde Battle (2 waves) / Defenders Overwhelmed (the Osaka
  Defender joins at wave 2) / Final Sakai Defense (ally from the start, the
  Shadow Commander last) → ending (the ally stays in Sakai) → city results →
  map save animation. A checkpoint is saved at each Sakai stage start; the
  map and menu offer つづき / CONTINUE ADVENTURE.

Verified 2026-10-01 (story / quiz-scene pass):
- `npm test` 95/95, browser playthrough passes unchanged, `npm run balance`
  output byte-identical to the previous commit.
- Scripted screenshots of the quiz scene (scripts in the session scratchpad, not
  the repo): Fighter / Mage / Ninja, stages 1–4, speech and mic-fallback
  choices, initial / strike / impact / correct / wrong / answer-reveal states, at
  1024×600, 1280×720, 1366×635, 1366×768, 1920×1080 and 412×860. No page
  scroll, no answer control past the field, no stats / answer overlap, no word
  overflow, no console errors. Strike effects land on the dummy for all three
  classes.
- Intro (10.2 s untouched) and the ending tapped through card by card at
  1024×600 and 1366×768: every card fits the story window without wrapping.

Verified 2026-09-30:
- `npm test` — 95 unit tests pass (Sakai balance measured like Matsubara:
  competent play, HP carried, retry assist; the retry guarantee test was shown
  to fail with the city retry-HP rule disabled).
- `PLAYWRIGHT_PATH=C:/Users/nolan/ui-verify/node_modules/playwright npm run test:browser`
  passes, including the new regional run (map → Sakai → quiz → checkpoint);
  that check was shown to fail with checkpoint saving disabled.
- Scripted screenshots with page-scroll checks (scripts in the session
  scratchpad, not the repo): quiz field stages 1–4 at 1366×768, 1366×635,
  1024×600, 1920×1000; story cinematics; Osaka map at 1366×768, 1366×742,
  1280×800, 1280×650, 1366×635, 1024×600, 1920×1000 (incl. save animation);
  continue menu and reset dialog; Matsubara and Sakai results at six sizes;
  Sakai battles 3 and 4 (wave hand-off, ally arrival) at 1366×768 and 1024×600.
  No page scroll, no console errors.
- A scripted full Sakai campaign in Chromium (choices fallback, TTS recorded,
  8/10 per stage, clicking the highlighted hint button like a student) went
  map → intro → 4 quizzes → 4 battles → ending → results → map with no
  retries, no console errors and no page scroll; the save then held
  Matsubara + Sakai and no checkpoint. An earlier run of that script exposed
  students getting permanently stuck in Sakai battles 3–4; the retune (city
  retry HP 60/80/100%, +2 AP per cleared wave, escalating waves) fixed it —
  see DESIGN_DECISIONS.md. A bot that ignores the hints (never guards or
  drinks) still loses the finale even at full HP and 10 AP — as it loses
  Matsubara's Dragon.
- Not heard: the new `ominous` / `awaken` tracks and `heroSting` / `allySting`
  / `wave` sfx were never listened to (no audio device).

## Architecture notes

- Frozen contract for the expansion: `.ai/osaka-spec.md`.
- `src/story.js` — story scripts (beats, `{漢字|かな}` furigana, `cardMs`).
  `playStory()` in `src/app.js` plays them (finish-once, SKIP, tap to advance).
  At 1024×600 a normal line holds ~17 characters and a large one ~8.
- Quiz scene: `renderAdventureQuestion()` / `trainingStrike()` in `src/app.js`;
  `rpg.css` "RPG quiz" section (`--px` backdrop scale, `--apx` actor scale set
  per viewport near the end of the file).
- `src/region.js` — CITIES (map positions), CITY_CAMPAIGNS (stage modes and
  encounters), city states, save parsing (`esl-verbs-region-v1`), checkpoints.
  `src/campaign.js` — `createCampaign(heroId, { cityId, level, xp })`,
  `chapterRest`, `resumeCampaign`.
- `src/osaka-map.js` — map view (markers, save animation); art in
  `pixel-effects.js` `osakaMapImage()`.
- Battles: one engine with optional `waves` / `ally` on encounters
  (`src/battle-data.js` ALLIES, sakai-1..4). `battle-ui.js` presents waves and
  the ally from the display snapshot; `fx-player.js` has ally effects.
- Art: Osaka Defender on the hero rig (`ALLY_IDS`), training dummy
  (`PROP_ART`), Shadow Commander (recoloured Goblin Captain), ground tiles.
- Debug: `?debug=quiz&stage=N&hero=X`, `?debug=map&preset=fresh|matsubara|sakai[&justSaved=id]`
  (writes the regional save), `?debug=battle` (city encounters, start wave),
  `?debug=art` (Sakai intro / ending / city results previews).

## Next Steps

1. Classroom check of the expansion (below), especially Sakai difficulty
   (first-try 5 AP is easier than Matsubara's bar; "hard" shows up as ~2.5
   lost battles per city) and the story length.
2. More cities: add a CITIES/CITY_CAMPAIGNS entry, city encounters with
   `city`, a `CITY_STORIES` entry; the flow, map and battle view need no changes.
3. Optional: a Sakai-specific skyline for its intro/ending (it reuses the
   Matsubara city art); hero titles for city campaigns; a level/XP presentation
   beyond LV 5 MAX (deliberately not done in this pass).

## Manual Chromebook / classroom checks still needed

- Story: does the ~10 s intro give enough context before Stage 1; can students
  read the ending's lore cards at their pace (they can tap on or skip); is the
  furigana readable on a projector.
- The music cut when the Horde appears, the ominous/awaken tracks and the
  stings, by ear, and with TTS ducking.
- Quiz scene on a real Chromebook: sprite scale-up smoothness at 1024×600, the
  strike (~0.5 s to impact) without slowing the quiz, and whether students
  notice +1 on the top AP meter now that the in-field gauge is gone.
- Sakai: is the 20-minute city too long for one lesson (checkpoints resume at
  the current stage); do students find the Horde waves and the ally clear.
- Earlier open items: real mic grant/denial, IME Enter, sprite build time and
  effect smoothness on a real school Chromebook.

## Tools

- `npm run art:png -- <outDir> [scale] [ids...]` (ids include `osakaDefender`,
  `trainingDummy`, `hordeCommander`, `map`).
- `npm run balance -- [seeds] [thresholds|detail]` prints win-rate tables.
- Run locally: `npm run serve` → http://localhost:8010.
