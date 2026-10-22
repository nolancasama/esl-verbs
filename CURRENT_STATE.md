# Current State

## Status (2026-10-22)

Slice 2 adds Yao as the next playable city after Sakai: four quiz/battle stages,
reinforcement callers, countdown bombs, a charging archer, passive Orc protection,
the Signal Captain and the Warcaller. Calls are visible intents for one player
turn; defeating the caller stops the reinforcements. Yao uses the existing city
checkpoint, progression and retry assist rules, without an ally.

Defeating a caller while CALLING HELP shows gives +1 AP (STOP!); a protected
caller's hint points at the Orc. Before every city battle a station-defence map
(Osaka-map style, real station geography, burning houses) shows what is defended.
Slice 1 the same day: clearer target selection with a first-time hint, a SOUND
popover with separate Music / SFX volumes (12% defaults), hero-specific strike
sounds and a +1 that flies to the AP meter.

Verified 2026-10-22: `npm test` 134/134; `npm run balance` passes with the
Matsubara/Sakai report bytes unchanged; both Yao bots (threat priority and
first-target) complete Yao at every AP 0–10 within six attempts per battle,
priority play has the higher first-try rate (yao-3 37/75/100%, yao-4
22/100/100% at AP5/7/10, hero mean). The browser playthrough passes with the requested Playwright path:
Stage Clear → station map → battle, Yao unlock/checkpoint, call telegraph and
arrival, and the protected Warcaller via debug. Four review screenshots are in
`.tmp/browser/`; checked views fit 1024×600 without page scroll.

2026-10-17: Adventure Stage 4 now uses the same learning format as Stage 3 —
visible Japanese prompt (spoken with ja-JP TTS) → spoken English answer. There
is no Japanese-listening-only quiz phase any more (Japanese listening is not the
target skill). Modes are now 1 see EN → type JA, 2 hear EN → type JA, 3 and 4
see JA → speak EN; Stage 4 is still its own round, AP and battle. Study Level 4
reads the same config, so it now matches Level 3.
Verified: `npm test` 95/95, browser playthrough passes, `npm run balance`
byte-identical to the previous commit; a scratchpad Playwright script played
stages 3 and 4 by stubbed speech (Japanese visible on every question and after
answering, ja-JP TTS of the shown word, recognition en-US, 10 AP → Stage Clear →
BATTLE! opens the battle) and both fallbacks (no recognition API; three
recognition errors) with choices under the still-visible Japanese.

