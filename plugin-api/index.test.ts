import { describe, expect, it } from 'vitest'
import { definePlugin, validatePlugin } from '@perkos/plugin-api'
import type { Plugin } from '@perkos/plugin-api'

const plugin = {
  id: 'example-editor',
  version: '1.2.3-rc.1+build.7',
  runtimeApi: '>=1.0.0 <2.0.0 || ^3.0.0',
  detect: {
    probe: { executable: 'example-editor', args: ['--version'] },
    versionPattern: 'example-editor (\\S+)',
    installInstructions: 'Install Example Editor from the software catalog.',
  },
  license: { policy: 'installed-by-person', name: 'MIT' },
  capabilities: ['video.edit'],
  use: [
    { kind: 'shell', id: 'edit', command: { executable: 'example-editor', args: ['{{input}}'] } },
    {
      kind: 'mcp',
      id: 'editor',
      command: { executable: 'example-mcp', args: [] },
      seats: ['claude-code', 'codex'],
    },
    { kind: 'skills', files: ['skills/editor/SKILL.md'] },
  ],
  settings: { env: { EXAMPLE_TELEMETRY: 'off', EXAMPLE_TOKEN: '' } },
} as const satisfies Plugin

describe('plugin contract', () => {
  it('accepts a declaration with all three use forms', () => {
    const defined = definePlugin(plugin)
    expect(defined).toBe(plugin)
    expect(validatePlugin(structuredClone(defined))).toEqual(plugin)
  })

  it('rejects invalid declarations passed to definePlugin', () => {
    expect(() => definePlugin({ ...plugin, id: '' })).toThrow('Invalid plugin id:')
  })

  it.each([
    ['manifest', null],
    ['id', { ...plugin, id: 'Example Editor' }],
    ['version', { ...plugin, version: '1.02.3' }],
    ['version', { ...plugin, version: '1.2.3-01' }],
    ['runtimeApi', { ...plugin, runtimeApi: '>=1.0.0 ||' }],
    ['runtimeApi', { ...plugin, runtimeApi: 'latest' }],
    ['detect', { ...plugin, detect: null }],
    ['detect.probe.executable', { ...plugin, detect: { ...plugin.detect, probe: { args: [] } } }],
    ['detect.probe.args[0]', { ...plugin, detect: { ...plugin.detect, probe: { executable: 'tool', args: [7] } } }],
    ['detect.versionPattern', { ...plugin, detect: { ...plugin.detect, versionPattern: '(' } }],
    ['detect.versionPattern', { ...plugin, detect: { ...plugin.detect, versionPattern: 'version' } }],
    ['detect.installInstructions', { ...plugin, detect: { ...plugin.detect, installInstructions: ' ' } }],
    ['license', { ...plugin, license: [] }],
    ['license.policy', { ...plugin, license: { ...plugin.license, policy: 'unknown' } }],
    ['license.name', { ...plugin, license: { ...plugin.license, name: '' } }],
    ['capabilities', { ...plugin, capabilities: [] }],
    ['capabilities[0]', { ...plugin, capabilities: [42] }],
    ['use', { ...plugin, use: [] }],
    ['use[0].kind', { ...plugin, use: [{ kind: 'other' }] }],
    ['use[0].id', { ...plugin, use: [{ ...plugin.use[0], id: '' }] }],
    ['use[0].command', { ...plugin, use: [{ ...plugin.use[0], command: 'tool' }] }],
    ['use[0].command.args', { ...plugin, use: [{ ...plugin.use[1], command: { executable: 'tool' } }] }],
    ['use[0].seats', { ...plugin, use: [{ ...plugin.use[1], seats: [] }] }],
    ['use[0].seats[0]', { ...plugin, use: [{ ...plugin.use[1], seats: ['other'] }] }],
    ['use[0].files', { ...plugin, use: [{ ...plugin.use[2], files: [] }] }],
    ['use[0].files[0]', { ...plugin, use: [{ ...plugin.use[2], files: ['../SKILL.md'] }] }],
    ['use[0].files[0]', { ...plugin, use: [{ ...plugin.use[2], files: ['/SKILL.md'] }] }],
    ['settings', { ...plugin, settings: null }],
    ['settings.env', { ...plugin, settings: { env: [] } }],
    ['settings.env["INVALID-NAME"]', { ...plugin, settings: { env: { 'INVALID-NAME': 'off' } } }],
    ['settings.env["SAFE_MODE"]', { ...plugin, settings: { env: { SAFE_MODE: true } } }],
  ])('rejects invalid %s', (path, declaration) => {
    expect(() => validatePlugin(declaration)).toThrow('Invalid plugin ' + path + ':')
  })
})
