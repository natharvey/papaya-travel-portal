import { useState, useCallback } from 'react'
import { getStoredToken, getStoredRole, storeToken, clearToken } from '../api/client'

export interface AuthState {
  token: string | null
  userRole: string | null
  isAuthenticated: boolean
  login: (token: string, role: string) => void
  logout: () => void
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [userRole, setUserRole] = useState<string | null>(getStoredRole)

  const login = useCallback((newToken: string, role: string) => {
    storeToken(newToken, role)
    setToken(newToken)
    setUserRole(role)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
    setUserRole(null)
  }, [])

  return {
    token,
    userRole,
    isAuthenticated: !!token,
    login,
    logout,
  }
}
