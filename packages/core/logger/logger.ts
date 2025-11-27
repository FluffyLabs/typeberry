import { ConsoleTransport } from "./console.js";
import { findLevel, Level, type Options, parseLoggerOptions } from "./options.js";
import type { Transport, TransportBuilder } from "./transport.js";

const DEFAULT_OPTIONS = {
  workingDir: "",
  defaultLevel: Level.LOG,
  modules: new Map(),
};

const GLOBAL_CONFIG: { options: Options; transport: Transport } = {
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
    const module = moduleName ?? fName;
    return new Logger(module.padStart(8, " "), GLOBAL_CONFIG);
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
  static configureAllFromOptions(options: Options, createTransport: TransportBuilder = ConsoleTransport.create) {
    // find minimal level to optimise logging in case
    // we don't care about low-level logs.
    const minimalLevel = Array.from(options.modules.values()).reduce((level, modLevel) => {
      return level < modLevel ? level : modLevel;
    }, options.defaultLevel);

    const transport = createTransport(minimalLevel, options);

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

  private cachedLevelAndName?: readonly [Level, string];

  private constructor(
    private readonly moduleName: string,
    private readonly config: typeof GLOBAL_CONFIG,
  ) {}

  /** Return currently configured level for given module. */
  getLevel(): Level {
    return this.getLevelAndName()[0];
  }

  private getLevelAndName(): readonly [Level, string] {
    if (this.cachedLevelAndName === undefined) {
      // since we pad module name for better alignment, we need to
      // trim it for the lookup
      const moduleTrimmed = this.moduleName.trim();
      const level = findLevel(this.config.options, moduleTrimmed);
      const shortName = moduleTrimmed.replace(this.config.options.workingDir, "");
      this.cachedLevelAndName = [level, shortName];
    }
    return this.cachedLevelAndName;
  }

  /** Log a message with `INSANE` level. */
  insane(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.insane(this.getLevelAndName(), strings, data);
  }

  /** Log a message with `TRACE` level. */
  trace(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.trace(this.getLevelAndName(), strings, data);
  }

  /** Log a message with `DEBUG`/`LOG` level. */
  log(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.log(this.getLevelAndName(), strings, data);
  }

  /** Log a message with `INFO` level. */
  info(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.info(this.getLevelAndName(), strings, data);
  }

  /** Log a message with `WARN` level. */
  warn(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.warn(this.getLevelAndName(), strings, data);
  }

  /** Log a message with `ERROR` level. */
  error(strings: TemplateStringsArray, ...data: unknown[]) {
    this.config.transport.error(this.getLevelAndName(), strings, data);
  }
}
