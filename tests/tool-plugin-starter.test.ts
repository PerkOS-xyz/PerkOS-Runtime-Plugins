import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'

const repo = fileURLToPath(new URL('../', import.meta.url))
const starter = join(repo, 'starters/tool-plugin')
const tag = 'example-tool@0.1.0'
const skill = 'skills/SKILL.md'
let workspace: string
let project: string
let manifestPath: string
let archive: string
let manifest: Record<string, unknown>

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'perkos-tool-plugin-'))
  project = join(workspace, 'plugin')
  manifestPath = join(project, 'plugin.json')
  archive = join(project, 'dist/plugin.zip')
  const env = { ...process.env, npm_config_cache: join(workspace, 'npm-cache'), npm_config_offline: 'true' }
  execFileSync('npm', ['run', 'build', '--workspace', '@perkos/plugin-api'], { cwd: repo, env })
  const tarball = execFileSync('npm', ['pack', '--silent', './plugin-api/dist', '--pack-destination', workspace], {
    cwd: repo,
    env,
    encoding: 'utf8',
  }).trim()
  cpSync(starter, project, { recursive: true })
  execFileSync('npm', ['install', '--offline', '--no-save', '--package-lock=false', join(workspace, tarball)], {
    cwd: project,
    env,
  })
  const sentinel = "import { writeFileSync } from 'node:fs'; writeFileSync('executed', 'yes'); throw Error('executed')"
  writeFileSync(join(project, 'index.mjs'), sentinel)
  writeFileSync(join(project, 'index.ts'), sentinel)
  mkdirSync(join(project, 'skills'))
  writeFileSync(join(project, skill), '# Example skill\n')
}, 20_000)

afterAll(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(archive, { force: true })
  manifest = JSON.parse(readFileSync(join(starter, 'plugin.json'), 'utf8'))
  writeFileSync(manifestPath, JSON.stringify(manifest))
})

function run(command: 'validate' | 'pack', archiveTag?: string, tz = 'UTC') {
  const args = ['--silent', 'run', command]
  if (archiveTag) args.push('--', archiveTag)
  return spawnSync('npm', args, {
    cwd: project,
    env: { ...process.env, PATH: [project, process.env.PATH].join(delimiter), TZ: tz },
    encoding: 'utf8',
  })
}

it('validates and packs only declared files without loading modules or running commands', () => {
  expect(run('validate')).toMatchObject({ status: 0, stdout: tag + '\n', stderr: '' })
  manifest.use = [{ kind: 'skills', files: [skill] }]
  manifest.prerequisites = [{
    kind: 'executable',
    id: 'probe',
    label: 'Fixture probe',
    versions: { minimum: '1.0.0', before: '2.0.0' },
    detect: { executable: 'probe', versionFlag: '--version' },
    installInstructions: { darwin: 'Install the fixture probe.' },
  }]
  const probe = join(project, 'probe')
  writeFileSync(probe, '#!/bin/sh\ntouch probe-executed\nexit 1\n', { mode: 0o755 })
  writeFileSync(manifestPath, JSON.stringify(manifest))

  expect(run('validate')).toMatchObject({ status: 0, stdout: tag + '\n', stderr: '' })
  expect(existsSync(archive)).toBe(false)
  const first = run('pack')
  expect(first).toMatchObject({ status: 0, stderr: '' })

  const bytes = readFileSync(archive)
  expect(first.stdout.trim()).toBe(createHash('sha256').update(bytes).digest('hex'))
  const unzip = (...args: string[]) => execFileSync('unzip', args, { encoding: 'utf8' })
  expect(unzip('-Z1', archive).trim().split('\n')).toEqual(['plugin.json', skill])
  expect(JSON.parse(unzip('-p', archive, 'plugin.json'))).toEqual(manifest)
  expect(unzip('-p', archive, skill)).toBe('# Example skill\n')

  utimesSync(join(project, skill), new Date('2024-03-01'), new Date('2024-03-01'))
  expect(run('pack', tag, 'Pacific/Honolulu')).toMatchObject({ status: 0, stdout: first.stdout })
  expect(readFileSync(archive)).toEqual(bytes)
  expect(existsSync(join(project, 'executed'))).toBe(false)
  expect(existsSync(join(project, 'probe-executed'))).toBe(false)
})

it.each(['validate', 'pack'] as const)('%s rejects malformed manifests and mismatched versions', (command) => {
  const wrongTag = run(command, 'example-tool@0.1.1')
  expect(wrongTag.status).toBe(1)
  expect(wrongTag.stderr).toContain('package.json must declare version 0.1.1')
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: '0.1.1' }))
  const mismatch = run(command)
  expect(mismatch.status).toBe(1)
  expect(mismatch.stderr).toContain('Plugin id and version must match tag')

  writeFileSync(manifestPath, JSON.stringify({ ...manifest, use: 'bad' }))
  const malformed = run(command)
  expect(malformed.status).toBe(1)
  expect(malformed.stderr).toContain('use')
  writeFileSync(manifestPath, '{')
  expect(run(command).status).toBe(1)
  expect(existsSync(archive)).toBe(false)
})
