// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    '@babel/preset-typescript',
    ['@babel/preset-react', {runtime: 'automatic'}], // Added for completeness, Next.js uses this
    'next/babel' // Next.js preset
  ]
};
