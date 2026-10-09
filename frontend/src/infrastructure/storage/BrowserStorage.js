export class BrowserStorage {
  constructor(kind){this.kind=kind}
  getItem(key){return globalThis[this.kind].getItem(key)}
  setItem(key,value){return globalThis[this.kind].setItem(key,value)}
  removeItem(key){return globalThis[this.kind].removeItem(key)}
}
