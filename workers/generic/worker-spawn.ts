import { Worker } from "node:worker_threads";
import type { Logger } from "@typeberry/logger";
import { MessageChannelStateMachine, type State, type StateData, type StateNames } from "@typeberry/state-machine";
import type { Finished } from "./finished.js";
import { stateMachineMain } from "./main-init.js";

export async function spawnWorkerGeneric<TReady extends State<StateNames<TReady>, Finished, StateData<TReady>>>(
  bootstrapPath: URL,
  logger: Logger,
  mainReadyName: StateNames<TReady>,
  mainReadyState: TReady,
) {
  const worker = new Worker(bootstrapPath);

  const machine = stateMachineMain(`main->${mainReadyName}`, mainReadyName, mainReadyState);
  const channel = await MessageChannelStateMachine.createAndTransferChannel(machine, worker);
  logger.trace(`[${machine.name}] Worker spawned ${channel.currentState()}`);
  return channel;
}
