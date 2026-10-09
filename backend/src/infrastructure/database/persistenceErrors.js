const {fail}=require('../../domain/errors');
const translatePersistenceError=(error,sql='')=>{
 const code=error.code==='23505'?'DUPLICATE':error.code==='23503'?(/^\s*DELETE/i.test(sql)?'REFERENCED':'MISSING_REFERENCE'):null;
 return code?fail('No se pudo persistir la operación.',code):error;
};
const execute=async(connection,sql,params=[])=>{
 try{const result=await connection.query(sql,params);return [result.command==='SELECT'?result.rows:{insertId:result.rows[0]?.id,affectedRows:result.rowCount}];}
 catch(error){throw translatePersistenceError(error,sql);}
};
module.exports={translatePersistenceError,execute};
