import type { HeaderHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { ce129, up0 } from "@typeberry/jamnp-s";
import type { Listener } from "@typeberry/listener";
import type { TrieNode } from "@typeberry/trie/nodes.js";
import { startIpcServer } from "../server.js";
import { JamnpIpcHandler } from "./handler.js";

/** An IPC endpoint exposing network-like messaging protocol. */
export function startJamnpIpcServer(
  chainSpec: ChainSpec,
  announcements: Listener<up0.Announcement>,
  getHandshake: () => up0.Handshake,
  getBoundaryNodes: (hash: HeaderHash, startKey: ce129.Key, endKey: ce129.Key) => TrieNode[],
  getKeyValuePairs: (hash: HeaderHash, startKey: ce129.Key, endKey: ce129.Key) => ce129.KeyValuePair[],
) {
  return startIpcServer("typeberry-jamnp", (sender) => {
    const handler = new JamnpIpcHandler(sender);
    // Send block announcements
    const listener = (announcement: unknown) => {
      if (announcement instanceof up0.Announcement) {
        handler.withStreamOfKind(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
          handler.sendAnnouncement(sender, announcement);
        });
      } else {
        throw new Error(`Invalid annoncement received: ${announcement}`);
      }
    };
    announcements.on(listener);
    handler.waitForEnd().finally(() => {
      announcements.off(listener);
    });

    handler.registerStreamHandlers(
      new up0.Handler(
        chainSpec,
        getHandshake,
        () => {},
        () => {},
      ),
    );
    handler.registerStreamHandlers(new ce129.Handler(true, getBoundaryNodes, getKeyValuePairs));
    return handler;
  });
}
