# Contributing

Use Node.js 22.18 or later on the Node.js 22 release line. Install dependencies with `npm ci` from the root.

## Add a plugin

Create a lowercase kebab-case folder at the root with a `package.json`, TypeScript source, tests, and `CHANGELOG.md`. Follow the contract in `plugin-api/`. Add the folder to the root `workspaces` array if needed and run `npm install` to update the lockfile. Run `npm run typecheck` and `npm test`.

## Version and release

Set the plugin's own semantic version in its `package.json`. Use a patch for compatible fixes, a minor for compatible features, and a major for breaking changes. Add an exact level-two changelog heading such as `## 1.2.0` or `## [1.2.0] - 2026-11-23`.

From the root, run `npm run release -- openscreen 1.2.0`. It checks the package and changelog at HEAD and tags that commit locally. Publish only that tag with `git push origin tag openscreen@1.2.0`.

To build the archive from a clean checkout, run `npm run --silent pack:plugin -- ffmpeg 0.1.0` with Info-ZIP installed. The command writes `dist/plugin.zip` and prints its SHA-256. The archive contains the validated default export from the plugin's `index.ts` as `plugin.json`, plus the skill files declared in the manifest. Use PATH-based executable names for tools installed by the desk.

Pushing the plugin tag runs the same pack command at the tagged commit and publishes the archive and SHA-256 on the GitHub release.
