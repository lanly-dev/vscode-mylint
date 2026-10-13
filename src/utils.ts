import * as vscode from 'vscode'

function getExt() {
  const editor = vscode.window.activeTextEditor
  // Already checked before calling this function
  const document = editor!.document
  const ext = document.fileName.split('.').pop()?.toLowerCase() || ''
  return ext
}


function getVirtualPath(ext: string) {
  return `file.${ext}`
}

function isSupported(ext: string) {
  return ['ts', 'js', 'mjs', 'cjs', 'json'].includes(ext)
}


export { getExt, getVirtualPath, isSupported }
