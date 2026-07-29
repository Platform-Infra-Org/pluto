/**
 * Per-request secret lifecycle (docs/SECRETS-LIFECYCLE.md):
 *  - secret_spec: JSON [{name, source, length?}] — the fields to materialise.
 *  - secret_enc:  envelope-encrypted provided values, held submit→approval,
 *                 cleared on approve/reject. NEVER exposed in the request DTO.
 *  - secret_name: the per-request Kubernetes Secret name, set at approval.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.text('secret_spec').nullable();
    table.text('secret_enc').nullable();
    table.string('secret_name').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('platform_requests', table => {
    table.dropColumn('secret_spec');
    table.dropColumn('secret_enc');
    table.dropColumn('secret_name');
  });
};
