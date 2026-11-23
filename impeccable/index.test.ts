import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { validatePlugin } from '@perkos/plugin-api'
import { expect, test } from 'vitest'
import plugin from './index.js'

test('declares the Impeccable integration and forced settings', () => {
  expect(validatePlugin(plugin)).toBe(plugin)
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  expect(plugin.version).toBe(pkg.version)
  expect(plugin.capabilities).toEqual(['design.polish-review', 'design.slop-check', 'design.critique'])
  expect(plugin.settings.env).toEqual({
    DO_NOT_TRACK: '1',
    IMPECCABLE_LIVE_COPY_AGENT: 'off',
  })

  const [skills, detector] = plugin.use
  for (const file of skills.files) {
    expect(readFileSync(new URL(file, import.meta.url), 'utf8')).toContain(detector.id)
  }
  expect(detector.command).toEqual({
    executable: plugin.detect.probe.executable,
    args: ['detect', '--json', '{{target}}'],
  })
})

test('the local probe reports a missing engine with manual install instructions', () => {
  const { probe, installInstructions } = plugin.detect
  const result = spawnSync(probe.executable, probe.args, {
    env: { ...plugin.settings.env, PATH: '' },
    encoding: 'utf8',
  })

  expect(result.error).toHaveProperty('code', 'ENOENT')
  expect(installInstructions).toContain('https://github.com/pbakaus/impeccable/releases')
  expect(installInstructions).toContain(probe.executable)
})

test('captures the installed version from probe output', () => {
  const pattern = new RegExp(plugin.detect.versionPattern)
  expect(pattern.exec('impeccable-engine 0.1.28\n')?.[1]).toBe('0.1.28')
  expect(pattern.exec('impeccable-engine 0.1.28-rc.1+build\r\n')?.[1]).toBe('0.1.28-rc.1+build')
  expect(pattern.exec('error: engine unavailable\n')).toBeNull()
})
