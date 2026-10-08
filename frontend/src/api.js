const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')

export const USERS_API_URL = `${API_ORIGIN}/api/users`
export const PRODUCTS_API_URL = `${API_ORIGIN}/api/products`
export const ORDERS_API_URL = `${API_ORIGIN}/api/orders`
