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
  { files: ['packages/react-kit/src/**'], rules: { '@niko464/no-effect-hooks': 'off' } },
);
