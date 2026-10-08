# How ESLint bans code comments and blocks disabling the bans

Research for Niko464/conventions#3 (part of the map #2). Checked 2026-10-09 against ESLint 10.12.0 and ESLint 9.39.5, typescript-eslint 8.71.1 and `@eslint-community/eslint-plugin-eslint-comments` 4.8.1. Every behaviour marked **tested** was run in a scratch project on both ESLint 10 and ESLint 9 and gave the same result on both.

## Answer in short

1. **Comment ban:** no maintained plugin fits. `@niko464/eslint-config` ships its own rule, `@niko464/no-comments`. It is about 30 lines and works on ESLint 9 and 10.
2. **Blocking disables:** use two rules from `@eslint-community/eslint-plugin-eslint-comments`. `no-use` allows only `eslint-disable-next-line`. `no-restricted-disable` lists the guarded rules, its own plugin's rules included. Together they catch every bypass tested. The stricter option is `linterOptions.noInlineConfig: true`, which turns off every `eslint-*` comment.
3. **Effect ban:** a spread block of `no-restricted-imports` plus `no-restricted-syntax` does work. But when a consumer configures the same rule for the same file, the consumer's options replace the shared ones, they do not merge (**tested**). Ship the effect ban as a rule with its own ID, `@niko464/no-effect-hooks`. That way no consumer config can collide with it.

## 1. Comment ban: plugin or own rule

### Existing plugins

| Package | Status (npm, 2026-10) | Verdict |
|---|---|---|
| `eslint-plugin-no-comments` 1.2.1 | One maintainer. 1.2.0/1.2.1 (2026-04) added ESLint 9/10 peer support after a gap since 2022. | Not suitable. See below. |
| `eslint-plugin-ban-comments` 1.0.3 | One maintainer, published 2025-08, README documents only `.eslintrc`. | Broken on ESLint 10. |
| `eslint-plugin-comments` 1.0.0 | peer `eslint ^1.4.1` | Dead. |
| `@eslint-community/eslint-plugin-eslint-comments` | Maintained (see §2) | Only handles `eslint-*` directive comments, not ordinary comments. |
| ESLint core `no-warning-comments`, `no-inline-comments`, `multiline-comment-style` | Core | None bans all comments. `no-inline-comments` only bans trailing ones. |

