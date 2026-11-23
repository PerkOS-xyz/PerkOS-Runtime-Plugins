# Impeccable

Version 0.1.0 exposes the deterministic, model-free detector as `impeccable-detect`. It accepts a file, directory, or rendered URL. URL scans require a supported local browser. [Detector documentation](https://impeccable.style/docs/detector)

## Install the engine and skills

Choose the native binary for your OS and CPU from the engine releases, starting with `engine-v0.1.28`. Place it on the Runtime's PATH as `impeccable-engine` (`impeccable-engine.exe` on Windows) and make it executable on Unix. The local name selects the native binary directly. The plugin uses the native `engine-probe` handshake, which prints `impeccable-engine <version>`, and runs `detect --json <target>` for scans. [Release assets](https://github.com/pbakaus/impeccable/releases/tag/engine-v0.1.28) · [Native command dispatch](https://github.com/pbakaus/impeccable/blob/engine-v0.1.28/crates/cli/src/router.rs)

Enable the plugin for reviewer and designer seats in the Runtime. The skill entry in plugin API 0.1.0 has no seat-role field. Install the upstream Impeccable skill for those seats separately. The included PerkOS review skill directs those seats to use upstream critique and polish guidance when available. [Upstream setup](https://github.com/pbakaus/impeccable#readme)

Impeccable is Apache-2.0 and uses the `installed-by-person` policy. This package includes only the PerkOS-authored integration skill. Keep the upstream LICENSE and NOTICE with any redistributed upstream skill files. [LICENSE](https://github.com/pbakaus/impeccable/blob/engine-v0.1.28/LICENSE) · [NOTICE](https://github.com/pbakaus/impeccable/blob/engine-v0.1.28/NOTICE.md)

## Capabilities and settings

- `design.polish-review` and `design.critique` use the review skill.
- `design.slop-check` runs the detector and returns JSON findings.
- `DO_NOT_TRACK=1` disables Impeccable telemetry for Runtime-launched processes. Upstream checks this override before reading config files. [Telemetry implementation](https://github.com/pbakaus/impeccable/blob/engine-v0.1.28/crates/context/src/telemetry.rs)
- Plugin API 0.1.0 only declares environment overrides. To persist `"telemetry": false` for use outside Runtime, add that key to the project's `.impeccable/config.json`. [Upstream configuration](https://github.com/pbakaus/impeccable#readme)
- `IMPECCABLE_LIVE_COPY_AGENT=off` disables Live mode's copy Apply action. [Upstream Live mode](https://github.com/pbakaus/impeccable#live-mode)
