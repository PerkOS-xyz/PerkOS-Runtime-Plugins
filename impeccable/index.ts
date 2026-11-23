import { definePlugin } from '@perkos/plugin-api'

// A dedicated name selects the native engine instead of the npm launcher,
// which can download the engine during a probe or scan.
const executable = 'impeccable-engine'

export default definePlugin({
  id: 'impeccable',
  version: '0.1.0',
  runtimeApi: '^0.1.0',
  detect: {
    probe: { executable, args: ['engine-probe'] },
    versionPattern: '^impeccable-engine (\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)\\s*$',
    installInstructions:
      'Install the native engine for your platform from https://github.com/pbakaus/impeccable/releases ' +
      'under the name impeccable-engine (impeccable-engine.exe on Windows) on the Runtime PATH.',
  },
  license: { policy: 'bundled', name: 'Apache-2.0' },
  capabilities: ['design.polish-review', 'design.slop-check', 'design.critique'],
  use: [
    { kind: 'skills', files: ['skills/impeccable-review/SKILL.md'] },
    {
      kind: 'shell',
      id: 'impeccable-detect',
      command: { executable, args: ['detect', '--json', '{{target}}'] },
    },
  ],
  settings: {
    env: {
      DO_NOT_TRACK: '1',
      IMPECCABLE_LIVE_COPY_AGENT: 'off',
    },
  },
})
