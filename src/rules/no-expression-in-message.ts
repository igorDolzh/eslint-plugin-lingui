import { TSESTree } from '@typescript-eslint/utils'
import {
  RuleContext,
  RuleRecommendation,
  RuleModule,
} from '@typescript-eslint/utils/dist/ts-eslint/Rule'
import { getNearestAncestor, isTTaggedTemplateExpression } from '../helpers'

const rule: RuleModule<string, readonly unknown[]> = {
  meta: {
    docs: {
      description: "doesn't allow functions or member expressions in templates",
      recommended: 'error' as RuleRecommendation,
    },
    messages: {
      default: 'Should be ${variable}, not ${object.property} or ${my_function()}',
    },
    schema: [
      {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    ],
    type: 'problem' as const,
  },

  defaultOptions: [],

  create: function (context: RuleContext<string, readonly unknown[]>) {
    return {
      'TemplateLiteral:exit'(node: TSESTree.TemplateLiteral) {
        const noneIdentifierExpressions = node.expressions
          ? node.expressions.filter((expression) => {
              const isIdentifier = expression.type === TSESTree.AST_NODE_TYPES.Identifier
              const isCallToPluralFunction =
                expression.type === TSESTree.AST_NODE_TYPES.CallExpression &&
                expression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
                expression.callee.name === 'plural'
              return !isIdentifier && !isCallToPluralFunction
            })
          : []

        const taggedTemplate = getNearestAncestor<TSESTree.TaggedTemplateExpression>(
          node,
          'TaggedTemplateExpression',
        )

        if (
          noneIdentifierExpressions.length > 0 &&
          taggedTemplate &&
          isTTaggedTemplateExpression(taggedTemplate)
        ) {
          context.report({
            node: node,
            messageId: 'default',
          })
        }

        return
      },
    }
  },
}

export default rule
