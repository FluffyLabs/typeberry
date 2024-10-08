import { Logger } from "@typeberry/logger";

type ExtractName<T> = T extends string ? (T extends infer U ? U : never) : never;

/**
 * Given a union of States return their names.
 */
export type StateNames<T> = T extends State<infer U, infer _R> ? ExtractName<U> : never;
/**
 * Given a union of States return their expected activation data.
 */
export type StateData<T> = T extends State<infer _U, infer _R, infer D> ? D : never;

/**
 * Given a State, return a union of types that this state might be transitioned into.
 */
export type ValidTransitionFrom<T> = T extends State<infer _A, infer TAllowed> ? TAllowed : never;

/**
 * A function that can handle incoming signal.
 *
 * Signals are one-way messages that don't require any confirmation or response.
 *
 * Signal handling might end up transitioning the state machine into a new state.
 * Note that the transition has to happen synchronously.
 *
 * Example: a main thread sends a signal with configuration details to a worker thread.
 * Example: an unverified block is received in the networking worker and send further.
 */
export type SignalHandler<T> = (data: unknown) => TransitionTo<T> | undefined;

/**
 * A function that can respond to requests from other parts of code (or workers).
 *
 * The sender expects a response to every request. The only exception is when
 * the there was a state change in the meantime (i.e. between request and response).
 *
 * Requests are a regular pattern of async communication between workers so most often
 * there would be no state change.
 *
 * However if a state change is required it may happen AFTER the response is generated,
 * but before it's sent. Such request is sent by the sender only once, in expectation
 * for the receiver to do some async work and then transition to some other state.
 *
 * Example: a main thread sends a request to stop the worker.
 */
export type RequestHandler<T, TRes = unknown> = (data: unknown) => Promise<RespondAndTransitionTo<TRes, T>>;

/**
 * Intent of local state transition.
 *
 * This type may be returned by either signal listeners or request handlers
 * in expectation of the local state machine to transition to given state.
 *
 * Additional data might be passed between the states.
 */
export type TransitionTo<TState> = {
  state: StateNames<TState>;
  data?: StateData<TState>;
};

/**
 * An extended version of [`TransitionTo`] returned by request handlers.
 *
 * The object contains a state transition intent but also a response
 * that should be returned to the requester.
 */
export type RespondAndTransitionTo<TRes, TState> = {
  response?: TRes;
  transitionTo?: TransitionTo<TState>;
};

const logger = Logger.new(__filename, "state-machine/state");
/**
 * A state object that can be extended with some state-specific methods.
 *
 * Each state object should have only one instance and we use it's name,
 * to perform the transitions. State objects are stored within the state machine
 * and should not be referenced from other places to avoid inconsistency
 * in the active state.
 *
 * The state object also specifies signals it responds to and what
 * requests it can handle along with a list of names of other states
 * current state can transition into.
 */
export abstract class State<TName, TAllowedTransitions, TData = unknown> {
  /**
   * The name of the state. It has to be unique within the state machine.
   */
  public readonly stateName: TName;
  /**
   * A map of signals the state can receive.
   *
   * This property is exposed publicly only for reading - it is NOT meant to be
   * altered.
   */
  public readonly signalListeners: Map<string, SignalHandler<TAllowedTransitions>>;
  /**
   * A map of requests the state can respond to.
   *
   * This property is exposed publicly only for reading - it is NOT meant to be
   * altered.
   */
  public readonly requestHandlers: Map<string, RequestHandler<TAllowedTransitions>>;

  protected readonly allowedTransitions: StateNames<TAllowedTransitions>[];
  protected data: TData | null = null;

  constructor({
    name,
    signalListeners = {},
    requestHandlers = {},
    allowedTransitions = [],
  }: {
    name: TName;
    signalListeners?: { [signal: string]: SignalHandler<TAllowedTransitions> };
    requestHandlers?: { [request: string]: RequestHandler<TAllowedTransitions> };
    allowedTransitions?: StateNames<TAllowedTransitions>[];
  }) {
    this.stateName = name;
    this.allowedTransitions = allowedTransitions;
    this.signalListeners = new Map(Object.entries(signalListeners));
    this.requestHandlers = new Map(Object.entries(requestHandlers));
  }

  /**
   * A state hook, called when that state becomes active and receives some input data.
   *
   * The method can be overridden by implementations to perform some other on-activation
   * actions.
   */
  onActivation(data: TData) {
    logger.log(`[${this.constructor.name}] Changing state to: ${this}`);
    this.data = data;
  }

  /**
   * Allow a particular state transtion from this state to some other.
   *
   * By default we simply check if the state is part of the `allowedTransitions` array,
   * but the method can be overridden to perform some more complex checks.
   *
   * Note that disallowing a transition will trigger an exception and is only used
   * as an additional precaution of expected application state.
   */
  canTransitionTo(name: StateNames<TAllowedTransitions>): boolean {
    return this.allowedTransitions.indexOf(name) !== -1;
  }

  /**
   * Return a human-readable name of this state used in logs.
   */
  toString() {
    return `<State ${this.stateName}>`;
  }
}
