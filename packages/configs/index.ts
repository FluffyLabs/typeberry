import defaultConfig from "./typeberry-default.json" with { type: "json" };
import devFullConfig from "./typeberry-dev-full.json" with { type: "json" };
import devTinyConfig from "./typeberry-dev-tiny.json" with { type: "json" };

export const configs = {
  default: defaultConfig,
  devTiny: devTinyConfig,
  devFull: devFullConfig,
};
