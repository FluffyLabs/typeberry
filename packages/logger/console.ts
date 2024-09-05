import {Level, Options, findLevel} from "./options";
import {Transport} from "./transport";

export class ConsoleTransport implements Transport {
  static create(minimalLevel: Level, options: Options) {
    // optimised transports if we don't care about trace/log levels
    if (minimalLevel === Level.TRACE) {
      return new TraceConsoleTransport(options);
    }

    if (minimalLevel === Level.LOG) {
      return new LogConsoleTransport(options);
    }

    return new ConsoleTransport(options);
  }

  constructor(private options: Options) {}

  trace(_moduleName: string, _fileName: string, _val: string) { /* no-op */ }
  log(_moduleName: string, _fileName: string, _val: string) { /* no-op */ }

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

class TraceConsoleTransport extends ConsoleTransport {
  trace(moduleName: string, fileName: string, val: string) {
    this.push(Level.TRACE, moduleName, fileName, val);
  }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }
}

class LogConsoleTransport extends ConsoleTransport {
  trace(_moduleName: string, _fileName: string, _val: string) { /* no-op */ }

  log(moduleName: string, fileName: string, val: string) {
    this.push(Level.LOG, moduleName, fileName, val);
  }
}
