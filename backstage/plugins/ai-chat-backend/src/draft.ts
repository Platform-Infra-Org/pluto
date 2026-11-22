/** Deterministic, read-only request draft. The model proposes edits; the server validates them. */
import type { McpClient } from './agent';

export type DraftValue = string | number | boolean;
export type DraftValues = Record<string, DraftValue>;
export type DraftField = {
  path: string;
  title: string;
  type: string;
  required: boolean;
  uiField?: string;
  dependsOn?: string[];
  enum?: DraftValue[];
  state: 'filled' | 'missing' | 'optional' | 'unsupported';
};
export type RequestDraft = {
  templateRef: string;
  title: string;
  values: DraftValues;
  fields: DraftField[];
  missingFields: string[];
  issues: string[];
  readyForReview: boolean;
  checkedAt: string;
};

const DEMO_TEMPLATES = new Set([
  'template:default/demo-resource',
  'template:default/coordinate-demo',
]);
const SAFE_PATH = /^[a-zA-Z_][a-zA-Z0-9_-]*(\.[a-zA-Z_][a-zA-Z0-9_-]*)*$/;
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const asObject = (value: unknown): Record<string, unknown> =>
  isObject(value) ? value : {};
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const isScalar = (v: unknown): v is DraftValue =>
  typeof v === 'string' ||
  typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v));
const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function assertPath(path: string) {
  if (
    path.length > 200 ||
    !SAFE_PATH.test(path) ||
    path.split('.').some(p => DANGEROUS_SEGMENTS.has(p))
  ) {
    throw new Error('Invalid field path');
  }
}

export type FieldDescriptor = {
  path: string;
  title: string;
  type: string;
  required: boolean;
  raw: Record<string, unknown>;
  uiField?: string;
  dependsOn: string[];
  supported: boolean;
};

