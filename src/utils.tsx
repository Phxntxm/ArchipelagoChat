import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ReactElement } from 'react'
import { db, type Archipelago } from './db'

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

function socketIdentifier(
  url: string,
  port: number | string,
  slot: string,
  password: string | null,
) {
  return `ws://${url}:${port}@${slot}:${password ?? ''}`
}

function checksConsolidator(curChecks: number, totalChecks: number) {
  return {
    cur_checks: curChecks,
    total_checks: totalChecks,
    progress: (curChecks / totalChecks) * 100,
  }
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

async function itemSendTypography(
  cmd: ItemSend,
  archipelago: Archipelago,
): Promise<ChatMessage> {
  switch (cmd.data.length) {
    // Found their own item
    case 6:
      const player = await db.player.get(cmd.receiving)

      if (player === undefined)
        throw new Error('Could not find players in game')
      const itemName = archipelago.games?.find(
        (game) => game.name === player.game,
      )?.item_id_to_name[cmd.item.item]
      const locationName = archipelago.games?.find(
        (game) => game.name === player.game,
      )?.item_id_to_location[cmd.item.location]
      return {
        element: (
          <span>
            <Tooltip describeChild title={player.game} placement="top">
              <strong>{player.name}</strong>
            </Tooltip>{' '}
            has found their{' '}
            {itemColoured(itemName ?? 'Unknown', cmd.item.flags)} (
            <Typography sx={{ color: '#770e76' }} component={'span'}>
              {locationName}
            </Typography>
            )
          </span>
        ),
        message: `${player.name} has found their ${itemName} (${locationName})`,
      }
    // Found another person's item
    case 8:
      const receiver = await db.player.get(cmd.receiving)
      const finder = await db.player.get(parseInt(cmd.data[0].text))
      if (receiver === undefined || finder === undefined)
        throw new Error('Could not find players in game')
      const foundItemName = archipelago.games?.find(
        (game) => game.name === receiver.game,
      )?.item_id_to_name[cmd.item.item]
      const foundLocationName = archipelago.games?.find(
        (game) => game.name === finder.game,
      )?.item_id_to_location[cmd.item.location]

      return {
        element: (
          <span>
            <Tooltip describeChild title={finder.game} placement="top">
              <strong>{finder.name}</strong>
            </Tooltip>{' '}
            sent {itemColoured(foundItemName ?? 'Unknown', cmd.item.flags)} (
            <Typography sx={{ color: '#770e76' }} component={'span'}>
              {foundLocationName}
            </Typography>
            ) to{' '}
            <Tooltip describeChild title={receiver.game} placement="top">
              <strong>{receiver.name}</strong>
            </Tooltip>{' '}
          </span>
        ),
        message: `${finder.name} sent ${foundItemName} (${foundLocationName}) to ${receiver.name}`,
      }
    default:
      throw new Error('Could not determine print JSON type')
  }
}

export {
  assert,
  checksConsolidator,
  ConnectionStatus,
  isChat,
  isCommand,
  isCommandResult,
  isDisconnect,
  isItemSend,
  isJoin,
  isLoggedIn,
  isTagsChanged,
  isTutorial,
  itemSendTypography,
  reverseRecord,
  socketIdentifier,
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
