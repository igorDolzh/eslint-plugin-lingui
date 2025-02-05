import {
  ESLintUtils,
  JSONSchema,
  ParserServicesWithTypeInformation,
  TSESTree,
} from '@typescript-eslint/utils'
import {
  buildCalleePath,
  getIdentifierName,
  getNearestAncestor,
  getText,
  isAllowedDOMAttr,
  isIdentifier,
  isJSXAttribute,
  isLiteral,
  isMemberExpression,
  isTemplateLiteral,
} from '../helpers'
import { createRule } from '../create-rule'
import * as micromatch from 'micromatch'
import type { UnionType, Type, Expression } from 'typescript'
import type { default as TypeScriptModule } from 'typescript'

let optionalTypeScript: typeof TypeScriptModule
try {
  optionalTypeScript = require('typescript')
} catch (err) {
  optionalTypeScript = null
}

type MatcherDef = string | { regex: { pattern: string; flags?: string } }

export type Option = {
  ignore?: string[]
  ignoreFunctions?: string[]
  ignoreNames?: MatcherDef[]
  ignoreMethodsOnTypes?: string[]
  useTsTypes?: boolean
}

const MatcherSchema: JSONSchema.JSONSchema4 = {
  oneOf: [
    {
      type: 'string',
    },
    {
      type: 'object',
      properties: {
        regex: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
            },
            flags: {
              type: 'string',
            },
          },
          required: ['pattern'],
          additionalProperties: false,
        },
      },
      required: ['regex'],
      additionalProperties: false,
    },
  ],
}

function createMatcher(patterns: MatcherDef[]) {
  const _patterns = patterns.map((item) =>
    typeof item === 'string' ? item : new RegExp(item.regex.pattern, item.regex.flags),
  )

  return (str: string) => {
    return _patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return pattern === str
      }

      return pattern.test(str)
    })
  }
}

function isAcceptableExpression(node: TSESTree.Node): boolean {
  switch (node.type) {
    case TSESTree.AST_NODE_TYPES.LogicalExpression:
    case TSESTree.AST_NODE_TYPES.BinaryExpression:
    case TSESTree.AST_NODE_TYPES.ConditionalExpression:
    case TSESTree.AST_NODE_TYPES.UnaryExpression:
    case TSESTree.AST_NODE_TYPES.TSAsExpression:
      return true
    default:
      return false
  }
}

function isAssignedToIgnoredVariable(
  node: TSESTree.Node,
  isIgnoredName: (name: string) => boolean,
): boolean {
  let current = node
  let parent = current.parent

  while (parent && isAcceptableExpression(parent)) {
    current = parent
    parent = parent.parent
  }

  if (!parent) return false

  if (parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator && parent.init === current) {
    const variableDeclarator = parent as TSESTree.VariableDeclarator
    if (isIdentifier(variableDeclarator.id) && isIgnoredName(variableDeclarator.id.name)) {
      return true
    }
  } else if (
    parent.type === TSESTree.AST_NODE_TYPES.AssignmentExpression &&
    parent.right === current
  ) {
    const assignmentExpression = parent as TSESTree.AssignmentExpression
    if (isIdentifier(assignmentExpression.left) && isIgnoredName(assignmentExpression.left.name)) {
      return true
    }
  }

  return false
}

function isAsConstAssertion(node: TSESTree.Node): boolean {
  const parent = node.parent
  if (parent?.type === TSESTree.AST_NODE_TYPES.TSAsExpression) {
    const typeAnnotation = parent.typeAnnotation
    return (
      typeAnnotation.type === TSESTree.AST_NODE_TYPES.TSTypeReference &&
      isIdentifier(typeAnnotation.typeName) &&
      typeAnnotation.typeName.name === 'const'
    )
  }
  return false
}

