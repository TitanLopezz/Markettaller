const {fail}=require('../../domain/errors');
const translatePersistenceError=error=>{
  const codes={ER_DUP_ENTRY:'DUPLICATE',ER_ROW_IS_REFERENCED_2:'REFERENCED',ER_NO_REFERENCED_ROW_2:'MISSING_REFERENCE'};
  return codes[error.code]?fail('No se pudo persistir la operación.',codes[error.code]):error;
};
const execute=async(connection,sql,params=[])=>{
  try{return await connection.execute(sql,params);}catch(error){throw translatePersistenceError(error);}
};
module.exports={translatePersistenceError,execute};
