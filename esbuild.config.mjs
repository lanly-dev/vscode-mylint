// Single-file bundle for the MyLint extension.
//
// Why esbuild and not webpack: ESLint 10's dependency tree (typescript-eslint,
// @stylistic) ships pre-bundled with rolldown. Those chunks contain two things
// webpack cannot handle:
//   1. `import.meta.url` inside `rolldown-runtime.js` -> left `undefined` in
//      CJS output, so `createRequire(undefined)` throws.
//   2. Lazy `__require("bare-specifier")` calls (rolldown's runtime require) -
//      invisible to static analysis, and rolldown's own placeholder
//      (`/* createRequire() */ undefined`) stays undefined under webpack, so the
//      bundle crashes at runtime with `TypeError: ...n is not a function`.
//
// This config works around both with a tiny onLoad plugin:
//   - rewrite `import.meta.url` to a real file URL derived from `__filename`
//     (equivalent semantics in a CJS bundle), and
//   - rewrite lazy `__require("...")` call sites to plain `require("...")` so
//     esbuild bundles those modules statically. The definition site
//     (rolldown-runtime.js) is excluded from the second rewrite.
//
// The result is a fully self-contained dist/extension.js (~18MB) that needs no
// node_modules at runtime. Only `vscode` stays external (provided by the host).
//
// Build-time note: eslint lists `jiti` as an *optional* peer dependency, so a
// plain `npm install` does not install it - but the bundler must resolve it,
// hence jiti is a devDependency here. It is only ever imported lazily by
// eslint's config-file loader, which MyLint never triggers
// (`overrideConfigFile: true` + inline configs).
import esbuild from 'esbuild'
import fs from 'node:fs'

// Build modes, driven by the npm scripts:
//   npm run compile  -> dev build, emits dist/extension.js.map
//   npm run package  -> release build, minified, no sourcemap
//   npm run watch    -> dev build, rebuilds on save
const argv = process.argv.slice(2)
const isProduction = argv.includes('--production')
const isWatch = argv.includes('--watch')

// Start every non-watch build from a clean output directory, so a dev
// sourcemap is never left behind in a release build.
if (!isWatch) fs.rmSync('./dist', { recursive: true, force: true })

const options = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  outfile: './dist/extension.js',
  logLevel: 'info',
  // Sourcemaps are for local debugging only; they are stripped from releases.
  sourcemap: !isProduction,
  minify: isProduction,
  plugins: [
    {
      name: 'rolldown-interop-fix',
      setup(build) {
        build.onLoad({ filter: /\.js$/ }, async (args) => {
          const isRuntime = /rolldown-runtime\.js$/.test(args.path)
          const text = await fs.promises.readFile(args.path, 'utf8')
          let out = text
          if (out.includes('import.meta.url')) {
            out = out.replaceAll(
              'import.meta.url',
              'require("url").pathToFileURL(__filename).href'
            )
          }
          if (!isRuntime && out.includes('__require("')) {
            out = out.replaceAll('__require("', 'require("')
          }
          if (out !== text) return { contents: out, loader: 'js' }
          return null
        })
      }
    }
  ]
}

if (isWatch) {
  const context = await esbuild.context(options)
  await context.watch()
  console.log('esbuild watching for changes...')
} else {
  await esbuild.build(options)
  console.log(`esbuild bundle done${isProduction ? ' (production)' : ''}`)
}