function isStringLiteralFromUnionType(
  node: TSESTree.Node,
  tsService: ParserServicesWithTypeInformation,
): boolean {
  try {
    const checker = tsService.program.getTypeChecker()
    const nodeTsNode = tsService.esTreeNodeToTSNodeMap.get(node)
    const TypeFlags = optionalTypeScript.TypeFlags

    const isStringLiteralType = (type: Type): boolean => {
      if (type.flags & TypeFlags.Union) {
        const unionType = type as UnionType
        return unionType.types.every(
          (t) =>
            t.flags & TypeFlags.StringLiteral ||
            t.flags & TypeFlags.NumberLike ||
            t.flags & TypeFlags.BooleanLike,
        )
      }
      return !!(type.flags & TypeFlags.StringLiteral)
    }

    // For arguments, check parameter type first
    if (node.parent?.type === TSESTree.AST_NODE_TYPES.CallExpression) {
      const callNode = node.parent
      const tsCallNode = tsService.esTreeNodeToTSNodeMap.get(callNode)

      const args = callNode.arguments as TSESTree.CallExpressionArgument[]
      const argIndex = args.findIndex((arg) => arg === node)

      const signature = checker.getResolvedSignature(tsCallNode)
      // Only proceed if we have a valid signature and the argument index is valid
      if (signature?.parameters && argIndex >= 0 && argIndex < signature.parameters.length) {
        const param = signature.parameters[argIndex]
        const paramType = checker.getTypeAtLocation(param.valueDeclaration)

        return isStringLiteralType(paramType)
      }
      // If we're here, it's a function call argument that didn't match our criteria
      return false
    }

    // Try to get the contextual type first
    const contextualType = checker.getContextualType(nodeTsNode as Expression)
    if (contextualType && isStringLiteralType(contextualType)) {
      return true
    }
  } catch (error) {}

  /* istanbul ignore next */
  return false
}

