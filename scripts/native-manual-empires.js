// Play from Brazil while a separate US home and an optional computer empire share the atlas.
const $=selector=>[...document.querySelectorAll(selector)].find(element=>element.getClientRects().length);
const game=()=>DungeonAdventure.open();
const view=()=>game().campaignView();
const read=()=>JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const nation=code=>DungeonEras.get('modern').board.NATIONS.find(n=>n.code===code);
const expect=(ok,message)=>{if(!ok)throw Error(message);};
const click=selector=>{
  const element=$(selector);expect(element?.getClientRects().length && !element.disabled,'Missing control '+selector);
  element.click();
};
const change=(sel,value)=>{
  const element=$(sel);expect(element && !element.disabled,'Missing field '+sel);
  element.value=value;expect(element.value===String(value),'Invalid choice '+value);
  element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));
};
const inspect=code=>change('#campaign-host [data-pick]',nation(code).id);
const border=code=>'[data-attack-neighbor="'+nation(code).id+'"]';
function brazilFrontier() {
  const v=view(), brazil=nation('BRA');
  expect(v.activeEmpire.homeId===brazil.id && $('[data-active-empire]').value===v.activeEmpireId &&
    $('.cm-country-heading h2').textContent===brazil.name,'The map must stay at the Brazilian home when taking control');
  const shown=[...document.querySelectorAll('[data-attack-neighbor]')].map(b=>Number(b.dataset.attackNeighbor));
  const expected=brazil.neighbors.filter(id=>v.frontier.includes(id));
  expect(shown.length===expected.length && expected.every(id=>shown.includes(id)) && shown.includes(nation('ARG').id) &&
    !shown.includes(nation('CUB').id),'Brazil must offer just its attackable adjacent countries');
  expect($('[data-iso3="BRA"] .cm-ground').getAttribute('fill')===v.activeEmpire.color &&
    $('[data-iso3="USA"]').dataset.owner==='player','Playing as Brazil changed the original empire or the owner colors');
}
if(pass===0) {
  inspect('USA');click('[data-home]');
  inspect('BRA');click('[data-found-at="'+nation('BRA').id+'"]');
  expect($('[data-new-control][value=manual]').checked && $('[data-rival-home]').value===String(nation('BRA').id),
    'Founding a new empire from Brazil should default to human control and the chosen country');
  change('[data-rival-name]','Southern Cross');click('[data-add-rival]');
  brazilFrontier();
  const brazilId=view().activeEmpireId;
  click('[data-empires]');change('[data-rival-home]',nation('FRA').id);change('[data-rival-name]','Blue Empire');
  click('[data-new-control][value=ai]');click('[data-add-rival]');click('[data-empires-close]');
  const ai=view().empires.find(f=>f.name==='Blue Empire');
  expect(ai.control==='ai' && view().activeEmpireId===brazilId,'Creating a computer empire handed it the active turn');
  click(border('BOL'));
  const round=read().round;
  expect(round.nationId===nation('BOL').id && round.empireId===brazilId && round.problem.kind==='lesson' &&
    $('#world-title').textContent==='Bolivia' && $('#world-number').textContent.includes('Southern Cross'),'Brazil opened another empire’s battle');
  nativeAtlas.preview(view());
  nativeLesson.answer('#workbench',round.problem.steps[0],0);
  click('#campaign-nav');
  change('[data-active-empire]','player');
  expect(view().capitalId===nation('USA').id && view().owned.length===1,'Switching back failed to restore the US home');
  inspect('BRA');
  click('[data-play-country="'+brazilId+'"]');
  brazilFrontier();click(border('BOL'));
  expect(read().round.id===round.id && Number($('#workbench [data-lesson-step]').dataset.lessonStep)===1,
    'Choosing Brazil through its country dossier lost the pending Bolivia battle');
  DungeonNativeStorage.setItem('manual-empires-test',JSON.stringify({brazilId,aiId:ai.id,roundId:round.id}));
  return 'Created and took human control of Brazil, attacked Bolivia from its own territory, and switched between empires without losing pending work';
}

const stored=JSON.parse(DungeonNativeStorage.getItem('manual-empires-test')), round=read().round;
expect(view().activeEmpireId===stored.brazilId && round.id===stored.roundId && round.nationId===nation('BOL').id &&
  Number($('#workbench [data-lesson-step]').dataset.lessonStep)===1,'Relaunch switched empire or lost the Bolivia lesson');
for(let index=1;index<round.problem.steps.length;index++) nativeLesson.answer('#workbench',round.problem.steps[index],index);
const capture=read().round.receipt?.capture;
expect(capture?.empireId===stored.brazilId && capture.id===nation('BOL').id,'Bolivia was awarded to the wrong empire');
if($('#victory-film')?.open)click('#skip-victory');
click('[data-conquest-map]');
const after=view();
expect(after.owners[nation('BOL').id]===stored.brazilId && after.empires.find(f=>f.id==='player').owned.length===1 &&
  after.rivalMoves.length===1 && after.rivalMoves[0].rivalId===stored.aiId,'Only the computer empire should move automatically');
inspect('FRA');click('[data-play-country="'+stored.aiId+'"]');
expect(view().activeEmpireId===stored.aiId && view().activeEmpire.control==='manual' &&
  $('.cm-country-heading h2').textContent==='France','Taking over an existing computer empire did not activate its own home');
change('[data-active-empire]',stored.brazilId);inspect('BRA');
brazilFrontier();
return 'A saved Brazilian battle captured Bolivia for Brazil; the US stayed put, the computer took its turn, and its home could then be taken under human control';
