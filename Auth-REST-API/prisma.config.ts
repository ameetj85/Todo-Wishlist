import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

function normalizeSqliteFileUrl(rawUrl: string): string {
  if (!rawUrl.startsWith('file:')) {
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
  if (!url.startsWith('file:')) {
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

  if (dbPath === ':memory:') {
    return 'file:./data/test.db';
  }

  return normalizeSqliteFileUrl(
    dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`,
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
