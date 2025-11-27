import type { Level, Options } from "./options.js";

export type TransportBuilder = (minLevel: Level, options: Options) => Transport;
/**
 * An interface for the logger `Transport`.
 */
export interface Transport {
  /** INSANE message */
  insane(levelAndName: readonly [Level, string], _strings: TemplateStringsArray, _data: unknown[]): void;
  /** TRACE message */
  trace(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]): void;
  /** DEBUG/LOG message */
  log(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]): void;
  /** INFO message */
  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]): void;
  /** WARN message */
  warn(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]): void;
  /** ERROR message */
  error(levelAndName: readonly [Level, string], strings: TemplateStringsArray, data: unknown[]): void;
}
