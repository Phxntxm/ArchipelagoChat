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

interface Player {
  id: number
  game: string
  name: string
  logged_in: boolean
  connections: number
  missing_locations: number[]
  checked_locations: number[]
  hint_points: number
  cur_checks: number
  progress: number
  total_checks: number
  status: ConnectionStatus
  received_items: NetworkItem[]
}

const db = new Dexie('ArchipelagoChat') as Dexie & {
  archipelago: EntityTable<Archipelago, 'id'>
  player: EntityTable<Player, 'id'>
}

db.version(2).stores({
  archipelago: '++id, room_games, games, hint_points',
  player:
    '++id, game, name, logged_in, connections, missing_locations, checked_locations, hint_points, cur_checks, total_checks, received_items',
})

export { db }
export type { Archipelago, ClientGame, Player }
