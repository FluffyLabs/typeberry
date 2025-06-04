import type { ServiceId } from "@typeberry/block";
import type { AccountsInfo } from "@typeberry/jam-host-calls/info";
import type { ServiceAccountInfo, State } from "@typeberry/state";

export class AccountsInfoExternalities implements AccountsInfo {
  constructor(private state: Pick<State, "getService">) {}

  async getInfo(serviceId: ServiceId | null): Promise<ServiceAccountInfo | null> {
    if (serviceId === null) {
      return null;
    }

    const service = this.state.getService(serviceId);

    if (service === null) {
      return null;
    }

    return service.getInfo();
  }
}
