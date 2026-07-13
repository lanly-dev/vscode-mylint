// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Bundled ESLint configuration rules that come with this extension.
 * Users can apply this config to their projects without installing ESLint.
 */
const BUNDLED_CONFIG = {
  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  rules: {
    curly: 'warn' as const,
    eqeqeq: 'warn' as const,
    'no-throw-literal': 'warn' as const,
    semi: 'warn' as const,
    'no-var': 'warn' as const,
    'prefer-const': 'warn' as const,
    'dot-notation': 'warn' as const,
    'no-eval': 'warn' as const,
    'no-async-promise-executor': 'warn' as const,
    'no-cond-assign': 'warn' as const,
    'no-unsafe-finally': 'warn' as const
  }
}

/** Lint result from parsing/checking code */
interface LintResult {
  message: string;
  line: number;
  column: number;
  severity: number;
  ruleId: string | null;
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "myeslint" is now active!')

  // Hello World command (existing)
  const helloDisposable = vscode.commands.registerCommand('myeslint.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from MyEslint!')
  })

  // Command: Lint current file using bundled config rules (basic syntax checking)
  const lintFileDisposable = vscode.commands.registerCommand('myeslint.lintFile', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active file to lint')
      return
    }

    const filePath = editor.document.fileName
    const code = editor.document.getText()
    const languageId = editor.document.languageId

    // Only lint TypeScript/JavaScript files
    if (!['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(languageId)) {
      vscode.window.showWarningMessage('MyEslint only supports TypeScript and JavaScript files')
      return
    }

    const results = lintCode(code, filePath, languageId)
    displayResults(results, editor)
  })

  // Command: Apply bundled config to current workspace as eslint.config.mjs (flat config)
  const applyConfigDisposable = vscode.commands.registerCommand('myeslint.applyConfig', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open')
      return
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'eslint.config.mjs')
    const configContent = generateFlatConfig()

    try {
      await fs.promises.writeFile(configPath, configContent, 'utf-8')
      vscode.window.showInformationMessage(
        `Bundled ESLint flat config applied to ${configPath}`
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply config: ${error}`)
    }
  })

  // Command: Generate .eslintrc.json from bundled rules
  const generateConfigDisposable = vscode.commands.registerCommand('myeslint.generateConfig', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open')
      return
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, '.eslintrc.json')
    const configContent = generateEslintJsonConfig()

    try {
      await fs.promises.writeFile(configPath, configContent, 'utf-8')
      vscode.window.showInformationMessage(
        `ESLint JSON config generated at ${configPath}`
      )
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate config: ${error}`)
    }
  })

  // Command: Lint all files in workspace
  const lintAllDisposable = vscode.commands.registerCommand('myeslint.lintAll', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open')
      return
    }

    const searchPattern = '**/*.{ts,tsx,js,jsx}'
    const excludePattern = '**/node_modules/**,**/dist/**,**/build/**'
    const fileUris = await vscode.workspace.findFiles(searchPattern, excludePattern)

    if (fileUris.length === 0) {
      vscode.window.showInformationMessage('No TypeScript/JavaScript files found to lint')
      return
    }

    let totalErrors = 0
    let totalWarnings = 0
    const allResults: Map<string, LintResult[]> = new Map()

    for (const fileUri of fileUris) {
      try {
        const code = await fs.promises.readFile(fileUri.fsPath, 'utf-8')
        const languageId = getLanguageId(fileUri.fsPath)
        const results = lintCode(code, fileUri.fsPath, languageId)

        allResults.set(fileUri.fsPath, results)
        totalErrors += results.filter(r => r.severity === 2).length
        totalWarnings += results.filter(r => r.severity === 1).length
      } catch {
        // Skip files that can't be read
      }
    }

    // Show results in a quick pick list
    if (totalErrors > 0 || totalWarnings > 0) {
      vscode.window.showInformationMessage(
        `Linting complete: ${totalErrors} errors, ${totalWarnings} warnings across ${fileUris.length} files`
      )

      // Show problems for each file
      for (const [filePath, results] of allResults) {
        if (results.length > 0) {
          const diagnosticCollection = vscode.languages.createDiagnosticCollection('myeslint')
          const uri = vscode.Uri.file(filePath)
          const diagnostics: vscode.Diagnostic[] = results.map((msg) => createDiagnostic(msg))
          diagnosticCollection.set(uri, diagnostics)
        }
      }

      vscode.commands.executeCommand('workbench.panel.problems.show')
    } else {
      vscode.window.showInformationMessage(
        `All ${fileUris.length} files passed linting! No issues found.`
      )
    }
  })

  // Command: Show help information
  const showHelpDisposable = vscode.commands.registerCommand('myeslint.showHelp', () => {
    const helpText = `# MyEslint Extension

## Purpose
This extension bundles ESLint configuration rules so your future small projects don't need to install ESLint.

## Available Commands:

1. **MyEslint: Lint Current File** - Basic syntax linting on the currently open file using bundled rules
2. **MyEslint: Apply Config to Workspace** - Creates eslint.config.mjs (flat config) in your workspace root
3. **MyEslint: Generate JSON Config** - Creates .eslintrc.json (legacy config) in your workspace root  
4. **MyEslint: Lint All Files** - Lints all TS/JS files in the workspace and shows results
5. **MyEslint: Hello World** - Test command

## How to use:
1. Open your workspace folder
2. Run "MyEslint: Apply Config to Workspace" OR "MyEslint: Generate JSON Config"
3. The config file is now ready to use with ESLint in your project
4. Use lint commands for quick built-in checking without installing ESLint
`
    vscode.window.showInformationMessage(helpText)
  })

  context.subscriptions.push(
    helloDisposable,
    lintFileDisposable,
    applyConfigDisposable,
    generateConfigDisposable,
    lintAllDisposable,
    showHelpDisposable
  )
}

