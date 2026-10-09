import {FetchGateway} from '../infrastructure/http/FetchGateway.js'
import {ShopGateway} from '../infrastructure/http/ShopGateway.js'
import {PortalGateway} from '../infrastructure/http/PortalGateway.js'
import {BrowserStorage} from '../infrastructure/storage/BrowserStorage.js'
import {createStore} from '../application/store.js'
import {createPortal} from '../application/portal.js'
export const session=new BrowserStorage('sessionStorage')
const http=new FetchGateway()
export const store=createStore({gateway:new ShopGateway(http),cartStorage:new BrowserStorage('localStorage'),requestStorage:session,idGenerator:{next:()=>crypto.randomUUID()}})
export const portal=createPortal(new PortalGateway(http))

import {BrowserImageLoader} from '../infrastructure/browser/BrowserImageLoader.js'
import {createValidateImage} from '../application/validateImage.js'
export const validateImageUrl=createValidateImage(new BrowserImageLoader())
