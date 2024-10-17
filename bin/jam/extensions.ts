import * as ipc from "../../extensions/ipc";

export function initializeExtensions(api: ipc.ExtensionApi) {
  ipc.startExtension(api);
}
