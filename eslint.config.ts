import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { base, react } from './packages/eslint-config/src/index.ts';

export default defineConfig(
  { ignores: ['**/dist/', '.pnpm-store/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  base,
  react,
);
