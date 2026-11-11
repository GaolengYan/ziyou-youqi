export const RETIREMENT_EXAMPLE=Object.freeze({initial:1000000,spending:100000,inflation:0,sequence:'-20, 20'});
export function parseReturns(text){
 if(typeof text!=='string'||!text.trim())throw new RangeError('请填写 1—100 个年度回报数字');
 const tokens=text.trim().replaceAll('−','-').split(/[,，;；\s]+/).filter(Boolean);
 if(tokens.length<1||tokens.length>100)throw new RangeError('请填写 1—100 个年度回报数字');
 const values=tokens.map(t=>{
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))throw new RangeError('年度回报请填写数字，不带百分号；使用逗号分隔');
  const v=Number(t);if(!Number.isFinite(v)||v< -100||v>100)throw new RangeError('每个年度回报须在 −100% 至 100% 之间');return v;
 });
 return values;
}
export function retirementPaths(input){
 for(const[key,[min,max]]of Object.entries({initial:[0,1e12],spending:[0,1e12],inflation:[-99,100]}))if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new RangeError(`参数 ${key} 超出范围`);
 const returns=parseReturns(input.sequence);
 function project(sequence){
  let balance=input.initial,paidTotal=0,unmetTotal=0,firstShortfall=null;
  const rows=[{year:0,rate:null,planned:0,paid:0,unmet:0,balance,real:balance}];
  sequence.forEach((rate,index)=>{
   const year=index+1,available=balance*(1+rate/100),planned=input.spending*(1+input.inflation/100)**index;
   const paid=Math.min(available,planned),unmet=Math.max(0,planned-paid);
   balance=Math.max(0,available-paid);paidTotal+=paid;unmetTotal+=unmet;
   if(firstShortfall===null&&unmet>Math.max(1,planned)*Number.EPSILON*32)firstShortfall=year;
   const real=balance/(1+input.inflation/100)**year;
   if(![balance,real,unmetTotal].every(Number.isFinite))throw new RangeError('结果超出可显示范围，请降低参数');
   rows.push({year,rate,planned,paid,unmet,balance,real});
  });
  return{rows,balance,real:rows.at(-1).real,paidTotal,unmetTotal,firstShortfall};
 }
 const a=project(returns),b=project([...returns].reverse());
 return{a,b,years:returns.length,returns,difference:b.balance-a.balance};
}
