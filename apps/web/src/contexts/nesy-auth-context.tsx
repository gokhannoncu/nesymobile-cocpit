'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { DATA_CENTER_CONNECTION_PATH } from '@nesy/metronic/config/layout-21.config'
import {
  loginNesyDashboard,
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  type NesyAuthResponse,
  type NesyDashboardToolbarCountry,
  type NesyEnvironment,
} from '@/services/nesy-auth'
import {
  resolveSessionDashboardUserId,
  type NesyDashboardAuth,
} from '@/services/nesy-dashboard'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed'

type NesyUser = NonNullable<NonNullable<NesyAuthResponse['result']['payload']>['user']>

interface NesyAuthState {
  country: NesyDashboardToolbarCountry
  environment: NesyEnvironment
  availableEnvironments: NesyEnvironment[]
  status: ConnectionStatus
  isHydrated: boolean
  token: string | null
  user: NesyUser | null
  sessionUserId: string | null
  error: string | null
  setCountry: (country: NesyDashboardToolbarCountry) => void
  setEnvironment: (environment: NesyEnvironment) => void
  logout: () => void
  connect: () => Promise<string | null>
}

const STORAGE_KEY = 'nesy-auth'

interface PersistedState {
  country: string
  environment: NesyEnvironment
  token: string
  user: NesyUser | null
  sessionUserId?: string | null
}

function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed.token || !parsed.country || !parsed.environment) return null
    return parsed
  } catch {
    return null
  }
}

function persistState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked
  }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nesy-auth-changed'))
  }
}

const NesyAuthContext = createContext<NesyAuthState | null>(null)

function normalizeDashboardCountry(raw: string): NesyDashboardToolbarCountry {
  return raw in NESY_DASHBOARD_COUNTRY_ENVIRONMENTS
    ? (raw as NesyDashboardToolbarCountry)
    : 'HR'
}

export function NesyAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [country, setCountryValue] = useState<NesyDashboardToolbarCountry>('HR')
  const [environment, setEnvironmentValue] = useState<NesyEnvironment>('stage')
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [isHydrated, setIsHydrated] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<NesyUser | null>(null)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableEnvironments = [...NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[country]]

  useEffect(() => {
    const persisted = loadPersistedState()
    if (!persisted) {
      setIsHydrated(true)
      return
    }

    const nextCountry = normalizeDashboardCountry(persisted.country)
    const allowed = NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[nextCountry] as readonly NesyEnvironment[]
    const nextEnvironment = allowed.includes(persisted.environment)
      ? persisted.environment
      : (allowed[0] ?? 'stage')

    setCountryValue(nextCountry)
    setEnvironmentValue(nextEnvironment)
    setToken(persisted.token)
    setUser(persisted.user)
    setSessionUserId(persisted.sessionUserId ?? null)
    setStatus('connected')
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (status === 'connected' && token) {
      persistState({ country, environment, token, user, sessionUserId })
    }
    notifyAuthChanged()
  }, [status, token, country, environment, user, sessionUserId])

  function setCountry(nextCountry: NesyDashboardToolbarCountry) {
    setCountryValue(nextCountry)
    const nextEnvironments = NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[nextCountry] as readonly NesyEnvironment[]
    if (!nextEnvironments.includes(environment)) {
      setEnvironmentValue(nextEnvironments[0] ?? 'stage')
    }
    setStatus('idle')
    setToken(null)
    setUser(null)
    setSessionUserId(null)
    setError(null)
    clearPersistedState()
    notifyAuthChanged()
  }

  function setEnvironment(nextEnvironment: NesyEnvironment) {
    if (!availableEnvironments.includes(nextEnvironment)) {
      return
    }
    setEnvironmentValue(nextEnvironment)
    setStatus('idle')
    setToken(null)
    setUser(null)
    setSessionUserId(null)
    setError(null)
    clearPersistedState()
    notifyAuthChanged()
  }

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setSessionUserId(null)
    setError(null)
    setStatus('idle')
    clearPersistedState()
    notifyAuthChanged()
    router.push(DATA_CENTER_CONNECTION_PATH)
  }, [router])

  async function connect() {
    setStatus('connecting')
    setError(null)

    try {
      const authResponse = await loginNesyDashboard(country, environment)
      const nextToken = authResponse.result.payload?.token ?? null
      const nextUser = authResponse.result.payload?.user ?? null

      if (!nextToken) {
        throw new Error('Token not found in Nesy response.')
      }

      const authDash: NesyDashboardAuth = { token: nextToken, country, environment }
      const loginSnap =
        nextUser && typeof nextUser === 'object' && nextUser !== null && !Array.isArray(nextUser)
          ? ({ ...nextUser } as Record<string, unknown>)
          : undefined

      let resolvedSessionMongoId: string | null = null
      try {
        resolvedSessionMongoId = await resolveSessionDashboardUserId(
          authDash,
          loginSnap ?? null,
          nextToken,
        )
      } catch {
        resolvedSessionMongoId = null
      }

      setToken(nextToken)
      setUser(nextUser)
      setSessionUserId(resolvedSessionMongoId)
      setStatus('connected')
      notifyAuthChanged()
      return nextToken
    } catch (connectError) {
      setToken(null)
      setUser(null)
      setSessionUserId(null)
      setStatus('failed')
      clearPersistedState()
      setError(
        connectError instanceof Error ? connectError.message : 'Unknown connection error.',
      )
      notifyAuthChanged()
      return null
    }
  }

  const contextValue = useMemo(
    () => ({
      country,
      environment,
      availableEnvironments,
      status,
      isHydrated,
      token,
      user,
      sessionUserId,
      error,
      setCountry,
      setEnvironment,
      logout,
      connect,
    }),
    [
      country,
      environment,
      availableEnvironments,
      status,
      isHydrated,
      token,
      user,
      sessionUserId,
      error,
      logout,
    ],
  )

  return (
    <NesyAuthContext.Provider value={contextValue}>
      {children}
    </NesyAuthContext.Provider>
  )
}

export function useNesyAuth() {
  const context = useContext(NesyAuthContext)
  if (!context) {
    throw new Error('useNesyAuth must be used within NesyAuthProvider.')
  }
  return context
}

export function useNesyAuthGate() {
  const auth = useNesyAuth()
  const authUiReady = auth.isHydrated
  const isConnected = authUiReady && auth.status === 'connected' && !!auth.token
  return { ...auth, authUiReady, isConnected }
}
