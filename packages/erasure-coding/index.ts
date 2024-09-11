const data = require('./data.json');
console.log(data.data.length)
console.log(data.segment.segments[0].segment_ec.join('').length)
console.log("hello erasure-coding");

var ReedSolomon = require('@ronomon/reed-solomon');
console.log('ReedSolomon.MAX_K', ReedSolomon.MAX_K)
// Specify the number of data shards (<= ReedSolomon.MAX_K):
var k = 342;

// Specify the number of parity shards (<= ReedSolomon.MAX_M):
var m = 1023 - k; // Protect against the loss of any 3 data or parity shards.

// Create an encoding context (can be cached and re-used concurrently):
var context = ReedSolomon.create(k, m);

// Specify the size of each shard in bytes (must be a multiple of 8 bytes):
var shardSize = 16;

console.log('data length', shardSize * k)
// Allocate the data buffer containing all data shards:
var buffer = Buffer.alloc(shardSize * k);

// Specify the offset into the data buffer at which data shards begin:
// This allows you to include a header.
var bufferOffset = 0;

// Specify the size after this offset of all data shards:
// This allows you to include a footer.
var bufferSize = shardSize * k;

// Allocate the parity buffer containing all parity shards:
var parity = Buffer.alloc(shardSize * m);

// Specify the offset into the parity buffer at which parity shards begin:
// This allows you to include a header.
var parityOffset = 0;

// Specify the size after this offset of all parity shards:
// This allows you to include a footer.
var paritySize = shardSize * m;

// Specify the sources, present in buffer or parity (as bit flags):
// We are encoding parity shards, so we mark all data shards as sources.
var sources = 0;
for (var i = 0; i < k; i++) sources |= (1 << i);

// Specify the targets, missing in buffer or parity, which should be encoded:
// We are encoding parity shards, so we mark all parity shards as targets:
var targets = 0;
for (var i = k; i < k + m; i++) targets |= (1 << i);

// Encode all parity shards:
ReedSolomon.encode(
  context,
  sources,
  targets,
  buffer,
  bufferOffset,
  bufferSize,
  parity,
  parityOffset,
  paritySize,
  function(error: Error) {
    if (error) throw error;
    // Parity shards now contain parity data.
  }
);