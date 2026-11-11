import {retirementPaths,RETIREMENT_EXAMPLE} from './retirement-model.js';
const form=document.querySelector('#retirement-form'),error=document.querySelector('#retirement-error');
const money=n=>'¥'+Math.round(n).toLocaleString('zh-CN');
function chart(r){
 const w=600,h=240,left=64,right=18,top=22,bottom=35,max=Math.max(1,...r.a.rows.map(x=>x.balance),...r.b.rows.map(x=>x.balance));
 const x=i=>left+(w-left-right)*i/r.years,y=v=>h-bottom-(h-top-bottom)*v/max;
 const path=p=>p.rows.map((row,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(row.balance).toFixed(2)}`).join(' ');
 const tick=n=>n>=1e8?(n/1e8).toFixed(1)+'亿':n>=1e4?(n/1e4).toFixed(1)+'万':Math.round(n);
 return [0,.5,1].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(max*t)}" y2="${y(max*t)}" stroke="#dfe6d5"/><text x="${left-9}" y="${y(max*t)+4}" text-anchor="end" fill="#657957" font-size="11">${tick(max*t)}</text>`).join('')+`<path d="${path(r.a)}" stroke="#3e6b3c" fill="none" stroke-width="3"/><path d="${path(r.b)}" stroke="#ae7b45" fill="none" stroke-width="3" stroke-dasharray="6 4"/><text x="${left}" y="${h-10}" font-size="11" fill="#657957">起点</text><text x="${w-right}" y="${h-10}" text-anchor="end" font-size="11" fill="#657957">${r.years} 年</text>`;
}
function update(){
 try{
  const input={sequence:form.elements.sequence.value};
  for(const k of ['initial','spending','inflation']){const el=form.elements[k],bad=el.value.trim()===''||!el.validity.valid;el.setAttribute('aria-invalid',String(bad));if(bad)throw new RangeError('请填写范围内的数字');input[k]=el.valueAsNumber;}
  const r=retirementPaths(input);error.hidden=true;form.elements.sequence.removeAttribute('aria-invalid');
  document.querySelector('#r-years').textContent=r.years;document.querySelector('#r-difference').textContent=money(r.difference);
  for(const key of ['a','b']){const p=r[key];document.querySelector(`#r-${key}-balance`).textContent=money(p.balance);document.querySelector(`#r-${key}-real`).textContent=money(p.real);document.querySelector(`#r-${key}-status`).textContent=p.firstShortfall===null?'本实验内未出现支出缺口':`第 ${p.firstShortfall} 年起出现支出缺口；见下方逐年明细`;
   document.querySelector(`#r-${key}-status`).classList.toggle('has-shortfall',p.firstShortfall!==null);
  }
  document.querySelector('#retirement-chart').innerHTML=chart(r);
  document.querySelector('#retirement-rows').innerHTML=r.a.rows.slice(1).map((a,i)=>[a,r.b.rows[i+1]].map((x,j)=>`<tr><th scope="row">${x.year} / ${j?'B':'A'}</th><td>${x.rate}%</td><td>${money(x.planned)}</td><td>${money(x.paid)}</td><td>${money(x.balance)}</td><td>${money(x.unmet)}</td></tr>`).join('')).join('');
  document.querySelector('.retirement-results').removeAttribute('aria-disabled');
 }catch(e){error.textContent=e.message+'。右侧保留上一次有效结果。';error.hidden=false;document.querySelector('.retirement-results').setAttribute('aria-disabled','true');}
}
form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',update);
document.querySelector('#retirement-reset').addEventListener('click',()=>{for(const[k,v]of Object.entries(RETIREMENT_EXAMPLE))form.elements[k].value=v;update();});update();
