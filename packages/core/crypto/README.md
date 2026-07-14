# Crypto entry points

`@typeberry/crypto` is the complete cryptographic implementation. It includes
native/WASM initialization and signing or verification operations.

`@typeberry/crypto/browser.js` is the dependency-light entry point for code
which only needs encoded key/signature sizes and their opaque TypeScript types.
It has no runtime imports and does not expose cryptographic operations. Its
constants intentionally mirror the canonical values in `ed25519.ts` and
`bandersnatch.ts`; their literal type annotations and unit test catch drift.

Browser-facing codecs should import from `@typeberry/crypto/browser.js` rather
than the package root, so merely describing encoded data does not load native
implementations.
