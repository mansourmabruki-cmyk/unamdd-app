/* ===== U.N.A.M.DD - Bureau d'Exploration : logique applicative ===== */
'use strict';

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const DEFAULTS = {
  geologues: ['Mabruki Junior','Ilunga Dieudonné'],
  perimetres: ['PE 13080','PE 13081','PE 13082'],
  criteres: [
    ['Technique','Qualité du travail : précision des données, exactitude des rapports.'],
    ['Technique','Maîtrise des procédures : respect des directives de la société.'],
    ['Technique','Gestion du matériel : entretien et utilisation correcte des outils.'],
    ['Technique','Qualité opérationnelle : suivi des teneurs, cubage, géologie ou maintenance.'],
    ['Technique','Utilisation des outils : smartphones, GPS ou formulaires.'],
    ['Technique','Gestion du temps : ponctualité et respect des délais de livraison.'],
    ['Rendement','Atteinte des objectifs : quotas de production, avancement ou prélèvement.'],
    ['Rendement','Gestion du temps : ponctualité au shift, passation claire des consignes.'],
    ['Savoir-être','Relation publique : courtoisie, patience et respect des bénéficiaires.'],
    ['Savoir-être','Esprit d\u2019équipe : collaboration et remontée des alertes de terrain.'],
    ['Savoir-être','Adaptabilité : réactivité face aux imprévus (météo, accès difficile).'],
    ['Savoir-être','Intégrité : respect strict du code de conduite et impartialité.']
  ],
  dgEmail:'', dgWa:'', cloudUrl:'', cloudKey:''
};

/* ---------- Stockage ---------- */
const DB = {
  get(k, def){ try{ const v = localStorage.getItem('unamdd_'+k); return v?JSON.parse(v):def; }catch(e){ return def; } },
  set(k, v){ try{ localStorage.setItem('unamdd_'+k, JSON.stringify(v)); flashSave(); }catch(e){ toast('Espace de stockage plein : réduisez les photos.'); } }
};
let settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), DB.get('settings', {}));
let rapports = DB.get('rapports', []);
let evals    = DB.get('evals', []);

