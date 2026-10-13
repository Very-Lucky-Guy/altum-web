import postgres from 'postgres';
let connection;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  return connection ||= postgres(process.env.DATABASE_URL, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false });
}
