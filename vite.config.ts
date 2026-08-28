import { devtools } from '@tanstack/devtools-vite'
import { defineConfig } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from "nitro/vite"

const config = defineConfig(({command}) => {
  const plugins = [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ]
  if (command === 'build') plugins.push(nitro())

  return {
    resolve: { tsconfigPaths: true },
    plugins: plugins,
  }
})

export default config
