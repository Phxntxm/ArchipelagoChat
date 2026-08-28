import type { LoginDetails } from '#/utils'
import { yupResolver } from '@hookform/resolvers/yup'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Modal from '@mui/material/Modal'
import TextField from '@mui/material/TextField'
import { Grid } from '@mui/system'
import React from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import * as yup from 'yup'

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: '10px',
  border: '2px solid #7ccbfb',
  boxShadow: 24,
  p: 4,
}

const loginSchema = yup
  .object({
    url: yup.string().required('URL is required'),
    port: yup
      .number()
      .transform((value, originalValue) => {
        return String(originalValue).trim() === '' ? undefined : value
      })
      .required('Port is required')
      .typeError('Port must be a valid number')
      .min(1024)
      .max(65535),
    slot: yup.string().required('Slot is required'),
    password: yup.string().transform((value, originalValue) => {
      return String(originalValue).trim() === '' ? undefined : value
    }),
  })
  .required()

type LoginValues = yup.InferType<typeof loginSchema>

interface LoginProps {
  setLoginDetails: React.Dispatch<React.SetStateAction<LoginDetails[]>>
  isLoading: boolean
  connectionError: string
}

export default function Login({
  setLoginDetails,
  isLoading,
  connectionError,
}: LoginProps) {
  const [open, setOpen] = React.useState(true)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(loginSchema), mode: 'onTouched' })

  const onSubmit: SubmitHandler<LoginValues> = (data) => {
    if (data) {
      setLoginDetails([
        {
          ...data,
          password: data.password ?? null,
        },
      ])
    }
  }

  return (
    <Modal
      open={open}
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') setOpen(false)
      }}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Grid
        sx={style}
        container
        component="form"
        autoComplete="on"
        onSubmit={handleSubmit(onSubmit)}
      >
        {connectionError && (
          <Grid size={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {connectionError}
            </Alert>
          </Grid>
        )}
        <Grid size={12}>
          <TextField
            id="url-entry"
            {...register('url')}
            label="URL"
            sx={{ marginBottom: '10px', width: '100%' }}
            error={!!errors.url}
            helperText={errors.url?.message}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            id="port-entry"
            {...register('port')}
            label="Port"
            sx={{ marginBottom: '10px', width: '100%' }}
            error={!!errors.port}
            helperText={errors.port?.message}
          />
        </Grid>
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
          <Button variant="outlined" type="submit" loading={isLoading}>
            Login
          </Button>
        </Grid>
      </Grid>
    </Modal>
  )
}
