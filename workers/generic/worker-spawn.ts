import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import type { Logger } from "@typeberry/logger";
import { MessageChannelStateMachine, type State, type StateData, type StateNames } from "@typeberry/state-machine";
import type { Finished } from "./finished";
import { stateMachineMain } from "./main-init";

const BOOTSTRAP_FILE = "./bootstrap.js";

export async function spawnWorkerGeneric<TReady extends State<StateNames<TReady>, Finished, StateData<TReady>>>(
  dirname: string,
  logger: Logger,
  mainReadyName: StateNames<TReady>,
  mainReadyState: TReady,
) {
  const worker = new Worker(resolve(dirname, BOOTSTRAP_FILE));

  const machine = stateMachineMain(`main->${mainReadyName}`, mainReadyName, mainReadyState);
  const channel = await MessageChannelStateMachine.createAndTransferChannel(machine, worker);
  logger.trace(`Worker spawned ${channel.currentState()}`);
  return channel;
}
