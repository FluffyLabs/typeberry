import { Level, type Options, findLevel } from "./options";
import type { Transport } from "./transport";

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
    if (minimalLevel === Level.TRACE) {
      return new TraceConsoleTransport(options);
    }

    if (minimalLevel === Level.DEBUG) {
      return new DebugConsoleTransport(options);
    }

    if (minimalLevel === Level.LOG) {
      return new LogConsoleTransport(options);
    }

    return new ConsoleTransport(options);
  }

  constructor(private options: Options) {}

  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  debug(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  log(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  warn(moduleName: string, fileName: string, val: string) {
    this.push(Level.WARN, moduleName, fileName, val);
  }

  error(moduleName: string, fileName: string, val: string) {
    this.push(Level.ERROR, moduleName, fileName, val);
  }

  push(lvl: Level, moduleName: string, fileName: string, val: string) {
    const level = findLevel(this.options, moduleName);
    if (lvl >= level) {
      console.log(lvl, moduleName, fileName, val);
    }
  }
}

/**
 * A basic version of console logger - printing everything.
 */
class TraceConsoleTransport extends ConsoleTransport {
  trace(moduleName: string, fileName: string, val: string) {
    this.push(Level.TRACE, moduleName, fileName, val);
  }

  debug(moduleName: string, fileName: string, val: string) {
    this.push(Level.DEBUG, moduleName, fileName, val);
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` level calls.
 */
class DebugConsoleTransport extends ConsoleTransport {
  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  debug(moduleName: string, fileName: string, val: string) {
    this.push(Level.DEBUG, moduleName, fileName, val);
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }
}


/**
 * An optimized version of the logger - completely ignores `TRACE` & `DEBUG` level calls.
 */
class LogConsoleTransport extends ConsoleTransport {
  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  debug(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }
}
