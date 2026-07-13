import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

function getExtensionDefaultPath(relativePath: string): string {
  return path.join(__dirname, '..', 'resources', relativePath)
}

function readExtensionFile(relativePath: string): string | null {
  const fullPath = getExtensionDefaultPath(relativePath)
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch {
    return null
  }
}

function getWorkspaceRoot(): vscode.Uri | undefined {
  const ws = vscode.workspace
  /* c8 ignore next */
  if (ws.workspaceFolders?.length) return ws.workspaceFolders[0].uri
  return undefined
}

function findProjectDir(start: vscode.Uri): vscode.Uri {
  let dir = start
  for (let i = 0; i < 10; i++) {
    const pkg = vscode.Uri.joinPath(dir, 'package.json')
    if (fs.existsSync(pkg.fsPath)) return dir

    const parent = vscode.Uri.file(path.dirname(dir.fsPath))
    if (parent.fsPath === dir.fsPath) break

    dir = parent
  }
  return start
}

function resolveConfigPath(root: vscode.Uri): { eslintJson: vscode.Uri; eslintrcJs: vscode.Uri | null; flatMjs: vscode.Uri | null } {
  const eslintJson = vscode.Uri.joinPath(root, '.eslintrc.json')
  const eslintrcJs = vscode.Uri.joinPath(root, 'eslint.config.js')
  const flatMjs = vscode.Uri.joinPath(root, 'eslint.config.mjs')
  return { eslintJson, eslintrcJs, flatMjs }
}

async function openFile(uri: vscode.Uri) {
  const doc = await vscode.workspace.openTextDocument(uri)
  await vscode.window.showTextDocument(doc, { preview: false })
}

function writeJsonToFile(uri: vscode.Uri, obj: unknown) {
  fs.mkdirSync(vscode.Uri.joinPath(uri, '..').fsPath, { recursive: true })
  fs.writeFileSync(uri.fsPath, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
}

function writeTextToFile(uri: vscode.Uri, text: string) {
  fs.mkdirSync(vscode.Uri.joinPath(uri, '..').fsPath, { recursive: true })
  fs.writeFileSync(uri.fsPath, text, 'utf-8')
}

export default class MyEslint {
  static async openConfig(createIfNotExist = true): Promise<void> {
    const root = getWorkspaceRoot()
    if (!root) {
      vscode.window.showErrorMessage('No workspace folder open')
      return
    }

    const dir = findProjectDir(root)
    const { eslintJson, eslintrcJs, flatMjs } = resolveConfigPath(dir)
    const flatCfg = flatMjs

    // Check which config file exists first
    if (fs.existsSync(eslintJson.fsPath)) {
      await openFile(eslintJson)
      return
    }

    if (eslintrcJs && fs.existsSync(eslintrcJs.fsPath)) {
      await openFile(eslintrcJs)
      return
    }

    if (flatCfg && fs.existsSync(flatCfg.fsPath)) {
      await openFile(flatCfg)
      return
    }

    // If none exists and createIfNotExist, generate default from bundled file
    else if (createIfNotExist) {
      // Prefer flat config (.eslint.config.mjs) as it is the modern ESLint standard
      const defaultFlatContent = readExtensionFile('default-eslint.config.mjs')
      if (defaultFlatContent) {
        await vscode.window.showInformationMessage('No config found. Generating default eslint.config.mjs')
        writeTextToFile(flatMjs!, defaultFlatContent)
        await openFile(flatMjs!)
      } else {
        const defaultContent = readExtensionFile('default-eslintrc.json')
        if (defaultContent) {
          await vscode.window.showInformationMessage('No flat config found. Generating default .eslintrc.json')
          writeJsonToFile(eslintJson, JSON.parse(defaultContent))
          await openFile(eslintJson)
        } else vscode.window.showErrorMessage('Default ESLint config not found in extension resources')

      }
    }

    if (!createIfNotExist) vscode.window.showWarningMessage('No ESLint config file found')
  }

  static async resetConfig(): Promise<void> {
    const root = getWorkspaceRoot()
    if (!root) {
      vscode.window.showErrorMessage('No workspace folder open')
      return
    }

    const dir = findProjectDir(root)
    const { eslintJson, flatMjs } = resolveConfigPath(dir)
    const flatCfg = flatMjs

    // Detect existing format
    let useFlat = false

    if (flatCfg && fs.existsSync(flatCfg.fsPath))  useFlat = true
    else if (eslintJson && fs.existsSync(eslintJson.fsPath)) {
      try {
        const raw: any = JSON.parse(fs.readFileSync(eslintJson.fsPath, 'utf-8'))
        if (raw.files || raw.flat)  useFlat = true
      } catch { /* ignore */ }
    }

    if (useFlat) {
      const defaultFlatContent = readExtensionFile('default-eslint.config.mjs')
      if (!defaultFlatContent) {
        vscode.window.showErrorMessage('Default ESLint flat config not found in extension resources')
        return
      }

      writeTextToFile(flatCfg!, defaultFlatContent)
      vscode.window.showInformationMessage('ESLint flat config reset to default')
    } else {
      const defaultContent = readExtensionFile('default-eslintrc.json')
      if (!defaultContent) {
        vscode.window.showErrorMessage('Default ESLint config not found in extension resources')
        return
      }

      writeJsonToFile(eslintJson, JSON.parse(defaultContent))
      vscode.window.showInformationMessage('ESLint config (.eslintrc.json) reset to default')
    }
  }

  static async lintDirectory(): Promise<void> {
    const root = getWorkspaceRoot()
    if (!root) {
      vscode.window.showErrorMessage('No workspace folder open')
      return
    }

    const dir = findProjectDir(root)
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,js,mjs,cjs}',
      '**/node_modules/**,**/dist/**,**/build/**',
      1
    )

    if (files.length === 0) {
      vscode.window.showWarningMessage('No TS/JS files found to lint')
      return
    }

    const cmd = `npx eslint "${dir.fsPath}"`
    vscode.window.showInformationMessage(`Running ESLint on workspace: ${cmd}`)

    try {
      const { execSync } = await import('child_process') as any
      const output = execSync(cmd, { cwd: dir.fsPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })

      if (output.trim()) {
        vscode.window.showErrorMessage('ESLint reported issues')
        const chan = vscode.window.createOutputChannel('ESLint')
        chan.appendLine(output)
        chan.show(true)
      } else vscode.window.showInformationMessage('ESLint passed - no issues found')
    }

    catch (e: any) {
      const code = typeof e.code === 'number' ? e.code : (typeof e.status === 'number' ? e.status : null)

      if (code !== 0 && code !== 1) {
        vscode.window.showErrorMessage(`ESLint error: ${e.message}`)
        return
      }

      const output = e.stdout?.toString() || ''
      const chan = vscode.window.createOutputChannel('ESLint')
      chan.appendLine(output)
      chan.show(true)
      vscode.window.showWarningMessage('ESLint found issues - see Output panel')
    }
  }
}
