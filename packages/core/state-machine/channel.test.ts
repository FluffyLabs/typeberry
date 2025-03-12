import assert from "node:assert";
import { type TestContext, describe, it } from "node:test";
import { MessageChannel } from "node:worker_threads";

import { MessageChannelStateMachine } from "./channel";
import { StateMachine } from "./machine";
import { TypedPort } from "./port";
import { State, type TransitionTo } from "./state";

function newChannel(t: TestContext) {
  const channel = new MessageChannel();
  t.after(() => {
    channel.port1.close();
    channel.port2.close();
  });
  return channel;
}

describe("MessageChannelStateMachine", () => {
  class StateA extends State<"a", StateB | StateC> {
    constructor() {
      super({
        name: "a",
        allowedTransitions: ["b"],
        signalListeners: {
          testSignal: (data: unknown) => this.goToB(data),
        },
      });
    }

    goToB(data?: unknown): TransitionTo<StateB> {
      return { state: "b", data };
    }
  }
  class StateB extends State<"b", never> {
    constructor() {
      super({
        name: "b",
        requestHandlers: {
          dataFromB: async () => ({ response: this.data }),
        },
      });
    }

    getData() {
      return this.data;
    }
  }
  class StateC extends State<"c", never> {
    constructor() {
      super({ name: "c" });
    }
  }

  it("should transition to another state", (t) => {
    // given
    const channel = newChannel(t);
    const port = new TypedPort(channel.port1);
    const stateA = new StateA();
    const states = [stateA, new StateB(), new StateC()];
    const stateMachine = new StateMachine("x", stateA, states);

    const machine = new MessageChannelStateMachine(stateMachine, port);

    // when
    const machineB = machine.transition((state) => {
      return state.goToB();
    });

    // then
    assert.strictEqual(machineB.currentState(), states[1]);
  });

  it("should transition to another state via signal", async (t) => {
    // given
    const channel = newChannel(t);
    const port = new TypedPort(channel.port1);
    const stateA = new StateA();
    const stateB = new StateB();
    const states = [stateA, stateB, new StateC()];
    const stateMachine = new StateMachine("x", stateA, states);

    const machine = new MessageChannelStateMachine(stateMachine, port);

    // when
    channel.port2.postMessage({
      id: 1,
      name: "testSignal",
      kind: "signal",
      data: "xyz",
      localState: "someState",
    });
    const machineB = await machine.waitForState("b");

    // then
    assert.strictEqual(machineB.currentState(), stateB);
    assert.strictEqual(stateB.getData(), "xyz");
  });

  it("should do some work until it transitions", async (t) => {
    // given
    const channel = newChannel(t);
    const port = new TypedPort(channel.port1);
    const stateA = new StateA();
    const stateB = new StateB();
    const states = [stateA, stateB, new StateC()];
    const stateMachine = new StateMachine("x", stateA, states);

    const machine = new MessageChannelStateMachine(stateMachine, port);

    // when
    const result = { initial: undefined as boolean | undefined, final: undefined as boolean | undefined };
    const machineBPromise = machine.doUntil<StateB>("b", async (_work, _port, isDone) => {
      result.initial = isDone();

      return new Promise((resolve) => {
        setImmediate(() => {
          result.final = isDone();
          resolve();
        });
      });
    });
    machine.transition((state) => state.goToB("abc"));
    const machineB = await machineBPromise;

    // then
    assert.strictEqual(machineB.currentState(), stateB);
    assert.strictEqual(stateB.getData(), "abc");
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    assert.ok(!result.initial);
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    assert.ok(result.final);
  });

  it("should respond to a request", async (t) => {
    // given
    const channel = newChannel(t);
    const port = new TypedPort(channel.port1);
    const stateA = new StateA();
    const states = [stateA, new StateB(), new StateC()];
    const stateMachine = new StateMachine("x", stateA, states);

    const machine = new MessageChannelStateMachine(stateMachine, port);
    machine.transition((state) => state.goToB("abcd"));

    // when
    const sender = new TypedPort(channel.port2);
    // TODO [ToDr] we could introduce additional request typing here if we let the user
    // define the expected state of the counterparty.
    const response = await sender.sendRequest("myState", "dataFromB", null);

    // then
    assert.strictEqual(response, "abcd");
  });
});
