# Offline networking

`@typeberry/networking-offline` implements the same message boundaries as the
online JAM networking worker, but replaces peer traffic with a programmatic
controller. It does not import `@typeberry/node`, the online networking
implementation, Node worker utilities, or native cryptographic bindings.

`startOfflineNetworkingWorker(authorshipPort)` does not spawn an operating
system or Web Worker. The name reflects that it implements the standard
networking-worker protocol in the same thread.

## API surfaces

The returned object deliberately has two sides:

- `network` is the node-facing `NetworkingApi`. A host connects its importer to
  `setOnBlocks` and forwards newly imported headers with `sendNewHeader`.
- `offline` is the caller-facing `OfflineNetworking` controller. It accepts
  blocks and tickets programmatically and exposes the announcements that online
  networking would send to peers.

The supplied port is the offline-networking end of the authorship/networking
protocol. Its peer must be connected to block authorship for ticket submission
and outgoing ticket announcements. A host without authorship should attach a
`receivedTickets` handler which returns `false`.

`submitBlock` and `submitBlocks` confirm protocol delivery, not importer
acceptance. `submitTickets` returns authorship's validation decision. `finish()`
is idempotent; submissions reject after it completes.

## Dependency boundary

Direct subpath imports in this package are intentional. In particular, do not
replace them with the `@typeberry/jam-network`, `@typeberry/workers-api`, or
`@typeberry/comms-authorship-network` barrels without checking the resulting
dependency graph. Those barrels also expose environment-specific
implementations.

Run the focused checks with:

```sh
npm test -w @typeberry/networking-offline
npm run build -w @typeberry/lib
```
