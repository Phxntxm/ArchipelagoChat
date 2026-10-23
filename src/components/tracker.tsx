import type { ClientGame } from '#/data'
import { useDataContext } from '#/data'
import { getHintCost } from '#/utils'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { useSound } from 'react-sounds'

const KEY = 'AP-tracked-items'

enum TrackedItem {
  Waiting,
  Found,
}

interface HintTrackerProps {
  sendMessageToSlot: (arg0: string, arg1: string) => void
}

interface AutocompleteOption {
  id: string
  label: string
  game: string
  slot: string
  status: TrackedItem
  hint_cost: number
  point_total: number
}

export default function HintTracker({ sendMessageToSlot }: HintTrackerProps) {
  const MAX_SELECTIONS = 5
  const { data } = useDataContext()
  const archipelago = data?.archipelago
  const players = data?.players.filter((player) => player.logged_in) ?? []

  useEffect(() => {
    ;(window as any).players = players
    ;(window as any).archipelago = archipelago
  }, [players, archipelago])

  const receivedItems = players.map((p) => p.received_items).flat()
  const games =
    archipelago?.games?.filter((game) =>
      players.map((p) => p.game).includes(game.name),
    ) ?? ([] as ClientGame[])
  const [selectedValues, setSelectedValues] = useState<string[]>([])
  const { play } = useSound('notification/completed')

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([]))
  }, [])

  useEffect(() => {
    const filtered = selectedItems.filter((value) => {
      // If it's been found previously, I don't care
      if (value.status === TrackedItem.Found) {
        return false
      }
      // Otherwise, if it's in the list of received items - it must be newly found
      else if (
        receivedItems.map((item) => item.item.toString()).includes(value.id)
      ) {
        return true
      } else return false
    })
    // If there are any filtered items, play a notification
    if (filtered.length > 0) {
      filtered.forEach((item) => (item.status = TrackedItem.Found))
      play()
    }
  }, [receivedItems])

  if (games.length === 0 || players.length === 0) {
    return 'Loading...'
  }

  const itemNumbers = receivedItems.map((item) => item.item.toString())
  const items = games
    .map((game) =>
      Object.entries(game.item_name_to_id).map(([name, id]) => {
        const itemId = id.toString()
        const player = players.find((p) => p.game === game.name)

        return {
          label: name,
          id: itemId,
          status: itemNumbers.includes(itemId)
            ? TrackedItem.Found
            : TrackedItem.Waiting,
          game: game.name,
          slot: player?.name ?? 'Unknown',
          hint_cost:
            archipelago && player ? getHintCost(archipelago, player) : 10,
          point_total: player?.hint_points ?? 0,
        }
      }),
    )
    .flat()
  const selectedItems = items.filter((item) => selectedValues.includes(item.id))
  const sendHint = (item: string, slot: string) => {
    sendMessageToSlot(`!hint ${item}`, slot)
  }
  const handleNewSelection = (items: AutocompleteOption[]) => {
    setSelectedValues(items.map((item) => item.id))
    localStorage.setItem(KEY, JSON.stringify(items))
  }

  return (
    <>
      <Autocomplete
        sx={{ margin: '10px' }}
        multiple
        value={selectedItems}
        autoHighlight
        getOptionDisabled={(option) =>
          selectedItems.length >= MAX_SELECTIONS &&
          !selectedItems.includes(option)
        }
        onChange={(_, newValue) => handleNewSelection(newValue)}
        options={items}
        getOptionKey={(option) => option.id}
        renderInput={(params) => <TextField {...params} label={`Track`} />}
      />
      {selectedItems.length > 0 && (
        <TableContainer component={Paper} sx={{ maxHeight: 440 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Game</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Hint?</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedItems.map((value) => (
                <TableRow hover key={value.id}>
                  <TableCell>
                    {value.label} ({value.point_total}/{value.hint_cost})
                  </TableCell>
                  <TableCell>{value.game}</TableCell>
                  <TableCell>
                    {value.status == TrackedItem.Found ? (
                      <Typography sx={{ color: 'success.light' }}>
                        Found
                      </Typography>
                    ) : (
                      <Typography sx={{ color: 'error.light' }}>
                        Waiting
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      onClick={() => sendHint(value.label, value.slot)}
                    >
                      Hint
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}
