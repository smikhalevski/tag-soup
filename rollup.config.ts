import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import packageJson from './package.json' assert { type: 'json' };

export default [
  {
    input: './src/main/index.ts',
    output: [
      {
        file: './lib/index.js',
        format: 'cjs',
      },
      {
        file: './lib/index.mjs',
        format: 'es',
      },
    ],
    external: Object.keys(packageJson.dependencies),
    plugins: [nodeResolve(), typescript()],
  },
  {
    input: './src/main/index.ts',
    output: {
      file: './lib/index.d.ts',
      format: 'es',
    },
    external: Object.keys(packageJson.dependencies),
    plugins: [dts()],
  },
];
