export const Ok = "OK";

export type MessageKind = "signal" | "request" | "response" | "subscribe" | "subscription";

export type Message = {
  kind: MessageKind;
  id: number;
  name: string;
  data: unknown;
  localState: string;
};
