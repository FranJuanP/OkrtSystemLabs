(function(){
  const FLOW_LABELS={all:'Mixto',debt:'Deuda',trade:'Comercio',fdi:'IED',remit:'Remesas',reserves:'Reservas'};
  const REGION_LABELS={all:'Global',NA:'Norteam.',EU:'Europa',AS:'Asia',ME:'Or. Medio',LA:'Latam',AF:'África'};

  function parseMoney(text){
    const raw=(text||'').replace(/[^0-9.,TBM-]/g,'').replace(',', '.').trim();
    const m=raw.match(/(-?\d+(?:\.\d+)?)([TMB])?/i);
    if(!m) return null;
    const v=parseFloat(m[1]);
    const u=(m[2]||'B').toUpperCase();
    const mult=u==='T'?1000:u==='M'?0.001:1;
    return v*mult;
  }

  function pressureLabel(totalB){
    if(totalB==null) return 'Indeterminado';
    if(totalB>=10000) return 'Extrema';
    if(totalB>=5000) return 'Alta';
    if(totalB>=2000) return 'Media';
    return 'Focal';
  }

  function getActive(selector, attr){
    const el=document.querySelector(selector+'.active');
    return el ? (el.getAttribute(attr)||'all') : 'all';
  }

  function dominantFlow(){
    const ids=['all','debt','trade','fdi','remit','reserves'];
    let best={id:'all',value:-1};
    ids.forEach(id=>{
      const el=document.getElementById('vol-'+id);
      const val=parseMoney(el?.textContent||'');
      if(val!=null && val>best.value) best={id,value:val};
    });
    return best.id;
  }

  function getLeadCorridor(){
    const first=document.querySelector('#top-flows-list > *');
    if(!first) return 'Sin corredor dominante';
    const text=(first.textContent||'').replace(/\s+/g,' ').trim();
    return text.slice(0,56)||'Sin corredor dominante';
  }

  function classifyConcentration(){
    const items=[...document.querySelectorAll('#top-flows-list > *')];
    if(items.length<2) return 'Concentrada';
    const widths=items.slice(0,2).map(el=>{
      const fill=el.querySelector('[style*="width"]');
      const m=(fill?.getAttribute('style')||'').match(/width:\s*([\d.]+)%/i);
      return m?parseFloat(m[1]):0;
    });
    const gap=(widths[0]||0)-(widths[1]||0);
    if(gap>=18) return 'Muy concentrada';
    if(gap>=8) return 'Dominante';
    return 'Distribuida';
  }

  function decorateTopFlows(){
    const rows=[...document.querySelectorAll('#top-flows-list > *')];
    rows.forEach((row,idx)=>{
      row.classList.remove('vector-top1','vector-top2','vector-top3');
      if(idx<3){ row.classList.add('vector-top'+(idx+1)); }
      if(!row.querySelector('.vector-rank')){
        const badge=document.createElement('span');
        badge.className='vector-rank';
        const target=row.querySelector('span,div')||row;
        target.parentNode.insertBefore(badge,target);
      }
      const badge=row.querySelector('.vector-rank');
      badge.textContent='#'+(idx+1);
    });
  }

  function renderInsights(){
    const anchor=document.getElementById('top-flows-list');
    if(!anchor || !anchor.parentElement) return;
    let card=document.getElementById('vector-insights-card');
    if(!card){
      card=document.createElement('div');
      card.id='vector-insights-card';
      anchor.parentElement.appendChild(card);
    }
    const totalTxt=document.getElementById('total-flow')?.textContent||'—';
    const totalB=parseMoney(totalTxt);
    const flow=getActive('.flow-btn','data-flow');
    const region=getActive('.reg-btn','data-region');
    const threshold=document.getElementById('threshold')?.value || '50';
    const lead=getLeadCorridor();
    const domFlow=dominantFlow();
    const badges=[];
    badges.push('Presión '+pressureLabel(totalB));
    badges.push('Concentración '+classifyConcentration());
    if(flow!=='all') badges.push('Filtro '+(FLOW_LABELS[flow]||flow));
    if(region!=='all') badges.push('Región '+(REGION_LABELS[region]||region));
    card.innerHTML=''
      +'<div class="vic-title">Insights operativos</div>'
      +'<div class="vic-grid">'
      +  '<div class="vic-item"><div class="vic-k">Flujo dominante</div><div class="vic-v">'+(FLOW_LABELS[domFlow]||domFlow)+'</div></div>'
      +  '<div class="vic-item"><div class="vic-k">Región activa</div><div class="vic-v">'+(REGION_LABELS[region]||region)+'</div></div>'
      +  '<div class="vic-item"><div class="vic-k">Corredor líder</div><div class="vic-v">'+lead+'</div></div>'
      +  '<div class="vic-item"><div class="vic-k">Umbral actual</div><div class="vic-v">'+threshold+'B · total '+totalTxt+'</div></div>'
      +'</div>'
      +'<div class="vic-badges">'+badges.map(b=>'<span class="vic-badge">'+b+'</span>').join('')+'</div>';
  }

  function hookDetailPanel(){
    const panel=document.getElementById('dp-content');
    if(!panel || panel.dataset.vectorBoostHooked) return;
    panel.dataset.vectorBoostHooked='1';
    const observer=new MutationObserver(()=>{
      const firstTitle=panel.querySelector('.dp-title');
      if(!firstTitle || panel.querySelector('.vector-detail-note')) return;
      const note=document.createElement('div');
      note.className='vector-detail-note';
      note.style.cssText='margin:0 0 12px 0;padding:8px 10px;border:1px solid rgba(0,255,200,.12);border-radius:8px;background:rgba(0,255,200,.04);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#98f3df';
      note.textContent='Lectura operativa: prioriza intensidad, tipo de flujo y concentración del corredor.';
      panel.insertBefore(note,panel.firstChild);
    });
    observer.observe(panel,{childList:true,subtree:true});
  }

  function refresh(){
    decorateTopFlows();
    renderInsights();
    hookDetailPanel();
  }

  function start(){
    refresh();
    const mo=new MutationObserver(()=>{ window.requestAnimationFrame(refresh); });
    ['top-flows-list','detail-panel','total-flow','vol-all','vol-debt','vol-trade','vol-fdi','vol-remit','vol-reserves','threshold','controls'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) mo.observe(el,{childList:true,subtree:true,attributes:true,characterData:true});
    });
    document.addEventListener('click',e=>{
      if(e.target.closest('.flow-btn,.reg-btn')) setTimeout(refresh,30);
    });
    document.getElementById('threshold')?.addEventListener('input',()=>setTimeout(refresh,30));
    window.addEventListener('resize',()=>setTimeout(refresh,30));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
