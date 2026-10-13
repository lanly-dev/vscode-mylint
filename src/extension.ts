import { DocumentSelector, ExtensionContext, Uri } from 'vscode'
import { commands, languages, window, workspace } from 'vscode'
import EsLintManager from './EsLintManager'
import LintStatus from './LintStatus'
import MyLint from './MyLint'
import MyLintFormatter from './MyLintFormatter'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  const resourceUri = getResourceUri(context)
  const lintStatus = new LintStatus()

  // Register MyLint as a document formatter so it can be set as the
  // default formatter for JS/TS in VS Code settings.
  const formatter = new MyLintFormatter()
  const tsSelector: DocumentSelector = { scheme: 'file', language: 'typescript' }
  const jsSelector: DocumentSelector = { scheme: 'file', language: 'javascript' }
  const d1a = languages.registerDocumentFormattingEditProvider(tsSelector, formatter)
  const d1b = languages.registerDocumentFormattingEditProvider(jsSelector, formatter)

  const d2a = rc('mylint.openConfig', () => MyLint.openConfig(resourceUri))
  const d2b = rc('mylint.openSettings', () => MyLint.openSettings())
  const d2c = rc('mylint.formatFile', () => MyLint.formatFile())
  const d2d = rc('mylint.showDiagnosticsList', () => lintStatus.showDiagnosticsQuickPick())

  const d3 = window.onDidChangeActiveTextEditor(() => lintStatus.lintActiveFile())
  const d4 = workspace.onDidSaveTextDocument(() => lintStatus.lintActiveFile())
  const d5 = workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('myLint.rules')) EsLintManager.init()
  })
  const d6 = workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('myLint.enableDiagnostics')) {
      const enabled = workspace.getConfiguration('myLint').get<boolean>('enableDiagnostics')
      if (enabled) lintStatus.lintActiveFile()
      else lintStatus.clear()
    }
  })

  lintStatus.lintActiveFile()
  context.subscriptions.push(d1a, d1b, d2a, d2b, d2c, d2d, d3, d4, d5, d6, lintStatus)
}

function getResourceUri(context: ExtensionContext): Uri {
  return Uri.joinPath(context.extensionUri, 'resources')
}

// This method is called when your extension is deactivated
export function deactivate() { }
