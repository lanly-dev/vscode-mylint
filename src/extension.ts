import * as vscode from 'vscode'
import EsLintManager from './EsLintManager'
import LintStatus from './LintStatus'
import MyLint from './MyLint'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const rc = vscode.commands.registerCommand
  const resourceUri = getResourceUri(context)
  const lintStatus = new LintStatus()


  const d1 = rc('mylint.openConfig', () => MyLint.openConfig(resourceUri))
  const d2 = rc('mylint.openSettings', () => MyLint.openSettings())
  const d3 = rc('mylint.formatFile', () => MyLint.formatFile())
  const d4 = rc('myLinter.showDiagnosticsList', () => lintStatus.showDiagnosticsQuickPick())
  const d5 = vscode.window.onDidChangeActiveTextEditor(() => lintStatus.lintActiveFile())
  const d6 = vscode.workspace.onDidSaveTextDocument(() => lintStatus.lintActiveFile())
  const d7 = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('myLinter')) EsLintManager.init()
  })
  context.subscriptions.push(d1, d2, d3, d4, d5, d6, d7, lintStatus)

  // Initial run on startup
  lintStatus.lintActiveFile()
}

function getResourceUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, 'resources')
}

// This method is called when your extension is deactivated
export function deactivate() { }
