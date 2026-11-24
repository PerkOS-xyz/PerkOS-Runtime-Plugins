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

## Required tools in v0.2

Use `manifestVersion: '0.2'`, `runtimeApi: '2.0.0'` (also exported as `PREREQUISITE_RUNTIME_API`), and a nonempty `prerequisites` array in place of top-level `detect`. List every executable required for the plugin, including its primary tool. The SDK validates this declaration from plain data. A release must ship the declaration as JSON, and parsing or packing must run without evaluating plugin modules, probing tools, installing software, or starting services.

Each manifest can declare 1–16 required tools. Each `kind: 'executable'` entry has a unique lowercase kebab-case `id` (64 characters), a human-readable `label` (128 characters), and a `versions` interval with an inclusive `minimum` and exclusive `before`. Both bounds are stable SemVer triplets of at most 64 characters. The interval excludes prereleases and ignores build metadata. Keep the ID stable across releases of the plugin.

`detect` names a bare executable and a single literal `versionFlag` (`--version`, `-version`, or `-V`). An optional printable ASCII `stdoutPrefix` specifies literal text to strip from the first stdout line. The host requires that prefix when declared and trims the remainder of the first line to obtain one SemVer token. Authors must choose a version query that is read-only for that executable. The host resolves through its authorized executable lookup, launches directly with the one flag, uses bounded time and output, and runs under existing permissions with a host-controlled probe environment. A version flag alone cannot establish that unknown software is safe to run.

`installInstructions` contains plain text (up to 1,024 characters per entry) keyed by one or more of `darwin`, `linux`, or `win32`. Include the compatible version and where the person can obtain it for each supported platform. An unlisted platform is unsupported for the requirement. Guidance is displayed as text. The prerequisite schema has no installer, script, probe environment, credential, service endpoint, or permission field.

An executable can be installed and compatible while its service is unconfigured or stopped. This revision verifies executable installation and compatibility only. Services and other unknown kinds are unsupported and invalidate the declaration. A host must surface an unsupported kind as a blocking error with the requirement and node when identifiable.

### Runtime integration

Runtime TASK-730 owns parser support, the API gate, consent, node-local checks, and the project/node-scoped notice and Recheck action. Advertise API `2.0.0` support only after those checks and the activation and use gates are in place. Check API support before any plugin effects. The legacy parser rejects v0.2 because it requires top-level `detect`. The exact `runtimeApi` value also excludes older API versions. Legacy v0.1 keeps its current detection shape and version-range semantics.

After consent, check each requirement on the actual execution node. Each host-produced `PrerequisiteReadiness` includes `requirementId` and `executionNodeId`. Use these outcomes:

| Outcome | Meaning |
| --- | --- |
| `missing` | The authorized lookup completed and the executable was absent. |
| `incompatible` | The probe returned a valid version outside the interval or a prerelease. Include the detected version. |
| `unavailable` | The node, lookup, or probe failed, timed out, exceeded limits, or did not yield a valid version. Include a reason. |
| `unsupported` | The host cannot verify this kind or platform. Include a reason. |
| `ready` | The executable was found and its version matched the interval. Include the detected version. |

The SDK's pure `classifyToolVersion` helper compares an extracted token of up to 128 characters. The host owns lookup, process handling, consent and outcome provenance. A notice should name the plugin, requirement, node, expected interval, detected version when available, and applicable guidance.

TASK-731 must require every prerequisite to be ready for the same project, execution node, exact release pin including digest, and configuration before activation and again before calls. Changed nodes, pins, configuration, and failed tool execution invalidate stale readiness. TASK-732 must apply the same gate before binding seat tools. Existing consent, license, and seat permission checks still apply. These Runtime changes are pending.

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

The tarball is private and packs the staged SDK from `plugin-api/dist`. The shared fixture export keeps its v0.1 `version` and `cases` fields. Its `requiredTools` group contains the v0.2 manifest and expected version outcomes.

## Manifest conformance

The shared fixture contains complete JSON manifests. Each case has expected outcomes for catalogue `validatePlugin` and the pinned legacy Runtime `parsePluginManifest`. An outcome is either `accept` or the rejected field path. The v0.2 fixture expects the legacy Runtime to reject it at `detect`. The default test run checks the catalogue. To check both validators, run this with a Runtime checkout outside the catalogue tree at the pinned revision and with the parser file matching that commit.

```sh
PERKOS_RUNTIME_CHECKOUT=/absolute/path/to/PerkOS-Runtime \
  npm run test:conformance --workspace @perkos/plugin-api
```

GitHub main revisions at preflight were Plugins `39bfd909fa742c5edf0e06d6bbe9ba6fbd9d035b` and Runtime `db2e1c5272708fa16f49fcbb7354f5632994c359`. The comparison uses the catalogue validator from this worktree and the parser at that exact Runtime revision.

Both validators reject skill-path segments with leading whitespace, trailing whitespace, or a trailing dot. This includes a parent segment followed by whitespace. Internal spaces are allowed. The fixtures agree on every tested case, including valid v0.1 manifests for all three adapters and serialized FFmpeg, Impeccable, and Remotion declarations.

This tightens SDK validation for paths the Runtime already rejects. The v0.1 manifest shape and adapter support are unchanged. The current catalogue declarations pass both validators, and GitHub listed no catalogue release tags or releases at preflight.
