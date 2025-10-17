import { Channel } from "./channel.js";
import { DirectPort } from "./port.js";
import type { Api, Internal, LousyProtocol, MessagesList } from "./types.js";

export function createProtocol<To, From>(
  name: string,
  {
    toWorker,
    fromWorker,
  }: {
    toWorker: To & MessagesList<To>;
    fromWorker: From & MessagesList<From>;
  },
): LousyProtocol<To, From> {
  return { name, toWorker, fromWorker };
}

export function startSameThread<To, From>(
  protocol: LousyProtocol<To, From>,
): {
  api: Api<LousyProtocol<To, From>>;
  internal: Internal<LousyProtocol<To, From>>;
} {
  const [txPort, rxPort] = DirectPort.pair();
  const api = Channel.tx(protocol, txPort);
  const internal = Channel.rx(protocol, rxPort);

  return {
    api,
    internal,
  };
}
