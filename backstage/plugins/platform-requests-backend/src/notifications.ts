import { LoggerService } from '@backstage/backend-plugin-api';
import { NotificationService } from '@backstage/plugin-notifications-node';
import {
  DEFAULT_NAMESPACE,
  Request as PlatformRequest,
  userRef,
} from '@internal/plugin-platform-common';

/**
 * Native Backstage notifications for the request flow: approvers on new
 * requests, the requester on decisions + terminal outcomes. Best-effort — a
 * notification failure is logged and never breaks the request flow.
 *
 * `adminGroups` is resolved once in `plugin.ts` (the same value the approval
 * gate uses) rather than read here: the recipients of "approval needed" must be
 * exactly the people the gate would let approve, and two independent reads of
 * the same config key is how those drift apart.
 */
export function createNotifier(
  notifications: NotificationService,
  logger: LoggerService,
  adminGroups: string[],
  namespace: string = DEFAULT_NAMESPACE,
) {
  return {
    async approvalNeeded(r: {
      id: number;
      kind: string;
      resourceType: string;
      resourceName: string;
      requester: string;
      /** Absent on an admin-only request (no owning template found). */
      ownerGroup?: string;
    }) {
      // Everyone the gate would let approve: the configured admins plus the
      // owning team. Deduped — an admin who is also on the owning team gets one
      // notification, not two.
      const recipients = [...new Set([...adminGroups, r.ownerGroup])].filter(
        (x): x is string => !!x,
      );
      try {
        await notifications.send({
          // `entityRef` takes an array (plugin-notifications-node), so this
          // stays a single send.
          recipients: { type: 'entity', entityRef: recipients },
          payload: {
            title: `Approval needed: ${r.kind} ${r.resourceType}/${r.resourceName}`,
            description: `Requested by ${r.requester}`,
            link: `/requests/${r.id}`,
            severity: 'normal',
          },
        });
      } catch (e) {
        logger.warn(`notify approvalNeeded failed for ${r.id}: ${e}`);
      }
    },

    // Alert the requester when their request changes state after a decision
    // (approved → workflow running, or rejected).
    async decided(r: PlatformRequest) {
      const map: Record<
        string,
        { title: string; sev: 'normal' | 'high' } | undefined
      > = {
        IN_PROGRESS: {
          title: `Request #${r.id} approved — workflow running`,
          sev: 'normal',
        },
        REJECTED: { title: `Request #${r.id} was rejected`, sev: 'high' },
      };
      const m = map[r.state];
      if (!m) return; // still pending (e.g. partial N_OF_M) — no alert
      try {
        await notifications.send({
          recipients: {
            type: 'entity',
            entityRef: userRef(namespace, r.requester),
          },
          payload: {
            title: m.title,
            description: `${r.resourceType}/${r.resourceName}`,
            link: `/requests/${r.id}`,
            severity: m.sev,
          },
        });
      } catch (e) {
        logger.warn(`notify decided failed for ${r.id}: ${e}`);
      }
    },

    async finished(
      r: {
        id: number;
        resourceType: string;
        resourceName: string;
        requester: string;
      },
      ok: boolean,
      resultRef?: string,
    ) {
      try {
        await notifications.send({
          recipients: {
            type: 'entity',
            entityRef: userRef(namespace, r.requester),
          },
          payload: {
            title: `Request #${r.id} ${ok ? 'succeeded' : 'failed'}`,
            description: resultRef
              ? `${r.resourceType}/${r.resourceName} → ${resultRef}`
              : `${r.resourceType}/${r.resourceName}`,
            link: `/requests/${r.id}`,
            severity: ok ? 'normal' : 'high',
          },
        });
      } catch (e) {
        logger.warn(`notify finished failed for ${r.id}: ${e}`);
      }
    },
  };
}
