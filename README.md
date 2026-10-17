# pi-nut

Personal extension and harness layer for vanilla [Pi](https://pi.dev/).

This repository is intentionally an empty starting point. It currently contains
only the package manifest and the resource directories that Pi can load:

- `extensions/` — Pi extensions (`.ts` or `.js`)
- `skills/` — Pi skills (`SKILL.md` folders or top-level `.md` files)
- `prompts/` — Pi prompt templates (`.md` files)

## Local installation

From this repository's parent directory:

```bash
cd "/Users/tingranwang/Documents/Codex/projects/Self Agent"
pi install "$PWD/pi-nut"
```

This registers the local path in Pi's user settings without copying the
repository. Future edits to this checkout are therefore the edits Pi loads.

To install it only for the current project instead:

```bash
cd "/Users/tingranwang/Documents/Codex/projects/Self Agent"
pi install -l "$PWD/pi-nut"
```

## Load and reload

Start or restart `pi` after installing the package. If Pi is already running,
type:

```text
/reload
```

`/reload` reloads extensions, skills, prompts, themes, and context files. Pi
packages run with full system access, so review any future `pi-nut` code before
loading it.

## Model policy

`extensions/model-policy.ts` adds the first harness feature. It watches both
session startup and Pi's `model_select` event and warns when the selected model
is outside this allow-list:

- `ollama/qwen3.5:9b-mlx`
- `openai-codex/gpt-5.6-luna`
- `openai-codex/gpt-5.6-sol`

The fallback is `openai-codex/gpt-5.6-luna`. Warning-only behavior is the
safe default. To opt into automatic fallback for a run:

```bash
pi --model-policy-auto-switch
```

The model references are matched exactly, including the local Ollama model
identifier.
