module.exports = {
  extends: [
    'eslint-config-prettier'
  ],

  /**
   * @property {object} env - Base environments to enable associated globals.
   */
  env: {
    'browser': true,
    'mocha': true,
    'node': true,
    'es2020': true,
  },
  /**
   * @property {object} globals - Tree set of typical global variables, to avoid numerous `no-undef` errors.
   */
  globals: {
    '__services__': true,
    'assert': true,
    'CustomEvent': true,
    'Event': true,
    'expect': true,
    'sinon': true,
  },
  parserOptions: {
    ecmaFeatures: {
      "jsx": true,
    },
    ecmaVersion: 2020,
    parser: "@babel/eslint-parser",
    requireConfigFile: false,
    sourceType: "module",
  },
  /**
   * @property {object} plugins - Additional linter plugins for things we believe in.
   */
  plugins: [
    'eslint-plugin-bestpractices',
    'eslint-plugin-jsdoc',
    'eslint-plugin-prettier',
    'eslint-plugin-sonarjs',
  ],
  /**
   * @property {object} rules - Custom rule and additional linter configuration.
   */
  rules: {
    'bestpractices/no-eslint-disable': 'warn',

    'no-console': 'warn',
    'jsdoc/check-access': 'off',
    'jsdoc/check-alignment': 'warn',
    'jsdoc/check-examples': 'warn',
    'jsdoc/check-indentation': 'off',
    'jsdoc/check-param-names': 'warn',
    // 'jsdoc/check-property-names': 'warn',
    'jsdoc/check-syntax': 'warn',
    'jsdoc/check-tag-names': 'warn',
    'jsdoc/check-types': 'warn',
    // 'jsdoc/check-values': 'warn',
    // 'jsdoc/empty-tags': 'warn',
    'jsdoc/implements-on-classes': 'warn',
    'jsdoc/match-description': 'warn',
    'jsdoc/newline-after-description': 'off',
    'jsdoc/no-types': 'off',
    'jsdoc/no-undefined-types': 'off', // 2020-01-23: This was broken in eslint-plugin-jsdoc#8 in 2019-06, and hasn't gotten much better. Disabled, for now. Check back later.
    'jsdoc/require-description-complete-sentence': 'off',
    'jsdoc/require-description': 'warn',
    'jsdoc/require-example': 'off',
    'jsdoc/require-file-overview': 'off',
    'jsdoc/require-hyphen-before-param-description': 'warn',
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param-description': 'warn',
    'jsdoc/require-param-name': 'warn',
    'jsdoc/require-param-type': 'warn',
    'jsdoc/require-param': 'warn',
    // 'jsdoc/require-property-description': 'warn',
    // 'jsdoc/require-property-name': 'warn',
    // 'jsdoc/require-property-type': 'warn',
    // 'jsdoc/require-property': 'warn',
    'jsdoc/require-returns-check': 'warn',
    'jsdoc/require-returns-description': 'warn',
    'jsdoc/require-returns-type': 'warn',
    'jsdoc/require-returns': 'warn',
    'jsdoc/require-throws': 'off',
    'jsdoc/valid-types': 'warn',

    // These rules went much more strict after updating on 2020-01-23, and are decreased in urgency due to the impact there would be on the existing codebase
    'array-bracket-spacing': 'warn',
    'lines-between-class-members': 'warn',
    'no-case-declarations': 'off',
    'no-else-return': 'off',
    'no-extra-semi': 'error',
    'no-invalid-this': 'off',
    'no-prototype-builtins': 'warn',
    'no-shadow': 'warn',
    'no-undefined': 'warn',
    'no-warning-comments': ['warn', { 'terms': ['FIXME', 'TODO', 'TO-DO', 'HACK', 'HERE BE DRAGONS'], 'location': 'anywhere' }],
    'object-curly-newline': 'warn',
    'object-curly-spacing': 'off',
    'prefer-const': 'warn',
    'quote-props': 'off',
    'quotes': 'off',
    'semi': ['error', 'never'],


    'sonarjs/cognitive-complexity': ["warn", 25],
    'sonarjs/max-switch-cases': ["warn", 10],
    'sonarjs/no-all-duplicated-branches': 'warn',
    'sonarjs/no-collapsible-if': 'warn',
    'sonarjs/no-duplicate-string': 'warn',
    'sonarjs/no-duplicated-branches': 'warn',
    'sonarjs/no-element-overwrite': 'warn',
    'sonarjs/no-empty-collection': 'warn',
    'sonarjs/no-extra-arguments': 'warn',
    'sonarjs/no-gratuitous-expressions': 'warn',
    'sonarjs/no-identical-conditions': 'warn',
    'sonarjs/no-identical-expressions': 'warn',
    'sonarjs/no-identical-functions': 'warn',
    'sonarjs/no-inverted-boolean-check': 'off',
    'sonarjs/no-nested-switch': 'warn',
    'sonarjs/no-nested-template-literals': 'warn',
    'sonarjs/no-one-iteration-loop': 'warn',
    'sonarjs/no-redundant-boolean': 'warn',
    'sonarjs/no-redundant-jump': 'warn',
    'sonarjs/no-same-line-conditional': 'warn',
    'sonarjs/no-small-switch': 'warn',
    'sonarjs/no-unused-collection': 'warn',
    'sonarjs/no-use-of-empty-return-value': 'warn',
    'sonarjs/no-useless-catch': 'warn',
    'sonarjs/non-existent-operator': 'warn',
    'sonarjs/prefer-immediate-return': 'warn',
    'sonarjs/prefer-object-literal': 'warn',
    'sonarjs/prefer-single-boolean-return': 'warn',
    'sonarjs/prefer-while': 'warn',

  }
}
