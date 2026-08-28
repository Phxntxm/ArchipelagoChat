import { socketIdentifier, type Commands } from '#/utils'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { ReadyState, default as useWebSocketModule } from 'react-use-websocket'
import type { WebSocketLike } from 'react-use-websocket/dist/lib/types'

// Fallback to .default if the module object itself isn't callable
const getWebSocketHook = () => {
  if (typeof useWebSocketModule === 'function') {
    return useWebSocketModule
  }

  // Check typical nested default, then fall back to the actual library object
  return (
    (useWebSocketModule as unknown as { default: typeof useWebSocketModule })
      .default || useWebSocketModule
  )
}

const useWebSocket = getWebSocketHook()

interface SocketProps {
  url: string
  port: number
  slot: string
  password: string | null
  addCmd: (
    arg0: Commands,
    arg1: string,
    arg2: string | null,
    arg3: (arg0: string) => void,
    arg4: (arg0: string) => void,
  ) => void
  setReadyState: (arg0: string, arg1: string) => void
}

export interface SocketConnectionRef {
  handleSendMessage: (arg0: string) => void
  getWebSocket: () => WebSocketLike | null
  slot: string
}

const SocketConnection = forwardRef<SocketConnectionRef, SocketProps>(
  (props, ref) => {
    const socketUrl = `ws://${props.url}:${props.port}`
    const { sendMessage: sendCommand, lastMessage, readyState, getWebSocket } = useWebSocket(socketUrl)
    const {slot} = props

    const handleSendMessage = (message: string) => {
      sendCommand(
        JSON.stringify([
          {
            cmd: 'Say',
            text: message,
          },
        ]),
      )
    }

    useImperativeHandle(ref, () => ({ handleSendMessage, getWebSocket,  slot}))

    const connectionStatus = {
      [ReadyState.CONNECTING]: 'Connecting',
      [ReadyState.OPEN]: 'Open',
      [ReadyState.CLOSING]: 'Closing',
      [ReadyState.CLOSED]: 'Closed',
      [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState]

    useEffect(() => {
      if (lastMessage && lastMessage.data) {
        const commands: Commands[] = JSON.parse(lastMessage.data)
        commands.forEach((cmd) =>
          props.addCmd(cmd, props.slot, props.password, handleSendMessage, sendCommand),
        )
      }
    }, [lastMessage])

    useEffect(() => {
      props.setReadyState(
        socketIdentifier(props.url, props.port, props.slot, props.password),
        connectionStatus,
      )
    }, [connectionStatus])
    return <></>
  },
)

SocketConnection.displayName = 'SocketConnection'

export default SocketConnection
