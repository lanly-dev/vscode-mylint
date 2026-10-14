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

await esbuild.build({
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  outfile: './dist/extension.js',
  logLevel: 'info',
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
})
console.log('esbuild bundle done')
