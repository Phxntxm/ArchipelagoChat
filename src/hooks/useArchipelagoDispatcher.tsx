import { db, type ClientGame } from '#/db'
import {
  assert,
  checksConsolidator,
  ConnectionStatus,
  isChat,
  isCommand,
  isCommandResult,
  isDisconnect,
  isItemSend,
  isJoin,
  isTagsChanged,
  isTutorial,
  itemSendTypography,
  reverseRecord,
  type Chat,
  type CommandHandler,
  type CommandResult,
  type Commands,
  type ConnectedCmd,
  type ConnectionRefused,
  type DataPackageCmd,
  type Disconnect,
  type ItemSend,
  type Join,
  type NetworkItem,
  type PrintJSON,
  type ReceivedItems,
  type RoomInfoCmd,
  type RoomUpdateCmd,
} from '#/utils'
import Tooltip from '@mui/material/Tooltip'
import _ from 'lodash'
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { v4 } from 'uuid'
/* 
This file contains the hook that will be used ONLY ONCE
it uses the cmd Queue (and just uses the set for it, to remove the one it just handled)
which will receive all the commands from all websockets. This is the hook responsible
for deduping commands if we have multiple socket connections
*/

const ID = 1
const DUPLICATE_WINDOW_MS = 5_000
const ALWAYS_ACCEPTED_COMMANDS = new Set([
  'RoomInfo',
  'DataPackage',
  'Connected',
])
interface ArchipelagoDispatcherProps {
  cmdQueue: CommandHandler<Commands>[]
  setCmdQueue: Dispatch<SetStateAction<CommandHandler<Commands>[]>>
  handleConnectionError: (arg0: string) => void
}

// Standalone commands
async function handleRoomInfo(handler: CommandHandler<RoomInfoCmd>) {
  let existingInfo = await db.archipelago.get(ID)

  if (existingInfo === undefined) {
    await db.archipelago.add({
      room_games: handler.cmd.games,
      id: ID,
      datapackage_checksums: handler.cmd.datapackage_checksums,
    })
    existingInfo = await db.archipelago.get(ID)
  } else if (
    !_.isEqual(
      existingInfo.datapackage_checksums,
      handler.cmd.datapackage_checksums,
    )
  ) {
    await db.archipelago.delete(ID)
    await db.archipelago.add({
      room_games: handler.cmd.games,
      id: ID,
      datapackage_checksums: handler.cmd.datapackage_checksums,
    })
    existingInfo = await db.archipelago.get(ID)
  }

  assert(existingInfo !== undefined)
  // Now that got our room info we can get our data package
  handler.sendCommand(
    JSON.stringify([{ cmd: 'GetDataPackage', games: existingInfo.room_games }]),
  )
}

async function handleDataPackage(handler: CommandHandler<DataPackageCmd>) {
  const games = Object.entries(handler.cmd.data.games).reduce(
    (acc, [key, value]) => {
      acc.push({
        name: key,
        item_id_to_name: reverseRecord(value.item_name_to_id),
        item_id_to_location: reverseRecord(value.location_name_to_id),
      })
      return acc
    },
    [] as ClientGame[],
  )
  await db.archipelago.update(ID, {
    games: games,
  })

  // Now that our game info is retrieved we can connect
  handler.sendCommand(
    JSON.stringify([
      {
        cmd: 'Connect',
        uuid: v4(),
        name: handler.slot,
        game: '',
        password: handler.password,
        tags: ['TextOnly', 'Tracker'],
        items_handling: 7,
        version: {
          major: 0,
          minor: 6,
          build: 7,
          class: 'Version',
        },
      },
    ]),
  )
}

