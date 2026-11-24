import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validatePlugin } from '@perkos/plugin-api'

function directory(path: string): void {
  if (!lstatSync(path).isDirectory()) throw new Error('Expected a real directory: ' + path)
}

function assetPath(root: string, name: string): string {
  const parts = name.split('/')
  for (const part of parts) {
    if (!/^[a-z0-9_.-]+$/i.test(part) || part.endsWith('.') ||
        /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)) {
      throw new Error('Invalid archive path: ' + name)
    }
  }

  let path = root
  for (const part of parts.slice(0, -1)) {
    path = join(path, part)
    directory(path)
  }
  path = join(path, parts[parts.length - 1])
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('Expected a regular file without links: ' + path)
  return path
}

function checkPackageVersion(root: string, version: string): void {
  const pkg = JSON.parse(readFileSync(assetPath(root, 'package.json'), 'utf8'))
  if (pkg.version !== version) {
    throw new Error(join(root, 'package.json') + ' must declare version ' + version)
  }
}

function collectFiles(folder: string, definition: unknown, id: string, version: string): Map<string, Buffer> {
  const manifest = JSON.stringify(validatePlugin(definition), null, 2) + '\n'
  const plugin = validatePlugin(JSON.parse(manifest))
  if (plugin.id !== id || plugin.version !== version) {
    throw new Error('Plugin id and version must match tag ' + id + '@' + version)
  }

  const files = new Map([['plugin.json', Buffer.from(manifest)]])
  const archiveNames = new Set(files.keys())
  const skills = new Set(plugin.use.flatMap(use => use.kind === 'skills' ? use.files : []))
  for (const name of skills) {
    const folded = name.toLowerCase()
    if (archiveNames.has(folded)) throw new Error('Duplicate archive path: ' + name)
    files.set(name, readFileSync(assetPath(folder, name)))
    archiveNames.add(folded)
  }
  return files
}

function writeArchive(files: Map<string, Buffer>, output: string): string {
  mkdirSync(output, { recursive: true })
  directory(output)
  const staging = mkdtempSync(join(output, '.pack-'))
  try {
    const payload = join(staging, 'payload')
    const paths = [...files.keys()].sort()
    const timestamp = new Date('2000-01-01T00:00:00Z')
    for (const name of paths) {
      const destination = join(payload, name)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, files.get(name)!)
      chmodSync(destination, 0o644)
      utimesSync(destination, timestamp, timestamp)
    }
    execFileSync('zip', ['-q', '-X', '-0', '-nw', '../plugin.zip', ...paths.map(name => './' + name)], {
      cwd: payload,
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C', ZIPOPT: '', COPYFILE_DISABLE: '1' },
    })
    const archive = readFileSync(join(staging, 'plugin.zip'))
    const digest = createHash('sha256').update(archive).digest('hex')
    renameSync(join(staging, 'plugin.zip'), join(output, 'plugin.zip'))
    return digest
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

export function processPluginProject(root: string, tag: string, mode: 'validate' | 'pack'): string {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)@([^@]+)$/.exec(tag)
  if (!match) throw new Error('Expected a plugin tag in the form <id>@<version>')
  const [, id, version] = match
  const folder = resolve(root)
  directory(folder)
  checkPackageVersion(folder, version)
  const definition: unknown = JSON.parse(readFileSync(assetPath(folder, 'plugin.json'), 'utf8'))
  const files = collectFiles(folder, definition, id, version)
  return mode === 'pack' ? writeArchive(files, join(folder, 'dist')) : tag
}

async function packCatalogue(): Promise<void> {
  const [folder, version, ...extra] = process.argv.slice(2)
  if (!folder || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder) || !version || extra.length) {
    throw new Error('Usage: npm run pack:plugin -- <plugin-folder> <version>')
  }

  const root = JSON.parse(readFileSync('package.json', 'utf8'))
  if (folder === 'plugin-api' || !root.workspaces.includes(folder)) {
    throw new Error(folder + ' is not a registered plugin')
  }

  directory(folder)
  checkPackageVersion(folder, version)
  const entry = assetPath(folder, 'index.ts')
  const { default: definition } = await import(pathToFileURL(resolve(entry)).href)
  const files = collectFiles(folder, definition, folder, version)
  console.log(writeArchive(files, resolve('dist')))
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await packCatalogue()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
