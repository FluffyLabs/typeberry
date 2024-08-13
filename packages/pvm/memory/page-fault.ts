export class PageFault extends Error {
  constructor(public address: number) {
    super(`Page fault: ${address}`);
  }
}
