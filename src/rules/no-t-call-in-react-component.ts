import { ParserServices, TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../create-rule'
import { RuleContext, SourceCode } from '@typescript-eslint/utils/ts-eslint'
import ts, { type Expression, type SourceFile, type TypeChecker } from 'typescript'

type Node = TSESTree.Node
const { AST_NODE_TYPES } = TSESTree
export const name = 'no-t-call-in-react-component'
export const rule = createRule({
  name,
  meta: {
    docs: {
      description: 'use _(msg`...`) instead of t`...` and t() in react components',
      recommended: 'error',
    },
    messages: {
      default:
        't`...` and t() call should not be used in react components, use _(msg`...`) instead',
      fix1: 'Replace with _(msg`...`)',
      fix2: 'Replace with <Trans>...</Trans>',
    },
    fixable: 'code',
    hasSuggestions: true,
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

  create: (context) => {
    return {
      'TaggedTemplateExpression[tag.name=t]'(node: TSESTree.TaggedTemplateExpression) {
        const hookContainer = findAncestor(node, isHookContainer)
        if (!hookContainer) return
        const sourceCode = context.sourceCode

        context.report({
          node,
          messageId: 'default',
          suggest: [
            {
              messageId: 'fix1',
              *fix(fixer) {
                if (hookContainer.body.type !== AST_NODE_TYPES.BlockStatement) return
                yield fixer.insertTextBefore(
                  sourceCode.ast.body[0],
                  "import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';",
                )
                yield fixer.insertTextBefore(
                  hookContainer.body.body[0],
                  'const { _ } = useLingui();',
                )
                yield fixer.replaceText(node, `_(msg${sourceCode.getText(node.quasi)})`)
              },
            },
            {
              messageId: 'fix2',
              *fix(fixer) {
                if (!(context.filename.endsWith('.tsx') || context.filename.endsWith('.jsx')))
                  return
                const parser = getParserServices(context)
                if (!parser) return

                const fixable = canFixAsJSX(parser, sourceCode, node)
                if (!fixable) return
                const template = node.quasi
                if (
                  template.type !== AST_NODE_TYPES.TemplateLiteral &&
                  template.type !== AST_NODE_TYPES.Literal
                )
                  return

                yield fixer.insertTextBefore(
                  sourceCode.ast.body[0],
                  "import { Trans } from '@lingui/macro';",
                )
                const text = Array.from(
                  (function* gen() {
                    const text = [...template.quasis]
                    const expr = [...template.expressions]
                    yield `<Trans>`
                    while (true) {
                      if (text.length) yield text.shift().value.raw
                      if (expr.length) yield `{${sourceCode.getText(expr.shift())}}`
                      if (!text.length && !expr.length) break
                    }
                    yield `</Trans>`
                  })(),
                ).join('')
                const replacementNode =
                  node.parent.type === AST_NODE_TYPES.JSXExpressionContainer &&
                  node.parent.parent.type === AST_NODE_TYPES.JSXElement
                    ? node.parent
                    : node
                yield fixer.replaceText(replacementNode, text)
              },
            },
          ],
        })
      },
    }
  },
})

function findAncestor<T extends Node>(
  node: Node,
  callback: (node: Node) => node is T,
): T | undefined
function findAncestor(node: Node, callback: (node: Node) => boolean | 'quit'): Node | undefined
function findAncestor(node: Node, callback: (node: Node) => boolean | 'quit'): Node | undefined {
  let current: Node | undefined = node
  while (current) {
    const result = callback(current)
    if (result === 'quit') return
    if (result) return current
    current = current.parent
  }
  return undefined
}
function isHookContainer(
  node: Node,
): node is
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression {
  // a hook container is
  if (
    !(
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.FunctionExpression ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression
    )
  )
    return false

  // a function starts with use
  const name = getFunctionName(node)
  if (name.startsWith('use') && name[3].toLowerCase() !== name[3]) return true

  // or a function that contains a hook call
  if (!node.body || node.body.type !== AST_NODE_TYPES.BlockStatement) return false
  if (
    node.body.body.some((statement) => {
      if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
        const init = statement.declarations[0].init
        return init && isHookCall(init)
      } else if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
        return isHookCall(statement.expression)
      } else return false
    })
  )
    return true

  // or a function that wrapped with memo(...)
  if (node.parent.type === AST_NODE_TYPES.CallExpression) {
    if (node.parent.callee.type === AST_NODE_TYPES.Identifier) {
      return node.parent.callee.name === 'memo'
    }
    return false
  }

  // or a function that returns JSXElement
  const last = node.body.body.at(-1)
  return !!(
    last &&
    last.type === AST_NODE_TYPES.ReturnStatement &&
    last.argument?.type === AST_NODE_TYPES.JSXElement
  )
}
function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): string | null {
  if (
    node.parent.type === AST_NODE_TYPES.VariableDeclarator &&
    node.parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return node.parent.id.name
  }
  return node.id.name
}
function isHookCall(node: Node): boolean {
  return (
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    node.callee.name.startsWith('use')
  )
}
function canFixAsJSX(
  parser: ParserServices,
  sourceCode: SourceCode,
  node: TSESTree.TaggedTemplateExpression | TSESTree.CallExpression,
): boolean {
  // for some simple cases like
  // const str = cond ? t.call() : t.call2()
  // try to detect its usage
  const assignedVariable = findAncestor(node.parent, (node) => {
    switch (node.type) {
      case AST_NODE_TYPES.ConditionalExpression:
        return false
      case AST_NODE_TYPES.IfStatement:
        return node.parent.type === AST_NODE_TYPES.BlockStatement
      case AST_NODE_TYPES.BlockStatement:
        return (
          node.parent.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          node.parent.type === AST_NODE_TYPES.FunctionExpression ||
          node.parent.type === AST_NODE_TYPES.IfStatement
        )
      // if (expr) return t.call()
      case AST_NODE_TYPES.ReturnStatement:
        return false
      case AST_NODE_TYPES.FunctionExpression:
      case AST_NODE_TYPES.ArrowFunctionExpression:
        // const expr = useMemo(() => { ... })
        const fnLike = node as
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
        if (fnLike.parent.type !== AST_NODE_TYPES.CallExpression) return 'quit'
        if (
          fnLike.parent.arguments[0] === node &&
          fnLike.parent.callee.type === AST_NODE_TYPES.Identifier &&
          fnLike.parent.callee.name === 'useMemo'
        )
          return false
        return 'quit'
      case AST_NODE_TYPES.VariableDeclarator:
        return node.id.type === AST_NODE_TYPES.Identifier
      default:
        return 'quit'
    }
  })
  const tsNode = parser.esTreeNodeToTSNodeMap.get(node)
  const sourceFile = tsNode.getSourceFile()
  const checker = parser.program.getTypeChecker()

  if (assignedVariable) {
    const name =
      assignedVariable.type === AST_NODE_TYPES.VariableDeclarator &&
      assignedVariable.id.type === AST_NODE_TYPES.Identifier
        ? assignedVariable.id.name
        : undefined
    const references = sourceCode
      .getScope(assignedVariable)
      .variables.filter((x) => x.name === name)[0]?.references
    const isAllUseSiteAcceptsReactNode =
      references?.every((reference) => {
        if (reference.identifier.parent.type === AST_NODE_TYPES.VariableDeclarator) return true
        const tsNode = parser.esTreeNodeToTSNodeMap.get(reference.identifier)
        if (!ts.isExpression(tsNode)) return false
        return isReactNodeAssignableToContextualType(checker, tsNode.getSourceFile(), tsNode)
      }) ?? true
    if (isAllUseSiteAcceptsReactNode) {
      return true
    }
  } else if (isReactNodeAssignableToContextualType(checker, sourceFile, tsNode)) {
    return true
  }
  return false
}

