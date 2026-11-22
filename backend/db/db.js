const mysql = require('mysql2/promise');

function createDbPool() {
  let dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (dbUrl) {
    // Automatically correct common AWS region typo (e.g. us-west2 -> us-west-2)
    dbUrl = dbUrl.replace(/\.us-(east|west)(\d)\.prod\.aws\./g, '.us-$1-$2.prod.aws.');
    dbUrl = dbUrl.replace(/\.us(east|west)(\d)\.prod\.aws\./g, '.us-$1-$2.prod.aws.');

    // Auto-rewrite system schema / default database to 'money_tracker' where all Job Radar tables live
    dbUrl = dbUrl.replace(/\/(?:sys|test)(\?|$)/i, '/money_tracker$1');

    const isCloud = dbUrl.includes('tidbcloud.com') || dbUrl.includes('aivencloud.com') || process.env.DB_SSL === 'true';
    return mysql.createPool({
      uri: dbUrl,
      ssl: isCloud ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  }

  return mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'jobhunt_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });
}

const pool = createDbPool();
module.exports = pool;
