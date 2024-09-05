export enum Level {
  TRACE = 1,
  DEBUG = 2,
  LOG = 3,
  WARN = 4,
  ERROR = 5,
}

export type Options = {
  defaultLevel: Level;
  modules: Map<string, Level>;
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
export function findLevel(options: Options, moduleName: string): Level {
  let parentModuleName = moduleName;
  for (;;) {
    const level = options.modules.get(parentModuleName);
    if (level) {
      return level;
    }

    const lastSlash = parentModuleName.lastIndexOf("/");
    if (lastSlash === -1) {
      return options.defaultLevel;
    }

    parentModuleName = moduleName.substring(0, lastSlash);
  }
}

/**
 * A function to parse logger definition (including modules) given as a string.
 *
 * Examples
 *  - `info` - setup default logging level to `info/log`.
 *  - `trace` - default logging level set to `trace`.
 *  - `log;consensus=trace` - default level is set to `info/log`, but consensus is in trace mode.
 */
export function parseLoggerOptions(input: string, defaultLevel: Level): Options {
  const parts = input.toLowerCase().split(';');

  let modules = new Map<string, Level>();

  for (const p of parts) {
    const clean = p.trim();
    // skip empty objects (forgotten `;` removed)
    if (clean.length === 0) {
      continue;
    }
    // we just have the default level
    if (clean.indexOf('=') === -1) {
      defaultLevel = parseLevel(clean);
    } else {
      const [mod, lvl] = clean.split('=');
      modules.set(mod.trim(), parseLevel(lvl.trim()));
    }
  }

  return {
    defaultLevel,
    modules,
  };
}

function parseLevel(lvl: string): Level {
  const typedLvl: keyof typeof Level = lvl === 'info' ? 'LOG' : lvl.toUpperCase() as keyof typeof Level;

  if (!Level[typedLvl]) {
    throw new Error(`Unknown logging level: "${lvl}". Use one of "trace", "debug", "log","info", "warn", "error"`);
  }

  return Level[typedLvl];
}
