import * as vscode from 'vscode'
import { ESLint } from 'eslint'

import { getVirtualPath } from './utils'
import EsLintManager from './esLintManager'

/**
 * VS Code Document Formatting Edit Provider backed by ESLint auto-fix.
 *
 * Once registered, MyLint shows up in the "Format Document With..." picker
 * and can be set as the default formatter for a language:
 *
 *   "typescript.formatOnSave": true,
 *   "[typescript]": { "editor.defaultFormatter": "lanly-dev.mylint" }
 */
export default class MyLintFormatter implements vscode.DocumentFormattingEditProvider {
  private readonly supportedLangs = new Set<string>(['typescript', 'javascript'])

  /**
   * VS Code only calls this when the document's language is registered,
   * but we double-check so unsupported (or dirty virtual) docs resolve cleanly.
   */
  private supports(document: vscode.TextDocument): boolean {
    return this.supportedLangs.has(document.languageId)
  }

  public async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    if (!this.supports(document)) return []

    const code = document.getText()
    if (code.length === 0) return []

    const linter = await EsLintManager.getInstance()

    let results: ESLint.LintResult[]
    try {
      results = await linter.lintText(code, {
        filePath: getVirtualPath(document.languageId === 'typescript' ? 'ts' : 'js')
      })
    } catch (error) {
      throw new Error(`MyLint failed to format: ${error}`)
    }

    if (!results || results.length === 0) return []

    const result = results[0]

    // result.output only exists when at least one fix was applied.
    if (!result.output || result.output === code) return []

    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(code.length))
    return [vscode.TextEdit.replace(fullRange, result.output)]
  }
}
