import { type Epoch, tryAsEpoch } from "@typeberry/block";
import { SignedTicket } from "@typeberry/block/tickets";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import type { U32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamKind } from "./stream";

/**
 * JAM-SNP CE-131 and CE-132 streams.
 *
 * Safrole ticket distribution from generating validator to proxy validator (131) and from proxy validator to all validators (132).
 */

export const STREAM_KIND_GENERATOR_TO_PROXY = 131 as StreamKind;
export const STREAM_KIND_PROXY_TO_ALL = 132 as StreamKind;

export class TicketDistributionRequest extends WithDebug {
  static Codec = codec.Class(TicketDistributionRequest, {
    epochIndex: codec.u32.convert<Epoch>(
      (i) => i as U32,
      (i) => tryAsEpoch(i),
    ),
    ticket: SignedTicket.Codec,
  });

  static fromCodec({ epochIndex, ticket }: CodecRecord<TicketDistributionRequest>) {
    return new TicketDistributionRequest(epochIndex, ticket);
  }

  constructor(
    public readonly epochIndex: Epoch,
    public readonly ticket: SignedTicket,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-131-ce-132");

export class ServerHandler
  implements StreamHandler<typeof STREAM_KIND_GENERATOR_TO_PROXY | typeof STREAM_KIND_PROXY_TO_ALL>
{
  constructor(
    public readonly kind: typeof STREAM_KIND_GENERATOR_TO_PROXY | typeof STREAM_KIND_PROXY_TO_ALL,
    private readonly onTicketReceived: (epochIndex: Epoch, ticket: SignedTicket) => void,
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const ticketDistribution = Decoder.decodeObject(TicketDistributionRequest.Codec, message);
    logger.log(`[${sender.streamId}][ce-${this.kind}] Received ticket for epoch ${ticketDistribution.epochIndex}`);
    this.onTicketReceived(ticketDistribution.epochIndex, ticketDistribution.ticket);
    sender.close();
  }

  onClose() {}
}

export class ClientHandler
  implements StreamHandler<typeof STREAM_KIND_GENERATOR_TO_PROXY | typeof STREAM_KIND_PROXY_TO_ALL>
{
  constructor(public readonly kind: typeof STREAM_KIND_GENERATOR_TO_PROXY | typeof STREAM_KIND_PROXY_TO_ALL) {}

  onStreamMessage(sender: StreamSender): void {
    logger.warn(`[${sender.streamId}][ce-${this.kind}] Unexpected message received. Closing.`);
    sender.close();
  }

  onClose() {}

  sendTicket(sender: StreamSender, epochIndex: Epoch, ticket: SignedTicket) {
    const ticketDistribution = new TicketDistributionRequest(epochIndex, ticket);
    sender.send(Encoder.encodeObject(TicketDistributionRequest.Codec, ticketDistribution));
    sender.close();
  }
}
