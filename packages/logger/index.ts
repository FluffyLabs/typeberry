import { ConsoleTransport } from "./console";
import { Level, type Options } from "./options";

export { Level, parseLoggerOptions } from "./options";

/**
 * Create a new logger instance given filename and an optional module name.
 *
 * If the module name is not given, `fileName` becomes the module name.
 *
 * The logger will use a global configuration which can be changed using
 * [`configureLogger`] function.
 */
export function newLogger(fileName: string, moduleName?: string) {
  return new Logger(moduleName ?? fileName, fileName, GLOBAL_CONFIG);
}

/**
 * Global configuration of all loggers.
 *
 * One can specify a default logging level (only logs with level >= default will be printed).
 * It's also possible to configure per-module logging level that takes precedence
 * over the default one.
 *
 * Changing the options affects all previously created loggers.
 */
export function configureLogger(options: Options) {
  // find minimal level to optimise logging in case
  // we don't care about low-level logs.
  const minimalLevel = Array.from(options.modules.values()).reduce((level, modLevel) => {
    return level < modLevel ? level : modLevel;
  }, options.defaultLevel);

  const transport = ConsoleTransport.create(minimalLevel, options);

  // set the global config
  GLOBAL_CONFIG.options = options;
  GLOBAL_CONFIG.transport = transport;
}

const DEFAULT_OPTIONS = {
  defaultLevel: Level.TRACE,
  modules: new Map(),
};

const GLOBAL_CONFIG = {
  options: DEFAULT_OPTIONS,
  transport: ConsoleTransport.create(DEFAULT_OPTIONS.defaultLevel, DEFAULT_OPTIONS),
};

/**
 * A logger instance.
 */
export class Logger {
  constructor(
    private moduleName: string,
    private fileName: string,
    private config: typeof GLOBAL_CONFIG,
  ) {}

  /** Log a message with `TRACE` level. */
  trace(val: string) {
    this.config.transport.trace(this.moduleName, this.fileName, val);
  }

  /** Log a message with `DEBUG`/`LOG` level. */
  log(val: string) {
    this.config.transport.log(this.moduleName, this.fileName, val);
  }

  /** Log a message with `INFO` level. */
  info(val: string) {
    this.config.transport.info(this.moduleName, this.fileName, val);
  }

  /** Log a message with `WARN` level. */
  warn(val: string) {
    this.config.transport.warn(this.moduleName, this.fileName, val);
  }

  /** Log a message with `ERROR` level. */
  error(val: string) {
    this.config.transport.warn(this.moduleName, this.fileName, val);
  }
}
