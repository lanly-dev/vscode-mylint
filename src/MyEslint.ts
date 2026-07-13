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

export default class MyEslint {
  static async openConfig(resourceUri: vscode.Uri): Promise<void> {
    const configFileUri = vscode.Uri.joinPath(resourceUri, 'eslint.config.js')
    const doc = await vscode.workspace.openTextDocument(configFileUri)
    await vscode.window.showTextDocument(doc, { preview: false })
  }

  static async resetConfig(resourceUri: vscode.Uri): Promise<void> {
    const configFileUri = vscode.Uri.joinPath(resourceUri, 'eslint.config.js')
    const defaultContent = readExtensionFile('eslint.bk.js')
    if (!defaultContent) {
      vscode.window.showErrorMessage('Failed to reset: default config file not found in extension resources')
      return
    }
    // Copy content from eslint.bk.js to the eslint.config.js file
    try {
      fs.mkdirSync(vscode.Uri.joinPath(configFileUri, '..').fsPath, { recursive: true })
      fs.writeFileSync(configFileUri.fsPath, defaultContent, 'utf-8')
    } catch {
      vscode.window.showErrorMessage('Failed to reset: could not write default config to workspace')
      return
    }
    vscode.window.showInformationMessage('ESLint config reset to default')
  }

  static async lintFile(resourceUri: vscode.Uri): Promise<void> {
    console.log(`Linting file: ${resourceUri.fsPath}`)
  }
}
