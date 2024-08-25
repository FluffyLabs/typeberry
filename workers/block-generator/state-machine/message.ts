export const Ok = "OK";

export type MessageKind = "message" | "request" | "response" | "subscribe" | "subscription";

export type Message = {
  kind: MessageKind;
  id: number;
  name: string;
  data: unknown;
  localState: string;
};
