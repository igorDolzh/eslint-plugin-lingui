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

export function isUpperCase(str: string) {
  return /^[A-Z_-]+$/.test(str)
}

export function isNativeDOMTag(str: string) {
  return DOM_TAGS.includes(str)
}

export function isSvgTag(str: string) {
  return SVG_TAGS.includes(str)
}

export function containAllAttributes(attributeNames: string[]) {
  const attrs = ['value', 'other']
  return attrs.every((attr) => attributeNames.includes(attr))
}

export function isLinguiTags(str: string, attributeNames: string[]) {
  if (str === 'Trans') {
    return true
  }
  return ['Plural', 'Select'].includes(str) && containAllAttributes(attributeNames)
}

const blacklistAttrs = ['placeholder', 'alt', 'aria-label', 'value']
export function isAllowedDOMAttr(tag: string, attr: string, attributeNames: string[]) {
  if (isSvgTag(tag)) return true
  if (isNativeDOMTag(tag)) {
    return !blacklistAttrs.includes(attr)
  }
  if (isLinguiTags(tag, attributeNames)) {
    return true
  }
  return false
}

export function getNearestAncestor<Type>(node: any, type: string): Type | null {
  let temp = node.parent
  while (temp) {
    if (temp.type === type) {
      return temp as Type
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

export function hasAncestorWithName(
  node: TSESTree.JSXElement | TSESTree.TemplateLiteral | TSESTree.Literal | TSESTree.JSXText,
  name: string,
) {
  let p: TSESTree.Node = node.parent
  while (p) {
    switch (p.type) {
      case TSESTree.AST_NODE_TYPES.JSXElement:
        const identifierName = getIdentifierName(p?.openingElement?.name)
        if (identifierName === name) {
          return true
        }
      default:
    }

    p = p.parent
  }
  return false
}

export function getIdentifierName(jsxTagNameExpression: TSESTree.JSXTagNameExpression) {
  switch (jsxTagNameExpression.type) {
    case TSESTree.AST_NODE_TYPES.JSXIdentifier:
      return jsxTagNameExpression.name
    default:
      return null
  }
}
