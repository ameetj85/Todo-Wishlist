import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function normalizeSqliteFileUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const sqlitePath = rawUrl.slice('file:'.length);

  if (sqlitePath === ':memory:' || sqlitePath === '') {
    return rawUrl;
  }

  const queryIndex = sqlitePath.indexOf('?');
  const pathPart = queryIndex === -1 ? sqlitePath : sqlitePath.slice(0, queryIndex);
  const queryPart = queryIndex === -1 ? '' : sqlitePath.slice(queryIndex);

  const absoluteDbPath = path.isAbsolute(pathPart)
    ? pathPart
    : path.resolve(process.cwd(), pathPart);

  const dir = path.dirname(absoluteDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return `file:${absoluteDbPath}${queryPart}`;
}

function sqliteFilePathFromUrl(url: string): string | null {
  if (!url || !url.startsWith('file:')) {
    return null;
  }

  const sqlitePath = url.slice('file:'.length);
  if (sqlitePath === ':memory:' || sqlitePath === '') {
    return null;
  }

  const queryIndex = sqlitePath.indexOf('?');
  return queryIndex === -1 ? sqlitePath : sqlitePath.slice(0, queryIndex);
}

function isExistingNonEmptyFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function resolveDatabaseUrl(): string {
  const fallbackDbPath = process.env.DB_PATH || './data/auth.db';
  const fallbackUrl = normalizeSqliteFileUrl(
    fallbackDbPath.startsWith('file:') ? fallbackDbPath : `file:${fallbackDbPath}`,
  );

  if (process.env.DATABASE_URL) {
    const configuredUrl = normalizeSqliteFileUrl(process.env.DATABASE_URL);
    const configuredPath = sqliteFilePathFromUrl(configuredUrl);
    const fallbackPath = sqliteFilePathFromUrl(fallbackUrl);

    if (
      configuredPath &&
      fallbackPath &&
      !isExistingNonEmptyFile(configuredPath) &&
      isExistingNonEmptyFile(fallbackPath)
    ) {
      return fallbackUrl;
    }

    return configuredUrl;
  }

  const dbPath = fallbackDbPath;

  // SQLite in-memory mode is not stable across pooled connections; use a temp file for tests.
  if (dbPath === ':memory:') {
    return 'file:./data/test.db';
  }

  return normalizeSqliteFileUrl(dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`);
}

export function getDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

const databaseUrl = getDatabaseUrl();

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
});

const globalForPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
