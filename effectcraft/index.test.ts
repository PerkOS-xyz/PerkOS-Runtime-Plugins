import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { validatePlugin } from '@perkos/plugin-api'
import { expect, it } from 'vitest'
import plugin from './index.js'

it('declares a valid installed-by-person plugin with editing and rendering', () => {
  expect(validatePlugin(plugin)).toBe(plugin)
  expect(plugin.version).toBe('0.1.0')
  expect(plugin.license.policy).toBe('installed-by-person')
  expect(plugin.capabilities).toEqual(['video.edit', 'video.render'])
})

it('supplies the project roots for editing and rendering', () => {
  const [mcp, render] = plugin.use
  const roots = [
    '--automation-read-root', '{{projectRoot}}',
    '--automation-write-root', '{{projectRoot}}',
  ]

  expect(mcp).toMatchObject({
    kind: 'mcp',
    seats: ['claude-code', 'codex'],
    command: { executable: 'effectcraft-cli', args: ['mcp', ...roots] },
  })
  expect(render).toMatchObject({
    kind: 'shell',
    command: {
      executable: 'effectcraft-cli',
      args: [
        'render', '--project', '{{projectFile}}', '--comp', 'Main',
        '--out', '{{projectRoot}}/main.mp4', ...roots,
      ],
    },
  })
})

it('provides installation instructions when the probe cannot find the CLI', () => {
  const emptyPath = mkdtempSync(resolve('node_modules', '.effectcraft-test-'))
  try {
    const { probe, installInstructions } = plugin.detect
    const result = spawnSync(probe.executable, probe.args, {
      cwd: emptyPath,
      env: { ...process.env, PATH: emptyPath },
    })
    expect(result.error).toMatchObject({ code: 'ENOENT' })
    expect(installInstructions).toContain('https://github.com/storytold/effectcraft/releases')
    expect(installInstructions).toContain('add effectcraft-cli to PATH')
  } finally {
    rmSync(emptyPath, { recursive: true, force: true })
  }
})

it('captures the installed version from the CLI probe output', () => {
  expect(plugin.detect.probe).toEqual({ executable: 'effectcraft-cli', args: ['--version'] })
  const pattern = new RegExp(plugin.detect.versionPattern)
  expect(pattern.exec('effectcraft-cli 0.24.1\n')?.[1]).toBe('0.24.1')
  expect(pattern.exec('effectcraft-cli 0.25.0-alpha.1+build.2\r\n')?.[1]).toBe('0.25.0-alpha.1+build.2')
  expect(pattern.test('effectcraft-cli version unavailable')).toBe(false)
})
