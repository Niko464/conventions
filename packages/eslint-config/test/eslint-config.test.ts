import { plugin as shadcnPlugin } from '@shadcn/lint';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import { base, react, shadcn } from '../src/index.ts';

const typescriptFiles: Linter.Config = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
};

const lint = async (
  code: string,
  config: Linter.Config[] = [typescriptFiles, ...base, ...react],
) => {
  const eslint = new ESLint({
    cwd: import.meta.dirname,
    overrideConfigFile: true,
    overrideConfig: config,
  });
  const [result] = await eslint.lintText(code, { filePath: 'sample.tsx' });
  return (result?.messages ?? []).map(({ ruleId, severity, message }) => ({
    ruleId,
    severity,
    message,
  }));
};

const ruleIds = async (code: string, config?: Linter.Config[]) =>
  (await lint(code, config)).map(({ ruleId }) => ruleId);

describe('base: @niko464/no-comments', () => {
  it.each([
    ['a shebang', '#!/usr/bin/env node\nexport const a = 1;\n'],
    ['a triple-slash reference', '/// <reference types="node" />\nexport const a = 1;\n'],
    [
      'a @ts-expect-error line',
      '// @ts-expect-error -- the type is wrong upstream\nexport const a: string = 1;\n',
    ],
    [
      'a @ts-expect-error in JSX',
      'export const a = (\n  <div>\n    {/* @ts-expect-error */}\n  </div>\n);\n',
    ],
    ['a prettier-ignore line', '// prettier-ignore\nexport const a = [1,0,\n  0,1];\n'],
    [
      'a prettier-ignore in JSX',
      'export const a = (\n  <div>\n    {/* prettier-ignore */}\n  </div>\n);\n',
    ],
  ])('allows %s', async (_, code) => {
    expect(await lint(code)).toEqual([]);
  });

  it.each([
    ['a line comment', '// the answer\nexport const a = 42;\n'],
    ['a block comment', '/* the answer */\nexport const a = 42;\n'],
    ['a JSDoc comment', '/** The answer. */\nexport const a = 42;\n'],
    ['a trailing comment', 'export const a = 42; // the answer\n'],
    ['a JSX comment', 'export const a = (\n  <div>\n    {/* the answer */}\n  </div>\n);\n'],
    ['a TODO', '// TODO: compute it\nexport const a = 42;\n'],
    ['a @ts-ignore', '// @ts-ignore\nexport const a: string = 1;\n'],
    ['a @ts-nocheck', '// @ts-nocheck\nexport const a = 42;\n'],
    ['a triple-slash comment that is not a reference', '/// the answer\nexport const a = 42;\n'],
  ])('reports %s', async (_, code) => {
    expect(await ruleIds(code)).toEqual(['@niko464/no-comments']);
  });

  it('says where the knowledge goes instead', async () => {
    const [message] = await lint('// the answer\nexport const a = 42;\n');
    expect(message).toEqual({
      ruleId: '@niko464/no-comments',
      severity: 2,
      message:
        'Comments are banned. Move what this comment says into a name, a type or a test, and put a "why" worth keeping in docs/ or an ADR.',
    });
  });

  it('reports every comment in a file', async () => {
    expect(await ruleIds('// one\nexport const a = 1; /* two */\n/** three */\n')).toEqual([
      '@niko464/no-comments',
      '@niko464/no-comments',
      '@niko464/no-comments',
    ]);
  });
});

describe('base: inline config is off', () => {
  it.each([
    [
      'eslint-disable-next-line',
      "// eslint-disable-next-line @niko464/no-effect-hooks\nimport { useEffect } from 'react';\n",
    ],
    [
      'eslint-disable-line',
      "import { useEffect } from 'react'; // eslint-disable-line @niko464/no-effect-hooks\n",
    ],
    ['a blanket eslint-disable', "/* eslint-disable */\nimport { useEffect } from 'react';\n"],
    [
      'inline rule config',
      '/* eslint @niko464/no-effect-hooks: "off", @niko464/no-comments: "off" */\nimport { useEffect } from \'react\';\n',
    ],
  ])('ignores %s, which is itself a banned comment', async (_, code) => {
    expect(await ruleIds(code)).toEqual(
      expect.arrayContaining(['@niko464/no-comments', '@niko464/no-effect-hooks']),
    );
  });
});

