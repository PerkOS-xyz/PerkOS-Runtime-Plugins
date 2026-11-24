import { accessSync, constants, statSync } from 'node:fs'
import { definePlugin } from '@perkos/plugin-api'

const macExecutable = '/Applications/Openscreen.app/Contents/MacOS/Openscreen'

function installedExecutable() {
  if (process.platform === 'darwin') {
    try {
      accessSync(macExecutable, constants.X_OK)
      if (statSync(macExecutable).isFile()) return macExecutable
    } catch {
      // Fall back to PATH when the standard bundle is unavailable.
    }
  }
  return 'openscreen'
}

const executable = installedExecutable()
const versionProbe = String.raw`
const fs = require('node:fs')
const path = require('node:path')
const executable = process.argv[1]
const candidates = path.isAbsolute(executable)
  ? [executable]
  : (process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, executable))

const candidate = candidates.find(file => {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
})

function readVersion(file) {
  const binDir = path.dirname(fs.realpathSync(file))
  const resources = path.join(binDir, path.basename(binDir) === 'MacOS' ? '../Resources' : 'resources')
  const fd = fs.openSync(path.join(resources, 'app.asar'), 'r')
  try {
    // ASAR stores two Chromium Pickles followed by the packed files.
    const read = (position, size) => {
      const bytes = Buffer.alloc(size)
      if (fs.readSync(fd, bytes, 0, size, position) !== size) throw new Error('Truncated ASAR')
      return bytes
    }
    const prefix = read(0, 16)
    const headerSize = prefix.readUInt32LE(4)
    const jsonSize = prefix.readUInt32LE(12)
    if (prefix.readUInt32LE(0) !== 4 || headerSize > 64 * 1024 * 1024 ||
        jsonSize > headerSize - 8) throw new Error('Invalid ASAR header')

    const entry = JSON.parse(read(16, jsonSize)).files['package.json']
    const offset = Number(entry.offset)
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        !Number.isInteger(entry.size) || entry.size < 1 || entry.size > 1024 * 1024) {
      throw new Error('Invalid package.json entry')
    }
    const pkg = JSON.parse(read(8 + headerSize + offset, entry.size))
    if (pkg.name !== 'openscreen' || typeof pkg.version !== 'string' ||
        !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(pkg.version)) {
      throw new Error('Invalid OpenScreen package metadata')
    }
    return pkg.version
  } finally {
    fs.closeSync(fd)
  }
}

try {
  if (!candidate) throw new Error('Missing executable')
  console.log('OpenScreen ' + readVersion(candidate))
} catch {
  console.error('OpenScreen is missing or its installed version could not be read.')
  process.exitCode = 1
}
`

function cli(id: string, args: readonly string[]) {
  return { kind: 'shell' as const, id, command: { executable, args } }
}

const exportArgs = ['export', '{{project}}', '-o', '{{output}}', '--format', 'mp4', '--quality', 'good', '--fps', '30']

export default definePlugin({
  id: 'openscreen',
  version: '0.1.0',
  runtimeApi: '>=0.1.0 <0.2.0',
  detect: {
    probe: { executable: process.execPath, args: ['-e', versionProbe, executable] },
    versionPattern: '^OpenScreen (\\S+)',
    installInstructions: 'Install OpenScreen 2.2.2 from https://github.com/getopenscreen/openscreen/releases/tag/v2.2.2. On macOS place Openscreen.app in /Applications. On Linux install a native package that puts openscreen on PATH.',
  },
  license: { policy: 'installed-by-person', name: 'MIT' },
  capabilities: ['video.record-window', 'video.zoom-on-clicks', 'video.export'],
  use: [
    cli('sources', ['sources', '--json']),
    cli('record-window', ['record', '--window', '{{window}}', '--duration', '{{duration}}',
      '--project', '{{project}}', '--cursor', 'editable-overlay', '--json']),
    cli('zoom-on-clicks', [...exportArgs, '--auto-zoom', '--json']),
    cli('export', [...exportArgs, '--json']),
    { kind: 'mcp', id: 'openscreen', command: { executable, args: ['mcp'] }, seats: ['claude-code', 'codex'] },
  ],
  settings: { env: {} },
})
