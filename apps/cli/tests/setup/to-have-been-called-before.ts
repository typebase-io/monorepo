import { expect } from 'vitest';

interface CustomMatchers<R = unknown> {
  toHaveBeenCalledBefore: (expected: unknown) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

const isOrderedMock = (value: unknown): value is { mock: { invocationCallOrder: number[] } } => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return false;
  }

  const mock = (value as { mock?: unknown }).mock;

  if (typeof mock !== 'object' || mock === null) {
    return false;
  }

  const invocationCallOrder = (mock as { invocationCallOrder?: unknown }).invocationCallOrder;

  return Array.isArray(invocationCallOrder) && invocationCallOrder.every((order) => typeof order === 'number');
};

const firstInvocationOrder = (value: unknown) => {
  if (!isOrderedMock(value)) {
    return undefined;
  }

  return value.mock.invocationCallOrder[0];
};

expect.extend({
  toHaveBeenCalledBefore(received: unknown, expected: unknown) {
    const receivedOrder = firstInvocationOrder(received);
    const expectedOrder = firstInvocationOrder(expected);
    const pass = receivedOrder !== undefined && expectedOrder !== undefined && receivedOrder < expectedOrder;

    return {
      pass,
      message: () => {
        if (receivedOrder === undefined || expectedOrder === undefined) {
          return 'expected both mocks to have been called';
        }

        return `expected mock called at order ${receivedOrder} to ${pass ? 'not ' : ''}have been called before mock called at order ${expectedOrder}`;
      },
      actual: receivedOrder,
      expected: expectedOrder,
    };
  },
});
