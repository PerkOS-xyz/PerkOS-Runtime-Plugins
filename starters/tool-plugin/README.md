# Standalone tool plugin starter

Use Node.js 22, npm, and Info-ZIP (`zip`) on your packaging machine. From a catalogue checkout with its dependencies installed, build and pack the SDK locally.

```sh
npm run build --workspace @perkos/plugin-api
npm pack ./plugin-api/dist --pack-destination /absolute/path/to/local-artifacts
```

Create the destination directory first. Copy this starter to a folder outside the catalogue checkout. From that copy, install the SDK tarball without changing the exact dependency pin.

```sh
npm install --offline --no-save --package-lock=false /absolute/path/to/local-artifacts/perkos-plugin-api-0.1.0.tgz
npm run validate
npm run pack
```

Edit `plugin.json` to declare your tool and its capabilities. Keep the package name and version aligned with the manifest ID and version to use the default archive tag. To check against an explicit release tag, pass it as an argument, for example `npm run pack -- example-tool@0.1.0`. Both commands check the manifest ID and the package and manifest versions against the tag.

Validation reads the JSON manifest and checks declared skill files. Plugin modules and declared commands are never run during validation or packing. Packing writes `dist/plugin.zip` with `plugin.json` at its root and any declared skill files at their original relative paths. The last line printed by `npm run pack` is the archive's SHA-256 digest.
