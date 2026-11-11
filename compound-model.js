export const EXAMPLE = Object.freeze({initial: 10000, monthly: 1000, years: 20, returns: 5, inflation: 2, fee: 0});
export function compound(input) {
  const limits = {initial:[0,1e12],monthly:[0,1e9],years:[0,100],returns:[-99,100],inflation:[-99,100],fee:[0,10]};
  for (const [key,[min,max]] of Object.entries(limits)) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key]<min || input[key]>max) throw new RangeError(`参数 ${key} 超出范围`);
  }
  if (!Number.isInteger(input.years)) throw new RangeError('年数需要为整数');
  const gross=1+input.returns/100, net=gross*(1-input.fee/100);
  const factor=net**(1/12), grossFactor=gross**(1/12);
  let balance=input.initial, noFee=input.initial;
  const rows=[{year:0,balance,principal:input.initial,real:input.initial,gain:0}];
  for(let month=1;month<=input.years*12;month++) {
    balance=balance*factor+input.monthly;
    noFee=noFee*grossFactor+input.monthly;
    if(month%12===0) {
      const year=month/12, principal=input.initial+month*input.monthly;
      rows.push({year,balance,principal,real:balance/(1+input.inflation/100)**year,gain:balance-principal});
    }
  }
  if(!Number.isFinite(balance) || !Number.isFinite(rows.at(-1).real)) throw new RangeError('结果超出可显示范围，请降低参数');
  return {...rows.at(-1),noFee,feeDifference:noFee-balance,netRate:(net-1)*100,rows};
}
