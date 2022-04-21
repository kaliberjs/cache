module.exports = {
  testEnvironment: 'jest-environment-node',
  moduleFileExtensions: [
    'js'
  ],
  transform: {
    '^.+\\.js$': 'jest-esm-transformer'
  },
};
