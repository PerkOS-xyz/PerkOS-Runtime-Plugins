import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const releaseScript = fileURLToPath(new URL('./release.ts', import.meta.url))
const proofDir = fileURLToPath(new URL('../.perkos/proof/', import.meta.url))
let repo: string

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function commitPlugin(version: string, changelog: string) {
  writeFileSync(join(repo, 'openscreen/package.json'), JSON.stringify({ version }))
  writeFileSync(join(repo, 'openscreen/CHANGELOG.md'), changelog)
  git('add', '.')
  git('-c', 'user.name=Release Test', '-c', 'user.email=test@example.com', '-c',
    'commit.gpgsign=false', 'commit', '--no-verify', '-qm', 'Add release metadata')
}

function release(version: string) {
  return spawnSync(process.execPath, [releaseScript, 'openscreen', version], {
    cwd: repo,
    encoding: 'utf8',
  })
}

describe('per-plugin release', () => {
  beforeEach(() => {
    mkdirSync(proofDir, { recursive: true })
    repo = mkdtempSync(join(proofDir, 'release-test-'))
    git('init', '-q')
    git('config', 'tag.gpgSign', 'false')
    mkdirSync(join(repo, 'openscreen'))
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ workspaces: ['openscreen'] }))
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('refuses a version that differs from the package version', () => {
    commitPlugin('1.2.1', '## 1.2.0\n')
    const result = release('1.2.0')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('package.json must declare version 1.2.0')
    expect(git('tag', '--list')).toBe('')
  })

  it('requires an exact changelog heading in the tagged commit', () => {
    commitPlugin('1.2.0', '## [1.2.01]\nMentions 1.2.0\n')
    writeFileSync(join(repo, 'openscreen/CHANGELOG.md'), '## 1.2.0\n')
    const result = release('1.2.0')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('CHANGELOG.md must have a heading for version 1.2.0')
    expect(git('tag', '--list')).toBe('')
  })

  it('tags the commit when both match and refuses to overwrite that tag', () => {
    commitPlugin('1.2.0', '## [1.2.0] - 2026-11-23\n')
    expect(release('1.2.0').status).toBe(0)
    expect(git('tag', '--list')).toBe('openscreen@1.2.0')
    expect(git('rev-parse', 'openscreen@1.2.0')).toBe(git('rev-parse', 'HEAD'))

    const taggedCommit = git('rev-parse', 'HEAD')
    commitPlugin('1.2.0', '## 1.2.0\nUpdated notes\n')
    expect(release('1.2.0').status).toBe(1)
    expect(git('rev-parse', 'openscreen@1.2.0')).toBe(taggedCommit)
  })
})
