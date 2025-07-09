export enum GpVersion {
  V0_6_4 = "0.6.4",
  V0_6_5 = "0.6.5",
  V0_6_6 = "0.6.6",
  V0_6_7 = "0.6.7",
  V7_0_0 = "7.0.0",
}
export const DEFAULT_VERSION = GpVersion.V0_6_4;
export const CURRENT_VERSION = process.env.GP_VERSION;

export class Compatibility {
  static is(...version: GpVersion[]) {
    // NOTE: [MaSo] Type casting to GpVersion is a trick for TS's type checker
    // JS compares only array of string to a string
    if (!Object.values(GpVersion).includes(CURRENT_VERSION as GpVersion)) {
      return version.includes(DEFAULT_VERSION);
    }
    return version.some((x) => x === CURRENT_VERSION);
  }
}
