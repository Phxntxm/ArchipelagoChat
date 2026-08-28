import { yupResolver } from '@hookform/resolvers/yup'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Modal from '@mui/material/Modal'
import TextField from '@mui/material/TextField'
import { useForm, type SubmitHandler } from 'react-hook-form'
import * as yup from 'yup'

interface AddLoginProps {
  open: boolean
  setOpen: (arg0: boolean) => void
  addLogin: (arg0: string, arg1: string | null) => void
}

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

const slotEntrySchema = yup
  .object({
    slot: yup.string().required('Slot is required'),
    password: yup.string().transform((value, originalValue) => {
      return String(originalValue).trim() === '' ? undefined : value
    }),
  })
  .required()
type SlotEntryValues = yup.InferType<typeof slotEntrySchema>

export default function AddLoginModal({
  open,
  setOpen,
  addLogin,
}: AddLoginProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(slotEntrySchema), mode: 'onTouched' })

  const onSubmit: SubmitHandler<SlotEntryValues> = (data) => {
    if (data) {
      addLogin(data.slot, data.password ?? null)
      setOpen(false)
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <Grid
        container
        sx={style}
        component="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Grid size={12}>
          <TextField
            id="slot-entry"
            {...register('slot')}
            label="Name/Slot"
            sx={{ marginBottom: '10px', width: '100%' }}
            error={!!errors.slot}
            helperText={errors.slot?.message}
          />
        </Grid>
        <Grid size={8}>
          <TextField
            id="password-entry"
            {...register('password')}
            label="Password"
            type="password"
            sx={{ marginBottom: '10px', width: '100%' }}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
        </Grid>
        <Grid
          size={4}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Button variant="outlined" type="submit">
            Add Slot
          </Button>
        </Grid>
      </Grid>
    </Modal>
  )
}
