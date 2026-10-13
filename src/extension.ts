import { DocumentSelector, ExtensionContext, TextDocument, TextEditor, Uri } from 'vscode'
import { commands, languages, window, workspace } from 'vscode'
import EsLintManager from './EsLintManager'
import LintStatus from './LintStatus'
import MyLint from './MyLint'
import MyLintFormatter from './MyLintFormatter'

/** Context key driving the visibility of the `mylint.formatFile` context menu entry. */
const MYLINT_IS_DEFAULT_FORMATTER = 'mylint.isDefaultFormatter'

const SUPPORTED_LANGUAGE_IDS = ['typescript', 'javascript']

/**
 * True when MyLint is the configured default formatter for the given document.
 * `editor.defaultFormatter` is a language scoped setting, so the lookup is
 * scoped by uri + languageId to also pick up `"[typescript]"` overrides.
 */
function isDefaultFormatter(myLintId: string, document: TextDocument): boolean {
  if (!SUPPORTED_LANGUAGE_IDS.includes(document.languageId)) return false

  const defaultFormatter = workspace
    .getConfiguration('editor', { uri: document.uri, languageId: document.languageId })
    .get<string>('defaultFormatter')

  return defaultFormatter === myLintId
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const rc = commands.registerCommand
  const resourceUri = getResourceUri(context)
  const lintStatus = new LintStatus()
  const myLintId = context.extension.id

  /**
   * Keeps the `mylint.isDefaultFormatter` context key in sync with the active
   * editor and the user's settings, so the context menu entry can be hidden
   * while MyLint is already the default formatter ("Format Document" covers it).
   */
  async function syncFormatterContext(editor: TextEditor | undefined = window.activeTextEditor) {
    const isDefault = editor ? isDefaultFormatter(myLintId, editor.document) : false
    await commands.executeCommand('setContext', MYLINT_IS_DEFAULT_FORMATTER, isDefault)
  }

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

  const d3 = window.onDidChangeActiveTextEditor((editor) => {
    syncFormatterContext(editor)
    lintStatus.lintActiveFile()
  })
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
  const d7 = workspace.onDidChangeConfiguration((e) => {
    // The default formatter can be set globally or per language (e.g. "[typescript]"),
    // so any change to `editor.defaultFormatter` triggers a re-sync.
    if (e.affectsConfiguration('editor.defaultFormatter')) syncFormatterContext()
  })

  syncFormatterContext()
  lintStatus.lintActiveFile()
  context.subscriptions.push(d1a, d1b, d2a, d2b, d2c, d2d, d3, d4, d5, d6, d7, lintStatus)
}

function getResourceUri(context: ExtensionContext): Uri {
  return Uri.joinPath(context.extensionUri, 'resources')
}

// This method is called when your extension is deactivated
export function deactivate() { }
