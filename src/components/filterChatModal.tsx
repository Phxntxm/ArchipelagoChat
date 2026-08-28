import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Modal from '@mui/material/Modal'
import { Grid } from '@mui/system'
import { useEffect, useState } from 'react'

const KEY = 'AP-filter-settings'
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 406,
  bgcolor: 'background.paper',
  borderRadius: '10px',
  border: '2px solid #7ccbfb',
  boxShadow: 24,
  p: 4,
}

interface FilterChatProps {
  open: boolean
  setOpen: (arg0: boolean) => void
}

interface FilterSettings {
  filterCommands: boolean
  filterOthersItems: boolean
}

export default function FilterChatModal({ open, setOpen }: FilterChatProps) {
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    filterCommands: false,
    filterOthersItems: false,
  })

  useEffect(() => {
    const saved = localStorage.getItem(KEY)

    if (saved) {
      setFilterSettings(JSON.parse(saved))
    }
  }, [])

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    filterKey: keyof FilterSettings,
  ) => {
    const newSettings = { ...filterSettings, [filterKey]: event.target.checked }
    setFilterSettings(newSettings)
    localStorage.setItem(KEY, JSON.stringify(newSettings))
    window.dispatchEvent(new Event('storage'))
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <Grid container sx={style} component="form">
        <FormControlLabel
          control={
            <Checkbox
              onChange={(event) => handleChange(event, 'filterCommands')}
              checked={filterSettings.filterCommands}
            />
          }
          label="Filter out other player commands (!help)"
        />
        <FormControlLabel
          control={
            <Checkbox
              onChange={(event) => handleChange(event, 'filterOthersItems')}
              checked={filterSettings.filterOthersItems}
            />
          }
          label="Filter out items sent to other players"
        />
      </Grid>
    </Modal>
  )
}
