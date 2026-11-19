/* Real-world political atlas. Projected national boundaries and adjacency come from campaign-data.js. */
(function (root) {
  'use strict';
  const sessions = new WeakMap();
  const sceneDescriptions = ['Forest clearing','Cavern','Ancient ruins','Fortress','Volcanic valley','Castle'];
  const scenes = ['slime-forest','crystal-cave','forgotten-ruins','skeleton-keep','dragon-lair','shadow-castle'];
  const width = 1000, height = 540;
  const xml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const round = n => Math.round(n * 10) / 10;
  function icon(type) {
    const types={
      banner:'<path d="M4 20V3m1 1c5-4 8 3 15-1v10c-6 3-9-3-15 1" />',
      sword:'<path d="m5 19 9-9m-4 0 4 4m0-4 1-5 5-2-2 6-4 1M3 19l2 2"/>',
      compass:'<circle cx="12" cy="12" r="8.5"/><path d="m16.5 7.5-3 6-6 3 3-6z"/>',
      keep:'<path d="M3 20h18M5 19V8H3V3h3v2h3V3h3v5H9v4h6V8h-2V3h3v2h2V3h3v5h-2v11M10 19v-4h4v4"/>',
      lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
      book:'<path d="M2 4c4-1 7-1 10 2 3-3 6-3 10-2v14c-4-1-7-1-10 2-3-3-6-3-10-2zM12 6v14"/>',
      Laurel:'<path d="m2 8 2 6 5 4m13-10-2 6-5 4M7 8l3 3 2-5 2 5 3-3-1 7H8z"/>',
      map:'<path d="m2 5 7-2 6 3 7-2v15l-7 2-6-3-7 2zM9 3v15m6-12v15"/>',
      edit:'<path d="m4 16 11-11 4 4L8 20l-5 1zM13 7l4 4"/>',
      chevron:'<path d="m8 10 4 4 4-4"/>'
    };
    return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+types[type]+'</svg>';
  }
  const major = new Set('USA CAN MEX BRA ARG CHL PER COL RUS CHN IND KAZ MNG AUS IDN JPN IRN SAU EGY DZA NGA COD ZAF GRC TUR FRA ESP DEU GBR FIN SWE GRL ETH SDN PAK UKR'.split(' '));
  const labelsAtWorld = new Set('CAN USA MEX BRA ARG RUS CHN IND AUS KAZ SAU DZA COD ZAF IDN'.split(' '));
  const oceanNames = [
    [-147,11,'Pacific Ocean'],[-37,28,'Atlantic Ocean'],[-19,-40,'South Atlantic'],
    [75,-32,'Indian Ocean'],[156,-36,'Pacific Ocean'],[59,76,'Arctic Ocean']
  ];
  const xof=lon=>(lon+180)*width/360, yof=lat=>(85-lat)*height/152;
  function effectiveView(game) {
    const view=game.campaignView(),era=root.DungeonEras.get(view.eraId||'modern'),book=game.lessonView(),run=book.active;
    const nations=view.nations.map(n=>{
      const admin=view.administration?.[n.id], reference=era.capitals.get(n.id);
      return {...n, name:admin?.countryName || n.name, originalName:n.name,
        capital:admin?.capitalName || reference?.name || n.capital || '',
        originalCapital:reference?.name || '', capitalNote:reference?.note || ''};
    });
    return {...view,era,nations,battleLessonFor:game.battleLessonFor,learning:root.DungeonLessons.tracker(book.sessions),factions:factions(view),fixedLesson:run?root.DungeonLessons.get(run.lessonId).title+' · '+root.DungeonLessons.levels[run.difficulty-1]:null};
  }
  function geographyName(n) { return n.name===n.originalName ? n.name : n.name+' ('+n.originalName+')'; }
  function coordinates(x,y) {
    const lat=85-y*152/height,lon=x*360/width-180;
    return Math.abs(lat).toFixed(2)+'°'+(lat<0?'S':'N')+' '+Math.abs(lon).toFixed(2)+'°'+(lon<0?'W':'E');
  }
  function availableSites(n,a,capitals) {
    const sites=[{name:'Current site',x:a.x,y:a.y}];
    if (a.customLocation) sites.push({name:'Original capital site',x:a.originalX,y:a.originalY,reset:true});
    // Each suggested site must lie on this country's land, including very small islands.
    for (const [label,dx,dy] of [['Northern site',0,-1],['Eastern site',1,0],['Southern site',0,1],['Western site',-1,0]]) {
      for (const d of [60,36,21,12,7,4,2,1,.5,.25,.1,.05,.02,.01,.004,.001]) {
        const x=a.x+dx*d,y=a.y+dy*d;
        if (!capitals.containsPoint(n.id,x,y)) continue;
        sites.push({name:label,x,y});
        break;
      }
    }
    return sites;
  }
  const playerGold='#e5bb64';
  function factions(view) {
    return [{id:'player',name:view.empireName || 'Your empire',color:playerGold,owned:view.owned}, ...(view.rivals || [])];
  }
  function ownerOf(view,id) {
    return view.owners?.[id] || (view.owned.includes(id)?'player':'neutral');
  }
  function ownerStyle(view,id) {
    return view.factions.find(f=>f.id===ownerOf(view,id));
  }
  function countryFill(view,nation,faction) {
    return faction?.color || (view.rivals?.length?'#a6b5a6':nation.color || '#98ad91');
  }
  function disputed(view,nation) {
    if (!view.rivals?.length || !view.frontier.includes(nation.id)) return false;
    const rivalControls=id=>view.rivals.some(r=>r.id===ownerOf(view,id));
    return rivalControls(nation.id) || nation.neighbors.some(rivalControls);
  }
  function swatch(color) {
    return '<i class="cm-owner-swatch" aria-hidden="true" style="--empire-color:'+xml(color)+'"></i>';
  }
  function battleMath(view,defender,countryId) {
    const p=view.progression;
    if (!p) return '';
    const plan=view.battleLessonFor(countryId), lesson=root.DungeonLessons.get(plan.lessonId);
    const level=root.DungeonLessons.levels[plan.difficulty-1];
    const mastery=level && lesson && view.learning.lessons.find(item=>item.lessonId===lesson.id);
    const skill=[lesson?.title,level].filter(Boolean).join(' · ') || 'Math practice';
    const spells=defender?.spellsLeft;
    const pace=spells===1?'1 problem to capture':spells>1?'Up to '+spells+' problems to capture':'';
    return '<div class="cm-battle-math" data-campaign-math>'+icon('book')+'<div><span>Battle math</span><strong>'+xml(skill)+'</strong>'+
      (pace?'<b data-capture-pace>'+pace+'</b>':'')+
      (mastery?'<small class="cm-lesson-progress">'+(mastery.mastered?'Mastered · Extra practice':Math.min(3,mastery.qualifying)+' / 3 independent Core or Challenge problems toward mastery')+'</small>':'')+
      (view.mathMode==='classic' && !level && p.nextAt?'<small>At '+p.nextAt+' countries, practice '+xml(p.nextLabel.toLowerCase())+'.</small>':'')+'</div></div>';
  }
  function standings(view) {
    if (!view.rivals?.length) return '';
    const ranked=[...view.factions].sort((a,b)=>b.owned.length-a.owned.length);
    const winner=view.factions.find(f=>f.id===view.winner);
    const goal=winner?winner.name+' won the race.':'Hold '+view.raceGoal+' countries or take every rival country to win.';
    const moves=view.rivalMoves || [];
    const reports=moves.map(move=>{
      const previous=view.factions.find(f=>f.id===move.from);
      return '<li>'+swatch(view.factions.find(f=>f.id===move.rivalId)?.color || '#aaa')+'<span><b>'+xml(move.name)+'</b> claimed '+countryButton(view.nations[move.countryId])+(previous?' from '+xml(previous.name):'')+'.</span></li>';
    }).join('');
    return '<section class="cm-standings" data-empire-standings data-race-goal="'+view.raceGoal+'" data-race-winner="'+xml(view.winner || '')+'" aria-label="Empire standings"><header><div><h2>Empire standings</h2><p>'+xml(goal)+'</p></div><span data-rival-turn>Turn '+view.turn+'</span></header>'+
      '<ol class="cm-empire-scores">'+ranked.map(f=>'<li data-empire-id="'+xml(f.id)+'">'+swatch(f.color)+'<span>'+xml(f.name)+'</span><b aria-label="'+f.owned.length+' countries">'+f.owned.length+'</b></li>').join('')+'</ol>'+
      '<div class="cm-rival-news" data-rival-activity>'+(reports?'<h3>Latest moves</h3><ul>'+reports+'</ul>':winner?'':'<p>Each rival can claim one neighboring country after you capture a country.</p>')+'</div></section>';
  }
  function openEmpires(container,game,actions) {
    if (document.querySelector('dialog.cm-empires-dialog[open]')) return;
    const dialog=document.createElement('dialog');
    dialog.className='cm-empires-dialog';
    dialog.setAttribute('aria-labelledby','cm-empires-heading');
    document.body.append(dialog);
    let removal=null;
    const suggestions=['Rival Empire 1','Rival Empire 2','Rival Empire 3','Rival Empire 4'];
    function draw(message='',focus='') {
      const v=effectiveView(game), rivals=v.rivals || [];
      const rivalRows=rivals.map(r=>{
        const confirming=removal===r.id;
        return '<li class="cm-rival-row" data-rival-id="'+xml(r.id)+'"><div>'+swatch(r.color)+'<span><strong>'+xml(r.name)+'</strong><small>'+xml(v.nations[r.homeId].name)+' · '+r.owned.length+' '+(r.owned.length===1?'country':'countries')+'</small></span></div>'+
          (confirming?'<div class="cm-release"><p>Return its '+r.owned.length+' '+(r.owned.length===1?'country':'countries')+' to neutral control?</p><button type="button" data-keep-rival>Keep empire</button><button type="button" data-release-rival="'+xml(r.id)+'">Remove empire</button></div>':
          '<button class="cm-remove-rival" type="button" data-remove-rival="'+xml(r.id)+'" aria-label="Remove '+xml(r.name)+'">Remove</button>')+'</li>';
      }).join('');
      const available=v.nations.filter(n=>ownerOf(v,n.id)==='neutral' && n.id!==v.targetId && !rivals.some(r=>r.homeId===n.id)).sort((a,b)=>a.name.localeCompare(b.name));
      const suggestion=suggestions.find(n=>!v.factions.some(f=>f.name.toLowerCase()===n.toLowerCase())) || '';
      const nearby=v.frontier?.find(id=>available.some(n=>n.id===id));
      const preferred=nearby ?? available[0]?.id;
      const canAdd=!v.needsCapital && rivals.length<3 && available.length>0 && !v.winner && !v.victory;
      const add=canAdd?'<form data-rival-form class="cm-create-rival"><h3>Create a rival</h3><div class="cm-rival-fields"><label>Empire name<input type="text" data-rival-name required maxlength="32" value="'+xml(suggestion)+'"></label><label>Starting country<select data-rival-home>'+available.map(n=>'<option value="'+n.id+'"'+(n.id===preferred?' selected':'')+'>'+xml(geographyName(n))+'</option>').join('')+'</select></label></div><button type="submit" data-add-rival>Add rival empire</button></form>':
        '<p class="cm-rival-limit">'+(v.needsCapital?'Choose your home country on the map to add computer rivals.':rivals.length>=3?'All three rival slots are filled.':v.winner||v.victory?'This race has finished.':'Every country already belongs to an empire.')+'</p>';
      dialog.innerHTML='<div class="cm-empire-dialog-inner"><header><div><span class="cm-modal-banner">'+icon('banner')+'</span><h2 id="cm-empires-heading">Manage empires</h2></div><button type="button" data-empires-close aria-label="Close empire settings">×</button></header>'+
        '<form class="cm-player-name" data-player-form><label>Your empire name<input type="text" data-player-empire-name required maxlength="32" value="'+xml(v.empireName || 'Your empire')+'"></label><button type="submit" data-save-player-empire>Save name</button></form>'+
        '<section aria-label="Computer empires"><h3>Computer rivals</h3><p class="cm-rival-intro">Add up to three. Each rival starts in its own country and takes a turn after each of your captures.</p>'+
        (rivalRows?'<ul class="cm-rival-list">'+rivalRows+'</ul>':'')+'</section>'+add+
        '<p class="cm-empire-feedback" data-empires-message role="status" aria-live="polite">'+xml(message)+'</p></div>';
      if(focus) dialog.querySelector(focus)?.focus({preventScroll:true});
    }
    function sync(message,focus) {
      render(container,game,actions);
      removal=null;draw(message,focus);
    }
    function report(text) {
      const note=dialog.querySelector('[data-empires-message]');
      note.textContent=text;note.classList.add('is-error');
    }
    dialog.addEventListener('submit',e=>{
      e.preventDefault();
      if(e.target.matches('[data-player-form]')) {
        const name=dialog.querySelector('[data-player-empire-name]').value;
        if(!game.setEmpireName(name)) return report('Choose a distinct empire name of 1–32 characters.');
        return sync('Your empire name is saved.','[data-player-empire-name]');
      }
      if(e.target.matches('[data-rival-form]')) {
        const name=dialog.querySelector('[data-rival-name]').value;
        const home=Number(dialog.querySelector('[data-rival-home]').value);
        if(!game.addRival(name,home)) return report('Choose a distinct name of 1–32 characters and an unclaimed starting country.');
        sync(name.trim()+' joined the campaign.','[data-empires-close]');
      }
    });
    dialog.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button)return;
      if(button.hasAttribute('data-empires-close')) {dialog.close();return;}
      if(button.hasAttribute('data-remove-rival')) {removal=button.dataset.removeRival;draw('','[data-keep-rival]');return;}
      if(button.hasAttribute('data-keep-rival')) {removal=null;draw('','[data-remove-rival]');return;}
      if(button.hasAttribute('data-release-rival') && game.removeRival(button.dataset.releaseRival)) sync('Rival removed. Its countries are neutral.','[data-empires-close]');
    });
    dialog.addEventListener('close',()=>{dialog.remove();container.querySelector('[data-empires]')?.focus({preventScroll:true});},{once:true});
    draw();dialog.showModal();dialog.querySelector('[data-empires-close]').focus({preventScroll:true});
  }
  function status(v,id){return v.needsCapital?'available':v.owned.includes(id)?'owned':v.frontier.includes(id)?'frontier':'locked';}
  function statusText(v,n){
    return v.needsCapital?'Available home country':n.id===v.capitalId?'Your home country':
      {owned:'Your empire',frontier:'Open frontier',locked:'Beyond your frontier'}[status(v,n.id)];
  }
  function initial(v) {
    if(v.needsCapital || v.victory) return v.capitalId;
    if(v.frontier.includes(v.targetId)) return v.targetId;
    return v.frontier.slice().sort((a,b)=>(v.defenders?.[a]?.hp||0)-(v.defenders?.[b]?.hp||0) || a-b)[0] ?? v.capitalId;
  }
  const gridLines=[];
  for(let lon=-150;lon<=150;lon+=30) gridLines.push('M'+round(xof(lon))+' 0v540');
  for(let lat=-60;lat<=75;lat+=15) gridLines.push('M0 '+round(yof(lat))+'h1000');
  const gridPath=gridLines.join('');
  function projectedWorld(v) {
    const board=v.era.board;
    const land=board.landPath || board.LAND_PATH || '';
    const countries = v.nations.map(n=>{
      const s=status(v,n.id);
      const faction=ownerStyle(v,n.id),contested=disputed(v,n);
      const fill=countryFill(v,n,faction);
      const description=geographyName(n)+' · '+statusText(v,n)+(faction?' · '+faction.name:'')+(contested?' · Disputed frontier':'');
      return '<g class="cm-country cm-'+s+(faction&&faction.id!=='player'?' cm-rival-country':'')+'" role="button" tabindex="-1" data-iso3="'+xml(n.code)+'" data-status="'+s+'" data-owner="'+xml(faction?.id || 'neutral')+'" data-contested="'+contested+'" data-territory-id="'+n.id+'" aria-pressed="false" aria-label="'+xml(description)+'"><title>'+xml(description)+'</title><path class="cm-ground" d="'+xml(n.path||'')+'" fill="'+xml(fill)+'" vector-effect="non-scaling-stroke"/></g>';
    }).join('');
    const oceans=oceanNames.map(([lon,lat,t])=>'<text x="'+round(xof(lon))+'" y="'+round(yof(lat))+'">'+t+'</text>').join('');
    return '<svg class="cm-map" tabindex="-1" viewBox="0 0 '+width+' '+height+'" role="group" aria-label="Real-world political map. Arrow keys select nearby countries. Enter opens country actions.">'+
      '<defs><radialGradient id="cm-water"><stop stop-color="#376777"/><stop offset=".7" stop-color="#294f60"/><stop offset="1" stop-color="#1c3b4e"/></radialGradient>'+
      '<pattern id="cm-wave" width="67" height="46" patternUnits="userSpaceOnUse"><path d="M5 12h3l2-1 2 1h4m33 22h6" fill="none" stroke="#9ebfac" stroke-width=".85" opacity=".24"/></pattern>'+
      '<pattern id="cm-distant" width="5.5" height="5.5" patternUnits="userSpaceOnUse"><path d="M-2 5.5 5.5-2m0 7.5 5.5-5.5" fill="none" stroke="#849788" stroke-width=".6"/></pattern>'+
      '<g id="cm-compass"><circle r="12" fill="none" stroke="#c0b28d"/><path d="m0-19 3 15 11 4-11 3-3 13-3-13-11-3 11-4z" fill="#cabb90" stroke="#344f54" stroke-width="1.1"/><path d="M0-17V0l3-4zm0 17v14l-3-11z" fill="#688680"/><text y="-23" text-anchor="middle" fill="#d9cbaa" font-family="Georgia,serif" font-weight="700" font-size="8">N</text></g></defs>'+
      '<rect width="1000" height="540" fill="url(#cm-water)"/><rect width="1000" height="540" fill="url(#cm-wave)"/><path class="cm-graticule" d="'+gridPath+'"/>'+
      '<g class="cm-sea-type" aria-hidden="true">'+oceans+'</g><path d="'+xml(land)+'" fill="#829489" stroke="#76897d" stroke-width=".7"/><path d="'+xml(land)+'" fill="url(#cm-distant)"/>'+
      countries+'<g class="cm-overlay" aria-hidden="true"><path d="'+xml(v.era.capitals.lakePath || '')+'" fill="#507e88" fill-rule="evenodd"/><g data-routes></g><path data-selection-outline class="cm-select-outline" fill="none" vector-effect="non-scaling-stroke"/><path data-selection-dash class="cm-select-dash" fill="none" vector-effect="non-scaling-stroke"/></g><g data-map-labels></g></svg>';
  }
  const previews=new WeakMap();
  function previewElement(tag,attributes,parent) {
    const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [name,value] of Object.entries(attributes)) node.setAttribute(name,value);
    if(parent) parent.append(node);
    return node;
  }
  function buildPreview(container,view) {
    const svg=previewElement('svg',{class:'cm-preview-atlas','aria-hidden':'true',focusable:'false',
      viewBox:'0 0 '+width+' '+height,preserveAspectRatio:'xMidYMid meet','data-preview-era':view.eraId});
    previewElement('path',{class:'cm-graticule',d:gridPath},svg);
    previewElement('path',{d:view.board.landPath || view.board.LAND_PATH || '',fill:'#829489'},svg);
    const shapes=view.nations.map(nation=>previewElement('path',{
      class:'cm-preview-country',d:nation.path || '','data-preview-country':nation.code
    },svg));
    previewElement('path',{d:view.capitals.lakePath || '',fill:'#507e88','fill-rule':'evenodd'},svg);
    const markers=previewElement('g',{},svg);
    container.replaceChildren(svg);
    const preview={svg,shapes,markers,board:view.board,stamp:null};
    previews.set(container,preview);
    return preview;
  }
  function renderPreview(container,view) {
    let preview=previews.get(container);
    if(!preview || preview.board!==view.board || container.firstElementChild!==preview.svg) preview=buildPreview(container,view);
    const seat=view.needsCapital?null:view.nations[view.seatId];
    const seatSite=seat && (view.administration[seat.id] || seat);
    const target=view.frontier.includes(view.targetId)?view.nations[view.targetId]:null;
    const stamp=JSON.stringify([view.needsCapital,view.owned,view.owners,view.frontier,
      view.rivals.map(r=>[r.id,r.color]),seat?.id,seatSite?.x,seatSite?.y,target?.id]);
    if(stamp===preview.stamp)return;
    preview.stamp=stamp;
    const palette={...view,factions:factions(view)};
    preview.markers.replaceChildren();
    for(const nation of view.nations) {
      const shape=preview.shapes[nation.id],faction=ownerStyle(palette,nation.id);
      const owner=faction?.id || 'neutral',color=countryFill(view,nation,faction),state=status(view,nation.id);
      if(shape.dataset.owner!==owner) shape.dataset.owner=owner;
      if(shape.getAttribute('fill')!==color) shape.setAttribute('fill',color);
      if(shape.dataset.previewStatus!==state) shape.dataset.previewStatus=state;
      if(nation.tiny && faction && nation!==seat && nation!==target) {
        previewElement('circle',{cx:nation.x,cy:nation.y,r:5.6,fill:color,class:'cm-preview-holding',
          'data-preview-holding':nation.code},preview.markers);
      }
    }
    if(target) previewElement('g',{transform:'translate('+target.x+' '+target.y+')','data-preview-target':target.code},preview.markers)
      .append(previewElement('circle',{r:12,class:'cm-preview-target-ring'}),
        previewElement('circle',{r:3.8,fill:'#fff7dc'}));
    if(seat) previewElement('path',{transform:'translate('+seatSite.x+' '+seatSite.y+')','data-preview-seat':seat.code,
      d:'M0-15 4-5 15-4 7 3 9 14 0 8-9 14-7 3-15-4-4-5Z',class:'cm-preview-seat'},preview.markers);
  }
  function countryButton(n,cls='') {
    return '<button type="button" class="cm-country-link '+cls+'" data-select-id="'+n.id+'">'+xml(n.name)+'</button>';
  }
  function details(state) {
    const v=state.view,n=v.nations[state.selected],s=status(v,n.id),owned=s==='owned', home=!v.needsCapital&&n.id===v.capitalId;
    const capital=v.nations[v.capitalId], defender=v.defenders?.[n.id] || (v.targetId===n.id?v.defender:null);
    const water = n.seaNeighbors || [];
    const adjacent = n.neighbors || [];
    const border=adjacent.filter(id=>v.owned.includes(id));
    const open=adjacent.filter(id=>!v.owned.includes(id)&&!v.frontier.includes(id));
    const route=adjacent.filter(id=>v.frontier.includes(id))[0] ?? initial(v);
    const rank={normal:'Guard',special:'Elite guard',boss:'Boss guard'}[defender?.kind||n.rank] || 'Guard';
    const summary=v.needsCapital?'Start here to claim your first country.':v.victory?'You now control every playable country.':owned?
      (n.id===v.seatId?'Your empire is governed from '+n.capital+'.':home?'This is where your campaign began.':'This country now belongs to your empire.'):s==='locked'?
      'Capture a neighboring country or reach this country by a marked sea crossing.':'Defeat the guardian to claim this country.';
    const button=v.needsCapital?'<button type="button" class="cm-primary" data-home="'+n.id+'">'+icon('banner')+'Start in '+xml(n.name)+'</button>':
      s==='frontier'?'<button type="button" class="cm-primary" '+(v.targetId===n.id?'data-resume':'data-invade="'+n.id+'"')+'>'+icon('sword')+(v.targetId===n.id?'Resume battle':'Fight for '+xml(n.name))+'</button>':
      v.victory?'<button type="button" class="cm-primary" data-practice>'+icon('book')+'Choose a lesson</button>':
      '<button type="button" class="cm-secondary" data-select-id="'+route+'">'+icon('compass')+'Inspect '+xml(v.nations[route].name)+'</button>';
    const lists=(title,ids)=>ids.length?'<div class="cm-geo-links"><span>'+title+'</span><p>'+ids.map(id=>countryButton(v.nations[id])).join('<span class="cm-comma">, </span>')+'</p></div>':'';
    const entering=s==='frontier'?lists('Reachable from',border):'';
    const newFrontiers=s==='frontier'?'<div class="cm-routes"><span>New frontiers after victory</span><p>'+(open.length?open.map(id=>countryButton(v.nations[id])).join('<span class="cm-comma">, </span>'):'No new frontiers. Victory secures this part of your border.')+'</p></div>':'';
    const guard=defender&&!owned&&!v.needsCapital?'<div class="cm-guard"><div><span>'+rank+'</span><strong>'+xml(defender.name)+'</strong></div><span class="cm-hp">'+defender.hp+' / '+defender.maxHp+' HP</span><span class="cm-hpbar"><i style="width:'+Math.max(0,Math.min(100,100*defender.hp/defender.maxHp))+'%"></i></span></div>':'';
    const geography=[n.name!==n.originalName?n.originalName:'',n.region].filter(Boolean).map(xml).join(' &nbsp;·&nbsp; ');
    const guide=root.DungeonCountryGuide;
    const flag=guide.flagMarkup(v.era,n);
    const faction=ownerStyle(v,n.id);
    const owner=v.needsCapital?'':'<div class="cm-country-owner" data-country-owner="'+xml(faction?.id || 'neutral')+'">'+swatch(faction?.color || '#a6b5a6')+'<span>'+xml(faction?.name || 'Independent country')+'</span>'+(disputed(v,n)?'<b>Disputed frontier</b>':'')+'</div>';
    const admin=v.administration?.[n.id];
    const capitalLine=n.capital?'<div class="cm-capital-info"><span>Capital</span><strong data-capital-name-display>'+xml(n.capital)+'</strong>'+
      (!v.needsCapital&&v.seatId===n.id?'<span class="cm-seat-badge">★ Empire seat</span>':'')+
      (admin?'<button type="button" data-locate-capital>Locate on map</button>':'')+'</div>':'';
    const originalCapital=n.originalCapital && n.originalCapital!==n.capital?'<p class="cm-capital-reference">Real-world capital · '+xml(n.originalCapital)+'</p>':'';
    const geographyNote=n.capitalNote?'<p class="cm-capital-reference">'+xml(n.capitalNote)+'</p>':'';
    const holdings=n.dependencies || [];
    const holdingsList=holdings.length?'<details class="cm-historical-notes"><summary>Territories on this map ('+holdings.length+')</summary><p>'+holdings.map((name,i)=>'<button type="button" class="cm-country-link" data-locate-holding="'+i+'">'+xml(name)+'</button>').join(', ')+'</p></details>':'';
    const manage=owned?'<button type="button" class="cm-manage" data-manage="'+n.id+'">'+icon('edit')+'Manage country</button>':'';
    return '<div class="cm-detail-body"><span class="cm-status is-'+s+'">'+icon(owned?'banner':s==='frontier'?'sword':v.needsCapital?'compass':'lock')+statusText(v,n)+'</span>'+
      '<div class="cm-country-heading">'+flag+'<h2>'+xml(n.name)+'</h2></div>'+
      (geography?'<p class="cm-geography">'+geography+'</p>':'')+
      owner+capitalLine+originalCapital+geographyNote+
      '<button class="cm-profile-open" type="button" data-action="country-profile" aria-haspopup="dialog">'+icon('book')+'<span><strong>Country profile</strong><small>'+xml(guide.preview(v.era,n))+'</small></span><span class="cm-profile-arrow" aria-hidden="true">→</span></button>'+
      holdingsList+manage+
      '<div class="cm-battle-scene" style="background-image:url(assets/'+scenes[n.biome]+'.webp)"><span>Battlefield preview</span><strong>'+xml(sceneDescriptions[n.biome])+'</strong></div>'+
      guard+battleMath(v,!owned&&!v.needsCapital?defender:null,n.id)+'<p class="cm-callout">'+xml(summary)+'</p>'+button+entering+newFrontiers+
      lists('Game sea crossings',water)+lists('Overland expeditions',n.expeditionNeighbors||[])+(v.needsCapital?'<div class="cm-routes"><span>Starting position</span><p>'+adjacent.length+' reachable '+(adjacent.length===1?'country':'countries')+' from this home.</p></div>':'')+'</div>';
  }
  function render(container,game,actions={},options={}) {
    const previous=sessions.get(container), v=effectiveView(game);
    previous?.abort.abort();
    const prior=previous?.view.era.id===v.era.id?previous:null;
    let capture=options.capturedId;
    if(!Number.isInteger(capture)||!v.owned.includes(capture)) capture=null;
    const justChose=prior?.view.needsCapital && !v.needsCapital;
    const selected=capture??(!justChose && prior?.game===game && v.nations[prior.selected]?prior.selected:initial(v));
    const active=container.contains(document.activeElement)?document.activeElement:null;
    const oldFocus=active?.hasAttribute('data-territory-id')?'country':active?.hasAttribute('data-pick')?'pick':active?.matches('[data-home],[data-invade],[data-resume]')?'fight':null;
    const state={game,view:v,selected,zoom:prior?.zoom||1,cx:prior?.cx??width/2,cy:prior?.cy??height/2,abort:new AbortController()};
    sessions.set(container,state);
    const capital=v.nations[v.capitalId], customName=v.empireName && v.empireName!=='Your empire';
    const prefix=customName?v.empireName:(v.needsCapital?'World conquest':capital.name+' campaign');
    const winner=v.factions.find(f=>f.id===v.winner);
    const title=v.victory?'World conquered':winner?'Empire race complete':'Campaign map';
    const summary=v.needsCapital?'Choose your home country. Add rival empires to race for control of the map.':
      winner?winner.name+' won the empire race. You can keep exploring the world.':
      capture!==null?v.nations[capture].name+' now belongs to your empire. Choose your next frontier.':
      v.victory?'Every playable country is yours.':v.rivals?.length?'Race to hold '+v.raceGoal+' countries. Rivals move after each capture.':'Choose a bordering country or follow a sea crossing. Win its battle to expand your empire.';
    const eraOptions=root.DungeonEras.list.map(era=>'<option value="'+xml(era.id)+'"'+(era.id===v.era.id?' selected':'')+'>'+xml(era.title)+'</option>').join('');
    const credit=v.era.id==='modern'?'':'<details class="cm-era-credits"><summary>Historical map notes and credits</summary><p>'+xml(v.era.notes || '')+'</p><p>Border and capital data from CShapes 2.0 by Guy Schvitz, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann and Kristian Skrede Gleditsch (ETH Zürich). The dated boundaries were grouped and simplified for play. Game sea crossings connect the map. Adapted historical atlas licensed under Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International.</p></details>';
    const mode=v.mathMode || 'curriculum';
    const mathSelect='<section class="cm-learning"><div class="cm-learning-mode"><label for="campaign-math-mode">Battle lessons</label><select data-campaign-math-mode id="campaign-math-mode">'+
      (mode==='fixed'?'<option value="fixed" selected>'+xml(v.fixedLesson || 'Selected lesson')+'</option>':'')+
      '<option value="curriculum"'+(mode==='curriculum'?' selected':'')+'>Grade 5 mastery path</option><option value="classic"'+(mode==='classic'?' selected':'')+'>Classic decimal campaign</option></select></div>'+
      '<button type="button" data-campaign-lesson>Choose a lesson</button><button type="button" data-campaign-progress>'+v.learning.mastered+' / '+v.learning.total+' lessons mastered</button></section>';
    const eraPicker='<section class="cm-era"><label for="campaign-era">Campaign era</label><select id="campaign-era" data-campaign-era>'+eraOptions+'</select><p>'+xml(v.era.description)+'</p>'+credit+'</section>';
    container.innerHTML='<div class="cm-shell"><header class="cm-heading"><div><div class="cm-empire-name">'+icon('banner')+xml(prefix)+'</div><h1>'+title+'</h1><p>'+xml(summary)+'</p></div><div class="cm-heading-tools"><button class="cm-setup-empires" type="button" data-empires>'+icon('banner')+'Manage empires</button><div class="cm-score" aria-label="'+v.claimed+' of '+v.total+' countries"><span>'+icon('keep')+'</span><div><strong>'+v.claimed+' <small>/ '+v.total+'</small></strong><b>Countries held</b></div></div></div></header>'+eraPicker+mathSelect+
      '<div class="cm-layout"><div class="cm-map-column"><section class="cm-atlas" aria-label="World campaign map"><div class="cm-atlas-tools"><div class="cm-search-wrap">'+icon('compass')+'<input type="search" data-search autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="cm-results" aria-expanded="false" aria-label="Find a country" placeholder="Find a country"><ul id="cm-results" role="listbox" hidden></ul></div><button class="cm-world-view" data-fit type="button">'+icon('map')+'World view</button></div><div class="cm-viewport">'+projectedWorld(v)+'</div>'+
      '<div class="cm-map-notice" data-map-notice hidden><span data-map-message></span><button type="button" data-stop-placing>Keep current site</button></div>'+
      '<div class="cm-mapbar"><div class="cm-key"><span><i class="cm-key-held"></i>Your empire</span><span><i class="cm-key-front"></i>Open frontier</span>'+((v.rivals || []).length?'<span><i class="cm-key-disputed"></i>Disputed frontier</span>':'')+'<span><i class="cm-key-sea"></i>Sea crossing</span>'+(!v.needsCapital?'<span><b class="cm-seat-key">★</b>Empire seat</span>':'')+'</div><div class="cm-zoom"><button data-zoom="-1" aria-label="Zoom out" type="button">−</button><output>100%</output><button data-zoom="1" aria-label="Zoom in" type="button">+</button></div></div></section>'+standings(v)+'</div>'+
      '<aside class="cm-dossier"><div class="cm-picker"><label for="cm-country-pick">Inspect country</label><div class="cm-select-wrap"><select data-pick id="cm-country-pick">'+[...v.nations].sort((a,b)=>a.name.localeCompare(b.name)).map(n=>'<option value="'+n.id+'">'+xml(geographyName(n))+'</option>').join('')+'</select>'+icon('chevron')+'</div></div><div class="cm-detail"></div></aside></div>'+
      '<div class="cm-bottom"><span>'+icon('compass')+'<span>'+(v.needsCapital?v.total+' playable countries':v.frontier.length+' open '+(v.frontier.length===1?'frontier':'frontiers'))+'</span></span><button type="button" data-practice>'+icon('book')+'Choose a lesson</button></div><p class="cm-sr" aria-live="polite" data-announcement></p></div>';
    const svg=container.querySelector('.cm-map'),picker=container.querySelector('[data-pick]'),panel=container.querySelector('.cm-detail');
    const labels=svg.querySelector('[data-map-labels]'),routes=svg.querySelector('[data-routes]'),search=container.querySelector('[data-search]'),list=container.querySelector('#cm-results');
    const countries=[...svg.querySelectorAll('[data-territory-id]')];
    const opts={signal:state.abort.signal};
    container.querySelector('[data-campaign-era]').addEventListener('change', e=>{
      actions.onEra?.(e.target.value);
      container.querySelector('[data-campaign-era]')?.focus({preventScroll:true});
    },opts);
    container.querySelector('[data-campaign-math-mode]').addEventListener('change',e=>{
      if(game.setCampaignMath(e.target.value)){
        render(container,game,actions);
        container.querySelector('[data-campaign-math-mode]').focus({preventScroll:true});
      }
    },opts);
    container.querySelector('[data-campaign-lesson]').addEventListener('click',()=>actions.onLesson?.(v.frontier.includes(state.selected)?state.selected:null),opts);
    container.querySelector('[data-campaign-progress]').addEventListener('click',()=>actions.onProgress?.(),opts);
    const mapNotice=container.querySelector('[data-map-notice]');
    let editor=null;
    function announce(t){container.querySelector('[data-announcement]').textContent=t;}
    function limits(){
      const w=width/state.zoom,h=height/state.zoom;
      state.cx=Math.max(w/2,Math.min(width-w/2,state.cx)); state.cy=Math.max(h/2,Math.min(height-h/2,state.cy));
      return {x:state.cx-w/2,y:state.cy-h/2,w,h};
    }
    function drawRoutes(){
      const n=v.nations[state.selected], expeditions=n.expeditionNeighbors||[], ids=[...(n.seaNeighbors||[]),...expeditions];
      const previous=routes.getAttribute('data-focus'), routeKey=n.id+'/'+state.zoom.toFixed(2);
      if(previous===routeKey) return;
      routes.setAttribute('data-focus',routeKey);
      const curves=ids.map(id=>{
        const b=v.nations[id]; if(!b) return '';
        const link=n.routes?.find(route=>route.to===id);
        const start=link?{x:link.fromX,y:link.fromY}:n, end=link?{x:link.toX,y:link.toY}:b;
        // Wrap trans-Pacific crossings at the dateline.
        let dx=end.x-start.x;
        if(Math.abs(dx)>width/2) dx+=dx>0?-width:width;
        const x2=start.x+dx, dy=end.y-start.y, dist=Math.hypot(dx,dy), bend=Math.min(dist*.16,18);
        const cx=(start.x+x2)/2-dy/Math.max(1,dist)*bend,cy=(start.y+end.y)/2+dx/Math.max(1,dist)*bend;
        const d='M'+round(start.x)+' '+round(start.y)+'Q'+round(cx)+' '+round(cy)+' '+round(x2)+' '+round(end.y);
        const attr=expeditions.includes(id)?'data-expedition-route':'data-sea-route';
        return '<g><path '+attr+' data-from="'+n.id+'" data-to="'+id+'" d="'+d+'" class="cm-sea-route" fill="none" vector-effect="non-scaling-stroke"/>'+(Math.abs(x2-end.x)>1?'<path d="'+d+'" transform="translate('+(x2<0?width:-width)+' 0)" class="cm-sea-route" fill="none" vector-effect="non-scaling-stroke"/>':'')+'</g>';
      });
      routes.innerHTML=curves.join('');
    }
    function drawLabels(rect) {
      const zoom=state.zoom,unit=rect.w/Math.max(300,svg.getBoundingClientRect().width);
      const size=unit*(zoom<1.6?11:12.2);
      const names=v.nations.filter(n=>n.x>=rect.x-6*unit&&n.x<=rect.x+rect.w+6*unit&&n.y>=rect.y-6*unit&&n.y<=rect.y+rect.h+6*unit);
      const historical=v.era.id!=='modern';
      const prominent=new Set(historical?[...v.nations].sort((a,b)=>(b.mapArea||b.path.length)-(a.mapArea||a.path.length)).slice(0,18).map(n=>n.id):[]);
      const score=n=>n.id===state.selected?1000:n.id===v.seatId&&!v.needsCapital?850:n.id===v.capitalId&&!v.needsCapital?800:labelsAtWorld.has(n.code)||prominent.has(n.id)?400:major.has(n.code)?350:v.frontier.includes(n.id)?200:0;
      names.sort((a,b)=>score(b)-score(a)||a.id-b.id);
      const occupied=[], output=[];
      for(const n of names){
        const selected=n.id===state.selected,home=!v.needsCapital&&n.id===v.capitalId;
        const featured=selected||home||n.id===v.seatId||n.name!==n.originalName;
        if(!featured&&!major.has(n.code)&&!prominent.has(n.id)&&zoom<1.6) continue;
        if(!featured&&!labelsAtWorld.has(n.code)&&!prominent.has(n.id)&&zoom<1.15) continue;
        if(!featured&&n.tiny&&zoom<3.5) continue;
        const label=!historical&&n.name.length>19&&zoom<3&&!featured?n.code:n.name;
        const lx=n.x,ly=n.y+(selected||home?size*.95:0);
        const half=label.length*size*.265, r={l:lx-half-2*unit,r:lx+half+2*unit,t:ly-size,b:ly+size*.17};
        if(!selected&&occupied.some(q=>r.l<q.r&&q.l<r.r&&r.t<q.b&&q.t<r.b)) continue;
        occupied.push(r);
        const color=selected?'#fff1c4':'#253d38',halo=selected?'#223e40':'#f5e9cb';
        let marker='';
        if(selected||home) marker='<path transform="translate('+n.x+' '+round(n.y-size*.48)+') scale('+unit+')" d="m0-4.5 4.5 4.5L0 4.5-4.5 0z" fill="'+(home?'#ffcf72':'#fff6cf')+'" stroke="#294946" stroke-width="1.3"/>';
        output.push('<g class="cm-place-label">'+marker+'<text x="'+round(lx)+'" y="'+round(ly)+'" style="font-size:'+size+'px;stroke-width:'+(selected?3.1:2.15)*unit+'px;fill:'+color+';stroke:'+halo+'">'+xml(label)+'</text></g>');
      }
      const holdingLabels=[];
      if(historical){
        const holdings=v.nations.flatMap(n=>(n.dependencyDetails||[]).map(site=>({n,site})))
          .filter(({site})=>Number.isFinite(site.x) && site.x>=rect.x && site.x<=rect.x+rect.w && site.y>=rect.y && site.y<=rect.y+rect.h)
          .sort((a,b)=>Number(b.site===state.focusedSite)-Number(a.site===state.focusedSite)||(b.site.mapArea||0)-(a.site.mapArea||0));
        for(const {n,site} of holdings) {
          const focused=site===state.focusedSite;
          if(!focused && (zoom<1.5 || (site.mapArea||0)*zoom*zoom<100)) continue;
          const half=site.name.length*size*.23, r={l:site.x-half,r:site.x+half,t:site.y-size,b:site.y+size*.3};
          if(!focused && occupied.some(q=>r.l<q.r&&q.l<r.r&&r.t<q.b&&q.t<r.b))continue;
          occupied.push(r);
          holdingLabels.push('<g class="cm-place-label cm-holding-label"><title>'+xml(site.name+' · '+n.name)+'</title><text '+(focused?'data-focused-territory ':'')+'x="'+site.x+'" y="'+site.y+'" style="font-size:'+size*.84+'px;stroke-width:'+size*.17+'px">'+xml(site.name)+'</text></g>');
        }
      }
      const tiny=names.filter(n=>n.tiny&&(zoom>=2.5||n.id===state.selected)).map(n=>'<circle class="cm-tiny" data-pin="'+n.id+'" cx="'+n.x+'" cy="'+n.y+'" r="'+(3.7*unit)+'" fill="'+(ownerStyle(v,n.id)?.color || (v.rivals?.length?'#a6b5a6':n.color || '#9da98d'))+'" stroke="#f9e8b7" stroke-width="'+unit+'"><title>'+xml(n.name)+'</title></circle>').join('');
      const capitals = v.owned.map(id=>{
        const a=v.administration?.[id]; if (!a) return '';
        const seat=id===v.seatId, selected=id===state.selected;
        const title=a.capitalName+' · '+a.countryName+(seat?' · Empire seat':'');
        const star='<path d="m0-6 1.8 3.7 4.2.6-3 2.9.7 4.2L0 3.45l-3.7 1.95.7-4.2-3-2.9 4.2-.6z" fill="#ffe191" stroke="#473d2a" stroke-width="1.4"/>';
        const dot='<circle r="3.2" fill="#ffefd0" stroke="#334e47" stroke-width="1.5"/>';
        const cityLabel = (selected || (seat&&zoom>=1.6)) ? '<text class="cm-city-label" x="7" y="-5">'+xml(a.capitalName)+'</text>':'';
        return '<g class="cm-city" data-capital-marker="'+id+'" data-x="'+a.x+'" data-y="'+a.y+'"'+(seat?' data-empire-seat':'')+
          ' aria-label="'+xml(title)+'" transform="translate('+a.x+' '+a.y+') scale('+unit+')"><title>'+xml(title)+'</title>'+cityLabel+(seat?star:dot)+'</g>';
      }).join('');
      const site=editor?.sites[editor.siteIndex];
      const preview=site && editor.siteIndex!==0?'<circle data-location-preview cx="'+site.x+'" cy="'+site.y+'" r="'+(6*unit)+'" fill="none" stroke="#fff6c2" stroke-width="'+(2*unit)+'" stroke-dasharray="'+(3*unit)+' '+(2*unit)+'"/>':'';
      labels.innerHTML=tiny+output.join('')+holdingLabels.join('')+capitals+preview;
    }
    function camera() {
      const rect=limits();svg.setAttribute('viewBox',[rect.x,rect.y,rect.w,rect.h].join(' '));
      container.querySelector('.cm-zoom output').textContent=Math.round(state.zoom*100)+'%';
      container.querySelector('[data-zoom="-1"]').disabled=state.zoom<=1;
      container.querySelector('[data-zoom="1"]').disabled=state.zoom>=24;
      drawRoutes(); drawLabels(rect);
    }
    function countryZoom(n){return n.tiny?12:labelsAtWorld.has(n.code)?2.1:major.has(n.code)?3.3:5.6;}
    function center(n,zoom=false){
      if(zoom) state.zoom=Math.max(state.zoom,countryZoom(n));
      state.cx=n.x;state.cy=n.y;camera();
    }
    function select(id,focus=false,locate=false){
      const n=v.nations[id];if(!n||editor)return;
      state.focusedSite=null;
      state.selected=id;picker.value=String(id);
      for(const el of countries){const on=Number(el.dataset.territoryId)===id;el.setAttribute('tabindex',on?'0':'-1');el.setAttribute('aria-pressed',String(on));if(on&&focus)el.focus({preventScroll:true});}
      svg.querySelector('[data-selection-outline]').setAttribute('d',n.path||'');svg.querySelector('[data-selection-dash]').setAttribute('d',n.path||'');
      panel.innerHTML=details(state);
      if(locate) center(n,true); else camera();
      announce(n.name+'. '+statusText(v,n)+'.');
    }
    let results=[],activeResult=-1;
    function hideSearch(){list.hidden=true;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');activeResult=-1;}
    function simplify(t){return t.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');}
    function showSearch(){
      const q=simplify(search.value);if(!q){hideSearch();return;}
      const names=[];
      for(const n of v.nations) {
        names.push({n,name:simplify(n.name),aliases:[n.originalName,n.capital,n.originalCapital,n.code,n.iso2].filter(Boolean).map(simplify)});
        for(const site of n.dependencyDetails||[])names.push({n,site,name:simplify(site.name),aliases:[]});
      }
      const rank=a=>a.name===q||a.aliases.includes(q)?0:a.name.startsWith(q)?1:2;
      results=names.filter(a=>a.name.includes(q)||a.aliases.some(alias=>alias.includes(q))).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)).slice(0,7);
      list.innerHTML=results.length?results.map(({n,site},i)=>'<li id="cm-result-'+i+'" role="option" data-result-index="'+i+'" data-match="'+n.id+'"'+(site?' data-dependency="'+xml(site.name)+'"':'')+' aria-selected="false">'+xml(site?site.name:geographyName(n))+' <small>'+xml(site?n.name:n.code)+'</small></li>').join(''):'<li role="presentation">No countries found</li>';
      list.hidden=false;search.setAttribute('aria-expanded','true');activeResult=-1;
    }
    function locateHolding(n,site) {
      select(n.id,true);
      if(!Number.isFinite(site?.x)){center(n,true);return;}
      state.focusedSite=site;state.cx=site.x;state.cy=site.y;
      const bounds=site.bounds;
      state.zoom=bounds ? Math.min(14,Math.max(2,Math.min(width/(Math.max(1,bounds[2]-bounds[0])*1.5),height/(Math.max(1,bounds[3]-bounds[1])*1.5)))) : 4;
      camera();
      announce(site.name+' · '+n.name);
    }
    function chooseSearch(index){
      const item=results[index];
      if(!item)return;
      hideSearch();search.value='';
      if(item.site)locateHolding(item.n,item.site);else select(item.n.id,true,true);
    }
    function adminMessage(message,error=false) {
      const feedback=panel.querySelector('[data-admin-message]');
      if(feedback){feedback.textContent=message;feedback.classList.toggle('is-error',error);}
      if(editor?.placing) mapNotice.querySelector('[data-map-message]').textContent=message;
    }
    function setPlacing(placing) {
      editor.placing=placing;
      mapNotice.hidden=!placing;
      svg.classList.toggle('cm-picking-site',placing);
      panel.querySelector('[data-pick-location]').setAttribute('aria-pressed',String(placing));
      panel.querySelector('[data-admin-save]').disabled=placing;
      if(placing) {
        adminMessage('Click land inside '+v.nations[editor.id].name+' to place the capital. Drag to pan or use the zoom buttons.');
        svg.scrollIntoView({block:'nearest'}); svg.focus({preventScroll:true});
      }
    }
    function siteOptions() {
      const selectSite=panel.querySelector('[data-capital-site]');
      selectSite.replaceChildren();
      for (const [i,site] of editor.sites.entries()) {
        const option=document.createElement('option');
        option.value=String(i);option.dataset.x=String(site.x);option.dataset.y=String(site.y);
        option.textContent=site.name+' · '+coordinates(site.x,site.y);
        selectSite.append(option);
      }
      selectSite.value=String(editor.siteIndex);
    }
    function openEditor() {
      const id=state.selected,a=v.administration?.[id];
      if(!a||!v.owned.includes(id)) return;
      const n=v.nations[id];
      editor={id,sites:availableSites(n,a,v.era.capitals),siteIndex:0,placing:false};
      picker.disabled=true;search.disabled=true;hideSearch();
      panel.innerHTML='<form class="cm-admin" data-admin><h2>Manage country</h2><p class="cm-admin-original"></p>'+
        '<label>Country name<input type="text" data-country-name maxlength="80" autocomplete="off"></label>'+
        '<label>Capital name<input type="text" data-capital-name maxlength="80" autocomplete="off"></label>'+
        '<label>Capital site<select data-capital-site></select></label>'+
        '<button type="button" class="cm-map-pick" data-pick-location aria-pressed="false">'+icon('compass')+'Place on map</button>'+
        '<label class="cm-seat-option"><input type="checkbox" data-seat>Make this country the empire seat</label>'+
        '<p class="cm-admin-feedback" data-admin-message role="status" aria-live="polite"></p>'+
        '<div class="cm-editor-actions"><button type="submit" class="cm-primary" data-admin-save>Save changes</button><button type="button" data-admin-cancel>Cancel</button></div></form>';
      const form=panel.querySelector('form');
      form.querySelector('.cm-admin-original').textContent='Real-world geography · '+n.originalName+' · '+a.originalCapitalName;
      const country=form.querySelector('[data-country-name]'),city=form.querySelector('[data-capital-name]');
      country.value=a.countryName;country.placeholder=a.originalCountryName;
      city.value=a.capitalName;city.placeholder=a.originalCapitalName;
      const seat=form.querySelector('[data-seat]');seat.checked=v.seatId===id;seat.disabled=seat.checked;
      siteOptions();
      form.addEventListener('submit',e=>{e.preventDefault();saveEditor();},opts);
      form.querySelector('[data-capital-site]').addEventListener('change',e=>{
        editor.siteIndex=Number(e.target.value);setPlacing(false);
        const place=editor.sites[editor.siteIndex];state.cx=place.x;state.cy=place.y;camera();
        adminMessage('Capital site selected. Save changes to keep it.');
      },opts);
      country.focus({preventScroll:true});country.select();
    }
    function closeEditor() {
      if(!editor)return;
      setPlacing(false);editor=null;picker.disabled=false;search.disabled=false;
      select(state.selected);
      panel.querySelector('[data-manage]')?.focus({preventScroll:true});
    }
    function saveEditor() {
      if(!editor||editor.placing)return;
      const id=editor.id,site=editor.sites[editor.siteIndex];
      const changes={countryName:panel.querySelector('[data-country-name]').value,capitalName:panel.querySelector('[data-capital-name]').value,seat:panel.querySelector('[data-seat]').checked};
      if(editor.siteIndex!==0) {
        if(site.reset)changes.resetLocation=true;
        else {changes.x=site.x;changes.y=site.y;}
      }
      if (!game.updateCountry(id,changes)) {adminMessage('Use names of up to 40 characters and a capital site inside this country.',true);return;}
      render(container,game,actions);
      container.querySelector('[data-manage]')?.focus({preventScroll:true});
      container.querySelector('[data-announcement]').textContent='Country changes saved.';
    }
    function placeOnMap(e) {
      const position=mapPoint(e);
      if(!v.era.capitals.containsPoint(editor.id,position.x,position.y)) {
        adminMessage('That point is outside '+v.nations[editor.id].name+'. Click land inside its highlighted border.',true);
        return;
      }
      const previous=editor.sites.findIndex(s=>s.picked);
      const site={name:'Map selection',x:position.x,y:position.y,picked:true};
      editor.siteIndex=previous<0 ? editor.sites.push(site)-1 : previous;
      editor.sites[editor.siteIndex]=site;
      siteOptions();setPlacing(false);camera();
      adminMessage('New capital site at '+coordinates(site.x,site.y)+'. Save changes to keep it.');
      panel.querySelector('[data-admin-save]').focus();
    }
    function zoom(next,x=state.cx,y=state.cy) {
      const before=state.zoom;state.zoom=Math.max(1,Math.min(24,next));
      const ratio=before/state.zoom;state.cx=x+(state.cx-x)*ratio;state.cy=y+(state.cy-y)*ratio;camera();
    }
    function mapPoint(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
    let drag=null,dragged=false,raf=0;
    function queueCamera(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(!state.abort.signal.aborted)camera();});}
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:state.cx,cy:state.cy};dragged=false;},opts);
    svg.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId||state.zoom<=1)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)<5&&!dragged)return;
      if(!dragged){dragged=true;svg.setPointerCapture?.(e.pointerId);}
      const scale=svg.getScreenCTM().a;state.cx=drag.cx-dx/scale;state.cy=drag.cy-dy/scale;queueCamera();
    },opts);
    const stop=()=>{drag=null;};
    svg.addEventListener('pointerup',stop,opts);svg.addEventListener('pointercancel',stop,opts);
    svg.addEventListener('wheel',e=>{
      if(!e.ctrlKey&&!e.metaKey) return;
      e.preventDefault();const p=mapPoint(e);zoom(state.zoom*Math.exp(-e.deltaY*.015),p.x,p.y);
    },{...opts,passive:false});
    svg.addEventListener('dblclick',e=>{const p=mapPoint(e);zoom(state.zoom*1.6,p.x,p.y);},opts);
    function onClick(e) {
      if(dragged&&svg.contains(e.target)){dragged=false;return;}
      if (editor?.placing && svg.contains(e.target)) {placeOnMap(e);return;}
      if (e.target.closest('[data-empires]')) {openEmpires(container,game,actions);return;}
      const profileButton=e.target.closest('[data-action="country-profile"]');
      if(profileButton){root.DungeonCountryGuide.open(v.era,v.nations[state.selected],profileButton);return;}
      if (e.target.closest('[data-manage]')) {openEditor();return;}
      if (e.target.closest('[data-admin-cancel]')) {closeEditor();return;}
      if (e.target.closest('[data-stop-placing]')) {setPlacing(false);adminMessage('Kept the selected capital site.');panel.querySelector('[data-pick-location]').focus();return;}
      if (e.target.closest('[data-pick-location]')) {setPlacing(!editor.placing);if(!editor.placing)adminMessage('Choose a site or save your changes.');return;}
      if (e.target.closest('[data-locate-capital]')) {
        const a=v.administration[state.selected];state.zoom=Math.max(state.zoom,Math.max(4,countryZoom(v.nations[state.selected])));state.cx=a.x;state.cy=a.y;camera();svg.scrollIntoView({block:'nearest'});return;
      }
      const holding=e.target.closest('[data-locate-holding]');
      if(holding){
        const n=v.nations[state.selected];locateHolding(n,n.dependencyDetails?.[Number(holding.dataset.locateHolding)]);return;
      }
      const city=e.target.closest('[data-capital-marker]');
      if (city) {select(Number(city.dataset.capitalMarker),true);return;}
      const b=e.target.closest('[data-territory-id],[data-pin],[data-invade],[data-resume],[data-practice],[data-select-id],[data-zoom],[data-home],[data-fit],[data-match]');
      if(!b){if(!e.target.closest('.cm-search-wrap'))hideSearch();return;}
      if(b.hasAttribute('data-match')){chooseSearch(Number(b.dataset.resultIndex));return;}
      hideSearch();
      if(b.hasAttribute('data-territory-id'))select(Number(b.dataset.territoryId),true);
      else if(b.hasAttribute('data-pin'))select(Number(b.dataset.pin),true);
      else if(b.hasAttribute('data-home'))actions.onChooseCapital?.(Number(b.dataset.home));
      else if(b.hasAttribute('data-invade'))actions.onInvade?.(Number(b.dataset.invade));
      else if(b.hasAttribute('data-resume'))actions.onResume?.();
      else if(b.hasAttribute('data-practice'))actions.onPractice?.();
      else if(b.hasAttribute('data-select-id'))select(Number(b.dataset.selectId),true,true);
      else if(b.hasAttribute('data-zoom'))zoom(state.zoom*(Number(b.dataset.zoom)>0?1.55:1/1.55),v.nations[state.selected].x,v.nations[state.selected].y);
      else if(b.hasAttribute('data-fit')){state.zoom=1;state.cx=width/2;state.cy=height/2;camera();}
    }
    function onKey(e) {
      if(editor&&e.key==='Escape'){e.preventDefault();if(editor.placing){setPlacing(false);adminMessage('Kept the selected capital site.');panel.querySelector('[data-pick-location]').focus();}else closeEditor();return;}
      if(e.target===search){
        if(e.key==='Escape'){hideSearch();return;}
        if(e.key==='Enter'&&results.length&&!list.hidden){e.preventDefault();chooseSearch(Math.max(0,activeResult));return;}
        if(['ArrowDown','ArrowUp'].includes(e.key)&&results.length&&!list.hidden){
          e.preventDefault();activeResult=(activeResult+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;
          [...list.querySelectorAll('[role="option"]')].forEach((el,i)=>el.setAttribute('aria-selected',String(i===activeResult)));search.setAttribute('aria-activedescendant','cm-result-'+activeResult);
        }
        return;
      }
      if(!e.target.closest('[data-territory-id]'))return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();panel.querySelector('.cm-primary,.cm-secondary')?.focus();return;}
      if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();const n=v.nations[state.selected];zoom(state.zoom*(e.key==='-'?1/1.55:1.55),n.x,n.y);return;}
      const dir={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(!dir)return;
      e.preventDefault();const n=v.nations[state.selected];
      const next=v.nations.filter(q=>q!==n).map(q=>{const dx=q.x-n.x,dy=q.y-n.y,d=Math.hypot(dx,dy),dot=(dir[0]*dx+dir[1]*dy)/Math.max(.1,d);return {q,s:dot>.43?d/(dot**3):Infinity};}).sort((a,b)=>a.s-b.s)[0];
      if(next&&Number.isFinite(next.s)){select(next.q.id,true);const r=limits(),q=next.q;if(q.x<r.x||q.x>r.x+r.w||q.y<r.y||q.y>r.y+r.h)center(q);}
    }
    container.addEventListener('click',onClick,opts);container.addEventListener('keydown',onKey,opts);
    picker.addEventListener('change',()=>select(Number(picker.value),false,true),opts);
    search.addEventListener('input',showSearch,opts);
    search.addEventListener('blur',()=>setTimeout(()=>{if(!state.abort.signal.aborted&&!list.contains(document.activeElement))hideSearch();},140),opts);
    list.addEventListener('pointerdown',e=>e.preventDefault(),opts);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(!state.abort.signal.aborted)queueCamera();}):null;
    observer?.observe(svg);state.abort.signal.addEventListener('abort',()=>{observer?.disconnect();if(raf)cancelAnimationFrame(raf);},{once:true});
    select(selected,oldFocus==='country');
    if(capture!==null||justChose)center(v.nations[selected],true);
    if(oldFocus==='pick')picker.focus({preventScroll:true});
    if(oldFocus==='fight')panel.querySelector('.cm-primary,.cm-secondary')?.focus({preventScroll:true});
    if(capture!==null||v.victory)announce(summary);
    return {selected:()=>state.selected};
  }
  root.DungeonCampaignMap={render,renderPreview};
})(globalThis);
