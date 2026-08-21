import fs from 'node:fs/promises';

import { examplePublisherTemplate } from '#helpers/templates/example-publisher.ts';

export const generateExamplePublisher = async (path: string) => {
  await fs.writeFile(path, `${examplePublisherTemplate}\n`);
};
