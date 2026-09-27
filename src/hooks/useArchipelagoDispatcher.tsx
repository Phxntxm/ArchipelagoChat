import {
  ConnectionStatus,
  getInitializedData,
  getLocationsForGame,
  isChat,
  isCommand,
  isCommandResult,
  isDisconnect,
  isHint,
  isItemSend,
  isJoin,
  isTagsChanged,
  isTutorial,
  typographyItemInfo,
  type Chat,
  type CommandHandler,
  type CommandResult,
  type Commands,
  type ConnectedCmd,
  type ConnectionRefused,
  type DataPackageCmd,
  type Disconnect,
  type Hint,
  type ItemSend,
  type Join,
  type PrintJSON,
  type ReceivedItems,
  type RoomInfoCmd,
  type RoomUpdateCmd,
} from '#/utils'
import Tooltip from '@mui/material/Tooltip'
import { useCallback, useEffect, useRef } from 'react'
import { v4 } from 'uuid'
/*
This hook receives commands from all websocket connections, processes them in
FIFO batches, and deduplicates commands shared across connections.
*/

const ID = 1
const DUPLICATE_WINDOW_MS = 5_000
const DUPLICATE_PRUNE_INTERVAL_MS = 5_000
const COMMAND_BATCH_SIZE = 50
const COMMAND_BATCH_BUDGET_MS = 8
const ALWAYS_ACCEPTED_COMMANDS = new Set([
  'RoomInfo',
  'DataPackage',
  'Connected',
])
interface ArchipelagoDispatcherProps {
  setLoggedIn: React.Dispatch<React.SetStateAction<boolean>>
  handleConnectionError: (arg0: string) => void
}

interface ArchipelagoDispatcher {
  enqueueCommand: (command: CommandHandler<Commands>) => void
  clearQueue: () => void
}

// Standalone commands
function handleRoomInfo(handler: CommandHandler<RoomInfoCmd>) {
  handler.dataContextProps.setArchipelagoData({
    id: ID,
    room_games: handler.cmd.games,
    datapackage_checksums: handler.cmd.datapackage_checksums,
  })

  handler.sendCommand(
    JSON.stringify([{ cmd: 'GetDataPackage', games: handler.cmd.games }]),
  )
}

