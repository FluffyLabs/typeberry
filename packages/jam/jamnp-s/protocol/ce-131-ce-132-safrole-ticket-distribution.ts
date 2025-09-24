import type { Epoch } from "@typeberry/block";
import { SignedTicket } from "@typeberry/block/tickets.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, Decoder, Encoder } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import { type StreamHandler, type StreamMessageSender, tryAsStreamKind } from "./stream.js";

/**
 * JAM-SNP CE-131 and CE-132 streams.
 *
 * Safrole ticket distribution from generating validator to proxy validator (131) and from proxy validator to all validators (132).
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-131132-safrole-ticket-distribution
 */

export const STREAM_KIND_GENERATOR_TO_PROXY = tryAsStreamKind(131);
export const STREAM_KIND_PROXY_TO_ALL = tryAsStreamKind(132);

type STREAM_KIND = typeof STREAM_KIND_GENERATOR_TO_PROXY | typeof STREAM_KIND_PROXY_TO_ALL;

export class TicketDistributionRequest extends WithDebug {
  static Codec = codec.Class(TicketDistributionRequest, {
    epochIndex: codec.u32.asOpaque<Epoch>(),
    ticket: SignedTicket.Codec,
  });

  static create({ epochIndex, ticket }: CodecRecord<TicketDistributionRequest>) {
    return new TicketDistributionRequest(epochIndex, ticket);
  }

  private constructor(
    public readonly epochIndex: Epoch,
    public readonly ticket: SignedTicket,
  ) {
    super();
  }
}

const logger = Logger.new(import.meta.filename, "protocol/ce-131-ce-132");

export class ServerHandler<T extends STREAM_KIND> implements StreamHandler<T> {
  constructor(
    public readonly kind: T,
    private readonly onTicketReceived: (epochIndex: Epoch, ticket: SignedTicket) => void,
  ) {}

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const ticketDistribution = Decoder.decodeObject(TicketDistributionRequest.Codec, message);
    logger.log`[${sender.streamId}][ce-${this.kind}] Received ticket for epoch ${ticketDistribution.epochIndex}`;
    this.onTicketReceived(ticketDistribution.epochIndex, ticketDistribution.ticket);
    sender.close();
  }

  onClose() {}
}

export class ClientHandler<T extends STREAM_KIND> implements StreamHandler<T> {
  constructor(public readonly kind: T) {}

  onStreamMessage(sender: StreamMessageSender): void {
    logger.warn`[${sender.streamId}][ce-${this.kind}] Unexpected message received. Closing.`;
    sender.close();
  }

  onClose() {}

  sendTicket(sender: StreamMessageSender, epochIndex: Epoch, ticket: SignedTicket) {
    const request = TicketDistributionRequest.create({ epochIndex, ticket });
    sender.bufferAndSend(Encoder.encodeObject(TicketDistributionRequest.Codec, request));
    sender.close();
  }
}