// for code <Text>{t.xyz()}</Text> it's yes
// for code confirm(t.xyz()) it's no
function isReactNodeAssignableToContextualType(
  checker: TypeChecker,
  file: SourceFile,
  node: Expression,
) {
  const apparentType = checker.getContextualType(node)
  if (apparentType && !(apparentType.flags & ts.TypeFlags.Any)) {
    const reactNodeType = getReactNodeType(file, checker)
    // checker.isTypeAssignableTo is public in 5.4 beta
    // see https://github.com/microsoft/TypeScript/pull/56448
    // but this function is already here for a long time.
    // TODO: remove this after upgrade to ts 5.4 or newer
    if (reactNodeType && (checker as any).isTypeAssignableTo(reactNodeType, apparentType)) {
      return true
    }
  }
  return false
}

function getReactNodeType(position: ts.Node, checker: TypeChecker) {
  // same, public API since 5.4 beta, see https://github.com/microsoft/TypeScript/pull/56932
  // TODO: remove this after upgrade to ts 5.4 or newer
  const namespace = (checker as any).resolveName('React', position, ts.SymbolFlags.Namespace, false)
  if (!namespace) return
  const resolvedNamespace = checker.getTypeOfSymbol(namespace).getSymbol()
  if (!resolvedNamespace) return
  const reactNodeSymbol = resolvedNamespace.exports?.get('ReactNode' as ts.__String)
  if (!reactNodeSymbol) return
  return checker.getDeclaredTypeOfSymbol(reactNodeSymbol)
}

function getParserServices(
  context: Readonly<RuleContext<string, unknown[]>>,
): ParserServices | undefined {
  if (
    context.sourceCode.parserServices?.esTreeNodeToTSNodeMap == null ||
    context.sourceCode.parserServices.tsNodeToESTreeNodeMap == null
  ) {
    return undefined
  }
  if (context.sourceCode.parserServices.program == null) return undefined
  return context.sourceCode.parserServices as ParserServices
}
