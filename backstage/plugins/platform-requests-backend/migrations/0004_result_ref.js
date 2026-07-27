/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.string('result_output').nullable();
    table.string('result_ref').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.dropColumn('result_output');
    table.dropColumn('result_ref');
  });
};
