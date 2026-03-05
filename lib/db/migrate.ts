/**
 * Run this script once to initialize the database schema.
 * Usage: npx ts-node --project tsconfig.json lib/db/migrate.ts
 * Or: npm run db:migrate
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(sql);
    console.log('✅ Database schema applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
