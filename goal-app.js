import {savingsGoal,GOAL_EXAMPLE} from './goal-model.js';
const form=document.querySelector('#goal-form'),error=document.querySelector('#goal-error');
const money=n=>'¥'+Math.round(n).toLocaleString('zh-CN');
function update(){
 const input={basis:form.elements.basis.value};let invalid=false;
 for(const key of Object.keys(GOAL_EXAMPLE).filter(k=>k!=='basis')){const el=form.elements[key],bad=el.value.trim()===''||!el.validity.valid;el.setAttribute('aria-invalid',String(bad));invalid||=bad;input[key]=el.valueAsNumber;}
 try{
  if(invalid)throw new RangeError('请填写范围内的数字；年数为 0—100 的整数。');
  const r=savingsGoal(input),immediate=r.status==='immediate-shortfall';
  error.hidden=true;
  document.querySelector('#g-result-label').textContent=immediate?'需立即补足的金额':'每月末需要投入 / 向上取整到元';
  document.querySelector('#g-monthly').textContent=money(immediate?r.gap:r.monthly);
  document.querySelector('#g-status-copy').textContent=immediate?'期限为零，无法安排分月投入。':r.status==='covered'?'在当前固定假设下，无需新增投入即可覆盖期末目标。':`在固定假设下，持续投入 ${input.years} 年。`;
  for(const[id,value]of Object.entries({nominal:r.targetNominal,'real-target':r.targetReal,principal:r.principal,gain:r.gain,balance:r.balance}))document.querySelector('#g-'+id).textContent=money(value);
  document.querySelector('#goal-rows').innerHTML=r.rows.map(x=>`<tr><th scope="row">${x.year}</th><td>${money(x.principal)}</td><td>${money(x.balance)}</td><td>${money(x.real)}</td></tr>`).join('');
  document.querySelector('.goal-results').removeAttribute('aria-disabled');
 }catch(e){error.textContent=e.message+' 右侧保留上一次有效结果。';error.hidden=false;document.querySelector('.goal-results').setAttribute('aria-disabled','true');}
}
form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',update);
document.querySelector('#goal-reset').addEventListener('click',()=>{for(const[k,v]of Object.entries(GOAL_EXAMPLE)){if(k==='basis'){form.querySelector(`input[name="basis"][value="${v}"]`).checked=true;}else form.elements[k].value=v;}update();});
update();
