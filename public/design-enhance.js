/* ReytUp signature interactions — lightweight, dependency-free. */
(function(){
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=window.matchMedia('(pointer:fine)').matches;

  function addScrollProgress(){
    if(document.querySelector('.sig-scroll-progress')) return;
    const bar=document.createElement('div');
    bar.className='sig-scroll-progress';
    document.body.appendChild(bar);
    const update=()=>{
      const max=document.documentElement.scrollHeight-window.innerHeight;
      bar.style.transform=`scaleX(${max>0 ? Math.min(1,window.scrollY/max) : 0})`;
    };
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update,{passive:true});
    update();
  }

  function addMagnetism(){
    if(reduce || !fine) return;
    const els=document.querySelectorAll('.btn-primary,.nav-cta-btn,.hero-badge');
    els.forEach(el=>{
      if(el.dataset.magneticBound) return;
      el.dataset.magneticBound='1';
      el.addEventListener('pointermove',e=>{
        const r=el.getBoundingClientRect();
        const x=(e.clientX-(r.left+r.width/2))/r.width;
        const y=(e.clientY-(r.top+r.height/2))/r.height;
        el.style.transform=`translate3d(${x*6}px,${y*5}px,0)`;
      });
      el.addEventListener('pointerleave',()=>{el.style.transform='';});
    });
  }

  function addTiltAndGlow(){
    if(reduce || !fine) return;
    const glow=document.createElement('div');
    glow.className='premium-pointer-glow';
    document.body.appendChild(glow);
    let raf=0,x=0,y=0;
    document.addEventListener('pointermove',e=>{
      x=e.clientX;y=e.clientY;
      if(raf) return;
      raf=requestAnimationFrame(()=>{
        glow.style.transform=`translate3d(${x-180}px,${y-180}px,0)`;
        document.documentElement.style.setProperty('--cursor-x',`${x}px`);
        document.documentElement.style.setProperty('--cursor-y',`${y}px`);
        raf=0;
      });
    },{passive:true});

    const cards=document.querySelectorAll('.feature-card,.btype-card,.dna-dimension,.breakdown-item,.pricing-card,.battle-location-card');
    cards.forEach(card=>{
      card.addEventListener('pointermove',e=>{
        const r=card.getBoundingClientRect();
        card.style.setProperty('--tilt-x',`${((e.clientY-r.top)/r.height-.5)*-2.1}deg`);
        card.style.setProperty('--tilt-y',`${((e.clientX-r.left)/r.width-.5)*2.1}deg`);
      });
      card.addEventListener('pointerleave',()=>{
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
      });
    });
  }

  function addActiveNav(){
    const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    document.querySelectorAll('.nav-link,.nav-drawer-item').forEach(a=>{
      const href=(a.getAttribute('href')||'').split('/').pop().split('?')[0].toLowerCase();
      if(href && href===file) a.classList.add('active');
    });
  }

  function addReveal(){
    if(reduce || !('IntersectionObserver' in window)) return;
    const items=[...document.querySelectorAll('.reveal, .feature-card, .how-step, .pricing-card, .about-principle, .breakdown-item, .location-dna-section, .whatif-results, .ai-answer')];
    items.forEach((el,i)=>{
      if(el.dataset.sigReveal) return;
      el.dataset.sigReveal='1';
      el.style.setProperty('--sig-delay',`${Math.min(i%7,6)*55}ms`);
      if(!el.classList.contains('reveal')) el.classList.add('sig-reveal');
    });
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('sig-in');io.unobserve(entry.target);}})
    },{threshold:.08,rootMargin:'0px 0px -35px'});
    items.forEach(el=>io.observe(el));
  }


  function boot(){
    addScrollProgress();
    addActiveNav();
    addReveal();
    addMagnetism();
    addTiltAndGlow();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
