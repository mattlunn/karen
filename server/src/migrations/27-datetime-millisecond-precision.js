'use strict';

// Widen every datetime column from DATETIME (0 fractional-seconds precision) to
// DATETIME(3). The application works entirely in millisecond-precision JS Dates,
// but a bare DATETIME rounds them to whole seconds on write and - on the mysql
// dialect - drops the fractional part from WHERE-clause literals. That made range
// queries and the JS-side comparisons against their results disagree at
// sub-second boundaries (e.g. a forecast-coverage check reading `now` a few ms
// past a half-hour slot boundary would exclude the slot that starts exactly on
// it). DATETIME(3) lets the millisecond round-trip so both sides agree.

const COLUMNS = {
  alarm_activations: [
    ['startedAt', false],
    ['suppressFurtherAlertsUntil', false],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  armings: [
    ['start', false],
    ['end', true],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  devices: [
    ['createdAt', false],
    ['updatedAt', false],
    ['deletedAt', true],
  ],
  events: [
    ['start', false],
    ['end', true],
    ['lastReported', false],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  heating: [
    ['createdAt', false],
    ['updatedAt', false],
  ],
  recordings: [
    ['start', false],
    ['end', false],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  rooms: [
    ['createdAt', false],
    ['updatedAt', false],
  ],
  stays: [
    ['eta', true],
    ['arrival', true],
    ['departure', true],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  tokens: [
    ['expiresAt', true],
    ['createdAt', false],
    ['updatedAt', false],
  ],
  users: [
    ['createdAt', false],
    ['updatedAt', false],
  ],
};

function buildAlter(table, columnType) {
  const clauses = COLUMNS[table]
    .map(([name, nullable]) => `MODIFY COLUMN \`${name}\` ${columnType} ${nullable ? 'NULL' : 'NOT NULL'}`)
    .join(', ');

  return `ALTER TABLE \`${table}\` ${clauses}`;
}

module.exports = {
  up: async function (queryInterface) {
    for (const table of Object.keys(COLUMNS)) {
      await queryInterface.sequelize.query(buildAlter(table, 'DATETIME(3)'));
    }
  },

  down: async function (queryInterface) {
    for (const table of Object.keys(COLUMNS)) {
      await queryInterface.sequelize.query(buildAlter(table, 'DATETIME'));
    }
  },
};
