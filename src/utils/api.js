/**
 * Helper fetch dengan header khusus untuk tunneling Ngrok & Autentikasi API
 * Menyertakan X-API-Key dan Bearer Token secara otomatis.
 * Dilengkapi Global Request Tracker untuk memicu TopProgressBar.
 */

let activeRequestsCount = 0
const listeners = new Set()

export function subscribeToLoading(listener) {
  listeners.add(listener)
  try {
    listener(activeRequestsCount > 0, activeRequestsCount)
  } catch (err) {
    console.error('Error in loading listener:', err)
  }
  return () => listeners.delete(listener)
}

function notifyListeners() {
  const isLoading = activeRequestsCount > 0
  listeners.forEach((fn) => {
    try {
      fn(isLoading, activeRequestsCount)
    } catch (err) {
      console.error('Error in loading listener:', err)
    }
  })
}

export function getActiveRequestsCount() {
  return activeRequestsCount
}

export function getStoredToken() {
  try {
    const raw = localStorage.getItem('mdi_production1_storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed.state?.authToken || null
    }
  } catch {
    // Abaikan jika localStorage tidak dapat diakses
  }
  return null
}

export async function apiFetch(url, options = {}) {
  const isSilent = Boolean(options.silent)
  if (!isSilent) {
    activeRequestsCount++
    notifyListeners()
  }

  const token = getStoredToken()
  const defaultHeaders = {
    'ngrok-skip-browser-warning': 'true',
    'Accept': 'application/json',
  }

  // Hanya sematkan X-API-Key jika dikonfigurasi secara eksplisit (mis. external integration)
  if (import.meta.env.VITE_API_KEY) {
    defaultHeaders['X-API-Key'] = import.meta.env.VITE_API_KEY
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  if (options.body && typeof options.body === 'string') {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  const mergedHeaders = {
    ...defaultHeaders,
    ...(options.headers || {})
  }

  const nativeOptions = { ...options }
  delete nativeOptions.silent

  try {
    return await fetch(url, {
      ...nativeOptions,
      headers: mergedHeaders
    })
  } finally {
    if (!isSilent) {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1)
      notifyListeners()
    }
  }
}

export async function apiGet(url, options = {}) {
  const prefix = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : `/${url}`}`
  const res = await apiFetch(prefix, { ...options, method: 'GET' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed with status ${res.status}`)
  }
  return await res.json()
}

export async function apiPost(url, data, options = {}) {
  const prefix = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : `/${url}`}`
  const res = await apiFetch(prefix, {
    ...options,
    method: 'POST',
    body: data !== undefined ? JSON.stringify(data) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed with status ${res.status}`)
  }
  return await res.json()
}

export async function apiPut(url, data, options = {}) {
  const prefix = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : `/${url}`}`
  const res = await apiFetch(prefix, {
    ...options,
    method: 'PUT',
    body: data !== undefined ? JSON.stringify(data) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed with status ${res.status}`)
  }
  return await res.json()
}

export async function apiDelete(url, options = {}) {
  const prefix = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : `/${url}`}`
  const res = await apiFetch(prefix, { ...options, method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed with status ${res.status}`)
  }
  return await res.json()
}

export async function apiUpload(url, formData, options = {}) {
  const prefix = url.startsWith('/api/v1') ? url : `/api/v1${url.startsWith('/') ? url : `/${url}`}`
  const res = await apiFetch(prefix, {
    ...options,
    method: 'POST',
    body: formData
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Upload gagal: ${res.status}`)
  }
  return await res.json()
}