/**
 * Perform basic linting on code using bundled rules (regex-based checks)
 * This provides quick feedback without requiring ESLint to be installed
 */
function lintCode(code: string, filePath: string, languageId: string): LintResult[] {
  const results: LintResult[] = []
  const lines = code.split('\n')

  // Rule: curly - require braces for all control statements
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) 
      continue
		

    // Rule: curly - detect if/else/for/while without braces
    if (/^(if|else|for|while|do)\s*[\(\{]/.test(trimmed) && !trimmed.includes('{') && trimmed !== '{' && !trimmed.endsWith('{')) {
      const nextLines = lines.slice(i + 1, i + 4)
      const hasBraceSoon = nextLines.some(l => /\{/.test(l.trim()))
      if (!hasBraceSoon) {
        results.push({
          message: 'Expected a curly brace.',
          line: i + 1,
          column: 1,
          severity: 1,
          ruleId: 'curly'
        })
      }
    }

    // Rule: eqeqeq - detect == or != (but allow null checks)
    if (/(?:^|[^!=])([=!]+=)(?!=)/.test(trimmed) && !/==\s*null/.test(trimmed) && /!=\s*null/.test(trimmed) === false) {
      const match = trimmed.match(/(?:^|[^!<>])==(?!=)/)
      if (match && !trimmed.includes('===')) {
        const col = trimmed.indexOf(match[0]) + 1
        results.push({
          message: 'Expected === and instead saw ==.',
          line: i + 1,
          column: col,
          severity: 1,
          ruleId: 'eqeqeq'
        })
      }
    }

    // Rule: semi - detect missing semicolons at end of statements
    if (languageId.includes('typescript') || languageId === 'javascript' || languageId === 'javascriptreact') {
      const isLastChar = line.trim().length > 0 && line.trim()[line.trim().length - 1] !== '}'
      const endsWithBlock = line.trim().endsWith('{')
      const isControlFlow = /^(if|else|for|while|do|function|class|export|import)\b/.test(trimmed)
      const hasSemi = line.trim().endsWith(';') || endsWithBlock || isControlFlow || !isLastChar

      if (!hasSemi && !line.trim().endsWith(',') && !line.trim().endsWith('.') && !line.trim().endsWith('{')) {
        // Check if this is a complete statement that should have a semicolon
        const isCompleteStatement = /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed) ||
					/^(const|let|var)\s/.test(trimmed) ||
					/^(return|throw|delete|typeof)\s/.test(trimmed)

        if (isCompleteStatement && !trimmed.endsWith('}') && !trimmed.endsWith('{') && !trimmed.endsWith(',')) {
          results.push({
            message: 'Missing semicolon.',
            line: i + 1,
            column: line.length,
            severity: 1,
            ruleId: 'semi'
          })
        }
      }
    }

    // Rule: no-var - detect var keyword
    if (/\bvar\b/.test(trimmed) && !trimmed.startsWith('//')) {
      const match = trimmed.match(/\bvar\b/)
      if (match) {
        results.push({
          message: '"var" is not allowed. Use "let" or "const" instead.',
          line: i + 1,
          column: match.index! + 1,
          severity: 1,
          ruleId: 'no-var'
        })
      }
    }

    // Rule: prefer-const - detect const that should be let
    if (/^const\s/.test(trimmed) && /\bassign/.test(trimmed)) {
      results.push({
        message: '"const" is assigned a value more than once. Use "let" instead.',
        line: i + 1,
        column: 1,
        severity: 1,
        ruleId: 'prefer-const'
      })
    }

    // Rule: no-eval - detect eval() calls
    if (/\beval\s*\(/.test(trimmed)) {
      results.push({
        message: 'Eval is not allowed. Use Function or a parser instead.',
        line: i + 1,
        column: (trimmed.match(/\beval\b/)?.index ?? 0) + 1,
        severity: 1,
        ruleId: 'no-eval'
      })
    }

    // Rule: no-throw-literal - detect throw with non-Error objects
    if (/^throw\s+/.test(trimmed)) {
      const match = trimmed.match(/^throw\s+(.+)/)
      if (match && !/new\s+(Error|TypeError|RangeError|SyntaxError|ReferenceError)/.test(match[1])) {
        results.push({
          message: 'Throws must be Error objects, not literals.',
          line: i + 1,
          column: 1,
          severity: 1,
          ruleId: 'no-throw-literal'
        })
      }
    }

    // Rule: no-cond-assign - detect assignment in conditionals
    if (/^(if|while|for)\s*\(/.test(trimmed)) {
      const condMatch = trimmed.match(/\((.+)\)/)
      if (condMatch && /[^=]=[^=]/.test(condMatch[1]) && !/===|!==/.test(condMatch[1])) {
        results.push({
          message: 'Assignment in conditional is not allowed. Use === instead.',
          line: i + 1,
          column: 1,
          severity: 1,
          ruleId: 'no-cond-assign'
        })
      }
    }
  }

  return results
}

/**
 * Create a VSCode Diagnostic from a lint result
 */
function createDiagnostic(msg: LintResult): vscode.Diagnostic {
  const severity = msg.severity === 1
    ? vscode.DiagnosticSeverity.Warning
    : vscode.DiagnosticSeverity.Error

  const line = Math.max(0, msg.line - 1)
  const column = Math.max(0, msg.column - 1)

  return new vscode.Diagnostic(
    new vscode.Range(line, column, line, column + 1),
    msg.message,
    severity
  )
}

/**
 * Display linting results in the Problems panel for the active file
 */
function displayResults(messages: LintResult[], editor: vscode.TextEditor): void {
  const diagnostics = messages.map(msg => createDiagnostic(msg))

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('myeslint')
  diagnosticCollection.set(editor.document.uri, diagnostics)
  diagnosticCollection.dispose()

  if (messages.length > 0) 
    vscode.commands.executeCommand('workbench.panel.problems.show')
  else 
    vscode.window.showInformationMessage('No linting issues found!')
	
}

/**
 * Generate eslint.config.mjs (flat config format) from bundled rules
 */
function generateFlatConfig(): string {
  const filesStr = JSON.stringify(BUNDLED_CONFIG.files, null, 8)
  const rulesEntries = Object.entries(BUNDLED_CONFIG.rules)
    .map(([key, value]) => `        "${key}": "${value}"`)
    .join(',\n')

  return `// ESLint configuration generated by MyEslint extension
// This config is bundled with standardized rules

export default [
    {
        files: ${filesStr},
    },
    {
        rules: {
${rulesEntries},
        },
    },
];
`
}

/**
 * Generate .eslintrc.json (legacy format) from bundled rules
 */
function generateEslintJsonConfig(): string {
  return JSON.stringify({
    root: true,
    env: {
      browser: true,
      node: true,
      es2022: true
    },
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    files: BUNDLED_CONFIG.files,
    rules: Object.fromEntries(
      Object.entries(BUNDLED_CONFIG.rules).map(([k, v]) => [k, v])
    )
  }, null, 2)
}

/**
 * Get the language ID from file extension
 */
function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.ts': return 'typescript'
    case '.tsx': return 'typescriptreact'
    case '.js': return 'javascript'
    case '.jsx': return 'javascriptreact'
    default: return 'text'
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
