---
name: tibo-rooftop
description: Play Tibo Arcade’s Rooftop Reset on poteto.com. Use when asked to climb the tower, beat the Hard game, recover a run, or get the rooftop reset button ready in the browser.
---

# Tibo Rooftop Reset

Use the [gameplay tool](scripts/rooftop.mjs) in the computer-use JavaScript REPL. It controls the live game with held keys, reads the floor and death counter, and replays missed jumps from Hard mode’s floor checkpoints. It needs a tab that supports numeric accessibility snapshots and native key holds, as the Codex in-app browser does.

## Attach

Use the browser requested by the user. Select the existing game tab when present. Otherwise open a visible tab at `https://www.poteto.com/`. Make the initial CUA call by itself and check the returned page. For a new in-app tab:

```js
let game = await cua.createBrowserTab('iab', 'https://www.poteto.com/', { visible: true })
```

Import the module by its **absolute path in this skill’s directory**, replacing `<skill-dir>` below. Run this in the CUA REPL, outside the webpage. Keep the returned player for the entire run.

```js
const { rooftopPlayer } = await import('<skill-dir>/scripts/rooftop.mjs')
const tibo = rooftopPlayer(game)
nodeRepl.write(await tibo.status())
```

## Play

For an interactive climb, run the following call once per floor. Give each call a 60-second tool timeout. The player starts Hard at the title screen, resumes a paused Hard climb, and detects the next checkpoint. Attaching halfway through an existing floor uses one in-game retry to establish a known starting position. If the reset is already available, it keeps it ready.

```js
nodeRepl.write(await tibo.climbFloor())
```

- `checkpoint` means the HUD now shows the **next** floor. Continue, including after reaching 6/6.
- `reset-ready` means the game exposes the **Press reset** action on the roof. The tool keeps the tab open. If the user wants the button for themselves, stop here and tell them to click it or press **E** in the game.
- `retry-limit` means the current floor is still saved. Inspect a screenshot to locate Tibo and the moving hazard. On a recoverable timing miss, run that floor again with the same player. If repeated attempts fail at the same place, adapt the specific jump using [the recorded route](scripts/route.mjs). Arrow + Space jumps, arrow + X dashes near the apex, a short opposite-arrow tap brakes, and Down + Right crawls under the Machine Hall press.
- `inspect-game` means the current screen, mode, or floor transition needs inspection. Respect an existing Nightmare run. Do not replace it with a fresh Hard run without direction.

For a single call, `await tibo.win()` runs all remaining floors and returns the same status. Allow a longer timeout or use the per-floor form for progress updates. Both forms try each floor at most five times per call. `maxAttempts` accepts 1–12. If a call times out, inspect the live tab before issuing more inputs.

## Finish

Getting the button ready and activating it have different effects. The game’s final button **leaves Poteto and opens ChatGPT**. If the user wants the reset available, leave it unpressed. If they also want the button pressed and ChatGPT opened, use `await tibo.pressReset()` once when ready, or `await tibo.win({ finish: 'press-reset' })` for that explicitly requested end-to-end action. Use the browser’s normal review flow. If it denies the action, stop there. Do not retry via a key or inspect the destination.

Save a game screenshot while the button is visible if reporting a finish. Report the observed HUD time/deaths and distinguish a ready button from an activated reset. A floor count of 6/6 alone is only the rooftop checkpoint.
