import { Logger } from "@typeberry/logger";

const logger = Logger.new(import.meta.filename, "safeAllocUint8Array");

// about 2GB, the maximum ArrayBuffer length on Chrome confirmed by several sources:
// - https://issues.chromium.org/issues/40055619
// - https://stackoverflow.com/a/72124984
// - https://onnxruntime.ai/docs/tutorials/web/large-models.html#maximum-size-of-arraybuffer
export const MAX_LENGTH = 2145386496;

export function safeAllocUint8Array(length: number) {
  if (length > MAX_LENGTH) {
    logger.warn`Trying to allocate ${length} bytes, which is greater than the maximum of ${MAX_LENGTH}.`;
  }
  return new Uint8Array(Math.min(MAX_LENGTH, length));
}
