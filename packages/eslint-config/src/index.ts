import { plugin as shadcnPlugin } from '@shadcn/lint';
import tsParser from '@typescript-eslint/parser';
import type { ESLint, Linter } from 'eslint';
import { noComments } from './no-comments.ts';
import { noEffectHooks } from './no-effect-hooks.ts';

const plugin: ESLint.Plugin = {
  meta: { name: '@niko464/eslint-config' },
  rules: { 'no-comments': noComments, 'no-effect-hooks': noEffectHooks },
};

export const base: Linter.Config[] = [
  {
    name: '@niko464/base',
    plugins: { '@niko464': plugin },
    linterOptions: { noInlineConfig: true },
    rules: { '@niko464/no-comments': 'error' },
  },
];

export const react: Linter.Config[] = [
  {
    name: '@niko464/react',
    plugins: { '@niko464': plugin },
    rules: { '@niko464/no-effect-hooks': 'error' },
  },
];

export const shadcn: Linter.Config[] = [
  {
    name: '@niko464/shadcn',
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { shadcn: shadcnPlugin },
    rules: {
      'shadcn/no-restyle': 'error',
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/require-static-classes': 'error',
    },
  },
];
