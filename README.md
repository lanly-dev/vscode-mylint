# MyLint
A formatter extension that uses ESLint, intended for virtual files and small TS/JS scripts without requiring a local ESLint setup.
<a href="https://marketplace.visualstudio.com/items?itemName=lanly-dev.mylint" target="_blank">
  <img src='https://code.visualstudio.com/favicon.ico' width='13'/>
</a>
<a href="https://open-vsx.org/extension/lanly-dev/mylint" target="_blank">
  <img src='https://open-vsx.org/favicon.ico' width='12'/>
</a>

## Extension Settings
### Commands
- `mylint: Format File`: Format the current file using the built-in ESLint config
- `mylint: Open Global ESLint Configuration File`: Open the global ESLint config
- `mylint: Open Settings`: Open extension settings

### Configurations
- `myLint.enableDiagnostics`: `false` | Enable/disable showing lint diagnostics in VS Code's Problems tab.
- `mylint.rules`: ESLint rule overrides for JS/TS files.

## Setting MyLint as the Default Formatter
MyLint is registered as a VS Code document formatter (ID: `lanly-dev.mylint`) for JavaScript and TypeScript.

**Option 1 — one time per file**
- Open a JS/TS file → `Ctrl+K Ctrl+F` (or right-click → *Format Document With...*)
- Pick **MyLint** and click *Configure default formatter* when prompted.

**Option 2 — via settings (recommended)**
```jsonc
{
  "[javascript]": {
    "editor.defaultFormatter": "lanly-dev.mylint",
    "editor.formatOnSave": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "lanly-dev.mylint",
    "editor.formatOnSave": true
  }
}
```

> Formatting uses ESLint's auto-fix, so only rules that have a fixer will change the file. Rules without a fixer will be reported as diagnostics instead.

## Release Notes

### 0.0.2
- Fixed `Parsing error: ';' expected.`
- Add to problems tab
- Enable problems tab option

### 0.0.1
Initial release.

Enjoy!
