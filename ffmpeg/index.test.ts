import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validatePlugin } from '@perkos/plugin-api'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import plugin from './index.js'

describe('FFmpeg detection', () => {
  let bin: string

  beforeEach(() => {
    bin = mkdtempSync(join(tmpdir(), 'perkos-ffmpeg-'))
    symlinkSync(process.execPath, join(bin, 'node'))
  })

  afterEach(() => {
    rmSync(bin, { recursive: true, force: true })
  })

  function runProbe() {
    const { executable, args } = plugin.detect.probe
    return spawnSync(executable, args, {
      encoding: 'utf8',
      env: { ...process.env, ...plugin.settings.env, PATH: bin },
    })
  }

  function stub(tool: string, banner: string) {
    writeFileSync(join(bin, tool),
      '#!/bin/sh\n[ "$1" = "-version" ] || exit 2\nprintf "%s\\n" "' + banner + '"\n',
      { mode: 0o755 })
  }

  it('fails and provides install guidance when neither binary is installed', () => {
    const result = runProbe()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('ffmpeg is missing from PATH')
    expect(result.stdout).toBe('')
    expect(plugin.detect.installInstructions).toContain('brew install ffmpeg')
    expect(plugin.detect.installInstructions).toContain('sudo apt install ffmpeg')
  })

  it('fails when ffprobe is missing even if ffmpeg is installed', () => {
    stub('ffmpeg', 'ffmpeg version 8.0')
    const result = runProbe()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('ffprobe is missing from PATH')
    expect(result.stdout).toBe('')
  })

  it('requires a valid ffprobe version and reports both installed versions', () => {
    stub('ffmpeg', 'ffmpeg version 7.1.1-ubuntu Copyright')
    stub('ffprobe', 'unexpected banner')
    expect(runProbe().status).toBe(1)

    stub('ffprobe', 'ffprobe version 7.1.2 Copyright')
    const result = runProbe()
    expect(result.status).toBe(0)
    expect(new RegExp(plugin.detect.versionPattern).exec(result.stdout)?.[1]).toBe('7.1.1-ubuntu')
    expect(result.stdout).toContain('ffprobe version 7.1.2')
  })
})

it('declares every requested capability with a command and forced settings', () => {
  expect(validatePlugin(plugin)).toBe(plugin)
  expect(plugin.version).toBe('0.1.0')
  expect(plugin.license.policy).toBe('installed-by-person')
  expect(plugin.capabilities).toEqual([
    'video.probe', 'video.trim', 'video.scale', 'video.strip-audio',
    'video.concat', 'video.captions', 'video.gif',
  ])
  expect(plugin.use.map(entry => 'video.' + entry.id)).toEqual(plugin.capabilities)
  expect(plugin.settings.env).toEqual({ AV_LOG_FORCE_NOCOLOR: '1' })
  for (const { id, command } of plugin.use) {
    expect(command.executable).toBe(id === 'probe' ? 'ffprobe' : 'ffmpeg')
    if (id !== 'probe') {
      expect(command.args.slice(0, 2)).toEqual(['-nostdin', '-n'])
      expect(command.args.at(-1)).toBe('file:{{output}}')
    }
  }
})
