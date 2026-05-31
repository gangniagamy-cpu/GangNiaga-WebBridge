module.exports = {
  ignorePatterns: ['extension/**', 'chunks/**', 'daemon/node_modules/**', 'mcp-server/node_modules/**'],
  env: {
    node: true,
    es2024: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-duplicate-imports': 'error',
  },
  overrides: [
    {
      files: ['mcp-server/**/*.js', 'facebook-mcp-server/**/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        node: true,
      },
    },
  ],
};
