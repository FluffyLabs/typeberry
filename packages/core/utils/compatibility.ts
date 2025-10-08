export enum GpVersion {
  V0_6_7 = "0.6.7",
  V0_7_0 = "0.7.0",
  V0_7_1 = "0.7.1-preview",
  V0_7_2 = "0.7.2-preview",
}

export enum TestSuite {
  W3F_DAVXY = "w3f-davxy",
  JAMDUNA = "jamduna",
}

export const DEFAULT_SUITE = TestSuite.W3F_DAVXY;

const ALL_VERSIONS_IN_ORDER = [GpVersion.V0_6_7, GpVersion.V0_7_0, GpVersion.V0_7_1, GpVersion.V0_7_2];

const env = typeof process === "undefined" ? {} : process.env;
export const DEFAULT_VERSION = GpVersion.V0_7_0;
export let CURRENT_VERSION = parseCurrentVersion(env.GP_VERSION) ?? DEFAULT_VERSION;
export let CURRENT_SUITE = parseCurrentSuite(env.TEST_SUITE) ?? DEFAULT_SUITE;

function parseCurrentVersion(env?: string): GpVersion | undefined {
  if (env === undefined) {
    return undefined;
  }
  switch (env) {
    case GpVersion.V0_6_7:
    case GpVersion.V0_7_0:
    case GpVersion.V0_7_1:
    case GpVersion.V0_7_2:
      return env;
    default:
      throw new Error(
        `Configured environment variable GP_VERSION is unknown: '${env}'. Use one of: ${ALL_VERSIONS_IN_ORDER}`,
      );
  }
}

function parseCurrentSuite(env?: string): TestSuite | undefined {
  if (env === undefined) {
    return undefined;
  }
  switch (env) {
    case TestSuite.W3F_DAVXY:
    case TestSuite.JAMDUNA:
      return env;
    default:
      throw new Error(
        `Configured environment variable TEST_SUITE is unknown: '${env}'. Use one of: ${Object.values(TestSuite)}`,
      );
  }
}

export class Compatibility {
  static override(version?: GpVersion) {
    CURRENT_VERSION = version ?? DEFAULT_VERSION;
  }

  static overrideSuite(suite: TestSuite) {
    CURRENT_SUITE = suite;
  }

  static is(...version: GpVersion[]) {
    if (CURRENT_VERSION === undefined) {
      return version.includes(DEFAULT_VERSION);
    }
    return version.includes(CURRENT_VERSION);
  }

  static isSuite(suite: TestSuite, version?: GpVersion) {
    if (CURRENT_SUITE === undefined) {
      return false;
    }

    const isCorrectGPVersion = version === undefined || Compatibility.is(version);
    return suite === CURRENT_SUITE && isCorrectGPVersion;
  }

  static isGreaterOrEqual(version: GpVersion) {
    const index = ALL_VERSIONS_IN_ORDER.indexOf(version);
    if (index === -1) {
      throw new Error(`Invalid version: ${version}. Not found amongst supported versions: ${ALL_VERSIONS_IN_ORDER}`);
    }
    return Compatibility.is(...ALL_VERSIONS_IN_ORDER.slice(index));
  }

  static isLessThan(version: GpVersion) {
    return !Compatibility.isGreaterOrEqual(version);
  }

  /**
   * Allows selecting different values for different Gray Paper versions from one record.
   *
   * @param fallback The default value to return if no value is found for the current.
   * @param record A record mapping versions to values, checking if the version is greater or equal to the current version.
   * @returns The value for the current version, or the default value.
   */
  static selectIfGreaterOrEqual<T>({
    fallback,
    versions,
  }: {
    fallback: T;
    versions: Partial<Record<GpVersion, T>>;
  }): T {
    for (const version of ALL_VERSIONS_IN_ORDER.toReversed()) {
      const value = versions[version];
      if (value !== undefined && Compatibility.isGreaterOrEqual(version)) {
        return value;
      }
    }
    return fallback;
  }
}
