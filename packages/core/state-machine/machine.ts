import { EventEmitter } from "node:events";
import { check } from "@typeberry/utils";
import type { State, StateNames, ValidTransitionFrom } from "./state";

/**
 * Manager of multiple states with well-defined transitions between them.
 *
 * The state machine class is initialized with all possible state objects
 * and the initial state.
 *
 * Later on, the user of the class can perform some actions using the current state
 * object, and some of these actions may cause the machine to perform a state transition.
 *
 * Note this state machine is a pretty abstract one, it's not tied to a particular mechanism
 * of communication and can be used to simply manage the internal state of some object.
 */
export class StateMachine<CurrentState extends TStates, TStates extends State<StateNames<TStates>, TStates>> {
  private state: CurrentState;
  private readonly allStates: Map<StateNames<TStates>, TStates>;
  private readonly stateListeners = new EventEmitter();

  constructor(
    public readonly name: string,
    initialState: CurrentState,
    allStates: TStates[],
  ) {
    this.state = initialState;
    this.allStates = new Map();
    for (const s of allStates) {
      this.allStates.set(s.stateName, s);
    }
  }

  /** Get state object by name. */
  getState<TState extends TStates>(name: StateNames<TState>): TState {
    const state = this.allStates.get(name);
    check(state !== undefined, `Unable to retrieve state object for ${name}.`);
    return state as TState;
  }

  /** Get the currently active state object. */
  currentState(): CurrentState {
    return this.state;
  }

  /** Return a promise, which resolves when given `state` (name) becomes active. */
  waitForState<TNewState extends TStates>(state: StateNames<TNewState>): Promise<StateMachine<TNewState, TStates>> {
    if (this.state.stateName === state) {
      throw new Error(`Attempting to await a state that is already active: ${state}`);
    }

    return new Promise((resolve) => {
      // TODO [ToDr] reject when finished/error?
      this.stateListeners.once(state, resolve);
    });
  }

  /**
   * Transition the state machine into another allowed state.
   *
   * Note that this method may throw an exception in case the expected
   * state cannot be transitioned into.
   *
   * A new state machine is returned, and the current object should be discarded,
   * since it's type is going to be invalid.
   */
  transition<TNewState extends ValidTransitionFrom<CurrentState> & TStates>(
    newStateName: StateNames<TNewState>,
    data?: unknown,
  ): StateMachine<TNewState, TStates> {
    if (this.state.stateName === newStateName) {
      throw new Error("Attempting transition to already active state!");
    }

    if (!this.state.canTransitionTo(newStateName)) {
      throw new Error(`Unallowed transition from ${this.state} to ${newStateName}`);
    }

    const newState = this.allStates.get(newStateName);
    if (newState === undefined) {
      throw new Error(`Unavailable state: ${newStateName}`);
    }

    // call the onActivation hook and set the data
    newState.onActivation(data);

    // perform the transition to a new state and fire events
    const self = this.transitionTo<TNewState>(newState);
    self.stateListeners.emit(newStateName, self);

    return self;
  }

  /**
   * A private method to do the proper casting of `this` into the new, expected state.
   */
  private transitionTo<TNewState extends TStates>(state: TStates): StateMachine<TNewState, TStates> {
    // TODO [ToDr] more elegant solution to type transition?
    const self = this as unknown as StateMachine<TNewState, TStates>;
    self.state = state as TNewState;
    return self;
  }
}
