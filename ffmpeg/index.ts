import { definePlugin } from '@perkos/plugin-api'

const versionProbe = String.raw`
const { spawnSync } = require('node:child_process')
const banners = []
for (const tool of ['ffmpeg', 'ffprobe']) {
  const result = spawnSync(tool, ['-version'], { encoding: 'utf8', timeout: 5000 })
  const banner = result.stdout?.split(/\r?\n/, 1)[0]
  if (result.status !== 0 || !new RegExp('^' + tool + ' version (\\S+)').test(banner ?? '')) {
    console.error(tool + ' is missing from PATH or did not report its version.')
    process.exit(1)
  }
  banners.push(banner)
}
console.log(banners.join('\n'))
`

const input = 'file:{{input}}'
const output = 'file:{{output}}'

function ffmpeg(id: string, args: readonly string[]) {
  return {
    kind: 'shell' as const,
    id,
    command: {
      executable: 'ffmpeg',
      args: ['-nostdin', '-n', ...args, output],
    },
  }
}

export default definePlugin({
  id: 'ffmpeg',
  version: '0.1.0',
  runtimeApi: '>=0.1.0 <0.2.0',
  detect: {
    probe: { executable: process.execPath, args: ['-e', versionProbe] },
    versionPattern: '^ffmpeg version (\\S+)',
    installInstructions: 'Install FFmpeg with brew install ffmpeg on macOS or sudo apt install ffmpeg on Debian/Ubuntu. Make sure both ffmpeg and ffprobe are on PATH.',
  },
  license: { policy: 'installed-by-person', name: 'LGPL or GPL depending on the build' },
  capabilities: [
    'video.probe',
    'video.trim',
    'video.scale',
    'video.strip-audio',
    'video.concat',
    'video.captions',
    'video.gif',
  ],
  use: [
    {
      kind: 'shell',
      id: 'probe',
      command: {
        executable: 'ffprobe',
        args: ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', input],
      },
    },
    ffmpeg('trim', ['-ss', '{{start}}', '-i', input, '-t', '{{duration}}']),
    ffmpeg('scale', ['-i', input, '-s', '{{width}}x{{height}}']),
    ffmpeg('strip-audio', ['-i', input, '-map', '0', '-c', 'copy', '-an']),
    ffmpeg('concat', ['-f', 'concat', '-safe', '1', '-protocol_whitelist', 'file', '-i', 'file:{{list}}', '-map', '0', '-c', 'copy']),
    ffmpeg('captions', [
      '-i', input, '-f', 'srt', '-i', 'file:{{captions}}',
      '-map', '0:v:0', '-map', '0:a?', '-map', '1:s:0',
      '-c', 'copy', '-c:s', 'mov_text', '-f', 'mp4',
    ]),
    ffmpeg('gif', [
      '-i', input, '-filter_complex',
      '[0:v:0]fps=10,split[video][colors];[colors]palettegen[palette];[video][palette]paletteuse[gif]',
      '-map', '[gif]', '-loop', '0', '-f', 'gif',
    ]),
  ],
  settings: { env: { AV_LOG_FORCE_NOCOLOR: '1' } },
})
