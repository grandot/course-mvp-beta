module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '18'
      },
      modules: 'commonjs'
    }]
  ],
  plugins: [],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          },
          modules: 'commonjs'
        }]
      ]
    }
  }
};