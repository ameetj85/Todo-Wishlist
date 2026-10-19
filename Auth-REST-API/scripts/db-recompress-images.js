#!/usr/bin/env node
'use strict';
// npm run db:recompress-images            (dry run: reports what would change)
// npm run db:recompress-images -- --apply (backs up the database, then rewrites images)
//
// One-off data migration that re-encodes stored wishlist images into the compact
// format the frontend now produces: at most 640x640, WebP. Images that are already
// in that format, that would not get smaller, or that cannot be decoded are left as is.
// Safe to run repeatedly. Requires the `sharp` dev dependency.

require('dotenv').config();
const path = require('path');
const { prisma } = require('../src/db/prisma');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('This script needs sharp. Run `npm install` (dev dependencies included) first.');
  process.exit(1);
}

// Keep in sync with compressImageForStorage in Auth-FrontEnd/src/lib/extract-image.ts.
const OUTPUT_MAX_DIMENSION = 640;
const OUTPUT_QUALITY = 80;
const OUTPUT_MIN_QUALITY = 65;
const OUTPUT_TARGET_BYTES = 60 * 1024;

const BATCH_SIZE = 50;
const apply = process.argv.includes('--apply');

async function compressImageForStorage(inputBuffer) {
  const encode = (quality) =>
    sharp(inputBuffer)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: OUTPUT_MAX_DIMENSION,
        height: OUTPUT_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();

  let quality = OUTPUT_QUALITY;
  let outputBuffer = await encode(quality);

  while (outputBuffer.byteLength > OUTPUT_TARGET_BYTES && quality > OUTPUT_MIN_QUALITY) {
    quality = Math.max(OUTPUT_MIN_QUALITY, quality - 5);
    outputBuffer = await encode(quality);
  }

  return outputBuffer;
}

function isAlreadyCompressed(metadata) {
  return (
    metadata.format === 'webp' &&
    Math.max(metadata.width ?? 0, metadata.height ?? 0) <= OUTPUT_MAX_DIMENSION
  );
}

async function backupDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  const dbPath = url.replace(/^file:/, '').replace(/\?.*$/, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    path.dirname(dbPath),
    `${path.basename(dbPath, path.extname(dbPath))}.backup-${timestamp}${path.extname(dbPath)}`,
  );

  // VACUUM INTO writes a consistent snapshot even while the API is running.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, '\'\'')}'`);
  return backupPath;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  if (apply) {
    const backupPath = await backupDatabase();
    console.log(`Database backed up to ${backupPath}`);
  } else {
    console.log('Dry run: no changes will be written. Re-run with --apply to update images.');
  }

  const stats = { total: 0, recompressed: 0, alreadyCompressed: 0, notSmaller: 0, unreadable: 0 };
  let bytesBefore = 0;
  let bytesAfter = 0;
  let cursor;

  for (;;) {
    const rows = await prisma.wishlistItem.findMany({
      where: { itemImage: { not: null } },
      select: { itemId: true, itemImage: true },
      orderBy: { itemId: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { itemId: cursor } } : {}),
    });

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].itemId;

    for (const row of rows) {
      stats.total += 1;
      const original = Buffer.from(row.itemImage);
      bytesBefore += original.byteLength;

      let compressed;
      try {
        const metadata = await sharp(original).metadata();
        if (isAlreadyCompressed(metadata)) {
          stats.alreadyCompressed += 1;
          bytesAfter += original.byteLength;
          continue;
        }

        compressed = await compressImageForStorage(original);
      } catch {
        stats.unreadable += 1;
        bytesAfter += original.byteLength;
        console.warn(`   item ${row.itemId}: image could not be decoded, left unchanged`);
        continue;
      }

      if (compressed.byteLength >= original.byteLength) {
        stats.notSmaller += 1;
        bytesAfter += original.byteLength;
        continue;
      }

      if (apply) {
        await prisma.wishlistItem.update({
          where: { itemId: row.itemId },
          data: { itemImage: compressed },
        });
      }

      stats.recompressed += 1;
      bytesAfter += compressed.byteLength;
    }
  }

  console.log(apply ? 'Image recompression complete.' : 'Image recompression dry run complete.');
  const lines = [
    ['Items with images', stats.total],
    [apply ? 'Recompressed' : 'Would recompress', stats.recompressed],
    ['Already compressed', stats.alreadyCompressed],
    ['Would not get smaller', stats.notSmaller],
    ['Unreadable (unchanged)', stats.unreadable],
    ['Total image size', `${formatKb(bytesBefore)} -> ${formatKb(bytesAfter)}`],
  ];

  for (const [label, value] of lines) {
    console.log(`   ${label.padEnd(24)}: ${value}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
