import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePlugin } from '@perkos/plugin-api'
import { afterEach, beforeEach, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./pack-plugin.ts', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/fixture/', import.meta.url))
const skill = 'fixture/skills/SKILL.md'
let workspace: string

beforeEach(() => {
  mkdirSync('.perkos/proof', { recursive: true })
  workspace = mkdtempSync('.perkos/proof/pack-plugin-')
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ workspaces: ['fixture'] }))
  cpSync(fixture, join(workspace, 'fixture'), { recursive: true })
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function pack(tag = 'fixture@1.2.3', tz = 'UTC') {
  const [folder, version] = tag.split('@')
  return spawnSync(process.execPath, [script, folder, version], {
    cwd: workspace,
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  })
}

it('produces identical bytes and a valid manifest with only declared assets', () => {
  const first = pack()
  expect(first.stderr).toBe('')
  expect(first.status).toBe(0)
  const archive = join(workspace, 'dist/plugin.zip')
  const bytes = readFileSync(archive)
  expect(first.stdout.trim()).toBe(createHash('sha256').update(bytes).digest('hex'))

  chmodSync(join(workspace, skill), 0o755)
  utimesSync(join(workspace, skill), new Date('2022-03-04'), new Date('2022-03-04'))
  const second = pack('fixture@1.2.3', 'Pacific/Honolulu')
  expect(second.status).toBe(0)
  expect(second.stdout).toBe(first.stdout)
  expect(readFileSync(archive)).toEqual(bytes)

  expect(execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n'))
    .toEqual(['plugin.json', 'skills/SKILL.md'])
  const manifest = execFileSync('unzip', ['-p', archive, 'plugin.json'], { encoding: 'utf8' })
  expect(validatePlugin(JSON.parse(manifest))).toMatchObject({ id: 'fixture', version: '1.2.3' })
  const contents = execFileSync('unzip', ['-p', archive, 'skills/SKILL.md'])
  expect(contents).toEqual(readFileSync(join(workspace, skill)))
})

it.each(['symlink', 'directory symlink', 'hard link'])('rejects an asset reached through a %s', (kind) => {
  const folder = join(workspace, 'fixture/skills')
  const outside = join(workspace, 'outside')
  mkdirSync(outside)
  writeFileSync(join(outside, 'SKILL.md'), 'outside')
  rmSync(join(workspace, skill))
  if (kind === 'directory symlink') {
    rmSync(folder, { recursive: true })
    symlinkSync('../outside', folder)
  } else if (kind === 'hard link') {
    linkSync(join(outside, 'SKILL.md'), join(workspace, skill))
  } else {
    symlinkSync('../../outside/SKILL.md', join(workspace, skill))
  }
  const result = pack()
  expect(result.status).toBe(1)
  expect(result.stderr).toMatch(/Expected a real directory|Expected a regular file without links/)
  expect(existsSync(join(workspace, 'dist/plugin.zip'))).toBe(false)
})

it.each(['../outside.md', '/outside.md', 'C:/outside.md', 'skills/../../outside.md'])(
  'rejects the unsafe archive path %s',
  (path) => {
    const entry = join(workspace, 'fixture/index.ts')
    writeFileSync(entry, readFileSync(entry, 'utf8').replace('skills/SKILL.md', path))
    const result = pack()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('a plugin-relative path')
    expect(existsSync(join(workspace, 'dist/plugin.zip'))).toBe(false)
  },
)

it('rejects a tag that does not match the manifest version even if the package matches', () => {
  const tag = 'fixture@1.2.4'
  expect(pack(tag).stderr).toContain('package.json must declare version 1.2.4')
  const pkg = join(workspace, 'fixture/package.json')
  writeFileSync(pkg, readFileSync(pkg, 'utf8').replace('1.2.3', '1.2.4'))
  const result = pack(tag)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Plugin id and version must match tag fixture@1.2.4')
  expect(existsSync(join(workspace, 'dist/plugin.zip'))).toBe(false)
})