async function handleConnected(
  handler: CommandHandler<ConnectedCmd>,
  setSuppressNextStatusResult: (arg0: boolean) => void,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
) {
  Object.entries(handler.cmd.slot_info).forEach(async ([slotId, slot]) => {
    // First check if they exist - since we connect with multiple accounts
    const existingPlayer = await db.player.get(parseInt(slotId))

    // If they don't exist but are not the one we're connecting with, just add default info
    if (existingPlayer === undefined) {
      if (slotId !== handler.cmd.slot.toString()) {
        await db.player.add({
          id: parseInt(slotId),
          game: slot.game,
          name: slot.name,
          logged_in: false,
          connections: 0,
          status: ConnectionStatus.Disconnected,
          missing_locations: [],
          checked_locations: [],
          received_items: [],
          hint_points: 0,
          cur_checks: 0,
          total_checks: 0,
          progress: 100,
        })
      }
      // If they don't exist and match the one we're logging in with - fill in with command's info
      else {
        await db.player.add({
          id: parseInt(slotId),
          game: slot.game,
          name: slot.name,
          logged_in: true,
          connections: 1,
          status: ConnectionStatus.Connected,
          missing_locations: handler.cmd.missing_locations,
          checked_locations: handler.cmd.checked_locations,
          received_items: [],
          hint_points: handler.cmd.hint_points,
          ...checksConsolidator(
            handler.cmd.checked_locations.length,
            handler.cmd.checked_locations.length +
              handler.cmd.missing_locations.length,
          ),
        })
      }
    }
    // If they do exist... AND ONLY IF IT MATCHES THE CONNECTION, update with the command's info
    else if (slotId !== handler.cmd.slot.toString()) {
      await db.player.update(handler.cmd.slot, {
        logged_in: true,
        missing_locations: handler.cmd.missing_locations,
        checked_locations: handler.cmd.checked_locations,
        hint_points: handler.cmd.hint_points,
        ...checksConsolidator(
          handler.cmd.checked_locations.length,
          handler.cmd.checked_locations.length +
            handler.cmd.missing_locations.length,
        ),
      })
    }
  })

  setSuppressNextStatusCommand(true)
  setSuppressNextStatusResult(true)
  handler.sendMessage('!status')
}

async function handleReceivedItems(cmd: ReceivedItems) {
  const items = Object.groupBy(cmd.items, (item) => item.player) as Record<
    string,
    NetworkItem[]
  >

  Object.entries(items).forEach(async ([id, player_items]) => {
    const player = await db.player.get(parseInt(id))

    if (player !== undefined) {
      const combined_items = [
        ...new Set([...player.received_items, ...player_items]),
      ]
      const newLocationsChecked = combined_items
        .map((item) => item.location)
        .filter((location) => player.missing_locations.includes(location))
      const allLocationsChecked = [
        ...player.checked_locations,
        ...newLocationsChecked,
      ]
      const missingLocations = player.missing_locations.filter(
        (location) => !newLocationsChecked.includes(location),
      )
      await db.player.update(player.id, {
        missing_locations: missingLocations,
        checked_locations: allLocationsChecked,
        ...checksConsolidator(
          allLocationsChecked.length,
          allLocationsChecked.length + missingLocations.length,
        ),
      })
    }
  })
}

async function handleRoomUpdate(handler: CommandHandler<RoomUpdateCmd>) {
  // Handle global changes
  if (handler.cmd.hint_cost !== undefined) {
    await db.archipelago.update(ID, { hint_cost: handler.cmd.hint_cost })
  }

  // Handle player changes
  if (handler.cmd.hint_points !== undefined) {
    const player = await db.player.get({ name: handler.slot })

    if (player !== undefined) {
      await db.player.update(player.id, {
        hint_points: handler.cmd.hint_points,
      })
    }
  }
}

async function handlePrintJSON(
  handler: CommandHandler<PrintJSON>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
  suppressNextStatusCommand: boolean,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
) {
  const message = handler.cmd.data.map((piece) => piece.text).join('')

  if (isItemSend(handler.cmd)) {
    handleItemSend(handler as CommandHandler<ItemSend>)
  } else if (isJoin(handler.cmd)) {
    handleJoin(handler as CommandHandler<Join>)
  }
  // Don't care about this message
  else if (isTagsChanged(handler.cmd)) {
  } else if (isTutorial(handler.cmd)) {
    handler.addStatus(message)
  } else if (isDisconnect(handler.cmd)) {
    handleDisconnect(handler as CommandHandler<Disconnect>)
  } else if (isCommandResult(handler.cmd)) {
    handleCommandResult(
      message,
      handler as CommandHandler<CommandResult>,
      suppressNextStatusResult,
      setSuppressNextStatusResult,
    )
  } else if (isChat(handler.cmd)) {
    handleChat(
      handler as CommandHandler<Chat>,
      suppressNextStatusCommand,
      setSuppressNextStatusCommand,
    )
  } else {
    handler.addChat(message)
  }
}

