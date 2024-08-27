import assert from "node:assert";
import { describe, it } from "node:test";
import { State } from "./state";

describe("State", () => {
  class StateA extends State<"a", StateB | StateC> {}
  class StateB extends State<"b", never> {}
  class StateC extends State<"c", never> {}

  it("should return true for allowed transition", () => {
    // given
    const state = new StateA({ name: "a", allowedTransitions: ["b"] });

    // when / then
    assert.strictEqual(state.canTransitionTo("b"), true);
  });
  
  it("should return false for not allowed transition", () => {
    // given
    const state = new StateA({ name: "a", allowedTransitions: ["b"] });

    // when / then
    assert.strictEqual(state.canTransitionTo("c"), false);
  });
});
