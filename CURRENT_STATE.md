# Current State

## Status (2026-09-30)

The Osaka expansion is implemented on `master`: a Japanese story opening, the
Adventure quiz redesigned as one training field, the Osaka campaign map,
regional saves, and Sakai as the first full post-Matsubara city (40 questions,
four battles with Horde waves and the Osaka Defender ally). Matsubara's
campaign, battles and balance are unchanged. Pushing `master` deploys live
(GitHub Pages, https://nolancasama.github.io/esl-verbs/).

What a player sees now:
- Hero select → Japanese story crawl (西暦2199年, the Black Star in Lake Biwa,
  the Shadow Horde, Matsubara's Action Energy, the Action Core, 「きみだ。」 with
  the chosen hero) → Matsubara stages 1–4 as before.
- Adventure quiz: one training field (menu / AP / music strip on top; stage
  and count, an Action Energy gauge mirroring AP, the word with a speaker
  button, the hero and a training dummy, answer box, quiet HP/potion HUD). A
  correct answer is a class strike on the dummy as the AP lands.
- Matsubara ending adds the Osaka reveal → results with `つづける つぎの まちへ！`
  → Osaka map (Matsubara ★, Sakai きけん！, Yao / Higashiosaka / Osaka City locked).
- Sakai: short intro → quiz modes 1–4 (fresh random words) → battles
  First Assault / Horde Battle (2 waves) / Defenders Overwhelmed (the Osaka
  Defender joins at wave 2) / Final Sakai Defense (ally from the start, the
  Shadow Commander last) → ending (the ally stays in Sakai) → city results →
  map save animation. A checkpoint is saved at each Sakai stage start; the
  map and menu offer つづき / CONTINUE ADVENTURE.

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

- Story: can students read the crawl at its pace; do they tap on or skip;
  is ~47 s untouched too long in practice; is the furigana readable on a
  projector.
- The music cut when the Horde appears, the ominous/awaken tracks and the
  stings, by ear, and with TTS ducking.
- Training-field strike: does it feel rewarding without slowing the quiz
  (~0.5 s to impact); is the in-field Action Energy gauge understood.
- Sakai: is the 20-minute city too long for one lesson (checkpoints resume at
  the current stage); do students find the Horde waves and the ally clear.
- Earlier open items: real mic grant/denial, IME Enter, sprite build time and
  effect smoothness on a real school Chromebook.

## Tools

- `npm run art:png -- <outDir> [scale] [ids...]` (ids include `osakaDefender`,
  `trainingDummy`, `hordeCommander`, `map`).
- `npm run balance -- [seeds] [thresholds|detail]` prints win-rate tables.
- Run locally: `npm run serve` → http://localhost:8010.
