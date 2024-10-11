import type { WriteStream } from "node:fs";
import { Transform, type TransformCallback } from "node:stream";

export class Reporter extends Transform {
  public headerPrinted = false;
  public currentTest = "";
  public testPassed = 0;
  public testFailed = 0;

  constructor() {
    super({
      writableObjectMode: true,
      transform: myTransform,
    });
  }

  finalize(fileStream: WriteStream) {
    const status = this.testFailed === 0 ? "OK ✅" : "❌";
    fileStream.write(
      `</details>

### JAM test vectors ${this.testPassed}/${this.testPassed + this.testFailed} ${status}
      `,
    );
  }
}

type TestEvent = {
  type: string;
  data: {
    name: string;
    details: {
      error?: Error;
    };
  };
};

function myTransform(this: Reporter, event: TestEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
  switch (event.type) {
    case "test:start":
      this.currentTest = event.data.name;
      if (!this.headerPrinted) {
        callback(
          null,
          `
<details>
<summary>View all</summary>

|  Name  |  Status  | |
|--------|----------|-|
`,
        );
        this.headerPrinted = true;
      } else {
        callback(null);
      }
      break;
    case "test:pass":
      this.testPassed += 1;
      callback(null, `| ${this.currentTest} | ✅ | | \n`);
      break;
    case "test:fail": {
      this.testFailed += 1;
      let errorMsg = "";
      const failureCause = event.data.details.error?.cause;
      if (failureCause instanceof Error) {
        errorMsg = failureCause.message;
      }
      callback(null, `| ${this.currentTest} | ❌ | \`${errorMsg}\`|\n`);
      break;
    }
    default:
      callback(null);
  }
}
