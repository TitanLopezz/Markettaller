export class BrowserImageLoader {load(source){return new Promise((resolve,reject)=>{
const image = new Image()
  image.referrerPolicy = 'no-referrer'
  const finish = (error) => {
    clearTimeout(timer)
    image.onload = null
    image.onerror = null
    if (error) reject(error)
    else resolve(source)
  }
  const timer = setTimeout(() => finish(new Error('La imagen tardó demasiado en cargar. Prueba otro enlace directo.')), 10000)
  image.onload = () => finish(image.naturalWidth > 0 ? null : new Error('El enlace no contiene una imagen válida.'))
  image.onerror = () => finish(new Error('No se pudo cargar la imagen. Usa el enlace directo de la foto, no el de una página o búsqueda.'))
  image.src = source

})}}
