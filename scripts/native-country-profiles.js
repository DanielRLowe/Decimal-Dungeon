// A fresh two-launch campaign. Everything is stored in the verifier's temporary directory.
const q = sel => document.querySelector(sel);
const rawSave = () => DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1');
const state = () => JSON.parse(rawSave());
const view = () => DungeonAdventure.open().campaignView();
const check = (condition,msg) => { if (!condition) throw Error(msg); };
const opener = '[data-action="country-profile"]';
const modal = 'dialog[open][data-country-profile]';
const button = (sel,where=document) => {
  const el = where.querySelector(sel);
  check(el?.getClientRects().length && !el.disabled, 'Country profile control is unavailable: '+sel);
  el.click();
};
function selectOnMap(nation) {
  // After founding, the game may have zoomed to a distant island on the frontier.
  button('[data-fit]');
  const path = q('#campaign-host [data-territory-id="'+nation.id+'"] .cm-ground');
  check(path?.getClientRects().length && path.getAttribute('d')===nation.path,
    'Select a country through the boundary drawn on the active map');
  // Hit-test the actual screen location so an overlay covering country boundaries is caught.
  path.ownerSVGElement.scrollIntoView({block:'center',behavior:'instant'});
  const matrix=path.getScreenCTM();
  let hit, position;
  for(const distance of [0,2,5,10,18,26]) {
    for(const [x,y] of [[1,0],[0,-1],[-1,0],[0,1],[1,-1],[-1,1]]) {
      const point=new DOMPoint(nation.x+x*distance,nation.y+y*distance);
      if(!path.isPointInFill(point)) continue;
      const screen=point.matrixTransform(matrix), node=document.elementFromPoint(screen.x,screen.y);
      if(node===path){hit=node;position=screen;break;}
    }
    if(hit) break;
  }
  if(!hit){
    const pt=new DOMPoint(nation.x,nation.y).matrixTransform(matrix), top=document.elementFromPoint(pt.x,pt.y);
    throw Error('Could not point at '+nation.name+' on '+q('[data-campaign-era]').value+
      '; frame '+path.ownerSVGElement.getAttribute('viewBox')+', location '+[pt.x,pt.y].join(',')+', hit '+
      (top?.outerHTML?.slice(0,125)||'outside viewport')+', phase '+(state().campaign.owned.length?'founded':'pre-home'));
  }
  hit.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:position.x,clientY:position.y}));
  check(path.parentElement.getAttribute('aria-pressed')==='true' && q(opener)?.getClientRects().length,
    'Clicking the boundary for '+nation.name+' did not offer its profile');
}
async function inspect(nation,era) {
  selectOnMap(nation);
  const before=rawSave(), map=q('#campaign-host .cm-map'), bounds=map.getAttribute('viewBox');
  button(opener);
  const panel=q(modal), heading=q('#country-profile-name');
  check(panel && panel.contains(heading) && panel.getAttribute('aria-labelledby')===heading.id,
    'The open country profile needs an accessible title');
  check(heading.textContent===nation.name && panel.querySelector('.guide-outline')?.getAttribute('d')===nation.path,
    'The profile heading and locator must identify the real '+nation.name);
  const keys = era==='modern' ? ['population','gdp','armedForces','area'] : ['population','militaryPersonnel','gdp'];
  for (const key of keys) {
    const stat=panel.querySelector('[data-stat="'+key+'"]');
    check(stat?.querySelector('h3') && stat.querySelector('strong') && stat.querySelector('a[href]'),
      'Missing '+key+' figure, published gap or citation for '+nation.name);
  }
  if(era==='modern') {
    const year=DungeonCountryProfiles.get(nation.code)?.population?.year;
    if(year)check(panel.querySelector('[data-stat="population"] .guide-year')?.textContent===String(year),
      'The population figure is missing its source year');
  } else if(/United States/.test(nation.name)) {
    const expected={ww1:['99.1 million','166,000'],ww2:['131 million','334,000'],'1886':['57.9 million','39,000']}[era];
    const period = panel.querySelector('.guide-flag img');
    check(panel.querySelector('[data-stat="population"] strong').textContent===expected[0] &&
      panel.querySelector('[data-stat="militaryPersonnel"] strong').textContent===expected[1] &&
      !!period?.getAttribute('src') && !!period?.alt,'The US profile must use the '+era+' population, military estimate and period flag');
  }
  check(panel.contains(document.activeElement),'Keyboard focus did not enter the country profile');
  check(panel.querySelectorAll('a[href^="https://"]').length>0,'Profile for '+nation.name+' has no educational source');
  if(era!=='modern') check(panel.innerText.includes(era==='ww1'?'1914':era==='ww2'?'1939':'1886'),
    'Historical profile does not identify its ' + era + ' period');
  button('[data-profile-close]',panel);
  const deadline=performance.now()+1500;
  while(document.activeElement!==q(opener) && performance.now()<deadline) await new Promise(done=>setTimeout(done,15));
  check(!q(modal) && document.activeElement===q(opener),'Closing the country profile must return focus to the opening button');
  check(q('#campaign-host .cm-map').getAttribute('viewBox')===bounds &&
    q('[data-territory-id="'+nation.id+'"]').getAttribute('aria-pressed')==='true','Reading changed the map selection or zoom');
  check(rawSave()===before,'Reading a country profile changed the saved game');
}
function pickEra(id) {
  const picker=q('[data-campaign-era]');
  picker.value=id;picker.dispatchEvent(new Event('change',{bubbles:true}));
  const v=view();check(v.eraId===id,'Could not switch map to '+id);
  return v;
}
const nickname='Cedar Republic';
if(pass===0) {
  const opening=view(), france=opening.nations.find(n=>n.code==='FRA'), usa=opening.nations.find(n=>n.code==='USA');
  check(opening.needsCapital,'Country reference books must be accessible before founding an empire');
  await inspect(france,'modern');
  selectOnMap(usa);
  button('[data-home]');
  selectOnMap(usa);
  button('[data-manage]');
  const name=q('[data-country-name]');name.value=nickname;
  name.dispatchEvent(new Event('input',{bubbles:true}));
  button('[data-admin-save]');
  check(view().administration[usa.id].countryName===nickname,'Isolated country rename was not saved');
  await inspect(usa,'modern');
  check(q('#campaign-host .cm-dossier').textContent.includes(nickname),'The game lost the player’s nickname when reading the real-world profile');
  // Leave the accessible opener in focus. The Swift verifier presses a real Return key.
  q(opener).focus();
  return 'Clickable modern boundaries open sources before founding; the factual US profile survives a player rename and leaves progress and map position intact';
}
const current=view(), usa=current.nations.find(n=>n.code==='USA');
check(current.eraId==='modern' && current.administration[usa.id]?.countryName===nickname,'Profile test lost its renamed home on relaunch');
await inspect(usa,'modern');
for(const era of ['1886','ww2','ww1']) {
  const v=pickEra(era);
  const nation=v.nations.find(n=>/United States/.test(n.name));
  check(nation && v.needsCapital,'Expected a historical US map outline without a new campaign');
  await inspect(nation,era);
}
q(opener).focus();
return 'Profiles opened from 1886, 1939 and 1914 map outlines without founding an empire or changing the original modern campaign';
