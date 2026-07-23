import * as vscode from 'vscode'
import { ESLint } from 'eslint'
import { getExt, getVirtualPath, isSupported } from './Utils'

export default class LintStatus {
  private statusBarItem: vscode.StatusBarItem
  private currentDiagnostics: Array<{
    line: number
    column: number
    message: string
    severity: 'ERROR' | 'WARNING'
    ruleId: string
  }> = []

  constructor() {
    // Create a status bar item on the bottom right
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    )
    // Command to execute when the status bar item is clicked
    this.statusBarItem.command = 'myLinter.showDiagnosticsList'
  }

  public async lintActiveFile() {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      this.statusBarItem.hide()
      return
    }

    const document = editor.document
    const ext = getExt()

    // Only lint supported languages
    if (!isSupported(ext)) {
      this.statusBarItem.hide()
      return
    }

    const filePath = getVirtualPath(ext)
    const eslint = new ESLint()
    try {
      const results = await eslint.lintText(document.getText(), { filePath })
      this.processResults(results)
    } catch (err) {
      console.error('Failed to lint file:', err)
      this.statusBarItem.text = '$(error) Lint Failed'
      this.statusBarItem.show()
    }
  }

  private processResults(results: ESLint.LintResult[]) {
    let errorCount = 0
    let warningCount = 0
    this.currentDiagnostics = []

    for (const result of results) {
      for (const msg of result.messages) {
        if (msg.severity === 2) {
          errorCount++
          this.currentDiagnostics.push({
            line: msg.line,
            column: msg.column,
            message: msg.message,
            severity: 'ERROR',
            ruleId: msg.ruleId || 'unknown'
          })
        } else if (msg.severity === 1) {
          warningCount++
          this.currentDiagnostics.push({
            line: msg.line,
            column: msg.column,
            message: msg.message,
            severity: 'WARNING',
            ruleId: msg.ruleId || 'unknown'
          })
        }
      }
    }

    this.updateStatusBar(errorCount, warningCount)
  }

  private updateStatusBar(errors: number, warnings: number) {
    if (errors === 0 && warnings === 0) {
      this.statusBarItem.text = '$(check) Lint: OK'
      this.statusBarItem.tooltip = 'No lint issues found'
    } else {
      this.statusBarItem.text = `$(error) ${errors} $(warning) ${warnings}`
      this.statusBarItem.tooltip = `Click to view ${errors + warnings} lint issues`
    }
    this.statusBarItem.show()
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
}
