import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canUseProtrackApi,
  datastatusLabel,
  getProtrackStatus,
  listProtrackDevices,
  trackProtrackImeis,
} from '../../services/api/protrackApiService'

const POLL_MS = 15000

const isAuthFailure = (err) => {
  const message = String(err?.message || err || '').toLowerCase()
  return message.includes('login failed')
    || message.includes('permission denied')
    || message.includes('auth')
    || message.includes('unauthorized')
}

/**
 * Poll ProTrack365 devices + live coordinates for Transport / Parent / Student maps.
 * Never falls back to an arbitrary device (wrong-bus risk).
 */
export default function useProtrackLive(opts = {}) {
  const {
    panel,
    preferredImei = '',
    preferredPlate = '',
    fallbackPanel = '',
  } = opts
  const panelRef = useRef(panel || '')
  const [status, setStatus] = useState(null)
  const [devices, setDevices] = useState([])
  const [imei, setImei] = useState(preferredImei || '')
  const [track, setTrack] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    panelRef.current = panel || ''
  }, [panel])

  const refreshTrack = useCallback(async (targetImei, panelOverride) => {
    if (!canUseProtrackApi() || !targetImei) return
    const panelToUse = panelOverride || panelRef.current || panel
    const res = await trackProtrackImeis([targetImei], panelToUse || undefined)
    if (res.success) {
      const row = Array.isArray(res.data) ? res.data[0] : null
      setTrack(row || null)
      setError((prev) => (String(prev || '').includes('Parent GPS') ? prev : ''))
      return
    }
    const message = typeof res.error === 'string' ? res.error : 'Live track failed.'
    if (fallbackPanel && panelToUse !== fallbackPanel && isAuthFailure(message)) {
      const fallback = await trackProtrackImeis([targetImei], fallbackPanel)
      if (fallback.success) {
        panelRef.current = fallbackPanel
        setTrack(Array.isArray(fallback.data) ? fallback.data[0] || null : null)
        setError('Parent GPS login failed — using school fleet tracking instead.')
        return
      }
      setError(typeof fallback.error === 'string' ? fallback.error : message)
      return
    }
    setError(message)
  }, [fallbackPanel, panel])

  useEffect(() => {
    if (!canUseProtrackApi()) {
      setError('Sign in with live API auth to load ProTrack365.')
      return undefined
    }
    let active = true
    setLoading(true)
    panelRef.current = panel || ''
    ;(async () => {
      try {
        const stRes = await getProtrackStatus()
        if (!active) return
        if (!stRes.success) {
          setError(typeof stRes.error === 'string' ? stRes.error : 'Could not load ProTrack status.')
          return
        }
        const st = stRes.data || {}
        setStatus(st)
        if (!st?.configured) {
          setError('ProTrack365 credentials are not configured on the API (.env).')
          return
        }

        let devicesList = []
        let panelUsed = panel || ''
        let devicesError = ''
        const devicesRes = await listProtrackDevices(panel || undefined)
        if (devicesRes.success) {
          devicesList = Array.isArray(devicesRes.data) ? devicesRes.data : []
        } else if (fallbackPanel && isAuthFailure(devicesRes.error)) {
          const fallback = await listProtrackDevices(fallbackPanel)
          if (fallback.success) {
            devicesList = Array.isArray(fallback.data) ? fallback.data : []
            panelUsed = fallbackPanel
            panelRef.current = fallbackPanel
            if (active) setError('Parent GPS login failed — using school fleet tracking instead.')
          } else {
            devicesError = typeof fallback.error === 'string' ? fallback.error : (devicesRes.error || 'Device list failed.')
          }
        } else {
          devicesError = typeof devicesRes.error === 'string' ? devicesRes.error : 'Device list failed.'
        }
        if (!active) return
        panelRef.current = panelUsed
        setDevices(devicesList)

        const plateNorm = String(preferredPlate || '').replace(/[\s-]/g, '').toUpperCase()
        const wantImei = String(preferredImei || '').trim()
        const byImei = wantImei
          ? devicesList.find((d) => String(d.imei) === wantImei)
          : null
        const byPlate = plateNorm
          ? devicesList.find(
            (d) => String(d.platenumber || '').replace(/[\s-]/g, '').toUpperCase() === plateNorm,
          )
          : null
        const chosen = byImei || byPlate || null
        const nextImei = String(chosen?.imei || wantImei || '')
        if (!nextImei) {
          setImei('')
          setTrack(null)
          if (devicesError) setError(devicesError)
          else if (!wantImei && !plateNorm) {
            setError('Live GPS needs a verified vehicle IMEI or plate mapped to a ProTrack device.')
          } else {
            setError(`No ProTrack device matches ${wantImei || preferredPlate}. Confirm the IMEI/plate on the vehicle record.`)
          }
          return
        }
        if (devicesError && wantImei) {
          setError(`${devicesError} — tracking with saved IMEI ${wantImei}.`)
        } else if (!chosen && wantImei) {
          setError(`IMEI ${wantImei} is not on the ProTrack device list yet — attempting live track anyway.`)
        }
        setImei(nextImei)
        await refreshTrack(nextImei, panelUsed)
      } catch (err) {
        if (active) setError(err?.message || 'Could not load ProTrack devices.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [panel, preferredImei, preferredPlate, fallbackPanel, refreshTrack])

  useEffect(() => {
    if (!imei || !canUseProtrackApi()) return undefined
    const id = setInterval(() => {
      refreshTrack(imei)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [imei, refreshTrack])

  const livePosition =
    track && Number.isFinite(Number(track.latitude)) && Number.isFinite(Number(track.longitude))
      ? [Number(track.latitude), Number(track.longitude)]
      : null

  const stats = {
    progress: livePosition ? 'Live GPS' : '—',
    distanceLeft: livePosition ? 'ProTrack365' : '—',
    eta: track?.gpstime
      ? new Date(Number(track.gpstime) * 1000).toLocaleTimeString()
      : '—',
    speed: track?.speed != null ? `${track.speed} km/h` : '—',
  }

  return {
    status,
    devices,
    imei,
    setImei: (next) => {
      setImei(next)
      refreshTrack(next)
    },
    track,
    livePosition,
    stats,
    liveStatusLabel: track ? datastatusLabel(track.datastatus) : '',
    error,
    loading,
    refresh: () => refreshTrack(imei),
  }
}
