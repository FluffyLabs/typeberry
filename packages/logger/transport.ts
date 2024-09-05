export interface Transport {
  trace(moduleName: string, fileName: string, val: string): void;
  log(moduleName: string, fileName: string, val: string): void;
  warn(moduleName: string, fileName: string, val: string): void;
  error(moduleName: string, fileName: string, val: string): void;
}
