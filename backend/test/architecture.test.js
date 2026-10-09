const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../src');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]).filter(p=>p.endsWith('.js'));
test('domain and application cannot import frameworks, adapters, configuration or bootstrap',()=>{
  for(const layer of ['domain','application'])for(const file of files(path.join(root,layer))){
    const source=fs.readFileSync(file,'utf8');
    for(const [,dependency] of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){
      assert.ok(dependency.startsWith('.'),`${file}: external dependency ${dependency}`);
      const target=path.resolve(path.dirname(file),dependency);
      assert.ok(target.startsWith(path.join(root,'domain')+path.sep)||(layer==='application'&&target.startsWith(path.join(root,'application')+path.sep)),`${file}: invalid dependency ${dependency}`);
    }
    assert.doesNotMatch(source,/process\.env|\bBuffer\b|\bfetch\s*\(|\.execute\s*\(|\.query\s*\(|\bER_(?:DUP|ROW|NO_)|\.statusCode\b/,file);
  }
});
test('persistence adapters never import use cases or construct HTTP errors',()=>{
  for(const file of files(path.join(root,'infrastructure/repositories'))){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/require\(['"][^'"]*(?:application|bootstrap)|statusCode/,file);}
});
test('port contracts are satisfied by the concrete repository adapters',()=>{
  const {assertPort}=require('../src/application/ports/contracts');
  for(const [port,moduleName] of [['UserRepository','MySQLUserRepository'],['ProductRepository','MySQLProductRepository'],['ProviderOrderRepository','MySQLOrderRepository'],['ProductRequestRepository','MySQLProductRequestRepository'],['CommerceRepository','MySQLCommerceRepository']]){
    const Adapter=require(`../src/infrastructure/repositories/${moduleName}`)[moduleName];
    assert.equal(assertPort(port,new Adapter({})).constructor,Adapter);
  }
});
