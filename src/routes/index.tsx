import ChatContainer from '#/components/chatcontainer'
import Login from '#/components/login'
import SocketConnection, {
  type SocketConnectionRef,
} from '#/components/socketConnections'
import { db } from '#/db'
import useArchipelagoDispatcher from '#/hooks/useArchipelagoDispatcher'
import {
  isLoggedIn,
  socketIdentifier,
  type ChatMessage,
  type CommandHandler,
  type Commands,
  type LoginDetails,
} from '#/utils'
import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SetStateAction,
} from 'react'

export const Route = createFileRoute('/')({ component: Home })
const KEY = 'AP-login-details'

interface SocketInformation {
  state: string
  element: ReactElement
}

function Home() {
  const [loginDetails, setLoginDetails] = useState<LoginDetails[]>([])
  const [chatter, setChatter] = useState('')
  const [connections, setConnections] = useState<
    Record<string, SocketInformation>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const childRefs = useRef<Map<string, SocketConnectionRef>>(new Map())

  // The chatbox information
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [statusMessages, setStatusMessages] = useState<ChatMessage[]>([])
  const addChat = (message: string, element?: ReactElement) => {
    setChatMessages((msgs) => [...msgs, { message: message, element: element }])
  }
  const addStatus = (message: string, element?: ReactElement) => {
    setStatusMessages((msgs) => [
      ...msgs,
      { message: message, element: element },
    ])
  }

  const players = useLiveQuery(() =>
    db.player.filter((player) => player.logged_in).toArray(),
  )

  // The command queue that'll be appended too on each websocket connection
  const [cmdQueue, setCmdQueue] = useState<CommandHandler<Commands>[]>([])

  const handleConnectionError = (error: string) => {
    setConnError(error)
    handleSetLoginDetails([])
    setLoggedIn(false)
    setIsLoading(false)
  }

  useArchipelagoDispatcher({
    cmdQueue: cmdQueue,
    setLoggedIn: setLoggedIn,
    setCmdQueue: setCmdQueue,
    handleConnectionError: handleConnectionError,
  })

  const addCmd = (
    cmd: Commands,
    slot: string,
    password: string | null,
    sendMessage: (arg0: string) => void,
    sendCommand: (arg0: string) => void,
  ) => {
    const newCmd = {
      cmd: cmd,
      slot: slot,
      password: password,
      sendMessage: sendMessage,
      sendCommand: sendCommand,
      addChat: addChat,
      addStatus: addStatus,
    }
    setCmdQueue((prev) => [...prev, newCmd])
  }

  useEffect(() => {
    const details = localStorage.getItem(KEY)

    if (details) {
      setLoginDetails(JSON.parse(details))
    }

    db.player.clear()
    db.archipelago.clear()
  }, [])

  useEffect(() => {
    // If we haven't tried to login yet, don't create any websockets
    if (!isLoading || !isLoggedIn) return
    if (loginDetails.length > 0) {
      setChatter(
        socketIdentifier(
          loginDetails[0].url,
          loginDetails[0].port,
          loginDetails[0].slot,
          loginDetails[0].password,
        ),
      )
    }

    const conns = Object.fromEntries(
      loginDetails.map((login) => {
        const id = socketIdentifier(
          login.url,
          login.port,
          login.slot,
          login.password,
        )
        return [
          id,
          {
            element: (
              <SocketConnection
                key={login.slot}
                url={login.url}
                port={login.port}
                slot={login.slot}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                loggedIn={loggedIn}
                setLoggedIn={setLoggedIn}
                password={login.password}
                setReadyState={handleSetReadyState}
                setConnError={setConnError}
                addCmd={addCmd}
                ref={(node) => {
                  if (node) {
                    childRefs.current.set(id, node)
                  } else {
                    childRefs.current.delete(id)
                  }
                }}
              />
            ),
            state: 'Uninstantiated',
          },
        ]
      }),
    )

    setConnections(conns)
  }, [loginDetails, isLoading, loggedIn])

  const logout = () => {
    childRefs.current.forEach((child) => child.getWebSocket()?.close())
    setLoggedIn(false)
    setIsLoading(false)
    setConnError('')
    handleSetLoginDetails([])
    setChatMessages([])
    setStatusMessages([])
    db.player.clear()
    db.archipelago.clear()
  }

  const sendMessage = (message: string) => {
    // We're going to send messages as the main person logged in
    // TODO: Add feature, dropdown to choose which logged in player we're sending messages as
    const child = childRefs.current.get(chatter)

    if (child) {
      child.handleSendMessage(message)
    }
  }

  const [connError, setConnError] = useState('')

  const handleSetLoginDetails = (s: SetStateAction<LoginDetails[]>) => {
    setLoginDetails(s)
    localStorage.setItem(KEY, JSON.stringify(s))
  }

  const addLogin = (slot: string, password: string | null) => {
    if (loginDetails.length > 0) {
      const newLogin = {
        url: loginDetails[0].url,
        port: loginDetails[0].port,
        slot: slot,
        password: password,
      }

      handleSetLoginDetails([...loginDetails, newLogin])
    }
  }

  const handleSetReadyState = (id: string, state: string) => {
    const conn = connections[id]

    if (conn) {
      const conns = {
        ...connections,
        [id]: {
          element: conn.element,
          state: state,
        },
      }

      setConnections(conns)
    }
  }

  const sendMessageToSlot = (message: string, slot: string) => {
    const child = [...childRefs.current.values()].find(
      (ref) => ref.slot === slot,
    )

    if (child) {
      child.handleSendMessage(message)
    }
  }

  if (players?.length === 0 || !loggedIn) {
    return (
      <>
        {Object.values(connections).map((conns) => conns.element)}
        <Login
          setLoginDetails={handleSetLoginDetails}
          setIsLoading={setIsLoading}
          isLoading={isLoading}
          connectionError={connError}
        />
      </>
    )
  } else {
    return (
      <>
        {Object.values(connections).map((conns) => conns.element)}
        <ChatContainer
          chatMessages={chatMessages}
          statusMessages={statusMessages}
          sendMessage={sendMessage}
          sendMessageToSlot={sendMessageToSlot}
          addLogin={addLogin}
          logout={logout}
        />
      </>
    )
  }
}
