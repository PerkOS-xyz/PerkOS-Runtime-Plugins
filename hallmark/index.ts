import { definePlugin } from '@perkos/plugin-api'

const installInstructions =
  'Install Node.js 18 or later, then run npx skills add nutlope/hallmark -g for your seat. ' +
  'See https://github.com/Nutlope/hallmark#install.'

// Runtime commands run from the project. Keep the locator in the command itself.
const locate = String.raw`
const { readFileSync, statSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')
function findHallmark() {
  for (const root of [process.cwd(), homedir()]) {
    for (const seat of ['.agents', '.claude']) {
      const dir = join(root, seat, 'skills', 'hallmark')
      try {
        const skill = readFileSync(join(dir, 'SKILL.md'), 'utf8')
        const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill)?.[1] ?? ''
        const version = /^version:[ \t]*["']?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)["']?[ \t]*\r?$/m.exec(header)?.[1]
        if (!version || !/^name:[ \t]+hallmark[ \t]*\r?$/m.test(header)) continue
        const lint = join(dir, 'scripts', 'sloplint.mjs')
        if (statSync(lint).isFile()) return { version, lint }
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      }
    }
  }
}
const hallmark = findHallmark()
if (!hallmark) {
  console.error(${JSON.stringify(installInstructions)})
  process.exit(1)
}
`

export default definePlugin({
  id: 'hallmark',
  version: '0.1.0',
  runtimeApi: '>=1.0.0 <2.0.0',
  detect: {
    probe: { executable: 'node', args: ['-e', locate + 'console.log(hallmark.version)'] },
    versionPattern: '^([^\\s]+)\\s*$',
    installInstructions,
  },
  license: { policy: 'bundled', name: 'MIT' },
  capabilities: ['design.page', 'design.slop-check'],
  use: [
    { kind: 'skills', files: ['skills/perkos-hallmark/SKILL.md'] },
    {
      kind: 'shell',
      id: 'slop-check',
      command: {
        executable: 'node',
        args: [
          '-e',
          locate + `
const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')
const result = spawnSync(process.execPath, [hallmark.lint, resolve(process.argv[1])], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
`,
          '--',
          '{{target}}',
        ],
      },
    },
  ],
  settings: {
    env: {
      PERKOS_HALLMARK_TOGETHER_COMP: 'off',
      PERKOS_HALLMARK_INSPO_MCP: 'off',
      TOGETHER_API_KEY: '',
    },
  },
})
