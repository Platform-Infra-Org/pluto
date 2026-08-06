/**
 * Suspend steps a request's workflow is currently waiting on.
 *
 * A cache of Argo's answer, refreshed on every poll — never the source of
 * truth. The resume endpoint re-reads the live workflow before acting, because
 * between a page render and a click someone else may have released the node.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.text('suspended_nodes').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.dropColumn('suspended_nodes');
  });
};
