import fs from "node:fs";
import http from "node:http";
import type { Header } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { JamnpIpcHandler } from "@typeberry/ext-ipc/jamnp/handler.js";
import { blake2b, TRUNCATED_HASH_SIZE } from "@typeberry/hash";
import { ce129 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { type JSONRPCID, JSONRPCServer, type JSONRPCSuccessResponse } from "json-rpc-2.0";

export interface Database {
  bestHeader: Header | null;
}

const logger = Logger.new(import.meta.filename, "rpc");

export function startRpc(db: Database, client: JamnpIpcHandler) {
  const server = new JSONRPCServer();
  server.addMethod("jam_bestHeader", () => {
    return db.bestHeader;
  });

  server.addMethodAdvanced("jam_getBalance", (request) => {
    return new Promise((resolve) => {
      client.withNewStream<ce129.Handler>(ce129.STREAM_KIND, (handler, sender) => {
        if (db.bestHeader === null) return;

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
          Bytes.fromBlob(blake2b.hashString(key).raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE),
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
        fs.createReadStream(`${import.meta.dirname}/index.html`).pipe(res);
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
        if (response !== null) {
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
      logger.info`Listening for RPC at :3000`;
    },
  );

  return httpServer;
}
