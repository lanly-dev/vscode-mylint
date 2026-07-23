import * as vscode from 'vscode'
import { ESLint } from 'eslint'
import { getExt, getVirtualPath, isSupported } from './Utils'
import EsLintManager from './EsLintManager'

export default class LintStatus {
  // Built-in VS Code Problems integration
  private diagnosticCollection: vscode.DiagnosticCollection
  private currentDiagnostics: Array<{
    line: number
    column: number
    message: string
    severity: 'ERROR' | 'WARNING'
    ruleId: string
  }> = []


  constructor() {
    // Initialize diagnostic collection to populate the native Problems tab
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('myLinter')
  }

  public async lintActiveFile() {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const document = editor.document
    const ext = getExt()

    // Only lint supported languages
    if (!isSupported(ext)) {
      // Clear diagnostics if user switches to an unsupported file type
      this.diagnosticCollection.delete(document.uri)
      return
    }

    const filePath = getVirtualPath(ext)
    const linter = await EsLintManager.getInstance()
    try {
      const results = await linter.lintText(document.getText(), { filePath })
      this.processResults(document.uri, results)
    } catch (err) {
      console.error('Failed to lint file:', err)
    }
  }

  private processResults(uri: vscode.Uri, results: ESLint.LintResult[]) {
    this.currentDiagnostics = []
    const nativeDiagnostics: vscode.Diagnostic[] = []

    for (const result of results) {
      for (const msg of result.messages) {
        const severityStr = msg.severity === 2 ? 'ERROR' : 'WARNING'

        // Save internal diagnostics for QuickPick
        this.currentDiagnostics.push({
          line: msg.line,
          column: msg.column,
          message: msg.message,
          severity: severityStr,
          ruleId: msg.ruleId || 'unknown'
        })

        // Build VS Code Diagnostic for the native Problems panel
        const startPos = new vscode.Position(
          Math.max(0, msg.line - 1),
          Math.max(0, msg.column - 1)
        )
        const endPos = new vscode.Position(
          Math.max(0, (msg.endLine || msg.line) - 1),
          Math.max(0, (msg.endColumn || msg.column) - 1)
        )

        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(startPos, endPos),
          msg.message,
          msg.severity === 2
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning
        )
        diagnostic.source = 'myLinter'
        diagnostic.code = msg.ruleId || 'eslint'

        nativeDiagnostics.push(diagnostic)
      }
    }

    // Push directly into VS Code's native Problems panel
    this.diagnosticCollection.set(uri, nativeDiagnostics)
  }

  public async showDiagnosticsQuickPick() {
    if (this.currentDiagnostics.length === 0) {
      vscode.window.showInformationMessage('No lint issues in the current file.')
      return
    }

    // Map diagnostics to QuickPick items
    const items = this.currentDiagnostics.map((d) => ({
      label: `${d.severity === 'ERROR' ? '$(error)' : '$(warning)'} Line ${d.line}:${d.column}`,
      description: d.ruleId,
      detail: d.message,
      diagnostic: d
    }))

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an issue to jump to line'
    })

    if (selected) {
      this.jumpToLine(selected.diagnostic.line - 1, selected.diagnostic.column - 1)
    }
  }

  private jumpToLine(line: number, column: number) {
    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const position = new vscode.Position(line, column)
    editor.selection = new vscode.Selection(position, position)
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter)
  }

  // Cleanup method to dispose resources when extension deactivates
  public dispose() {
    this.diagnosticCollection.clear()
    this.diagnosticCollection.dispose()
  }
}
