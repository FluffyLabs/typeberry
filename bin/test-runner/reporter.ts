import { Transform, type TransformCallback } from "node:stream";

export class Reporter extends Transform {
  public headerPrinted = false;
  public currentTest = "";

  constructor() {
    super({
      writableObjectMode: true,
      transform: myTransform,
    });
  }
}

function myTransform(
  this: Reporter,
  event: { type: string; data: { name: string } },
  _encoding: BufferEncoding,
  callback: TransformCallback,
): void {
  switch (event.type) {
    case "test:start":
      this.currentTest = event.data.name;
      if (!this.headerPrinted) {
        callback(
          null,
          `
|  Name  |  Status  |
|--------|----------|
`,
        );
        this.headerPrinted = true;
      } else {
        callback(null);
      }
      break;
    case "test:pass":
      callback(null, `| ${this.currentTest} | ✅ |\n`);
      break;
    case "test:fail":
      callback(null, `| ${this.currentTest} | ❌ |\n`);
      break;
    default:
      callback(null);
  }
}
