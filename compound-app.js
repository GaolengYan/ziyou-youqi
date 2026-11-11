import {compound,EXAMPLE} from './compound-model.js';
const form=document.querySelector('#compound-form'), error=document.querySelector('#compound-error');
const money=n=>'¥'+Math.round(n).toLocaleString('zh-CN');
function chart(rows){
 const w=600,h=230,left=68,right=18,top=22,bottom=35;
 const max=Math.max(1,...rows.map(r=>Math.max(r.balance,r.principal)));
 const x=i=>left+(w-left-right)*i/Math.max(1,rows.length-1),y=v=>h-bottom-(h-top-bottom)*v/max;
 const path=key=>rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
 const tick=n=>n>=1e8?(n/1e8).toFixed(1)+'亿':n>=1e4?(n/1e4).toFixed(1)+'万':Math.round(n);
 const grid=[0,.5,1].map(t=>`<line x1="${left}" x2="${w-right}" y1="${y(max*t)}" y2="${y(max*t)}" stroke="#e1e8d6"/><text x="${left-9}" y="${y(max*t)+4}" text-anchor="end" fill="#687e5a" font-size="11">${tick(max*t)}</text>`).join('');
 return `${grid}<path d="${path('principal')}" fill="none" stroke="#9bab85" stroke-width="2" stroke-dasharray="5 5"/><path d="${path('balance')}" fill="none" stroke="#46703f" stroke-width="3" stroke-linejoin="round"/><text x="${left}" y="${h-9}" fill="#687e5a" font-size="11">起点</text><text x="${w-right}" y="${h-9}" text-anchor="end" fill="#687e5a" font-size="11">${rows.at(-1).year} 年</text>`;
}
function update(){
 const data={};let invalid=false;
 for(const key of Object.keys(EXAMPLE)){
   const input=form.elements[key],bad=input.value.trim()===''||!input.validity.valid;
   input.setAttribute('aria-invalid',String(bad));if(bad)invalid=true;data[key]=input.valueAsNumber;
 }
 try{
   if(invalid)throw new RangeError('请填写范围内的数字；持续年数为 0—100 的整数。');
   const r=compound(data);error.hidden=true;
   for(const [id,value] of Object.entries({balance:r.balance,real:r.real,principal:r.principal,gain:r.gain,'fee-difference':r.feeDifference}))document.querySelector('#c-'+id).textContent=money(value);
   document.querySelector('#c-period').textContent=data.years;
   document.querySelector('#compound-rows').innerHTML=r.rows.map(x=>`<tr><th scope="row">${x.year}</th><td>${money(x.principal)}</td><td>${money(x.balance)}</td><td>${money(x.gain)}</td><td>${money(x.real)}</td></tr>`).join('');
   document.querySelector('#compound-chart').innerHTML=chart(r.rows);
   document.querySelector('.compound-results').removeAttribute('aria-disabled');
 }catch(e){
   error.textContent=e.message+' 右侧保留上一次有效结果。';error.hidden=false;
   document.querySelector('.compound-results').setAttribute('aria-disabled','true');
 }
}
form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',update);
document.querySelector('#compound-reset').addEventListener('click',()=>{for(const [k,v]of Object.entries(EXAMPLE))form.elements[k].value=v;update();});
update();
