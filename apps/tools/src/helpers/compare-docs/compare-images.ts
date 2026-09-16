import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { countDistinctChanges } from '#helpers/compare-docs/count-distinct-changes.ts';
import { type Comparison, type Screenshot } from '#helpers/compare-docs/types.ts';

const sampleStride = 4;
const columnWidth = 32;
const rowCount = 8;

export const compareImages = async (base: Screenshot[], candidate: Screenshot[], output: string, threshold = 0.1): Promise<Comparison[]> => {
  await mkdir(path.join(output, 'diff'), { recursive: true });

  const left = new Map(base.map((entry) => [entry.key, entry]));
  const right = new Map(candidate.map((entry) => [entry.key, entry]));
  const keys = new Set([...left.keys(), ...right.keys()]);
  const results: Comparison[] = [];

  console.log(`Comparing ${keys.size} captures...`);

  let compared = 0;
  let changed = 0;

  for (const key of keys) {
    const before = left.get(key);
    const after = right.get(key);

    compared++;

    if (compared % 500 === 0) {
      console.log(`Compared ${compared}/${keys.size} captures; ${changed} differ so far.`);
    }

    if (!before || !after) {
      const only = before ?? after;

      if (!only) continue;

      changed++;
      results.push({ ...only, before: before?.file, after: after?.file, status: before ? 'removed' : 'added' });

      continue;
    }

    const record = { ...before, ...after, before: before.file, after: after.file };
    const beforePng = await readFile(path.join(output, before.file));
    const afterPng = await readFile(path.join(output, after.file));

    if (beforePng.equals(afterPng)) {
      const size = [beforePng.readUInt32BE(16), beforePng.readUInt32BE(20)] as [number, number];

      results.push({ ...record, status: 'identical', pixels: 0, percent: 0, dimensions: { before: size, after: size }, diff: undefined });

      continue;
    }

    const a = PNG.sync.read(beforePng);
    const b = PNG.sync.read(afterPng);
    const width = Math.max(a.width, b.width);
    const height = Math.max(a.height, b.height);

    const pad = (source: PNG) => {
      const target = new PNG({ width, height, fill: true });

      target.data.fill(255);
      PNG.bitblt(source, target, 0, 0, source.width, source.height, 0, 0);

      return target;
    };

    const padded = { before: pad(a), after: pad(b) };
    const diff = new PNG({ width, height });
    const pixels = pixelmatch(padded.before.data, padded.after.data, diff.data, width, height, { threshold });
    const resized = a.width !== b.width || a.height !== b.height;
    const status = pixels || resized ? 'changed' : 'identical';
    const columns = new Set<number>();
    const rows = new Set<number>();

    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;

    for (let y = 0; y < height; y += sampleStride) {
      for (let x = 0; x < width; x += sampleStride) {
        const at = (y * width + x) * 4;

        if (
          padded.before.data[at] === padded.after.data[at] &&
          padded.before.data[at + 1] === padded.after.data[at + 1] &&
          padded.before.data[at + 2] === padded.after.data[at + 2]
        ) {
          continue;
        }

        columns.add(Math.floor(x / columnWidth));
        rows.add(Math.floor((y / height) * rowCount));
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }

    const ascending = (one: number, two: number) => one - two;

    const signature =
      x1 < 0
        ? `whole${resized ? '-resized' : ''}`
        : `${resized ? 'resized ' : ''}x${[...columns].sort(ascending).join('.')} y${[...rows].sort(ascending).join('.')}`;

    const file = `diff/${createHash('sha256').update(key).digest('hex').slice(0, 24)}.png`;

    if (status === 'changed') {
      changed++;

      await writeFile(path.join(output, file), PNG.sync.write(diff));
    }

    results.push({
      ...record,
      status,
      pixels,
      percent: (pixels / (width * height)) * 100,
      dimensions: { before: [a.width, a.height], after: [b.width, b.height] },
      diff: status === 'changed' ? file : undefined,
      region: x1 < 0 ? undefined : [x0, y0, x1, y1],
      signature: status === 'changed' ? signature : undefined,
    });
  }

  for (const entry of results) {
    if (entry.status !== 'identical') {
      const result =
        entry.status === 'changed'
          ? JSON.stringify(['changed', entry.profile, entry.kind, entry.signature ?? 'unknown'])
          : JSON.stringify([entry.status, entry.profile, entry.kind, entry.label]);

      entry.group = result;
    }
  }

  console.log(`Compared ${compared}/${keys.size} captures; ${changed} differ in ${countDistinctChanges(results)} distinct ways.`);

  return results;
};
