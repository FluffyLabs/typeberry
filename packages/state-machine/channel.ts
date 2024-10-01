import { MessageChannel, MessagePort, type Worker } from "node:worker_threads";
import { check } from "@typeberry/utils";

import { Logger } from "@typeberry/logger";
import type { StateMachine } from "./machine";
import { type Message, Ok } from "./message";
import { TypedPort } from "./port";
import type { State, StateNames, TransitionTo, ValidTransitionFrom } from "./state";

const logger = Logger.new(__filename, "state-machine");

/**
 * An abstraction for the communication channel between worker threads.
 *
 * This type should be used by `State` objects (instead of the machine) to
 * send messages to another worker.
 */
export interface TypedChannel {
  /**
   * Send a `signal` to another worker thread.
   */
  sendSignal(name: string, data: unknown): void;

  /**
   * Send a `request` to another worker thread and await response.
   */
  sendRequest<T>(name: string, data: unknown): Promise<T>;

  /**
   * Close the communication channel with the other worker.
   */
  close(): void;
}

const CHANNEL_MESSAGE = "channel";

/**
 * A state machine wrapper meant to facilitate communication between worker threads.
 *
 * While the [`StateMachine`] is an abstract state manager independent from a particular
 * communication channel, this object is meant to wrap the state of the main thread, which
 * spawns a worker thread and want's to communicate with it.
 *
 * Similarly to the [`StateMachine`] the state objects should not be stored externally,
 * and the interaction should always happen with this class instance via [`TypedChannel`]
 * abstraction.
 */
export class MessageChannelStateMachine<
  CurrentState extends TStates,
  TStates extends State<StateNames<TStates>, TStates>,
> implements TypedChannel
{
  /**
   * Create new [`MessageChannelStateMachine`].
   *
   * While the constructor can be used directly, you might find it easier to use the static
   * methods [`createAndTransferChannel`] and [`receiveChannel`] to start the main and worker
   * threads accordingly.
   */
  constructor(
    private readonly machine: StateMachine<CurrentState, TStates>,
    private readonly port: TypedPort,
  ) {
    port.listeners.on("signal", (name: string, data: unknown, remoteState: string) => {
      try {
        this.dispatchSignal(name, data);
      } catch (e: unknown) {
        logger.error(`[${this.constructor.name}] Unable to dispatch signal: ${e}. ${this.stateInfo(remoteState)}`);
        throw e;
      }
    });

    port.listeners.on("request", async (name: string, data: unknown, remoteState: string, msg: Message) => {
      try {
        await this.dispatchRequest(name, data, msg);
      } catch (e: unknown) {
        logger.error(`[${this.constructor.name}] Unable to dispatch request: ${e}. ${this.stateInfo(remoteState)}`);
        throw e;
      }
    });
  }

  // [`TypedChannel`] API.

  /** Send a signal to the other thread. */
  sendSignal(name: string, data: unknown) {
    this.port.sendSignal(this.currentState().stateName, name, data);
  }

  /** Send a request to the other thread. */
  async sendRequest<TRes>(name: string, data: unknown): Promise<TRes> {
    return this.port.sendRequest(this.currentState().stateName, name, data);
  }

  /** Close the communication channel. */
  close() {
    this.port.close();
  }
  // End of [`TypedChannel`] API.

  /** Returns the current state object. */
  currentState() {
    return this.machine.currentState();
  }

  /** Return a promise that resolves when expected state is reached. */
  async waitForState<TState extends TStates>(state: StateNames<TState>) {
    await this.machine.waitForState(state);
    return this.transitionTo<TState>();
  }

  /**
   * A helper function to perform some work up until some other state is reached.
   *
   * The async closure is given the `isDone` function that can be periodically checked
   * to stop any on-going computation.
   */
  async doUntil<TState extends TStates>(
    state: StateNames<TState>,
    work: (state: CurrentState, port: TypedChannel, isDone: () => boolean) => Promise<void>,
  ) {
    const done = this.waitForState(state).then(() => {
      isDone.isDone = true;
    });
    const isDone = { isDone: false };

    await Promise.all([work(this.currentState(), this, () => isDone.isDone), done]);

    return this.transitionTo<TState>();
  }

  /**
   * Perform a state transition of this machine.
   *
   * Given current state object and the communication channel the machine
   * can change it's state.
   *
   * NOTE this has to be synchronous to avoid race conditions.
   */
  transition<TNewState extends ValidTransitionFrom<CurrentState>>(
    f: (state: CurrentState, port: TypedChannel) => TransitionTo<TNewState>,
  ) {
    const currentState = this.currentState();
    const newStateName = f(currentState, this);
    this.machine.transition<TNewState>(newStateName.state, newStateName.data);
    return this.transitionTo<TNewState>();
  }

  private stateInfo(remote: string) {
    return ` (local state: "${this.currentState()}", remote state: "${remote}")`;
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
      logger.warn(`Ignoring obsolete response for an old request: "${name}"`);
      return;
    }

    return this.port.respond(prevState.stateName, msg, res.response);
  }

  private dispatchSignal(name: string, data: unknown) {
    const handler = this.currentState().signalListeners.get(name);

    if (!handler) {
      throw new Error(`Unexpected signal "${name}"`);
    }

    const newState = handler(data);
    if (newState) {
      this.machine.transition(newState.state, newState.data);
    }
  }

  private transitionTo<TNewState extends TStates>(): MessageChannelStateMachine<TNewState, TStates> {
    return this as unknown as MessageChannelStateMachine<TNewState, TStates>;
  }

  /**
   * Creates a communcation channel and sends it over to the worker thread, which is
   * expected to await on that channel using [`receiveChannel`] method.
   *
   * The promise resolves when the worker has confirmed reception of the channel
   * and the communication is now established.
   */
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
      logger.error(JSON.stringify(e));
    }
    return new MessageChannelStateMachine(machine, port);
  }

  /**
   * Await for the incoming communication channel on the `parentPort`.
   *
   * The promise resolves when the communication channel is received and an ACK message
   * is sent back to the main thread.
   */
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
