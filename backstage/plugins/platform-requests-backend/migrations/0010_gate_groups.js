/**
 * Every group a request's suspend steps have named as `platform.io/approver-group`.
 *
 * Append-only, unlike `suspended_nodes` (a cache that empties on resume): a team
 * that answered a gate keeps the request in its lists afterwards, the same way
 * an owning team keeps a request it approved. A separate table rather than a
 * JSON column because the list filters on it, and `whereIn` against a JSON
 * array is not portable between Postgres and the SQLite the tests run on.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('platform_request_gate_groups', table => {
    table
      .integer('request_id')
      .notNullable()
      .references('id')
      .inTable('platform_requests');
    table.string('group_ref').notNullable();
    table.primary(['request_id', 'group_ref']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('platform_request_gate_groups');
};
