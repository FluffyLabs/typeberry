/**
 * An interface for the logger `Transport`.
 */
export interface Transport {
  /** TRACE message */
  trace(moduleName: string, fileName: string, val: string): void;
  /** DEBUG/LOG message */
  log(moduleName: string, fileName: string, val: string): void;
  /** INFO message */
  info(moduleName: string, fileName: string, val: string): void;
  /** WARN message */
  warn(moduleName: string, fileName: string, val: string): void;
  /** ERROR message */
  error(moduleName: string, fileName: string, val: string): void;
}
