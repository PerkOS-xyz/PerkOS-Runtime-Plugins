import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { validatePlugin } from '@perkos/plugin-api'
import plugin from './index.js'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(process.cwd(), '.hallmark-test-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function run(args: readonly string[]) {
  return spawnSync(process.execPath, args, {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, HOME: directory, USERPROFILE: directory, ...plugin.settings.env },
  })
}

function fakeInstall(root: string, version: string) {
  const skill = join(directory, root, 'skills', 'hallmark')
  mkdirSync(join(skill, 'scripts'), { recursive: true })
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: hallmark\nversion: ' + version + '\n---\n')
  writeFileSync(join(skill, 'scripts', 'sloplint.mjs'), 'console.log(process.argv[2]); process.exitCode = 7')
}

test('declares the capabilities and integration defaults in a valid plugin', () => {
  const manifest = validatePlugin(plugin)
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  expect(manifest.version).toBe(pkg.version)
  expect(manifest.capabilities).toEqual(['design.page', 'design.slop-check'])
  expect(manifest.settings.env).toEqual({
    PERKOS_HALLMARK_TOGETHER_COMP: 'off',
    PERKOS_HALLMARK_INSPO_MCP: 'off',
    TOGETHER_API_KEY: '',
  })
  const skill = readFileSync(new URL(plugin.use[0].files[0], import.meta.url), 'utf8')
  expect(skill).toContain('DESIGN.md')
  expect(skill).toContain('.hallmark/brand-spec.md')
})

test('reports the installation instructions when Hallmark is missing', () => {
  const result = run(plugin.detect.probe.args)
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr.trim()).toBe(plugin.detect.installInstructions)
  expect(result.stderr).toContain('npx skills add nutlope/hallmark')
})

test('reports the installed tool version from skill metadata', () => {
  fakeInstall('.claude', '2.1.0-beta.1')
  const result = run(plugin.detect.probe.args)
  expect(result.status).toBe(0)
  expect(new RegExp(plugin.detect.versionPattern).exec(result.stdout)?.[1]).toBe('2.1.0-beta.1')
})

test('passes the lint target as one argument and preserves its exit status', () => {
  fakeInstall('.agents', '2.0.0')
  const target = '-page draft.html'
  const result = run(plugin.use[1].command.args.map(arg => arg.replace('{{target}}', target)))
  expect(result.stdout.trim()).toBe(join(directory, target))
  expect(result.status).toBe(7)
})
