/** The AI demo is read-only and limited to these two templates.
 * Authentication uses each request's native Backstage USER token, not an
 * HMAC-scoped credential, shared secret, or service account token.
 */
export const DEMO_TEMPLATE_REFS = [
  'template:default/demo-resource',
  'template:default/coordinate-demo',
] as const;
export const MCP_READ_TOOLS = [
  'discover_templates',
  'get_template_schema',
  'describe_template_form',
  'resolve_dynamic_options',
] as const;
