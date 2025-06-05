## Data Structure and Erasure Coding

This document outlines the data structures and erasure coding scheme used.

### Core Units

* **`Piece`**: A fundamental data unit of **684 bytes**.
* **`Segment`**: Composed of **6 `Pieces`**, totaling **4104 bytes** (6 * 684 bytes).
* **`Point`**: The smallest component within a `Chunk`, consisting of **2 bytes**.

---

### Erasure Coding (EC) Process

Erasure coding is applied to a `Piece` or a multiple of `Pieces`.

* **Input**: Data to be encoded (must be a multiple of `Piece` size).
* **Output**: The EC process always generates **1023 `Chunks`**.
    * These consist of **342 main `Chunks`** (original data).
    * And **681 redundancy `Chunks`** (for recovery).
* **`Chunk` Composition**: Each `Chunk` is made up of `Points`. The number of `Points` per `Chunk` depends on the input data size:
    * If the input is a single **`Piece`** (684 bytes):
        * 1023 `Chunks` are produced.
        * Each `Chunk` contains **1 `Point`** (2 bytes).
        * Total data spread across `Chunks`: 1023 `Chunks` * 2 bytes/`Chunk` = 2046 bytes.
    * If the input is a single **`Segment`** (4104 bytes, i.e., 6 `Pieces`):
        * 1023 `Chunks` are produced.
        * Each `Chunk` contains **6 `Points`** (12 bytes).
        * Total data spread across `Chunks`: 1023 `Chunks` * 12 bytes/`Chunk` = 12276 bytes.
    * For other input sizes (always a multiple of a `Piece`), the number of `Points` per `Chunk` scales proportionally. For an input of $N \times \text{Piece}$, each of the 1023 `Chunks` will contain $N \text{ Points}$.

---

### Data Reconstruction

* To reconstruct the original encoded data, **any 342 `Chunks`** out of the 1023 available `Chunks` are required.

---

### Terminology: `Chunks` vs. `Shards`

* **`Chunk`**: A unit of data produced by the erasure coding process.
* **`Shard`**: A `Chunk` that has been distributed, for example, to validators in a network. Essentially, a `Shard` is a `Chunk` in the context of full network distribution.

---
