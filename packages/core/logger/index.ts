import { ConsoleTransport } from "./console.js";
import { Level, type Options, findLevel, parseLoggerOptions } from "./options.js";
export { Level, parseLoggerOptions } from "./options.js";

const DEFAULT_OPTIONS = {
  workingDir: "",
  defaultLevel: Level.LOG,
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
  /**
   * Create a new logger instance given filename and an optional module name.
   *
   * If the module name is not given, `fileName` becomes the module name.
   * The module name can be composed from multiple parts separated with `/`.
   *
   * The logger will use a global configuration which can be changed using
   * [`configureLogger`] function.
   */
  static new(fileName?: string, moduleName?: string) {
    const fName = fileName ?? "unknown";
    return new Logger(moduleName ?? fName, fName, GLOBAL_CONFIG);
  }

  /**
   * Return currently configured level for given module. */
  static getLevel(moduleName: string): Level {
    return findLevel(GLOBAL_CONFIG.options, moduleName);
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
  static configureAllFromOptions(options: Options) {
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

  /**
   * Global configuration of all loggers.
   *
   * Parse configuration options from an input string typically obtained
   * from environment variable `JAM_LOG`.
   */
  static configureAll(input: string, defaultLevel: Level, workingDir?: string) {
    const options = parseLoggerOptions(input, defaultLevel, workingDir);
    Logger.configureAllFromOptions(options);
  }

  constructor(
    private readonly moduleName: string,
    private readonly fileName: string,
    private readonly config: typeof GLOBAL_CONFIG,
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
    this.config.transport.error(this.moduleName, this.fileName, val);
  }
}
