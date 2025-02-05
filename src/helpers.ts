import { TSESTree } from '@typescript-eslint/utils'

import { DOM_TAGS, SVG_TAGS } from './constants'

/**
 * Queries for TemplateLiteral in TaggedTemplateExpression expressions:
 *
 * t`Hello`
 * msg`Hello`
 * defineMessage`Hello`
 */
export const LinguiTaggedTemplateExpressionMessageQuery =
  ':matches(TaggedTemplateExpression[tag.name=t], TaggedTemplateExpression[tag.name=msg], TaggedTemplateExpression[tag.name=defineMessage]) TemplateLiteral'

/**
 * Queries for TemplateLiteral | StringLiteral in CallExpression expressions:
 *
 * t({message: ``}); t({message: ''})
 * msg({message: ``}); msg({message: ''})
 * defineMessage({message: ``}); defineMessage({message: ''})
 */
export const LinguiCallExpressionMessageQuery =
  ':matches(CallExpression[callee.name=t], CallExpression[callee.name=msg], CallExpression[callee.name=defineMessage]) :matches(TemplateLiteral, Literal)'

/**
 * Queries for Trans
 *
 * <Trans></Trans>
 */
export const LinguiTransQuery = 'JSXElement[openingElement.name.name=Trans]'

export function isNativeDOMTag(str: string) {
  return DOM_TAGS.includes(str)
}

export function isSvgTag(str: string) {
  return SVG_TAGS.includes(str)
}

const blacklistAttrs = ['placeholder', 'alt', 'aria-label', 'value']
export function isAllowedDOMAttr(tag: string, attr: string, attributeNames: string[]) {
  if (isSvgTag(tag)) return true
  if (isNativeDOMTag(tag)) {
    return !blacklistAttrs.includes(attr)
  }

  return false
}

export function getNearestAncestor<Type extends TSESTree.AST_NODE_TYPES>(
  node: TSESTree.Node,
  type: Type,
): (TSESTree.Node & { type: Type }) | null {
  let temp = node.parent
  while (temp) {
    if (temp.type === type) {
      return temp as any
    }
    temp = temp.parent
  }
  return null
}

export const getText = (
  node: TSESTree.TemplateLiteral | TSESTree.Literal | TSESTree.JSXText,
): string => {
  if (node.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) {
    return node.quasis
      .map((quasis) => quasis.value.cooked)
      .join('')
      .trim()
  }

  return node.value.toString().trim()
}

export function getIdentifierName(jsxTagNameExpression: TSESTree.JSXTagNameExpression) {
  switch (jsxTagNameExpression.type) {
    case TSESTree.AST_NODE_TYPES.JSXIdentifier:
      return jsxTagNameExpression.name
    default:
      return null
  }
}

export function isLiteral(node: TSESTree.Node | undefined): node is TSESTree.Literal {
  return node?.type === TSESTree.AST_NODE_TYPES.Literal
}

export function isTemplateLiteral(
  node: TSESTree.Node | undefined,
): node is TSESTree.TemplateLiteral {
  return node?.type === TSESTree.AST_NODE_TYPES.TemplateLiteral
}

export function isIdentifier(node: TSESTree.Node | undefined): node is TSESTree.Identifier {
  return (node as TSESTree.Node)?.type === TSESTree.AST_NODE_TYPES.Identifier
}

export function isMemberExpression(
  node: TSESTree.Node | undefined,
): node is TSESTree.MemberExpression {
  return (node as TSESTree.Node)?.type === TSESTree.AST_NODE_TYPES.MemberExpression
}

export function isJSXAttribute(node: TSESTree.Node | undefined): node is TSESTree.JSXAttribute {
  return (node as TSESTree.Node)?.type === TSESTree.AST_NODE_TYPES.JSXAttribute
}

export function buildCalleePath(node: TSESTree.Expression) {
  let current = node

  const path: string[] = []

  const push = (exp: TSESTree.Node) => {
    if (isIdentifier(exp)) {
      path.push(exp.name)
    } else {
      path.push('$')
    }
  }

  while (isMemberExpression(current)) {
    push(current.property)
    current = current.object
  }

  push(current)

  return path.reverse().join('.')
}
