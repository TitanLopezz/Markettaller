const {createHash,randomBytes}=require('node:crypto');
class NodeCryptoService {
  hash(value){return createHash('sha256').update(value).digest('hex');}
  randomToken(){return randomBytes(32).toString('hex');}
  byteLength(value){return Buffer.byteLength(value,'utf8');}
}
module.exports={NodeCryptoService};
