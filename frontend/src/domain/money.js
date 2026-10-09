export const money=cents=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(cents)/100)
