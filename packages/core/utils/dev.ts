import {env} from "./env.js";

/**
 * The function will produce relative path resolver that is adjusted
 * for package location within the workspace.
 *
 * Example:
 * $ npm start -w @typeberry/jam
 *
 * The above command will run `./bin/jam/index.js`, however we would
 * still want relative paths to be resolved according to top-level workspace
 * directory.
 *
 * So the caller, passes the absolute workspace path as argument and get's
 * a function that can properly resolve relative paths.
 *
 * NOTE: the translation happens only for development build! When
 * we build a single library from our project, we no longer mangle the paths.
 */
export const workspacePathFix =
  env.NODE_ENV === "development"
    ? (workspacePath: string) => (p: string) => {
        if (p.startsWith("/")) {
          return p;
        }
        return `${workspacePath}/${p}`;
      }
    : () => (p: string) => p;
