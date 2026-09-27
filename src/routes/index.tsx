import ChatContainer from '#/components/chatcontainer'
import Login from '#/components/login'
import SocketConnection, {
  type SocketConnectionRef,
} from '#/components/socketConnections'
import { useDataContext } from '#/data'
import useArchipelagoDispatcher from '#/hooks/useArchipelagoDispatcher'
import {
  socketIdentifier,
  type ChatMessage,
  type Commands,
  type LoginDetails,
} from '#/utils'
import { createFileRoute } from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SetStateAction,
} from 'react'

export const Route = createFileRoute('/')({ component: Home })
const KEY = 'AP-login-details'
const MAX_MESSAGES = 50

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
  const [loginStarted, setLoginStarted] = useState(false)
  const childRefs = useRef<Map<string, SocketConnectionRef>>(new Map())
  const acceptingCommands = useRef(false)
  const connectionSession = useRef(0)
  const clearCommandQueue = useRef<() => void>(() => {})
  const isCurrentSession = useCallback(
    (sessionId: number) => connectionSession.current === sessionId,
    [],
  )
  const dataContextProps = useDataContext()
  const { resetData } = dataContextProps

  // The chatbox information
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [statusMessages, setStatusMessages] = useState<ChatMessage[]>([])
  const addChat = (message: string, element?: ReactElement) => {
    setChatMessages((msgs) => [
      ...msgs.slice(-(MAX_MESSAGES - 1)),
      { message: message, element: element },
    ])
  }
  const addStatus = (message: string, element?: ReactElement) => {
    setStatusMessages((msgs) => [
      ...msgs.slice(-(MAX_MESSAGES - 1)),
      { message: message, element: element },
    ])
  }

  const players =
    dataContextProps.data?.players.filter((player) => player.logged_in) ?? []

  const handleConnectionError = (error: string) => {
    connectionSession.current += 1
    acceptingCommands.current = false
    clearCommandQueue.current()
    resetData()
    setLoginStarted(false)
    setConnError(error)
    handleSetLoginDetails([])
    setLoggedIn(false)
    setIsLoading(false)
    setConnections({})
  }

  const { enqueueCommand, clearQueue } = useArchipelagoDispatcher({
    setLoggedIn: setLoggedIn,
    handleConnectionError: handleConnectionError,
  })
  clearCommandQueue.current = clearQueue

  const addCmd = (
    cmd: Commands,
    slot: string,
    password: string | null,
    sendMessage: (arg0: string) => void,
    sendCommand: (arg0: string) => void,
  ) => {
    if (!acceptingCommands.current) return

    const newCmd = {
      cmd: cmd,
      slot: slot,
      password: password,
      dataContextProps: dataContextProps,
      sendMessage: sendMessage,
      sendCommand: sendCommand,
      addChat: addChat,
      addStatus: addStatus,
    }
    enqueueCommand(newCmd)
  }

  useEffect(() => {
    if (loggedIn) {
      setLoginStarted(false)
    }
  }, [loggedIn])

  useEffect(() => {
    const details = localStorage.getItem(KEY)

    if (details) {
      setLoginDetails(JSON.parse(details))
    }

    resetData()
  }, [resetData])

  useEffect(() => {
    // If we haven't tried to login yet, don't create any websockets
    if (!isLoading && !loggedIn) return
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
                setLoginStarted={setLoginStarted}
                sessionId={connectionSession.current}
                isCurrentSession={isCurrentSession}
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
    connectionSession.current += 1
    acceptingCommands.current = false
    clearQueue()
    childRefs.current.forEach((child) => child.getWebSocket()?.close())
    setLoggedIn(false)
    setLoginStarted(false)
    setIsLoading(false)
    setConnError('')
    setConnections({})
    handleSetLoginDetails([])
    setChatMessages([])
    setStatusMessages([])
    resetData()
  }

  const startLogin = (loading: boolean) => {
    if (loading) {
      connectionSession.current += 1
      clearQueue()
      resetData()
      acceptingCommands.current = true
      setLoginStarted(true)
    }
    setIsLoading(loading)
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

  if (players.length === 0 || !loggedIn) {
    return (
      <>
        {Object.values(connections).map((conns) => conns.element)}
        <Login
          setLoginDetails={handleSetLoginDetails}
          setIsLoading={startLogin}
          isLoading={loginStarted && !loggedIn}
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
