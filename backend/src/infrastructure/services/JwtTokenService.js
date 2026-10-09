const jwt=require('jsonwebtoken');
class JwtTokenService {
  constructor(secret){this.secret=secret;}
  sign(payload){return jwt.sign(payload,this.secret,{expiresIn:'1h'});}
  verify(token){return jwt.verify(token,this.secret);}
}
module.exports={JwtTokenService};
