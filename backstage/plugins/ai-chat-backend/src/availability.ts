/**
 * Global AI Chat feature switch. One SQL row in the ai-chat plugin database.
 * Unlike local process flags or browser storage, it survives restart and is
 * visible to all replicas using the same Backstage database.
 */

import type { Knex } from 'knex';

export const CHAT_SETTING_KEY = 'enabled';
export const DEFAULT_ADMIN_GROUPS = ['group:default/platform-admins'];

/** Identical decision to Maintenance's principalResolver admin-group test. */
export function mayManageChat(
  ownershipEntityRefs: readonly string[],
  adminGroups: readonly string[],
): boolean {
  return ownershipEntityRefs.some(ref => adminGroups.includes(ref));
}

export interface ChatSettingStore {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

const TABLE = 'ai_chat_settings';

export async function createChatSettingStore(
  db: Knex,
): Promise<ChatSettingStore> {
  if (!(await db.schema.hasTable(TABLE))) {
    // Two processes starting simultaneously may race to create the table.
    // A second hasTable after a failure distinguishes that race from a real DB error.
    try {
      await db.schema.createTable(TABLE, table => {
        table.string('key', 60).primary();
        table.boolean('enabled').notNullable();
      });
    } catch (error) {
      if (!(await db.schema.hasTable(TABLE))) throw error;
    }
  }
  return {
    async isEnabled() {
      const row = await db(TABLE).where({ key: CHAT_SETTING_KEY }).first();
      // Preserve existing installations: enabled until an admin disables it.
      return (
        row === undefined ||
        row.enabled === true ||
        row.enabled === 1 ||
        row.enabled === '1'
      );
    },
    async setEnabled(enabled) {
      await db(TABLE)
        .insert({ key: CHAT_SETTING_KEY, enabled })
        .onConflict('key')
        .merge({ enabled });
    },
  };
}
