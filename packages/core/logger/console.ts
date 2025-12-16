// biome-ignore-all lint/suspicious/noConsole: logger

import { Level, type Options } from "./options.js";
import type { Transport } from "./transport.js";

function print(level: Level, levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
  if (level < levelAndName[0]) {
    return;
  }

  const lvlText = Level[level].padEnd(5);
  const val = strings.map((v, idx) => `${v}${idx < data.length ? data[idx] : ""}`);
  const msg = `${lvlText} [${levelAndName[1].padStart(8, " ")}] ${val.join("")}`;
  if (level === Level.WARN) {
    console.warn(msg);
  } else if (level === Level.ERROR) {
    console.error(msg);
  } else {
    console.info(msg);
  }
}

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

  protected constructor(protected options: Options) {}

  insane(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  trace(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  log(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  info(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  warn(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.WARN, levelAndName, strings, data);
  }

  error(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.ERROR, levelAndName, strings, data);
  }
}

/**
 * Insane version of console logger - supports insane level.
 */
class InsaneConsoleLogger extends ConsoleTransport {
  insane(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.INSANE, levelAndName, strings, data);
  }

  trace(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.TRACE, levelAndName, strings, data);
  }

  log(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.LOG, levelAndName, strings, data);
  }

  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.INFO, levelAndName, strings, data);
  }
}

/**
 * A basic version of console logger - printing everything.
 */
class TraceConsoleTransport extends ConsoleTransport {
  insane(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  trace(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.TRACE, levelAndName, strings, data);
  }

  log(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.LOG, levelAndName, strings, data);
  }

  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.INFO, levelAndName, strings, data);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` level calls.
 */
class LogConsoleTransport extends ConsoleTransport {
  insane(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  trace(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  log(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.LOG, levelAndName, strings, data);
  }

  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.INFO, levelAndName, strings, data);
  }
}

/**
 * An optimized version of the logger - completely ignores `TRACE` & `DEBUG` level calls.
 */
class InfoConsoleTransport extends ConsoleTransport {
  insane(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  trace(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  log(_levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]) {
    /* no-op */
  }

  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]) {
    print(Level.INFO, levelAndName, strings, data);
  }
}
