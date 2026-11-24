import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { validatePlugin } from '@perkos/plugin-api'
import { expect, test } from 'vitest'
import plugin from './index.js'

test('declares the Impeccable integration and forced settings', () => {
  expect(validatePlugin(plugin)).toBe(plugin)
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  expect(plugin.version).toBe(pkg.version)
  expect(plugin.license).toEqual({ policy: 'installed-by-person', name: 'Apache-2.0' })
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8')
  expect(readme).toContain('Plugin API 0.1.0 only declares environment overrides.')
  expect(readme).toContain('"telemetry": false')
  expect(readme).toContain('reviewer and designer seats')
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

// The API validates declarations. This harness exercises the documented Runtime protocol.
function evaluateDetection(runProbe: (executable: string, args: readonly string[]) => {
  status: number | null
  stdout: string | null
}) {
  const { probe, versionPattern, installInstructions } = plugin.detect
  const result = runProbe(probe.executable, probe.args)
  const version = result.status === 0
    ? new RegExp(versionPattern).exec(result.stdout ?? '')?.[1]
    : undefined
  return version ? { status: 'found', version } : { status: 'missing', installInstructions }
}

test('the declared probe yields missing status and installation guidance without the engine', () => {
  expect(plugin.detect.probe).toEqual({ executable: 'impeccable-engine', args: ['engine-probe'] })
  const detection = evaluateDetection((executable, args) => spawnSync(executable, args, {
    env: { ...plugin.settings.env, PATH: '' },
    encoding: 'utf8',
  }))

  expect(detection).toEqual({
    status: 'missing',
    installInstructions: expect.stringContaining('https://github.com/pbakaus/impeccable/releases'),
  })
  expect(detection.installInstructions).toContain('impeccable-engine')
})

test('captures the installed version from probe output', () => {
  expect(evaluateDetection(() => ({ status: 0, stdout: 'impeccable-engine 0.1.28\n' })))
    .toEqual({ status: 'found', version: '0.1.28' })
  expect(evaluateDetection(() => ({ status: 0, stdout: 'impeccable-engine 0.1.28-rc.1+build\r\n' })))
    .toEqual({ status: 'found', version: '0.1.28-rc.1+build' })
  expect(evaluateDetection(() => ({ status: 0, stdout: 'error: engine unavailable\n' })).status)
    .toBe('missing')
})
