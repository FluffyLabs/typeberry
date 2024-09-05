import { ConsoleTransport } from "./console";
import { Level, type Options } from "./options";

export function logger(fileName: string, moduleName?: string) {
  return new Logger(moduleName ?? fileName, fileName);
}

export function configure(
  defaultLevel: Level,
  modules: {
    module: string;
    level: Level;
  }[],
) {
  const options: Options = {
    defaultLevel,
    modules: new Map<string, Level>(),
  };

  for (const mod of modules) {
    options.modules.set(mod.module, mod.level);
  }

  // find minimal level to optimise logging in case
  // we don't care about low-level logs.
  const minimalLevel = modules.reduce((level, mod) => {
    return level < mod.level ? level : mod.level;
  }, defaultLevel);

  const transport = ConsoleTransport.create(minimalLevel, options);

  // set the global config
  GLOBAL_CONFIG.options = options;
  GLOBAL_CONFIG.transport = transport;
}

const DEFAULT_OPTIONS = {
  defaultLevel: Level.WARN,
  modules: new Map(),
};

const GLOBAL_CONFIG = {
  options: DEFAULT_OPTIONS,
  transport: ConsoleTransport.create(DEFAULT_OPTIONS.defaultLevel, DEFAULT_OPTIONS),
};

class Logger {
  constructor(
    private moduleName: string,
    private fileName: string,
  ) {}

  trace(val: string) {
    GLOBAL_CONFIG.transport.trace(this.moduleName, this.fileName, val);
  }

  log(val: string) {
    GLOBAL_CONFIG.transport.log(this.moduleName, this.fileName, val);
  }

  warn(val: string) {
    GLOBAL_CONFIG.transport.warn(this.moduleName, this.fileName, val);
  }

  error(val: string) {
    GLOBAL_CONFIG.transport.warn(this.moduleName, this.fileName, val);
  }
}
