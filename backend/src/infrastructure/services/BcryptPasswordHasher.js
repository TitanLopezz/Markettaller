const bcrypt=require('bcryptjs');
class BcryptPasswordHasher {
  hash(value){return bcrypt.hash(value,12);}
  compare(value,hash){return bcrypt.compare(value,hash);}
}
module.exports={BcryptPasswordHasher};
