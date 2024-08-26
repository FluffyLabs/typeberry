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
