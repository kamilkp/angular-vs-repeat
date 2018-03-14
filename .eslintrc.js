module.exports = {
  parser: 'babel-eslint',
  rules: {
    'prefer-const': ['error', { destructuring: 'all' }],
    'semi-spacing': ['error', { 'before': false, 'after': true }],
    'space-infix-ops': ['error'],
    'keyword-spacing': ['error'],
    'comma-dangle': ['error', 'always-multiline'],
    'indent': ['error', 2, {
      FunctionDeclaration: { parameters: 'first' },
      FunctionExpression: { parameters: 'first' },
      SwitchCase: 1,
      MemberExpression: 'off',
    }],
  },
};
