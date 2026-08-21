#!/usr/bin/env node
'use strict';
/**
 * Convenience seed runner — executes split/06_seed.sql.
 * Usage: node backend/database/seed-node.js
 *
 * The server already runs seed automatically on startup when the
 * database is empty (initializeDatabase.js). This script is for
 * manually re-seeding during development.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set. Check backend/.env');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const seedFile = path.join(__dirname, 'split', '06_seed.sql');
  const sql = fs.readFileSync(seedFile, 'utf8');

  try {
    await client.query(sql);
    console.log('✓ Seed complete');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
