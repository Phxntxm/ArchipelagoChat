import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import appCss from '../styles.css?url'

const theme = createTheme({
  palette: {
    text: {
      primary: '#fff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
    action: {
      active: '#fff',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
    background: {
      default: '#121212',
      paper: '#121212',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    primary: {
      main: '#90caf9',
    },
  },
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Archipelago Chat',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          {children}
          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  )
}
