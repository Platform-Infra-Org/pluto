/** Restrict every MCP read to Backstage templates visible to the authenticated user.
 * This guards model-facing data. It is NOT a permission to create a request.
 */
import { ALLOWED_DEMO_REFS, type McpClient } from './agent';

export type TemplateAccessCheck = (templateRef: string) => Promise<boolean>;

export function permissionScopedMcp(
  mcp: McpClient,
  mayReadTemplate: TemplateAccessCheck,
): McpClient {
  async function permitted(ref: string): Promise<boolean> {
    if (!ALLOWED_DEMO_REFS.has(ref)) return false;
    try {
      return await mayReadTemplate(ref);
    } catch {
      return false;
    }
  }
  return {
    listTools: () => mcp.listTools(),
    async callTool(name, args) {
      if (name === 'discover_templates') {
        const visible: string[] = [];
        // Fail closed before even asking the MCP for discovery.
        for (const ref of ALLOWED_DEMO_REFS)
          if (await permitted(ref)) visible.push(ref);
        if (!visible.length)
          return { templates: [], matched: 0, truncated: false };
        const result = await mcp.callTool(name, args);
        const list = Array.isArray(result.templates) ? result.templates : [];
        const filtered = list.filter(item => {
          if (!item || typeof item !== 'object' || Array.isArray(item))
            return false;
          const ref = (item as Record<string, unknown>).ref;
          return typeof ref === 'string' && visible.includes(ref);
        });
        return { ...result, templates: filtered, matched: filtered.length };
      }
      if (
        ![
          'get_template_schema',
          'describe_template_form',
          'resolve_dynamic_options',
        ].includes(name)
      ) {
        throw new Error('MCP tool is not approved');
      }
      const templateRef = args.templateRef;
      if (typeof templateRef !== 'string' || !(await permitted(templateRef))) {
        throw new Error('Template unavailable for the current user');
      }
      return mcp.callTool(name, args);
    },
  };
}
