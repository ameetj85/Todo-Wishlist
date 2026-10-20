#!/usr/bin/env node
// npm run db:init
// Initializes the database schema via Prisma.

import dotenv from 'dotenv';

dotenv.config();

import { prisma, getDatabaseUrl } from '../src/db/prisma';

async function main() {
	const tableRows = await prisma.$queryRawUnsafe<{ name: string }[]>(
		'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name',
	);
	console.log('✅ Database initialized successfully.');
	console.log('   Tables:', tableRows.map((t) => t.name).join(', '));
	console.log('   URL   :', getDatabaseUrl());
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
