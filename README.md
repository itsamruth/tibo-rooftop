# Tibo Rooftop Reset

A Codex skill that plays [Rooftop Reset](https://www.poteto.com/) on Hard. It climbs all six floors, retries from checkpoints, and leaves Tibo beside the live **Press reset** button.

## Install

From this repository, run the following in a terminal. The symlink lets Codex pick up edits from this checkout. If you already have a skill named `tibo-rooftop`, keep that copy or move it aside before linking this one.

```sh
skill_dir="${CODEX_HOME:-$HOME/.codex}/skills"
mkdir -p "$skill_dir"
test ! -e "$skill_dir/tibo-rooftop" && ln -s "$PWD" "$skill_dir/tibo-rooftop"
```

In a new Codex chat with the computer-use tool and in-app browser available, ask:

> Use $tibo-rooftop to get the rooftop reset ready for me.

To activate the reset, ask Codex to **press the rooftop reset and open ChatGPT**. This takes the browser out of the game.

## Update the tool

- [SKILL.md](SKILL.md) documents the browser setup and player commands.
- [rooftop.mjs](scripts/rooftop.mjs) runs the climb and recovers from missed jumps.
- [route.mjs](scripts/route.mjs) contains the key timings for each floor.
- [game-state.mjs](scripts/game-state.mjs) reads checkpoints and the reset button from the game's accessibility tree.

The player uses the tab supplied by Codex's computer-use JavaScript REPL. It has no npm dependencies.
