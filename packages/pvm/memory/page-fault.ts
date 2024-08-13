export class PageFault extends Error {
  constructor(public address: number) {
    super(`Page fault: ${address}`);
  }

  static isPageFault(error: unknown): error is PageFault {
    return error instanceof PageFault;
  }
}
