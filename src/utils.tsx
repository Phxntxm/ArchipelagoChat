import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Fragment, type ReactElement } from 'react'
import { db, type Archipelago, type Location, type Player } from './db'

enum ConnectionStatus {
  Connected,
  Disconnected,
  Completed,
}

interface Version {
  major: number
  minor: number
  build: number
  class: 'Version'
}

interface Permissions {
  release: number
  remaining: number
  collect: number
}

enum SlotType {
  spectator = 0,
  player = 1,
  group = 2,
}

interface NetworkPlayer {
  team: number
  slot: number
  alias: string
  name: string
  class: 'NetworkPlayer'
}

interface NetworkSlot {
  name: string
  game: string
  type: SlotType
  group_members: number[]
}

interface NetworkItem {
  item: number
  location: number
  player: number
  flags: number
  class: 'NetworkItem'
}

interface RoomInfoCmd {
  cmd: 'RoomInfo'
  password: boolean
  games: string[]
  tags: string[]
  version: Version
  generator_version: Version
  permissions: Permissions
  hint_cost: number
  location_check_points: number
  datapackage_checksums: Record<string, string>
  seed_name: string
  time: number
}

interface ConnectedCmd {
  cmd: 'Connected'
  team: number
  slot: number
  players: NetworkPlayer[]
  missing_locations: number[]
  checked_locations: number[]
  slot_info: Record<number, NetworkSlot>
  hint_points: number
  slot_data: object | null
}

interface DataPackageGame {
  item_name_to_id: Record<string, number>
  location_name_to_id: Record<string, number>
  checksum: string
}

interface DataPackageGames {
  games: Record<string, DataPackageGame>
}

interface DataPackageCmd {
  cmd: 'DataPackage'
  data: DataPackageGames
}

interface PrintData {
  text: string
  type?: string
  flags?: number
  player?: number
}

interface PrintJSON {
  data: PrintData[]
  type?: string
  cmd: 'PrintJSON'
}

interface ItemSend extends PrintJSON {
  item: NetworkItem
  receiving: number
  type: 'ItemSend'
}
interface Chat extends PrintJSON {
  message: string
  slot: number
  team: number
  type: 'Chat'
}

interface TagsChanged extends PrintJSON {
  tags: string[]
  slot: number
  team: number
  type: 'TagsChanged'
}

interface CommandResult extends PrintJSON {
  type: 'CommandResult'
}

interface Tutorial extends PrintJSON {
  type: 'Tutorial'
}

interface Disconnect extends PrintJSON {
  team: number
  slot: number
  type: 'Part'
}

interface Join extends PrintJSON {
  team: number
  slot: number
  tags: string[]
  type: 'Join'
}

interface Hint extends PrintJSON {
  found: boolean
  item: NetworkItem
  receiving: number
  type: 'Hint'
}

interface LoginDetails {
  url: string
  port: number
  slot: string
  password: string | null
}

interface LoggedInDetails {
  url: string
  port: number
  slot: string
  password: string | null
}

interface ReceivedItems {
  index: number
  items: NetworkItem[]
  cmd: 'ReceivedItems'
}

interface RoomUpdateCmd {
  cmd: 'RoomUpdate'
  hint_points?: number
  players?: NetworkPlayer[]
  checked_locations?: number[]
  permissions?: Permissions
  hint_cost?: number
  location_check_points?: number
}

interface ConnectionRefused {
  cmd: 'ConnectionRefused'
  errors: string[]
}

type Commands =
  | RoomInfoCmd
  | ConnectedCmd
  | DataPackageCmd
  | PrintJSON
  | ReceivedItems
  | RoomUpdateCmd
  | ConnectionRefused

interface CommandHandler<T extends Commands> {
  cmd: T
  slot: string
  password: string | null
  sendMessage: (arg0: string) => void
  sendCommand: (arg0: string) => void
  addChat: (arg0: string, arg1?: ReactElement) => void
  addStatus: (arg0: string, arg1?: ReactElement) => void
}

function isItemSend(cmd: PrintJSON): cmd is ItemSend {
  return cmd.type === 'ItemSend'
}

function isHint(cmd: PrintJSON): cmd is Hint {
  return cmd.type === 'Hint'
}

function isDisconnect(cmd: PrintJSON): cmd is Disconnect {
  return cmd.type === 'Part'
}

function isJoin(cmd: PrintJSON): cmd is Join {
  return cmd.type === 'Join'
}

function isTagsChanged(cmd: PrintJSON): cmd is TagsChanged {
  return cmd.type === 'TagsChanged'
}

function isChat(cmd: PrintJSON): cmd is Chat {
  return cmd.type === 'Chat'
}

function isCommandResult(cmd: PrintJSON): cmd is CommandResult {
  return cmd.type === 'CommandResult'
}

function isTutorial(cmd: PrintJSON): cmd is Tutorial {
  return cmd.type === 'Tutorial'
}

function isLoggedIn(settings: LoginDetails): settings is LoggedInDetails {
  return (
    settings.url !== null && settings.port !== null && settings.slot !== null
  )
}

function isCommand(cmd: string) {
  const possibleCommands = [
    '!help',
    '!license',
    '!options',
    '!admin',
    '!players',
    '!status',
    '!release',
    '!collect',
    '!countdown seconds',
    '!remaining',
    '!missing',
    '!checked',
    '!alias',
    '!getitem',
    '!hint',
    '!hint_location',
  ]

  const startsWithCommand = possibleCommands.filter((command) =>
    cmd.startsWith(command),
  )

  return startsWithCommand.length > 0
}