export function describeFields(
  schema: Record<string, unknown>,
): FieldDescriptor[] {
  const steps = asArray(schema.steps);
  if (!steps.length || steps.length > 20)
    throw new Error('Invalid template schema');
  const fields: FieldDescriptor[] = [];
  const visited = new Set<string>();
  const visit = (
    properties: Record<string, unknown>,
    required: Set<string>,
    prefix: string,
    parentRequired: boolean,
    depth: number,
  ) => {
    if (depth > 8 || fields.length > 150)
      throw new Error('Form is too complex for draft preview');
    for (const [name, untrusted] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${name}` : name;
      assertPath(path);
      if (visited.has(path)) throw new Error(`Duplicate form field: ${path}`);
      visited.add(path);
      const raw = asObject(untrusted);
      const type =
        typeof raw.type === 'string'
          ? raw.type
          : isObject(raw.properties)
          ? 'object'
          : 'unknown';
      const uiField =
        typeof raw['ui:field'] === 'string' ? raw['ui:field'] : undefined;
      const uiOptions = asObject(raw['ui:options']);
      const dependsOn =
        uiField === 'DynamicSelect'
          ? asArray(uiOptions.dependsOn).map(dep => {
              if (typeof dep !== 'string')
                throw new Error('Invalid field dependency');
              const absolute = dep.includes('.')
                ? dep
                : prefix
                ? `${prefix}.${dep}`
                : dep;
              assertPath(absolute);
              return absolute;
            })
          : [];
      const sensitive =
        uiField === 'PlatformSecret' ||
        raw.format === 'password' ||
        raw['ui:widget'] === 'password';
      const complex = [
        'oneOf',
        'anyOf',
        'allOf',
        'if',
        'then',
        'else',
        '$ref',
        'dependencies',
        'dependentSchemas',
      ].some(k => raw[k] !== undefined);
      const supported =
        !complex &&
        !sensitive &&
        !['PlatformFile', 'MultiEntityPicker'].includes(uiField ?? '') &&
        ['string', 'number', 'integer', 'boolean'].includes(type);
      fields.push({
        path,
        title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : name,
        type,
        required: parentRequired && required.has(name),
        raw,
        uiField,
        dependsOn,
        supported,
      });
      if (type === 'object' && isObject(raw.properties)) {
        visit(
          raw.properties,
          new Set(
            asArray(raw.required).filter(
              (x): x is string => typeof x === 'string',
            ),
          ),
          path,
          parentRequired && required.has(name),
          depth + 1,
        );
      }
    }
  };
  for (const step of steps) {
    const stepSchema = asObject(asObject(step).schema);
    visit(
      asObject(stepSchema.properties),
      new Set(
        asArray(stepSchema.required).filter(
          (x): x is string => typeof x === 'string',
        ),
      ),
      '',
      true,
      0,
    );
  }
  return fields;
}

function validateBasic(
  field: FieldDescriptor,
  value: DraftValue,
): string | undefined {
  const { raw, type, path } = field;
  if (!field.supported)
    return `${path}: שדה דורש ממשק ייעודי או Validator מתקדם`;
  if (type === 'string' && typeof value !== 'string')
    return `${path}: expected string`;
  if (type === 'boolean' && typeof value !== 'boolean')
    return `${path}: expected boolean`;
  if (
    type === 'number' &&
    (typeof value !== 'number' || !Number.isFinite(value))
  )
    return `${path}: expected number`;
  if (
    type === 'integer' &&
    (typeof value !== 'number' || !Number.isSafeInteger(value))
  )
    return `${path}: expected integer`;
  if (typeof value === 'string') {
    if (value.length > 500) return `${path}: value too long`;
    if (typeof raw.minLength === 'number' && value.length < raw.minLength)
      return `${path}: too short`;
    if (typeof raw.maxLength === 'number' && value.length > raw.maxLength)
      return `${path}: too long`;
    if (raw.pattern !== undefined || raw.format !== undefined)
      return `${path}: pattern/format requires a full validator (not supported in preview)`;
    if (value.trim() === '') return `${path}: cannot be empty`;
  }
  if (typeof value === 'number') {
    if (typeof raw.minimum === 'number' && value < raw.minimum)
      return `${path}: below minimum`;
    if (typeof raw.maximum === 'number' && value > raw.maximum)
      return `${path}: above maximum`;
    if (
      typeof raw.multipleOf === 'number' ||
      raw.exclusiveMaximum !== undefined ||
      raw.exclusiveMinimum !== undefined
    ) {
      return `${path}: advanced numeric constraint requires a full validator`;
    }
  }
  if (Array.isArray(raw.enum) && !raw.enum.some(item => item === value))
    return `${path}: value is not in the allowed enum`;
  if (raw.const !== undefined && raw.const !== value)
    return `${path}: value differs from required constant`;
  return undefined;
}

function publicDraft(
  templateRef: string,
  title: string,
  fields: FieldDescriptor[],
  values: DraftValues,
  issues: string[],
): RequestDraft {
  const missingFields = fields
    .filter(f => f.required && f.supported && !hasOwn(values, f.path))
    .map(f => f.path);
  const unsupportedRequired = fields.filter(
    f => f.required && !f.supported && f.type !== 'object',
  );
  for (const f of unsupportedRequired)
    issues.push(`${f.path}: צריך ממשק ייעודי`);
  const uiFields: DraftField[] = fields
    .filter(f => f.type !== 'object')
    .map(f => ({
      path: f.path,
      title: f.title,
      type: f.type,
      required: f.required,
      ...(f.uiField ? { uiField: f.uiField } : {}),
      ...(f.dependsOn.length ? { dependsOn: f.dependsOn } : {}),
      ...(Array.isArray(f.raw.enum) &&
      f.raw.enum.length <= 30 &&
      f.raw.enum.every(isScalar)
        ? { enum: f.raw.enum as DraftValue[] }
        : {}),
      state: !f.supported
        ? 'unsupported'
        : hasOwn(values, f.path)
        ? 'filled'
        : f.required
        ? 'missing'
        : 'optional',
    }));
  return {
    templateRef,
    title,
    values: { ...values },
    fields: uiFields,
    missingFields,
    issues: [...new Set(issues)],
    readyForReview: missingFields.length === 0 && issues.length === 0,
    checkedAt: new Date().toISOString(),
  };
}

/** The model can propose only scalar field values, not raw Scaffolder steps/actions. */
export async function updateDraft({
  mcp,
  current,
  templateRef,
  values = {},
  clearFields = [],
}: {
  mcp: McpClient;
  current?: RequestDraft;
  templateRef: string;
  values?: Record<string, unknown>;
  clearFields?: unknown[];
}): Promise<RequestDraft> {
  if (!DEMO_TEMPLATES.has(templateRef))
    throw new Error('Template is not allowed in the public model demo');
  if (
    !isObject(values) ||
    Object.keys(values).length > 25 ||
    !Array.isArray(clearFields) ||
    clearFields.length > 25
  ) {
    throw new Error('Invalid draft edit');
  }
  const schema = await mcp.callTool('get_template_schema', { templateRef });
  const fields = describeFields(schema);
  const byPath = new Map(fields.map(f => [f.path, f]));
  const next: DraftValues =
    current?.templateRef === templateRef ? { ...current.values } : {};
  const editPaths = Object.keys(values);
  for (const path of [...editPaths, ...clearFields]) {
    if (typeof path !== 'string') throw new Error('Invalid field name');
    assertPath(path);
    if (!byPath.has(path)) throw new Error(`Undeclared form field: ${path}`);
  }
  for (const path of clearFields) delete next[path as string];
  for (const path of editPaths) {
    const value = values[path];
    if (!isScalar(value))
      throw new Error(
        `${path}: only scalar fields are supported in this version`,
      );
    const error = validateBasic(byPath.get(path)!, value);
    if (error) throw new Error(error);
    next[path] = value;
  }

  // If a parent value changes, previously selected descendants may be invalid.
  // Drop only descendants that were not re-entered in this same atomic update.
  const changed = new Set([...editPaths, ...clearFields]);
  let modified: boolean;
  do {
    modified = false;
    for (const f of fields) {
      if (!f.dependsOn.length || !hasOwn(next, f.path) || changed.has(f.path))
        continue;
      if (f.dependsOn.some(dep => changed.has(dep))) {
        delete next[f.path];
        changed.add(f.path);
        modified = true;
      }
    }
  } while (modified);

  const issues: string[] = [];
  for (const field of fields) {
    if (!hasOwn(next, field.path)) continue;
    const basic = validateBasic(field, next[field.path]);
    if (basic) throw new Error(basic);
    if (field.uiField === 'DynamicSelect') {
      const missingDeps = field.dependsOn.filter(dep => !hasOwn(next, dep));
      if (missingDeps.length)
        throw new Error(
          `${field.path}: choose ${missingDeps.join(', ')} first`,
        );
      const optionsData = await mcp.callTool('resolve_dynamic_options', {
        templateRef,
        fieldName: field.path,
        selectedValues: next,
      });
      if (optionsData.needsInput === true)
        throw new Error(`${field.path}: missing parent selection`);
      if (!Array.isArray(optionsData.options))
        throw new Error(`${field.path}: live options unavailable`);
      const liveMatch = optionsData.options.some(option => {
        const o = asObject(option);
        return (
          typeof o.value === typeof next[field.path] &&
          o.value === next[field.path]
        );
      });
      if (!liveMatch)
        throw new Error(`${field.path}: selection is not among live options`);
    }
  }
  return publicDraft(
    templateRef,
    typeof schema.title === 'string' ? schema.title.slice(0, 160) : templateRef,
    fields,
    next,
    issues,
  );
}

/** Only allow public, structured draft information in prompts and API responses. */
export function draftSnapshot(draft: RequestDraft | undefined) {
  if (!draft)
    return {
      status: 'no_draft',
      note: 'Select a demo template before collecting fields',
    };
  return {
    templateRef: draft.templateRef,
    values: draft.values,
    missingFields: draft.missingFields,
    issues: draft.issues,
    readyForReview: draft.readyForReview,
  };
}
