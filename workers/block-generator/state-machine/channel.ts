import { MessageChannel, MessagePort, type Worker } from "node:worker_threads";
import { check } from "@typeberry/utils";

import { type Message, Ok } from "./message";
import { TypedPort } from "./port";
import type { State, StateMachine, StateNames, TransitionTo, ValidTransitionFrom } from "./utils";

const CHANNEL_MESSAGE = "channel";

export interface TypedChannel {
  sendMessage(name: string, data: unknown): void;

  sendRequest<T>(name: string, data: unknown): Promise<T>;
}

export class MessageChannelStateMachine<
  CurrentState extends TStates,
  TStates extends State<StateNames<TStates>, TStates>,
> implements TypedChannel
{
  constructor(
    private readonly machine: StateMachine<CurrentState, TStates>,
    private readonly port: TypedPort,
  ) {
    port.listeners.on("message", (name: string, data: unknown, remoteState: string) => {
      try {
        const needsTransition = this.dispatchMessage(name, data);
        if (needsTransition) {
          this.machine.transition(needsTransition.state, needsTransition.data);
        }
      } catch (e) {
        console.error(`[${this.constructor.name}] Unable to dispatch message: ${e}. ${this.stateInfo(remoteState)}`);
        throw e;
      }
    });

    port.listeners.on("request", async (name: string, data: unknown, remoteState: string, msg: Message) => {
      try {
        await this.dispatchRequest(name, data, msg);
      } catch (e) {
        console.error(`[${this.constructor.name}] Unable to dispatch request: ${e}. ${this.stateInfo(remoteState)}`);
        throw e;
      }
    });
  }

  private stateInfo(remote: string) {
    return ` (local state: "${this.currentState().stateName}", remote state: "${remote}")`;
  }

  private async dispatchRequest(name: string, data: unknown, msg: Message) {
    const prevState = this.currentState();
    const handler = prevState.requestHandlers.get(name);
    if (!handler) {
      throw new Error(`Missing request handler for "${name}"`);
    }

    const res = await handler(data);
    // We need to check if we didn't change the state in the meantime.
    // In such case, the remote end is probably not expecting the response anyway,
    // but we still need to do the state transition.
    const didStateChangeInMeantime = this.currentState() !== prevState;

    // Check if we want to perform a state transition.
    if (res.transitionTo) {
      this.machine.transition(res.transitionTo.state, res.transitionTo.data);
    }

    if (didStateChangeInMeantime) {
      console.warn(`Ignoring obsolete response for an old request: "${name}"`);
      return;
    }

    return this.port.respond(prevState.stateName, msg, res.response);
  }

  private dispatchMessage(name: string, data: unknown): TransitionTo<ValidTransitionFrom<CurrentState>> | undefined {
    const handler = this.currentState().messageListeners.get(name);

    if (!handler) {
      throw new Error(`Unexpected message "${name}"`);
    }

    const newState = handler(data);
    return newState;
  }

  sendMessage(name: string, data: unknown) {
    this.port.sendMessage(this.currentState().stateName, name, data);
  }

  async sendRequest<TRes>(name: string, data: unknown): Promise<TRes> {
    return this.port.request(this.currentState().stateName, name, data);
  }

  async waitForState<TState extends TStates>(state: StateNames<TState>) {
    await this.machine.waitForState(state);
    return this.transitionTo<TState>();
  }

  currentState() {
    return this.machine.currentState();
  }

  async doUntil<TStateName extends StateNames<TStates>>(
    state: TStateName,
    work: (state: CurrentState, port: TypedChannel, isFinished: () => boolean) => Promise<void>,
  ) {
    const finish = this.waitForState(state).then(() => {
      isFinished.finished = true;
    });
    const isFinished = { finished: false };

    return Promise.all([work(this.currentState(), this, () => isFinished.finished), finish]);
  }

  transition<TNewState extends ValidTransitionFrom<CurrentState>>(
    f: (state: CurrentState, port: TypedChannel) => TransitionTo<TNewState>,
  ) {
    const currentState = this.currentState();
    const newStateName = f(currentState, this);
    this.machine.transition<TNewState>(newStateName.state, newStateName.data);
    return this.transitionTo<TNewState>();
  }

  private transitionTo<TNewState extends TStates>(): MessageChannelStateMachine<TNewState, TStates> {
    return this as unknown as MessageChannelStateMachine<TNewState, TStates>;
  }

  close() {
    this.port.close();
  }

  static async createAndTransferChannel<
    CurrentState extends TStates,
    TStates extends State<StateNames<TStates>, TStates>,
  >(machine: StateMachine<CurrentState, TStates>, worker: Worker) {
    const channel = new MessageChannel();
    const port = new TypedPort(channel.port2);
    const stateName = machine.currentState().stateName;

    const [request, promise] = port.prepareRequest(stateName, CHANNEL_MESSAGE, channel.port1);
    worker.postMessage(request, [channel.port1]);

    try {
      await promise;
    } catch (e) {
      console.error(e);
    }
    return new MessageChannelStateMachine(machine, port);
  }

  static async receiveChannel<CurrentState extends TStates, TStates extends State<StateNames<TStates>, TStates>>(
    machine: StateMachine<CurrentState, TStates>,
    parentPort: MessagePort | null,
  ) {
    if (!parentPort) {
      throw new Error("This code is expected to be run in a worker.");
    }

    const promise = new Promise<TypedPort>((resolve, reject) => {
      parentPort.once("message", (value: Message) => {
        try {
          check(value.kind === "request", "The initial message should be a request with channel.");
          check(value.name === CHANNEL_MESSAGE);
          check(value.data instanceof MessagePort);
          const port = new TypedPort(value.data as MessagePort);
          port.respond(machine.currentState().stateName, value, Ok);
          resolve(port);
        } catch (e) {
          reject(e);
        }
      });
    });
    const port = await promise;
    return new MessageChannelStateMachine(machine, port);
  }
}
