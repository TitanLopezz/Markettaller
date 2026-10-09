const {Pool,types}=require('pg');
types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Entero fuera del rango seguro');return n;});
const createPostgresPool=(env=process.env)=>{
 const missing=['DB_HOST','DB_USER','DB_NAME','JWT_SECRET'].filter(k=>!env[k]);
 if(missing.length)throw Error('Faltan variables de entorno: '+missing.join(', '));
 return new Pool({host:env.DB_HOST,port:Number(env.DB_PORT||5432),user:env.DB_USER,password:env.DB_PASSWORD||'',database:env.DB_NAME,max:10});
};
module.exports={createPostgresPool};
