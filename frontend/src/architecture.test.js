import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.dirname(fileURLToPath(import.meta.url))
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]).filter(p=>p.endsWith('.js'))
test('frontend core has no React, browser, HTTP or adapter dependencies',()=>{
  for(const layer of ['domain','application'])for(const file of files(path.join(root,layer))){
    const source=fs.readFileSync(file,'utf8')
    assert.doesNotMatch(source,/\b(?:window|document|localStorage|sessionStorage|fetch|Image)\b/,file)
    for(const [,dependency] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      const target=path.resolve(path.dirname(file),dependency)
      assert.ok(target.startsWith(path.join(root,'domain')+path.sep)||(layer==='application'&&target.startsWith(path.join(root,'application')+path.sep)),`${file}: ${dependency}`)
    }
  }
})
test('React screens call application services and contain no direct HTTP or storage access',()=>{
  for(const file of fs.readdirSync(path.join(root,'presentation')).filter(f=>f.endsWith('.jsx'))){const s=fs.readFileSync(path.join(root,'presentation',file),'utf8');assert.doesNotMatch(s,/\bfetch\s*\(|\b(?:localStorage|sessionStorage)\b|\/api\//,file)}
})
