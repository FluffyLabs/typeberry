import * as path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: webpack.Configuration = {
  mode: "production",
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
    futureDefaults: true,
    outputModule: true,
    syncWebAssembly: true,
  },
  externalsType: "module",
  externalsPresets: {
    node: true,
  },
  externals: {
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
              sourceMap: true,
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /bootstrap\.mjs$/,
        type: "asset/inline",
      },
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
  devtool: "source-map",
  optimization: {
    minimize: true,
    splitChunks: false,
  },
  stats: {
    colors: true,
    modules: false,
    chunks: false,
    chunkModules: false,
  },
};
export default config;
