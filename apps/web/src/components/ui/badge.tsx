import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        success:
          'border-transparent bg-success/12 text-success',
        warning:
          'border-transparent bg-warning/12 text-warning',
        destructive:
          'border-transparent bg-destructive/12 text-destructive',
        accent: 'border-transparent bg-accent text-accent-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

// Map a domain status string to a badge variant + label. Covers request states,
// resource status, and definition status; unknown values fall back to muted.
const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  // request / workflow states
  APPROVED: 'success',
  SUCCEEDED: 'success',
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  PENDING_ONBOARDING: 'warning',
  DRAFT: 'muted',
  REJECTED: 'destructive',
  FAILED: 'destructive',
  ERROR: 'destructive',
  RETIRED: 'destructive',
  // resource status
  active: 'success',
  invalid: 'warning',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'muted'} className={className}>
      {status}
    </Badge>
  )
}
