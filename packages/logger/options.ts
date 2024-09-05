export enum Level {
  TRACE = 1,
  LOG = 2,
  WARN = 3,
  ERROR = 4,
};

export type Options = {
  defaultLevel: Level,
  modules: Map<string, Level>,
};

/**
 * Find a configred log level for given module.
 *
 * The function will attempt to find the most detailed level for given module
 * by checking if logging is configured for it's parent modules if it's not for
 * the specific name.
 *
 * E.g. `consensus/voting`
 *
 * We can have no level configured for `consensus/voting`, but if there is a `WARN`
 * level for `consensus`, this function would return `Level.WARN` even though
 * the default log level might be `Level.LOG`.
 */
export function findLevel(options: Options, moduleName: string) {
  let parentModuleName = moduleName;
  for (;;) {
    const level = this.options.modules.get(parentModuleName);
    if (level) {
      return level;
    }

    const lastSlash = moduleName.lastIndexOf('/');
    if (lastSlash === -1) {
      return options.defaultLevel;
    }

    parentModuleName = moduleName.substring(0, lastSlash);
  }
}
