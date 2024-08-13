import { EventEmitter } from "node:events";

export type MessageEnvelope = {
  name: string;
  data: unknown;
};

export type ExtractName<T> = T extends string ? (T extends infer U ? U : never) : never;
export type StateNames<T> = T extends State<infer U> ? ExtractName<U> : never;
export type StateEventHandler<T> = (data: unknown) => StateNames<T> | null;

export abstract class State<TName> {
  constructor(protected stateName: TName) {}

  name(): TName {
    return this.stateName;
  }

  toString() {
    return `<State ${this.name()}>`;
  }
}

export type ValidTransitionFrom<T> = T extends ProtocolState<infer _A, infer _B, infer TAllowed> ? TAllowed : never;

export abstract class ProtocolState<TName, TAllStates, TAllowedTransitions extends TAllStates> extends State<TName> {
  protected allowedTransitions: StateNames<TAllowedTransitions>[];
  // TODO [ToDr] it would be cool if states defined emitted events / sent messages
  protected listeners: Map<string, StateEventHandler<TAllowedTransitions>>;

  constructor({
    name,
    listeners = new Map(),
    allowedTransitions = [],
  }: {
    name: TName;
    listeners?: Map<string, StateEventHandler<TAllowedTransitions>>;
    allowedTransitions?: StateNames<TAllowedTransitions>[];
  }) {
    super(name);
    // TODO [ToDr] Verify that all `TAllowedTransitions` types are present.
    this.allowedTransitions = allowedTransitions;
    this.listeners = listeners;
  }

  canTransitionTo(name: StateNames<TAllStates>): boolean {
    return this.allowedTransitions.indexOf(name) !== -1;
  }

  dispatchMessage(message: MessageEnvelope): StateNames<TAllowedTransitions> | null {
    const handler = this.listeners.get(message.name);
    if (handler) {
      const newState = handler(message.data);
      return newState;
    }

    // TODO [ToDr] handle error
    // TODO [ToDr] no handler - either call generic or display an error
    return null;
  }
}

export class StateMachine<
  CurrentState extends TStates,
  TStates extends ProtocolState<StateNames<TStates>, TStates, TStates>,
> {
  private state: CurrentState;
  private allStates: Map<StateNames<TStates>, TStates>;
  private stateListeners = new EventEmitter();

  constructor(initialState: CurrentState, allStates: TStates[]) {
    this.state = initialState;
    this.allStates = new Map();
    for (const s of allStates) {
      this.allStates.set(s.name(), s);
    }
  }

  currentState(): CurrentState {
    return this.state;
  }

  waitForState<TNewState extends TStates>(state: StateNames<TNewState>): Promise<StateMachine<TNewState, TStates>> {
    return new Promise((resolve) => {
      // TODO [ToDr] reject when finished/error?
      this.stateListeners.once(state, () => {
        if (this.cast(state)) {
          resolve(this);
        }
      });
    });
  }

  transition<TNewState extends ValidTransitionFrom<CurrentState> & TStates>(
    newStateName: StateNames<TNewState>,
  ): StateMachine<TNewState, TStates> {
    if (this.state.name() === newStateName) {
      throw new Error("Attempting transition to already active state!");
    }

    const newState = this.allStates.get(newStateName);
    if (!newState) {
      throw new Error(`Unavailable state: ${newStateName}`);
    }

    if (this.cast(newStateName)) {
      this.stateListeners.emit(newStateName, this);
      return this;
    } else {
      throw new Error(`Unallowed transition from ${this.state.name()} to ${newStateName}`);
    }
  }

  cast<TNewState extends TStates>(newStateName:  StateNames<TNewState>): this is StateMachine<TNewState, TStates> {
    return this.state.canTransitionTo(newStateName);
  }
}
