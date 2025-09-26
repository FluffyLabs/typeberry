import defaultConfig from "./typeberry-default.json" with { type: "json" };
import devConfig from "./typeberry-dev.json" with { type: "json" };

export const configs = {
  default: defaultConfig,
  dev: devConfig,
};
