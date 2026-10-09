export const normalizeImageUrl = (value) => {
  const source = typeof value === 'string' ? value.trim() : ''
  try {
    const url = new URL(source)
    if (/^(www\.)?google\.[a-z.]+$/.test(url.hostname) && url.pathname === '/imgres') {
      const direct = url.searchParams.get('imgurl')
      if (direct && isWebImageUrl(direct)) return direct
    }
  } catch { /* Validation below reports invalid URLs. */ }
  return source
}

export const isWebImageUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
