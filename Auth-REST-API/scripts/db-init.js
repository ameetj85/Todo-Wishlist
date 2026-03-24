#!/usr/bin/env node
'use strict';
// npm run db:init
// Initializes the database schema via Prisma.

require('dotenv').config();
const { prisma, getDatabaseUrl } = require('../src/db/prisma');

async function main() {
	const tableRows = await prisma.$queryRawUnsafe(
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
