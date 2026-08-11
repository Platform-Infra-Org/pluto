import qs from 'qs';

export type Direction = 'TB' | 'BT' | 'LR' | 'RL';
export type Curve = 'bezier' | 'smoothstep' | 'step' | 'straight';

export type GraphState = {
  rootEntityRefs: string[];
  maxDepth: number;
  selectedKinds: string[];
  selectedRelations: string[];
  unidirectional: boolean;
  mergeRelations: boolean;
  direction: Direction;
  curve: Curve;
  showFilters: boolean;
};

export const EMPTY: GraphState = {
  rootEntityRefs: [],
  maxDepth: Infinity,
  selectedKinds: [],
  selectedRelations: [],
  unidirectional: false,
  mergeRelations: false,
  direction: 'LR',
  curve: 'bezier',
  showFilters: false,
};

const DIRECTIONS: Direction[] = ['TB', 'BT', 'LR', 'RL'];
const CURVES: Curve[] = ['bezier', 'smoothstep', 'step', 'straight'];

const INFINITY_SYMBOL = '∞'; // ∞

function parseArray(v: unknown): string[] {
  // Backstage requires Array.isArray here; a scalar value is silently
  // ignored, matched here on purpose so old links behave identically.
  return Array.isArray(v) ? (v as string[]) : [];
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export function parseGraphQuery(search: string): GraphState {
  // qs.parse has no arrayFormat option — it parses bracket-array syntax
  // (`a[]=x`) automatically and leaves a bare `a=x` as a scalar, which is
  // exactly the Array.isArray-dependent behaviour we need to match.
  const parsed = qs.parse(search, {
    ignoreQueryPrefix: true,
  });

  const maxDepthRaw = parsed.maxDepth;
  const maxDepth =
    maxDepthRaw === undefined || maxDepthRaw === INFINITY_SYMBOL
      ? Infinity
      : Number(maxDepthRaw);

  const direction = DIRECTIONS.includes(parsed.direction as Direction)
    ? (parsed.direction as Direction)
    : EMPTY.direction;

  // Legacy d3 curve names ('curveMonotoneX', 'curveStepBefore') are not
  // translated — deliberate break with the old meaning, see plan Task 4 /
  // Open decision 1. They fall back to the default like any unknown value.
  const curve = CURVES.includes(parsed.curve as Curve)
    ? (parsed.curve as Curve)
    : EMPTY.curve;

  return {
    rootEntityRefs: parseArray(parsed.rootEntityRefs),
    maxDepth,
    selectedKinds: parseArray(parsed.selectedKinds),
    selectedRelations: parseArray(parsed.selectedRelations),
    unidirectional: parseBool(parsed.unidirectional, EMPTY.unidirectional),
    mergeRelations: parseBool(parsed.mergeRelations, EMPTY.mergeRelations),
    direction,
    curve,
    showFilters: parseBool(parsed.showFilters, EMPTY.showFilters),
  };
}

export function toGraphQuery(state: GraphState): string {
  return qs.stringify(
    {
      rootEntityRefs: state.rootEntityRefs,
      maxDepth: state.maxDepth === Infinity ? INFINITY_SYMBOL : state.maxDepth,
      selectedKinds: state.selectedKinds,
      selectedRelations: state.selectedRelations,
      unidirectional: state.unidirectional,
      mergeRelations: state.mergeRelations,
      direction: state.direction,
      curve: state.curve,
      showFilters: state.showFilters,
    },
    { arrayFormat: 'brackets', addQueryPrefix: true },
  );
}
