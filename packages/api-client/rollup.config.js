// @ts-check
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { globbySync } from 'globby'
import path, { resolve } from 'path'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { terser } from 'rollup-plugin-terser'

import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]*$/, '')

const umdName = packageJson.name

const globals = {
  ...packageJson.devDependencies,
  // @ts-ignore
  ...(packageJson.dependencies || []),
}

const dir = 'dist'

/**
 * @type {Partial<import('rollup').RollupOptions>}
 */
const baseRollupConfig = {
  plugins: [
    nodeResolve(),
    commonjs({ include: 'node_modules/**' }),
    typescript({ tsconfig: './tsconfig.json', declaration: false }),

    // @ts-ignore
    peerDepsExternal(),
  ],
  external: [...Object.keys(globals), 'lodash', 'lodash-es'],
  treeshake: true,
}

/**
 * @returns {import('rollup').RollupOptions[]}
 */
const buildAdaptorConfig = () => {
  const paths = globbySync('./adaptors/*.ts')
  const filename = (path_) => path.parse(path_.split('/').pop()).name

  return paths.map((path) => {
    const libName = filename(path)
    execSync(
      `npx dts-bundle-generator -o dist/adaptors/${libName}.d.ts ${resolve(
        __dirname,
        'adaptors/',
      )}/${libName}.ts` + `  --external-types ${libName}`,
    )

    return {
      input: path,
      output: [
        {
          file: `${dir}/adaptors/${libName}.umd.js`,
          format: 'umd',
          sourcemap: true,
          name: umdName,
        },
        {
          file: `${dir}/adaptors/${libName}.umd.min.js`,
          format: 'umd',
          sourcemap: true,
          name: umdName,
          plugins: [terser()],
        },
        {
          file: `${dir}/adaptors/${libName}.cjs`,
          format: 'cjs',
          sourcemap: true,
        },
        {
          file: `${dir}/adaptors/${libName}.min.cjs`,
          format: 'cjs',
          sourcemap: true,
          plugins: [terser()],
        },
        {
          file: `${dir}/adaptors/${libName}.js`,
          format: 'es',
          sourcemap: true,
        },
        {
          file: `${dir}/adaptors/${libName}.min.js`,
          format: 'es',
          sourcemap: true,
          plugins: [terser()],
        },
      ],
      ...baseRollupConfig,
    }
  })
}

/**
 * @type {import('rollup').RollupOptions[]}
 */
const config = [
  {
    input: './index.ts',

    output: [
      {
        file: `${dir}/index.umd.js`,
        format: 'umd',
        sourcemap: true,
        name: umdName,
      },
      {
        file: `${dir}/index.umd.min.js`,
        format: 'umd',
        sourcemap: true,
        name: umdName,
        plugins: [terser()],
      },
      {
        file: `${dir}/index.cjs`,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: `${dir}/index.min.cjs`,
        format: 'cjs',
        sourcemap: true,
        plugins: [terser()],
      },
      {
        file: `${dir}/index.js`,
        format: 'es',
        sourcemap: true,
      },
      {
        file: `${dir}/index.min.js`,
        format: 'es',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    ...baseRollupConfig,
  },
  ...buildAdaptorConfig(),
]

// eslint-disable-next-line import/no-default-export
export default config
