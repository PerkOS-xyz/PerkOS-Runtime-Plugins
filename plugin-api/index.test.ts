import { describe, expect, it } from 'vitest'
import { classifyToolVersion, definePlugin, validatePlugin } from '@perkos/plugin-api'
import type { Plugin, PrerequisiteReadiness } from '@perkos/plugin-api'
import manifestFixtures from '@perkos/plugin-api/fixtures/v0.1/manifest-conformance.json' with { type: 'json' }

const prerequisites = manifestFixtures.requiredTools

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

describe('required tool declarations', () => {
  const manifest = validatePlugin(prerequisites.cases[0].manifest)
  if (manifest.manifestVersion !== '0.2') throw new Error('Expected a v0.2 fixture')
  const [tool] = manifest.prerequisites

  it('preserves the typed declaration through definePlugin and serialization', () => {
    const defined = definePlugin({ ...manifest, id: 'consumer-plugin' })
    expect(defined.prerequisites[0].id).toBe('example-tool')
    expect(validatePlugin(JSON.parse(JSON.stringify(defined)))).toEqual(defined)
  })

  const { prerequisites: tools, ...withoutTools } = manifest
  it.each([
    ['prerequisites', withoutTools],
    ['prerequisites', { ...manifest, prerequisites: [] }],
    ['prerequisites', { ...manifest, prerequisites: Array(17).fill(tool) }],
    ['manifestVersion', { ...plugin, prerequisites: tools }],
    ['manifestVersion', { ...manifest, manifestVersion: '0.3' }],
    ['runtimeApi', { ...manifest, runtimeApi: '>=0.1.0 || 2.0.0' }],
    ['detect', { ...manifest, detect: plugin.detect }],
    ['manifest.installer', { ...manifest, installer: plugin.detect.probe }],
    ['prerequisites[1].id', { ...manifest, prerequisites: [tool, tool] }],
  ])('rejects invalid manifest field %s', (path, declaration) => {
    expect(() => validatePlugin(declaration)).toThrow('Invalid plugin ' + path + ':')
  })

  it.each([
    ['kind', { kind: 'service' }],
    ['kind', { kind: 'future-kind' }],
    ['id', { id: 'a'.repeat(65) }],
    ['label', { label: '' }],
    ['versions.minimum', { versions: { ...tool.versions, minimum: 'latest' } }],
    ['versions.before', { versions: { ...tool.versions, before: tool.versions.minimum } }],
    ['detect.executable', { detect: { ...tool.detect, executable: './example-tool' } }],
    ['detect.versionFlag', { detect: { ...tool.detect, versionFlag: 'start' } }],
    ['detect.args', { detect: { ...tool.detect, args: ['--install'] } }],
    ['installInstructions', { installInstructions: {} }],
    ['installInstructions.linux', { installInstructions: { linux: '' } }],
    ['installInstructions.other', { installInstructions: { other: 'Install the tool.' } }],
    ['credentials', { credentials: {} }],
  ])('rejects invalid prerequisite field %s', (path, override) => {
    const declaration = { ...manifest, prerequisites: [{ ...tool, ...override }] }
    expect(() => validatePlugin(declaration)).toThrow('Invalid plugin prerequisites[0].' + path + ':')
  })

  it.each(prerequisites.observedVersions)('classifies $version as $status', ({ version, status }) => {
    const readiness: PrerequisiteReadiness = {
      requirementId: tool.id,
      executionNodeId: 'example-node',
      ...classifyToolVersion(tool, version),
    }
    expect(readiness.status).toBe(status)
    if (status !== 'unavailable') expect(readiness).toHaveProperty('detectedVersion', version)
  })
})
