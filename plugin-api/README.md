# PerkOS Runtime plugin API

Import `definePlugin`, `validatePlugin`, and contract types such as `Plugin` from `@perkos/plugin-api`. The workspace package exports TypeScript source.

```ts
import { definePlugin } from '@perkos/plugin-api'

export default definePlugin({
  id: 'example-editor',
  version: '1.0.0',
  runtimeApi: '>=1.0.0 <2.0.0',
  detect: {
    probe: { executable: 'example-editor', args: ['--version'] },
    versionPattern: 'example-editor ([^ ]+)',
    installInstructions: 'Install Example Editor from your approved software catalog.',
  },
  license: { policy: 'installed-by-person', name: 'MIT' },
  capabilities: ['video.edit'],
  use: [{
    kind: 'shell',
    id: 'edit',
    command: { executable: 'example-editor', args: ['edit', '{{input}}'] },
  }],
  settings: { env: { EXAMPLE_EDITOR_TELEMETRY: 'off' } },
})
```

`definePlugin` checks the declaration and preserves its inferred type. `validatePlugin(value)` accepts unknown data and returns the declaration as a `Plugin` or throws a `TypeError` naming the first invalid field. Validation is structural and performs no installation, command execution, or file operations.

- `version` is the plugin's SemVer version. `runtimeApi` accepts full SemVer versions with optional comparators (`=`, `<`, `<=`, `>`, `>=`, `^`, `~`). Separate comparators with spaces and alternatives with `||`. The Runtime checks its API version against this range before activation.
- `detect.probe` is a read-only version command. The Runtime reads capture group 1 of `versionPattern` from stdout. A missing executable, failed probe, or missing version leads to the human-readable `installInstructions`. Any installation requires the person's consent.
- `license.name` names the tool's license. `bundled` permits distribution with the plugin, `installed-by-person` requires a separately installed copy, and `not-allowed` prohibits activation.
- `use` can include shell commands, MCP servers, and skill files. Shell command arguments may include `{{name}}` placeholders. The Runtime substitutes values inside individual arguments and launches the executable with an argument array. MCP entries specify a command and the seats to register it with (`claude-code` and/or `codex`). Skill paths are relative to the plugin package. The Runtime resolves them within that package before copying them into the seat.
- `settings.env` contains environment overrides the Runtime applies to the tool's processes, including the probe. Use an empty object when no overrides are required.

The Runtime loads each validated declaration through a Cordis plugin. Its Cordis scope owns registrations, managed processes, and copied files. Disposal unregisters commands and MCP servers, stops managed processes, and removes or restores seat files changed by activation. The contract package is dependency-free. Cordis integration and effect cleanup are the Runtime loader's responsibility.