/* ---------- Utilitaires ---------- */
function $(id){ return document.getElementById(id); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2800); }
function flashSave(){ const b=$('saveState'); if(!b) return; b.textContent='● Enregistré ✓'; b.style.color='#8ef0b0'; setTimeout(()=>{ b.textContent='● Enregistré localement'; b.style.color='#cfe'; },1200); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function csvCell(s){ s=(s==null?'':String(s)).replace(/"/g,'""'); return '"'+s+'"'; }
function download(name, content, type){ const b=new Blob([content],{type:type||'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); }

/* ---------- Navigation ---------- */
function go(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $('view-'+view).classList.add('active');
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  window.scrollTo({top:0,behavior:'smooth'});
  if(view==='carte') setTimeout(renderMap, 60);
  if(view==='accueil') setTimeout(renderDashboard, 60);
}
document.getElementById('tabs').addEventListener('click', e=>{ if(e.target.dataset.view) go(e.target.dataset.view); });

/* ---------- Datalists (listes non exhaustives) ---------- */
function fillDatalist(id, items){ $(id).innerHTML = items.map(i=>`<option value="${esc(i)}">`).join(''); }
function refreshSelects(){
  fillDatalist('dlGeologues', settings.geologues);
  fillDatalist('dlPerimetres', settings.perimetres);
  const m=$('r_mois'); m.innerHTML = MOIS.map(x=>`<option>${x}</option>`).join('');
}

/* ---------- RAPPORT : bloc dynamique ---------- */
function toggleOuvrage(){
  const t=$('r_ouvrage').value;
  ['Puits','Tranchée','Sondage'].forEach(k=>$('dyn_'+k).classList.toggle('show', k===t));
  $('dyn_empty').style.display = t?'none':'block';
  $('ouvrageChip').textContent = t||'—';
}
$('r_ouvrage').addEventListener('change', toggleOuvrage);

function calcRendement(){
  const o=parseFloat($('r_objectif').value), r=parseFloat($('r_realise').value);
  $('r_rendement').value = (o>0 && !isNaN(r)) ? Math.round(r/o*100)+" % de l'objectif" : '';
}

function capterGPS(){
  const f=$('r_coord'); f.value='Recherche en cours...';
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      p=>{ f.value=p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6); if($('r_altitude') && p.coords.altitude!=null) $('r_altitude').value=Math.round(p.coords.altitude); toast('Position capturée'); },
      ()=>{ f.value='-11.664722, 27.479444'; toast('GPS indisponible : coordonnées de démo (Lubumbashi)'); }
    );
  } else { toast("Géolocalisation non supportée"); }
}

/* ---------- ECHANTILLONS ---------- */
let curSamples = [];
function renderSamples(){
  $('sampleList').innerHTML = curSamples.map((s,i)=>
    `<div class="sample-row">`+
    `<input type="text" placeholder="Réf." value="${esc(s.ref)}" oninput="updSample(${i},'ref',this.value)">`+
    `<input type="text" placeholder="Prof. (m)" value="${esc(s.prof)}" oninput="updSample(${i},'prof',this.value)">`+
    `<input type="text" placeholder="Type" value="${esc(s.type)}" oninput="updSample(${i},'type',this.value)">`+
    `<input type="text" placeholder="Teneur" value="${esc(s.teneur)}" oninput="updSample(${i},'teneur',this.value)">`+
    `<button type="button" class="btn btn-danger btn-sm" onclick="delSample(${i})">🗑️</button></div>`
  ).join('');
}
function addSample(){ curSamples.push({ref:'',prof:'',type:'',teneur:''}); renderSamples(); }
function updSample(i,k,v){ curSamples[i][k]=v; }
function delSample(i){ curSamples.splice(i,1); renderSamples(); }

/* ---------- PHOTOS ---------- */
let curPhotos = [];
function addPhotos(ev){
  const files=[...ev.target.files]; ev.target.value='';
  files.forEach(file=>{
    const rd=new FileReader();
    rd.onload=()=>{ const img=new Image(); img.onload=()=>{
      const max=900, sc=Math.min(1, max/Math.max(img.width,img.height));
      const c=document.createElement('canvas'); c.width=img.width*sc; c.height=img.height*sc;
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      curPhotos.push(c.toDataURL('image/jpeg',0.6)); renderPhotos();
    }; img.src=rd.result; };
    rd.readAsDataURL(file);
  });
}
function renderPhotos(){
  $('photoGrid').innerHTML = curPhotos.map((p,i)=>
    `<div class="ph"><img src="${p}" alt="photo"><button type="button" onclick="delPhoto(${i})">✕</button></div>`
  ).join('');
}
function delPhoto(i){ curPhotos.splice(i,1); renderPhotos(); }

/* MARKER_END_1 */

/* ---------- RAPPORT : collecte / remplissage ---------- */
const R_FIELDS = ['r_geologue','r_whatsapp','r_mois','r_annee','r_ouvrage','r_terrain','r_objectif',
  'r_coord','r_perimetre','r_altitude','r_acces',
  'p_visee','p_atteinte','p_section','p_litho','p_miner','p_eau',
  't_long','t_larg','t_prof','t_azimut','t_obs',
  's_type','s_prof','s_incl','s_recup','s_ech','s_log',
  'r_realise','r_echant','r_jours','r_diff','r_reco',
  'r_teneur','r_substance','r_decision','r_justif'];

function collectReport(){
  const o={id:$('r_id').value||uid()};
  R_FIELDS.forEach(f=>o[f]=$(f).value);
  o.rendement=$('r_rendement').value;
  o.samples=curSamples.filter(s=>s.ref||s.prof||s.type||s.teneur);
  o.photos=curPhotos.slice();
  o.updated=Date.now();
  return o;
}
function fillReport(o){
  $('r_id').value=o.id||'';
  R_FIELDS.forEach(f=>{ if($(f)) $(f).value=o[f]||''; });
  curSamples=(o.samples||[]).map(s=>Object.assign({ref:'',prof:'',type:'',teneur:''},s));
  curPhotos=(o.photos||[]).slice();
  renderSamples(); renderPhotos(); toggleOuvrage(); calcRendement();
}
function resetReport(){
  $('formRapport').reset(); $('r_id').value='';
  $('r_annee').value=new Date().getFullYear(); $('r_mois').value=MOIS[new Date().getMonth()];
  curSamples=[]; curPhotos=[]; renderSamples(); renderPhotos(); toggleOuvrage(); calcRendement();
}
function newReport(){ resetReport(); go('rapport'); }

$('formRapport').addEventListener('submit', e=>{
  e.preventDefault();
  const o=collectReport();
  // listes non exhaustives : ajout auto
  const g=o.r_geologue && o.r_geologue.trim(); if(g && !settings.geologues.includes(g)){ settings.geologues.push(g); DB.set('settings',settings); refreshSelects(); }
  const pe=o.r_perimetre && o.r_perimetre.trim(); if(pe && !settings.perimetres.includes(pe)){ settings.perimetres.push(pe); DB.set('settings',settings); refreshSelects(); }
  const i=rapports.findIndex(x=>x.id===o.id);
  if(i>=0) rapports[i]=o; else rapports.push(o);
  DB.set('rapports', rapports); renderAll(); toast('Rapport enregistré'); go('archives');
});

/* ---------- RAPPORT : texte formate (DG) ---------- */
function reportToText(o){
  const L=[]; const add=(k,v)=>{ if(v) L.push(k+' : '+v); };
  L.push('RAPPORT D\'EXPLORATION – U.N.A.M.DD'); L.push('='.repeat(34));
  add('Géologue', o.r_geologue); add('Période', (o.r_mois||'')+' '+(o.r_annee||''));
  add('Terrain', o.r_terrain); add('Périmètre', o.r_perimetre); add('Ouvrage', o.r_ouvrage);
  add('Coordonnées', o.r_coord); add('Altitude (m)', o.r_altitude);
  add('Objectif', o.r_objectif); add('Réalisé', o.r_realise); add('Rendement', o.rendement);
  add('Échantillons prélevés', o.r_echant);
  add('Teneur moyenne', o.r_teneur); add('Substance', o.r_substance);
  add('DÉCISION SITE', o.r_decision); add('Justification', o.r_justif);
  add('Difficultés', o.r_diff); add('Recommandations', o.r_reco);
  if(o.samples && o.samples.length){ L.push(''); L.push('Échantillons :'); o.samples.forEach(s=>L.push(' - '+[s.ref,s.prof+'m',s.type,s.teneur].filter(Boolean).join(' | '))); }
  L.push(''); L.push('Rapport généré par l\'application U.N.A.M.DD.');
  return L.join('\n');
}
function envoyerDG(){
  const o=collectReport();
  if(!o.r_terrain){ toast('Renseignez au moins le terrain.'); return; }
  const txt=reportToText(o);
  const sujet='Rapport exploration – '+(o.r_terrain||'')+' ('+(o.r_mois||'')+' '+(o.r_annee||'')+')';
  const email=(settings.dgEmail||'').trim(), wa=(settings.dgWa||'').replace(/[^0-9]/g,'');
  if(navigator.share){ navigator.share({title:sujet,text:txt}).catch(()=>{}); return; }
  const choix=prompt('Envoyer au DG via :\n1 = E-mail\n2 = WhatsApp\n(annuler = copier le texte)','1');
  if(choix==='1'){ location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(sujet)+'&body='+encodeURIComponent(txt); }
  else if(choix==='2'){ window.open('https://wa.me/'+wa+'?text='+encodeURIComponent(txt),'_blank'); }
  else { navigator.clipboard && navigator.clipboard.writeText(txt); toast('Rapport copié dans le presse-papiers'); }
}

/* MARKER_END_2 */

/* ---------- EVALUATION : grille dynamique ---------- */
function renderGrid(values){
  values=values||{}; const host=$('gridCriteres'); let html=''; let lastCat=null;
  settings.criteres.forEach((c,idx)=>{
    const [cat,lib]=c;
    if(cat!==lastCat){ html+=`<div class="cat-head">${esc(cat)}</div>`; lastCat=cat; }
    const v=values['crit'+idx];
    html+=`<div class="crit"><div class="q">${esc(lib)}</div><div class="scale">`+
      [1,2,3,4].map(n=>`<label><input type="radio" name="crit${idx}" value="${n}" ${String(v)===String(n)?'checked':''} onchange="calcMoyenne()"> ${n}</label>`).join('')+
      `</div></div>`;
  });
  host.innerHTML=html; calcMoyenne();
}
function mention(m){
  if(m<1.75) return ['Insuffisant','#d64545'];
  if(m<2.75) return ['À améliorer','#d9822b'];
  if(m<3.5)  return ['Satisfaisant','#1f9d55'];
  return ['Excellent','#0A2540'];
}
function calcMoyenne(){
  let sum=0,cnt=0;
  settings.criteres.forEach((c,idx)=>{ const el=document.querySelector(`input[name="crit${idx}"]:checked`); if(el){ sum+=+el.value; cnt++; } });
  const box=$('e_moyenne'), pill=$('e_mention');
  if(cnt===0){ box.textContent='–'; pill.textContent='–'; pill.style.background='#999'; return; }
  const m=sum/cnt; box.textContent=m.toFixed(2);
  const [txt,col]=mention(m); pill.textContent=txt+' ('+Math.round(m/4*100)+'%)'; pill.style.background=col;
}

const E_FIELDS=['e_nom','e_poste','e_dept','e_zone','e_dt','e_date','e_c_tech','e_c_rend','e_c_sav','e_forts','e_axes','e_obj','e_form','e_sig_eval','e_sig_agent'];
function collectEval(){
  const o={id:$('e_id').value||uid(),notes:{}}; E_FIELDS.forEach(f=>o[f]=$(f).value);
  settings.criteres.forEach((c,idx)=>{ const el=document.querySelector(`input[name="crit${idx}"]:checked`); if(el) o.notes['crit'+idx]=+el.value; });
  o.moyenne=$('e_moyenne').textContent; o.mention=$('e_mention').textContent; o.updated=Date.now(); return o;
}
function fillEval(o){ $('e_id').value=o.id||''; E_FIELDS.forEach(f=>{ if($(f)) $(f).value=o[f]||''; }); renderGrid(o.notes||{}); }
function resetEval(){ $('formEval').reset(); $('e_id').value=''; $('e_date').value=new Date().toISOString().slice(0,10); renderGrid({}); }
function newEval(){ resetEval(); go('evaluation'); }

$('formEval').addEventListener('submit', e=>{
  e.preventDefault();
  const o=collectEval(); const i=evals.findIndex(x=>x.id===o.id);
  if(i>=0) evals[i]=o; else evals.push(o);
  DB.set('evals', evals); renderAll(); toast('Évaluation enregistrée'); go('archives');
});

function evalToText(o){
  const L=['FICHE D\'ÉVALUATION – U.N.A.M.DD','='.repeat(32)];
  const add=(k,v)=>{ if(v) L.push(k+' : '+v); };
  add('Agent', o.e_nom); add('Poste', o.e_poste); add('Département', o.e_dept);
  add('Date', o.e_date); add('NOTE GLOBALE', (o.moyenne||'–')+'/4 – '+(o.mention||''));
  L.push(''); L.push('Détail des notes :');
  settings.criteres.forEach((c,idx)=>{ const n=o.notes&&o.notes['crit'+idx]; if(n) L.push(' - ['+c[0]+'] '+c[1]+' : '+n+'/4'); });
  L.push(''); add('Points forts', o.e_forts); add('Axes d\'amélioration', o.e_axes);
  add('Objectifs', o.e_obj); add('Formations', o.e_form);
  L.push(''); L.push('Document transmis pour amélioration des performances.');
  return L.join('\n');
}
function envoyerAgent(){
  const o=collectEval();
  if(!o.e_nom){ toast('Renseignez le nom de l\'agent.'); return; }
  const txt=evalToText(o);
  const sujet='Votre évaluation – '+(o.e_nom||'')+' ('+(o.e_date||'')+')';
  if(navigator.share){ navigator.share({title:sujet,text:txt}).catch(()=>{}); return; }
  const choix=prompt('Envoyer à l\'agent via :\n1 = E-mail\n2 = WhatsApp\n(annuler = copier)','2');
  if(choix==='1'){ location.href='mailto:?subject='+encodeURIComponent(sujet)+'&body='+encodeURIComponent(txt); }
  else if(choix==='2'){ window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'); }
  else { navigator.clipboard && navigator.clipboard.writeText(txt); toast('Évaluation copiée'); }
}

/* MARKER_END_3 */

/* ---------- ARCHIVES ---------- */
function renderAll(){
  $('statRapports').textContent=rapports.length;
  $('statEval').textContent=evals.length;
  $('statAgents').textContent=settings.geologues.length;
  $('cntRapports').textContent=rapports.length;
  $('cntEval').textContent=evals.length;
  renderDashboard();
  renderCoordTable();

  const lr=$('listRapports');
  lr.innerHTML = rapports.length ? rapports.slice().reverse().map(o=>
    `<div class="rec"><div class="meta"><b>${esc(o.r_terrain||'Terrain ?')}</b>`+
    `<span>${esc(o.r_ouvrage||'')} · ${esc(o.r_mois||'')} ${esc(o.r_annee||'')} · ${esc(o.r_geologue||'')}`+
    `${o.rendement?' · '+esc(o.rendement):''}${o.r_decision?' · '+esc(o.r_decision):''}</span></div>`+
    `<span class="tag">${esc(o.r_perimetre||'PE ?')}</span>`+
    `<button class="btn btn-ghost btn-sm" onclick="editReport('${o.id}')">✏️</button>`+
    `<button class="btn btn-danger btn-sm" onclick="delReport('${o.id}')">🗑️</button></div>`
  ).join('') : '<div class="empty">Aucun rapport enregistré.</div>';

  const le=$('listEval');
  le.innerHTML = evals.length ? evals.slice().reverse().map(o=>
    `<div class="rec"><div class="meta"><b>${esc(o.e_nom||'Agent ?')}</b>`+
    `<span>${esc(o.e_poste||'')} · ${esc(o.e_dept||'')} · ${esc(o.e_date||'')}</span></div>`+
    `<span class="tag">${esc(o.moyenne||'–')}/4</span>`+
    `<button class="btn btn-ghost btn-sm" onclick="editEval('${o.id}')">✏️</button>`+
    `<button class="btn btn-danger btn-sm" onclick="delEval('${o.id}')">🗑️</button></div>`
  ).join('') : '<div class="empty">Aucune évaluation enregistrée.</div>';
}
function editReport(id){ const o=rapports.find(x=>x.id===id); if(o){ fillReport(o); go('rapport'); } }
function delReport(id){ if(confirm('Supprimer ce rapport ?')){ rapports=rapports.filter(x=>x.id!==id); DB.set('rapports',rapports); renderAll(); toast('Rapport supprimé'); } }
function editEval(id){ const o=evals.find(x=>x.id===id); if(o){ fillEval(o); go('evaluation'); } }
function delEval(id){ if(confirm('Supprimer cette évaluation ?')){ evals=evals.filter(x=>x.id!==id); DB.set('evals',evals); renderAll(); toast('Évaluation supprimée'); } }

/* ---------- DASHBOARD ---------- */
function parseCoord(s){ if(!s) return null; const m=String(s).match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/); if(!m) return null; const la=+m[1], lo=+m[2]; if(isNaN(la)||isNaN(lo)) return null; return [la,lo]; }
function renderDashboard(){
  // rendement moyen
  const rs=rapports.map(o=>parseFloat(o.rendement)).filter(v=>!isNaN(v));
  $('statRendement').textContent = rs.length ? Math.round(rs.reduce((a,b)=>a+b,0)/rs.length)+' %' : '–';
  const fav=rapports.filter(o=>o.r_decision==='Favorable').length; $('statFav').textContent=fav;
  const ech=rapports.reduce((a,o)=>a+(parseInt(o.r_echant)||0),0); $('statEchant').textContent=ech;
  // graphique : rendement par site (10 derniers avec rendement)
  const perf=rapports.filter(o=>!isNaN(parseFloat(o.rendement))).slice(-10);
  if(perf.length){ $('chartPerfEmpty').style.display='none'; drawBars('chartPerf', perf.map(o=>o.r_terrain||'?'), perf.map(o=>parseFloat(o.rendement)), '#0A2540'); }
  else { $('chartPerfEmpty').style.display='block'; const cv=$('chartPerf'); if(cv){ const g=setupCanvas(cv); g.ctx.clearRect(0,0,g.w,g.h); } }
  // graphique : donut des decisions
  const segs=[
    {label:'Favorable',color:'#1f9d55',value:rapports.filter(o=>o.r_decision==='Favorable').length},
    {label:'À confirmer',color:'#d9822b',value:rapports.filter(o=>o.r_decision==='À confirmer').length},
    {label:'Défavorable',color:'#d64545',value:rapports.filter(o=>o.r_decision==='Défavorable').length},
    {label:'Non évalué',color:'#9aa5b1',value:rapports.filter(o=>!o.r_decision).length}
  ];
  drawDonut('chartDonut', segs);
  const totalD=segs.reduce((a,s)=>a+s.value,0)||1;
  $('donutLegend').innerHTML = segs.map(s=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12.5px">`+
    `<span style="width:12px;height:12px;border-radius:3px;background:${s.color};display:inline-block"></span>`+
    `<span style="flex:1">${s.label}</span><b>${s.value}</b> <span style="color:#9aa5b1">(${Math.round(s.value/totalD*100)}%)</span></div>`).join('');
  // graphique : performance moyenne des agents
  const byAgent={};
  evals.forEach(o=>{ const m=parseFloat(o.moyenne); if(isNaN(m)||!o.e_nom) return; (byAgent[o.e_nom]=byAgent[o.e_nom]||[]).push(m); });
  const names=Object.keys(byAgent);
  if(names.length){ $('chartAgentsEmpty').style.display='none';
    drawBars('chartAgents', names, names.map(n=>+(byAgent[n].reduce((a,b)=>a+b,0)/byAgent[n].length).toFixed(2)), '#C5A059'); }
  else { $('chartAgentsEmpty').style.display='block'; const cv=$('chartAgents'); if(cv){ const g=setupCanvas(cv); g.ctx.clearRect(0,0,g.w,g.h); } }
  // recent activity
  const acts=[...rapports.map(o=>({t:o.updated||0,txt:'Rapport – '+(o.r_terrain||'?'),v:'rapport',id:o.id})),
              ...evals.map(o=>({t:o.updated||0,txt:'Évaluation – '+(o.e_nom||'?'),v:'evaluation',id:o.id}))]
              .sort((a,b)=>b.t-a.t).slice(0,6);
  $('recentActivity').innerHTML = acts.length ? acts.map(a=>
    `<div class="rec"><div class="meta"><b>${esc(a.txt)}</b><span>${a.t?new Date(a.t).toLocaleString('fr-FR'):''}</span></div></div>`
  ).join('') : '<div class="empty">Aucune activité récente.</div>';
  // sync chip
  const on=navigator.onLine, cfg=(settings.cloudUrl||'').trim();
  const chip=$('syncChip'); chip.textContent = !cfg?'Non configuré':(on?'Prêt':'Hors-ligne'); chip.style.background = cfg&&on?'#1f9d55':'#9aa5b1';
}

/* ---------- CARTE (hors-ligne, canvas) ---------- */
const DEC_COLORS={'Favorable':'#1f9d55','À confirmer':'#d9822b','Défavorable':'#d64545'};
let _mapPts=[], _mapSel=null;
function setupCanvas(cv){
  const dpr=window.devicePixelRatio||1;
  const rect=cv.getBoundingClientRect();
  const w=rect.width||cv.clientWidth||300, h=rect.height||cv.clientHeight||200;
  cv.width=w*dpr; cv.height=h*dpr;
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
function renderMap(){
  const cv=$('mapCanvas'); if(!cv) return;
  const {ctx,w,h}=setupCanvas(cv);
  ctx.clearRect(0,0,w,h);
  _mapPts=[];
  const data=rapports.map(o=>({o,c:parseCoord(o.r_coord)})).filter(x=>x.c);
  $('cntPoints').textContent=data.length;
  // fond
  ctx.fillStyle='#eef3ee'; ctx.fillRect(0,0,w,h);
  if(!data.length){ ctx.fillStyle='#8a94a0'; ctx.font='13px Segoe UI,sans-serif'; ctx.textAlign='center';
    ctx.fillText('Aucun site géolocalisé pour le moment.', w/2, h/2); return; }
  // bornes
  let las=data.map(d=>d.c[0]), los=data.map(d=>d.c[1]);
  let laMin=Math.min(...las), laMax=Math.max(...las), loMin=Math.min(...los), loMax=Math.max(...los);
  let dLa=(laMax-laMin)||0.01, dLo=(loMax-loMin)||0.01;
  laMin-=dLa*0.2; laMax+=dLa*0.2; loMin-=dLo*0.2; loMax+=dLo*0.2;
  const pad=38, pw=w-pad*2, ph=h-pad*2;
  const X=lo=>pad+(lo-loMin)/(loMax-loMin)*pw;
  const Y=la=>pad+(laMax-la)/(laMax-laMin)*ph;
  // grille
  ctx.strokeStyle='#d7e0d7'; ctx.lineWidth=1; ctx.fillStyle='#8a94a0'; ctx.font='9px Segoe UI,sans-serif';
  for(let i=0;i<=4;i++){
    const gx=pad+pw*i/4, gy=pad+ph*i/4;
    ctx.beginPath(); ctx.moveTo(gx,pad); ctx.lineTo(gx,pad+ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad,gy); ctx.lineTo(pad+pw,gy); ctx.stroke();
    ctx.textAlign='center'; ctx.fillText((loMin+(loMax-loMin)*i/4).toFixed(3), gx, h-pad+14);
    ctx.textAlign='right'; ctx.fillText((laMax-(laMax-laMin)*i/4).toFixed(3), pad-5, gy+3);
  }
  ctx.textAlign='center'; ctx.fillStyle='#6b7682';
  ctx.fillText('Longitude', w/2, h-6);
  ctx.save(); ctx.translate(10,h/2); ctx.rotate(-Math.PI/2); ctx.fillText('Latitude',0,0); ctx.restore();
  // points
  data.forEach(d=>{
    const x=X(d.c[1]), y=Y(d.c[0]), col=DEC_COLORS[d.o.r_decision]||'#0A2540';
    _mapPts.push({x,y,o:d.o,c:d.c});
    ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke();
  });
  // selection
  if(_mapSel){ const p=_mapPts.find(p=>p.o.id===_mapSel); if(p){ ctx.beginPath(); ctx.arc(p.x,p.y,12,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle='#0A2540'; ctx.stroke(); } }
  // legende
  const leg=[['Favorable','#1f9d55'],['À confirmer','#d9822b'],['Défavorable','#d64545'],['Non évalué','#0A2540']];
  let lx=pad+4, ly=pad+4; ctx.font='9px Segoe UI,sans-serif'; ctx.textAlign='left';
  leg.forEach(([lbl,col])=>{ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(lx+4,ly+4,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#374151'; ctx.fillText(lbl, lx+12, ly+7); ly+=14; });
}
function onMapClick(ev){
  const cv=$('mapCanvas'); if(!cv||!_mapPts.length) return;
  const rect=cv.getBoundingClientRect();
  const cx=(ev.touches?ev.touches[0].clientX:ev.clientX)-rect.left;
  const cy=(ev.touches?ev.touches[0].clientY:ev.clientY)-rect.top;
  let best=null,bd=1e9;
  _mapPts.forEach(p=>{ const d=(p.x-cx)**2+(p.y-cy)**2; if(d<bd){ bd=d; best=p; } });
  if(best && bd<=400){ _mapSel=best.o.id; renderMap();
    const o=best.o;
    $('mapInfo').innerHTML=`<b>${esc(o.r_terrain||'Site')}</b> – ${esc(o.r_ouvrage||'')} · ${esc(o.r_perimetre||'')}<br>`+
      `Décision : ${esc(o.r_decision||'–')} · Rendement : ${esc(o.rendement||'–')}<br>Coord. : ${esc(o.r_coord||'')}`;
    const b=$('btnOSM'); b.style.display='inline-flex'; b.dataset.c=best.c.join(',');
  }
}
function openOSM(){ const c=$('btnOSM').dataset.c; if(c){ window.open('https://www.openstreetmap.org/?mlat='+c.split(',')[0]+'&mlon='+c.split(',')[1]+'#map=15/'+c.split(',')[0]+'/'+c.split(',')[1],'_blank'); } }
function renderCoordTable(){
  const rows=rapports.filter(o=>parseCoord(o.r_coord)).map(o=>{ const c=parseCoord(o.r_coord);
    return `<tr><td>${esc(o.r_terrain||'')}</td><td>${esc(o.r_perimetre||'')}</td><td>${c[0].toFixed(5)}</td><td>${c[1].toFixed(5)}</td><td>${esc(o.r_altitude||'')}</td><td>${esc(o.r_decision||'–')}</td></tr>`; });
  $('coordTable').innerHTML = '<thead><tr><th>Site</th><th>PE</th><th>Latitude</th><th>Longitude</th><th>Alt.</th><th>Décision</th></tr></thead>'+
    '<tbody>'+(rows.join('')||'<tr><td colspan="6" style="text-align:center;color:#888">Aucune coordonnée enregistrée.</td></tr>')+'</tbody>';
}

/* ---------- GRAPHIQUES (canvas, sans librairie) ---------- */
function drawBars(id, labels, values, color){
  const cv=$(id); if(!cv) return; const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  if(!values.length){ return; }
  const pad=28, bw=w-pad*2, bh=h-pad-24;
  const max=Math.max(...values,1);
  const n=values.length, gap=8, barW=Math.min(46,(bw-gap*(n-1))/n);
  const step=(bw-barW)/(Math.max(n-1,1));
  ctx.strokeStyle='#e3e8ee'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){ const gy=pad+bh*i/4; ctx.beginPath(); ctx.moveTo(pad,gy); ctx.lineTo(pad+bw,gy); ctx.stroke();
    ctx.fillStyle='#9aa5b1'; ctx.font='9px Segoe UI'; ctx.textAlign='right'; ctx.fillText(Math.round(max-(max*i/4)), pad-4, gy+3); }
  values.forEach((v,i)=>{ const x=pad+(n===1?bw/2-barW/2:step*i); const bhh=bh*(v/max); const y=pad+bh-bhh;
    const grd=ctx.createLinearGradient(0,y,0,pad+bh); grd.addColorStop(0,color); grd.addColorStop(1,color+'aa');
    ctx.fillStyle=grd; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,barW,bhh,[5,5,0,0]); else ctx.rect(x,y,barW,bhh); ctx.fill();
    ctx.fillStyle='#374151'; ctx.font='bold 10px Segoe UI'; ctx.textAlign='center'; ctx.fillText(Math.round(v), x+barW/2, y-4);
    ctx.fillStyle='#6b7682'; ctx.font='9px Segoe UI'; const lbl=(labels[i]||'').slice(0,10); ctx.fillText(lbl, x+barW/2, pad+bh+14);
  });
}
function drawDonut(id, segs){
  const cv=$(id); if(!cv) return; const {ctx,w,h}=setupCanvas(cv); ctx.clearRect(0,0,w,h);
  const total=segs.reduce((a,s)=>a+s.value,0);
  const cx=w/2, cy=h/2, R=Math.min(w,h)/2-6, r=R*0.58;
  if(!total){ ctx.strokeStyle='#e3e8ee'; ctx.lineWidth=R-r; ctx.beginPath(); ctx.arc(cx,cy,(R+r)/2,0,Math.PI*2); ctx.stroke(); return; }
  let a=-Math.PI/2;
  segs.forEach(s=>{ if(!s.value) return; const ang=s.value/total*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a,a+ang); ctx.closePath(); ctx.fillStyle=s.color; ctx.fill(); a+=ang; });
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
  ctx.fillStyle='#0A2540'; ctx.font='bold 20px Segoe UI'; ctx.textAlign='center'; ctx.fillText(total, cx, cy+2);
  ctx.fillStyle='#9aa5b1'; ctx.font='9px Segoe UI'; ctx.fillText('sites', cx, cy+16);
}

/* MARKER_END_4 */

/* ---------- EXPORTS ---------- */
function exportJSON(){
  const data={settings,rapports,evals,exported:new Date().toISOString()};
  download('unamdd_sauvegarde_'+new Date().toISOString().slice(0,10)+'.json', JSON.stringify(data,null,2),'application/json');
  toast('Sauvegarde exportée');
}
function importJSON(ev){
  const file=ev.target.files[0]; if(!file) return; const rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result);
    if(d.settings) settings=Object.assign(JSON.parse(JSON.stringify(DEFAULTS)),d.settings);
    if(d.rapports) rapports=d.rapports; if(d.evals) evals=d.evals;
    DB.set('settings',settings); DB.set('rapports',rapports); DB.set('evals',evals);
    refreshSelects(); renderSettings(); renderGrid({}); renderAll(); toast('Données restaurées');
  }catch(e){ toast('Fichier invalide'); } };
  rd.readAsText(file); ev.target.value='';
}
function exportReportsCSV(){
  const cols=['r_terrain','r_perimetre','r_ouvrage','r_mois','r_annee','r_geologue','r_coord','r_altitude','r_objectif','r_realise','rendement','r_echant','r_teneur','r_substance','r_decision','r_justif'];
  const head=['Terrain','PE','Ouvrage','Mois','Année','Géologue','Coordonnées','Altitude','Objectif','Réalisé','Rendement','Échantillons','Teneur','Substance','Décision','Justification'];
  const lines=[head.map(csvCell).join(',')];
  rapports.forEach(o=>lines.push(cols.map(c=>csvCell(o[c])).join(',')));
  download('rapports_exploration.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('Rapports exportés (CSV)');
}
function exportEvalsCSV(){
  const cols=['e_nom','e_poste','e_dept','e_zone','e_date','moyenne','mention'];
  const head=['Agent','Poste','Département','Zone','Date','Moyenne/4','Mention'];
  const lines=[head.map(csvCell).join(',')];
  evals.forEach(o=>lines.push(cols.map(c=>csvCell(o[c])).join(',')));
  download('evaluations_agents.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('Évaluations exportées (CSV)');
}
function exportCoordsCSV(){
  const lines=[['Site','PE','Latitude','Longitude','Altitude','Décision','Ouvrage'].map(csvCell).join(',')];
  rapports.forEach(o=>{ const c=parseCoord(o.r_coord); if(!c) return;
    lines.push([o.r_terrain,o.r_perimetre,c[0],c[1],o.r_altitude,o.r_decision,o.r_ouvrage].map(csvCell).join(',')); });
  download('coordonnees_sites.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');
  toast('Coordonnées exportées (CSV)');
}

/* ---------- CLOUD SYNC ---------- */
function cloudEndpoint(){ let u=(settings.cloudUrl||'').trim(); if(!u) return null; const k=(settings.cloudKey||'').trim(); if(k) u += (u.includes('?')?'&':'?')+'auth='+encodeURIComponent(k); return u; }
async function cloudPush(){
  const u=cloudEndpoint(); if(!u){ toast('Configurez l\'URL cloud dans Paramètres.'); return; }
  if(!navigator.onLine){ toast('Hors-ligne : synchronisation impossible.'); return; }
  try{ const r=await fetch(u,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings,rapports,evals,updated:Date.now()})});
    if(!r.ok) throw 0; toast('Données envoyées au cloud ✓');
  }catch(e){ toast('Échec de l\'envoi au cloud.'); }
}
async function cloudPull(){
  const u=cloudEndpoint(); if(!u){ toast('Configurez l\'URL cloud dans Paramètres.'); return; }
  if(!navigator.onLine){ toast('Hors-ligne : synchronisation impossible.'); return; }
  try{ const r=await fetch(u); if(!r.ok) throw 0; const d=await r.json(); if(!d){ toast('Cloud vide.'); return; }
    if(d.rapports) rapports=d.rapports; if(d.evals) evals=d.evals;
    if(d.settings){ ['geologues','perimetres','criteres'].forEach(k=>{ if(d.settings[k]) settings[k]=d.settings[k]; }); }
    DB.set('rapports',rapports); DB.set('evals',evals); DB.set('settings',settings);
    refreshSelects(); renderSettings(); renderGrid({}); renderAll(); toast('Données récupérées du cloud ✓');
  }catch(e){ toast('Échec de la récupération.'); }
}
window.addEventListener('online', renderDashboard);
window.addEventListener('offline', renderDashboard);

/* ---------- PARAMETRES ---------- */
function renderMgr(key, host){
  $(host).innerHTML = settings[key].map((v,i)=>
    `<div class="mgr-item"><input type="text" value="${esc(v)}" data-k="${key}" data-i="${i}">`+
    `<button class="btn btn-danger btn-sm" onclick="delMgr('${key}',${i})">🗑️</button></div>`).join('');
}
function renderCriteres(){
  $('mgrCriteres').innerHTML = settings.criteres.map((c,i)=>
    `<div class="mgr-item"><input type="text" value="${esc(c[0])}" data-crit="cat" data-i="${i}" style="flex:0 0 110px">`+
    `<input type="text" value="${esc(c[1])}" data-crit="lib" data-i="${i}">`+
    `<button class="btn btn-danger btn-sm" onclick="delCritere(${i})">🗑️</button></div>`).join('');
}
function renderSettings(){
  renderMgr('geologues','mgrGeologues'); renderMgr('perimetres','mgrPerimetres'); renderCriteres();
  $('cfg_dgEmail').value=settings.dgEmail||''; $('cfg_dgWa').value=settings.dgWa||'';
  $('cfg_cloudUrl').value=settings.cloudUrl||''; $('cfg_cloudKey').value=settings.cloudKey||'';
}
function addMgr(key){ settings[key].push(''); renderMgr(key, key==='geologues'?'mgrGeologues':'mgrPerimetres'); }
function delMgr(key,i){ settings[key].splice(i,1); renderMgr(key, key==='geologues'?'mgrGeologues':'mgrPerimetres'); }
function addCritere(){ settings.criteres.push(['Technique','']); renderCriteres(); }
function delCritere(i){ settings.criteres.splice(i,1); renderCriteres(); }
function saveSettings(){
  ['geologues','perimetres'].forEach(key=>{ settings[key]=[...document.querySelectorAll(`input[data-k="${key}"]`)].map(x=>x.value.trim()).filter(Boolean); });
  const cats=[...document.querySelectorAll('input[data-crit="cat"]')]; const libs=[...document.querySelectorAll('input[data-crit="lib"]')];
  settings.criteres = cats.map((c,i)=>[c.value.trim()||'Autre', libs[i].value.trim()]).filter(x=>x[1]);
  settings.dgEmail=$('cfg_dgEmail').value.trim(); settings.dgWa=$('cfg_dgWa').value.trim();
  settings.cloudUrl=$('cfg_cloudUrl').value.trim(); settings.cloudKey=$('cfg_cloudKey').value.trim();
  DB.set('settings',settings); refreshSelects(); renderSettings(); renderGrid({}); renderAll(); toast('Paramètres enregistrés');
}
function resetSettings(){ if(confirm('Réinitialiser agents, PE et critères aux valeurs par défaut ? (les destinataires et le cloud sont conservés)')){ const keep={dgEmail:settings.dgEmail,dgWa:settings.dgWa,cloudUrl:settings.cloudUrl,cloudKey:settings.cloudKey}; settings=Object.assign(JSON.parse(JSON.stringify(DEFAULTS)),keep); DB.set('settings',settings); refreshSelects(); renderSettings(); renderGrid({}); renderAll(); toast('Paramètres réinitialisés'); } }

/* MARKER_END_5 */

/* ---------- GUIDE ---------- */
const GUIDE_HTML = `
<p><b>U.N.A.M.DD – Bureau d'Exploration</b> est une application complète et hors-ligne pour la gestion des rapports d'exploration minière et l'évaluation des agents de terrain.</p>
<h3 style="color:#0A2540">1. Accueil (tableau de bord)</h3>
<p>Vue récapitulative avec indicateurs clés (rapports, évaluations, rendement moyen, sites favorables, échantillons) et <b>trois graphiques de performance</b> : rendement par site, répartition des décisions (anneau) et note moyenne par agent. Inclut aussi l'activité récente et l'état de la synchronisation cloud.</p>
<h3 style="color:#0A2540">2. Exploration</h3>
<ul>
<li><b>Personnel &amp; affectation</b> : le géologue et le périmètre se saisissent librement (liste non exhaustive) – un nouveau nom est ajouté automatiquement.</li>
<li><b>Positionnement</b> : bouton <b>GPS</b> pour capturer la position ; les coordonnées alimentent automatiquement la carte et la feuille de coordonnées.</li>
<li><b>Spécifications techniques</b> : les champs s'adaptent au type d'ouvrage (Puits / Tranchée / Sondage).</li>
<li><b>Échantillons</b> : ajoutez autant de lignes que nécessaire (réf., profondeur, type, teneur).</li>
<li><b>Photos</b> : prenez ou importez des photos du site et des échantillons (compressées automatiquement).</li>
<li><b>Décision</b> : indiquez si le site est <b>Favorable</b>, <b>À confirmer</b> ou <b>Défavorable</b>, avec justification.</li>
<li><b>Envoyer au DG</b> : transmet le rapport au Directeur Général (partage natif, e-mail ou WhatsApp selon l'appareil).</li>
</ul>
<h3 style="color:#0A2540">3. Évaluation des agents</h3>
<p>Grille notée de 1 à 4, calcul automatique de la note globale et de la mention. Le bouton <b>Envoyer à l'agent</b> transmet la fiche pour l'aider à améliorer ses performances. <b>Exporter PDF</b> produit la version imprimable à signer.</p>
<h3 style="color:#0A2540">4. Carte</h3>
<p>Tous les sites géolocalisés sont plottés sur une carte <b>100 % hors-ligne</b> (aucune connexion requise). Couleurs : vert = favorable, orange = à confirmer, rouge = défavorable. Touchez un point pour afficher ses détails ; le bouton <b>Ouvrir dans OpenStreetMap</b> affiche le site sur une vraie carte quand une connexion est disponible. La feuille de coordonnées se remplit automatiquement et s'exporte en CSV.</p>
<h3 style="color:#0A2540">5. Archives &amp; exports</h3>
<p>Historique modifiable et supprimable. Exports : sauvegarde complète <b>JSON</b>, <b>CSV</b> des rapports, des évaluations et des coordonnées, et <b>PDF</b> via le bouton Exporter de chaque fiche.</p>
<h3 style="color:#0A2540">6. Paramètres</h3>
<p>Gérez les agents, les périmètres et les critères, les destinataires (e-mail / WhatsApp du DG) et l'<b>espace cloud partagé</b>.</p>
<h3 style="color:#0A2540">7. APK + logiciel connectés via le cloud</h3>
<p>L'application fonctionne comme <b>logiciel</b> (sur ordinateur, dans le navigateur) et comme <b>APK</b> (sur téléphone). Pour partager les mêmes données :</p>
<ol>
<li>Créez une base <b>Firebase Realtime Database</b> gratuite (console.firebase.google.com).</li>
<li>Copiez l'URL de la base, par ex. <code>https://votre-projet.firebaseio.com/unamdd.json</code>.</li>
<li>Collez-la dans <b>Paramètres → Espace cloud</b> sur le logiciel ET sur l'APK.</li>
<li>Utilisez <b>Envoyer</b> / <b>Récupérer</b> : dès qu'une connexion est disponible, les deux partagent les mêmes données.</li>
</ol>
<p>Sans cloud, l'application reste 100 % fonctionnelle en local (données sur l'appareil).</p>
<h3 style="color:#0A2540">8. Générer l'APK</h3>
<p>Hébergez le dossier en HTTPS puis utilisez <b>PWABuilder.com</b> (sans coder), <b>Capacitor</b> ou <b>Bubblewrap</b>. Détails dans le fichier README fourni.</p>
`;
function renderGuide(){ $('guideContent').innerHTML=GUIDE_HTML; }

/* ---------- DEMARRAGE ---------- */
function boot(){
  try{
    refreshSelects();
    renderSettings();
    renderGrid({});
    renderGuide();
    resetReport();
    resetEval();
    renderAll();
    const cv=$('mapCanvas'); if(cv){ cv.addEventListener('click', onMapClick); cv.addEventListener('touchstart', onMapClick, {passive:true}); }
    let rz; window.addEventListener('resize', ()=>{ clearTimeout(rz); rz=setTimeout(()=>{ renderDashboard(); if($('view-carte').classList.contains('active')) renderMap(); },200); });
  }catch(e){
    const t=document.getElementById('toast'); if(t){ t.textContent='Erreur de démarrage : '+e.message; t.classList.add('show'); }
    console.error('boot error', e);
  }
}
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

