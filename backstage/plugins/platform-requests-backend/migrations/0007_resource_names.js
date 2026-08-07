/**
 * Bulk requests: every resource the request acts on.
 *
 * Nullable, and null on every row that existed before this — a single-resource
 * request keeps saying what it always said in `resource_name`, so nothing
 * already stored changes meaning and there is no backfill.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.text('resource_names').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.dropColumn('resource_names');
  });
};
