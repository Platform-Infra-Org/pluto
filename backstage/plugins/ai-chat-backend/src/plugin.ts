/** Backstage AI chat v1.1: ephemeral, no durable session or audit: authenticated demo submission via existing Scaffolder approval flow. */
import {
  coreServices,
  createBackendPlugin,
  type BackstageCredentials,
} from '@backstage/backend-plugin-api';
import { randomUUID } from 'node:crypto';
import {
  createPermission,
  AuthorizeResult,
} from '@backstage/plugin-permission-common';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { Router, json } from 'express';
import { McpHttpClient } from './mcp';
import { runAgentTurn, initialConversation, type ModelConfig } from './agent';
import { Sessions } from './sessions';
import { permissionScopedMcp } from './scope';
import { updateDraft, describeFields } from './draft';
import { confirmDraftReview, fingerprint } from './review';
import {
  createChatSettingStore,
  mayManageChat,
  DEFAULT_ADMIN_GROUPS,
} from './availability';
import {
  SUBMITTABLE_TEMPLATE,
  validateSubmissionDraft,
  assertDemoSubmissionTemplate,
  createScaffolderTask,
  templateRevision,
} from './submission';

const requestCreatePermission = createPermission({
  name: PLATFORM_PERMISSIONS.requestCreate,
  attributes: { action: 'create' },
});
const authError = (e: unknown) =>
  /Authentication|NotAllowed/i.test(e instanceof Error ? e.name : '');
const denied = (e: unknown) =>
  e instanceof Error &&
  /Template unavailable for the current user/.test(e.message);