function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

type ReverseRecord<T extends Record<PropertyKey, PropertyKey>> = {
  [K in keyof T as T[K]]: K
}

function reverseRecord<T extends Record<PropertyKey, PropertyKey>>(
  obj: T,
): ReverseRecord<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [value, key]),
  ) as ReverseRecord<T>
}

async function getLocationsForGame(gameName: string): Promise<Location[]> {
  const archipelago = await db.archipelago.get(1)
  const game = archipelago?.games?.find((game) => game.name === gameName)

  if (game) {
    const locations = Object.entries(game.item_id_to_location).map(
      ([key, value]) => {
        return {
          name: value,
          found: false,
          id: parseInt(key),
        }
      },
    )

    return locations
  }

  return []
}

function socketIdentifier(
  url: string,
  port: number | string,
  slot: string,
  password: string | null,
) {
  return `ws://${url}:${port}@${slot}:${password ?? ''}`
}

function itemColoured(item: string, flag: number) {
  switch (flag) {
    case 1:
      return (
        <Tooltip describeChild placement="top" title="Progression">
          <Typography sx={{ color: '#cc34e5' }} component={'span'}>
            {item}
          </Typography>
        </Tooltip>
      )
    case 2:
      return (
        <Tooltip describeChild placement="top" title="Useful">
          <Typography sx={{ color: '#1730f9' }} component={'span'}>
            {item}
          </Typography>
        </Tooltip>
      )
    case 3:
      return (
        <Tooltip describeChild placement="top" title="Progression & Useful">
          <Typography
            sx={{
              background: 'linear-gradient(45deg, #cc34e5 30%, #1730f9 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
            component={'span'}
          >
            {item}
          </Typography>
        </Tooltip>
      )
    case 4:
      return (
        <Tooltip describeChild placement="top" title="Trap">
          <Typography sx={{ color: '#b22424' }} component={'span'}>
            {item}
          </Typography>
        </Tooltip>
      )
    default:
      return (
        <Tooltip describeChild placement="top" title="Junk">
          <Typography sx={{ color: '#297e03' }} component={'span'}>
            {item}
          </Typography>
        </Tooltip>
      )
  }
}

interface ChatMessage {
  message: string
  element?: ReactElement
}

async function getPlayer(id: number): Promise<Player> {
  const player = await db.player.get(id)
  assert(player !== undefined)
  return player
}

async function typographyItemInfo(
  cmd: PrintJSON,
  archipelago: Archipelago,
): Promise<ChatMessage> {
  let player: Player

  const textParts = await Promise.all(
    cmd.data.map(async (part) => {
      switch (part.type) {
        case 'player_id':
          player = await getPlayer(parseInt(part.text))
          return {
            message: player.name,
            element: (
              <Tooltip describeChild title={player.game} placement="top">
                <strong>{player.name}</strong>
              </Tooltip>
            ),
          }
        case 'item_id':
          player = await getPlayer(part.player ?? -1)
          const itemName = archipelago.games?.find(
            (game) => game.name === player.game,
          )?.item_id_to_name[parseInt(part.text)]
          return {
            message: itemName,
            element: itemColoured(itemName ?? 'Unknown', part.flags ?? 1),
          }
        case 'location_id':
          player = await getPlayer(part.player ?? -1)
          const locationName = archipelago.games?.find(
            (game) => game.name === player.game,
          )?.item_id_to_location[parseInt(part.text)]
          return {
            message: locationName,
            element: (
              <Typography sx={{ color: '#770e76' }} component={'span'}>
                {locationName}
              </Typography>
            ),
          }
        case 'hint_status':
          switch (part.text) {
            case '(found)':
              return {
                message: part.text,
                element: (
                  <Typography sx={{ color: '#1730f9' }} component={'span'}>
                    {part.text}
                  </Typography>
                ),
              }
            case '(priority)':
              return {
                message: part.text,
                element: (
                  <Typography sx={{ color: '#cc34e5' }} component={'span'}>
                    {part.text}
                  </Typography>
                ),
              }
            default:
              return {
                message: part.text,
                element: (
                  <Typography sx={{ color: '#297e03' }} component={'span'}>
                    {part.text}
                  </Typography>
                ),
              }
          }
          return { message: part.text, element: part.text }
        default:
          return { message: part.text, element: part.text }
      }
    }),
  )

  return {
    message: textParts
      .map((part) => part.message)
      .filter((message) => message !== undefined && message?.length > 0)
      .join(''),
    element: (
      <span>
        {textParts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && ''}
            {part.element}
          </Fragment>
        ))}
      </span>
    ),
  }
}

export {
  assert,
  ConnectionStatus,
  getLocationsForGame,
  isChat,
  isCommand,
  isCommandResult,
  isDisconnect,
  isHint,
  isItemSend,
  isJoin,
  isLoggedIn,
  isTagsChanged,
  isTutorial,
  reverseRecord,
  socketIdentifier,
  typographyItemInfo,
}
export type {
  Chat,
  ChatMessage,
  CommandHandler,
  CommandResult,
  Commands,
  ConnectedCmd,
  ConnectionRefused,
  DataPackageCmd,
  Disconnect,
  Hint,
  ItemSend,
  Join,
  LoggedInDetails,
  LoginDetails,
  NetworkItem,
  PrintJSON,
  ReceivedItems,
  RoomInfoCmd,
  RoomUpdateCmd,
  Tutorial,
}