export const name = 'no-unlocalized-strings'
export const rule = createRule<Option[], string>({
  name,
  meta: {
    docs: {
      description:
        'Ensures all strings, templates, and JSX text are properly wrapped with `<Trans>`, `t`, or `msg` for translation.',
      recommended: 'error',
    },
    messages: {
      default: 'String not marked for translation. Wrap it with t``, <Trans>, or msg``.',
      forJsxText: 'String not marked for translation. Wrap it with <Trans>.',
      forAttribute:
        'Attribute not marked for translation. \n Wrap it with t`` from useLingui() macro hook.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          ignoreNames: {
            type: 'array',
            items: MatcherSchema,
          },
          ignoreFunctions: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          ignoreMethodsOnTypes: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          useTsTypes: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    type: 'problem' as const,
  },

  defaultOptions: [],

  create: function (context) {
    const {
      options: [option],
    } = context

    let tsService: ParserServicesWithTypeInformation
    if (option?.useTsTypes) {
      tsService = ESLintUtils.getParserServices(context, false)
    }
    const whitelists = [
      //
      /^[^\p{L}]+$/u, // ignore non word messages
      ...(option?.ignore || []).map((item) => new RegExp(item)),
    ]

    const calleeWhitelists = [
      // lingui callee
      'i18n._',
      't',
      'plural',
      'select',
      'selectOrdinal',
      'msg',
      ...(option?.ignoreFunctions || []),
    ].map((pattern) => micromatch.matcher(pattern))

    const isCalleeWhitelisted = (callee: string) =>
      calleeWhitelists.some((matcher) => matcher(callee))

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    function isTextWhiteListed(str: string) {
      return whitelists.some((item) => item.test(str))
    }

    function isValidFunctionCall({
      callee,
    }: TSESTree.CallExpression | TSESTree.NewExpression): boolean {
      switch (callee.type) {
        case TSESTree.AST_NODE_TYPES.MemberExpression: {
          if (isCalleeWhitelisted(buildCalleePath(callee))) {
            return true
          }

          // use power of TS compiler to exclude call on specific types, such Map.get, Set.get and so on
          if (tsService && isIdentifier(callee.property)) {
            for (const ignore of ignoredMethodsOnTypes) {
              const [type, method] = ignore.split('.')

              if (method === callee.property.name) {
                const typeObj = tsService.getTypeAtLocation(callee.object)

                if (type === typeObj?.getSymbol()?.name) {
                  return true
                }
              }
            }
          }

          return false
        }
        case TSESTree.AST_NODE_TYPES.Identifier: {
          return isCalleeWhitelisted(callee.name)
        }
        case TSESTree.AST_NODE_TYPES.CallExpression: {
          return (
            (isMemberExpression(callee.callee) || isIdentifier(callee.callee)) &&
            isValidFunctionCall(callee)
          )
        }
        /* istanbul ignore next */
        default:
          return false
      }
    }

    /**
     * Helper function to determine if a node is inside an ignored property.
     */
    function isInsideIgnoredProperty(node: TSESTree.Node): boolean {
      let parent = node.parent

      while (parent) {
        if (parent.type === TSESTree.AST_NODE_TYPES.Property) {
          const key = parent.key
          if (
            (isIdentifier(key) && isIgnoredName(key.name)) ||
            ((isLiteral(key) || isTemplateLiteral(key)) && isIgnoredName(getText(key)))
          ) {
            return true
          }
        }
        parent = parent.parent
      }

      return false
    }

    const ignoredJSXSymbols = ['&larr;', '&nbsp;', '&middot;']

    const ignoredMethodsOnTypes = option?.ignoreMethodsOnTypes || []

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------
    const visited = new WeakSet()

    function isIgnoredSymbol(str: string) {
      return ignoredJSXSymbols.some((name) => name === str)
    }

    const isIgnoredName = createMatcher(option?.ignoreNames || [])

    function isStringLiteral(node: TSESTree.Node | null | undefined): boolean {
      if (!node) return false

      switch (node.type) {
        case TSESTree.AST_NODE_TYPES.Literal:
          return typeof node.value === 'string'
        case TSESTree.AST_NODE_TYPES.TemplateLiteral:
          return Boolean(node.quasis)
        case TSESTree.AST_NODE_TYPES.JSXText:
          return true
        /* istanbul ignore next */
        default:
          return false
      }
    }

    const getAttrName = (node: TSESTree.JSXIdentifier | string) => {
      if (typeof node === 'string') {
        return node
      }

      /* istanbul ignore next */
      return node?.name
    }

    function isLiteralInsideJSX(node: TSESTree.Node): boolean {
      let parent = node.parent
      let insideJSXExpression = false

      while (parent) {
        if (parent.type === TSESTree.AST_NODE_TYPES.JSXExpressionContainer) {
          insideJSXExpression = true
        }
        if (parent.type === TSESTree.AST_NODE_TYPES.JSXElement && insideJSXExpression) {
          return true
        }
        parent = parent.parent
      }

      /* istanbul ignore next */
      return false
    }

    function isInsideTypeContext(node: TSESTree.Node): boolean {
      let parent = node.parent

      while (parent) {
        switch (parent.type) {
          case TSESTree.AST_NODE_TYPES.TSPropertySignature:
          case TSESTree.AST_NODE_TYPES.TSIndexSignature:
          case TSESTree.AST_NODE_TYPES.TSTypeAnnotation:
          case TSESTree.AST_NODE_TYPES.TSTypeLiteral:
          case TSESTree.AST_NODE_TYPES.TSLiteralType:
            return true
        }
        parent = parent.parent
      }

      return false
    }

    const processTextNode = (
      node: TSESTree.Literal | TSESTree.TemplateLiteral | TSESTree.JSXText,
    ) => {
      visited.add(node)

      const text = getText(node)
      if (!text || isIgnoredSymbol(text) || isTextWhiteListed(text)) {
        /* istanbul ignore next */
        return
      }

      // First, handle the JSXText case directly
      if (node.type === TSESTree.AST_NODE_TYPES.JSXText) {
        context.report({ node, messageId: 'forJsxText' })
        return
      }

      // If it's not JSXText, it might be a Literal or TemplateLiteral.
      // Check if it's inside JSX.
      if (isLiteralInsideJSX(node)) {
        // If it's a Literal/TemplateLiteral inside a JSXExpressionContainer within JSXElement,
        // treat it like JSX text and report with `forJsxText`.
        context.report({ node, messageId: 'forJsxText' })
        return
      }

      /* istanbul ignore next */
      // If neither JSXText nor a Literal inside JSX, fall back to default messageId.
      context.report({ node, messageId: 'default' })
    }

    const visitor: {
      [key: string]: (node: any) => void
    } = {
      'ImportDeclaration Literal'(node: TSESTree.Literal) {
        // allow (import abc form 'abc')
        visited.add(node)
      },

      'ExportAllDeclaration Literal'(node: TSESTree.Literal) {
        // allow export * from 'mod'
        visited.add(node)
      },

      'ExportNamedDeclaration > Literal'(node: TSESTree.Literal) {
        // allow export { named } from 'mod'
        visited.add(node)
      },

      [`:matches(${['Trans', 'Plural', 'Select', 'SelectOrdinal'].map((name) => `JSXElement[openingElement.name.name=${name}]`)}) :matches(TemplateLiteral, Literal, JSXText)`](
        node,
      ) {
        visited.add(node)
      },

      'JSXElement > JSXExpressionContainer > Literal'(node: TSESTree.Literal) {
        processTextNode(node)
      },

      'JSXElement > JSXExpressionContainer > TemplateLiteral'(node: TSESTree.TemplateLiteral) {
        processTextNode(node)
      },

      'JSXAttribute :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        const parent = getNearestAncestor<TSESTree.JSXAttribute>(
          node,
          TSESTree.AST_NODE_TYPES.JSXAttribute,
        )
        const attrName = getAttrName(parent?.name?.name)

        // allow <MyComponent className="active" />
        if (isIgnoredName(attrName)) {
          visited.add(node)
          return
        }

        const jsxElement = getNearestAncestor<TSESTree.JSXOpeningElement>(
          node,
          TSESTree.AST_NODE_TYPES.JSXOpeningElement,
        )
        const tagName = getIdentifierName(jsxElement?.name)
        const attributeNames = jsxElement?.attributes.map(
          (attr) => isJSXAttribute(attr) && getAttrName(attr.name.name),
        )
        if (isAllowedDOMAttr(tagName, attrName, attributeNames)) {
          visited.add(node)
          return
        }
      },

      'TSLiteralType Literal'(node: TSESTree.Literal) {
        // allow var a: Type['member'];
        visited.add(node)
      },
      // ─────────────────────────────────────────────────────────────────
      'ClassProperty > :matches(Literal,TemplateLiteral), PropertyDefinition > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal,
      ) {
        const { parent } = node
        if (
          (parent.type === TSESTree.AST_NODE_TYPES.Property ||
            parent.type === TSESTree.AST_NODE_TYPES.PropertyDefinition ||
            //@ts-ignore
            parent.type === 'ClassProperty') &&
          isIdentifier(parent.key) &&
          isIgnoredName(parent.key.name)
        ) {
          visited.add(node)
        }
      },

      'TSEnumMember > :matches(Literal,TemplateLiteral)'(node: TSESTree.Literal) {
        visited.add(node)
      },

      'VariableDeclarator > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        const parent = node.parent as TSESTree.VariableDeclarator

        // allow statements like const A_B = "test"
        if (isIdentifier(parent.id) && isIgnoredName(parent.id.name)) {
          visited.add(node)
        }
      },
      'MemberExpression[computed=true] > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        // obj["key with space"]
        visited.add(node)
      },
      "AssignmentExpression[left.type='MemberExpression'] > Literal"(node: TSESTree.Literal) {
        // options: { ignoreProperties: ['myProperty'] }
        // MyComponent.myProperty = "Hello"
        const assignmentExp = node.parent as TSESTree.AssignmentExpression
        const memberExp = assignmentExp.left as TSESTree.MemberExpression
        if (
          !memberExp.computed &&
          isIdentifier(memberExp.property) &&
          isIgnoredName(memberExp.property.name)
        ) {
          visited.add(node)
        }
      },
      'BinaryExpression > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        if (node.parent.type === TSESTree.AST_NODE_TYPES.BinaryExpression) {
          const {
            parent: { operator },
          } = node

          // allow name === 'String'
          if (operator !== '+') {
            visited.add(node)
          }
        }
      },

      'CallExpression :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        const parent = getNearestAncestor<TSESTree.CallExpression>(
          node,
          TSESTree.AST_NODE_TYPES.CallExpression,
        )

        if (isValidFunctionCall(parent)) {
          visited.add(node)
          return
        }
      },

      'NewExpression :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        const parent = getNearestAncestor<TSESTree.NewExpression>(
          node,
          TSESTree.AST_NODE_TYPES.NewExpression,
        )

        if (isValidFunctionCall(parent)) {
          visited.add(node)
          return
        }
      },

      'SwitchCase > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        visited.add(node)
      },

      'TaggedTemplateExpression > TemplateLiteral'(node: TSESTree.TemplateLiteral) {
        visited.add(node)
      },

      'TaggedTemplateExpression > TemplateLiteral :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal,
      ) {
        visited.add(node)
      },

      'JSXText:exit'(node: TSESTree.JSXText) {
        if (visited.has(node)) return
        processTextNode(node)
      },

      'Literal:exit'(node: TSESTree.Literal) {
        if (visited.has(node)) return
        const trimmed = `${node.value}`.trim()
        if (!trimmed) return

        if (isTextWhiteListed(trimmed)) {
          return
        }

        if (isAsConstAssertion(node)) {
          return
        }

        // Add check for object property key
        const parent = node.parent
        if (parent?.type === TSESTree.AST_NODE_TYPES.Property && parent.key === node) {
          return
        }

        // More thorough type checking when enabled
        if (option?.useTsTypes && tsService) {
          try {
            if (isStringLiteralFromUnionType(node, tsService)) {
              return
            }
          } catch (error) {
            // Ignore type checking errors
          }
        }

        if (isAssignedToIgnoredVariable(node, isIgnoredName)) {
          return
        }

        if (isInsideIgnoredProperty(node)) {
          return
        }

        if (isInsideTypeContext(node)) {
          return
        }

        context.report({ node, messageId: 'default' })
      },

      'TemplateLiteral:exit'(node: TSESTree.TemplateLiteral) {
        if (visited.has(node)) return
        const text = getText(node)

        if (!text || isTextWhiteListed(text)) return

        if (isAsConstAssertion(node)) {
          return
        }

        if (isAssignedToIgnoredVariable(node, isIgnoredName)) {
          return // Do not report this template literal
        }

        if (isInsideIgnoredProperty(node)) {
          return
        }

        context.report({ node, messageId: 'default' })
      },

      'AssignmentPattern > :matches(Literal,TemplateLiteral)'(
        node: TSESTree.Literal | TSESTree.TemplateLiteral,
      ) {
        const parent = node.parent as TSESTree.AssignmentPattern

        if (isIdentifier(parent.left) && isIgnoredName(parent.left.name)) {
          visited.add(node)
        }
      },
    }

    function wrapVisitor<
      Type extends TSESTree.Literal | TSESTree.TemplateLiteral | TSESTree.JSXText,
    >(visitor: { [key: string]: (node: Type) => void }) {
      const newVisitor: {
        [key: string]: (node: Type) => void
      } = {}
      Object.keys(visitor).forEach((key) => {
        const old: (node: Type) => void = visitor[key]

        newVisitor[key] = (node: Type) => {
          // make sure node is string literal
          if (!isStringLiteral(node)) return

          old(node)
        }
      })
      return newVisitor
    }

    return wrapVisitor<TSESTree.Literal>(visitor)
  },
})
