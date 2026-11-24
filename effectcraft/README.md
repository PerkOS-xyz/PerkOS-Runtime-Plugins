# EffectCraft

EffectCraft is an alpha Rust application for motion graphics and compositing,
dual-licensed under MIT or Apache-2.0. This plugin uses a separate local
installation. EffectCraft has no telemetry and accesses the network only when
explicitly requested. [Upstream README](https://github.com/storytold/effectcraft#readme)

Install the CLI for your platform from the [EffectCraft releases](https://github.com/storytold/effectcraft/releases),
add the directory containing `effectcraft-cli` to your Runtime's `PATH`, and
check it with `effectcraft-cli --version`. On macOS, use the separate CLI
archive. From source, build with `cargo build --release -p effectcraft-cli`
and put the resulting binary on `PATH`.

- **`video.edit`** uses the headless stdio MCP server in Claude Code and Codex
  to import footage, trim layers, animate zooms, and add captions and title cards.
- **`video.render`** opens a saved `.ecproj` and renders its `Main` composition
  to `main.mp4` in the project folder.

Both entries pass `--automation-read-root` and `--automation-write-root`
with the same absolute project folder (`projectRoot`). Runtime must resolve
that folder before registering MCP. For shell rendering, supply an absolute
`projectFile` inside the folder and keep referenced footage inside it.
Upstream enforces these flags in MCP mode. Standalone rendering relies on
Runtime to control the project and its paths.
[Upstream MCP docs](https://github.com/storytold/effectcraft/blob/main/docs/mcp.md)