`eslint-plugin-ban-comments` calls `context.getSourceCode()` ([source](https://www.npmjs.com/package/eslint-plugin-ban-comments?activeTab=code), `rules/ban-comments.js`). ESLint 10 removed that method ([migrate to v10, "Removal of deprecated context methods"](https://eslint.org/docs/latest/use/migrate-to-10.0.0)). **Tested:** on ESLint 10 the rule crashes with `TypeError: context.getSourceCode is not a function`. On ESLint 9 it flags `/// <reference>` and `prettier-ignore` by default. It also allows every `@ts-*` comment, `@ts-ignore` and `@ts-nocheck` included.

`eslint-plugin-no-comments` ([source](https://github.com/wisniewski94/eslint-plugin-no-comments), `index.js`) builds one regex: `^\s?(` + the `allow` entries joined with `|` + `)`. It tests that regex against `comment.value`. **Tested** problems:
- It flags the shebang line (`#!/usr/bin/env node`) and has no option to allow it.
- `allow` entries go into the regex unescaped. The allowlist entry `eslint` lets through every comment that starts with "eslint", inline rule config such as `/* eslint no-restricted-imports: "off" */` included.
- Its autofix deletes the comment. `eslint --fix` would then silently delete comments whose meaning the map says must first be moved into names, types, tests or `docs/`. `ban-comments` has the same autofix.

### Recommended: own rule in the package

ESLint gives every rule `context.sourceCode.getAllComments()`, which returns all `Line`, `Block` and `Shebang` comments ([custom rules, "Accessing comments"](https://eslint.org/docs/latest/extend/custom-rules#accessing-comments)). A comment in JSX, `{/* … */}`, is an ordinary `Block` comment, so the rule covers `.tsx` with no extra code. A `/** */` JSDoc comment is a `Block` whose value starts with `*`, so the rule bans it like any other comment.

```js
const DIRECTIVES = [
  /^\s*@ts-expect-error(?:\s|:|$)/,
  /^\s*prettier-ignore\s*$/,
  /^\s*eslint-disable-next-line(?:\s|$)/,
];
const TRIPLE_SLASH_REFERENCE = /^\/\s*<reference\s/;

const isDirective = (comment) =>
  comment.type === 'Shebang' ||
  (comment.type === 'Line' && TRIPLE_SLASH_REFERENCE.test(comment.value)) ||
  DIRECTIVES.some((pattern) => pattern.test(comment.value));

export const noComments = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      comment:
        'Comments are banned. Move the meaning into a name, a type or a test; put a lasting "why" in docs/ or an ADR.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!isDirective(comment)) context.report({ loc: comment.loc, messageId: 'comment' });
        }
      },
    };
  },
};
```

**Tested** on ESLint 9 and 10 with the typescript-eslint parser. The rule flags `//`, `/* */`, `/** */`, `// TODO`, `// @ts-ignore`, `// @ts-nocheck` and `/* global */`. It passes the shebang, `/// <reference types="node" />`, `// @ts-expect-error -- reason`, `// prettier-ignore` and `// eslint-disable-next-line rule -- reason`. It has no autofix, on purpose.

Design notes:
- The rule does not allowlist `@ts-ignore` or `@ts-nocheck`. typescript-eslint's `ban-ts-comment` also bans them in `recommended`. Its default for `ts-expect-error` is `'allow-with-description'`, which requires text after the directive ([source](https://typescript-eslint.io/rules/ban-ts-comment), defaultOptions in `ban-ts-comment.js` 8.71.1). The allowlist above lets that description through.
- Only `eslint-disable-next-line` is allowlisted, which matches §2. If Niko picks the `noInlineConfig` option from §2, drop that pattern so that an `eslint-*` comment is itself a banned comment.
- Keep the allowlist a fixed list inside the rule, not a rule option. A consumer then can't widen it from their own config.
- Test it with ESLint's `RuleTester`, one valid and one invalid case per allowlist entry.

Today the consumers use these directives: saas_wedding_venues has one `/// <reference` and one `eslint-disable-next-line`; baabda_town has one `@ts-expect-error` and one `eslint-disable-next-line` (`git grep`, 2026-10-09).

## 2. Stopping an `eslint-disable` from switching off the bans

### What ESLint itself offers

- Comments can turn rules off in two ways: the `eslint-disable`, `eslint-disable-line` and `eslint-disable-next-line` directives, and inline config such as `/* eslint no-alert: "off" */` ([configure rules, "Disabling rules"](https://eslint.org/docs/latest/use/configure/rules)).
- `linterOptions.noInlineConfig: true` makes ESLint ignore all inline configuration ([configuration files, "Disable inline configuration"](https://eslint.org/docs/latest/use/configure/configuration-files#disable-inline-configuration)). There is no per-rule version.
- `/* eslint-env */` is an error in ESLint 10 ([migrate to v10](https://eslint.org/docs/latest/use/migrate-to-10.0.0)).

### The plugin

`@eslint-community/eslint-plugin-eslint-comments` 4.8.1 was published 2026-09-12 through GitHub OIDC trusted publishing by the eslint-community org. Its peer range is `eslint ^6 || ^7 || ^8 || ^9 || ^10`, and it ships a flat config entry point (`/configs`) ([repo](https://github.com/eslint-community/eslint-plugin-eslint-comments), [npm](https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments)). The unscoped `eslint-plugin-eslint-comments` (mysticatea) has had no release since 2020. Don't use it.

- [`no-restricted-disable`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-restricted-disable.html) takes a list of rule-name globs. It reports an `eslint-disable*` comment that names a matching rule. In the source (`lib/rules/no-restricted-disable.js`) it also reports a blanket `eslint-disable` that names no rule. It does **not** look at inline config comments.
- [`no-use`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-use.html) reports every `eslint*` directive comment whose kind is not in `allow`, inline config and `global` included. It reports at column 0 (`utils.toForceLocation`), which puts the report outside the range of any directive on that line.
- `no-unused-disable` duplicates core `linterOptions.reportUnusedDisableDirectives` and patches `Linter#verify`. The core option is enough: baabda_town already sets it to `'error'`.

### Bypass matrix (**tested**, ESLint 10 and 9 gave the same results)

Setup: `@niko464/no-comments`, `no-restricted-imports` and `no-restricted-syntax` are all `error`. `reportUnusedDisableDirectives` is `'error'`.

| Attempt | `no-restricted-disable` only | + `no-use` allowing `-next-line` and `-line` | + `no-use` allowing only `-next-line` (recommended) | `noInlineConfig: true` |
|---|---|---|---|---|
| `// eslint-disable-next-line no-restricted-imports` | caught | caught | caught | caught (no effect) |
| `-next-line` that also names `no-restricted-disable` | caught (the report sits on the comment's own line, which `-next-line` does not cover) | caught | caught | caught |
| `/* eslint-disable */` blanket | caught | caught | caught | caught |
| `/* eslint-disable …/no-restricted-disable */` block | **missed** | caught by `no-use` | caught | caught |
| `/* eslint no-restricted-imports: "off", …: "off" */` inline config | **missed** | caught by `no-use` | caught | caught |
| `code; // eslint-disable-line no-restricted-imports, …/no-restricted-disable` | **missed: zero errors** | **missed** unless `no-use` is also named | caught by `no-use` at column 0 | caught |
| same `-line` comment that also names `…/no-use` and the comment rule | missed | caught only through "unused directive" | caught by `no-use` | caught |

Conclusions:
- `no-restricted-disable` alone leaks. Three forms get past it: block `eslint-disable` of the guard itself, inline config, and `eslint-disable-line`.
- `no-use` with `allow: ['eslint-disable-next-line']` closes all three. Its column-0 report can't be suppressed from the same line, and a block `eslint-disable` starting on that line doesn't cover column 0 either.
- `noInlineConfig: true` also closes everything. ESLint then prints a **warning** for each ignored directive ("has no effect because you have 'noInlineConfig' setting"). That is only a warning, but the directive does nothing. The cost: legitimate `eslint-disable-next-line` comments for unguarded rules stop working too. Every exception then has to live in `eslint.config.*` as a `files`-scoped block, as saas_wedding_venues already does for `components/ui/**`.
- A `linterOptions` set in the shared block survives a later consumer object that sets other `linterOptions` keys (**tested**: a consumer object with only `reportUnusedDisableDirectives` kept `noInlineConfig`). A consumer can always turn a rule or option off in their own config file. No lint setting can prevent that. It shows up in review of `eslint.config.*`.

**Recommendation:** use the plugin guard, with `no-use` allowing only `eslint-disable-next-line`. That keeps the one disable form both consumers use today, for unguarded rules. If Niko wants zero disable comments, use `noInlineConfig: true` and drop `eslint-disable-next-line` from the comment-ban allowlist. Either way, the guarded list is `@niko464/*` plus `@eslint-community/eslint-comments/*`. With the effect ban under its own ID (§3), core `no-restricted-imports` and `no-restricted-syntax` don't need guarding. Add them to the list anyway if the effect ban stays on the core rules.

## 3. Shipping the effect ban next to consumer rules

### The spread block works, but the options get replaced

The ESLint docs say: "When more than one configuration object specifies the same rule, the rule configuration is merged with the later object taking precedence". Their example shows that a later object with only a severity keeps the earlier options. A later object with options replaces them ([configure rules, "Rule configuration cascade"](https://eslint.org/docs/latest/use/configure/rules)).

**Tested:** the shared block set `no-restricted-imports` with `paths: [{ name: 'react', importNames: [effects] }]`. After it, a consumer block with `files: ['apps/api/**']` set its own `patterns`, the same shape as saas_wedding_venues' TenantPrisma rule. For a file under `apps/api`, `--print-config` showed only the consumer's `patterns`, and `import { useEffect } from 'react'` there was **not** reported. The arrays are not merged. `no-restricted-syntax` behaves the same way, so a consumer's own `no-restricted-syntax` would drop the `React.useEffect` selector.

Other problems with the core-rule version (**tested**):
- `no-restricted-imports` with `importNames` also reports `import * as React from 'react'` ("* import is invalid because …"). That bans the namespace import outright, even for `React.useState`.
- A selector like `MemberExpression[object.name='React']` misses `import R from 'react'; R.useLayoutEffect`.

### Options for handling the collision

1. **Own rule ID (recommended).** Ship `@niko464/no-effect-hooks` in the same plugin as `no-comments`. Its ID is unique, so no consumer config collides with it. It follows the bindings that the `react` import creates, so it catches any local name. A prototype (below) caught named imports, aliased imports (`useEffect as ue`), `React.useEffect`, `R.useLayoutEffect` and `React['useInsertionEffect']`. It allowed `React.useState`, `useEffectEvent` and `useSyncExternalStore`, on ESLint 9 and 10. Known gap: `const { useEffect } = React`. Add a `VariableDeclarator` check if that matters.
2. **Re-register the core rule under the package's namespace.** `builtinRules.get('no-restricted-imports')` from `eslint/use-at-your-own-risk`, exposed as `@niko464/no-effect-imports`. **Tested:** it works on 9 and 10 alongside a consumer's `no-restricted-imports`. But that entry point is explicitly unstable, and it keeps the namespace-import problem.
3. **Export data plus a helper.** Export `effectImportPaths`, and have consumers build one `no-restricted-imports` entry that includes it. This needs discipline in every consumer and every `files` block that sets the rule. It fails silently when someone forgets.

```js
const BANNED = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const memberName = (node) =>
  node.computed ? (node.property.type === 'Literal' ? node.property.value : null) : node.property.name;

export const noEffectHooks = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { effect: '{{name}} is banned. Use a @niko464/react-kit hook; a missing case gets a new hook there.' },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'react') return;
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported.name ?? spec.imported.value;
            if (BANNED.has(imported)) context.report({ node: spec, messageId: 'effect', data: { name: imported } });
            continue;
          }
          for (const variable of context.sourceCode.getDeclaredVariables(spec)) {
            for (const ref of variable.references) {
              const parent = ref.identifier.parent;
              if (parent.type === 'MemberExpression' && parent.object === ref.identifier) {
                const name = memberName(parent);
                if (BANNED.has(name)) context.report({ node: parent, messageId: 'effect', data: { name } });
              }
            }
          }
        }
      },
    };
  },
};
```

## Recommended flat-config sketch

Package `@niko464/eslint-config`, with `@eslint-community/eslint-plugin-eslint-comments` as a dependency and `eslint: ^9 || ^10` as a peer:

```js
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import { noComments } from './rules/no-comments.js';
import { noEffectHooks } from './rules/no-effect-hooks.js';

const plugin = {
  meta: { name: '@niko464/eslint-plugin' },
  rules: { 'no-comments': noComments, 'no-effect-hooks': noEffectHooks },
};

const GUARDED = ['@niko464/*', '@eslint-community/eslint-comments/*'];

export const comments = {
  name: '@niko464/comments',
  plugins: { '@niko464': plugin, '@eslint-community/eslint-comments': eslintComments },
  linterOptions: { reportUnusedDisableDirectives: 'error' },
  rules: {
    '@niko464/no-comments': 'error',
    '@eslint-community/eslint-comments/no-use': ['error', { allow: ['eslint-disable-next-line'] }],
    '@eslint-community/eslint-comments/no-restricted-disable': ['error', ...GUARDED],
  },
};

export const effects = {
  name: '@niko464/effects',
  plugins: { '@niko464': plugin },
  rules: { '@niko464/no-effect-hooks': 'error' },
};

export default [comments];
```

Both objects register the same `plugin` object under `@niko464`. ESLint accepts that, because the name maps to an identical object. **Tested:** this exact package sketch loads and enforces both bans on ESLint 10 and 9. Consumer (saas_wedding_venues, ESLint 10):

```js
import niko, { effects } from '@niko464/eslint-config';

export default tseslint.config(
  { ignores: [...] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['apps/api/src/**/*.ts'], rules: { 'no-restricted-imports': [/* TenantPrisma patterns, untouched */] } },
  { ...effects, files: ['apps/web/**/*.{ts,tsx}'] },
  ...niko,
  prettier,
);
```

Put `...niko` after the consumer's own blocks. A later consumer block can still override it, and review of `eslint.config.*` is the backstop for that. baabda_town already has `reportUnusedDisableDirectives: 'error'`. The shared block sets the same value, so nothing conflicts.

Rollout follows the map: the comment rule goes in last for each repo. Until then, consumers can spread `effects` and a `comments` variant with `@niko464/no-comments` at `'off'`, while the per-area comment tickets run.

## Side finding

ESLint 9 reached end of life on 2026-08-06 ([version support](https://eslint.org/version-support/)). `npm i eslint@9` now prints a deprecation warning. baabda_town runs `^9.39.0`. Both rules above work on 9.39.5, so this doesn't block the bans, but baabda_town should move to ESLint 10.

## Sources

- ESLint docs: [configure rules](https://eslint.org/docs/latest/use/configure/rules), [configuration files / linterOptions](https://eslint.org/docs/latest/use/configure/configuration-files), [custom rules](https://eslint.org/docs/latest/extend/custom-rules), [migrate to v10](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [version support](https://eslint.org/version-support/)
- `@eslint-community/eslint-plugin-eslint-comments` 4.8.1: [repo](https://github.com/eslint-community/eslint-plugin-eslint-comments), [`no-restricted-disable`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-restricted-disable.html), [`no-use`](https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-use.html), and the source in the npm tarball
- `eslint-plugin-no-comments` 1.2.1 and `eslint-plugin-ban-comments` 1.0.3: npm tarballs (`npm pack`) and npm registry metadata
- typescript-eslint 8.71.1: [`ban-ts-comment`](https://typescript-eslint.io/rules/ban-ts-comment), the `recommended` flat config
- Tests: a scratch project on ESLint 10.12.0 and 9.39.5 with typescript-eslint 8.71.1 parser, one file per bypass attempt
