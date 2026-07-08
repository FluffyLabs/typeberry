import type { JsonObject } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";

/** RPC server options. */
export class RpcOptions {
  static fromJson = json.object<JsonObject<RpcOptions>, RpcOptions>(
    {
      port: "number",
    },
    RpcOptions.new,
  );

  static new({ port }: { port: number }) {
    return new RpcOptions(port);
  }

  private constructor(
    /** Port for the JSON-RPC WebSocket server. */
    public readonly port: number,
  ) {}
}
