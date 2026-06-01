import { Badge } from '@/components/ui/badge'

interface Props {
  topics: string[]
  max?: number
}

export function TopicChips({ topics, max }: Props) {
  if (!topics || topics.length === 0) return null

  const shown = typeof max === 'number' ? topics.slice(0, max) : topics
  const hidden = topics.length - shown.length

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <Badge key={t} variant="outline" className="font-normal">
          {t}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{hidden}
        </Badge>
      )}
    </div>
  )
}
