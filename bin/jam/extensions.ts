import * as ipc from "../../extensions/ipc";

export function initializeExtensions(api: ipc.ExtensionApi) {
  const closeIpc = ipc.startExtension(api);
  return () => {
    closeIpc();
  };
}
