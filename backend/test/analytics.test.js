const test = require('node:test');
const assert = require('node:assert/strict');
const {AnalyticsService} = require('../src/application/use-cases/AnalyticsService');
const service = new AnalyticsService({dashboard:async filter=>({filter})},()=>new Date('2026-10-10T15:00:00Z'));
test('weekly uses seven inclusive calendar days, monthly begins on the first',async()=>{
  const weekly=await service.dashboard();
  assert.equal(weekly.filter.start,'2026-10-04T00:00:00.000Z');
  assert.equal(weekly.filter.end,'2026-10-11T00:00:00.000Z');
  assert.equal((await service.dashboard({period:'monthly'})).filter.start,'2026-10-01T00:00:00.000Z');
});
test('custom includes the entire final day, including leap dates',async()=>{
  const result=await service.dashboard({period:'custom',startDate:'2024-02-29',endDate:'2024-02-29',top:'10'});
  assert.equal(result.filter.end,'2024-03-01T00:00:00.000Z');assert.equal(result.filter.top,10);
});
test('invalid, missing, reversed and excessive dates fail before persistence',async()=>{
  for(const input of [{period:'yearly'},{top:'100'},{period:'custom'},{startDate:'2026-02-30',endDate:'2026-03-01'},{startDate:'2026-10-11',endDate:'2026-10-10'},{startDate:'2020-01-01',endDate:'2026-01-01'},{period:['weekly']}]){
    await assert.rejects(service.dashboard(input),{code:'VALIDATION'});
  }
});
test('HTTP rejects unauthenticated and non-admin requests',async t=>{
  const jwt=require('jsonwebtoken');
  const {createApp}=require('../src/infrastructure/http/app');
  const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='analytics-test-secret';
  const server=createApp({analytics:service}).listen(0);
  t.after(()=>{server.close();if(previous===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous});
  await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/analytics/dashboard`;
  assert.equal((await fetch(url)).status,401);
  const token=role=>jwt.sign({sub:'1',role},process.env.JWT_SECRET);
  assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token('cliente')}`}})).status,403);
  assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token('super_admin')}`}})).status,200);
});
