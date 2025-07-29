import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
async function logToDB(username, status = 'ATTEMPT', timestamp = new Date()) {
  try {
    await pool.query(
      `INSERT INTO search_logs (username, search_time, status) VALUES ($1, $2, $3)`,
      [username, timestamp, status]
    );
  } catch (logErr) {
    console.error('Failed to log attempt:', logErr.message);
  }
}

async function updateLogStatus(username, status, timestamp) {
  try {
    await pool.query(
      `UPDATE search_logs SET status = $1 WHERE username = $2 AND attempted_at = $3`,
      [status, username, timestamp]
    );
  } catch (logUpdateErr) {
    console.warn(`Could not update log status to ${status}:`, logUpdateErr.message);
  }
}
  
export { pool, logToDB, updateLogStatus };