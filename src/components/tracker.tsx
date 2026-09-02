import { db, type ClientGame, type Player } from '#/db'
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
import { useLiveQuery } from 'dexie-react-hooks'
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
}

export default function HintTracker({ sendMessageToSlot }: HintTrackerProps) {
  const MAX_SELECTIONS = 5
  const archipelago = useLiveQuery(() => db.archipelago.get(1))
  const players = useLiveQuery(
    () => db.player.filter((p) => p.logged_in).toArray(),
    [],
    [] as Player[],
  )

  useEffect(() => {
    ;(window as any).players = players
    ;(window as any).archipelago = archipelago
  }, [players, archipelago])

  const receivedItems = players.map((p) => p.received_items).flat()
  const games =
    archipelago?.games?.filter((game) =>
      players.map((p) => p.game).includes(game.name),
    ) ?? ([] as ClientGame[])
  const [selectedValues, setSelectedValues] = useState<AutocompleteOption[]>([])
  const { play } = useSound('notification/completed')

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([]))
  }, [])

  useEffect(() => {
    const filtered = selectedValues.filter((value) => {
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
      Object.entries(game.item_id_to_name).map(([key, value]) => {
        return {
          label: value,
          id: key,
          status: itemNumbers.includes(key)
            ? TrackedItem.Found
            : TrackedItem.Waiting,
          game: game.name,
          slot: players.find((p) => p.game === game.name)?.name ?? 'Unknown',
        }
      }),
    )
    .flat()
  const sendHint = (item: string, slot: string) => {
    sendMessageToSlot(`!hint ${item}`, slot)
  }
  const handleNewSelection = (items: AutocompleteOption[]) => {
    setSelectedValues(items)
    localStorage.setItem(KEY, JSON.stringify(items))
  }

  return (
    <>
      <Autocomplete
        sx={{ margin: '10px' }}
        multiple
        value={selectedValues}
        autoHighlight
        getOptionDisabled={(option) =>
          selectedValues.length >= MAX_SELECTIONS &&
          !selectedValues.includes(option)
        }
        onChange={(_, newValue) => handleNewSelection(newValue)}
        options={items}
        getOptionKey={(option) => option.id}
        renderInput={(params) => <TextField {...params} label="Track" />}
      />
      {selectedValues.length > 0 && (
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
              {selectedValues.map((value) => (
                <TableRow hover key={value.id}>
                  <TableCell>{value.label}</TableCell>
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
