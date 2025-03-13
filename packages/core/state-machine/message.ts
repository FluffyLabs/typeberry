/**
 * Response used to indicate the OK state.
 */
export const Ok = "OK";

/**
 * The kind of message sent over communication channel.
 */
export type MessageKind = "signal" | "request" | "response" | "subscribe" | "subscription";

/**
 * The message envelope.
 */
export type Message = {
  /** The kind of the message. */
  kind: MessageKind;
  /** Unique id of the message. */
  id: number;
  /** Name of the event being sent. */
  name: string;
  /** Attached data. */
  data: unknown;
  /** Local state of the sender. Can be used to assert on the overall state of the app. */
  localState: string;
};

/**
 * Some preliminary validation of incoming message.
 */
export function isValidMessage(msg: unknown): msg is Message {
  if (msg === null || typeof msg !== "object") {
    return false;
  }

  if (!("kind" in msg) || typeof msg.kind !== "string") {
    return false;
  }

  if (!("id" in msg) || typeof msg.id !== "number") {
    return false;
  }

  if (!("name" in msg) || typeof msg.name !== "string") {
    return false;
  }

  if (!("data" in msg)) {
    return false;
  }

  if (!("localState" in msg) || typeof msg.localState !== "string") {
    return false;
  }

  return true;
}
