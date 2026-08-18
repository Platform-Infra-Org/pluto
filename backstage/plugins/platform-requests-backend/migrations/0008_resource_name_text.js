/**
 * `resource_name` holds the *joined* names of a bulk request (router.ts joins
 * `resourceNames` so list, search and notifications stay one code path). At
 * varchar(255) that overflows at ~6 UUID-named resources per batch — and only
 * on Postgres: SQLite ignores the length, so the test suite never sees it.
 * `text` costs nothing on Postgres and removes the ceiling.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.text('resource_name').notNullable().alter();
  });
};

/**
 * Best effort: fails if any stored name is already longer than 255, which is
 * exactly the data this migration exists to allow.
 *
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.string('resource_name').notNullable().alter();
  });
};
