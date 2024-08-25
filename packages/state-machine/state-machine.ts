import { EventEmitter } from "node:events";

type ExtractName<T> = T extends string ? (T extends infer U ? U : never) : never;
export type StateNames<T> = T extends State<infer U, infer _R> ? ExtractName<U> : never;
export type StateData<T> = T extends State<infer _U, infer _R, infer D> ? D : never;

export type MessageHandler<T> = (data: unknown) => TransitionTo<T> | undefined;
export type RequestHandler<T, TRes = unknown> = (data: unknown) => Promise<RespondAndTransitionTo<TRes, T>>;

export type TransitionTo<TState> = {
  state: StateNames<TState>;
  data?: StateData<TState>;
};

export type RespondAndTransitionTo<TRes, TState> = {
  response?: TRes;
  transitionTo?: TransitionTo<TState>;
};

export type ValidTransitionFrom<T> = T extends State<infer _A, infer TAllowed> ? TAllowed : never;

export abstract class State<TName, TAllowedTransitions, TData = unknown> {
  public readonly stateName: TName;
  public readonly messageListeners: Map<string, MessageHandler<TAllowedTransitions>>;
  public readonly requestHandlers: Map<string, RequestHandler<TAllowedTransitions>>;

  protected readonly allowedTransitions: StateNames<TAllowedTransitions>[];
  protected data: TData | null = null;

  constructor({
    name,
    messageListeners = {},
    requestHandlers = {},
    allowedTransitions = [],
  }: {
    name: TName;
    messageListeners?: { [message: string]: MessageHandler<TAllowedTransitions> };
    requestHandlers?: { [request: string]: RequestHandler<TAllowedTransitions> };
    allowedTransitions?: StateNames<TAllowedTransitions>[];
  }) {
    this.stateName = name;
    // TODO [ToDr] Verify that all `TAllowedTransitions` types are present.
    this.allowedTransitions = allowedTransitions;
    this.messageListeners = new Map(Object.entries(messageListeners));
    this.requestHandlers = new Map(Object.entries(requestHandlers));
  }

  public onActivation(data: TData) {
    console.log(`[${this.constructor.name}] Changing state to: ${this.stateName}`);
    this.data = data;
  }

  public canTransitionTo(name: StateNames<TAllowedTransitions>): boolean {
    return this.allowedTransitions.indexOf(name) !== -1;
  }

  toString() {
    return `<State ${this.stateName}>`;
  }
}

export class StateMachine<CurrentState extends TStates, TStates extends State<StateNames<TStates>, TStates>> {
  private state: CurrentState;
  private allStates: Map<StateNames<TStates>, TStates>;
  private stateListeners = new EventEmitter();

  constructor(initialState: CurrentState, allStates: TStates[]) {
    this.state = initialState;
    this.allStates = new Map();
    for (const s of allStates) {
      this.allStates.set(s.stateName, s);
    }
  }

  currentState(): CurrentState {
    return this.state;
  }

  waitForState<TNewState extends TStates>(state: StateNames<TNewState>): Promise<StateMachine<TNewState, TStates>> {
    return new Promise((resolve) => {
      // TODO [ToDr] reject when finished/error?
      this.stateListeners.once(state, resolve);
    });
  }

  transition<TNewState extends ValidTransitionFrom<CurrentState> & TStates>(
    newStateName: StateNames<TNewState>,
    data: unknown,
  ): StateMachine<TNewState, TStates> {
    if (this.state.stateName === newStateName) {
      throw new Error("Attempting transition to already active state!");
    }

    if (!this.state.canTransitionTo(newStateName)) {
      throw new Error(`Unallowed transition from ${this.state.stateName} to ${newStateName}`);
    }

    const newState = this.allStates.get(newStateName);
    if (!newState) {
      throw new Error(`Unavailable state: ${newStateName}`);
    }

    // set data
    newState.onActivation(data);

    // perform the transition to a new state and fire events
    const self = this.transitionTo<TNewState>(newState);
    self.stateListeners.emit(newStateName, self);
    return self;
  }

  private transitionTo<TNewState extends TStates>(state: TStates): StateMachine<TNewState, TStates> {
    // TODO [ToDr] more elegant solution to type transition?
    const self = this as unknown as StateMachine<TNewState, TStates>;
    self.state = state as TNewState;
    return self;
  }
}