function handleDataPackage(handler: CommandHandler<DataPackageCmd>) {
  const games = Object.entries(handler.cmd.data.games).map(
    ([name, gameData]) => ({
      name,
      item_name_to_id: gameData.item_name_to_id,
      location_name_to_id: gameData.location_name_to_id,
    }),
  )
  handler.dataContextProps.updateArchipelagoData((current) => ({
    ...current,
    games,
  }))

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

function handleConnected(
  handler: CommandHandler<ConnectedCmd>,
  setLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  setSuppressNextStatusResult: (arg0: boolean) => void,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
) {
  const data = getInitializedData(handler)
  handler.dataContextProps.updatePlayers((currentPlayers) => {
    const players = Object.entries(handler.cmd.slot_info)
      .map(([slotId, slot]) => {
        const playerId = parseInt(slotId)
        const existingPlayer = currentPlayers.find(
          (player) => player.id === playerId,
        )
        const locations = getLocationsForGame(
          data.archipelago,
          slot.game,
        ).filter(
          (l) =>
            handler.cmd.checked_locations.includes(l.id) ||
            handler.cmd.missing_locations.includes(l.id),
        )

        // If they don't exist but are not the one we're connecting with, just add default info
        if (existingPlayer === undefined) {
          if (slotId !== handler.cmd.slot.toString()) {
            return {
              id: playerId,
              game: slot.game,
              name: slot.name,
              logged_in: false,
              connections: 0,
              status: ConnectionStatus.Disconnected,
              locations: [],
              received_items: [],
              hint_points: 0,
              cur_locations: 0,
              missing_locations: 0,
            }
          }
          // If they don't exist and match the one we're logging in with - fill in with command's info
          else {
            return {
              id: playerId,
              game: slot.game,
              name: slot.name,
              logged_in: true,
              connections: 1,
              status: ConnectionStatus.Connected,
              locations: locations.map((location) => {
                const found = handler.cmd.checked_locations.includes(
                  location.id,
                )
                return {
                  ...location,
                  found: found,
                }
              }),
              received_items: [],
              hint_points: handler.cmd.hint_points,
              cur_locations: handler.cmd.checked_locations.length,
              missing_locations: handler.cmd.missing_locations.length,
            }
          }
        }
        // If they do exist... AND ONLY IF IT MATCHES THE CONNECTION, update with the command's info
        else if (slotId === handler.cmd.slot.toString()) {
          return {
            ...existingPlayer,
            logged_in: true,
            locations: locations.map((location) => {
              const found = handler.cmd.checked_locations.includes(location.id)
              return {
                ...location,
                found: found,
              }
            }),
            hint_points: handler.cmd.hint_points,
          }
        }
      })
      .filter((player) => player !== undefined)
    return players
  })

  setLoggedIn(true)
  setSuppressNextStatusCommand(true)
  setSuppressNextStatusResult(true)
  handler.sendMessage('!status')
}

function handleRoomUpdate(handler: CommandHandler<RoomUpdateCmd>) {
  getInitializedData(handler)
  // Handle global changes
  if (handler.cmd.hint_cost !== undefined) {
    handler.dataContextProps.updateArchipelagoData((current) => ({
      ...current,
      hint_cost: handler.cmd.hint_cost,
    }))
  }
  // Handle player changes
  if (handler.cmd.hint_points !== undefined) {
    const hintPoints = handler.cmd.hint_points
    handler.dataContextProps.updatePlayers((players) =>
      players.map((player) =>
        player.name === handler.slot
          ? { ...player, hint_points: hintPoints }
          : player,
      ),
    )
  }
}

function handleReceivedItems(handler: CommandHandler<ReceivedItems>) {
  // Received items does not send any information to attach it to a player, so we sort of need to hobble this together
  const data = getInitializedData(handler)
  const game = data.archipelago.games?.find((game) =>
    handler.cmd.items.some((item) => {
      for (const itemName in game.item_name_to_id) {
        if (
          Object.hasOwn(game.item_name_to_id, itemName) &&
          game.item_name_to_id[itemName] === item.item
        ) {
          return true
        }
      }

      return false
    }),
  )

  if (game) {
    const recipient = data.players.find((player) => player.game === game.name)
    if (recipient === undefined) return

    handler.dataContextProps.updatePlayers((players) =>
      players.map((player) =>
        player.id === recipient.id
          ? {
              ...player,
              received_items:
                handler.cmd.index === 0
                  ? handler.cmd.items
                  : [...player.received_items, ...handler.cmd.items],
            }
          : player,
      ),
    )
  }
}

function handlePrintJSON(
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
  } else if (isHint(handler.cmd)) {
    handleHint(handler as CommandHandler<Hint>)
  } else {
    handler.addChat(message)
  }
}

function handleConnectionRefused(
  cmd: ConnectionRefused,
  handleRefusal: (arg0: string) => void,
) {
  if (cmd.errors.includes('InvalidSlot')) {
    handleRefusal('Could not connect: Invalid Slot')
  } else if (cmd.errors.includes('InvalidPassword')) {
    handleRefusal('Could not connect: Invalid Password')
  } else {
    handleRefusal(`Unknown error. Contact Phantom. ${cmd.errors}`)
  }
}

// PrintJSON commands
function handleItemSend(handler: CommandHandler<ItemSend>) {
  const data = getInitializedData(handler)
  const message = typographyItemInfo(
    handler.cmd,
    data.archipelago,
    data.players,
  )
  handler.addStatus(message.message, message.element)
  const location = handler.cmd.data.find((part) => part.type === 'location_id')

  const playerId = location?.player
  if (playerId === undefined) return

  const locationId = parseInt(location?.text ?? '-1')
  handler.dataContextProps.updatePlayers((players) =>
    players.map((player) => {
      if (player.id !== playerId) return player

      if (player.logged_in) {
        return {
          ...player,
          locations: player.locations.map((playerLocation) => ({
            ...playerLocation,
            found:
              playerLocation.id === locationId ? true : playerLocation.found,
          })),
        }
      }

      if (player.missing_locations !== 0) {
        return {
          ...player,
          cur_locations: player.cur_locations + 1,
          missing_locations: player.missing_locations - 1,
        }
      }

      return player
    }),
  )
}

