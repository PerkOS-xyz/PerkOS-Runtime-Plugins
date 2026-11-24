import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { processPluginProject } from '@perkos/plugin-api/pack-plugin'

try {
  const [mode, explicitTag, ...extra] = process.argv.slice(2)
  if ((mode !== 'validate' && mode !== 'pack') || extra.length) {
    throw new Error('Usage: npm run validate|pack -- [<id>@<version>]')
  }
  const root = fileURLToPath(new URL('..', import.meta.url))
  const { name, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  console.log(processPluginProject(root, explicitTag ?? name + '@' + version, mode))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
