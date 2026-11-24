import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validatePlugin } from '@perkos/plugin-api'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import plugin from './index.js'

describe('OpenScreen detection', () => {
  let root: string
  let bin: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'perkos-openscreen-'))
    bin = join(root, 'bin')
    mkdirSync(bin)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function probe(tool = 'openscreen') {
    const { executable, args } = plugin.detect.probe
    return spawnSync(executable, [...args.slice(0, -1), tool], {
      encoding: 'utf8',
      env: { ...process.env, PATH: bin },
    })
  }

  function writeBundle(executable: string, resources: string) {
    mkdirSync(resources, { recursive: true })
    writeFileSync(executable, '#!/bin/sh\nexit 99\n', { mode: 0o755 })
    const manifest = Buffer.from(JSON.stringify({ name: 'openscreen', version: '2.2.2' }))
    const header = Buffer.from(JSON.stringify({ files: { 'package.json': { size: manifest.length, offset: '0' } } }))
    const padded = Math.ceil(header.length / 4) * 4
    const prefix = Buffer.alloc(16)
    prefix.writeUInt32LE(4, 0)
    prefix.writeUInt32LE(8 + padded, 4)
    prefix.writeUInt32LE(4 + padded, 8)
    prefix.writeUInt32LE(header.length, 12)
    writeFileSync(join(resources, 'app.asar'), Buffer.concat([prefix, header, Buffer.alloc(padded - header.length), manifest]))
  }

  it('reports a missing install and points to the pinned release', () => {
    const result = probe()
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('OpenScreen is missing')
    expect(plugin.detect.installInstructions).toContain('getopenscreen/openscreen/releases/tag/v2.2.2')
  })

  it('reads the version from a PATH installation through a package symlink', () => {
    const executable = join(root, 'opt', 'Openscreen', 'openscreen')
    writeBundle(executable, join(root, 'opt', 'Openscreen', 'resources'))
    symlinkSync(executable, join(bin, 'openscreen'))
    const result = probe()
    expect(result.status).toBe(0)
    expect(new RegExp(plugin.detect.versionPattern).exec(result.stdout)?.[1]).toBe('2.2.2')
  })

  it('reads metadata from a macOS bundle by absolute path', () => {
    const contents = join(root, 'Applications', 'Openscreen.app', 'Contents')
    const executable = join(contents, 'MacOS', 'Openscreen')
    mkdirSync(join(contents, 'MacOS'), { recursive: true })
    writeBundle(executable, join(contents, 'Resources'))
    expect(probe(executable)).toMatchObject({ status: 0, stdout: 'OpenScreen 2.2.2\n' })
  })

  it('rejects an executable without readable OpenScreen metadata', () => {
    writeFileSync(join(bin, 'openscreen'), '#!/bin/sh\nexit 99\n', { mode: 0o755 })
    expect(probe()).toMatchObject({ status: 1, stdout: '' })
  })
})

it('validates the plugin and pins its commands and settings', () => {
  expect(validatePlugin(plugin)).toBe(plugin)
  expect(plugin.version).toBe('0.1.0')
  expect(plugin.license).toEqual({ policy: 'installed-by-person', name: 'MIT' })
  expect(plugin.capabilities).toEqual(['video.record-window', 'video.zoom-on-clicks', 'video.export'])
  expect(plugin.settings).toEqual({ env: {} })
  expect(plugin.use.map(entry => [entry.id, entry.command.args])).toEqual([
    ['sources', ['sources', '--json']],
    ['record-window', ['record', '--window', '{{window}}', '--duration', '{{duration}}',
      '--project', '{{project}}', '--cursor', 'editable-overlay', '--json']],
    ['zoom-on-clicks', ['export', '{{project}}', '-o', '{{output}}',
      '--format', 'mp4', '--quality', 'good', '--fps', '30', '--auto-zoom', '--json']],
    ['export', ['export', '{{project}}', '-o', '{{output}}',
      '--format', 'mp4', '--quality', 'good', '--fps', '30', '--json']],
    ['openscreen', ['mcp']],
  ])
  expect(plugin.use.at(-1)).toMatchObject({ kind: 'mcp', seats: ['claude-code', 'codex'] })
  expect(plugin.use.every(entry => entry.command.executable === plugin.detect.probe.args.at(-1))).toBe(true)
})
