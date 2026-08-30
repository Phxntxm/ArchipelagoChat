import { Dexie, type EntityTable } from 'dexie'
import type { ConnectionStatus, NetworkItem } from './utils'

interface ClientGame {
  name: string
  item_id_to_name: Record<number, string>
  item_id_to_location: Record<number, string>
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

const db = new Dexie('ArchipelagoChat') as Dexie & {
  archipelago: EntityTable<Archipelago, 'id'>
  player: EntityTable<Player, 'id'>
}

db.version(2).stores({
  archipelago: '++id, room_games, games, hint_points',
  player:
    '++id, game, name, logged_in, connections, locations, hint_points, status, received_items, cur_locations, missing_locations',
})

export { db }
export type { Archipelago, ClientGame, Location, Player }
