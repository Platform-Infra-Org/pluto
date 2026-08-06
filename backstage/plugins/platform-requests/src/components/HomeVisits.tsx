import { Link } from '@backstage/core-components';
import { Card, EmptyState, SCROLL, useVisits } from '@internal/plugin-platform-ui';

/**
 * Where you have been lately.
 *
 * Reads the per-user visit log. It renders empty on first paint and fills in
 * when the server answers, so the empty state has to be the honest one rather
 * than a placeholder — hence the hint, which is also what a genuinely new user
 * sees.
 */
export function RecentlyVisited({ max }: { max: number }) {
  const visits = useVisits();
  const shown = visits.slice(0, max);

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Recently visited</div>
      </div>
      {shown.length === 0 ? (
        <div className="sc-card-b">
          <EmptyState
            sprite={SCROLL}
            title="Nothing yet"
            hint="Pages you open show up here, newest first."
          />
        </div>
      ) : (
        <div className="sc-card-b sc-grid" style={{ gap: 8 }}>
          {shown.map(v => (
            <Link key={v.path} to={v.path} className="sc-action">
              <span className="sc-action-l">{v.title}</span>
              <span className="sc-action-h sc-muted">{v.path}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
