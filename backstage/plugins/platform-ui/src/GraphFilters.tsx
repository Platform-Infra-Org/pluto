import { Card, CardHeader, CardBody, Field, Input, Select } from './components';

export type GraphFiltersProps = {
  maxDepth: number;
  kinds: string[];
  relations: string[];
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  curve: 'bezier' | 'smoothstep' | 'step' | 'straight';
  unidirectional: boolean;
  mergeRelations: boolean;
  availableKinds: string[];
  availableRelations: string[];
  onChange: (
    patch: Partial<
      Omit<GraphFiltersProps, 'availableKinds' | 'availableRelations' | 'onChange'>
    >,
  ) => void;
};

/** Toggle `value` in/out of `selected` and hand the result to `onChange`. */
function toggle(selected: string[], value: string): string[] {
  return selected.includes(value)
    ? selected.filter(v => v !== value)
    : [...selected, value];
}

/**
 * Scrollable list of labelled checkboxes standing in for a multi-select —
 * this plugin has no multi-select component, and this filter panel doesn't
 * need one built for a single use.
 */
function CheckboxList({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div
      style={{
        maxHeight: 160,
        overflowY: 'auto',
        border: '1px solid hsl(var(--sc-border))',
        borderRadius: 'var(--sc-radius)',
        padding: 8,
      }}
    >
      {options.length === 0 && <div className="sc-muted">None available</div>}
      {options.map(option => (
        <label key={option} className="sc-row" style={{ padding: '2px 0' }}>
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

export function GraphFilters({
  maxDepth,
  kinds,
  relations,
  direction,
  curve,
  unidirectional,
  mergeRelations,
  availableKinds,
  availableRelations,
  onChange,
}: GraphFiltersProps) {
  return (
    <Card>
      <CardHeader title="Filters" />
      <CardBody>
        <Field label="Max depth">
          <Input
            type="number"
            min={0}
            placeholder="∞ Infinite"
            value={Number.isFinite(maxDepth) ? maxDepth : ''}
            onChange={e => {
              const raw = e.target.value;
              onChange({ maxDepth: raw === '' ? Infinity : Number(raw) });
            }}
          />
        </Field>

        <Field label="Kinds">
          <CheckboxList
            options={availableKinds}
            selected={kinds}
            onToggle={value => onChange({ kinds: toggle(kinds, value) })}
          />
        </Field>

        <Field label="Relations">
          <CheckboxList
            options={availableRelations}
            selected={relations}
            onToggle={value =>
              onChange({ relations: toggle(relations, value) })
            }
          />
        </Field>

        <Field label="Direction">
          <Select
            value={direction}
            onChange={e =>
              onChange({
                direction: e.target.value as GraphFiltersProps['direction'],
              })
            }
          >
            <option value="LR">Left to right</option>
            <option value="RL">Right to left</option>
            <option value="TB">Top to bottom</option>
            <option value="BT">Bottom to top</option>
          </Select>
        </Field>

        <Field label="Edge style">
          <Select
            value={curve}
            onChange={e =>
              onChange({ curve: e.target.value as GraphFiltersProps['curve'] })
            }
          >
            <option value="bezier">Curved</option>
            <option value="smoothstep">Smooth step</option>
            <option value="step">Step</option>
            <option value="straight">Straight</option>
          </Select>
        </Field>

        <label className="sc-row" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={unidirectional}
            onChange={e => onChange({ unidirectional: e.target.checked })}
          />
          Simplified
        </label>

        <label className="sc-row">
          <input
            type="checkbox"
            checked={mergeRelations}
            onChange={e => onChange({ mergeRelations: e.target.checked })}
          />
          Merge relations
        </label>
      </CardBody>
    </Card>
  );
}
