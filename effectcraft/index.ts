import { definePlugin } from '@perkos/plugin-api'

const executable = 'effectcraft-cli'
const automationRoots = [
  '--automation-read-root', '{{projectRoot}}',
  '--automation-write-root', '{{projectRoot}}',
] as const

export default definePlugin({
  id: 'effectcraft',
  version: '0.1.0',
  runtimeApi: '>=1.0.0 <2.0.0',
  detect: {
    probe: { executable, args: ['--version'] },
    versionPattern: '^effectcraft-cli ([0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)\\s*$',
    installInstructions: 'Install the EffectCraft CLI from https://github.com/storytold/effectcraft/releases and add effectcraft-cli to PATH.',
  },
  license: { policy: 'installed-by-person', name: 'MIT OR Apache-2.0' },
  capabilities: ['video.edit', 'video.render'],
  use: [
    {
      kind: 'mcp',
      id: 'effectcraft',
      command: { executable, args: ['mcp', ...automationRoots] },
      seats: ['claude-code', 'codex'],
    },
    {
      kind: 'shell',
      id: 'render',
      command: {
        executable,
        args: [
          'render', '--project', '{{projectFile}}', '--comp', 'Main',
          '--out', '{{projectRoot}}/main.mp4', ...automationRoots,
        ],
      },
    },
  ],
  settings: { env: {} },
})
