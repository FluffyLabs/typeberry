export enum Level {
  INSANE = 1,
  TRACE = 2,
  LOG = 3,
  INFO = 4,
  WARN = 5,
  ERROR = 6,
}

export type Options = {
  defaultLevel: Level;
  workingDir: string;
  modules: Map<string, Level>;
};

/**
 * Find a configured log level for given module.
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
    if (level !== undefined) {
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
 *  - `info` - setup default logging level to `info`.
 *  - `trace` - default logging level set to `trace`.
 *  - `debug;consensus=trace` - default level is set to `debug/log`, but consensus is in trace mode.
 */
export function parseLoggerOptions(input: string, defaultLevel: Level, workingDir?: string): Options {
  const modules = new Map<string, Level>();
  const parts = input.toLowerCase().split(",");
  let defLevel = defaultLevel;

  for (const p of parts) {
    const clean = p.trim();
    // skip empty objects (forgotten `,` removed)
    if (clean.length === 0) {
      continue;
    }
    // we just have the default level
    if (clean.includes("=")) {
      const [mod, lvl] = clean.split("=");
      modules.set(mod.trim(), parseLevel(lvl.trim()));
    } else {
      defLevel = parseLevel(clean);
    }
  }

  // TODO [ToDr] Fix dirname for workers.
  const myDir = (import.meta.dirname ?? "").split("/");
  myDir.pop();
  myDir.pop();
  return {
    defaultLevel: defLevel,
    modules,
    workingDir: workingDir ?? myDir.join("/"),
  };
}

function parseLevel(lvl: string): Level {
  const typedLvl: keyof typeof Level = lvl === "debug" ? "LOG" : (lvl.toUpperCase() as keyof typeof Level);

  if (Level[typedLvl] === undefined) {
    throw new Error(`Unknown logging level: "${lvl}". Use one of "trace", "debug", "log","info", "warn", "error"`);
  }

  return Level[typedLvl];
}
