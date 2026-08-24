/**
 * A one-row-per-key settings table.
 *
 * Deliberately generic rather than a `maintenance` column: the next
 * platform-wide switch should be a row, not another migration.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('platform_settings', table => {
    table.string('key').primary().notNullable();
    table.text('value').notNullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('platform_settings');
};
