export enum GpVersion {
  V0_6_4 = "0.6.4",
  V0_6_5 = "0.6.5",
  V0_6_6 = "0.6.6",
  V0_6_7 = "0.6.7",
  V7_0_0 = "7.0.0",
}
export const DEFAULT_VERSION = GpVersion.V0_6_4;
export const CURRENT_VERSION = process.env.GP_VERSION as GpVersion;

export class Compatibility {
  static is(...version: GpVersion[]) {
    if (CURRENT_VERSION === undefined) {
      return version.includes(DEFAULT_VERSION);
    }
    if (!Object.values(GpVersion).includes(CURRENT_VERSION)) {
      throw new Error(`Configured environment variable GP_VERSION is unknown: '${CURRENT_VERSION}'`);
    }
    return version.includes(CURRENT_VERSION);
  }
}
