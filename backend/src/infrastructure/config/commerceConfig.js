const commerceConfig=env=>{
  const number=(name,fallback)=>{const n=Number(env[name]??fallback);if(!Number.isSafeInteger(n)||n<0||n>100000000)throw new Error(`${name} debe ser un entero entre 0 y 100000000.`);return n;};
  return {currency:'MXN',country:'MX',shipping_fee_cents:number('SHIPPING_FEE_CENTS',9900),free_shipping_cents:number('FREE_SHIPPING_CENTS',150000),transfer_instructions:env.TRANSFER_INSTRUCTIONS||'',password_recovery_enabled:Boolean(env.RESEND_API_KEY&&env.MAIL_FROM&&env.FRONTEND_ORIGIN),payment_methods:['contra_entrega',...(env.TRANSFER_INSTRUCTIONS?['transferencia']:[])]};
};
module.exports={commerceConfig};
