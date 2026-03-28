'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface IntegrationCardProps {
  name: string
  description: string
  icon: React.ElementType
  status: 'connected' | 'disconnected'
  onConfigure: () => void
  configuring?: boolean
}

export function IntegrationCard({
  name,
  description,
  icon: Icon,
  status,
  onConfigure,
  configuring,
}: IntegrationCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <CardDescription className="mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {status === 'connected' ? '接続済' : '未接続'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={onConfigure}
          disabled={configuring}
        >
          {configuring ? '処理中...' : '設定'}
        </Button>
      </CardContent>
    </Card>
  )
}
