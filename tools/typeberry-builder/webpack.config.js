import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (_env, argv) => {
  const isProduction = argv.mode === "production";
  const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
  const version = pkg.version;
  const outputFileName = `typeberry-v${version}-${commitHash}.mjs`;

  return {
    mode: isProduction ? "production" : "development",
    // TODO [MaSo] Add target `web` or `browserlist`
    // https://webpack.js.org/configuration/target/
    target: "node",
    entry: {
      typeberry: path.resolve(__dirname, "./entry.ts"),
    },
    output: {
      path: path.resolve(__dirname, "../../dist/typeberry"),
      filename: outputFileName,
      library: {
        type: "module",
      },
      clean: true,
    },
    experiments: {
      outputModule: true,
    },
    externals: {
      // Keep node build-ins as externals
      "node:fs": "node:fs",
      "node:path": "node:path",
      "node:url": "node:url",
      "node:process": "node:process",
      "node:crypto": "node:crypto",
      "node:buffer": "node:buffer",
      "node:stream": "node:stream",
      "node:util": "node:util",
      "node:events": "node:events",
      "node:os": "node:os",
      "node:worker_threads": "node:worker_threads",
      "node:child_process": "node:child_process",
      "node:net": "node:net",
      "node:http": "node:http",
      "node:https": "node:https",
      // Can't be bundled
      minimist: "minimist",
      lmdb: "lmdb",
    },
    resolve: {
      extensions: [".ts", ".js", ".mjs", ".json"],
      alias: {
        "@typeberry/block": path.resolve(__dirname, "../../packages/jam/block"),
        "@typeberry/block-generator": path.resolve(__dirname, "../../workers/block-generator"),
        "@typeberry/block-json": path.resolve(__dirname, "../../packages/jam/block-json"),
        "@typeberry/bytes": path.resolve(__dirname, "../../packages/core/bytes"),
        "@typeberry/codec": path.resolve(__dirname, "../../packages/core/codec"),
        "@typeberry/collections": path.resolve(__dirname, "../../packages/core/collections"),
        "@typeberry/config": path.resolve(__dirname, "../../packages/jam/config"),
        "@typeberry/database-lmdb": path.resolve(__dirname, "../../packages/jam/database-lmdb"),
        "@typeberry/ext-ipc": path.resolve(__dirname, "../../extensions/ipc"),
        "@typeberry/hash": path.resolve(__dirname, "../../packages/core/hash"),
        "@typeberry/importer": path.resolve(__dirname, "../../workers/importer"),
        "@typeberry/json-parser": path.resolve(__dirname, "../../packages/core/json-parser"),
        "@typeberry/logger": path.resolve(__dirname, "../../packages/core/logger"),
        "@typeberry/state-json": path.resolve(__dirname, "../../packages/jam/state-json"),
        "@typeberry/state-merkleization": path.resolve(__dirname, "../../packages/jam/state-merkleization"),
        "@typeberry/utils": path.resolve(__dirname, "../../packages/core/utils"),
      },
      extensionAlias: {
        ".js": [".js", ".ts"],
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              compilerOptions: {
                sourceMap: !isProduction,
              },
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    devtool: isProduction ? "nosources-source-map" : "inline-source-map",
    optimization: {
      minimize: isProduction,
    },
    stats: {
      colors: true,
      modules: false,
      chunks: false,
      chunkModules: false,
    },
  };
};
