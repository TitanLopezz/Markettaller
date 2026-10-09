class ResendMailer {
  constructor({apiKey,from}){this.apiKey=apiKey;this.from=from;}
  async send(to,subject,text){
    if(!this.apiKey||!this.from)return false;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:this.from,to:[to],subject,text})});
    if(!response.ok)throw new Error('El proveedor de correo rechazó el mensaje.');
    return true;
  }
}
module.exports={ResendMailer};
