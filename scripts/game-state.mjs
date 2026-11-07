// Read a full, numeric CUA accessibility tree. Indices belong to this snapshot.
const floors = ['Basement', 'Boiler Room', 'Service Shaft', 'Machine Hall', 'Antenna Deck', 'Rooftop'];
const gameRoot = /^AXWebArea Rooftop Reset · Tibo Arcade, URL: (?:https:\/\/)?(?:www\.)?poteto\.com\/?$/;
const duration = /^\d+:[0-5]\d(?:\.\d+)?$/;

function emptyState() {
  return {
    screen: 'unknown', floor: null, mode: null, deaths: null, time: null,
    resetReady: false, buttons: { hard: null, resume: null, retry: null, back: null, reset: null },
  };
}

function readRoot(ax) {
  if (typeof ax !== 'string') return null;
  const roots = [];
  const stack = [];
  const indices = new Set();
  for (const line of ax.split(/\r?\n/)) {
    const match = /^([ \t]*)(\d+)\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].replace(/\t/g, '    ').length;
    const id = Number(match[2]);
    if (indices.has(id)) return null;
    indices.add(id);
    const node = { id, label: match[3].trimEnd(), children: [] };
    while (stack.length && stack.at(-1).level >= level) stack.pop();
    (stack.length ? stack.at(-1).node.children : roots).push(node);
    stack.push({ level, node });
  }
  return roots.length === 1 && gameRoot.test(roots[0].label) ? roots[0] : null;
}

function one(parent, expression) {
  const matches = parent?.children.filter(node => expression.test(node.label));
  return matches?.length === 1 ? matches[0] : null;
}

function textOf(node) {
  return node?.label.startsWith('text ') ? node.label.slice(5) : null;
}

function parseDialog(dialog) {
  const state = emptyState();
  if (dialog.label === 'container CONTROLS, ID: dialog') {
    const back = one(dialog, /^button Back, ID: primary$/);
    if (!back || !one(dialog, /^heading CONTROLS,.*ID: dialog-title$/)) return state;
    state.screen = 'controls';
    state.buttons.back = back.id;
    return state;
  }
  if (dialog.label !== 'container PAUSED, ID: dialog') return state;
  const resume = one(dialog, /^button Resume, ID: primary$/);
  const retry = one(dialog, /^button Retry flag, ID: retry$/);
  const floorLabel = textOf(one(dialog, /^text (?:HARD|NIGHTMARE) · /));
  const score = textOf(one(dialog, /^text \d+:\d\d(?:\.\d+)? \/ \d+ deaths?(?: \/ Best \d+:[0-5]\d(?:\.\d+)?)?$/));
  if (!one(dialog, /^heading PAUSED,.*ID: dialog-title$/) || !resume || !floorLabel || !score) return state;
  const [mode, name] = floorLabel.split(' · ');
  const floor = floors.findIndex(value => value.toUpperCase() === name) + 1;
  const [time, deaths] = score.split(' / ');
  if (!floor || !duration.test(time)) return state;
  Object.assign(state, { screen: 'paused', floor, mode: mode.toLowerCase(), time, deaths: Number.parseInt(deaths, 10) });
  state.buttons.resume = resume.id;
  state.buttons.retry = retry?.id ?? null;
  return state;
}

export function parseGameState(ax) {
  const state = emptyState();
  const root = readRoot(ax);
  if (!root || root.children.length !== 1) return state;
  const content = root.children[0];
  if (content.label.endsWith(', ID: dialog')) return parseDialog(content);
  if (content.label !== 'container Description: Rooftop Reset game, ID: arcade' ||
      !one(content, /^image Description: Playable tower\..*, ID: game$/)) return state;
  const hud = one(content, /^container hud$/);
  const counter = textOf(one(hud, /^text 0[1-6] \/ 06$/));
  const floor = counter && Number(counter.slice(0, 2));
  const mode = textOf(one(hud, /^text (?:HARD|NIGHTMARE)$/))?.toLowerCase();
  const deaths = textOf(one(one(hud, /^container Deaths$/), /^text \d+$/));
  const time = textOf(one(one(hud, /^container Run time$/), /^text \d+:[0-5]\d(?:\.\d+)?$/));
  if (!floor || !one(hud, new RegExp('^text ' + floors[floor - 1] + '$')) ||
      !mode || deaths === null || !time || !one(hud, /^button .*ID: pause$/)) return state;

  const entry = one(content, /^container Description: Choose a climb, ID: entry$/);
  if (entry) {
    const choices = one(entry, /^container Description: Start a climb, ID: start-choices$/);
    const hard = one(choices, /^button Hard Floor checkpoints$/);
    if (!hard || !one(choices, /^button Nightmare No checkpoints$/)) return state;
    state.screen = 'entry';
    state.buttons.hard = hard.id;
  } else {
    if (content.children.some(node => node.label.endsWith(', ID: entry') || node.label.endsWith(', ID: dialog'))) return state;
    state.screen = 'playing';
    if (floor === 6) {
      const reset = one(content, /^button Description: Press the rooftop reset button and open ChatGPT, ID: roof-action$/);
      state.resetReady = Boolean(reset);
      state.buttons.reset = reset?.id ?? null;
    }
  }
  return Object.assign(state, { floor, mode, deaths: Number(deaths), time });
}
