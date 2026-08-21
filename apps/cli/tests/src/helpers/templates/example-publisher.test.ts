import { describe, expect, it } from 'vitest';

import { examplePublisherTemplate } from '#helpers/templates/example-publisher.ts';

describe('examplePublisherTemplate', () => {
  it('renders a db publisher declaring one example event', () => {
    expect(examplePublisherTemplate).toEqualTemplate('example-publisher', 'expected.txt');
  });
});
