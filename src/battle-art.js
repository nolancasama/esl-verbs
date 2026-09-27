const STATES = new Set(['idle', 'attack', 'special', 'guard', 'cast', 'dodge', 'hit', 'charge', 'defeat', 'victory']);

const svg = (id, state, body, boss = false) => `
  <svg class="battle-sprite${boss ? ' battle-sprite--boss' : ''}" data-art-id="${id}" data-state="${STATES.has(state) ? state : 'idle'}"
    viewBox="0 0 120 120" role="img" aria-label="${id}" xmlns="http://www.w3.org/2000/svg">
    ${body}
  </svg>`;

const HERO_ART = {
  fighter: `
    <g stroke="#233148" stroke-width="5" stroke-linejoin="round">
      <circle fill="#f3bd88" cx="47" cy="29" r="16"/><path fill="#d94d4d" d="M28 22 47 7l18 15-7 4H34z"/>
      <path fill="#2878d0" d="M31 47h33l10 42H22z"/><path fill="#e6eef8" d="m71 49 10 7-32 40-9-8z"/>
      <path fill="#fff" d="m77 45 20-23 7 6-20 23z"/><path fill="#f1b539" d="m72 43 17 15"/>
    </g>`,
  mage: `
    <g stroke="#33264f" stroke-width="5" stroke-linejoin="round">
      <path fill="#6246b8" d="m17 38 35-31 25 31z"/><path fill="#f1b539" d="M31 28h35"/>
      <circle fill="#f3bd88" cx="49" cy="45" r="14"/><path fill="#7251c7" d="M28 59h37l16 42H14z"/>
      <path fill="none" d="m80 29 5 70"/><circle fill="#63d9df" cx="80" cy="22" r="10"/>
    </g>`,
  ninja: `
    <g stroke="#20283b" stroke-width="5" stroke-linejoin="round">
      <circle fill="#27334d" cx="48" cy="34" r="22"/><path fill="#f0b889" d="M28 31h39v12H28z"/>
      <path fill="#17233a" d="M26 55h42l12 43H14z"/><path fill="#df4058" d="m65 44 37 12-31 5z"/>
      <path fill="#e8edf5" d="m72 67 27-21 5 7-27 21z"/>
    </g>`,
};

