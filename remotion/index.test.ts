import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validatePlugin } from '@perkos/plugin-api'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import plugin from './index.js'
import pkg from './package.json' with { type: 'json' }

describe('Remotion plugin', () => {
  let project: string

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'perkos-remotion-'))
  })

  afterEach(() => {
    rmSync(project, { recursive: true, force: true })
  })

  function probe() {
    const { executable, args } = plugin.detect.probe
    return spawnSync(executable, args, { cwd: project, encoding: 'utf8' })
  }

  it('validates and declares the capability, license and forced render options', () => {
    expect(validatePlugin(plugin)).toBe(plugin)
    expect(plugin.version).toBe(pkg.version)
    expect(plugin.license).toEqual({ policy: 'installed-by-person', name: 'Remotion License' })
    expect(plugin.capabilities).toEqual(['video.render-composition'])
    expect(plugin.use).toEqual([{
      kind: 'shell',
      id: 'render-composition',
      command: {
        executable: 'npx',
        args: ['--no', 'remotion', 'render', '{{entry}}', '{{comp}}', '{{out}}', '--codec', 'h264', '--muted'],
      },
    }])
    expect(plugin.settings.env).toEqual({})
  })

  it('fails the probe when Remotion is missing and provides install instructions', () => {
    const result = probe()
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(plugin.detect.installInstructions).toContain('npx create-video')
  })

  it('captures the installed CLI version from package metadata alone', () => {
    const cli = join(project, 'node_modules', '@remotion', 'cli')
    mkdirSync(cli, { recursive: true })
    writeFileSync(join(cli, 'package.json'), JSON.stringify({
      name: '@remotion/cli',
      version: '4.0.123-rc.1',
      exports: { './package.json': './package.json' },
    }))

    const result = probe()
    expect(result.status).toBe(0)
    expect(new RegExp(plugin.detect.versionPattern).exec(result.stdout)?.[1]).toBe('4.0.123-rc.1')
  })
})
