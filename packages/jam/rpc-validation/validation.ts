import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import type { MethodName } from "./types.js";

export const JSON_RPC_VERSION = "2.0";

export const SUBSCRIBABLE_METHODS = {
  subscribeBestBlock: "unsubscribeBestBlock",
  subscribeFinalizedBlock: "unsubscribeFinalizedBlock",
  subscribeServiceData: "unsubscribeServiceData",
  subscribeServicePreimage: "unsubscribeServicePreimage",
  subscribeServiceRequest: "unsubscribeServiceRequest",
  subscribeServiceValue: "unsubscribeServiceValue",
  subscribeStatistics: "unsubscribeStatistics",
} as const satisfies Partial<Record<MethodName, MethodName>>;

export namespace validation {
  const u32 = z.number().int().min(0).max(0xffffffff);
  const uint8Array = z.custom<Uint8Array>((v) => v instanceof Uint8Array); // this is needed because a simple z.instanceof(Uint8Array) automatically narrows the type down to Uint8Array<ArrayBuffer> whereas our Bytes.raw are effectively Uint8Array<ArrayBufferLike>

  export const hash = z.codec(
    z.base64(),
    uint8Array.refine((v) => v.length === HASH_SIZE, "Invalid hash length."),
    {
      decode: (v) => Uint8Array.from(Buffer.from(v, "base64")),
      encode: (v) => Buffer.from(v).toString("base64"),
    },
  );
  export const slot = u32;
  export const blobArray = z.codec(z.base64(), uint8Array, {
    decode: (v) => Uint8Array.from(Buffer.from(v, "base64")),
    encode: (v) => Buffer.from(v).toString("base64"),
  });
  export const serviceId = u32;
  export const preimageLength = u32;
  export const noArgs = z.tuple([]);
  export const blockDescriptor = z.object({
    header_hash: hash,
    slot: slot,
  });

  export const parameters = z.object({
    V1: z.object({
      deposit_per_account: z.number(),
      deposit_per_item: z.number(),
      deposit_per_byte: z.number(),
      min_turnaround_period: z.number(),
      epoch_period: z.number(),
      max_accumulate_gas: z.number(),
      max_is_authorized_gas: z.number(),
      max_refine_gas: z.number(),
      block_gas_limit: z.number(),
      recent_block_count: z.number(),
      max_work_items: z.number(),
      max_dependencies: z.number(),
      max_tickets_per_block: z.number(),
      max_lookup_anchor_age: z.number(),
      tickets_attempts_number: z.number(),
      auth_window: z.number(),
      auth_queue_len: z.number(),
      rotation_period: z.number(),
      max_extrinsics: z.number(),
      availability_timeout: z.number(),
      val_count: z.number(),
      max_input: z.number(),
      max_refine_code_size: z.number(),
      basic_piece_len: z.number(),
      max_imports: z.number(),
      max_is_authorized_code_size: z.number(),
      max_exports: z.number(),
      max_refine_memory: z.number(),
      max_is_authorized_memory: z.number(),
      segment_piece_count: z.number(),
      max_report_elective_data: z.number(),
      transfer_memo_size: z.number(),
      epoch_tail_start: z.number(),
      core_count: z.number(),
      slot_period_sec: z.number(),
      max_authorizer_code_size: z.number(),
      max_service_code_size: z.number(),
    }),
  });

  export const notImplementedSchema = {
    input: z.tuple([]),
    output: z.any(),
  };

  export const unsubscribeSchema = {
    input: z.tuple([z.string()]),
    output: z.boolean(),
  };

  export const schemas = {
    beefyRoot: notImplementedSchema,
    submitPreimage: notImplementedSchema,
    submitWorkPackage: notImplementedSchema,
    bestBlock: {
      input: noArgs,
      output: blockDescriptor,
    },
    finalizedBlock: {
      input: noArgs,
      output: blockDescriptor,
    },
    listServices: {
      input: z.tuple([hash]),
      output: z.array(serviceId),
    },
    parameters: {
      input: noArgs,
      output: parameters,
    },
    parent: {
      input: z.tuple([hash]),
      output: blockDescriptor,
    },
    serviceData: {
      input: z.tuple([hash, serviceId]),
      output: z.union([blobArray, z.null()]),
    },
    servicePreimage: {
      input: z.tuple([hash, serviceId, hash]),
      output: z.union([blobArray, z.null()]),
    },
    serviceRequest: {
      input: z.tuple([hash, serviceId, hash, preimageLength]),
      output: z.union([z.array(slot).readonly(), z.null()]),
    },
    serviceValue: {
      input: z.tuple([hash, serviceId, blobArray]),
      output: z.union([blobArray, z.null()]),
    },
    stateRoot: {
      input: z.tuple([hash]),
      output: hash,
    },
    statistics: {
      input: z.tuple([hash]),
      output: blobArray,
    },
    subscribeBestBlock: {
      input: noArgs,
      output: z.string(),
    },
    subscribeFinalizedBlock: {
      input: noArgs,
      output: z.string(),
    },
    subscribeServiceData: {
      input: z.tuple([hash, serviceId]),
      output: z.string(),
    },
    subscribeServicePreimage: {
      input: z.tuple([hash, serviceId, hash]),
      output: z.string(),
    },
    subscribeServiceRequest: {
      input: z.tuple([hash, serviceId, hash, preimageLength]),
      output: z.string(),
    },
    subscribeServiceValue: {
      input: z.tuple([hash, serviceId, blobArray]),
      output: z.string(),
    },
    subscribeStatistics: {
      input: z.tuple([hash]),
      output: z.string(),
    },
    unsubscribeBestBlock: unsubscribeSchema,
    unsubscribeFinalizedBlock: unsubscribeSchema,
    unsubscribeServiceData: unsubscribeSchema,
    unsubscribeServicePreimage: unsubscribeSchema,
    unsubscribeServiceRequest: unsubscribeSchema,
    unsubscribeServiceValue: unsubscribeSchema,
    unsubscribeStatistics: unsubscribeSchema,
  } as const satisfies Record<string, { input: z.ZodTypeAny; output: z.ZodTypeAny }>;

  export const jsonRpcRequest = z.object({
    jsonrpc: z.literal(JSON_RPC_VERSION),
    method: z.string(),
    params: z.unknown().optional(),
    id: z.union([z.string(), z.number(), z.null()]),
  });

  export const jsonRpcNotification = jsonRpcRequest.omit({ id: true });
}
