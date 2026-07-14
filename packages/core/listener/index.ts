import { EventEmitter } from "eventemitter3";

const EVENT = Symbol();
const EVENT_DONE = Symbol();

type ListenerEvents<T> = {
  [EVENT]: [data: T];
  [EVENT_DONE]: [];
};

/** A typed version of event emitter. */
export class Listener<T> {
  private readonly emitter = new EventEmitter<ListenerEvents<T>>();

  emit(data: T) {
    this.emitter.emit(EVENT, data);
  }

  on(listener: (d: T) => void) {
    this.emitter.on(EVENT, listener);
    return this;
  }

  off(listener: (d: T) => void) {
    this.emitter.off(EVENT, listener);
    return this;
  }

  once(listener: (d: T) => void) {
    this.emitter.once(EVENT, listener);
    return this;
  }

  onceDone(listener: () => void) {
    this.emitter.once(EVENT_DONE, listener);
    return this;
  }

  markDone() {
    this.emitter.emit(EVENT_DONE);
    this.emitter.removeAllListeners(EVENT);
    this.emitter.removeAllListeners(EVENT_DONE);
  }

  /** Return a callback that will emit events. */
  callbackHandler(): (req: T) => Promise<void> {
    return async (req) => {
      // to avoid deadlocks and since we don't care about that signal,
      // we simply return the response immediately and process the emitting
      // later
      globalThis.setTimeout(() => this.emit(req), 0);
    };
  }
}
