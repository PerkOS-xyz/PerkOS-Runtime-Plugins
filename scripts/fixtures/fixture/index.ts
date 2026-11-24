export default {
  id: 'fixture',
  version: '1.2.3',
  runtimeApi: '^0.1.0',
  detect: {
    probe: { executable: 'fixture', args: ['--version'] },
    versionPattern: 'fixture (.+)',
    installInstructions: 'Install fixture.',
  },
  license: { policy: 'installed-by-person', name: 'MIT' },
  capabilities: ['test.fixture'],
  use: [{ kind: 'skills', files: ['skills/SKILL.md'] }],
  settings: { env: {} },
}
