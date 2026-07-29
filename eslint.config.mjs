import pluginVue from 'eslint-plugin-vue'

export default [
  ...pluginVue.configs['flat/recommended'],
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
