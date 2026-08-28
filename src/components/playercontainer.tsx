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
import { ConnectionStatus } from '#/utils'
import Paper from '@mui/material/Paper'
import TableContainer from '@mui/material/TableContainer'
import TableSortLabel from '@mui/material/TableSortLabel'
import { useState } from 'react'

function Status({ player }: { player: Player }) {
  if (player.cur_checks > 0 && player.cur_checks === player.total_checks) {
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

interface PlayerTable {
  id: number
  name: string
  status: ConnectionStatus
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
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof PlayerTable>('progress')
  const players = useLiveQuery(() => db.player.toArray())

  const handleRequestSort = (property: keyof PlayerTable) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const rows = useMemo(
    () => [...(players ?? [])].sort(getComparator(order, orderBy)),
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
          {rows.map((player) => (
            <TableRow
              hover
              tabIndex={-1}
              key={player.id}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{player.name}</TableCell>
              <TableCell>
                <Status player={player} />
              </TableCell>
              <TableCell>
                {player.cur_checks}/{player.total_checks} ({player.progress.toFixed(2)}%)
                <LinearProgress
                  variant="determinate"
                  value={(player.cur_checks / player.total_checks) * 100}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
