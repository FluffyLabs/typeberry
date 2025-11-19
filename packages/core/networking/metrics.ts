import { metrics } from "@opentelemetry/api";

/**
 * Network metrics for JAM implementation.
 *
 * JIP-3 Events 20-28 (Networking): https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#networking-events
 */

const meter = metrics.getMeter("@typeberry/networking", "0.4.0");

export const connectionRefusedCounter = meter.createCounter("jam.jip3.connection_refused", {
  description: "Connection refused events",
  unit: "events",
});

export const connectingInCounter = meter.createCounter("jam.jip3.connecting_in", {
  description: "Inbound connection attempts",
  unit: "events",
});

export const connectInFailedCounter = meter.createCounter("jam.jip3.connect_in_failed", {
  description: "Inbound connection failures",
  unit: "errors",
});

export const connectedInCounter = meter.createCounter("jam.jip3.connected_in", {
  description: "Successful inbound connections",
  unit: "connections",
});

export const connectingOutCounter = meter.createCounter("jam.jip3.connecting_out", {
  description: "Outbound connection attempts",
  unit: "events",
});

export const connectOutFailedCounter = meter.createCounter("jam.jip3.connect_out_failed", {
  description: "Outbound connection failures",
  unit: "errors",
});

export const connectedOutCounter = meter.createCounter("jam.jip3.connected_out", {
  description: "Successful outbound connections",
  unit: "connections",
});

export const disconnectedCounter = meter.createCounter("jam.jip3.disconnected", {
  description: "Disconnection events",
  unit: "events",
});

export const connectionDuration = meter.createHistogram("jam.jip3.connection_duration", {
  description: "Duration of network connections",
  unit: "ms",
});

export const peerMisbehavedCounter = meter.createCounter("jam.jip3.peer_misbehaved", {
  description: "Peer misbehavior events",
  unit: "events",
});

// Connection state gauges - use provider functions to observe real state
let getActiveConnectionsCount: () => number = () => 0;
let getConnectedPeersCount: () => number = () => 0;
let getActiveStreamsCount: () => number = () => 0;

/**
 * Set the provider functions that supply real-time state for observable gauges.
 * This should be called by the networking layer to inject actual connection/stream counts.
 *
 * @param providers - Functions that return current counts for connections, peers, and streams
 */
export function setGaugeProviders(providers: {
  activeConnections: () => number;
  connectedPeers: () => number;
  activeStreams: () => number;
}): void {
  getActiveConnectionsCount = providers.activeConnections;
  getConnectedPeersCount = providers.connectedPeers;
  getActiveStreamsCount = providers.activeStreams;
}

export const activeConnectionsGauge = meter.createObservableGauge("jam.networking.connections.active", {
  description: "Number of active network connections",
  unit: "connections",
});
activeConnectionsGauge.addCallback((observableResult) => {
  observableResult.observe(getActiveConnectionsCount());
});

export const connectedPeersGauge = meter.createObservableGauge("jam.networking.peers.connected", {
  description: "Number of connected peers",
  unit: "peers",
});
connectedPeersGauge.addCallback((observableResult) => {
  observableResult.observe(getConnectedPeersCount());
});

// Stream metrics
export const activeStreamsGauge = meter.createObservableGauge("jam.networking.streams.active", {
  description: "Number of active QUIC streams",
  unit: "streams",
});
activeStreamsGauge.addCallback((observableResult) => {
  observableResult.observe(getActiveStreamsCount());
});

export const streamsOpenedCounter = meter.createCounter("jam.networking.streams.opened", {
  description: "Total number of streams opened",
  unit: "streams",
});

export const streamsClosedCounter = meter.createCounter("jam.networking.streams.closed", {
  description: "Total number of streams closed",
  unit: "streams",
});

// Data transfer metrics
export const bytesReceivedCounter = meter.createCounter("jam.networking.data.bytes_received", {
  description: "Total bytes received over the network",
  unit: "bytes",
});

