/**
 * One stop on the tour.
 *
 * `selector` must name something that exists in the app today. A step whose
 * element is missing is skipped rather than shown framing empty space — see
 * `Quickstart.tsx` — but the right time to catch a stale selector is here,
 * where the test can see it.
 */
export interface QuickstartStep {
  id: string;
  /** What to highlight. Missing element = the step is skipped. */
  selector: string;
  title: string;
  body: string;
}

/**
 * The tour, in order.
 *
 * Bumped when the tour changes materially enough to be worth re-offering to
 * people who have already taken it. Stored per user, so raising this shows it
 * again exactly once.
 */
export const QUICKSTART_VERSION = 1;

export const QUICKSTART_STEPS: QuickstartStep[] = [
  {
    id: 'nav',
    selector: '.sc-nav',
    title: 'Everything lives here',
    body: 'The sidebar is the whole app: your resources, the templates that create them, and the requests in between. Drag its edge to resize it.',
  },
  {
    id: 'create',
    selector: '.sc-nav-item[href="/create"]',
    title: 'Ask for something',
    body: 'Create runs a software template. Filling one in does not provision anything on its own — it raises a request.',
  },
  {
    id: 'requests',
    selector: '.sc-nav-item[href="/requests"]',
    title: 'Requests are the record',
    body: 'Every request waits for an approver, then runs a workflow you can watch. Approvals and decisions are kept as an audit trail.',
  },
  {
    id: 'home-cards',
    selector: '.sc-grid-2',
    title: 'Home follows you',
    body: 'Pages you visit and templates you star show up here, so the things you use are one click from the front door.',
  },
  {
    id: 'picker',
    selector: '.sc-picker-float',
    title: 'Pick your potion',
    body: 'Each potion is a colour scheme. Drag the shelf if it ever covers something — your colour and where you put it are remembered in this browser.',
  },
];
