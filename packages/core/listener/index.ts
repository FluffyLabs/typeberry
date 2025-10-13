import { EventEmitter } from "node:events";

const EVENT = Symbol();
const EVENT_DONE = Symbol();

/** A typed version of event emitter. */
export class Listener<T> {
  private readonly emitter = new EventEmitter();

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
}