export const bytesSentCounter = meter.createCounter("jam.networking.data.bytes_sent", {
  description: "Total bytes sent over the network",
  unit: "bytes",
});

// Message metrics
export const messagesReceivedCounter = meter.createCounter("jam.networking.messages.received", {
  description: "Total messages received",
  unit: "messages",
});

export const messagesSentCounter = meter.createCounter("jam.networking.messages.sent", {
  description: "Total messages sent",
  unit: "messages",
});

export const messageProcessingDuration = meter.createHistogram("jam.networking.messages.processing_duration", {
  description: "Time taken to process incoming messages",
  unit: "ms",
});

// QUIC-specific metrics
export const quicPacketsReceived = meter.createCounter("jam.networking.quic.packets_received", {
  description: "Total QUIC packets received",
  unit: "packets",
});

export const quicPacketsSent = meter.createCounter("jam.networking.quic.packets_sent", {
  description: "Total QUIC packets sent",
  unit: "packets",
});

export const quicPacketsLost = meter.createCounter("jam.networking.quic.packets_lost", {
  description: "Total QUIC packets lost",
  unit: "packets",
});

export const quicRoundTripTime = meter.createHistogram("jam.networking.quic.rtt", {
  description: "QUIC round-trip time",
  unit: "ms",
});

// Helper functions
export function recordConnectionRefused(peerAddress: string): void {
  connectionRefusedCounter.add(1, { peer_address: peerAddress });
}

export function recordConnectingIn(peerAddress: string): void {
  connectingInCounter.add(1, { peer_address: peerAddress });
}

export function recordConnectInFailed(reason: string): void {
  connectInFailedCounter.add(1, { reason });
}

export function recordConnectedIn(peerId: string): void {
  connectedInCounter.add(1, { peer_id: peerId });
}

export function recordConnectingOut(peerId: string, peerAddress: string): void {
  connectingOutCounter.add(1, { peer_id: peerId, peer_address: peerAddress });
}

export function recordConnectOutFailed(reason: string): void {
  connectOutFailedCounter.add(1, { reason });
}

export function recordConnectedOut(peerId: string): void {
  connectedOutCounter.add(1, { peer_id: peerId });
}

export function recordDisconnected(peerId: string, side: "in" | "out", reason: string, durationMs: number): void {
  disconnectedCounter.add(1, { peer_id: peerId, side, reason });
  connectionDuration.record(durationMs, { side });
}

export function recordPeerMisbehaved(peerId: string, reason: string): void {
  peerMisbehavedCounter.add(1, { peer_id: peerId, reason });
}

export function recordStreamOpened(direction: "inbound" | "outbound"): void {
  streamsOpenedCounter.add(1, { direction });
}

export function recordStreamClosed(direction: "inbound" | "outbound"): void {
  streamsClosedCounter.add(1, { direction });
}

export function recordDataTransfer(direction: "sent" | "received", bytes: number): void {
  if (direction === "sent") {
    bytesSentCounter.add(bytes);
  } else {
    bytesReceivedCounter.add(bytes);
  }
}

export function recordMessage(direction: "sent" | "received", messageType?: string): void {
  const attributes = messageType !== undefined ? { message_type: messageType } : {};
  if (direction === "sent") {
    messagesSentCounter.add(1, attributes);
  } else {
    messagesReceivedCounter.add(1, attributes);
  }
}

export function recordMessageProcessing(durationMs: number, messageType?: string): void {
  const attributes = messageType !== undefined ? { message_type: messageType } : {};
  messageProcessingDuration.record(durationMs, attributes);
}

export function recordQuicPacket(direction: "sent" | "received", count = 1): void {
  if (direction === "sent") {
    quicPacketsSent.add(count);
  } else {
    quicPacketsReceived.add(count);
  }
}

export function recordQuicPacketLoss(count = 1): void {
  quicPacketsLost.add(count);
}

export function recordQuicRTT(rttMs: number): void {
  quicRoundTripTime.record(rttMs);
}
