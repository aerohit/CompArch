/* Course notes — shared helpers: theme, table of contents, scroll spy, SVG helpers */
(function(){
  const root=document.documentElement;
  try{const t=localStorage.getItem('notes-theme');if(t)root.setAttribute('data-theme',t);}catch(e){}
  window.NOTES={
    RM: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
    $: s=>document.querySelector(s),
    $$: s=>[...document.querySelectorAll(s)],
    esc: s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    hex: (v,w=2)=>'0x'+(v>>>0).toString(16).toUpperCase().padStart(w,'0'),
    bin: (v,w=8)=>(v>>>0).toString(2).padStart(w,'0').slice(-w)
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.querySelector('.themebtn');
    if(btn){
      const label=()=>{const d=root.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');btn.textContent=d==='dark'?'☀ Light':'☾ Dark';};
      label();
      btn.addEventListener('click',()=>{const cur=root.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');const n=cur==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('notes-theme',n);}catch(e){}label();});
    }
    const toc=document.querySelector('.toc');
    if(toc){
      const items=[...document.querySelectorAll('main [data-toc]')];
      toc.innerHTML='<p class="tl">On this page</p>'+items.map(s=>`<a href="#${s.id}" data-id="${s.id}"><span>${s.dataset.n||'·'}</span>${s.dataset.toc}</a>`).join('');
      const links=[...toc.querySelectorAll('a')];let ticking=false;
      const spy=()=>{ticking=false;const y=window.innerHeight*0.25;let cur=items[0];
        for(const s of items){if(s.getBoundingClientRect().top<=y)cur=s;else break;}
        links.forEach(a=>a.classList.toggle('on',cur&&a.dataset.id===cur.id));};
      window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(spy);}},{passive:true});
      spy();
    }
  });
})();
