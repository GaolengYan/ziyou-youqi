export const GOAL_EXAMPLE=Object.freeze({initial:100000,target:1000000,years:20,returns:5,inflation:2,fee:0,basis:'today'});
export function savingsGoal(input){
 const limits={initial:[0,1e12],target:[.01,1e12],years:[0,100],returns:[-99,100],inflation:[-99,100],fee:[0,10]};
 for(const [key,[min,max]] of Object.entries(limits))if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new RangeError(`参数 ${key} 超出范围`);
 if(!Number.isInteger(input.years))throw new RangeError('年数需要为整数');
 if(!['today','future'].includes(input.basis))throw new RangeError('请选择目标的价格口径');
 const targetNominal=input.target*(input.basis==='today'?(1+input.inflation/100)**input.years:1);
 const months=input.years*12,net=(1+input.returns/100)*(1-input.fee/100),factor=net**(1/12);
 let growth=1,annuity=0;
 const checkpoints=[{year:0,growth,annuity}];
 for(let m=1;m<=months;m++){growth*=factor;annuity=annuity*factor+1;if(m%12===0)checkpoints.push({year:m/12,growth,annuity});}
 const withoutContributions=input.initial*growth;
 const gap=Math.max(0,targetNominal-withoutContributions);
 const tolerance=Math.max(1,targetNominal)*Number.EPSILON*32;
 const status=months===0&&gap>tolerance?'immediate-shortfall':gap<=tolerance?'covered':'contribute';
 const rawMonthly=months===0?0:Math.max(0,gap/annuity);
 // Whole-yuan upward rounding avoids displaying a monthly amount below the computed need.
 const monthly=status==='contribute'?Math.ceil(rawMonthly):0;
 const rows=checkpoints.map(c=>{const balance=input.initial*c.growth+monthly*c.annuity,principal=input.initial+c.year*12*monthly;return{year:c.year,balance,principal,gain:balance-principal,real:balance/(1+input.inflation/100)**c.year};});
 const final=rows.at(-1);
 if(![targetNominal,rawMonthly,monthly,final.balance,final.real].every(Number.isFinite))throw new RangeError('结果超出可显示范围，请降低参数');
 return{status,targetNominal,targetReal:targetNominal/(1+input.inflation/100)**input.years,withoutContributions,gap,rawMonthly,monthly,netRate:(net-1)*100,rows,...final};
}
