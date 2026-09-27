import { useDataContext } from '#/data'
import { isCommand, type ChatMessage } from '#/utils'
import SendIcon from '@mui/icons-material/Send'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseFilterSettings, type FilterSettings } from './chatFilterSettings'

const KEY = 'AP-filter-settings'
const MAX_VISIBLE_MESSAGES = 50

interface ChatProps {
  messages: ChatMessage[]
  placeholder: string
  tabIndex: number
  sendMessage: (arg0: string) => void
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
    filterJoinLeaves: false,
  })
  const { data } = useDataContext()

  useEffect(() => {
    const saved = localStorage.getItem(KEY)

    if (saved) {
      setFilterSettings(parseFilterSettings(saved))
    }

    const handleStorage = () => {
      const saved = localStorage.getItem(KEY)
      if (saved) {
        setFilterSettings(parseFilterSettings(saved))
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const filteredMessages = useMemo(() => {
    const playerNames = new Set(
      data?.players
        .filter((player) => player.logged_in)
        .map((player) => player.name),
    )
    const isMe = (name: string) => playerNames.has(name)

    return messages.slice(-MAX_VISIBLE_MESSAGES).filter((message) => {
      const match = message.message.match(/^([^ ]*): (.*)/)
      const text = match ? match[2] : message.message
      const name = match ? match[1] : ''

      const foundOwnItem = text.match(/^(.*) found their (.*) \((.*)\)$/)
      const foundOtherItem = text.match(/^(.*) sent (.*) to (.*) \((.*)\)$/)
      const join = text.match(/^(.*) has joined! \(Team \d+\)$/)
      const part = text.match(/^(.*) has disconnected.$/)

      if (isCommand(text) && !isMe(name) && filterSettings.filterCommands) {
        return false
      } else if (foundOwnItem && filterSettings.filterOthersItems) {
        return isMe(foundOwnItem[1])
      } else if (foundOtherItem && filterSettings.filterOthersItems) {
        return isMe(foundOtherItem[4])
      } else if ((join || part) && filterSettings.filterJoinLeaves) {
        return false
      }

      return true
    })
  }, [data?.players, filterSettings, messages])

  useEffect(() => {
    const list = messagesListRef.current
    if (!list) return

    list.scrollTop = list.scrollHeight
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
