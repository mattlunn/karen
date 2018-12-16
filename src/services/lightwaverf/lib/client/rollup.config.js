import babel from 'rollup-plugin-babel';

export default [{
  outputFormat: 'cjs',
}, {
  outputFormat: 'esm',
}].map(config => ({
  input: './src/index.js',
  output: {
    file: `dist/main.${config.outputFormat}.js`,
    format: config.outputFormat,
    name: 'lwrf-api-v2',
  },
  external: ['ws', 'uuid/v4', 'node-fetch'],
  plugins: [
    babel({
      presets: [['@babel/preset-env', { targets: { node: '8' }, modules: false }]],
    }),
  ],
}));
