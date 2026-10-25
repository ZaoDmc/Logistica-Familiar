import { databaseConnection, reportDatabaseError } from './database-connection.mjs';
import { runDatabaseTests } from './db-test-suite.mjs';
import { runConcurrencyTests } from './db-concurrency-suite.mjs';
import { runAccountDatabaseTests } from './db-accounts-suite.mjs';
import { runCategoryDatabaseTests } from './db-category-suite.mjs';
import { runRiskDatabaseTests } from './db-risk-suite.mjs';

let pool;
try {
  pool = databaseConnection();
  const client = await pool.connect();
  try {
    await runDatabaseTests((sql, params) => client.query(sql, params));
    await runAccountDatabaseTests((sql, params) => client.query(sql, params));
    await runCategoryDatabaseTests((sql, params) => client.query(sql, params));
    await runRiskDatabaseTests((sql, params) => client.query(sql, params));
  }
  finally { client.release(); }
  await runConcurrencyTests(pool);
} catch (error) { reportDatabaseError(error); }
finally { if (pool) await pool.end(); }
