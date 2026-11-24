import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { validatePlugin } from '@perkos/plugin-api'
import ffmpeg from '../ffmpeg/index.js'
import impeccable from '../impeccable/index.js'
import remotion from '../remotion/index.js'

type Fixture = {
  name: string
  expected: { catalogue: string; runtime: string }
  manifest: unknown
}

const fixtures: { version: string; cases: Fixture[] } = JSON.parse(readFileSync(
  new URL('./fixtures/manifest-conformance.json', import.meta.url), 'utf8',
))
const runtimeRevision = '735ab6eef90bce46661b04b2d69cb2e0d1a82289'

function check(validate: () => unknown, manifest: unknown, expected: string) {
  if (expected === 'accept') {
    expect(validate()).toEqual(manifest)
  } else {
    expect(validate).toThrow(TypeError)
    expect(validate).toThrow(expect.objectContaining({
      message: expect.stringContaining(`Invalid plugin ${expected}:`),
    }))
  }
}

test('fixture set declares its wire version and names each expected divergence', () => {
  expect(fixtures.version).toBe('0.1')
  expect(new Set(fixtures.cases.map(({ name }) => name)).size).toBe(fixtures.cases.length)
  for (const { name, expected } of fixtures.cases) {
    expect(expected.catalogue !== expected.runtime).toBe(name.startsWith('drift-'))
  }
})

test.each(fixtures.cases)('catalogue: $name', ({ manifest, expected }) => {
  const serialized = JSON.stringify(manifest)
  check(() => validatePlugin(JSON.parse(serialized)), manifest, expected.catalogue)
})

const catalogue = [ffmpeg, impeccable, remotion]
test.each(catalogue)('catalogue: serialized $id $version manifest', manifest => {
  expect(validatePlugin(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest)
})

if (process.env.PERKOS_COMPARE_RUNTIME === '1') {
  describe('pinned Runtime manifest comparison', () => {
    let parsePluginManifest: (json: string) => unknown

    beforeAll(async () => {
      const checkout = process.env.PERKOS_RUNTIME_CHECKOUT
      const modulePath = 'src/shared/plugin-api.ts'
      if (!checkout) {
        throw new Error(`Set PERKOS_RUNTIME_CHECKOUT to a Runtime checkout at ${runtimeRevision}.`)
      }
      const git = (...args: string[]) => execFileSync('git', ['-C', checkout, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let root: string
      let head: string
      try {
        root = git('rev-parse', '--show-toplevel').trim()
        head = git('rev-parse', 'HEAD').trim()
      } catch (error) {
        throw new Error(`PERKOS_RUNTIME_CHECKOUT must point to a Runtime Git checkout: ${checkout}`, { cause: error })
      }
      if (realpathSync(root) !== realpathSync(checkout) || head !== runtimeRevision) {
        throw new Error(`PERKOS_RUNTIME_CHECKOUT must point to the root of Runtime at ${runtimeRevision}; found ${head}.`)
      }
      const entry = join(root, modulePath)
      if (readFileSync(entry, 'utf8') !== git('show', `${runtimeRevision}:${modulePath}`)) {
        throw new Error(`Restore ${modulePath} to the pinned contents before comparing Runtime.`)
      }
      const runtime = await import(/* @vite-ignore */ pathToFileURL(entry).href)
      if (typeof runtime.parsePluginManifest !== 'function') {
        throw new Error(`Pinned Runtime module does not export parsePluginManifest: ${entry}`)
      }
      parsePluginManifest = runtime.parsePluginManifest
    })

    test.each(fixtures.cases)('Runtime: $name', ({ manifest, expected }) => {
      check(() => parsePluginManifest(JSON.stringify(manifest)), manifest, expected.runtime)
    })

    test.each(catalogue)('Runtime: serialized $id $version manifest', manifest => {
      expect(parsePluginManifest(JSON.stringify(manifest))).toEqual(manifest)
    })
  })
}
