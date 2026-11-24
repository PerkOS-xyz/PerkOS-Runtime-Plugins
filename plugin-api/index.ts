export interface Command {
  executable: string
  args: readonly string[]
}

export interface Detection {
  /** Read-only command whose stdout contains the installed version. */
  probe: Command
  /** The first capture group contains the version. */
  versionPattern: string
  installInstructions: string
}

export interface License {
  policy: 'bundled' | 'installed-by-person' | 'not-allowed'
  name: string
}

export type Seat = 'claude-code' | 'codex'

export type PluginUse =
  | { kind: 'shell'; id: string; command: Command }
  | { kind: 'mcp'; id: string; command: Command; seats: readonly Seat[] }
  | { kind: 'skills'; files: readonly string[] }

export interface Plugin {
  id: string
  version: string
  runtimeApi: string
  detect: Detection
  license: License
  capabilities: readonly string[]
  use: readonly PluginUse[]
  settings: { env: Readonly<Record<string, string>> }
}

const integer = '(?:0|[1-9][0-9]*)'
const identifier = '[0-9A-Za-z-]+'
const prerelease = '(?:' + integer + '|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
const version = [integer, integer, integer].join('\\.') +
  '(?:-' + prerelease + '(?:\\.' + prerelease + ')*)?' +
  '(?:\\+' + identifier + '(?:\\.' + identifier + ')*)?'
const exactVersion = new RegExp('^' + version + '$')
const comparator = new RegExp('^(?:<=|>=|<|>|=|\\^|~)?' + version + '$')
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function invalid(path: string, expected: string): never {
  throw new TypeError('Invalid plugin ' + path + ': expected ' + expected)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') invalid(path, 'a plain object')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) invalid(path, 'a plain object')
  return value as Record<string, unknown>
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || value.includes('\0') || (!allowEmpty && !value.trim())) {
    invalid(path, allowEmpty ? 'a string without NUL characters' : 'a non-empty string without NUL characters')
  }
  return value
}

function match(value: unknown, path: string, pattern: RegExp, expected: string): void {
  const entry = string(value, path)
  if (entry.trim() !== entry || !pattern.test(entry)) invalid(path, expected)
}

function list(value: unknown, path: string, check: (item: unknown, path: string) => void, allowEmpty = false): void {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    invalid(path, allowEmpty ? 'an array' : 'a non-empty array')
  }
  for (let index = 0; index < value.length; index++) check(value[index], path + '[' + index + ']')
}

function command(value: unknown, path: string): void {
  const spec = object(value, path)
  string(spec.executable, path + '.executable')
  list(spec.args, path + '.args', (arg, itemPath) => string(arg, itemPath, true), true)
}

function usage(value: unknown, path: string): void {
  const entry = object(value, path)
  switch (entry.kind) {
    case 'shell':
    case 'mcp':
      match(entry.id, path + '.id', slug, 'a lowercase kebab-case identifier')
      command(entry.command, path + '.command')
      if (entry.kind === 'mcp') {
        list(entry.seats, path + '.seats', (seat, itemPath) => {
          if (seat !== 'claude-code' && seat !== 'codex') invalid(itemPath, '"claude-code" or "codex"')
        })
      }
      break
    case 'skills':
      list(entry.files, path + '.files', (file, itemPath) => {
        const name = string(file, itemPath)
        if (/[\\:]/.test(name) || name.split('/').some(part => !part || part.trim() !== part || part.endsWith('.'))) {
          invalid(itemPath, 'a plugin-relative path using forward slashes')
        }
      })
      break
    default:
      invalid(path + '.kind', '"shell", "mcp", or "skills"')
  }
}

function versionCapture(value: unknown): void {
  const path = 'detect.versionPattern'
  const pattern = string(value, path)
  let regex: RegExp
  try {
    new RegExp(pattern)
    // The empty alternative lets us count capture groups without running the probe.
    regex = new RegExp(pattern + '|')
  } catch {
    invalid(path, 'a valid regular expression')
  }
  if (regex.exec('')?.length === 1) invalid(path, 'a regular expression with a version capture group')
}

/** Return the validated declaration or throw a TypeError naming the invalid field. */
export function validatePlugin(value: unknown): Plugin {
  const plugin = object(value, 'manifest')
  match(plugin.id, 'id', slug, 'a lowercase kebab-case identifier')
  match(plugin.version, 'version', exactVersion, 'a semantic version (major.minor.patch)')
  const range = string(plugin.runtimeApi, 'runtimeApi')
  if (!range.split('||').every(group => group.trim().split(/\s+/).every(token => comparator.test(token)))) {
    invalid('runtimeApi', 'a range of full semantic versions with optional comparators')
  }

  const detect = object(plugin.detect, 'detect')
  command(detect.probe, 'detect.probe')
  versionCapture(detect.versionPattern)
  string(detect.installInstructions, 'detect.installInstructions')

  const license = object(plugin.license, 'license')
  if (license.policy !== 'bundled' && license.policy !== 'installed-by-person' && license.policy !== 'not-allowed') {
    invalid('license.policy', '"bundled", "installed-by-person", or "not-allowed"')
  }
  string(license.name, 'license.name')

  list(plugin.capabilities, 'capabilities', (entry, path) => string(entry, path))
  list(plugin.use, 'use', usage)
  const settings = object(plugin.settings, 'settings')
  const env = object(settings.env, 'settings.env')
  for (const [key, entry] of Object.entries(env)) {
    const path = 'settings.env[' + JSON.stringify(key) + ']'
    match(key, path, /^[A-Za-z_][A-Za-z0-9_]*$/, 'a portable environment variable name')
    string(entry, path, true)
  }
  return value as Plugin
}

/** Validate a declaration while preserving its inferred type. */
export function definePlugin<const T extends Plugin>(plugin: T): T {
  validatePlugin(plugin)
  return plugin
}
