import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ConnectionStatus, NetworkItem } from './utils'

interface ClientGame {
  name: string
  item_name_to_id: Record<string, number>
  location_name_to_id: Record<string, number>
}

interface Archipelago {
  id: number
  room_games: string[]
  datapackage_checksums: Record<string, string>
  games?: ClientGame[]
  hint_cost?: number
}

interface Location {
  id: number
  name: string
  found: boolean
}

interface Player {
  id: number
  game: string
  name: string
  logged_in: boolean
  connections: number
  locations: Location[]
  hint_points: number
  status: ConnectionStatus
  received_items: NetworkItem[]
  cur_locations: number
  missing_locations: number
}

interface Data {
  archipelago: Archipelago
  players: Player[]
}

interface DataContextProps {
  data: Data | undefined
  getData: () => Data | undefined
  resetData: () => void
  setArchipelagoData: (arg0: Archipelago) => void
  updateArchipelagoData: (update: (current: Archipelago) => Archipelago) => void
  getPlayer: (arg0: number) => Player | undefined
  updatePlayers: (update: (current: Player[]) => Player[]) => void
}

const DataContext = createContext<DataContextProps | undefined>(undefined)

export const useDataContext = () => {
  const context = useContext(DataContext)

  if (context === undefined) {
    throw new Error('useDataContext must be used with in a DataProvider')
  }

  return context
}

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<Data | undefined>(undefined)
  const dataRef = useRef(data)

  const updateData = useCallback(
    (update: (current: Data | undefined) => Data) => {
      const nextData = update(dataRef.current)
      dataRef.current = nextData
      setData(nextData)
    },
    [setData],
  )

  const setArchipelagoData = useCallback(
    (archi: Archipelago) => {
      updateData((current) =>
        current === undefined
          ? { archipelago: archi, players: [] }
          : { ...current, archipelago: archi },
      )
    },
    [updateData],
  )

  const updateArchipelagoData = useCallback(
    (update: (current: Archipelago) => Archipelago) => {
      updateData((current) => {
        if (current === undefined) {
          throw new Error('Should not update game data before room info')
        }

        return { ...current, archipelago: update(current.archipelago) }
      })
    },
    [updateData],
  )

  const updatePlayers = useCallback(
    (update: (current: Player[]) => Player[]) => {
      updateData((current) => {
        if (current === undefined) {
          throw new Error('Should not be receiving players before game data')
        }

        return { ...current, players: update(current.players) }
      })
    },
    [updateData],
  )

  const getData = useCallback(() => dataRef.current, [])
  const resetData = useCallback(() => {
    dataRef.current = undefined
    setData(undefined)
  }, [setData])
  const getPlayer = useCallback(
    (id: number) => dataRef.current?.players.find((player) => player.id === id),
    [],
  )

  return (
    <DataContext
      value={{
        data,
        getData,
        resetData,
        setArchipelagoData,
        updateArchipelagoData,
        getPlayer,
        updatePlayers,
      }}
    >
      {children}
    </DataContext>
  )
}

export default DataContext

export type {
  Archipelago,
  ClientGame,
  Data,
  DataContextProps,
  Location,
  Player,
}
