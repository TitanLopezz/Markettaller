const statusFor = error => ({VALIDATION:400,UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404,CONFLICT:409,UNAVAILABLE:503}[error.code] || 500);
const handleError = (res,error) => {
  const status=statusFor(error);
  return res.status(status).json({message:status===500?'Error interno del servidor.':error.message});
};
module.exports={statusFor,handleError};
