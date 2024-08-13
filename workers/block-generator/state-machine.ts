import type { Worker } from "node:worker_threads";
import { MessageChannelStateMachine } from "./state-machine-channel";
import { ProtocolState, StateMachine } from "./state-machine-utils";

export function mainStateMachine(worker: Worker) {
  const spawning = new SpawningMain();
  const configuring = new Configuring();
  const ready = new Ready();
  const finished = new Finished();

  const machine = new MessageChannelStateMachine<SpawningMain, States>(
    new StateMachine(spawning, [spawning, configuring, ready, finished]),
    worker,
  );

  return machine;
}

export type States = Spawning | Configuring | Ready | Finished;

class Spawning extends ProtocolState<"spawning", States, Configuring> {
  constructor() {
    super({
      name: "spawning",
      allowedTransitions: ["configuring"],
    });
  }
}

export class SpawningMain extends Spawning {
  spawn() {}
  onWaitingForConfig() {}
}

export class SpawningWorker extends Spawning {
  waitingForConfig() {}
}

export class Configuring extends ProtocolState<"configuring", States, Ready> {
  constructor() {
    super({
      name: "configuring",
      allowedTransitions: ["ready"],
    });
  }

  sendConfig() {}

  onConfigured() {}
}

export class Ready extends ProtocolState<"ready", States, Finished> {
  constructor() {
    super({
      name: "ready",
      allowedTransitions: ["finished"],
    });
  }

  close() {}

  onClosed() {}
}

export class Finished extends ProtocolState<"finished", States, never> {
  constructor() {
    super({ name: "finished" });
  }
}
