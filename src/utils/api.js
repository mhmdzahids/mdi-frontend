/**
 * Helper fetch dengan header khusus untuk tunneling Ngrok & Autentikasi API
 * Menyertakan X-API-Key dan Bearer Token secara otomatis.
 */

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

  return fetch(url, {
    ...options,
    headers: mergedHeaders
  })
}
