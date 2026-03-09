'use strict';

function toSqliteDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function toSqliteDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

module.exports = { toSqliteDate, toSqliteDateOnly };
