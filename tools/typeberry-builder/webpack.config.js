import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (_env, argv) => {
  const isProduction = argv.mode === "production";

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
      filename: "[name].mjs",
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
    devtool: isProduction ? false : "source-map",
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
