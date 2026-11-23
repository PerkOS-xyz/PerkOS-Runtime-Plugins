# Impeccable

Version 0.1.0 gives reviewer and designer seats a critique and polish-review skill and exposes Impeccable's deterministic detector as `impeccable-detect`. The detector requires no model and accepts a file, directory, or rendered URL. URL scans require a supported local browser. Exit code 2 means findings were reported. Exit code 1 means the scan failed. [Detector documentation](https://impeccable.style/docs/detector)

## Install the engine

Choose a native engine asset from `engine-v0.1.28` or later for your OS and CPU. Place it on the Runtime's PATH as `impeccable-engine` (`impeccable-engine.exe` on Windows) and make it executable on Unix. Run `impeccable-engine engine-probe` to check the installation. The plugin probes and scans with this binary directly. [Engine releases](https://github.com/pbakaus/impeccable/releases)

## Capabilities and settings

- `design.polish-review` and `design.critique` use the plugin's review skill.
- `design.slop-check` runs the detector and returns JSON findings.
- `DO_NOT_TRACK=1` forces telemetry off, equivalent to setting `"telemetry": false` in Impeccable's project config.
- `IMPECCABLE_LIVE_COPY_AGENT=off` disables Live mode's copy Apply action. [Upstream settings](https://github.com/pbakaus/impeccable#readme)

Impeccable is Apache-2.0. Redistribution of its upstream skills requires retaining the upstream LICENSE and NOTICE. The seat skill in this package is authored for PerkOS. [Upstream license](https://github.com/pbakaus/impeccable/blob/main/LICENSE)
