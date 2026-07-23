import { ESLint, Linter } from 'eslint'
import { workspace } from 'vscode'
import getConfigs from './Configs'

export default class EsLintManager {
  private static instance: ESLint | null = null

  public static async init() {
    const overrideConfig = await getConfigs()

    // If the user has defined any rules in settings, replace the defaults entirely
    const userRules = workspace.getConfiguration('mylint').get<Linter.RulesRecord>('rules', {})
    if (Object.keys(userRules).length > 0) {
      const rulesConfig = overrideConfig[overrideConfig.length - 1]
      rulesConfig.rules = userRules
    }

    EsLintManager.instance = new ESLint({
      overrideConfigFile: true,
      overrideConfig,
      fix: true,
      allowInlineConfig: false
    })
  }

  public static async getInstance(): Promise<ESLint> {
    if (!EsLintManager.instance) await this.init()
    return this.instance!
  }
}
