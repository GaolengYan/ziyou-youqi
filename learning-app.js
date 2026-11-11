const search=document.querySelector('#lesson-search'),category=document.querySelector('#lesson-category'),cards=[...document.querySelectorAll('.lesson-list>.lesson-card')],count=document.querySelector('#lesson-count'),empty=document.querySelector('#lesson-empty');
function filter(){
 const query=search.value.trim().toLocaleLowerCase('zh-CN'),group=category.value;let total=0;
 for(const card of cards){const text=card.querySelector('h3').textContent+' '+card.querySelector('p').textContent;const match=(!query||text.toLocaleLowerCase('zh-CN').includes(query))&&(!group||card.querySelector('.lesson-category').textContent===group);card.hidden=!match;if(match)total++;}
 for(const section of document.querySelectorAll('.lesson-group'))section.hidden=![...section.querySelectorAll('.lesson-card')].some(card=>!card.hidden);
 count.textContent=`显示 ${total} / ${cards.length} 篇文章`;empty.hidden=total!==0;
}
search.addEventListener('input',filter);category.addEventListener('change',filter);
document.querySelector('#lesson-filter-reset').addEventListener('click',()=>{search.value='';category.value='';filter();search.focus();});
document.querySelector('#lesson-filter').hidden=false;filter();
for(const link of document.querySelectorAll('.path-grid a'))link.addEventListener('click',()=>{const section=document.querySelector(link.getAttribute('href'));search.value='';category.value=section.querySelector('h2').textContent;filter();});
