import { rule, name, Option } from '../../../src/rules/no-unlocalized-strings'
import { RuleTester } from '@typescript-eslint/rule-tester'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      projectService: {
        allowDefaultProject: ['*.ts*'],
      },
    },
  },
})

const defaultError = [{ messageId: 'default' }]
const jsxTextError = [{ messageId: 'forJsxText' }]
const upperCaseRegex = '^[A-Z_-]+$'
const ignoreUpperCaseName = { ignoreNames: [{ regex: { pattern: upperCaseRegex } }] }

ruleTester.run(name, rule, {
  valid: [
    // ==================== TypeScript Types with Ignored Methods ====================
    {
      name: 'allows Map methods with string literals',
      code: 'const myMap = new Map(); myMap.get("foo with spaces"); myMap.has("bar with spaces");',
      options: [{ useTsTypes: true, ignoreMethodsOnTypes: ['Map.get', 'Map.has'] }],
    },
    {
      name: 'allows interface method with string literal when type matches',
      code: 'interface Foo { get: (key: string) => string }; const foo: Foo; foo.get("string with spaces");',
      options: [{ useTsTypes: true, ignoreMethodsOnTypes: ['Foo.get'] }],
    },
    {
      name: 'allows interface method as type assertion',
      code: 'interface Foo {get: (key: string) => string}; (foo as Foo).get("string with spaces")',
      options: [{ useTsTypes: true, ignoreMethodsOnTypes: ['Foo.get'] }],
    },

    // ==================== Assignment Pattern ====================
    {
      name: 'allows string literal in assignment pattern with ignored name',
      code: 'function test({ MY_PARAM = "default value" }) {}',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'allows template literal in assignment pattern with ignored name',
      code: 'function test({ MY_PARAM = `default value` }) {}',
      options: [ignoreUpperCaseName],
    },

    // ==================== Basic i18n Usage ====================
    {
      name: 'allows i18n template literals with interpolation',
      code: 'i18n._(t`Hello ${nice}`)',
    },
    {
      name: 'allows i18n function with template message',
      code: 't(i18n)({ message: `Hello ${name}` })',
    },
    {
      name: 'allows i18n with template literal',
      code: 'i18n._(`hello`)',
    },
    {
      name: 'allows i18n with string literal',
      code: 'i18n._("hello")',
    },

    // ==================== Non-Word Strings ====================
    {
      name: 'ignores numeric strings',
      code: 'const test = "1111"',
    },
    {
      name: 'ignores special character strings',
      code: 'const special = `0123456789!@#$%^&*()_+|~-=\\`[]{};\':",./<>?`;',
    },
    {
      name: 'accepts TSAsExpression assignment',
      code: 'const unique = "this-is-unique" as const;',
    },
    {
      name: 'accepts TSAsExpression assignment template literal',
      code: 'const unique = `this-is-unique` as const;',
    },
    {
      name: 'accepts TSAsExpression in array',
      code: 'const names = ["name" as const, "city" as const];',
    },
    {
      name: 'accepts TSAsExpression in object',
      code: 'const paramsByDropSide = { top: "above" as const, bottom: "below" as const };',
    },

    // ==================== Template Literals with Variables ====================
    {
      name: 'allows template literal with single variable',
      code: 'const t = `${BRAND_NAME}`',
    },
    {
      name: 'allows template literal with multiple variables',
      code: 'const t = `${BRAND_NAME}${BRAND_NAME}`',
    },
    {
      name: 'allows template literal with variables and spaces',
      code: 'const t = ` ${BRAND_NAME} ${BRAND_NAME} `',
    },
    {
      name: 'accepts standalone TemplateLiteral in uppercase variable',
      code: 'const MY_TEMPLATE = `Hello world`',
      options: [ignoreUpperCaseName],
    },

    // ==================== Class Properties ====================
    {
      name: 'allows string in class property with ignored name',
      code: 'class MyClass { MY_PROP = "Hello World" }',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'allows string in property definition with ignored name',
      code: 'class MyClass { static MY_STATIC = "Hello World" }',
      options: [ignoreUpperCaseName],
    },

    // ==================== Member Expressions ====================
    {
      name: 'allows computed member expression with string literal',
      code: 'obj["key with spaces"] = value',
    },
    {
      name: 'allows declaring object keys in quotes',
      code: 'const styles = { ":hover" : { color: theme.brand } }',
    },
    {
      name: 'allows computed member expression with template literal',
      code: 'obj[`key with spaces`] = value',
    },
    {
      name: 'allow union types with string literals',
      code: 'type Action = "add" | "remove"; function doAction(action: Action) {} doAction("add");',
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allow inline union types with string literals',
      code: 'function doAction(action: "add" | "remove") {} doAction("add");',
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allow union types with optional string literals',
      code: 'type Action = "add" | "remove" | undefined; function doAction(action: Action) {} doAction("add");',
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows direct union type variable assignment',
      code: 'let value: "a" | "b"; value = "a";',
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows direct union type in object',
      code: 'type Options = { mode: "light" | "dark" }; const options: Options = { mode: "light" };',
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal in function parameter with union type',
      code: `
        function test(param: "a" | "b") {}
        test("a");
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal in function parameter with union type with undefined + null',
      code: `
        function test(param: "a" | "b" | undefined | null) {}
        test("a");
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal in function parameter with union type with numbers',
      code: `
        function test(param: "a" | "b" | 1000) {}
        test("a");
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal in function parameter with union type with booleans',
      code: `
        function test(param: "a" | "b" | false) {}
        test("a");
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal in method parameter with union type',
      code: `
        class Test {
          method(param: "x" | "y") {}
        }
        new Test().method("x");
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows string literal union in multi-parameter function',
      code: `
        function test(first: string, second: "yes" | "no") {
          test(first, "yes"); // second argument should be fine
        }
      `,
      options: [{ useTsTypes: true }],
    },
    {
      name: 'allows assignment to ignored member expression',
      code: 'myObj.MY_PROP = "Hello World"',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'ignores property key when name is in ignored list',
      code: `const obj = { ignoredKey: "value" };`,
      options: [{ ignoreNames: ['ignoredKey'] }],
    },

    // ==================== Switch Cases ====================
    {
      name: 'allows string literals in switch cases',
      code: 'switch(value) { case "hello": break; case `world`: break; default: break; }',
    },

    // ==================== Tagged Template Expressions ====================
    {
      name: 'allows literals in tagged template expressions',
      code: 'styled.div`color: ${"red"};`',
    },
    {
      name: 'allows template literals in tagged template expressions',
      code: 'styled.div`color: ${`red`};`',
    },

    // ==================== Ignored Functions ====================
    {
      name: 'allows whitelisted function calls',
      code: 'hello("Hello")',
      options: [{ ignoreFunctions: ['hello'] }],
    },
    {
      name: 'allows whitelisted constructor calls',
      code: 'new Error("hello")',
      options: [{ ignoreFunctions: ['Error'] }],
    },
    {
      name: 'allows nested whitelisted function calls',
      code: 'custom.wrapper()({message: "Hello!"})',
      options: [{ ignoreFunctions: ['custom.wrapper'] }],
    },
    {
      name: 'allows whitelisted methods with wildcards',
      code: 'getData().two.three.four("Hello")',
      options: [{ ignoreFunctions: ['*.three.four'] }],
    },

    // ==================== Console Methods ====================
    {
      name: 'allows console methods',
      code: 'console.log("Hello"); console.error("Hello");',
      options: [{ ignoreFunctions: ['console.*'] }],
    },
    {
      name: 'allows multilevel methods',
      code: 'context.headers.set("Hello"); level.context.headers.set("Hello");',
      options: [{ ignoreFunctions: ['*.headers.set'] }],
    },

    // ==================== JSX Attributes ====================
    {
      name: 'allows className attribute',
      code: '<div className="primary"></div>',
    },
    {
      name: 'allows className with template literal',
      code: '<div className={`primary`}></div>',
    },
    {
      name: 'allows className with conditional',
      code: '<div className={a ? "active": "inactive"}></div>',
    },

    // ==================== SVG Elements ====================
    {
      name: 'allows SVG viewBox attribute',
      code: '<svg viewBox="0 0 20 40"></svg>',
    },
    {
      name: 'allows SVG path data',
      code: '<path d="M10 10" />',
    },
    {
      name: 'allows SVG circle attributes',
      code: '<circle width="16px" height="16px" cx="10" cy="10" r="2" fill="red" />',
    },

    // ==================== Translation Components ====================
    {
      name: 'allows basic Trans component',
      code: '<Trans>Hello</Trans>',
    },
    {
      name: 'allows nested Trans component',
      code: '<Trans><Component>Hello</Component></Trans>',
    },
    {
      name: 'allows Plural component',
      code: "<Plural value={5} one='# Book' other='# Books' />",
    },
    {
      name: 'allows Select component',
      code: "<Select male='Ola!' other='Hello' />",
    },

    // ==================== TypeScript Types ====================
    {
      name: 'allows interface with HTML attributes',
      code: "interface FieldLabelProps { 'htmlFor': string; }",
    },
    {
      name: 'allows interface with ARIA attributes',
      code: "interface FieldInputProps { 'aria-required': boolean; }",
    },
    {
      name: 'allows string literal union types',
      code: "type ButtonVariant = 'primary' | 'secondary' | 'tertiary';",
    },
    {
      name: 'allows enum with string values',
      code: "enum StepType { Address = 'Address' }",
    },
    {
      name: 'allows exact string match in ignored names',
      code: 'const test = "Hello world"',
      options: [{ ignoreNames: ['test'] }],
    },

    // ==================== Acceptable Expressions with Ignored Names ====================
    {
      name: 'accepts TemplateLiteral in uppercase',
      code: 'const MY_TEMPLATE = `Hello ${name}`',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts LogicalExpression in uppercase',
      code: 'const MY_LOGICAL = shouldGreet && "Hello"',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts BinaryExpression in uppercase',
      code: 'const MY_BINARY = "Hello" + count',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts ConditionalExpression in uppercase',
      code: 'const MY_CONDITIONAL = isGreeting ? "Hello" : count',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts UnaryExpression in uppercase',
      code: 'const MY_UNARY = !"Hello"',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts TSAsExpression in uppercase',
      code: 'const MY_AS = "Hello" as string',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts complex expressions in uppercase',
      code: 'const MY_COMPLEX = !("Hello") || `World ${name}`',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts LogicalExpression assignment in uppercase',
      code: 'let MY_VAR; MY_VAR = shouldGreet && "Hello";',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts conditional in uppercase property',
      code: 'const obj = { MY_PROP: someCondition ? "Hello" : count };',
      options: [ignoreUpperCaseName],
    },
    {
      name: 'accepts nullish coalescing in uppercase',
      code: 'const MY_NULLISH = greeting ?? "Hello"',
      options: [ignoreUpperCaseName],
    },

    // ==================== Import/Export ====================
    {
      name: 'allows string literals in imports',
      code: 'import name from "hello";',
    },
    {
      name: 'allows string literals in exports',
      code: 'export * from "hello_export_all";',
    },
    {
      name: 'allows string literals in named exports',
      code: 'export { named } from "module-name";',
    },
  ],

  invalid: [
    // ==================== Basic String Violations ====================
    {
      name: 'detects unlocalized string literal',
      code: 'const message = "Select tax code"',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized string literal with types active',
      code: 'const message = "Select tax code"',
      options: [{ useTsTypes: true }],
      errors: defaultError,
    },
    {
      name: 'detects unlocalized export',
      code: 'export const text = "hello string";',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized template literal',
      code: 'const a = `Hello ${nice}`',
      errors: defaultError,
    },
    {
      name: 'handles nested TSAsExpression string literals',
      code: 'const test = ("hello" as any as string)',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized multiline template literal',
      code: 'const message = `Hello \n World`;',
      errors: defaultError,
    },

    // ==================== Member Expressions ====================
    {
      name: 'allows dynamic property key',
      code: "const obj = { [keyName]: 'value' };",
      errors: defaultError,
    },

    // ==================== JSX Violations ====================
    {
      name: 'detects unlocalized JSX text with HTML entity',
      code: '<div>hello &nbsp; </div>',
      errors: jsxTextError,
    },
    {
      name: 'detects unlocalized JSX expression',
      code: '<div>{"Hello World!"}</div>',
      errors: jsxTextError,
    },
    {
      name: 'detects unlocalized template literal in JSX expression container',
      code: '<div>{`Hello world`}</div>',
      errors: jsxTextError,
    },
    {
      name: 'detects unlocalized string in nested JSX',
      code: `<div><span>{"Hello World!"}</span></div>`,
      errors: [{ messageId: 'forJsxText' }],
    },

    // ==================== Non-Latin Character Support ====================
    {
      name: 'detects unlocalized Japanese text',
      code: 'const a = "こんにちは"',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized Cyrillic text',
      code: 'const a = "Привет"',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized Chinese text',
      code: 'const a = "添加筛选器"',
      errors: defaultError,
    },

    // ==================== Component Attributes ====================
    {
      name: 'detects unlocalized alt text',
      code: '<img src="./image.png" alt="some image" />',
      errors: defaultError,
    },
    {
      name: 'detects unlocalized ARIA label',
      code: '<button aria-label="Close" type="button" />',
      errors: defaultError,
    },
    {
      name: 'handles JSX identifier attribute correctly',
      code: '<div aria-label={`Hello World`} />',
      errors: defaultError,
    },

    // ==================== Acceptable Expression Violations ====================
    {
      name: 'detects LogicalExpression in lowercase',
      code: 'const myLowerCase = shouldGreet && "Hello"',
      options: [ignoreUpperCaseName],
      errors: defaultError,
    },
    {
      name: 'detects ConditionalExpression in camelCase',
      code: 'const camelCase = isGreeting ? "Hello" : count',
      options: [ignoreUpperCaseName],
      errors: defaultError,
    },
    {
      name: 'detects BinaryExpression in lowercase',
      code: 'let myVar; myVar = "Hello" + count;',
      options: [ignoreUpperCaseName],
      errors: defaultError,
    },
    {
      name: 'detects expression in lowercase property',
      code: 'const obj = { lowerProp: !("Hello" as string) };',
      options: [ignoreUpperCaseName],
      errors: defaultError,
    },
    {
      name: 'handles type assertions with string literals',
      code: "const test = ('hello' as unknown as string);",
      options: [ignoreUpperCaseName],
      errors: [{ messageId: 'default' }],
    },
    {
      name: 'reports constants when missing TSASExpression in object',
      code: 'const paramsByDropSide = { top: "above", bottom: "below" };',
      errors: [{ messageId: 'default' }, { messageId: 'default' }],
    },

    // ==================== TypeScript Function Parameters ====================
    {
      name: 'handles function call with no parameters',
      code: `
        function noParams() {}
        noParams("this should error");
      `,
      options: [{ useTsTypes: true }],
      errors: [{ messageId: 'default' }],
    },
    {
      name: 'handles function call with wrong number of arguments',
      code: `
        function oneParam(p: "a" | "b") {}
        oneParam("a", "this should error");
      `,
      options: [{ useTsTypes: true }],
      errors: [{ messageId: 'default' }],
    },
    {
      name: 'handles function call where parameter is not a string literal type',
      code: `
        function stringParam(param: string) {}
        stringParam("should report error");
      `,
      options: [{ useTsTypes: true }],
      errors: defaultError,
    },
    {
      name: 'handles method call where signature cannot be resolved',
      code: `
        const obj = { method: (x: any) => {} };
        obj["method"]("should report error");
      `,
      options: [{ useTsTypes: true }],
      errors: defaultError,
    },
    {
      name: 'requires translation for non-union string parameters',
      code: `
        function test(first: string, second: "yes" | "no") {
          test("needs translation", "yes");
        }
      `,
      options: [{ useTsTypes: true }],
      errors: [{ messageId: 'default' }],
    },
    {
      name: 'handles type system error gracefully',
      code: `
        // This should cause type system issues but not crash
        const x = (unknown as any).nonexistent("test");
      `,
      options: [{ useTsTypes: true }],
      errors: [{ messageId: 'default' }],
    },
  ],
})

// ==================== Default Ignore Regex Tests ====================
describe('Default ignore regex', () => {
  const regex = '^(?![A-Z])\\S+$'

  test.each([
    ['hello', true, 'allows lowercase word'],
    ['helloMyVar', true, 'allows camelCase'],
    ['package.json', true, 'allows filenames'],
    ['./src/**/*.test*', true, 'allows paths'],
    ['camel_case', true, 'allows snake_case'],
    ['Hello', false, 'blocks capitalized words'],
    ['hello world', false, 'blocks strings with spaces'],
    ['Hello World', false, 'blocks title case with spaces'],
  ])('%s => %s (%s)', (input, expected, description) => {
    expect(new RegExp(regex).test(input)).toBe(expected)
  })
})
