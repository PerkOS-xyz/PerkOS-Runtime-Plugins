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

export const PREREQUISITE_RUNTIME_API = '2.0.0'

export type ToolPlatform = 'darwin' | 'linux' | 'win32'

export interface RequiredTool {
  kind: 'executable'
  id: string
  label: string
  versions: { minimum: string; before: string }
  detect: {
    executable: string
    versionFlag: '--version' | '-version' | '-V'
    stdoutPrefix?: string
  }
  installInstructions: Readonly<Partial<Record<ToolPlatform, string>>>
}

export type ToolVersionOutcome =
  | { status: 'ready' | 'incompatible'; detectedVersion: string }
  | { status: 'unavailable'; reason: string }

export type PrerequisiteReadiness = {
  requirementId: string
  executionNodeId: string
} & (ToolVersionOutcome | { status: 'missing' } | { status: 'unsupported'; reason: string })

interface PluginBase {
  id: string
  version: string
  license: License
  capabilities: readonly string[]
  use: readonly PluginUse[]
  settings: { env: Readonly<Record<string, string>> }
}

export type Plugin = PluginBase & (
  | { manifestVersion?: never; runtimeApi: string; detect: Detection; prerequisites?: never }
  | {
      manifestVersion: '0.2'
      runtimeApi: typeof PREREQUISITE_RUNTIME_API
      detect?: never
      prerequisites: readonly RequiredTool[]
    }
)

const integer = '(?:0|[1-9][0-9]*)'
const identifier = '[0-9A-Za-z-]+'
const prerelease = '(?:' + integer + '|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
const version = [integer, integer, integer].join('\\.') +
  '(?:-' + prerelease + '(?:\\.' + prerelease + ')*)?' +
  '(?:\\+' + identifier + '(?:\\.' + identifier + ')*)?'
const exactVersion = new RegExp('^' + version + '$')
const comparator = new RegExp('^(?:<=|>=|<|>|=|\\^|~)?' + version + '$')
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const stableVersion = new RegExp('^' + [integer, integer, integer].join('\\.') + '$')

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

function boundedString(value: unknown, path: string, maximum: number): string {
  const entry = string(value, path)
  if (entry.length > maximum) invalid(path, 'at most ' + maximum + ' characters')
  return entry
}

function fields(entry: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  for (const key of Object.keys(entry)) {
    if (!allowed.includes(key)) invalid(path + '.' + key, 'a supported field')
  }
}

function compareStableVersions(left: string, right: string): number {
  const parts = left.split('.')
  const other = right.split('.')
  for (const [index, part] of parts.entries()) {
    const target = other[index]
    if (part !== target) return part.length - target.length || (part < target ? -1 : 1)
  }
  return 0
}

/** Classify a version token obtained by a host from a successful version probe. */
export function classifyToolVersion(tool: RequiredTool, detectedVersion: string): ToolVersionOutcome {
  if (detectedVersion.length > 128 || detectedVersion.trim() !== detectedVersion || !exactVersion.test(detectedVersion)) {
    return { status: 'unavailable', reason: 'The probe did not report a supported SemVer version.' }
  }
  const core = detectedVersion.split('+')[0]
  const compatible = stableVersion.test(core) &&
    compareStableVersions(core, tool.versions.minimum) >= 0 &&
    compareStableVersions(core, tool.versions.before) < 0
  return { status: compatible ? 'ready' : 'incompatible', detectedVersion }
}

function prerequisites(value: unknown): void {
  if (Array.isArray(value) && value.length > 16) invalid('prerequisites', 'at most 16 required tools')
  const ids = new Set<string>()
  list(value, 'prerequisites', (item, path) => {
    const entry = object(item, path)
    if (entry.kind !== 'executable') invalid(path + '.kind', '"executable" (unsupported prerequisite kind)')
    fields(entry, path, ['kind', 'id', 'label', 'versions', 'detect', 'installInstructions'])
    const id = boundedString(entry.id, path + '.id', 64)
    match(id, path + '.id', slug, 'a lowercase kebab-case identifier')
    if (ids.has(id)) invalid(path + '.id', 'a unique prerequisite ID')
    ids.add(id)
    boundedString(entry.label, path + '.label', 128)

    const versions = object(entry.versions, path + '.versions')
    fields(versions, path + '.versions', ['minimum', 'before'])
    const minimum = boundedString(versions.minimum, path + '.versions.minimum', 64)
    const before = boundedString(versions.before, path + '.versions.before', 64)
    match(minimum, path + '.versions.minimum', stableVersion, 'a stable major.minor.patch version')
    match(before, path + '.versions.before', stableVersion, 'a stable major.minor.patch version')
    if (compareStableVersions(minimum, before) >= 0) invalid(path + '.versions.before', 'a version greater than minimum')

    const detect = object(entry.detect, path + '.detect')
    fields(detect, path + '.detect', ['executable', 'versionFlag', 'stdoutPrefix'])
    const executable = boundedString(detect.executable, path + '.detect.executable', 64)
    match(executable, path + '.detect.executable', /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.exe)?$/, 'a bare executable name')
    if (detect.versionFlag !== '--version' && detect.versionFlag !== '-version' && detect.versionFlag !== '-V') {
      invalid(path + '.detect.versionFlag', '"--version", "-version", or "-V"')
    }
    if (Object.hasOwn(detect, 'stdoutPrefix')) {
      const prefix = boundedString(detect.stdoutPrefix, path + '.detect.stdoutPrefix', 128)
      if (/[^ -~]/.test(prefix)) invalid(path + '.detect.stdoutPrefix', 'a printable literal prefix')
    }

    const guidance = object(entry.installInstructions, path + '.installInstructions')
    fields(guidance, path + '.installInstructions', ['darwin', 'linux', 'win32'])
    const platforms = Object.entries(guidance)
    if (!platforms.length) invalid(path + '.installInstructions', 'guidance for at least one platform')
    for (const [platform, instructions] of platforms) {
      boundedString(instructions, path + '.installInstructions.' + platform, 1024)
    }
  })
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

  if (Object.hasOwn(plugin, 'manifestVersion') || Object.hasOwn(plugin, 'prerequisites')) {
    if (plugin.manifestVersion !== '0.2') invalid('manifestVersion', '"0.2" for prerequisite manifests')
    if (range !== PREREQUISITE_RUNTIME_API) invalid('runtimeApi', 'exactly ' + PREREQUISITE_RUNTIME_API)
    if (Object.hasOwn(plugin, 'detect')) invalid('detect', 'detection declared only per prerequisite in v0.2')
    fields(plugin, 'manifest', [
      'manifestVersion', 'id', 'version', 'runtimeApi', 'license', 'capabilities', 'use', 'settings', 'prerequisites',
    ])
    prerequisites(plugin.prerequisites)
  } else {
    const detect = object(plugin.detect, 'detect')
    command(detect.probe, 'detect.probe')
    versionCapture(detect.versionPattern)
    string(detect.installInstructions, 'detect.installInstructions')
  }

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
