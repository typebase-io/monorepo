import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { z } from 'zod';

import { TYPEBASE_CONFIG_FILE_NAME, typebaseConfigSchema } from '#helpers/constants.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

interface JsonSchemaNode {
  properties?: Record<string, JsonSchemaNode>;
  'x-current-value'?: unknown;
  'x-is-default'?: boolean;
  [key: string]: unknown;
}

export const config = new Command('config')
  .summary('Print the config schema, annotated with the current values')
  .description(
    `Print the \`${TYPEBASE_CONFIG_FILE_NAME}\` JSON Schema with every property annotated with the value in effect. Intended for tooling that needs to read a project's setup without reimplementing the config schema.`
  )
  .allowExcessArguments(false)
  .action(async () => {
    const configPath = path.resolve(TYPEBASE_CONFIG_FILE_NAME);

    const schema = z.toJSONSchema(typebaseConfigSchema) as JsonSchemaNode & { properties: Record<string, JsonSchemaNode> };
    const resolved = await getTypebaseConfig();
    const explicit = existsSync(configPath) ? ((await fs.readFile(configPath, 'utf8').then(JSON.parse)) as unknown) : undefined;

    delete schema.$schema;
    delete schema.additionalProperties;

    const pending = [{ properties: schema.properties, current: resolved as unknown, explicit }];

    for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
      const { current, explicit: written } = entry;

      const currentValues = typeof current === 'object' && current !== null ? (current as Record<string, unknown>) : {};
      const explicitValues = typeof written === 'object' && written !== null ? (written as Record<string, unknown>) : {};

      for (const [key, child] of Object.entries(entry.properties)) {
        const childProperties = child.properties;

        if (childProperties) {
          delete child.additionalProperties;

          pending.push({ properties: childProperties, current: currentValues[key], explicit: explicitValues[key] });

          continue;
        }

        child['x-current-value'] = currentValues[key] ?? null;
        child['x-is-default'] = explicitValues[key] === undefined;
      }
    }

    console.log(JSON.stringify({ projectRoot: process.cwd(), configPath, schema }, null, 2));
  });
