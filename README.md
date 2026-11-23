# PerkOS Runtime Plugins

Plugins that give PerkOS Runtime agents new tools: record a window, edit real footage, check a design, render a video. Each plugin lives in its own folder, has its own version and changelog, and is released on its own, so a desk can pin the exact version it was tested with.

## Layout

```
plugin-api/     The contract every plugin follows, and the Runtime versions it works with
ffmpeg/         One folder per plugin, each with package.json, CHANGELOG.md and tests
openscreen/
...
```

## What a plugin declares

- **detect**: whether the tool is installed on this computer and which version, or how the person can install it.
- **license**: bundled with the plugin, installed by the person, or not allowed.
- **capabilities**: what a desk seat gains, for example `video.record-window`, `video.edit`, `design.polish-review`.
- **use**: the commands, MCP server or skill files an agent uses.
- **settings it always sets**: for example telemetry off or a safe mode on.

## Versions and releases

Each plugin follows semantic versioning and is released with a tag named after it, for example `openscreen@1.2.0`. Desks pin plugin versions in their own lock, so a new plugin release never changes a desk until the desk updates its lock.
