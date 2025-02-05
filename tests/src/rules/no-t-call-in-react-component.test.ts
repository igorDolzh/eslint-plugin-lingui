import { rule, name } from '../../../src/rules/no-t-call-in-react-component'
import { RuleTester, TestCaseError } from '@typescript-eslint/rule-tester'

describe('', () => {})

runTest(false)
runTest(true)
function runTest(withTypeAwareLint: boolean) {
  const ruleTester = new RuleTester({
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: withTypeAwareLint ? { allowDefaultProject: ['*.ts*'] } : undefined,
      },
    },
  })
  ruleTester.run(withTypeAwareLint ? name + '-with-type' : name, rule, {
    valid: [
      { code: 't`Hello`' },
      { code: 'function hello() { return t`Hello` }' },
      { code: 'function Hello() { return <p>{_(msg`Hello`)}</p> }' },
      { code: 'const a = () => t`Hello`' },
      { code: 'const a = () => t("Hello")' },
    ],

    invalid: [
      {
        name: 't`...` call in react hook',
        code: `
          function useHook() {
            return t\`Hello\`;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function useHook() {
            const { _ } = useLingui();return _(msg\`Hello\`);
          }`,
        ),
      },
      {
        name: 't`...` call in JSX children',
        code: `
          function Component() {
            const x = useY();
            return <p>
              {t\`Hello\`}
            </p>;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function Component() {
            const { _ } = useLingui();const x = useY();
            return <p>
              {_(msg\`Hello\`)}
            </p>;
          }`,
          `
          import { Trans } from '@lingui/macro';function Component() {
            const x = useY();
            return <p>
              <Trans>Hello</Trans>
            </p>;
          }`,
        ),
      },
      {
        name: 't`...` call in JSX children with interpolation',
        code: `
          function Component() {
            const x = useY();
            return <p>
              {t\`Hello \${name}\`}
            </p>;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function Component() {
            const { _ } = useLingui();const x = useY();
            return <p>
              {_(msg\`Hello \${name}\`)}
            </p>;
          }`,
          `
          import { Trans } from '@lingui/macro';function Component() {
            const x = useY();
            return <p>
              <Trans>Hello {name}</Trans>
            </p>;
          }`,
        ),
      },
      {
        name: 't`...` call in ternary in JSX children',
        code: `
          function Component() {
            const x = useY();
            return <p>
              {x ? t\`Hello\` : null}
            </p>;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function Component() {
            const { _ } = useLingui();const x = useY();
            return <p>
              {x ? _(msg\`Hello\`) : null}
            </p>;
          }`,
          `
          import { Trans } from '@lingui/macro';function Component() {
            const x = useY();
            return <p>
              {x ? <Trans>Hello</Trans> : null}
            </p>;
          }`,
        ),
      },
      {
        name: 't`...` call used as variable',
        code: `
          function Component() {
            const x = useY();
            const message = t\`Hello\`;
            return <p>
              {x ? message : null}
            </p>;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function Component() {
            const { _ } = useLingui();const x = useY();
            const message = _(msg\`Hello\`);
            return <p>
              {x ? message : null}
            </p>;
          }`,
          `
          import { Trans } from '@lingui/macro';function Component() {
            const x = useY();
            const message = <Trans>Hello</Trans>;
            return <p>
              {x ? message : null}
            </p>;
          }`,
        ),
      },
      {
        name: 't`...` call used as variable as string',
        code: `
          function Component() {
            const x = useY();
            const message = t\`Hello\`;
            confirm(message);
            return <p>
              {x ? message : null}
            </p>;
          }`,
        errors: fix(
          `
          import { useLingui } from '@lingui/react';import { msg } from '@lingui/macro';function Component() {
            const { _ } = useLingui();const x = useY();
            const message = _(msg\`Hello\`);
            confirm(message);
            return <p>
              {x ? message : null}
            </p>;
          }`,
        ),
      },
    ],
  })

  function fix(
    code1: string,
    code2?: string | undefined,
  ): readonly TestCaseError<'default' | 'fix1' | 'fix2'>[] {
    const fix1 = { messageId: 'fix1', output: code1 } as const
    return [
      {
        messageId: 'default',
        suggestions:
          withTypeAwareLint && code2 ? [fix1, { messageId: 'fix2', output: code2 }] : [fix1],
      },
    ]
  }
}
