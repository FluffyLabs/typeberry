export enum GpVersion {
  V0_6_4 = "0.6.4",
  V0_6_5 = "0.6.5",
  V0_6_6 = "0.6.6",
  V0_6_7 = "0.6.7",
  V0_7_0 = "0.7.0",
}

export enum TestSuite {
  W3F_DAVXY = "w3f-davxy",
  W3F = "w3f",
  JAMDUNA = "jamduna",
  JAVAJAM = "javajam",
}

export const DEFAULT_SUITE = TestSuite.W3F;

const ALL_VERSIONS_IN_ORDER = [
  GpVersion.V0_6_4,
  GpVersion.V0_6_5,
  GpVersion.V0_6_6,
  GpVersion.V0_6_7,
  GpVersion.V0_7_0,
];

export const DEFAULT_VERSION = GpVersion.V0_6_5;
export let CURRENT_VERSION = parseCurrentVersion(process.env.GP_VERSION);
export const CURRENT_SUITE = (process.env.TEST_SUITE as TestSuite) ?? DEFAULT_SUITE;

function parseCurrentVersion(env?: string): GpVersion | undefined {
  if (env === undefined) {
    return undefined;
  }
  const version = env as GpVersion;
  if (!Object.values(GpVersion).includes(version)) {
    throw new Error(
      `Configured environment variable GP_VERSION is unknown: '${env}'. Use one of: ${ALL_VERSIONS_IN_ORDER}`,
    );
  }
  return version;
}

export class Compatibility {
  static override(version?: GpVersion) {
    CURRENT_VERSION = version;
  }

  static is(...version: GpVersion[]) {
    if (CURRENT_VERSION === undefined) {
      return version.includes(DEFAULT_VERSION);
    }
    return version.includes(CURRENT_VERSION);
  }

  static isSuite(suite: TestSuite) {
    if (CURRENT_SUITE === undefined) {
      return false;
    }
    return suite === CURRENT_SUITE;
  }

  static isGreaterOrEqual(version: GpVersion) {
    const index = ALL_VERSIONS_IN_ORDER.indexOf(version);
    if (index === -1) {
      throw new Error(`Invalid version: ${version}. Not found amongst supported versions: ${ALL_VERSIONS_IN_ORDER}`);
    }
    return Compatibility.is(...ALL_VERSIONS_IN_ORDER.slice(index));
  }
}
