import { parseGameState } from './game-state.mjs';
import { playFloor } from './route.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const playable = state => state.screen === 'playing' && state.mode === 'hard'
  && Number.isInteger(state.floor) && Number.isInteger(state.deaths);

function isGameUrl(value) {
  const url = new URL(value);
  return ['https://www.poteto.com', 'https://poteto.com'].includes(url.origin) && url.pathname === '/';
}

/**
 * Attach to a CUA browser tab. All game observations and inputs go through the
 * supplied tab. Construct once per climb so the next call remembers a landing.
 */
export function rooftopPlayer(tab) {
  let expectedLanding = null;
  let landingDeaths = null;
  let checkpointStart = false;
  let failures = 0;

  async function status() {
    if (!isGameUrl(await tab.url())) {
      throw new Error('Select the Rooftop Reset game tab on www.poteto.com.');
    }
    const ax = await tab.getAXState({ disableDiffing: true, emit: false });
    return parseGameState(ax);
  }

  const key = (name, durationMs) => tab.pressKey(null, name, { durationMs });
  const result = (reason, state) => ({ reason, floor: state.floor,
    deaths: state.deaths, time: state.time, resetReady: state.resetReady });

  async function observeUntil(predicate, timeoutMs) {
    const until = Date.now() + timeoutMs;
    let state;
    do {
      state = await status();
      if (predicate(state) || !playable(state)) break;
      await sleep(70);
    } while (Date.now() < until);
    return state;
  }

  async function openClimb() {
    let state = await status();
    if (state.screen === 'entry' && state.buttons.hard != null) {
      await tab.click(state.buttons.hard);
      state = await status();
      if (playable(state) && state.floor === 1) {
        expectedLanding = state.floor;
        landingDeaths = state.deaths;
        checkpointStart = true;
        failures = 0;
      }
    } else if (state.screen === 'paused' && state.mode === 'hard' && state.buttons.resume != null) {
      await tab.click(state.buttons.resume);
      state = await status();
    }
    return state;
  }

  async function retryFlag(state) {
    await key('r', 30);
    const changed = await observeUntil(s => s.deaths > state.deaths, 1300);
    if (!playable(changed) || changed.deaths <= state.deaths || changed.floor !== state.floor) {
      throw new Error('The game did not confirm a retry at the current flag. Inspect the tab.');
    }
    return changed;
  }

  // The HUD counts a death before the brief RETRY animation finishes. Starting
  // the next run during that animation loses the first part of the run-up.
  async function afterRespawn(state) {
    await key('Down', 670);
    const now = await status();
    if (!playable(now) || now.floor !== state.floor || now.deaths !== state.deaths) {
      throw new Error('The checkpoint changed during respawn. Inspect the game before continuing.');
    }
    expectedLanding = now.floor;
    landingDeaths = now.deaths;
    checkpointStart = true;
    return now;
  }

  async function climbFloor({ maxAttempts = 5 } = {}) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 12) {
      throw new RangeError('maxAttempts must be an integer from 1 to 12.');
    }
    let state = await openClimb();
    if (!playable(state)) return result('inspect-game', state);
    if (state.resetReady) {
      await tab.markDeliverable();
      return result('reset-ready', state);
    }

    // An attached live run may be halfway through a floor. The controls do
    // not expose coordinates. Recover at its saved flag, preserving the climb.
    if (expectedLanding !== state.floor) {
      state = await afterRespawn(await retryFlag(state));
      failures = 0;
    } else if (state.deaths !== landingDeaths) {
      state = await afterRespawn(state);
      failures = 0;
    }

    for (let i = 0; i < maxAttempts; i++) {
      const start = state;
      const interrupt = new Error('Route state changed');
      async function check() {
        state = await status();
        if (!playable(state) || state.deaths !== start.deaths ||
            state.floor !== start.floor || state.resetReady) throw interrupt;
      }
      async function routeKey(name, durationMs) {
        // Jump doubles as the reset action when Tibo is beside the button.
        if (start.floor === 6 && name.split('+').includes('space')) await check();
        await key(name, durationMs);
      }
      try {
        await playFloor(start.floor, { key: routeKey, settle: check, check }, {
          fromCheckpoint: checkpointStart, attempt: failures + 1,
        });
      } catch (error) {
        if (error !== interrupt) throw error;
      }

      state = await observeUntil(s => s.resetReady || s.floor !== start.floor
        || s.deaths !== start.deaths, 900);
      if (!playable(state)) return result('inspect-game', state);
      if (state.resetReady) {
        await tab.markDeliverable();
        return result('reset-ready', state);
      }
      if (state.floor === start.floor + 1) {
        expectedLanding = state.floor;
        landingDeaths = state.deaths;
        checkpointStart = state.deaths !== start.deaths;
        failures = 0;
        return result('checkpoint', state);
      }
      if (state.floor !== start.floor) return result('inspect-game', state);
      // A missed ledge can leave Tibo alive one or more levels below his flag.
      if (state.deaths === start.deaths) state = await retryFlag(state);
      state = await afterRespawn(state);
      failures++;
    }
    return result('retry-limit', state);
  }

  async function win({ finish = 'ready', maxAttempts = 5 } = {}) {
    if (!['ready', 'press-reset'].includes(finish)) {
      throw new RangeError("finish must be 'ready' or 'press-reset'.");
    }
    for (let floor = 0; floor < 6; floor++) {
      const outcome = await climbFloor({ maxAttempts });
      if (outcome.resetReady && finish === 'press-reset') return pressReset();
      if (outcome.reason !== 'checkpoint') return outcome;
    }
    return result('inspect-game', await status());
  }

  // Separate because the game's own final action leaves the game for ChatGPT.
  // Never inspect the destination or retry the click if browser review stops it.
  async function pressReset() {
    const state = await status();
    if (!playable(state) || state.floor !== 6 || !state.resetReady || state.buttons.reset == null) {
      throw new Error('The visible rooftop reset button is not ready.');
    }
    await tab.click(state.buttons.reset);
    return result('reset-clicked', state);
  }

  return { status, climbFloor, win, pressReset };
}
