/** MCP HTTP client. Forwards the *actual signed-in Backstage user's token*.
 * There are no shared service credentials, custom signatures, or MCP secrets.
 * The token is validated as a user credential by Backstage on EVERY MCP RPC.
 * Never expose the token to the LLM, chat state, or response body.
 */
import type { McpClient, ToolDefinition } from './agent';
import { DEMO_TEMPLATE_REFS, MCP_READ_TOOLS } from './mcp-capability';

type UserOptions = {
  token: string;
  mayReadTemplate: (ref: string) => Promise<boolean>;
};
const approved = new Set<string>(MCP_READ_TOOLS);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export class McpHttpClient implements McpClient {
  private id = 0;
  private readonly url: string;
  private readonly scope: UserOptions;
  private readonly fetchImpl: typeof fetch;
  constructor(
    url: string,
    scope: UserOptions,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.url = url;
    this.scope = scope;
    this.fetchImpl = fetchImpl;
    if (
      typeof scope.token !== 'string' ||
      scope.token.length < 20 ||
      /\s/.test(scope.token)
    )
      throw new Error('Valid Backstage user bearer token required');
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol))
      throw new Error('Unsupported MCP URL');
    if (
      u.protocol === 'http:' &&
      !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)
    )
      throw new Error('MCP_URL requires HTTPS outside localhost');
  }
  private async authorizedRefs(
    method: string,
    params: Record<string, unknown>,
  ): Promise<string[]> {
    if (method === 'tools/list') return [];
    if (
      method !== 'tools/call' ||
      typeof params.name !== 'string' ||
      !approved.has(params.name)
    )
      throw new Error('MCP method/tool not approved');
    const args = params.arguments;
    if (!isRecord(args)) throw new Error('Invalid MCP tool arguments');
    const refs =
      params.name === 'discover_templates'
        ? [...DEMO_TEMPLATE_REFS]
        : [args.templateRef];
    if (
      refs.some(
        ref =>
          typeof ref !== 'string' ||
          !DEMO_TEMPLATE_REFS.includes(
            ref as (typeof DEMO_TEMPLATE_REFS)[number],
          ),
      )
    )
      throw new Error('Template unavailable for current user');
    const visible: string[] = [];
    for (const ref of refs) {
      try {
        if (await this.scope.mayReadTemplate(ref as string))
          visible.push(ref as string);
      } catch {
        /* fail closed */
      }
    }
    if (params.name !== 'discover_templates' && visible.length !== 1)
      throw new Error('Template unavailable for current user');
    return visible;
  }
  private async rpc(
    method: 'tools/list' | 'tools/call',
    params: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const id = ++this.id;
    await this.authorizedRefs(method, params);
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.scope.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`MCP returned HTTP ${res.status}`);
    const raw = await res.text();
    if (raw.length > 2_000_000) throw new Error('MCP response too large');
    const chunks: string[] = [];
    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      let block: string[] = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith('data:')) block.push(line.slice(5).trimStart());
        if (!line && block.length) {
          chunks.push(block.join('\n'));
          block = [];
        }
      }
      if (block.length) chunks.push(block.join('\n'));
    } else chunks.push(raw);
    for (const chunk of chunks) {
      if (chunk === '[DONE]') continue;
      const env = JSON.parse(chunk) as Record<string, unknown>;
      if (env.id !== id) continue;
      if (env.error) throw new Error('MCP JSON-RPC error');
      if (!env.result || typeof env.result !== 'object')
        throw new Error('Malformed MCP result');
      return env.result as Record<string, unknown>;
    }
    throw new Error('MCP response did not match request');
  }
  async listTools(): Promise<ToolDefinition[]> {
    const r = await this.rpc('tools/list');
    return Array.isArray(r.tools) ? (r.tools as ToolDefinition[]) : [];
  }
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const r = await this.rpc('tools/call', { name, arguments: args });
    if (r.isError) throw new Error('MCP tool failed');
    const content = Array.isArray(r.content) ? r.content : [];
    const first = content.find(
      x => x && x.type === 'text' && typeof x.text === 'string',
    );
    if (!first) throw new Error('MCP tool returned no data');
    const result: unknown = JSON.parse(first.text);
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new Error('Malformed MCP tool payload');
    return result as Record<string, unknown>;
  }
}
