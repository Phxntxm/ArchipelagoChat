import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'

import { db, type Player } from '#/db'
import Paper from '@mui/material/Paper'
import TableContainer from '@mui/material/TableContainer'
import TableSortLabel from '@mui/material/TableSortLabel'
import { useState } from 'react'

interface PlayerProgress {
  cur_locations: number
  total_locations: number
  missing_locations: number
  progress: number
}

function getPlayerProgress(player: Player): PlayerProgress {
  const cur = player.logged_in
    ? player.locations.filter((location) => location.found).length
    : player.cur_locations
  const missing = player.logged_in
    ? player.locations.filter((location) => !location.found).length
    : player.missing_locations
  const total = cur + missing
  const progress = (cur / total) * 100
  return {
    cur_locations: cur,
    missing_locations: missing,
    total_locations: total,
    progress: progress,
  }
}

function Status({ player }: { player: Player }) {
  const { cur_locations, missing_locations } = getPlayerProgress(player)

  if (cur_locations > 0 && missing_locations === 0) {
    return <Typography sx={{ color: 'info.light' }}>Completed</Typography>
  } else if (player.connections > 0) {
    return (
      <Typography sx={{ color: 'success.light' }}>
        Connected ({player.connections})
      </Typography>
    )
  } else {
    return <Typography sx={{ color: 'error.light' }}>Disconnected</Typography>
  }
}

type PlayerTable = Pick<Player, 'id' | 'name' | 'status'> & {
  progress: number
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1
  }
  if (b[orderBy] > a[orderBy]) {
    return 1
  }
  return 0
}

type Order = 'asc' | 'desc'

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (
  a: { [key in Key]: number | string },
  b: { [key in Key]: number | string },
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

export default function PlayerContainer() {
  const [order, setOrder] = useState<Order>('desc')
  const [orderBy, setOrderBy] = useState<keyof PlayerTable>('progress')
  const players = useLiveQuery(() => db.player.toArray())

  const handleRequestSort = (property: keyof PlayerTable) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const rows = useMemo(
    () =>
      [...(players ?? [])]
        .map((player) => {
          return {
            ...player,
            ...getPlayerProgress(player),
          }
        })
        .sort(getComparator(order, orderBy)),
    [order, orderBy, players],
  )

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 440 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell
              key="name"
              sortDirection={orderBy === 'name' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'asc'}
                onClick={() => handleRequestSort('name')}
              >
                Player
              </TableSortLabel>
            </TableCell>
            <TableCell
              key="status"
              sortDirection={orderBy === 'status' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'status'}
                direction={orderBy === 'status' ? order : 'asc'}
                onClick={() => handleRequestSort('status')}
              >
                Connection status
              </TableSortLabel>
            </TableCell>
            <TableCell
              key="progress"
              sortDirection={orderBy === 'progress' ? order : false}
            >
              <TableSortLabel
                active={orderBy === 'progress'}
                direction={orderBy === 'progress' ? order : 'asc'}
                onClick={() => handleRequestSort('progress')}
              >
                Progress
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              hover
              tabIndex={-1}
              key={row.id}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Status player={row} />
              </TableCell>
              <TableCell>
                {row.cur_locations}/{row.total_locations} (
                {row.progress.toFixed(2)}%)
                <LinearProgress variant="determinate" value={row.progress} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
