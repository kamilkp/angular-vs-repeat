module.exports = {
  parser: 'babel-eslint',
  rules: {
    'prefer-const': ['error', { destructuring: 'all' }],
    'no-var': ['error'],
    'semi-spacing': ['error', { 'before': false, 'after': true }],
    'space-infix-ops': ['error'],
    'keyword-spacing': ['error'],
    'brace-style': ['error'],
    'no-else-return': ['error'],
    'semi': ['error'],
    'no-useless-concat': ['error'],
    'no-redeclare': ['error'],
    'no-undef': ['error'],
    'no-shadow': ['error'],
    'comma-dangle': ['error', 'always-multiline'],
    'indent': ['error', 2, {
      FunctionDeclaration: { parameters: 'first' },
      FunctionExpression: { parameters: 'first' },
      SwitchCase: 1,
      MemberExpression: 'off',
    }],
  },
  globals: {
    angular: false,
    document: false,
    window: false,
    expect: false,
    it: false,
    describe: false,
  }
};
