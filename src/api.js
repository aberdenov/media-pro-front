const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Не удалось загрузить данные. Попробуйте ещё раз.')
  return data
}
