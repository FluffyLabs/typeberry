import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { JSONRPCID, JSONRPCSuccessResponse } from "./../../node_modules/json-rpc-2.0/dist/models.d";

import type { Header } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import * as ce129 from "@typeberry/ext-ipc/protocol/ce-129-state-request";
import { blake2b } from "@typeberry/hash";
import { JSONRPCServer } from "json-rpc-2.0";
import type { MessageHandler } from "../../extensions/ipc/handler";

export interface Database {
  bestHeader: Header | null;
}

export function startRpc(db: Database, client: MessageHandler) {
  const server = new JSONRPCServer();
  server.addMethod("jam_bestHeader", () => {
    return db.bestHeader;
  });

  server.addMethodAdvanced("jam_getBalance", (request) => {
    return new Promise((resolve) => {
      client.withNewStream<typeof ce129.STREAM_KIND, ce129.Handler>(ce129.STREAM_KIND, (handler, sender) => {
        if (!db.bestHeader) return;

        const key: string = request.params.accountId;
        const handleResponse = (response: ce129.StateResponse) => {
          const rpcResponse: JSONRPCSuccessResponse = {
            jsonrpc: request.jsonrpc,
            id: request.id as JSONRPCID,
            result: response.keyValuePairs[0].value,
          };
          resolve(rpcResponse);
        };

        handler.getStateByKey(
          sender,
          db.bestHeader.parentHeaderHash,
          Bytes.fromBlob(blake2b.hashString(key).raw.subarray(0, ce129.KEY_SIZE), ce129.KEY_SIZE),
          handleResponse,
        );
      });
    });
  });

  const httpServer = http.createServer((req, res) => {
    if (req.method !== "POST") {
      const isOptions = req.method !== "OPTIONS";
      res.writeHead(isOptions ? 204 : 200, {
        "Access-Control-Allow-Methods": "POST",
        "access-control-allow-origin": "*",
      });
      if (isOptions) {
        fs.createReadStream(path.join(__dirname, "index.html")).pipe(res);
      } else {
        res.end();
      }
      return;
    }

    let body = "";
    // Collect the data
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    // When all data has been received
    req.on("end", () => {
      server.receiveJSON(body).then((response) => {
        if (response) {
          res.writeHead(200, {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          });
          res.write(
            JSON.stringify(response, (_key, val) => {
              if (val instanceof Bytes) {
                return val.toString();
              }
              if (val instanceof BytesBlob) {
                return val.toString();
              }
              return val;
            }),
          );
          res.end();
        } else {
          res.writeHead(204);
          res.end();
        }
      });
    });
  });

  httpServer.listen(
    {
      port: 3000,
    },
    () => {
      console.info("Listening for RPC at :3000");
    },
  );

  return httpServer;
}
