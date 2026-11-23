import { definePlugin } from '@perkos/plugin-api'

export default definePlugin({
  id: 'remotion',
  version: '0.1.0',
  runtimeApi: '>=0.1.0 <0.2.0',
  detect: {
    probe: {
      executable: process.execPath,
      args: ['--input-type=commonjs', '--no-global-search-paths', '-e', "console.log(require('@remotion/cli/package.json').version)"],
    },
    versionPattern: '^(\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)\\s*$',
    installInstructions: 'Create your own Remotion project with npx create-video, then run the plugin from the project directory. You or your organization must hold the applicable Remotion license.',
  },
  license: { policy: 'installed-by-person', name: 'Remotion License' },
  capabilities: ['video.render-composition'],
  use: [{
    kind: 'shell',
    id: 'render-composition',
    command: {
      executable: 'npx',
      args: ['--no', 'remotion', 'render', '{{entry}}', '{{comp}}', '{{out}}', '--codec', 'h264', '--muted'],
    },
  }],
  settings: { env: {} },
})
