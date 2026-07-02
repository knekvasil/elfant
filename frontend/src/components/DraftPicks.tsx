import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { Draft } from '../types'

interface Props {
  drafts: Draft[]
}

export default function DraftPicks({ drafts }: Props) {
  return (
    <div className="space-y-4">
      {drafts.map((d) => (
        <Card key={d.draft_id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {d.season} Draft ({d.type})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pick</TableHead>
                  <TableHead className="w-16">Round</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Pos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.picks.map((p) => (
                  <TableRow key={p.pick_no}>
                    <TableCell className="text-muted-foreground">{p.pick_no}</TableCell>
                    <TableCell>{p.round}</TableCell>
                    <TableCell className="font-medium">
                      {p.first_name && p.last_name
                        ? `${p.first_name} ${p.last_name}`
                        : p.player_id || '-'}
                    </TableCell>
                    <TableCell>{p.team || '-'}</TableCell>
                    <TableCell>{p.position || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
