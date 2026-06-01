import { Badge } from '@/components/ui/badge'

interface Props {
  sourceType: 'transcript' | 'metadata'
}

export function SourceBadge({ sourceType }: Props) {
  if (sourceType === 'transcript') {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200"
      >
        자막 기반
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200"
    >
      자막 없음 — 제한적 요약
    </Badge>
  )
}