describe('react: @niko464/no-effect-hooks', () => {
  it.each([
    ['a named import', "import { useEffect } from 'react';\n"],
    ['an aliased import', "import { useLayoutEffect as useLayout } from 'react';\n"],
    ['a named useInsertionEffect import', "import { useInsertionEffect } from 'react';\n"],
    [
      'a default import member',
      "import React from 'react';\nexport const f = () => React.useEffect(() => undefined, []);\n",
    ],
    [
      'a namespace import member',
      "import * as R from 'react';\nexport const f = () => R.useLayoutEffect(() => undefined, []);\n",
    ],
    [
      'a computed member',
      "import * as React from 'react';\nexport const f = () => React['useInsertionEffect'](() => undefined, []);\n",
    ],
    [
      'a hook destructured off the namespace',
      "import * as React from 'react';\nconst { useEffect } = React;\nexport const f = () => useEffect(() => undefined, []);\n",
    ],
    [
      'an aliased hook destructured off the default import',
      "import R from 'react';\nconst { useLayoutEffect: useLayout } = R;\nexport const f = () => useLayout(() => undefined, []);\n",
    ],
    [
      'a member of default imported by name',
      "import { default as R } from 'react';\nexport const f = () => R.useEffect(() => undefined, []);\n",
    ],
    ['a re-export', "export { useEffect } from 'react';\n"],
    ['an aliased re-export', "export { useLayoutEffect as useLayout } from 'react';\n"],
  ])('reports %s', async (_, code) => {
    expect(await ruleIds(code)).toEqual(['@niko464/no-effect-hooks']);
  });

  it.each([
    [
      'useEffectEvent',
      "import { useEffectEvent } from 'react';\nexport const f = useEffectEvent;\n",
    ],
    [
      'useSyncExternalStore',
      "import { useSyncExternalStore } from 'react';\nexport const f = useSyncExternalStore;\n",
    ],
    [
      'React.useEffectEvent and React.useSyncExternalStore',
      "import * as React from 'react';\nexport const f = [React.useEffectEvent, React.useSyncExternalStore];\n",
    ],
    [
      'other hooks destructured off the namespace',
      "import React from 'react';\nconst { useState, useRef } = React;\nexport const f = [useState, useRef];\n",
    ],
    [
      'a useEffect from another module',
      "import { useEffect } from './my-effects';\nexport const f = useEffect;\n",
    ],
  ])('allows %s', async (_, code) => {
    expect(await lint(code)).toEqual([]);
  });

  it('names the replacements and the way to add one', async () => {
    const [message] = await lint("import { useLayoutEffect as useLayout } from 'react';\n");
    expect(message).toEqual({
      ruleId: '@niko464/no-effect-hooks',
      severity: 2,
      message:
        'useLayoutEffect is banned. Use useMountEffect, useEventListener or useInterval from @niko464/react-kit, a key, a ref callback, deriving the value during render, or Motion for animation. A case none of these covers becomes a new hook in @niko464/react-kit, through a PR.',
    });
  });

  it('is not part of the base block', async () => {
    expect(await lint("import { useEffect } from 'react';\n", [typescriptFiles, ...base])).toEqual(
      [],
    );
  });

  it("keeps reporting next to a consumer's own no-restricted-imports", async () => {
    const consumer: Linter.Config = {
      files: ['**/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          { paths: [{ name: 'lodash', message: 'Use the standard library.' }] },
        ],
      },
    };
    const code = "import { useEffect } from 'react';\nimport { map } from 'lodash';\n";
    expect(await ruleIds(code, [typescriptFiles, ...base, ...react, consumer])).toEqual([
      '@niko464/no-effect-hooks',
      'no-restricted-imports',
    ]);
    expect(await ruleIds(code, [typescriptFiles, consumer, ...base, ...react])).toEqual([
      '@niko464/no-effect-hooks',
      'no-restricted-imports',
    ]);
  });
});

describe('shadcn: @shadcn/lint', () => {
  it('turns on every @shadcn/lint rule as an error', async () => {
    const eslint = new ESLint({
      cwd: import.meta.dirname,
      overrideConfigFile: true,
      overrideConfig: shadcn,
    });
    const { rules } = (await eslint.calculateConfigForFile('sample.tsx')) as Linter.Config;
    const shadcnRules = Object.entries(rules ?? {})
      .filter(([id]) => id.startsWith('shadcn/'))
      .sort(([a], [b]) => a.localeCompare(b));
    expect(shadcnRules).toEqual(
      Object.keys(shadcnPlugin.rules)
        .sort()
        .map((name) => [`shadcn/${name}`, [2]]),
    );
    expect(shadcnRules).toHaveLength(6);
  });

  it('reports a raw colour class', async () => {
    expect(await ruleIds('export const a = <div className="bg-pink-500" />;\n', shadcn)).toEqual([
      'shadcn/no-raw-colors',
    ]);
  });
});