async function handleConnectionRefused(
  cmd: ConnectionRefused,
  handleConnectionRefused: (arg0: string) => void,
) {
  if (cmd.errors.includes('InvalidSlot')) {
    handleConnectionRefused('Could not connect: Invalid Slot')
  } else if (cmd.errors.includes('InvalidPassword')) {
    handleConnectionRefused('Could not connect: Invalid Password')
  } else {
    handleConnectionRefused(`Unknown error. Contact Phantom. ${cmd.errors}`)
  }
}

// PrintJSON commands
async function handleItemSend(handler: CommandHandler<ItemSend>) {
  const archipelago = await db.archipelago.get(ID)
  assert(archipelago !== undefined)
  const message = await itemSendTypography(handler.cmd, archipelago)
  handler.addStatus(message.message, message.element)
  const location = handler.cmd.data.find((part) => part.type === 'location_id')
  const player = await db.player.get({ name: location?.player })

  if (player && !player.logged_in) {
    await db.player.update(player.id, {
      cur_checks: player.cur_checks + 1,
      progress: ((player.cur_checks + 1) / player.total_checks) * 100,
    })
  }
}

async function handleJoin(handler: CommandHandler<Join>) {
  const player = await db.player.get(handler.cmd.slot)

  if (player) {
    await db.player.update(player.id, { connections: player.connections + 1 })

    handler.addStatus(
      `${player.name} has joined! (Team ${handler.cmd.team})`,
      <span>
        <Tooltip describeChild title={player.game} placement="top">
          <strong>{player.name}</strong>
        </Tooltip>{' '}
        has joined! (Team {handler.cmd.team})
      </span>,
    )
  }
}

async function handleDisconnect(handler: CommandHandler<Disconnect>) {
  const player = await db.player.get(handler.cmd.slot)

  if (player) {
    await db.player.update(player.id, { connections: player.connections - 1 })
    handler.addStatus(
      `${player.name} has disconnected.`,
      <span>
        <Tooltip describeChild title={player.game} placement="top">
          <strong>{player.name}</strong>
        </Tooltip>{' '}
        has disconnected.
      </span>,
    )
  }
}

async function handleStatusResult(
  message: string,
  handler: CommandHandler<CommandResult>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
) {
  if (!suppressNextStatusResult) {
    handler.addStatus(message)
  } else {
    setSuppressNextStatusResult(false)
  }

  message.split('\n').forEach(async (line) => {
    const lineMsg = /^(.+) has (\d+) connections?\. \((\d+)\/(\d+)\)$/
    const lineMatch = line.match(lineMsg)

    if (lineMatch) {
      let slot = lineMatch[1]
      const connCount = parseInt(lineMatch[2])
      const curChecks = parseInt(lineMatch[3])
      const totalChecks = parseInt(lineMatch[4])
      let player = undefined

      // They're aliased - annoyingly there's no distinction in this command
      // that you can use other than guessing. If they've got a short name and slot,
      // and using parenthesis in their name (which is allowed)? We're fucked I guess
      if (slot.length > 16 && slot.includes('(') && slot.includes(')')) {
        const slotAliasMatch = slot.match(/\(([^\)]*)\)/)
        if (slotAliasMatch) {
          slot = slotAliasMatch[1]
          player = await db.player.get({ name: slot })
          // If we couldn't find them, default back to the original match
          if (player === undefined) {
            slot = lineMatch[1]
            player = await db.player.get({ name: slot })
          }
        }
      } else {
        player = await db.player.get({ name: slot })
      }

      if (player) {
        await db.player.update(player.id, {
          status:
            curChecks === totalChecks
              ? ConnectionStatus.Completed
              : connCount > 0
                ? ConnectionStatus.Connected
                : ConnectionStatus.Disconnected,
          connections: connCount,
          ...checksConsolidator(curChecks, totalChecks),
        })
      }
    }
  })
}

async function handleCommandResult(
  message: string,
  handler: CommandHandler<CommandResult>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
) {
  const statusMsg = /^Player Status on team \d+:/

  const statusMatch = message.match(statusMsg)

  if (statusMatch) {
    await handleStatusResult(
      message,
      handler,
      suppressNextStatusResult,
      setSuppressNextStatusResult,
    )
  } else {
    handler.addStatus(message)
  }
}

