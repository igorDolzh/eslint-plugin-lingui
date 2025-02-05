import * as noExpressionInMessageRule from './rules/no-expression-in-message'
import * as noUnlocalizedStringsRule from './rules/no-unlocalized-strings'
import * as noSingleTagToTranslateRule from './rules/no-single-tag-to-translate'
import * as noSingleVariablesToTranslateRule from './rules/no-single-variables-to-translate'
import * as tCallInFunctionRule from './rules/t-call-in-function'
import * as textRestrictionsRule from './rules/text-restrictions'
import * as noTransInsideTransRule from './rules/no-trans-inside-trans'
import * as noTCallInReactComponentRule from './rules/no-t-call-in-react-component'

import { ESLint, Linter } from 'eslint'
import { FlatConfig, RuleModule } from '@typescript-eslint/utils/ts-eslint'

const rules = {
  [noExpressionInMessageRule.name]: noExpressionInMessageRule.rule,
  [noUnlocalizedStringsRule.name]: noUnlocalizedStringsRule.rule,
  [noSingleTagToTranslateRule.name]: noSingleTagToTranslateRule.rule,
  [noSingleVariablesToTranslateRule.name]: noSingleVariablesToTranslateRule.rule,
  [tCallInFunctionRule.name]: tCallInFunctionRule.rule,
  [textRestrictionsRule.name]: textRestrictionsRule.rule,
  [noTransInsideTransRule.name]: noTransInsideTransRule.rule,
  [noTCallInReactComponentRule.name]: noTCallInReactComponentRule.rule,
}

type RuleKey = keyof typeof rules

interface Plugin extends Omit<ESLint.Plugin, 'rules'> {
  rules: Record<RuleKey, RuleModule<any, any, any>>
  configs: {
    recommended: ESLint.ConfigData
    'flat/recommended': Linter.FlatConfig
  }
}

const plugin = {
  meta: {
    name: 'eslint-plugin-lingui',
  },
  configs: {} as Plugin['configs'],
  rules,
} satisfies Plugin

const recommendedRules: { [K in RuleKey as `lingui/${K}`]?: FlatConfig.RuleLevel } = {
  'lingui/t-call-in-function': 'error',
  'lingui/no-single-tag-to-translate': 'warn',
  'lingui/no-single-variables-to-translate': 'warn',
  'lingui/no-trans-inside-trans': 'warn',
  'lingui/no-expression-in-message': 'warn',
  'lingui/no-t-call-in-react-component': 'warn',
}

// Assign configs here so we can reference `plugin`
Object.assign(plugin.configs, {
  recommended: {
    plugins: ['lingui'],
    rules: recommendedRules,
  },
  'flat/recommended': {
    plugins: {
      lingui: plugin,
    },
    rules: recommendedRules,
  },
})

export = plugin