const ENEMY_ART = {
  slime: `<path fill="#58c982" stroke="#176941" stroke-width="5" d="M19 93q5-58 41-58t41 58q-17 15-41 15T19 93z"/><circle cx="48" cy="75" r="5"/><circle cx="72" cy="75" r="5"/>`,
  bat: `<g fill="#7655a8" stroke="#30224c" stroke-width="5"><path d="M58 53Q22 16 10 45q17-2 12 20 19-13 36 5zM62 53q36-37 48-8-17-2-12 20-19-13-36 5z"/><circle cx="60" cy="65" r="19"/></g><circle fill="#fff" cx="52" cy="61" r="4"/><circle fill="#fff" cx="68" cy="61" r="4"/>`,
  mushroom: `<path fill="#efe8d6" stroke="#594938" stroke-width="5" d="M45 56h30l8 48H37z"/><path fill="#e75a5a" stroke="#7f2828" stroke-width="5" d="M15 58Q22 16 60 16t45 42z"/><circle fill="#fff1c7" cx="42" cy="37" r="8"/><circle fill="#fff1c7" cx="75" cy="29" r="6"/>`,
  goblin: `<g stroke="#264b2e" stroke-width="5" stroke-linejoin="round"><path fill="#71b86b" d="m35 27-24-8 17 27m57-19 24-8-17 27"/><circle fill="#71b86b" cx="60" cy="47" r="28"/><path fill="#864f33" d="M33 72h54l10 35H23z"/></g><circle cx="49" cy="43" r="4"/><circle cx="71" cy="43" r="4"/>`,
  wolf: `<g fill="#768392" stroke="#303b48" stroke-width="5" stroke-linejoin="round"><path d="m26 43 7-30 20 20m41 10-7-30-20 20"/><path d="M24 49q36-32 72 0l-13 48H37z"/><path fill="#dce3e8" d="m37 66 23 35 23-35-23 12z"/></g>`,
  skeleton: `<g fill="#f1eedb" stroke="#4c4e50" stroke-width="5"><circle cx="60" cy="32" r="22"/><path d="M45 53v43m30-43v43M36 68h48M45 79h30"/></g><circle cx="51" cy="29" r="5"/><circle cx="69" cy="29" r="5"/>`,
  shieldGoblin: `<g stroke="#274632" stroke-width="5"><circle fill="#71b86b" cx="67" cy="39" r="24"/><path fill="#70462f" d="M43 62h42l9 42H34z"/><path fill="#477aa8" d="M10 51h39v43L29 108 10 94z"/></g>`,
  healer: `<g stroke="#4b3c54" stroke-width="5"><circle fill="#79bc75" cx="63" cy="35" r="22"/><path fill="#e9e4f4" d="M38 58h48l13 48H25z"/><path d="m25 26-4 75"/><circle fill="#e8cc54" cx="25" cy="20" r="9"/></g><path stroke="#55a359" stroke-width="6" d="M61 72v22M50 83h22"/>`,
  golem: `<g fill="#8e8173" stroke="#443d36" stroke-width="5" stroke-linejoin="round"><path d="m29 15 25 8 24-8 18 30-8 59H27l-7-59z"/><path fill="#b0a18e" d="M39 30h41v31H39z"/></g><circle fill="#f3b43c" cx="50" cy="43" r="5"/><circle fill="#f3b43c" cx="69" cy="43" r="5"/>`,
  goblinCaptain: `<g stroke="#263b2b" stroke-width="5"><path fill="#d9a734" d="M28 31 39 9l20 15L78 8l13 24z"/><circle fill="#6aaa65" cx="59" cy="49" r="26"/><path fill="#9b3c34" d="M31 70h56l12 37H19z"/></g>`,
  necromancer: `<g stroke="#342342" stroke-width="5"><path fill="#30223e" d="M22 103q6-71 38-84 32 13 38 84z"/><circle fill="#a3c896" cx="60" cy="44" r="17"/><path fill="none" d="m99 22-8 81"/><circle fill="#9b62c8" cx="99" cy="18" r="9"/></g>`,
  dragon: `<g fill="#c9473f" stroke="#632520" stroke-width="5" stroke-linejoin="round"><path d="m26 51-17-31 34 17m46 14 22-27-37 13"/><path d="M21 89q12-60 69-52l15 58-34-9-24 21z"/><path fill="#efb34e" d="m17 79 25-13-4 26z"/></g>`,
  demonKing: `<g stroke="#271c34" stroke-width="5"><path fill="#30203d" d="m34 35-18-25 30 13m40 12 18-25-30 13"/><circle fill="#774a86" cx="60" cy="45" r="27"/><path fill="#342341" d="M24 70h72l13 39H11z"/></g><circle fill="#f05262" cx="50" cy="43" r="5"/><circle fill="#f05262" cx="70" cy="43" r="5"/>`,
  giantGolem: `<g fill="#756f68" stroke="#353330" stroke-width="6" stroke-linejoin="round"><path d="M14 48 31 9l27 14L87 8l20 42-10 61H22z"/><path fill="#9d9589" d="M34 29h51v38H34z"/><path d="m21 61-16 35m94-35 16 35"/></g><circle fill="#ef9b32" cx="49" cy="47" r="6"/><circle fill="#ef9b32" cx="70" cy="47" r="6"/>`,
  vampireLord: `<g stroke="#301c31" stroke-width="5"><path fill="#34223d" d="M8 105q9-71 52-83 43 12 52 83L81 86l-21 26-21-26z"/><circle fill="#ead7cf" cx="60" cy="39" r="23"/><path fill="#9d253e" d="M35 60h50L60 108z"/></g><path fill="#fff" d="m49 50 6 12 5-12 5 12 6-12z"/>`,
};

const BOSSES = new Set(['dragon', 'demonKing', 'giantGolem', 'vampireLord']);

/** Return the inline placeholder SVG for a hero or enemy id. */
export function getBattleArt(id, state = 'idle') {
  const body = HERO_ART[id] || ENEMY_ART[id];
  if (!body) return svg('unknown', state, '<rect x="25" y="25" width="70" height="70" rx="12" fill="#8993a3"/><text x="60" y="72" text-anchor="middle" font-size="35">?</text>');
  return svg(id, state, body, BOSSES.has(id));
}

export const battleArt = getBattleArt;

