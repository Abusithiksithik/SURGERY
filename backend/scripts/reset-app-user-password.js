'use strict';

// Safely reset one existing app user's password in the database configured by backend/.env.
// Run from backend: node scripts/reset-app-user-password.js management1
require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const username = String(process.argv[2] || '').trim();
  if (!username) {
    console.error('Usage: node scripts/reset-app-user-password.js <existing-username>');
    process.exitCode = 1;
    return;
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const password = await rl.question(`Enter a new password for ${username} (minimum 6 characters): `);
  const confirm = await rl.question('Re-enter the new password: ');
  rl.close();
  if (password.length < 6 || password.length > 100) throw new Error('Password must be between 6 and 100 characters.');
  if (password !== confirm) throw new Error('Passwords do not match. No changes made.');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:12345@localhost:5432/hospital' });
  try {
    const found = await pool.query('SELECT user_id, is_active FROM users WHERE username = $1', [username]);
    if (found.rowCount !== 1) throw new Error(`User '${username}' was not found in the configured database.`);
    if (!found.rows[0].is_active) throw new Error(`User '${username}' is inactive. Activate the account before resetting its password.`);
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2', [hash, found.rows[0].user_id]);
    console.log(`Password updated for '${username}' in the database configured by backend/.env. Password was not printed or stored in a file.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || 'Password reset failed.');
  process.exitCode = 1;
});
