import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import type { Header } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { JSONRPCServer } from "json-rpc-2.0";

export interface Database {
  bestHeader: Header | null;
}

export function startRpc(db: Database) {
  const server = new JSONRPCServer();
  server.addMethod("jam_bestHeader", () => {
    return db.bestHeader;
  });

  const httpServer = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(200);
      fs.createReadStream(path.join(__dirname, "index.html")).pipe(res);
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
            JSON.stringify(response, (key, val) => {
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

  httpServer.listen(3000, () => {
    console.info("Listening for RPC at :3000");
  });
}
