# OpenScreen plugin

This plugin requires a person-installed copy of [OpenScreen v2.2.2](https://github.com/getopenscreen/openscreen/releases/tag/v2.2.2), licensed under [MIT](https://github.com/getopenscreen/openscreen/blob/v2.2.2/LICENSE). Pin that release because the CLI and project format can change. The commands were checked against the [v2.2.2 CLI documentation](https://github.com/getopenscreen/openscreen/blob/v2.2.2/website/docs/cli.md) and the version probe is tested with packaged metadata fixtures.

- **macOS 13 or later**. Place the app in `/Applications`. The Runtime uses `/Applications/Openscreen.app/Contents/MacOS/Openscreen` when executable, otherwise it searches `PATH`. The person grants Screen Recording for CLI capture and Accessibility for click telemetry.
- **Linux**. Install a native package with `openscreen` on the Runtime's `PATH`. In v2.2.2 the documented native CLI capture path uses PipeWire and the desktop ScreenCast portal. On X11, capture behavior depends on the build and desktop. When the portal opens, the person must select the intended window in its picker.

The version probe reads metadata beside the resolved executable without starting the app. Use a packaged installation with accessible `app.asar` metadata.

| Entry | What it does |
| --- | --- |
| `sources` | List available sources as NDJSON. |
| `record-window` | Record the first matching window title for the requested duration in seconds and write a `.openscreen` project. |
| `zoom-on-clicks` | Export a project to MP4 with automatic zooms from captured click telemetry. |
| `export` | Export a project to MP4 using its existing edits. |
| `openscreen` | Register the upstream stdio MCP server for Claude Code and Codex seats. |

The recording command leaves microphone and system audio off and sets the cursor to editable overlay. Both export commands set MP4, `good` quality (1080p), and 30 fps. The CLI commands use NDJSON output. No environment overrides are required. The upstream MCP server has its own tool arguments and permissions.
