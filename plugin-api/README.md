# PerkOS Runtime plugin API

Import `definePlugin`, `validatePlugin`, and contract types such as `Plugin` from `@perkos/plugin-api`. Workspace imports resolve TypeScript source. The local tarball exports ESM JavaScript and TypeScript declarations.

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

## Adapters and seat availability

v0.1 defines three adapter kinds. `shell` declares a named command and argument array, `mcp` declares a server command and one or both of the `claude-code` and `codex` seat identifiers, and `skills` declares package-relative files. Shell and skills entries carry no seat field. These declarations describe what a plugin offers. Actual per-runtime shell, MCP, and skills availability is pending Runtime TASK-732 and depends on the adapter installed for the specific seat and node. Both pinned validators check declarations, including the two MCP seat identifiers.

## Pack and consume locally

Run from the catalogue root with npm workspace dependencies installed.

```sh
npm run build --workspace @perkos/plugin-api
npm pack ./plugin-api/dist
```

In an independent ESM project, run `npm install /absolute/path/to/perkos-plugin-api-0.1.0.tgz`. Use `module: "NodeNext"` when checking TypeScript. For Node ESM, resolve the fixture through its versioned package export.

```js
import { readFileSync } from 'node:fs'
import { validatePlugin } from '@perkos/plugin-api'

const fixture = import.meta.resolve('@perkos/plugin-api/fixtures/v0.1/manifest-conformance.json')
const { cases } = JSON.parse(readFileSync(new URL(fixture), 'utf8'))
validatePlugin(cases.find(entry => entry.name === 'valid-shell').manifest)
```

The tarball is private and packs the staged SDK from `plugin-api/dist`. The independent consumer check installed the tarball, loaded both JavaScript exports, read the fixture through the package export, and typechecked a `Plugin` import using the packaged declaration.

## Manifest conformance

The fixture export contains complete JSON manifests. Each case has expected outcomes for catalogue `validatePlugin` and Runtime `parsePluginManifest`. An outcome is either `accept` or the rejected field path. The default test run checks the catalogue. To check both validators, run this with a Runtime checkout outside the catalogue tree at the pinned revision and with the parser file matching that commit.

```sh
PERKOS_RUNTIME_CHECKOUT=/absolute/path/to/PerkOS-Runtime \
  npm run test:conformance --workspace @perkos/plugin-api
```

GitHub main revisions at preflight were Plugins `39bfd909fa742c5edf0e06d6bbe9ba6fbd9d035b` and Runtime `db2e1c5272708fa16f49fcbb7354f5632994c359`. The comparison uses the catalogue validator from this worktree and the parser at that exact Runtime revision.

Both validators reject skill-path segments with leading whitespace, trailing whitespace, or a trailing dot. This includes a parent segment followed by whitespace. Internal spaces are allowed. The fixtures agree on every tested case, including valid v0.1 manifests for all three adapters and serialized FFmpeg, Impeccable, and Remotion declarations.

This tightens SDK validation for paths the Runtime already rejects. The v0.1 manifest shape and adapter support are unchanged. The current catalogue declarations pass both validators, and GitHub listed no catalogue release tags or releases at preflight.
