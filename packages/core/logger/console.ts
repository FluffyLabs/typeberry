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

  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  log(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  info(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  warn(moduleName: string, fileName: string, val: string) {
    this.push(Level.WARN, moduleName, fileName, val);
  }

  error(moduleName: string, fileName: string, val: string) {
    this.push(Level.ERROR, moduleName, fileName, val);
  }

  push(level: Level, moduleName: string, fileName: string, val: string) {
    const shortName = fileName.replace(this.options.workingDir, "");
    const shortModule = moduleName.replace(this.options.workingDir, "");
    const configuredLevel = findLevel(this.options, moduleName);
    const lvlText = Level[level].padEnd(5);
    if (level < configuredLevel) {
      return;
    }

    const msg = `${lvlText} [${shortModule}] ${val}\n\t@ ${shortName}`;
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
 * A basic version of console logger - printing everything.
 */
class TraceConsoleTransport extends ConsoleTransport {
  trace(moduleName: string, fileName: string, val: string) {
    this.push(Level.TRACE, moduleName, fileName, val);
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }

  info(moduleName: string, fileName: string, val: string) {
    this.push(Level.INFO, moduleName, fileName, val);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` level calls.
 */
class LogConsoleTransport extends ConsoleTransport {
  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }

  info(moduleName: string, fileName: string, val: string) {
    this.push(Level.INFO, moduleName, fileName, val);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` & `DEBUG` level calls.
 */
class InfoConsoleTransport extends ConsoleTransport {
  trace(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  log(_moduleName: string, _fileName: string, _val: string) {
    /* no-op */
  }

  info(moduleName: string, fileName: string, val: string) {
    this.push(Level.INFO, moduleName, fileName, val);
  }
}
