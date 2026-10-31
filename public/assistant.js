/* ReytUp AI co-pilot — context-aware, same-origin API, session-only transcript. */
(function(){
  'use strict';
  const copy={
    az:{title:'ReytUp köməkçisi',online:'Lokasiya analitiki',welcome:'Salam! Mən ReytUp köməkçisiyəm. Son lokasiya analizini izah edə, rəqabət siqnallarını şərh edə və növbəti yoxlamaları planlaşdıra bilərəm.',login:'Söhbətə başlamaq üçün əvvəlcə hesabınıza daxil olun.',notConfigured:'AI köməkçisi hələ aktivləşdirilməyib. Layihənin .env faylında GROQ_API_KEY əlavə edildikdən sonra burada işləyəcək.',noContext:'Hələ hesabınızda analiz yoxdur. Əvvəlcə bir lokasiyanı analiz edin, sonra nəticə barədə sual verə bilərsiniz.',placeholder:'Lokasiya haqqında sualınızı yazın...',send:'Göndər',thinking:'Məlumatları yoxlayıram…',error:'Cavab almaq mümkün olmadı. Bir az sonra yenidən yoxlayın.',limit:'Gündəlik AI sorğu limitiniz tamamlanıb.',foot:'Cavablar yalnız mövcud analiz məlumatlarına əsaslanır.',suggest:['Bu skoru izah et','Əsas risklər hansılardır?','Növbəti nəyi yoxlamalıyam?']},
    en:{title:'ReytUp assistant',online:'Location analyst',welcome:'Hello! I’m your ReytUp co-pilot. I can explain your latest location analysis, interpret competition signals, and suggest what to validate next.',login:'Sign in to your account to start a conversation.',notConfigured:'The AI assistant is not configured yet. Add GROQ_API_KEY to your .env file to enable it.',noContext:'There are no saved analyses in your account yet. Analyze a location first, then ask about the result.',placeholder:'Ask about a location...',send:'Send',thinking:'Checking the analysis…',error:'Could not get a response. Please try again.',limit:'Your daily AI request limit has been reached.',foot:'Answers are grounded in the available analysis data.',suggest:['Explain this score','What are the main risks?','What should I validate next?']},
    ru:{title:'Помощник ReytUp',online:'Аналитик локаций',welcome:'Здравствуйте! Я помощник ReytUp. Я могу объяснить последний анализ локации, интерпретировать сигналы конкуренции и предложить следующие проверки.',login:'Войдите в аккаунт, чтобы начать диалог.',notConfigured:'ИИ-помощник ещё не настроен. Добавьте GROQ_API_KEY в файл .env.',noContext:'В аккаунте пока нет сохранённых анализов. Сначала проанализируйте локацию.',placeholder:'Задайте вопрос о локации...',send:'Отправить',thinking:'Проверяю данные…',error:'Не удалось получить ответ. Попробуйте позже.',limit:'Достигнут дневной лимит запросов к ИИ.',foot:'Ответы основаны только на доступных данных анализа.',suggest:['Объясни эту оценку','Какие главные риски?','Что проверить дальше?']}
  };
  let context=null, busy=false, opened=false;
  function lang(){return window.i18n?.getLang?.()||'az'}
  function words(){return copy[lang()]||copy.az}
  function token(){try{return localStorage.getItem('reytup_token')||localStorage.getItem('token')||''}catch{return ''}}
  function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
  function build(){
    if(document.getElementById('reytup-assistant-panel'))return;
    const trigger=node('button','reytup-assistant-trigger','✳');trigger.type='button';trigger.setAttribute('aria-label','Open ReytUp assistant');trigger.innerHTML='✳<span></span>';
    const panel=node('section','reytup-assistant-panel');panel.id='reytup-assistant-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','ReytUp assistant');
    const head=node('header','assistant-head');const avatar=node('div','assistant-avatar','✳');const meta=node('div','assistant-head-meta');meta.append(node('strong','',words().title));const status=node('small','');const dot=node('i','online-dot');status.append(dot,document.createTextNode(words().online));meta.append(status);const close=node('button','assistant-close','×');close.type='button';close.setAttribute('aria-label','Close assistant');head.append(avatar,meta,close);
    const messages=node('div','assistant-messages');messages.id='assistant-messages';
    const suggestions=node('div','assistant-suggestions');suggestions.id='assistant-suggestions';
    const form=node('form','assistant-compose');const input=node('textarea','');input.id='assistant-input';input.rows=1;input.maxLength=1000;input.placeholder=words().placeholder;input.setAttribute('aria-label',words().placeholder);
    const send=node('button','assistant-send','↗');send.type='submit';send.setAttribute('aria-label',words().send);form.append(input,send);
    const foot=node('div','assistant-footnote',words().foot);
    panel.append(head,messages,suggestions,form,foot);document.body.append(trigger,panel);
    trigger.addEventListener('click',()=>toggle(!panel.classList.contains('open')));close.addEventListener('click',()=>toggle(false));
    form.addEventListener('submit',e=>{e.preventDefault();submit(input,send)});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
    document.querySelectorAll('[data-open-assistant]').forEach(el=>el.addEventListener('click',()=>toggle(true)));
    document.addEventListener('langchange',refresh);
    refresh();
  }
  function addMessage(message,role='bot'){
    const box=document.getElementById('assistant-messages');if(!box)return;
    const el=node('div',`assistant-message ${role}`,message);box.append(el);box.scrollTop=box.scrollHeight;return el;
  }
  function refresh(){
    const w=words();const panel=document.getElementById('reytup-assistant-panel');if(!panel)return;
    panel.querySelector('.assistant-head-meta strong').textContent=w.title;panel.querySelector('.assistant-head-meta small').lastChild.textContent=w.online;
    const input=document.getElementById('assistant-input');input.placeholder=w.placeholder;
    panel.querySelector('.assistant-footnote').textContent=w.foot;
    const sugg=document.getElementById('assistant-suggestions');sugg.replaceChildren();w.suggest.forEach(label=>{const b=node('button','',label);b.type='button';b.addEventListener('click',()=>{input.value=label;input.focus()});sugg.append(b)});
    if(!opened && !document.getElementById('assistant-welcome')){const welcome=addMessage(w.welcome);if(welcome)welcome.id='assistant-welcome'}
  }
  async function loadContext(){
    if(!token()){context={loggedOut:true};addMessage(words().login);return}
    try{context=await window.ReytUp.api('/api/assistant/context')}
    catch(e){context={error:true};addMessage(e.message||words().error);return}
    if(!context.aiConfigured){addMessage(words().notConfigured);return}
    try {
      const status=await window.ReytUp.api('/api/assistant/status');
      context.aiAvailable=Boolean(status.available);
      if(!status.available) { addMessage(status.message||words().error); return; }
    } catch(e) {
      context.aiAvailable=false;
      addMessage(e.message||words().error);
      return;
    }
    if(!context.latestAnalysis)addMessage(words().noContext);
  }
  async function toggle(open){
    const panel=document.getElementById('reytup-assistant-panel');if(!panel)return;
    panel.classList.toggle('open',open);opened=open;
    if(open&&!panel.dataset.loaded){panel.dataset.loaded='1';await loadContext()}
    if(open)document.getElementById('assistant-input')?.focus();
  }
  async function submit(input,send){
    const question=input.value.trim();if(!question||busy)return;
    if(!token()){addMessage(words().login);return}
    if(context?.aiConfigured===false){addMessage(words().notConfigured);return}
    if(context?.aiAvailable===false){addMessage(words().error);return}
    addMessage(question,'user');input.value='';busy=true;send.disabled=true;
    const pending=addMessage(words().thinking);pending?.setAttribute('aria-live','polite');
    try{
      const response=await window.ReytUp.api('/api/assistant/chat',{method:'POST',body:JSON.stringify({question,language:lang(),analysisId:context?.latestAnalysis?.id||undefined})});
      pending?.remove();addMessage(response.answer||words().error);
    }catch(error){pending?.remove();let message=error.message||words().error;if(error.data?.code==='AI_NOT_CONFIGURED')message=words().notConfigured;else if(error.data?.code==='AI_DAILY_LIMIT')message=words().limit;addMessage(message)}
    finally{busy=false;send.disabled=false;input.focus()}
  }
  function boot(){build()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
