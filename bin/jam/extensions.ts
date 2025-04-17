import * as ipc from "@typeberry/ext-ipc";

export function initializeExtensions(api: ipc.ExtensionApi) {
  const closeIpc = ipc.startExtension(api);
  return () => {
    closeIpc();
  };
}
