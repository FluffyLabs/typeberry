import type { ServiceId } from "@typeberry/block";
import type { AccountsInfo } from "@typeberry/jam-host-calls/info.js";
import type { Service, ServiceAccountInfo } from "@typeberry/state";

export class AccountsInfoExternalities implements AccountsInfo {
  constructor(private services: Map<ServiceId, Service>) {}

  async getInfo(serviceId: ServiceId | null): Promise<ServiceAccountInfo | null> {
    if (serviceId === null) {
      return null;
    }

    const service = this.services.get(serviceId);

    if (service === undefined) {
      return null;
    }

    return service.data.info;
  }
}
