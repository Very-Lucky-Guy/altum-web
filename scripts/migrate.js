import { readFile } from 'node:fs/promises';
import { db } from '../lib/db.js';
const sql = db();
try { await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); console.log('ALTUM schema ready.'); }
finally { await sql.end(); }
