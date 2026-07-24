import { Boxes, GitPullRequest, ShieldCheck, Workflow } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const FEATURES = [
  { title: 'Resources', desc: 'Browse and inspect the resources you own.', icon: Boxes },
  { title: 'Requests', desc: 'Track change requests and their live state.', icon: GitPullRequest },
  { title: 'Approvals', desc: 'Review and approve pending changes.', icon: ShieldCheck },
  { title: 'Service Builder', desc: 'Define new self-service resource types.', icon: Workflow },
] as const

export function HomePage() {
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, desc, icon: Icon }) => (
          <Card key={title} className="h-full">
            <CardHeader>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <CardTitle className="mt-2">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
