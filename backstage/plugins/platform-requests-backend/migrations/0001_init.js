/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('platform_requests', table => {
    table.increments('id').primary();
    table.string('kind').notNullable();
    table.string('resource_type').notNullable();
    table.string('resource_name').notNullable();
    table.text('params').notNullable();
    table.string('state').notNullable();
    table.text('policy').notNullable();
    table.string('requester').notNullable();
    table.string('workflow_name').nullable();
    table.string('workflow_phase').nullable();
    table.text('error').nullable();
    table.string('created_at').notNullable();
    table.string('updated_at').notNullable();
  });

  await knex.schema.createTable('platform_approvals', table => {
    table.increments('id').primary();
    table
      .integer('request_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('platform_requests')
      .onDelete('CASCADE');
    table.string('approver').notNullable();
    table.string('decision').notNullable();
    table.text('note').nullable();
    table.string('created_at').notNullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('platform_approvals');
  await knex.schema.dropTable('platform_requests');
};
