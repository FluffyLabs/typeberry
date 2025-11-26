import { metrics } from "@opentelemetry/api";
import packageJson from "./package.json" with { type: "json" };

/**
 * Network metrics for JAM implementation.
 *
 * https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#networking-events
 */

export function createMetrics() {
  const meter = metrics.getMeter(packageJson.name, packageJson.version);

  const connectionDuration = meter.createHistogram("jam.connectionTime", {
    description: "Duration of connection to another peer",
    unit: "ms",
  });

  // JIP

  // 20
  const connectionRefusedCounter = meter.createCounter("jam.jip3.connection_refused", {
    description: "Connection refused events",
    unit: "events",
  });

  // 21
  const connectingInCounter = meter.createCounter("jam.jip3.connecting_in", {
    description: "Inbound connection attempts",
    unit: "events",
  });

  // 22
  const connectInFailedCounter = meter.createCounter("jam.jip3.connect_in_failed", {
    description: "Inbound connection failures",
    unit: "errors",
  });

  // 23
  const connectedInCounter = meter.createCounter("jam.jip3.connected_in", {
    description: "Successful inbound connections",
    unit: "connections",
  });

  // 24
  const connectingOutCounter = meter.createCounter("jam.jip3.connecting_out", {
    description: "Outbound connection attempts",
    unit: "events",
  });

  // 25
  const connectOutFailedCounter = meter.createCounter("jam.jip3.connect_out_failed", {
    description: "Outbound connection failures",
    unit: "errors",
  });

  // 26
  const connectedOutCounter = meter.createCounter("jam.jip3.connected_out", {
    description: "Successful outbound connections",
    unit: "connections",
  });

  // 27
  const disconnectedCounter = meter.createCounter("jam.jip3.disconnected", {
    description: "Disconnection events",
    unit: "events",
  });

  // 28
  const peerMisbehavedCounter = meter.createCounter("jam.jip3.peer_misbehaved", {
    description: "Peer misbehavior events",
    unit: "events",
  });

  return {
    recordConnectionRefused(peerAddress: string): void {
      connectionRefusedCounter.add(1, { peer_address: peerAddress });
    },

    recordConnectingIn(peerAddress: string): void {
      connectingInCounter.add(1, { peer_address: peerAddress });
    },

    recordConnectInFailed(reason: string): void {
      connectInFailedCounter.add(1, { reason });
    },

    recordConnectedIn(peerId: string): void {
      connectedInCounter.add(1, { peer_id: peerId });
    },

    recordConnectingOut(peerId: string, peerAddress: string): void {
      connectingOutCounter.add(1, { peer_id: peerId, peer_address: peerAddress });
    },

    recordConnectOutFailed(reason: string): void {
      connectOutFailedCounter.add(1, { reason });
    },

    recordConnectedOut(peerId: string): void {
      connectedOutCounter.add(1, { peer_id: peerId });
    },

    recordDisconnected(peerId: string, side: "in" | "out", reason: string, durationMs: number): void {
      disconnectedCounter.add(1, { peer_id: peerId, side, reason });
      connectionDuration.record(durationMs, { side });
    },

    recordPeerMisbehaved(peerId: string, reason: string): void {
      peerMisbehavedCounter.add(1, { peer_id: peerId, reason });
    },
  };
}
