import { TSESTree } from '@typescript-eslint/utils'
import { getNearestAncestor, isTTaggedTemplateExpression } from '../helpers'
import { createRule } from '../create-rule'

export const name = 'no-expression-in-message'
export const rule = createRule({
  name: 'no-expression-in-message',
  meta: {
    docs: {
      description: "doesn't allow functions or member expressions in templates",
      recommended: 'error',
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

  create: function (context) {
    const linguiMacroFunctionNames = ['plural', 'select', 'selectOrdinal']

    return {
      'TemplateLiteral:exit'(node: TSESTree.TemplateLiteral) {
        const noneIdentifierExpressions = node.expressions
          ? node.expressions.filter((expression) => {
              const isIdentifier = expression.type === TSESTree.AST_NODE_TYPES.Identifier
              const isCallToLinguiMacro =
                expression.type === TSESTree.AST_NODE_TYPES.CallExpression &&
                expression.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
                linguiMacroFunctionNames.includes(expression.callee.name)
              return !isIdentifier && !isCallToLinguiMacro
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
})
