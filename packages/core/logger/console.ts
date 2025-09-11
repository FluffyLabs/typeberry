import { Level, type Options, findLevel } from "./options.js";
import type { Transport } from "./transport.js";

/** An optimized logger that ignores `TRACE`, `DEBUG` and `LOG` messages.
 *
 * Use the `create` method to instantiate the right instance of a more specialized logger.
 */
export class ConsoleTransport implements Transport {
  /**
   * Creates a new optimized logger which ignores messages that are below the
   * `minimalLevel`.
   */
  static create(minimalLevel: Level, options: Options) {
    // optimised transports if we don't care about trace/log levels
    if (minimalLevel === Level.INSANE) {
      return new InsaneConsoleLogger(options);
    }

    // optimised transports if we don't care about trace/log levels
    if (minimalLevel === Level.TRACE) {
      return new TraceConsoleTransport(options);
    }

    if (minimalLevel === Level.LOG) {
      return new LogConsoleTransport(options);
    }

    if (minimalLevel === Level.INFO) {
      return new InfoConsoleTransport(options);
    }

    return new ConsoleTransport(options);
  }

  protected constructor(private options: Options) {}

  insane(_moduleName: string, _val: string) {
    /* no-op */
  }

  trace(_moduleName: string, _val: string) {
    /* no-op */
  }

  log(_moduleName: string, _val: string) {
    /* no-op */
  }

  info(_moduleName: string, _val: string) {
    /* no-op */
  }

  warn(moduleName: string, val: string) {
    this.push(Level.WARN, moduleName, val);
  }

  error(moduleName: string, val: string) {
    this.push(Level.ERROR, moduleName, val);
  }

  push(level: Level, moduleName: string, val: string) {
    const shortModule = moduleName.replace(this.options.workingDir, "");
    const configuredLevel = findLevel(this.options, moduleName);
    const lvlText = Level[level].padEnd(5);
    if (level < configuredLevel) {
      return;
    }

    const msg = `${lvlText} [${shortModule}] ${val}`;
    if (level === Level.WARN) {
      console.warn(msg);
    } else if (level === Level.ERROR) {
      console.error(msg);
    } else {
      console.info(msg);
    }
  }
}

/**
 * Insane version of console logger - supports insane level.
 */
class InsaneConsoleLogger extends ConsoleTransport {
  insane(moduleName: string, val: string) {
    this.push(Level.INSANE, moduleName, val);
  }

  trace(moduleName: string, val: string) {
    this.push(Level.TRACE, moduleName, val);
  }

  log(moduleName: string, val: string) {
    this.push(Level.LOG, moduleName, val);
  }

  info(moduleName: string, val: string) {
    this.push(Level.INFO, moduleName, val);
  }
}

/**
 * A basic version of console logger - printing everything.
 */
class TraceConsoleTransport extends ConsoleTransport {
  insane(_moduleName: string, _val: string) {
    /* no-op */
  }

  trace(moduleName: string, val: string) {
    this.push(Level.TRACE, moduleName, val);
  }

  log(moduleName: string, val: string) {
    this.push(Level.LOG, moduleName, val);
  }

  info(moduleName: string, val: string) {
    this.push(Level.INFO, moduleName, val);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` level calls.
 */
class LogConsoleTransport extends ConsoleTransport {
  insane(_moduleName: string, _val: string) {
    /* no-op */
  }

  trace(_moduleName: string, _val: string) {
    /* no-op */
  }

  log(moduleName: string, val: string) {
    this.push(Level.LOG, moduleName, val);
  }

  info(moduleName: string, val: string) {
    this.push(Level.INFO, moduleName, val);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` & `DEBUG` level calls.
 */
class InfoConsoleTransport extends ConsoleTransport {
  insane(_moduleName: string, _val: string) {
    /* no-op */
  }

  trace(_moduleName: string, _val: string) {
    /* no-op */
  }

  log(_moduleName: string, _val: string) {
    /* no-op */
  }

  info(moduleName: string, val: string) {
    this.push(Level.INFO, moduleName, val);
  }
}
