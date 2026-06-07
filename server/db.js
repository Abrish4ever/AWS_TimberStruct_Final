// =============================================================
//  TimberStruct — MySQL Connection Pool
//  Credentials: timber_user / 123456 / timber-db @ localhost
// =============================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host              : process.env.DB_HOST     || 'localhost',
  port              : process.env.DB_PORT     || 3306,
  user              : process.env.DB_USER     || 'timber_user',
  password          : process.env.DB_PASSWORD || '123456',
  database          : process.env.DB_NAME     || 'timber-db',
  waitForConnections: true,
  connectionLimit   : 10,
  charset           : 'utf8mb4',
  timezone          : '+03:00',
});

/**
 * Run a SELECT query — returns array of rows.
 * @param {string} sql   Parameterised SQL with ? placeholders
 * @param {Array}  params Bound values
 * @returns {Promise<Object[]>}
 */
async function qry(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run INSERT / UPDATE / DELETE — returns { insertId, affectedRows }.
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<{insertId:number, affectedRows:number}>}
 */
async function exec(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected → timber-db @ localhost');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, qry, exec, testConnection };
