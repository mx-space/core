/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require('ts-jest/utils')
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
const { compilerOptions } = require('../tsconfig.json')
const { $, chalk, cd } = require('zx')
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  globals: {
    isDev: process.env.NODE_ENV === 'development',
    $,
    chalk,
    cd,
  },
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    '^src$': '<rootDir>/src',
    '^~/(.*)$': '<rootDir>/src/$1',
    '^~$': '<rootDir>/src',
    '^test$': '<rootDir>/test',
  },
}
