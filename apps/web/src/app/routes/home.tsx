import { Link } from '@tanstack/react-router'
import { Boxes, GitPullRequest, Plus, ShieldCheck, Workflow } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'

type Feature = {
  title: string
  desc: string
  icon: typeof Boxes
  to: string
  show: (a: { canApprove: boolean; isOwner: boolean }) => boolean
}

const FEATURES: Feature[] = [
  { title: 'Resources', desc: 'Browse and inspect the resources you own.', icon: Boxes, to: '/resources', show: () => true },
  { title: 'My Requests', desc: 'Track change requests and their live state.', icon: GitPullRequest, to: '/requests', show: () => true },
  { title: 'Approvals', desc: 'Review and approve pending changes.', icon: ShieldCheck, to: '/requests/queue', show: (a) => a.canApprove },
  { title: 'Service Builder', desc: 'Define new self-service resource types.', icon: Workflow, to: '/builder', show: (a) => a.isOwner },
]

export function HomePage() {
  const { principal, hasRole } = useAuth()
  const canApprove = hasRole('platform-admin') || (principal?.teams.length ?? 0) > 0
  const isOwner = hasRole('service-owner')
  const cards = FEATURES.filter((f) => f.show({ canApprove, isOwner }))

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Internal Developer Platform
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">Platform</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Request resources, review changes, and ship self-service infrastructure — with
          Git-backed catalogs, policy-driven approvals, and live workflow status.
        </p>
        {principal && (
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/requests/new"
              search={{ type: '', action: 'CREATE', resourceId: 0 }}
              className={buttonVariants()}
            >
              <Plus className="h-4 w-4" /> New request
            </Link>
            <Link to="/resources" className={buttonVariants({ variant: 'outline' })}>
              Browse resources
            </Link>
          </div>
        )}
      </div>

      {principal && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ title, desc, icon: Icon, to }) => (
            <Link key={title} to={to} className="group focus:outline-none">
              <Card className="h-full transition-colors group-hover:border-ring group-focus-visible:border-ring">
                <CardHeader>
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="mt-2 group-hover:text-primary">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
