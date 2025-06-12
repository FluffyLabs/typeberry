import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { execSync } from 'child_process';
import { createRequire } from 'node:module';

// Use createRequire to import the package.json file
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

// Get the git commit hash
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

// Construct the output filename
const version = pkg.version;
const outputFileName = `dist/typeberry-v${version}-${commitHash}.cjs`;

export default {
  // The entry point of your application
  input: 'bin/jam/index.ts',

  // Configuration for the output bundle
  output: {
    // The path and filename for the bundled file
    file: outputFileName,
    // The format of the output bundle. 'cjs' is for CommonJS, suitable for Node.js
    format: 'cjs',
    // Generate a sourcemap for debugging (development only, not published)
    sourcemap: true,
    // Add a shebang to make the script executable
    banner: '#!/usr/bin/env node',
  },

  // An array of plugins used by Rollup
  plugins: [
    // Resolves third-party modules from node_modules
    resolve({
      preferBuiltins: true,
      // Only resolve JavaScript files from node_modules, avoid TypeScript files
      extensions: ['.js', '.json', '.mjs', '.cjs'],
    }),
    // Converts CommonJS modules to ES6, so they can be included in a Rollup bundle
    commonjs(),
    // Transpiles TypeScript to JavaScript
    typescript({
      // Only process TypeScript files in our source code, not in node_modules
      exclude: ['node_modules/**'],
    }),
    // Allows Rollup to import data from a JSON file
    json(),
  ],

  // Specify external dependencies that should not be bundled
  // For a CLI tool, it's common to keep node built-in modules external.
  external: [
    'fs',
    'path',
    'os',
    'child_process',
    'https',
    'http',
    'url',
    'assert',
    'util',
    'stream',
    'tty',
    'zlib',
    'crypto',
    'buffer',
    'events',
    'net',
    'dns',
    'readline',
    'worker_threads',
    'perf_hooks',
    'cluster',
    'dgram',
    'v8',
    // Native dependencies that can't be bundled
    'lmdb',
    'minimist',
  ],
};
