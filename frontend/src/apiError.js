const API_CONNECTION_ERROR = 'No se pudo conectar con la API local. Inicia la tarea "Start local app" en VS Code y vuelve a intentar.'

export const getApiErrorMessage = (error, fallback) => (
  error instanceof TypeError ? API_CONNECTION_ERROR : error?.message || fallback
)