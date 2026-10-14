/** Keep the originating Scaffolder task so Start Over can reuse its complete form. */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.string('scaffolder_task_id').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.dropColumn('scaffolder_task_id');
  });
};