function handleHint(handler: CommandHandler<Hint>) {
  const data = getInitializedData(handler)
  const message = typographyItemInfo(
    handler.cmd,
    data.archipelago,
    data.players,
  )
  handler.addStatus(message.message, message.element)
}

function handleJoin(handler: CommandHandler<Join>) {
  const player = handler.dataContextProps.getPlayer(handler.cmd.slot)

  if (player) {
    handler.dataContextProps.updatePlayers((players) =>
      players.map((current) =>
        current.id === player.id
          ? { ...current, connections: current.connections + 1 }
          : current,
      ),
    )

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

function handleDisconnect(handler: CommandHandler<Disconnect>) {
  const player = handler.dataContextProps.getPlayer(handler.cmd.slot)

  if (player) {
    handler.dataContextProps.updatePlayers((players) =>
      players.map((current) =>
        current.id === player.id
          ? { ...current, connections: current.connections - 1 }
          : current,
      ),
    )
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

function handleStatusResult(
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

  message.split('\n').forEach((line) => {
    const lineMsg =
      /^(.+) has (\d+) connections?(?: and has finished)?\. \((\d+)\/(\d+)\)$/

    const lineMatch = line.match(lineMsg)

    if (lineMatch) {
      let slot = lineMatch[1]
      const connCount = parseInt(lineMatch[2])
      const curChecks = parseInt(lineMatch[3])
      const totalChecks = parseInt(lineMatch[4])
      const originalSlot = slot
      // They're aliased - annoyingly there's no distinction in this command
      // that you can use other than guessing. If they've got a short name and slot,
      // and using parenthesis in their name (which is allowed)? We're fucked I guess
      if (slot.length > 16 && slot.includes('(') && slot.includes(')')) {
        const slotAliasMatch = slot.match(/\(([^\)]*)\)/)
        if (slotAliasMatch) {
          const aliasedPlayer = handler.dataContextProps
            .getData()
            ?.players.find((candidate) => candidate.name === slotAliasMatch[1])
          if (aliasedPlayer) {
            slot = aliasedPlayer.name
          } else {
            slot = originalSlot
          }
        }
      }

      const player = handler.dataContextProps
        .getData()
        ?.players.find((candidate) => candidate.name === slot)
      if (player) {
        // If they're logged in we are handling their tracking separately
        handler.dataContextProps.updatePlayers((players) =>
          players.map((current) =>
            current.id !== player.id
              ? current
              : current.logged_in
                ? { ...current, connections: connCount }
                : {
                    ...current,
                    cur_locations: curChecks,
                    missing_locations: totalChecks - curChecks,
                    connections: connCount,
                  },
          ),
        )
      }
    }
  })
}

function handleCommandResult(
  message: string,
  handler: CommandHandler<CommandResult>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
) {
  const statusMsg = /^Player Status on team \d+:/

  const statusMatch = message.match(statusMsg)

  if (statusMatch) {
    handleStatusResult(
      message,
      handler,
      suppressNextStatusResult,
      setSuppressNextStatusResult,
    )
  } else {
    handler.addStatus(message)
  }
}

function handleChat(
  handler: CommandHandler<Chat>,
  suppressNextStatusCommand: boolean,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
) {
  const player = handler.dataContextProps.getPlayer(handler.cmd.slot)

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

function dispatcher(
  handler: CommandHandler<Commands>,
  setLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  suppressNextStatusResult: boolean,
  setSuppressNextStatusResult: (arg0: boolean) => void,
  suppressNextStatusCommand: boolean,
  setSuppressNextStatusCommand: (arg0: boolean) => void,
  handleConnectionError: (arg0: string) => void,
) {
  switch (handler.cmd.cmd) {
    case 'RoomInfo':
      handleRoomInfo(handler as CommandHandler<RoomInfoCmd>)
      break
    case 'DataPackage':
      handleDataPackage(handler as CommandHandler<DataPackageCmd>)
      break
    case 'Connected':
      handleConnected(
        handler as CommandHandler<ConnectedCmd>,
        setLoggedIn,
        setSuppressNextStatusResult,
        setSuppressNextStatusCommand,
      )
      break
    case 'ConnectionRefused':
      handleConnectionRefused(handler.cmd, handleConnectionError)
      break
    case 'ReceivedItems':
      handleReceivedItems(handler as CommandHandler<ReceivedItems>)
      break
    case 'RoomUpdate':
      handleRoomUpdate(handler as CommandHandler<RoomUpdateCmd>)
      break
    case 'PrintJSON':
      handlePrintJSON(
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
): ArchipelagoDispatcher {
  const propsRef = useRef(props)
  propsRef.current = props
  const cmdQueue = useRef<CommandHandler<Commands>[]>([])
  const queueHead = useRef(0)
  const receivedCommands = useRef(new Map<string, number>())
  const lastDuplicatePrune = useRef(0)
  const timeoutId = useRef<number | undefined>(undefined)
  // To get more info we need to run status in the beginning, but we don't care about the chat message
  //  so just suppress it
  const suppressNextStatusResult = useRef(false)
  const suppressNextStatusCommand = useRef(false)

  const clearQueue = useCallback(() => {
    if (timeoutId.current !== undefined) {
      window.clearTimeout(timeoutId.current)
      timeoutId.current = undefined
    }
    cmdQueue.current = []
    queueHead.current = 0
    receivedCommands.current.clear()
    lastDuplicatePrune.current = 0
    suppressNextStatusResult.current = false
    suppressNextStatusCommand.current = false
  }, [])

  const processBatch = useCallback(() => {
    timeoutId.current = undefined
    const startedAt = performance.now()
    let processed = 0
    const now = Date.now()

    if (now - lastDuplicatePrune.current >= DUPLICATE_PRUNE_INTERVAL_MS) {
      for (const [serializedCommand, receivedAt] of receivedCommands.current) {
        if (now - receivedAt >= DUPLICATE_WINDOW_MS) {
          receivedCommands.current.delete(serializedCommand)
        }
      }
      lastDuplicatePrune.current = now
    }

    while (
      queueHead.current < cmdQueue.current.length &&
      processed < COMMAND_BATCH_SIZE &&
      performance.now() - startedAt < COMMAND_BATCH_BUDGET_MS
    ) {
      const command = cmdQueue.current[queueHead.current]
      queueHead.current += 1
      processed += 1

      const commandTime = Date.now()
      const shouldDeduplicate = !ALWAYS_ACCEPTED_COMMANDS.has(command.cmd.cmd)

      if (shouldDeduplicate) {
        const serializedCommand = JSON.stringify(command.cmd)
        const receivedAt = receivedCommands.current.get(serializedCommand)

        if (
          receivedAt !== undefined &&
          commandTime - receivedAt < DUPLICATE_WINDOW_MS
        ) {
          receivedCommands.current.set(serializedCommand, commandTime)
          continue
        }

        receivedCommands.current.set(serializedCommand, commandTime)
      }

      const currentProps = propsRef.current
      try {
        dispatcher(
          command,
          currentProps.setLoggedIn,
          suppressNextStatusResult.current,
          (value) => {
            suppressNextStatusResult.current = value
          },
          suppressNextStatusCommand.current,
          (value) => {
            suppressNextStatusCommand.current = value
          },
          currentProps.handleConnectionError,
        )
      } catch (error) {
        console.error('Failed to process websocket command', command.cmd, error)
      }
    }

    if (queueHead.current === cmdQueue.current.length) {
      cmdQueue.current = []
      queueHead.current = 0
    } else if (
      queueHead.current >= COMMAND_BATCH_SIZE &&
      queueHead.current * 2 >= cmdQueue.current.length
    ) {
      cmdQueue.current = cmdQueue.current.slice(queueHead.current)
      queueHead.current = 0
    }

    if (queueHead.current < cmdQueue.current.length) {
      timeoutId.current = window.setTimeout(processBatch, 0)
    }
  }, [])

  const scheduleBatch = useCallback(() => {
    if (timeoutId.current === undefined) {
      timeoutId.current = window.setTimeout(processBatch, 0)
    }
  }, [processBatch])

  const enqueueCommand = useCallback(
    (command: CommandHandler<Commands>) => {
      cmdQueue.current.push(command)
      scheduleBatch()
    },
    [scheduleBatch],
  )

  useEffect(
    () => () => {
      clearQueue()
    },
    [clearQueue],
  )

  return { enqueueCommand, clearQueue }
}