The Osaka expansion is implemented on `master`: the Osaka campaign map,
regional saves, and Sakai as the first full post-Matsubara city (40 questions,
four battles with Horde waves and the Osaka Defender ally). The 2026-10-01 pass
moved the story lore from the opening to the Matsubara ending and rebuilt the
Adventure quiz as a hero / word / dummy scene; a follow-up polish pass the same
day (lower-third intro titles, shorter lore, centred word, larger stage banner,
Fighter shield layering). A 2026-10-02 UI polish pass followed: Ninja hero text,
a backing plate behind the quiz word, a labelled answer slot, a flat status
nameplate, quiz actors at 90%, and the intro hero a little further left.
On 2026-10-05 the streak badge moved over the dummy and Stage Clear was cut
down to title → hero + nameplate → AP meter → note → BATTLE!.
Matsubara and Sakai combat numbers and behavior are unchanged. Pushing `master` deploys live (GitHub Pages,
https://nolancasama.github.io/esl-verbs/).

What a player sees now:
- Hero select → short intro (~10 s, four lower-third title beats over the city:
  まつばら市 → あぶない！ with the Horde → the chosen hero on the left, facing
  the Horde on the right, まもろう！ → STAGE 1)
  → Matsubara stages 1–4.
- Adventure quiz: menu / AP / SOUND strip on top (the only AP display), a
  readable stage / instruction / count banner, then one scene: hero | word on
  a translucent plate (speaker beneath) | training dummy, a flat nameplate
  (NAME · LV, then HP + potions) under the hero, the word centred between the
  banner and the answer box, which sits a short way below the scene. Typed
  stages answer in a dark こたえ / ANSWER slot. A correct answer plays a class
  weapon/cast and impact sound, then a +1 energy mote travels from the dummy
  to the top meter; arrival fills and pops the segment with an AP chime.
  Reduced motion applies AP at impact without the mote; a screen change settles
  pending AP once. A wrong answer is a stumble. From 2 in a row, an
  "N in a row!" badge bobs centred above the dummy.
- Stage Clear (between quiz and battle): STAGE N CLEAR! → the hero on the
  stage backdrop with the nameplate on the floor under them → the AP meter
  (the only AP display here; no topbar, no score line, no enemy list) → the
  AP note (EN / JA lines; the rest text at 0 AP) → BATTLE! → the stage's station
  defence map → DEFEND! → battle. This applies to Matsubara, Sakai and Yao;
  retries go directly to battle.
- Matsubara ending (~26 s auto-play, every card tap-to-advance): victory
  (darkness clears with MATSUBARA CITY IS SAFE!, YOU PROTECTED THE CITY!) →
  five lore cards (Action Energy; Black Star in Lake Biwa + Shadow Horde; why
  it attacked; the Action Core, then the short 「きみだ！」 beat) → Osaka reveal
  (the Horde has spread, then 大阪を まもれ！ / SAVE OSAKA!) → results with `つづける つぎの まちへ！`
  → Osaka map (Matsubara ★, Sakai きけん！; saving Sakai unlocks playable Yao).
  Higashiosaka and Osaka City remain locked until their campaigns exist.
- Sakai: short intro → quiz modes 1–4 (fresh random words) → battles
  First Assault / Horde Battle (2 waves) / Defenders Overwhelmed (the Osaka
  Defender joins at wave 2) / Final Sakai Defense (ally from the start, the
  Shadow Commander last) → ending (the ally stays in Sakai) → city results →
  map save animation. A checkpoint is saved at each Sakai stage start; the
  map and menu offer つづき / CONTINUE ADVENTURE.
- Yao: short horn-call intro → quiz modes 1–4 → Horn Call / Danger Everywhere /
  Signal Captain / Warcaller (two waves each, no ally) → ending → city results
  → map save animation. Checkpoints and resume work like Sakai. Callers show
  CALLING HELP during the player's turn; killing them stops the call. Bombs
  count down to BOOM; Guard/Barrier reduce it and Dodge avoids it. Orc badges
  show the caller/boss they protect; defeating the Orc removes protection.
- Battle targeting: select with ←/→ or tap anywhere on an enemy; selection
  never attacks. The selected enemy has a larger marker, gold plate, stepped
  ground ring and warm sprite backing, plus an accessible target announcement.
  A Japanese-first field hint becomes quiet after the first real target change
  in the current Adventure session; Study/debug battles use the quiet hint.
- SOUND opens a body-level popover with independent Music and SFX sliders
  (12% defaults), live percentages and Escape/outside-click dismissal. Battle
  keys pause while it is open. Volumes persist separately; legacy music OFF
  migrates once to music 0 without muting SFX. Ducking scales the chosen music
  level, and live music changes keep the current track position.

Verified 2026-10-05 (streak badge + Stage Clear):
- `npm test` 95/95, browser playthrough passes (its Stage Clear check now
  asserts the meter under the scene and no topbar instead of the removed
  "= 10 AP" text), `npm run balance` byte-identical to the previous commit.
- Scripted screenshots + geometry against a HEAD baseline: streak badge centre
  = dummy centre (to 0.1 px) at 1024×600, 1366×768, 1920×1080, and unchanged
  during the hit shake; hero, word and dummy positions identical to baseline.
  Stage Clear for Fighter / Mage / Ninja at 1024×600 (and Fighter at 1366×768,
  1920×1080), full and 0 AP: no page scroll (the old screen scrolled 11 px at
  1024×600), no console errors; BATTLE! starts the battle with its own topbar.
  Not checked: phone widths for Stage Clear.

Verified 2026-10-02 (UI polish pass):
- `npm test` 95/95, browser playthrough passes, `npm run balance` byte-identical
  to the previous commit.
- Scripted screenshots + geometry (scratchpad scripts): quiz stages 1–4 at
  1024×600, 1366×768, 1920×1080, 412×860; forced words "skateboard",
  "practice", "go" and スケートボードをする; typed text, wrong and correct
  states; Mage / Ninja / Fighter strikes mid-hit; hero select; intro hero beat
  for all three heroes at 1024×600 and 1366×768. No page scroll, each word inside
  its plate, no plate / actor overlap, no console errors. Known and unchanged:
  at 412×860 a two-line Japanese word pushes the nameplate onto the answer box.

Verified 2026-10-01 (polish pass):
- `npm test` 95/95, browser playthrough passes, `npm run balance` byte-identical
  to the previous commit.
- Scripted screenshots + geometry (scratchpad scripts): quiz stages 1–4 at
  1024×600, 1366×768, 1920×1080 (typed, listening, speech with a stubbed
  SpeechRecognition, mic-fallback), Mage / Ninja, wrong-answer state, 412×860.
  No page scroll, banner on one line with the count inside, word centre within
  1 px of the banner–answer midpoint, answer position unchanged after answering.
- Intro beats at 1024×600 and 1366×768 (skyline clear of the title); ending
  tapped card by card at 1024×600 (every line on one line, ends on results).
- Correction pass: the raised-shield change was reverted (the issue was Fighter
  idle); the lowered shield now sits at hand −5 so only its inner edge is behind
  the torso (all four idle frames, the lowered poses, and guard / counter
  rendered). The intro hero stands on the left above the title (Fighter, Mage,
  Ninja at 1024×600 and 1366×768); the ending hero position is unchanged.

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
  `rpg.css` "RPG quiz" section (field rows banner | 1fr | scene | 1fr | answer |
  1.3fr; the prompt column centres the word, `.rpg-field__under` holds the
  speaker / audio error) (`--px` backdrop scale, `--apx` actor scale set
  per viewport near the end of the file).
- `src/region.js` — CITIES (map positions), CITY_CAMPAIGNS (stage modes and
  encounters), city states, save parsing (`esl-verbs-region-v1`), checkpoints.
  `src/campaign.js` — `createCampaign(heroId, { cityId, level, xp })`,
  `chapterRest`, `resumeCampaign`.
- `src/osaka-map.js` — map view (markers, save animation); art in
  `pixel-effects.js` `osakaMapImage()`.
- Battles: one engine with optional `waves` / `ally` on encounters
  (`src/battle-data.js` ALLIES, sakai-1..4, yao-1..4). Calls and bombs use the
  intent system; reinforcements wait until the next phase and give no XP.
  `battle-ui.js` presents waves and the ally from the display snapshot;
  `fx-player.js` has ally and reinforcement effects.
- `src/battle-locations.js` / `src/station-map.js` supply the station defence
  card before each Adventure battle; the app mounts the controller-owned card.
- Art: Osaka Defender on the hero rig (`ALLY_IDS`), training dummy
  (`PROP_ART`), Shadow Commander (recoloured Goblin Captain), ground tiles.
- Dev jump: **Ctrl+Alt+Shift+D** on any screen opens a panel (hero, quiz score,
  then Quiz / Battle 1–4 or Map for each playable city); it rewrites this
  browser's regional save (earlier cities saved, later progress cleared).
- Debug: `?debug=quiz&stage=N&hero=X`, `?debug=map&preset=fresh|matsubara|sakai[&justSaved=id]`
  (writes the regional save), `?debug=battle` (city encounters, start wave),
  `?debug=art` (Sakai intro / ending / city results previews).

## Next Steps

1. Classroom check of Sakai and Yao difficulty, story length, call telegraphs,
   bomb countdowns and Orc protection; check station-map pacing between rounds.
2. Higashiosaka next, then Osaka City — both specs are frozen:
   `.ai/higashiosaka-spec.md` and `.ai/osaka-city-spec.md`. **H0 is done**
   (spec §11: sprites, Core prop + plate CSS, four station maps); **H1 is done**
   (Core engine + battle UI, generic test-only fixtures, debug Core checkbox).
   Next is H2 (Higashiosaka data, campaign, balance). Osaka City (O0 → O1)
   builds on the Core system.
3. Not heard yet (no audio device): the new strike/impact/AP-gain sfx and the
   12% defaults on Chromebook speakers.
4. Optional: a Sakai-specific skyline for its intro/ending (it reuses the
   Matsubara city art); hero titles for city campaigns; a level/XP presentation
   beyond LV 5 MAX (deliberately not done in this pass).

## Manual Chromebook / classroom checks still needed

- Story: does the lower-third title read on a projector; does the ~10 s intro
  give enough context before Stage 1; can students
  read the ending's lore cards at their pace (they can tap on or skip); is the
  furigana readable on a projector.
- The music cut when the Horde appears, the ominous/awaken tracks and the
  stings, by ear, and with TTS ducking.
- Quiz scene on a real Chromebook: sprite scale-up smoothness at 1024×600,
  hero-specific strike sounds and the energy mote / AP segment pop; check that
  students notice the AP gain without slowing the quiz.
- Sakai: is the 20-minute city too long for one lesson (checkpoints resume at
  the current stage); do students find the Horde waves and the ally clear.
- Yao: do students notice CALLING HELP and learn to stop it; are countdowns
  and protection badges clear, and can first-target play recover through retries.
- Earlier open items: real mic grant/denial, IME Enter, sprite build time and
  effect smoothness on a real school Chromebook.

## Tools

- `npm run art:png -- <outDir> [scale] [ids...]` (ids include `osakaDefender`,
  `trainingDummy`, `hordeCommander`, `map`).
- `npm run balance -- [seeds] [thresholds|detail]` prints win-rate tables.
- Run locally: `npm run serve` → http://localhost:8010.
