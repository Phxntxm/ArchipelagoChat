import { db } from '#/db'
import { isCommand, type ChatMessage } from '#/utils'
import SendIcon from '@mui/icons-material/Send'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'

const KEY = 'AP-filter-settings'

interface ChatProps {
  messages: ChatMessage[]
  placeholder: string
  tabIndex: number
  sendMessage: (arg0: string) => void
}

interface FilterSettings {
  filterCommands: boolean
  filterOthersItems: boolean
}

export function Chat({
  messages,
  sendMessage,
  placeholder,
  tabIndex,
}: ChatProps) {
  const [inputValue, setInputValue] = useState('')
  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }
  const messagesListRef = useRef<HTMLUListElement>(null)
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    filterCommands: false,
    filterOthersItems: false,
  })
  const [filteredMessages, setFilteredMessages] = useState<ChatMessage[]>([])
  const players = useLiveQuery(() =>
    db.player.filter((p) => p.logged_in).toArray(),
  )
  const playerNames = players?.map((p) => p.name)

  const isMe = (name: string) => {
    if (playerNames) {
      return playerNames.includes(name)
    } else return false
  }

  useEffect(() => {
    const saved = localStorage.getItem(KEY)

    if (saved) {
      setFilterSettings(JSON.parse(saved))
    }

    window.addEventListener('storage', () => {
      const saved = localStorage.getItem(KEY)
      if (saved) {
        setFilterSettings(JSON.parse(saved))
      }
    })
  }, [])

  useEffect(() => {
    const filtered = messages.filter((message) => {
      const match = message.message.match(/^([^ ]*): (.*)/)
      const text = match ? match[2] : message.message
      const name = match ? match[1] : ''

      const foundOwnItem = text.match(/^(.*) has found their (.*) \((.*)\)$/)
      const foundOtherItem = text.match(/^(.*) sent (.*) \((.*)\) to (.*)$/)

      if (isCommand(text) && !isMe(name) && filterSettings.filterCommands) {
        return false
      } else if (foundOwnItem && filterSettings.filterOthersItems) {
        return isMe(foundOwnItem[1])
      } else if (foundOtherItem && filterSettings.filterOthersItems) {
        return isMe(foundOtherItem[4])
      }

      return true
    })

    setFilteredMessages(filtered)
  }, [messages, filterSettings])

  useEffect(() => {
    const list = messagesListRef.current
    if (!list) return

    list.scrollTo({
      top: list.scrollHeight - list.clientHeight,
      behavior: 'smooth',
    })
  }, [filteredMessages])

  return (
    <>
      {/*Chat box */}
      <List
        ref={messagesListRef}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {filteredMessages.map((msg, index) => (
          <ListItem
            key={index}
            disablePadding
            sx={{
              p: 1.5,
              borderRadius: '16px 16px 4px 16px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: 1,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.element !== undefined ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {msg.element}
              </Typography>
            ) : (
              msg.message
            )}
          </ListItem>
        ))}
      </List>
      {/*  Input */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          slotProps={{
            htmlInput: { sx: { fontSize: '0.9rem' } },
          }}
          tabIndex={tabIndex}
        >
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            sx={{
              bgcolor: inputValue.trim() ? 'primary.light' : 'transparent',
              color: 'white',
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </TextField>
      </Box>
    </>
  )
}
