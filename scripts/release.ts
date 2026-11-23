import { execFileSync } from 'node:child_process'
import semver from 'semver'

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

const [folder, version, ...extra] = process.argv.slice(2)

try {
  if (!folder || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder) ||
      !version || semver.valid(version) !== version.split('+')[0] || !/^[0-9]/.test(version) || extra.length) {
    throw new Error('Usage: npm run release -- <plugin-folder> <semver>')
  }

  // Read metadata from the exact commit that the tag will point to.
  const commit = git('rev-parse', 'HEAD')
  const root = JSON.parse(git('show', commit + ':package.json'))
  if (folder === 'plugin-api' || !root.workspaces.includes(folder)) {
    throw new Error(folder + ' is not a registered plugin')
  }

  const plugin = JSON.parse(git('show', commit + ':' + folder + '/package.json'))
  if (plugin.version !== version) {
    throw new Error(folder + '/package.json must declare version ' + version)
  }

  const changelog = git('show', commit + ':' + folder + '/CHANGELOG.md')
  const hasVersion = changelog.split(/\r?\n/).some((line) => {
    const heading = /^##[ \t]+(?:\[([^\]]+)\]|([^\s]+))(?:[ \t]+-[ \t]+\d{4}-\d{2}-\d{2})?[ \t]*$/.exec(line)
    return (heading?.[1] ?? heading?.[2]) === version
  })
  if (!hasVersion) {
    throw new Error(folder + '/CHANGELOG.md must have a heading for version ' + version)
  }

  const tag = folder + '@' + version
  git('tag', '--', tag, commit)
  console.log('Created ' + tag)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
