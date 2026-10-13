import { LoggerService } from '@backstage/backend-plugin-api';
import { NotificationService } from '@backstage/plugin-notifications-node';
import {
  DEFAULT_NAMESPACE,
  Request as PlatformRequest,
  SuspendedNode,
  userRef,
} from '@internal/plugin-platform-common';

const displayName = (value: string) =>
  value
    .split('/')
    .pop()!
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

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
  requesterDisplayName: (requester: string) => Promise<string | undefined> =
    async () => undefined,
  resourceTypeDisplayName: (
    resourceType: string,
  ) => Promise<string | undefined> = async () => undefined,
) {
  const resourceLabel = async (resourceType: string) => {
    try {
      return (
        (await resourceTypeDisplayName(resourceType)) ?? displayName(resourceType)
      );
    } catch (e) {
      logger.warn(`resourceTypeDisplayName failed for '${resourceType}': ${e}`);
      return displayName(resourceType);
    }
  };

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
        const requester =
          (await requesterDisplayName(r.requester)) ?? displayName(r.requester);
        const resource = await resourceLabel(r.resourceType);
        await notifications.send({
          // `entityRef` takes an array (plugin-notifications-node), so this
          // stays a single send.
          recipients: { type: 'entity', entityRef: recipients },
          payload: {
            title: `Approval required · ${resource}`,
            description:
              `Request #${r.id} · ${resource} · ` +
              `Requested by ${requester} · ` +
              `Waiting for ${displayName(r.ownerGroup ?? 'platform-admins')}`,
            link: `/requests/${r.id}`,
            severity: 'normal',
          },
        });
      } catch (e) {
        logger.warn(`notify approvalNeeded failed for ${r.id}: ${e}`);
      }
    },

    /**
     * A workflow stopped at one or more suspend steps. Each step goes to the
     * people `mayResumeNode` would let answer it: a named approver group, the
     * owning team for an unannotated step, nobody beyond admins for an empty
     * annotation. The owning team is deliberately not told about a step another
     * team answers — it cannot act on it.
     *
     * One send per recipient group, and nothing dedupes across sends: an admin
     * who is also on a gate team gets two. ponytail: accepted — resolve groups
     * to users and fold per user if that becomes noise.
     */
    async gateNeeded(
      r: {
        id: number;
        resourceType: string;
        resourceName: string;
        ownerGroup?: string;
      },
      nodes: SuspendedNode[],
    ) {
      // recipient -> the steps they may answer. Admins may answer every step;
      // each team is told only about its own, so a parallel gate for another
      // team does not read as work for this one.
      const steps = new Map<
        string,
        { step: string; waitingFor: string }[]
      >();
      const add = (
        who: string | undefined,
        step: string,
        waitingFor: string | undefined,
      ) => {
        if (who && waitingFor) {
          steps.set(who, [
            ...(steps.get(who) ?? []),
            { step, waitingFor },
          ]);
        }
      };
      for (const n of nodes) {
        const annotated = n.approverGroup?.trim();
        const gateGroup =
          n.approverGroup === undefined ? r.ownerGroup : annotated;
        for (const admin of adminGroups) {
          add(admin, n.name, gateGroup || admin);
        }
        add(gateGroup, n.name, gateGroup);
      }
      const resource = await resourceLabel(r.resourceType);
      for (const [who, entries] of steps) {
        try {
          const names = [...new Set(entries.map(entry => entry.step))];
          const gateTeams = [
            ...new Set(entries.map(entry => displayName(entry.waitingFor))),
          ];
          await notifications.send({
            recipients: { type: 'entity', entityRef: who },
            payload: {
              title: `Input required · ${resource}`,
              description:
                `Request #${r.id} · ${resource} · ` +
                `Step: ${[...new Set(names)].map(displayName).join(', ')} · ` +
                `Waiting for ${gateTeams.join(', ')}`,
              link: `/requests/${r.id}`,
              severity: 'normal',
            },
          });
        } catch (e) {
          logger.warn(`notify gateNeeded failed for ${r.id} → ${who}: ${e}`);
        }
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
          title: 'Request approved',
          sev: 'normal',
        },
        REJECTED: {
          title: 'Request rejected',
          sev: 'high',
        },
      };
      const m = map[r.state];
      if (!m) return; // still pending (e.g. partial N_OF_M) — no alert
      try {
        const resource = await resourceLabel(r.resourceType);
        await notifications.send({
          recipients: {
            type: 'entity',
            entityRef: userRef(namespace, r.requester),
          },
          payload: {
            title: `${m.title} · ${resource}`,
            description: `Request #${r.id} · ${resource} · ${
              r.state === 'IN_PROGRESS' ? 'Workflow started' : 'Review the request'
            }`,
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
        const resource = await resourceLabel(r.resourceType);
        await notifications.send({
          recipients: {
            type: 'entity',
            entityRef: userRef(namespace, r.requester),
          },
          payload: {
            title: `Request ${ok ? 'completed' : 'failed'} · ${resource}`,
            description: resultRef
              ? `Request #${r.id} · ${resource} · Result: ${resultRef}`
              : `Request #${r.id} · ${resource} · ${
                  ok ? 'Resource created successfully' : 'Review the request'
                }`,
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
