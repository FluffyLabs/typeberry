import { MessageChannel } from 'node:worker_threads';
import { describe, it } from "node:test";
import assert from 'node:assert';
import { TypedPort } from './port';

describe("TypedPort", () => {
  it('should send a signal', async (t) => {
    // given
    const channel = new MessageChannel();
    const receiver = channel.port2;
    // calling `.on` hangs the whole test?
    channel.port1.on = t.mock.fn();
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      receiver.once('message', resolve);
    });
    port.sendSignal('myState', 'signal1', {obj: true});

    // then
    assert.deepStrictEqual(await response, {
      data: { obj : true },
      id: 1,
      kind: 'signal',
      name: 'signal1',
      localState: 'myState',
    });
  });

  it('should send a request', async (t) => {
    // given
    const channel = new MessageChannel();
    const receiver = channel.port2;
    // calling `.on` hangs the whole test?
    channel.port1.on = t.mock.fn();
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      receiver.once('message', resolve);
    });
    port.sendRequest('myState', 'signal1', {obj: true});

    // then
    assert.deepStrictEqual(await response, {
      data: { obj : true },
      id: 1,
      kind: 'request',
      name: 'signal1',
      localState: 'myState',
    });
  });

  it('should receive a signal', async (t) => {
    // given
    const channel = new MessageChannel();
    // TODO [ToDr] Mocking this method should not be necessary, but
    // for some reason the test runners hangs when calling `.on`.
    const onMock = t.mock.fn();
    channel.port1.on = onMock as any;
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      port.listeners.once('signal', (...args) => {
        resolve(args);
      });
    });
    const listener = onMock.mock.calls[0].arguments[1];
    listener({
      id: 10,
      kind: 'signal',
      name: 'signal3',
      data: { obj: false },
      localState: 'otherState',
    });

    // then
    assert.deepStrictEqual(await response, [
      'signal3',
      { obj: false },
      'otherState',
      {
        data: { obj : false },
        id: 10,
        kind: 'signal',
        name: 'signal3',
        localState: 'otherState',
      }]);
  });
});