const safeSessionError = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  return {
    status:
      code === 'SESSION_FORBIDDEN' ? 403 : code === 'SESSION_BUSY' ? 409 : 410,
    message: 'Session unavailable; start a new chat',
  };
};
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export const aiChatPlugin = createBackendPlugin({
  pluginId: 'ai-chat',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        userInfo: coreServices.userInfo,
        logger: coreServices.logger,
        catalog: catalogServiceRef,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        database: coreServices.database,
        permissions: coreServices.permissions,
        config: coreServices.rootConfig,
      },
      async init({
        httpRouter,
        httpAuth,
        userInfo,
        logger,
        catalog,
        auth,
        discovery,
        database,
        config,
        permissions,
      }) {
        const router = Router();
        router.use(json({ limit: '8kb' }));
        const sessions = new Sessions();
        const availability = await createChatSettingStore(
          await database.getClient(),
        );
        const adminGroups =
          config.getOptionalStringArray('platform.rbac.adminGroups') ??
          DEFAULT_ADMIN_GROUPS;

        // Same group-based authorization as platform-requests PUT /maintenance.
        // Backend enforces it independently of whether Settings renders a button.
        async function isAdmin(
          req: Parameters<typeof httpAuth.credentials>[0],
        ) {
          const credentials = await httpAuth.credentials(req, {
            allow: ['user'],
          });
          const info = await userInfo.getUserInfo(credentials);
          return mayManageChat(info.ownershipEntityRefs, adminGroups);
        }
        router.get('/availability', async (req, res) => {
          try {
            await httpAuth.credentials(req, { allow: ['user'] });
            const [enabled, canManage] = await Promise.all([
              availability.isEnabled(),
              isAdmin(req),
            ]);
            res.json({
              enabled: enabled && process.env.AI_CHAT_DEMO_ENABLED === '1',
              configured: process.env.AI_CHAT_DEMO_ENABLED === '1',
              canManage,
            });
          } catch (e) {
            logger.warn(
              `AI availability read failed: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'Chat availability unavailable' });
          }
        });
        router.put('/availability', async (req, res) => {
          try {
            if (!(await isAdmin(req))) {
              res.status(403).json({
                error: 'Only platform admins may change AI chat availability',
              });
              return;
            }
            if (
              typeof req.body?.enabled !== 'boolean' ||
              Object.keys(req.body).length !== 1
            ) {
              res.status(400).json({ error: 'Expected {enabled:boolean}' });
              return;
            }
            await availability.setEnabled(req.body.enabled);
            if (!req.body.enabled) sessions.clearAll();
            res.json({
              enabled:
                req.body.enabled && process.env.AI_CHAT_DEMO_ENABLED === '1',
              configured: process.env.AI_CHAT_DEMO_ENABLED === '1',
              canManage: true,
            });
          } catch (e) {
            logger.warn(
              `AI availability update failed: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'Could not update AI chat availability' });
          }
        });
        // Server-side kill switch: covers chat, drafts, review, options,
        // capabilities and human-initiated submission, not just the floating UI.
        router.use(async (req, res, next) => {
          try {
            await httpAuth.credentials(req, { allow: ['user'] });
            if (!(await availability.isEnabled())) {
              res.status(403).json({
                error: 'AI chat is disabled by a platform administrator',
              });
              return;
            }
            next();
          } catch (e) {
            logger.warn(
              `AI access gate failed: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'AI chat access unavailable' });
          }
        });

        // Private user-token verification for the standalone MCP bridge.
        // Backstage's native HTTP auth verifies signature and expiry; allow:user
        // rejects service credentials. Same bearer is then used by MCP for Catalog.
        router.get('/auth/validate-user', async (req, res) => {
          try {
            await httpAuth.credentials(req, { allow: ['user'] });
            res.setHeader('Cache-Control', 'no-store');
            res.status(204).end();
          } catch {
            res
              .status(401)
              .json({ error: 'Valid Backstage user token required' });
          }
        });

        async function canSubmitAsUser(credentials: BackstageCredentials) {
          const [decision] = await permissions.authorize(
            [{ permission: requestCreatePermission }],
            { credentials },
          );
          return decision?.result === AuthorizeResult.ALLOW;
        }

        // Build an MCP wrapper for the current authenticated Backstage human,
        // not an arbitrary userRef supplied in the HTTP request.
        async function context(
          req: Parameters<typeof httpAuth.credentials>[0],
        ) {
          if (process.env.AI_CHAT_DEMO_ENABLED !== '1')
            throw new Error('DEMO_DISABLED');
          const credentials = await httpAuth.credentials(req, {
            allow: ['user'],
          });
          const info = await userInfo.getUserInfo(credentials);
          const principal = info.userEntityRef;
          if (typeof principal !== 'string' || !principal.startsWith('user:'))
            throw new Error('Invalid user identity');
          const mcpUrl = process.env.MCP_URL;
          if (!mcpUrl) throw new Error('MCP_NOT_CONFIGURED');
          // The browser's fetchApi sent a Backstage user token. It has already
          // been authenticated above as a USER, not a service principal.
          const match = /^Bearer ([^\s]+)$/i.exec(
            req.headers.authorization ?? '',
          );
          if (!match) throw new Error('Backstage user bearer token required');
          const userToken = match[1];
          const mayReadTemplate = async (
            templateRef: string,
          ): Promise<boolean> => {
            // This permission check uses the actual signed-in human, not a
            // model-provided user ref and not a service/admin credential.
            const entity = await catalog.getEntityByRef(templateRef, {
              credentials,
            });
            if (!entity || entity.kind.toLowerCase() !== 'template')
              return false;
            const ns = (entity.metadata.namespace || 'default').toLowerCase();
            return (
              `template:${ns}/${entity.metadata.name.toLowerCase()}` ===
              templateRef.toLowerCase()
            );
          };
          const original = new McpHttpClient(mcpUrl, {
            token: userToken,
            mayReadTemplate,
          });
          const mcp = permissionScopedMcp(original, mayReadTemplate);
          return { principal, mcp, credentials };
        }
        function acquire(principal: string, sessionId: unknown) {
          if (typeof sessionId !== 'string' || sessionId.length > 80)
            throw new Error('INVALID_SESSION_ID');
          return sessions.acquire(principal, sessionId);
        }

        // Explicitly erase a temporary draft and conversation on "New chat".
        // Identity comes only from authenticated Backstage credentials; do not
        // accept user IDs from request bodies. No DB write or audit log.
        router.post('/session/clear', async (req, res) => {
          try {
            const credentials = await httpAuth.credentials(req, {
              allow: ['user'],
            });
            const info = await userInfo.getUserInfo(credentials);
            const id = req.body?.sessionId;
            if (typeof id !== 'string' || !id || id.length > 80) {
              res.status(400).json({ error: 'Valid sessionId required' });
              return;
            }
            try {
              sessions.clear(info.userEntityRef, id);
            } catch (e) {
              res
                .status(
                  e instanceof Error && e.message === 'SESSION_FORBIDDEN'
                    ? 403
                    : 409,
                )
                .json({ error: 'Conversation cannot be cleared' });
              return;
            }
            res.status(204).end();
          } catch (e) {
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'Could not clear conversation' });
          }
        });

        const submitEnabled = () =>
          process.env.AI_CHAT_DEMO_ENABLED === '1' &&
          process.env.AI_CHAT_SUBMIT_ENABLED === '1';
        router.get('/capabilities', async (req, res) => {
          try {
            await context(req);
            res.json({
              submissionEnabled: submitEnabled(),
              submittableTemplate: SUBMITTABLE_TEMPLATE,
            });
          } catch (e) {
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'Capabilities unavailable' });
          }
        });

        router.post('/chat', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            const { principal, mcp } = await context(req);
            const message = req.body?.message;
            const requestedSession = req.body?.sessionId;
            if (
              typeof message !== 'string' ||
              !message.trim() ||
              message.length > 2000 ||
              (requestedSession !== undefined &&
                (typeof requestedSession !== 'string' ||
                  requestedSession.length > 80))
            ) {
              res.status(400).json({
                error: 'Expected message (1–2000 chars) and optional sessionId',
              });
              return;
            }
            const apiUrl = process.env.QWEN_API_URL,
              apiKey = process.env.QWEN_API_KEY,
              model = process.env.QWEN_MODEL;
            if (!apiUrl || !apiKey || !model) {
              res.status(503).json({ error: 'AI provider not configured' });
              return;
            }
            const config: ModelConfig = {
              apiUrl,
              apiKey,
              model,
              allowHttpDev: process.env.AI_CHAT_ALLOW_HTTP_DEV === '1',
            };
            try {
              session = sessions.acquire(principal, requestedSession);
            } catch (e) {
              const err = safeSessionError(e);
              res.status(err.status).json({ error: err.message });
              return;
            }
            const id = session.id;
            if (session.state.submissionAttempted || session.state.submission) {
              sessions.finish(session);
              session = undefined;
              res.status(409).json({
                error:
                  'This draft already had a submission attempt; start a new chat',
              });
              return;
            }
            if (!session.state.messages.length)
              session.state = initialConversation();
            const out = await runAgentTurn({
              mcp,
              config,
              state: session.state,
              userMessage: message,
            });
            sessions.finish(session, out.state);
            session = undefined;
            res.json({
              reply: out.reply,
              sessionId: id,
              toolsUsed: out.toolsUsed,
              draft: out.state.draft ?? null,
              review: null,
              submission: null,
            });
          } catch (e) {
            if (session) sessions.finish(session);
            logger.warn(
              `AI chat failure: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res
              .status(authError(e) ? 401 : 503)
              .json({ error: 'AI chat unavailable or authentication failed' });
          }
        });

        router.post('/draft/edit', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            const { principal, mcp } = await context(req);
            if (
              typeof req.body?.sessionId !== 'string' ||
              req.body.sessionId.length > 80
            ) {
              res.status(400).json({ error: 'Missing sessionId' });
              return;
            }
            try {
              session = acquire(principal, req.body.sessionId);
            } catch (e) {
              const x = safeSessionError(e);
              res.status(x.status).json({ error: x.message });
              return;
            }
            if (session.state.submissionAttempted || session.state.submission) {
              res.status(409).json({
                error: 'A submission was already attempted; start a new chat',
              });
              sessions.finish(session);
              session = undefined;
              return;
            }
            if (!session.state.draft) {
              res
                .status(409)
                .json({ error: 'Start a request draft in chat first' });
              sessions.finish(session);
              session = undefined;
              return;
            }
            const current = session.state.draft;
            const values = asRecord(req.body.values);
            const clearFields =
              req.body.clearFields === undefined ? [] : req.body.clearFields;
            const next = await updateDraft({
              mcp,
              current,
              templateRef: current.templateRef,
              values,
              clearFields: Array.isArray(clearFields) ? clearFields : [null],
            });
            session.state = {
              ...session.state,
              draft: next,
              review: undefined,
              submissionChallenge: undefined,
            };
            sessions.finish(session);
            session = undefined;
            res.json({ draft: next, review: null });
          } catch (e) {
            if (session) sessions.finish(session);
            logger.warn(
              `AI draft edit rejected: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res.status(authError(e) ? 401 : denied(e) ? 403 : 400).json({
              error:
                'Draft edit rejected; check field type, permissions, dependencies and live options',
            });
          }
        });

        router.get('/draft/options', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            const { principal, mcp } = await context(req);
            if (
              typeof req.query.sessionId !== 'string' ||
              typeof req.query.fieldName !== 'string'
            ) {
              res
                .status(400)
                .json({ error: 'sessionId and fieldName required' });
              return;
            }
            try {
              session = acquire(principal, req.query.sessionId);
            } catch (e) {
              const x = safeSessionError(e);
              res.status(x.status).json({ error: x.message });
              return;
            }
            const draft = session.state.draft;
            if (!draft) {
              res.status(409).json({ error: 'No draft available' });
              return;
            }
            const schema = await mcp.callTool('get_template_schema', {
              templateRef: draft.templateRef,
            });
            const field = describeFields(schema).find(
              f => f.path === req.query.fieldName,
            );
            if (
              !field ||
              !field.supported ||
              field.uiField !== 'DynamicSelect'
            ) {
              res
                .status(400)
                .json({ error: 'Field is not a supported dynamic selector' });
              return;
            }
            if (
              field.dependsOn.some(
                dep => !Object.prototype.hasOwnProperty.call(draft.values, dep),
              )
            ) {
              res.json({
                options: [],
                needsInput: true,
                dependsOn: field.dependsOn,
              });
              return;
            }
            const data = await mcp.callTool('resolve_dynamic_options', {
              templateRef: draft.templateRef,
              fieldName: field.path,
              selectedValues: draft.values,
            });
            const options = (Array.isArray(data.options) ? data.options : [])
              .slice(0, 80)
              .flatMap(raw => {
                const option = asRecord(raw),
                  value = option.value;
                if (typeof value !== 'string' && typeof value !== 'number')
                  return [];
                if (typeof value === 'string' && value.length > 250) return [];
                return [
                  {
                    value,
                    label:
                      typeof option.label === 'string'
                        ? option.label.slice(0, 160)
                        : String(value),
                  },
                ];
              });
            res.json({
              options,
              needsInput: data.needsInput === true,
              dependsOn: field.dependsOn,
            });
          } catch (e) {
            logger.warn(
              `AI options lookup rejected: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res
              .status(authError(e) ? 401 : denied(e) ? 403 : 503)
              .json({ error: 'Dynamic options unavailable' });
          } finally {
            if (session) sessions.finish(session);
          }
        });

        router.post('/draft/review', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            const { principal, mcp } = await context(req);
            if (
              typeof req.body?.sessionId !== 'string' ||
              req.body.sessionId.length > 80
            ) {
              res.status(400).json({ error: 'Missing sessionId' });
              return;
            }
            try {
              session = acquire(principal, req.body.sessionId);
            } catch (e) {
              const x = safeSessionError(e);
              res.status(x.status).json({ error: x.message });
              return;
            }
            if (session.state.submissionAttempted || session.state.submission) {
              res.status(409).json({
                error: 'A submission was already attempted; start a new chat',
              });
              sessions.finish(session);
              session = undefined;
              return;
            }
            const { draft, review } = await confirmDraftReview(
              mcp,
              session.state.draft,
            );
            session.state = {
              ...session.state,
              draft,
              review,
              submissionChallenge: undefined,
            };
            sessions.finish(session);
            session = undefined;
            res.json({
              draft,
              review,
              note: 'Preview acknowledged only. No request/task/workflow created.',
            });
          } catch (e) {
            if (session) sessions.finish(session);
            logger.warn(
              `AI review rejected: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res.status(authError(e) ? 401 : denied(e) ? 403 : 409).json({
              error:
                'Review blocked; ensure the draft is valid and available to your user',
            });
          }
        });
        // Two explicit browser actions. The model/MCP have NO submit tool.
        // Prepare issues a short-lived, session-bound one-time challenge after
        // live validation and a user-scoped Catalog read.
        router.post('/draft/submit/prepare', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            if (!submitEnabled()) {
              res.status(403).json({ error: 'Submission is disabled' });
              return;
            }
            const { principal, mcp, credentials } = await context(req);
            if (!(await canSubmitAsUser(credentials)))
              throw new Error('Request creation not permitted');
            if (
              typeof req.body?.sessionId !== 'string' ||
              !req.body.sessionId ||
              req.body.sessionId.length > 80
            ) {
              res.status(400).json({ error: 'Existing sessionId required' });
              return;
            }
            session = acquire(principal, req.body.sessionId);
            if (session.state.submissionAttempted || session.state.submission)
              throw new Error('Already attempted');
            const verified = await validateSubmissionDraft(
              mcp,
              session.state.draft,
              session.state.review,
            );
            const entity = await catalog.getEntityByRef(SUBMITTABLE_TEMPLATE, {
              credentials,
            });
            assertDemoSubmissionTemplate(entity);
            const token = randomUUID();
            session.state.submissionChallenge = {
              token,
              fingerprint: fingerprint(verified.draft),
              templateRevision: templateRevision(entity),
              expiresAt: Date.now() + 120_000,
            };
            session.state.draft = verified.draft;
            res.json({
              confirmationToken: token,
              expiresInSeconds: 120,
              summary: {
                templateRef: SUBMITTABLE_TEMPLATE,
                values: verified.values,
                warning:
                  'This will start a Scaffolder task that creates a PENDING_APPROVAL Request. No Argo workflow runs until approval.',
              },
            });
          } catch (e) {
            logger.warn(
              `AI submit preflight denied: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            res.status(authError(e) ? 401 : 403).json({
              error:
                'Submission not permitted or draft changed; review it again',
            });
          } finally {
            if (session) sessions.finish(session);
          }
        });

        router.post('/draft/submit', async (req, res) => {
          let session: ReturnType<Sessions['acquire']> | undefined;
          try {
            if (!submitEnabled()) {
              res.status(403).json({ error: 'Submission is disabled' });
              return;
            }
            if (
              typeof req.body?.confirmationToken !== 'string' ||
              req.body.confirmationToken.length > 80
            ) {
              res.status(400).json({ error: 'Confirmation token required' });
              return;
            }
            const { principal, mcp, credentials } = await context(req);
            if (!(await canSubmitAsUser(credentials)))
              throw new Error('Request creation not permitted');
            if (
              typeof req.body?.sessionId !== 'string' ||
              !req.body.sessionId ||
              req.body.sessionId.length > 80
            ) {
              res.status(400).json({ error: 'Existing sessionId required' });
              return;
            }
            session = acquire(principal, req.body.sessionId);
            if (session.state.submissionAttempted || session.state.submission)
              throw new Error('Already attempted');
            const challenge = session.state.submissionChallenge;
            if (
              !challenge ||
              challenge.token !== req.body.confirmationToken ||
              challenge.expiresAt < Date.now() ||
              !session.state.draft ||
              challenge.fingerprint !== fingerprint(session.state.draft)
            ) {
              throw new Error('Confirmation expired or draft changed');
            }
            const verified = await validateSubmissionDraft(
              mcp,
              session.state.draft,
              session.state.review,
            );
            const entity = await catalog.getEntityByRef(SUBMITTABLE_TEMPLATE, {
              credentials,
            });
            assertDemoSubmissionTemplate(entity);
            if (challenge.templateRevision !== templateRevision(entity))
              throw new Error(
                'Catalog template changed after user confirmation',
              );
            // Do not reuse service credentials: OBO preserves the human's identity
            // and lets Scaffolder evaluate taskCreatePermission for that user.
            const { token } = await auth.getPluginRequestToken({
              onBehalfOf: credentials,
              targetPluginId: 'scaffolder',
            });
            const baseUrl = await discovery.getBaseUrl('scaffolder');
            // Recheck the global switch immediately before the only write.
            if (!(await availability.isEnabled()))
              throw new Error('AI_CHAT_DISABLED');
            // Fail closed on retries after any ambiguous upstream outcome.
            session.state.submissionAttempted = true;
            session.state.submissionChallenge = undefined;
            const taskId = await createScaffolderTask({
              baseUrl,
              token,
              values: verified.values,
            });
            const submission = {
              taskId,
              templateRef: SUBMITTABLE_TEMPLATE,
              submittedAt: new Date().toISOString(),
            };
            session.state.submission = submission;
            session.state.draft = verified.draft;
            logger.info(
              'AI demo Scaffolder task submitted by authenticated user; task ID returned',
            );
            res.status(201).json({ submission });
          } catch (e) {
            logger.warn(
              `AI Scaffolder submit blocked/failed: ${
                e instanceof Error ? e.name : 'UnknownError'
              }`,
            );
            // After an upstream attempt a timeout might have created a task.
            const attempted = session?.state.submissionAttempted === true;
            res.status(attempted ? 502 : 403).json({
              error: attempted
                ? 'Submission outcome uncertain. Do not retry this draft; check Scaffolder tasks.'
                : 'Not permitted or draft/review expired; no submission attempted',
            });
          } finally {
            if (session) sessions.finish(session);
          }
        });
        httpRouter.use(router);
        logger.info(
          'ai-chat v1.3.1 user-scoped MCP bearer registered (no chat persistence or audit)',
        );
      },
    });
  },
});
