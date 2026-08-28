import type { ChatMessage } from '#/utils'
import SettingsIcon from '@mui/icons-material/Settings'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import AddLoginModal from './addLoginModal'
import { Chat } from './chat'
import FilterChatModal from './filterChatModal'
import PlayerContainer from './playercontainer'
import HintTracker from './tracker'

interface ChatContainerProps {
  chatMessages: ChatMessage[]
  statusMessages: ChatMessage[]
  sendMessage: (arg0: string) => void
  sendMessageToSlot: (arg0: string, arg1: string) => void
  addLogin: (arg0: string, arg1: string | null) => void
  logout: () => void
}

export default function ChatContainer(props: ChatContainerProps) {
  const { chatMessages, statusMessages, sendMessage, sendMessageToSlot } = props
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false)
  const [addLoginOpen, setAddLoginOpen] = useState(false)

  const handleChatSend = (message: string) => {
    if (!message.trim()) return
    sendMessage(message)
  }
  const handleCommandSend = (message: string) => {
    if (!message.trim()) return
    sendMessage(message)
  }

  return (
    <Box>
      <FilterChatModal open={chatSettingsOpen} setOpen={setChatSettingsOpen} />
      <AddLoginModal
        open={addLoginOpen}
        setOpen={setAddLoginOpen}
        addLogin={props.addLogin}
      />
      <Paper
        elevation={4}
        sx={{
          margin: '10px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          overflow: 'hidden',
          height: '97vh',
          '--Paper-overlay':
            'linear-gradient(rgba(255, 255, 255, 0.092), rgba(255, 255, 255, 0.092))',
        }}
      >
        {/* Chat Header */}
        <Box
          sx={{
            height: '7vh',
            padding: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6">Archipelago</Typography>
          <div>
            <IconButton onClick={() => setChatSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
            <Button
              variant="contained"
              onClick={() => setAddLoginOpen(true)}
              sx={{ margin: '10px' }}
            >
              Add slot
            </Button>
            <Button variant="contained" onClick={props.logout}>
              Logout
            </Button>
          </div>
        </Box>
        {/* Main page containers */}
        <Divider />
        <Grid container spacing={0}>
          {/* Chat */}
          <Grid size={7}>
            <Box
              tabIndex={-1}
              sx={{
                borderRadius: 3,
                height: '45vh',
                alignContent: 'center',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Chat
                messages={chatMessages}
                sendMessage={handleChatSend}
                placeholder="Send a message"
                tabIndex={0}
              />
            </Box>
          </Grid>
          {/* Hint/tracker */}
          <Grid size={5}>
            <Box
              tabIndex={-1}
              sx={{
                borderRadius: 3,
                height: '45vh',
                alignContent: 'center',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <HintTracker sendMessageToSlot={sendMessageToSlot} />
            </Box>
          </Grid>
          {/* Command box */}
          <Grid size={7}>
            <Box
              tabIndex={-1}
              sx={{
                borderRadius: 3,
                height: '45vh',
                alignContent: 'center',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Chat
                messages={statusMessages}
                sendMessage={handleCommandSend}
                placeholder="Send a command"
                tabIndex={1}
              />
            </Box>
          </Grid>
          {/* Player progress */}
          <Grid size={5}>
            <Box
              tabIndex={-1}
              sx={{
                borderRadius: 3,
                height: '45vh',
                alignContent: 'center',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PlayerContainer />
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