async function handleChat(
  handler: CommandHandler<Chat>,
  suppressNextStatusCommand: boolean,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
) {
  const player = await db.player.get(handler.cmd.slot)

  if (player) {
    const msgToSend = (
      <span>
        <Tooltip describeChild title={player.game} placement="top">
          <strong>{player.name}</strong>
        </Tooltip>{' '}
        : {handler.cmd.message}
      </span>
    )

    if (isCommand(handler.cmd.message)) {
      if (
        suppressNextStatusCommand &&
        handler.cmd.message.startsWith('!status')
      ) {
        setSuppressNextStatusCommand(false)
      } else {
        handler.addStatus(`${player.name}: ${handler.cmd.message}`, msgToSend)
      }
    } else {
      handler.addChat(`${player.name}: ${handler.cmd.message}`, msgToSend)
    }
  }
}

async function dispatcher(
  handler: CommandHandler<Commands>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
  suppressNextStatusCommand: boolean,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
  handleConnectionError: (arg0: string) => void,
) {
  console.log(handler.cmd)
  switch (handler.cmd.cmd) {
    case 'RoomInfo':
      await handleRoomInfo(handler as CommandHandler<RoomInfoCmd>)
      break
    case 'DataPackage':
      await handleDataPackage(handler as CommandHandler<DataPackageCmd>)
      break
    case 'Connected':
      await handleConnected(
        handler as CommandHandler<ConnectedCmd>,
        setSuppressNextStatusResult,
        setSuppressNextStatusCommand,
      )
      break
    case 'ConnectionRefused':
      await handleConnectionRefused(handler.cmd, handleConnectionError)
      break
    case 'ReceivedItems':
      await handleReceivedItems(handler.cmd as ReceivedItems)
      break
    case 'RoomUpdate':
      await handleRoomUpdate(handler as CommandHandler<RoomUpdateCmd>)
      break
    case 'PrintJSON':
      await handlePrintJSON(
        handler as CommandHandler<PrintJSON>,
        suppressNextStatusResult,
        setSuppressNextStatusResult,
        suppressNextStatusCommand,
        setSuppressNextStatusCommand,
      )
      break
    default:
      console.log(handler.cmd)
  }
}

export default function useArchipelagoDispatcher(
  props: ArchipelagoDispatcherProps,
) {
  const [processingCommand, setProcessingCommand] = useState<boolean>(false)
  const receivedCommands = useRef(new Map<string, number>())
  // To get more info we need to run status in the beginning, but we don't care about the chat message
  //  so just suppress it
  const [suppressNextStatusResult, setSuppressNextStatusResult] =
    useState<boolean>(false)
  const [suppressNextStatusCommand, setSuppressNextStatusCommand] =
    useState<boolean>(false)

  useEffect(() => {
    // If we don't have any commands, obviously nothing to process
    if (props.cmdQueue.length === 0) return
    // We only want to process one command at a time
    if (processingCommand) return

    const now = Date.now()
    for (const [serializedCommand, receivedAt] of receivedCommands.current) {
      if (now - receivedAt >= DUPLICATE_WINDOW_MS) {
        receivedCommands.current.delete(serializedCommand)
      }
    }

    const command = props.cmdQueue[0]
    const shouldDeduplicate = !ALWAYS_ACCEPTED_COMMANDS.has(command.cmd.cmd)

    if (shouldDeduplicate) {
      const serializedCommand = JSON.stringify(command.cmd)
      const receivedAt = receivedCommands.current.get(serializedCommand)

      if (receivedAt !== undefined && now - receivedAt < DUPLICATE_WINDOW_MS) {
        receivedCommands.current.set(serializedCommand, now)
        props.setCmdQueue((prev) => prev.slice(1))
        return
      }

      receivedCommands.current.set(serializedCommand, now)
    }

    // Otherwise we'll handle this command,so set processing to True
    setProcessingCommand(true)
    dispatcher(
      command,
      suppressNextStatusResult,
      setSuppressNextStatusResult,
      suppressNextStatusCommand,
      setSuppressNextStatusCommand,
      props.handleConnectionError,
    )
      .then(() => {
        setProcessingCommand(false)
        props.setCmdQueue((prev) => prev.slice(1))
      })
      .catch((reason) => console.log(reason))
  }, [props.cmdQueue, processingCommand])
}
