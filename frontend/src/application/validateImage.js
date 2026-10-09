import {normalizeImageUrl,isWebImageUrl} from '../domain/imageUrl.js'
export const createValidateImage=imageLoader=>async value=>{
  const source=normalizeImageUrl(value)
  if(!source)return ''
  if(!isWebImageUrl(source))throw new Error('La URL de imagen debe usar HTTP o HTTPS.')
  await imageLoader.load(source)
  return source
}
