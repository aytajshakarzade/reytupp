'use strict';

function reserveAiRequestSql(databaseMode) {
  if (databaseMode === 'postgres') {
    // PostgreSQL requires the target row to be qualified in ON CONFLICT expressions.
    return `INSERT INTO assistant_usage AS au(user_id,usage_date,request_count) VALUES(?,?,1) ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count=au.request_count+1 WHERE au.request_count < ? RETURNING au.request_count AS request_count`;
  }
  // SQLite supports the unqualified target column in the conflict clause.
  return `INSERT INTO assistant_usage(user_id,usage_date,request_count) VALUES(?,?,1) ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count=request_count+1 WHERE request_count < ? RETURNING request_count`;
}

module.exports = { reserveAiRequestSql };
