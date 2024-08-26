import assert from "node:assert";
import { describe, it } from "node:test";
import { MessageChannel } from "node:worker_threads";

import { MessageChannelStateMachine } from "./channel";
import { StateMachine } from "./machine";
import { TypedPort } from "./port";
import { State, type TransitionTo } from "./state";

describe("MessageChannelStateMachine", () => {
  class StateA extends State<"a", StateB | StateC> {
    constructor() {
      super({ name: "a", allowedTransitions: ["b"] });
    }

    goToB(): TransitionTo<StateB> {
      return { state: "b" };
    }
  }
  class StateB extends State<"b", never> {
    constructor() {
      super({ name: "b" });
    }
  }
  class StateC extends State<"c", never> {
    constructor() {
      super({ name: "c" });
    }
  }

  it("should transition to another state", (t) => {
    // given
    const channel = new MessageChannel();
    channel.port1.on = t.mock.fn();
    const port = new TypedPort(channel.port1);
    const stateA = new StateA();
    const states = [stateA, new StateB(), new StateC()];
    const stateMachine = new StateMachine(stateA, states);

    const machine = new MessageChannelStateMachine(stateMachine, port);

    // when
    const machineB = machine.transition((state, port) => {
      return state.goToB();
    });

    // then
    assert.strictEqual(machineB.currentState(), states[1]);
  });
});
