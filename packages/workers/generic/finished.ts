import { State, type TypedChannel } from "@typeberry/state-machine";

export class Finished extends State<"finished", never, Promise<null>> {
  constructor() {
    super({
      name: "finished",
    });
  }

  close(channel: TypedChannel) {
    channel.close();
  }

  async waitForWorkerToFinish() {
    return this.data;
  }
}
