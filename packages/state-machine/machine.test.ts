import assert from "node:assert";
import { describe, it } from "node:test";
import { StateMachine } from "./machine";
import { State } from "./state";

describe("StateMachine", () => {
  class A extends State<"a", B> {
    constructor() {
      super({
        name: "a",
        allowedTransitions: ["b"],
      });
    }
  }
  class B extends State<"b", C> {
    constructor() {
      super({
        name: "b",
        allowedTransitions: [],
      });
    }
  }
  class C extends State<"c", never> {
    constructor() {
      super({ name: "c" });
    }
  }

  it("should perform transition", () => {
    // given
    const states = [new A(), new B(), new C()];
    const machineA = new StateMachine("x", states[0], states);
    assert.strictEqual(machineA.currentState(), states[0]);

    // when
    const machineB = machineA.transition("b");

    // then
    assert.strictEqual(machineB.currentState(), states[1]);
  });

  it("should reject transition to disallowed state", () => {
    // given
    const states = [new A(), new B(), new C()];
    const machineB = new StateMachine("x", states[1], states);
    assert.strictEqual(machineB.currentState(), states[1]);

    assert.throws(() => {
      // when
      machineB.transition("c");
    }, /Unallowed transition from <State b> to c/);
  });

  it("should resolve a promise when state is reached", async () => {
    // given
    const states = [new A(), new B(), new C()];
    const machineA = new StateMachine("x", states[0], states);

    setTimeout(() => {
      machineA.transition("b");
    });

    // when
    assert.strictEqual(machineA.currentState(), states[0]);
    const machineB = await machineA.waitForState("b");

    // then
    assert.strictEqual(machineB.currentState(), states[1]);
  });
});
