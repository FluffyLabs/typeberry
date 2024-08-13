import { MessageChannel, MessagePort, Worker } from 'node:worker_threads';
import { ProtocolState, StateMachine, StateNames, ValidTransitionFrom } from "./state-machine-utils";

export class MessageChannelStateMachine<
  CurrentState extends TStates,
  TStates extends ProtocolState<
    StateNames<TStates>,
    TStates,
    TStates
  >
> {
  private readonly port: MessagePort;

  constructor(
    public readonly machine: StateMachine<CurrentState, TStates>,
    worker: Worker,
  ) {
    const channel = new MessageChannel();
    this.port = channel.port2;
    this.port.on('message', (msg) => {
      this.dispatchMessage(msg);
    });

    worker.postMessage({
      channel: channel.port1,
    }, [channel.port1]);
  }

  dispatchMessage(msg: {}) {

  }
}

