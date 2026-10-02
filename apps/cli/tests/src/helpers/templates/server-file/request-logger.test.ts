import { describe, expect, it } from 'vitest';

import { requestLogger } from '#helpers/templates/server-file/request-logger.ts';

describe('requestLogger', () => {
  it('writes one line per request when it finishes, aborts or fails: error on a failure or 5xx, warn on a 4xx', () => {
    expect(requestLogger).toEqualTemplate('server-file', 'request-logger.txt');
  });
});
