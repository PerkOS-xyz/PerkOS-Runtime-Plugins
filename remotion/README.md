# Remotion plugin

The `video.render-composition` capability renders a composition from your own Remotion project. Run `npx create-video` yourself to create a project and install its dependencies, then run the plugin from the project directory. Detection reads the installed `@remotion/cli` package version and shows setup instructions if the CLI is missing. [Remotion setup guide](https://www.remotion.dev/docs)

The plugin ships without Remotion. You or your organization must hold the applicable Remotion License. The Free License covers individuals and organizations of up to three people. A Company License is required if you do not qualify for the Free License. [Remotion license eligibility](https://www.remotion.dev/docs/license/faq)

The `render-composition` command takes an entry file, a composition ID, and an output path.

```sh
npx --no remotion render <entry> <comp> <out> --codec h264 --muted
```

The command always uses H.264 and disables audio output. The `--no` option declines npm package installation. The plugin sets no environment overrides. [Remotion render options](https://www.remotion.dev/docs/cli/render)

See the upstream repository for [Remotion Skills](https://github.com/remotion-dev/skills).
