// Each pass opens a fresh WKWebView over the same isolated save. Exercise the
// real selectors and WebKit decoder so selecting an asset alone cannot pass.
const $=selector=>document.querySelector(selector);
const save=()=>JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const score=$('audio[data-dungeon-music]');
const trace=[];
for(const name of ['play','playing','pause','waiting','seeking','seeked','ended','canplay','error','emptied'])score.addEventListener(name,()=>trace.push(name+'@'+score.currentTime.toFixed(2)));
for(const name of ['blur','focus','dungeon-suspend','dungeon-resume'])window.addEventListener(name,()=>trace.push(name));
document.addEventListener('visibilitychange',()=>trace.push('hidden:'+document.hidden));
const files={atlas:'empire-overture.m4a',battle:'frontier-battle.m4a'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const expect=(condition,message)=>{if(!condition)throw Error(message);};
function click(selector){
  const button=$(selector);
  expect(button?.getClientRects().length&&!button.disabled,'Unavailable control '+selector);
  button.click();
}
async function wait(check,message){
  const until=performance.now()+5500;
  while(!check()&&performance.now()<until)await delay(30);
  expect(check(),message+' [scene='+score.dataset.musicScene+', media='+score.currentSrc+', ready='+score.readyState+
      ', paused='+score.paused+', time='+score.currentTime+', error='+score.error?.code+', duration='+score.duration+', hidden='+document.hidden+', focus='+document.hasFocus()+', trace='+trace.slice(-25).join(' | ')+']');
}
async function playing(scene){
  const file='/assets/'+files[scene];
  await wait(()=>score.dataset.musicScene===scene && score.dataset.musicTrack===scene &&
    score.currentSrc.startsWith('file:') && new URL(score.currentSrc).pathname.endsWith(file) &&
    !score.paused && !score.muted && score.volume>.03 && score.loop && score.readyState>=2 &&
    Number.isFinite(score.duration) && score.duration>5 && !score.error,'Bundled '+scene+' score did not start');
  const start=score.currentTime;
  await wait(()=>score.currentTime>start+.07&&!score.paused && score.currentSrc.endsWith(file),
    'Native decoder did not advance the '+scene+' playhead');
  expect([...document.querySelectorAll('audio')].filter(a=>!a.paused).length===1,'Two scores overlap');
}
async function playhead(scene,position){
  score.currentTime=position;
  await wait(()=>!score.seeking && score.currentTime>=position && score.currentTime<position+4,
    'The '+scene+' playhead could not seek to a recognizable position');
}
function inspect(id){
  const pick=$('#campaign-host [data-pick]');pick.value=String(id);
  expect(pick.value===String(id),'Target missing from map');
  pick.dispatchEvent(new Event('change',{bubbles:true}));
}
function target(){
  const view=DungeonAdventure.open().campaignView();
  const id=view.frontier.find(id=>view.nations[id].rank==='normal') ?? view.frontier[0];
  expect(Number.isInteger(id),'No frontier is open');inspect(id);
  click('#campaign-host [data-invade="'+id+'"]');
  expect(save().campaign.targetId===id && save().round.nationId===id,'Did not enter the selected invasion');
  return id;
}
const slot='native-battle-score-case';
expect(score && document.querySelectorAll('audio[data-dungeon-music]').length===1,'The score must use one persistent media player');
if(pass===0){
  expect(!save().settings.music && score.paused && $('#music').getAttribute('aria-pressed')==='false','New campaigns must honor the default music preference');
  click('#music');await playing('atlas');
  await playhead('atlas',12);
  click('#campaign-host [data-home]');
  const id=target();
  await playing('battle');
  score.currentTime=score.duration-.28;
  await wait(()=>!score.seeking && score.currentTime>.03 && score.currentTime<2.5 && !score.paused,
    'The WebKit decoder did not loop the battle track back to its opening');
  await playhead('battle',7);
  click('#campaign-nav');
  expect(save().campaign.inBattle && save().screen==='campaign','Opening the map should park an unresolved invasion');
  await playing('atlas');
  expect(score.currentTime>=11.75,'Returning to the map restarted the adventure score');
  inspect(id);click('#campaign-host [data-resume]');
  await playing('battle');
  expect(score.currentTime>=6.75,'Resuming that invasion restarted the battle cue');
  await delay(520);
  const full=score.volume;
  click('[data-panel=settings]');
  await wait(()=>score.volume<full*.82 && score.dataset.musicTrack==='battle'&&!score.paused,'The settings menu did not duck the battle score');
  click('dialog.dp-dialog[open] .dp-close');
  await wait(()=>score.volume>full*.95 && score.dataset.musicTrack==='battle'&&!score.paused,'Closing the menu did not restore the battle score');
  const round=save().round;
  expect(round.problem.kind==='lesson','Expected the initial country to use the grade-five curriculum');
  nativeLesson.answer('#workbench',round.problem.steps[0],0);
  DungeonNativeStorage.setItem(slot,JSON.stringify({round:round.id,country:id}));
  return 'Music-on invaded with the battle cue, map and battle each resumed their own playhead, and the battle menu ducked the same WebKit player.';
}
const info=JSON.parse(DungeonNativeStorage.getItem(slot));
if(pass===1){
  expect(save().settings.music && $('#music').getAttribute('aria-pressed')==='true','Music-on preference did not survive the new WebKit instance');
  expect(save().round.id===info.round && save().round.nationId===info.country && save().round.draft.verified.length===1,'The unfinished invasion did not survive relaunch');
  click('#battle-nav');await playing('battle');
  const round=save().round;
  for(let i=1;i<round.problem.steps.length;i++)nativeLesson.answer('#workbench',round.problem.steps[i],i);
  expect(save().round.receipt?.capture?.id===info.country,'Expected the completed spell to capture its frontier country');
  const film=$('#victory-film'),video=$('#victory-video');
  // Explicit replay also covers Macs with Reduce Motion enabled, where the
  // first automatic showing is correctly suppressed.
  if(!film.open)click('#workbench [data-replay-victory]');
  await wait(()=>film.open && !video.paused && video.currentTime>.04 && video.videoWidth>0 && score.paused,
    'The genuine conquest film should play decoded frames while the music is paused');
  await delay(100);expect(score.paused,'Victory frames and the score played together');
  click('#skip-victory');
  await playing('atlas');
  expect(!film.open && $('#workbench .receipt'),'The conquest receipt should play the adventure theme after skipping');
  await playhead('atlas',18);
  click('#workbench [data-replay-victory]');
  await wait(()=>film.open&&score.paused&&video.currentTime>.04&&!video.paused,'Replaying the film did not pause its score');
  click('#skip-victory');await playing('atlas');
  expect(score.currentTime>=17.75,'The film replay discarded the adventure playhead');
  click('#workbench [data-conquest-map]');await playing('atlas');
  expect(save().screen==='campaign' && save().campaign.owned.includes(info.country),'Conquest map did not show the acquired country');
  click('#campaign-host [data-practice]');click('dialog.dp-dialog[open] [data-lesson-practice=decimal-tenths]');
  expect(save().round.nationId==null&&!save().campaign.inBattle,'Expected standalone practice');
  await playing('atlas');
  click('#music');await wait(()=>score.paused && !save().settings.music,'Music did not turn off during practice');
  return 'The restored invasion used battle music. A real conquest and replay silenced the score for film, restored the overture for rewards and map, and kept the overture for standalone lessons.';
}
expect(!save().settings.music && $('#music').getAttribute('aria-pressed')==='false' && score.paused,'The off preference was lost after relaunch');
click('#campaign-nav');target();
await delay(650);
expect(score.dataset.musicScene==='battle' && score.paused && !save().settings.music && !score.hasAttribute('src'),
  'Entering a country started or loaded music while the saved switch was off');
click('#music');await playing('battle');
click('#campaign-nav');await playing('atlas');
return 'A fresh launch kept music off across a country attack. Enabling it mid-invasion started the battle score, and returning to the map restored adventure music.';
