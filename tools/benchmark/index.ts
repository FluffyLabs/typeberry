export { add, complete, cycle, suite } from 'benny';

import { save as rawSave, configure as rawConfigure } from 'benny';
import type {Config} from 'benny/lib/internal/common-types';

export function configure(obj: Config) {
  obj.minDisplayPrecision ??= 2;
  return rawConfigure(obj);
}

export function save() {
  return rawSave({
    /**
     * String or function that produces a string,
     * if function, then results object will be passed as argument:
     */
    file: 'myFileNameWithoutExtension',
    /**
     * Destination folder (can be nested), will be created if not exists:
     */
    folder: 'myFolder',
    /**
     * Version string - if provided will be included in the file content
     */
    version: require('./package.json').version,
    /**
     * A flag that indicates whether detailed or simplified result will be saved
     * Default: false (simplified results)
     */
    details: true,
    /**
     * Output format, currently supported:
     *   'json' | 'csv' | 'table.html' | 'chart.html'
     * Default: 'json'
     */
    format: 'csv',
  });
}
