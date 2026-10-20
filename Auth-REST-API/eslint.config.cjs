const tseslint = require('typescript-eslint');

const sharedRules = {
  'no-console': 'off',
  semi: ['error', 'always'],
  quotes: ['warn', 'single'],
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'warn',
};

module.exports = [
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      ...sharedRules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
