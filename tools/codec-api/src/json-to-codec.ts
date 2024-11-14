import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec/encoder";
import type { FastifyReply, FastifyRequest } from "fastify";
import { chainSpec } from "./chain-spec";
import { createErrorResponse } from "./error";
import { kinds } from "./kinds";

type Req = { Params: { id: string }; Body: { json: string } };
type SuccessRes = { data: { codec: string } };
type Res = { Body: SuccessRes };

export function jsonToCodec(req: FastifyRequest<Req>, reply: FastifyReply<Res>) {
  const descriptorId = req.params.id;
  const descriptor = kinds.find((x) => x.name === descriptorId)?.clazz;
  if (!descriptor) {
    reply.status(400).send(new Error("Incorrect descriptorId!"));
    return;
  }

  const objectToEncode = JSON.parse(req.body.json, (_key, value) => {
    if (typeof value === "string" && value.startsWith("0x")) {
      return Bytes.parseBytes(value, value.length / 2 - 1);
    }
    return value;
  });

  try {
    const encoded = Encoder.encodeObject(
      // biome-ignore lint/suspicious/noExplicitAny: I have no idea why it does not work without any
      descriptor.Codec as any,
      objectToEncode,
      chainSpec,
    );

    return { data: { codec: encoded.toString() } };
  } catch (e) {
    if (e instanceof Error) {
      reply.status(400).send(createErrorResponse("Incorrect input data", e.message));
      return;
    }
    req.log.error(e);
    reply.status(500).send(createErrorResponse("An unexpected error occurred", "We do not know yet ¯_(ツ)_/¯"));
  }
}
