(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const landscapes = ['slime-forest', 'crystal-cave', 'forgotten-ruins', 'skeleton-keep', 'dragon-lair', 'shadow-castle'];
  const bestiary = DungeonAdventure.MONSTER_ART;
  function flag(iso2) {
    return /^[A-Z]{2}$/.test(iso2) ? Array.from(iso2, letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('') : '';
  }
  const paths = {
    battle:'<path d="m3 3 3 1 10 10-2 2L4 6zM15 13l3 3m-5 1 2 2m1-3 3 3M17 3l-3 1-4 4 2 2 4-4zM7 11l2 2-4 4-2-2zm-4 2 4 4m-4 1 2-2" />',
    map:'<path d="m2 4 5-2 6 3 5-2v13l-5 2-6-3-5 2zM7 3v12m6-10v12"/>',
    bag:'<path d="M5 8V6a5 5 0 0 1 10 0v2M4 7h12l1 10H3zM4 10h12m-9 2h6v3H7z"/>',
    gear:'<path d="m8 2 4 0 .5 2 1.5.8 2.1-.6 1.8 3-1.5 1.5v2.5l1.5 1.4-1.8 3-2.1-.6-1.5.8-.5 2.2H8l-.5-2.2-1.5-.8-2.1.6-1.8-3 1.5-1.4V8.7L2.1 7.2l1.8-3 2.1.6L7.5 4z"/><circle cx="10" cy="10" r="2.7"/>',
    music:'<path d="M8 14V5l9-2v9M8 7l9-2"/><ellipse cx="5.5" cy="14.8" rx="2.8" ry="2"/><ellipse cx="14.5" cy="12.8" rx="2.8" ry="2"/>',
    sound:'<path d="M2 8h3l5-4v12l-5-4H2zM13 7q3 3 0 6m2-9q6 6 0 12"/>',
    mute:'<path d="M2 8h3l5-4v12l-5-4H2zM13 7l5 6m0-6-5 6"/>',
    lock:'<rect x="4" y="9" width="12" height="9" rx="2"/><path d="M6 8V6a4 4 0 0 1 8 0v2m-4 4v3"/>',
    help:'<circle cx="10" cy="10" r="8"/><path d="M7.5 7.2c-.1-2.3 5.7-2.6 5.3.1-.3 1.8-2.8 1.8-2.8 4.1m0 2.9v.4"/>',
    save:'<path d="M2.5 3h12l3 3v11H2.5zM6 3v5h7V3M6 17v-5h8v5"/>',
    edit:'<path d="m4 12 9-9 3 3-9 9-4 1zM11 5l3 3"/>'
  };
  const pixels = {
    sword:'<path fill="#30364a" d="M14 0h6v6l-8 8h2v3h-4v-1l-5 5-3-3 5-5-4-3 2-3 4 3z"/><path fill="#e7ffff" d="M16 1h3v4l-9 9-3-3z"/><path fill="#92c6d2" d="M19 3v3l-8 8-2-2z"/><path fill="#ffc56a" d="M4 8h3v2h2v2h3v2h2v2h-4v-2H8v-2H6v-2H4z"/><path fill="#a86e4b" d="m7 13 2 2-5 5-2-2z"/><path fill="#ffcd72" d="M1 17h3v3H1z"/>',
    coin:'<path fill="#8e552b" d="M6 1h8v2h3v3h2v9h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3z"/><path fill="#ffbd46" d="M6 2h8v2h3v11h-3v2H6v-2H3V5h3z"/><path fill="#ffe391" d="M6 3h7v2H8v2H5v6H3V6h3z"/><path fill="#d78a33" d="M10 5h3v8h-2v2H8V7h2z"/>',
    scroll:'<path fill="#8e705c" d="M4 2h14v3h2v4h-4v9H4v-2H1v-4h4V6H2V3h2z"/><path fill="#f9d99f" d="M5 3h12v3h-2v10H5v-3h2V5H4V4h1z"/><path fill="#b89a79" d="M8 7h5v1H8zm0 3h5v1H8zm0 3h3v1H8z"/><path fill="#f7c17d" d="M2 13h3v3h8v1H4v-1H2z"/>',
    helmet:'<path fill="#75869d" d="M5 3h3V1h5v2h3v3h2v10h-3v3h-4v-7H8v7H5v-3H2V8h1V5h2z"/><path fill="#b7d2d9" d="M5 6h2V4h6v2h2v3H4V7h1z"/><path fill="#efc77a" d="M9 2h3v9H9zM3 10h14v2H3z"/><path fill="#c4dce3" d="M4 12h2v4H4zm10 0h2v4h-2z"/>',
    spark:'<path fill="#bb94f7" d="M9 0h2v5h2v2h2v2h5v2h-5v2h-2v2h-2v5H9v-5H7v-2H5v-2H0V9h5V7h2V5h2z"/><path fill="#f6e6ff" d="M9 6h2v3h3v2h-3v3H9v-3H6V9h3z"/>',
    flag:'<path fill="#cabfa7" d="M3 1h2v18H3z"/><path fill="#d9a458" d="M5 2h12v2h-2v2h-2v2h2v2H5z"/><path fill="#ffe094" d="M5 2h9v2H5z"/>',
    crown:'<path fill="#ad772e" d="M1 3h3v3h2v2h2V5h2V2h2v3h2v3h2V6h2V4h2l-2 12H3z"/><path fill="#ffd26e" d="M2 4h2v3h3v2h2V6h1V3h2v3h1v3h3V7h2v5H3zm2 10h13v2H4z"/><path fill="#e97c74" d="M9 10h3v2H9z"/>',
    diamond:'<path fill="#c99a48" d="m10 0 9 10-9 10-9-10z"/><path fill="#fee6a3" d="m10 3 6 7-6 7-6-7z"/><path fill="#8e663d" d="m10 6 3 4-3 4-3-4z"/>',
    wand:'<path fill="#574339" d="m3 18 8-12 3 2-8 12z"/><path fill="#c7945d" d="m3 17 8-12 2 2-8 12z"/><path fill="#ffc979" d="M12 2h3v2h3v3h-3v3h-3V7H9V4h3z"/><path fill="#fff1bd" d="M12 4h3v3h-3z"/>',
    staff:'<path fill="#aa907b" d="m3 19 8-14 2 1-8 14z"/><path fill="#b298e8" d="M13 0h4v2h-3v4h4V4h2v4h-2v2h-6V8h-2V3h3z"/>',
    blade:'<path fill="#ffde92" d="M15 0h4v5l-8 9-3-3z"/><path fill="#e1934b" d="M18 3v3l-8 8-2-2z"/><path fill="#9474a7" d="m5 9 8 6-2 2-8-6z"/><path fill="#d29764" d="m7 13 2 2-4 5-2-2z"/>',
    crystal:'<path fill="#b39682" d="m3 18 8-12 2 1-8 13z"/><path fill="#53c9c7" d="M13 0h4l2 5-5 6-5-4z"/><path fill="#c2fff0" d="M13 2h2l-2 6-2-2z"/>'
  };
  function icon(name) {
    if (pixels[name]) return '<svg viewBox="0 0 21 21" aria-hidden="true" shape-rendering="crispEdges">' + pixels[name] + '</svg>';
    return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }
  function drawIcons(target) { target.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  drawIcons(document);

  const game = DungeonAdventure.open();
  function scoreScene() {
    const {screen,campaign,round} = game.state;
    const invading = screen === 'battle' && campaign.inBattle && campaign.targetId != null
      && round?.nationId === campaign.targetId && !round.receipt?.capture;
    return invading ? 'battle' : 'atlas';
  }
  const music = DungeonMusic.create({enabled:!!game.state.settings.music,scene:scoreScene()});
  let bench = null, timer = null;
  function stopTimer() {
    timer?.destroy();timer=null;
    byId('battle-timer').replaceChildren();
  }
  let audio = null;
  const two = n => String(n).padStart(2, '0');
  function setText(id, content) { byId(id).textContent = content; }
  function getAudio() {
    if (!game.state.settings.sound) return null;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context && !audio) audio = new Context();
      if (audio?.state === 'suspended') audio.resume().catch(() => {});
    } catch { return null; }
    return audio;
  }
  function chime(success) {
    const context = getAudio();
    if (!context) return;
    const notes = success ? [392, 523.25, 659.25, 783.99] : [392, 523.25];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime + i * 0.075;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(.075, time + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .22);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(time); oscillator.stop(time + .24);
    });
  }
  function saveStatus() {
    const label = game.storageAvailable ? (window.DungeonNativeStorage ? 'Saved on this Mac' : 'Saved in this browser') : 'Saving unavailable on this device';
    const status = byId('save-status');
    if (status.dataset.label !== label) {
      status.dataset.label = label;
      status.innerHTML = '<span data-icon="save">' + icon('save') + '</span>' + label;
    }
  }
  function updateHUD() {
    const v = game.view(), state = game.state;
    const campaign = game.campaignView();
    const book=game.lessonView(), run=book.active || book.activeAutomatic;
    const current=game.currentMathLesson(), topic=DungeonLessons.get(current.lessonId);
    const difficulty=current.difficulty;
    const level=difficulty ? DungeonLessons.levels[difficulty-1] : 'Automatic decimal practice';
    setText('lesson-title',topic?.title || 'Decimal practice');
    setText('lesson-session-label',run?'Session '+run.id+' · '+level+' · '+run.completed+' solved':'Current lesson · '+level);
    const scenery = v.biomeIndex;
    const nation = v.nation;
    const nationName = nation && (campaign.administration[nation.id]?.countryName ?? nation.name);
    setText('battle-nav-label', nation ? 'Battle' : 'Practice');
    byId('battle-nav').title = nation ? 'Battle for ' + nationName : 'Practice the current math skill';
    const receipt = state.round?.receipt;
    const enemy = receipt?.enemy || v.enemy;
    const hp = receipt ? receipt.afterHp : enemy.hp;
    const encounterNumber = v.encounter - (receipt?.defeated ? 1 : 0);
    byId('scenery').style.backgroundImage = 'url("assets/' + landscapes[scenery] + '.webp")';
    const era=DungeonEras.get(campaign.eraId);
    const geography=nation ? [campaign.rivals.length?campaign.empireName:null,nationName!==nation.name?nation.name:null,nation.region,era?.id!=='modern'?era?.date:null].filter(Boolean).join(' · ') : '';
    setText('world-title',nation ? nationName : topic?.title || 'Math practice');
    setText('world-number',nation ? [flag(nation.iso2),'Country battle',geography].filter(Boolean).join(' · ') : 'Math practice');
    const encounterType = enemy.kind === 'boss' ? 'Boss' : enemy.kind === 'special' ? 'Elite' : 'Guardian';
    setText('encounter', nation ? encounterType : (enemy.kind === 'normal' ? 'Encounter' : encounterType) + ' ' + two(encounterNumber));
    setText('hero-name', v.hero.name); setText('hero-role', v.hero.role); setText('hero-level', 'Level ' + v.level);
    setText('battle-hero-name', v.hero.name);
    byId('hero-art').src = byId('portrait').src = 'assets/' + v.hero.id + '.png';
    byId('held').innerHTML = icon(v.weapon.id);
    byId('enemy-art').src = 'assets/' + bestiary[enemy.name] + '.png';
    byId('enemy-fighter').className = 'fighter enemy-fighter ' + enemy.kind;
    setText('enemy-name', enemy.name); setText('enemy-hp', hp + '/' + enemy.maxHp + ' HP');
    byId('hp-meter').style.width = (100 * hp / enemy.maxHp) + '%';
    let objective = 'Solve the problem to defeat ' + enemy.name + '.';
    if (nation) objective = 'Defeat ' + enemy.name + ' to add ' + nationName + ' to your empire.';
    if (receipt) objective = receipt.capture ? 'Your flag now flies over ' + (nationName ?? receipt.capture.name) + '!' :
      receipt.defeated ? enemy.name + ' defeated! Your spell earned ' + receipt.xp + ' XP.' : 'Your spell hit! ' + enemy.name + ' has ' + hp + ' HP left.';
    setText('objective', objective);
    setText('xp-count', v.levelXp + ' / ' + v.nextLevelXp + ' XP'); setText('coins', state.coins);
    byId('xp-meter').style.width = (100 * v.levelXp / v.nextLevelXp) + '%';
    const encounters=state.regions[state.world],cycle=encounters.clears%5;
    setText('quest-boss-title', nation ? 'Expand your empire' : 'Next boss · '+DungeonAdventure.WORLDS[state.world].boss);
    setText('quest-boss-text', nation ? campaign.owned.length + ' of ' + campaign.total + ' nations fly your flag.' :
      encounters.bossCleared ? 'Boss defeated. Keep exploring!' : cycle === 4 ? 'The boss is here. Cast your spells!' : 'Win ' + (4 - cycle) + ' more ' + (4 - cycle === 1 ? 'encounter' : 'encounters') + ' to meet the boss.');
    byId('route').hidden = !!nation;
    byId('route').innerHTML = Array.from({length:5}, (_, i) => '<i class="' + (encounters.bossCleared || i < cycle ? 'done' : i === cycle ? 'active' : '') + '"></i>').join('');
    const lessonMath=book.active || state.round?.difficulty;
    if (lessonMath && topic) {
      const record=DungeonLessons.tracker(book.sessions).lessons.find(item=>item.lessonId===topic.id);
      setText('quest-mastery-title',record.mastered?'Mastered · '+topic.title:topic.title);
      setText('quest-mastery-text',record.mastered?record.extraPractice+' extra practice problems completed.':
        Math.min(record.qualifying,3)+' / 3 independent Core or Challenge problems.'+(difficulty===1?' Foundation builds toward this skill.':' Solve each step without a hint or retry to earn a mark.'));
    } else if (nation) {
      const progress = campaign.progression;
      setText('quest-mastery-title', 'Campaign tier ' + progress.tier + ' · ' + progress.label);
      setText('quest-mastery-text', progress.nextAt
        ? 'Reach ' + progress.nextAt + ' countries for ' + progress.nextLabel.toLowerCase() + '. Your best is ' + campaign.peakHoldings + '.'
        : 'Highest campaign tier reached. Your best is ' + campaign.peakHoldings + ' countries.');
    } else {
      setText('quest-mastery-title',topic?.title || 'Decimal practice');
      setText('quest-mastery-text', v.mastered + ' / ' + state.settings.mastery + ' problems solved on the first try with at most one hint in your last 10.');
    }
    byId('mastery-pips').hidden = !!nation || !!lessonMath;
    byId('mastery-pips').innerHTML = Array.from({length:state.settings.mastery}, (_, i) => '<i class="' + (i < v.mastered ? 'lit' : '') + '"></i>').join('');
    setText('world-count', campaign.owned.length + ' / ' + campaign.total + ' nations');
    if (state.screen === 'battle') {
      setText('preview-era', era.title);
      DungeonCampaignMap.renderPreview(byId('campaign-miniature'), campaign);
    }
    const musicOn=!!state.settings.music, musicButton=byId('music');
    musicButton.title=musicOn?'Turn background music off':'Turn background music on';
    musicButton.setAttribute('aria-label',musicButton.title);
    musicButton.setAttribute('aria-pressed',String(musicOn));
    music.setScene(scoreScene());
    music.setEnabled(musicOn);
    timer?.sync();
    const sound = byId('sound');
    sound.title = state.settings.sound ? 'Turn battle sound effects off' : 'Turn battle sound effects on';
    sound.setAttribute('aria-label', sound.title);
    sound.innerHTML = '<span data-icon="sound">' + icon(state.settings.sound ? 'sound' : 'mute') + '</span>';
    saveStatus();
  }
  function showPairWork(problem, pair, equation) {
    const values = DungeonMath.operands(problem);
    const work = DungeonMath.pairPlan(problem, pair);
    const details = document.createElement('details');
    details.className = 'worked-sums';
    const summary = document.createElement('summary');
    summary.textContent = 'Show my work';
    const sheet = document.createElement('div');
    sheet.className = 'worked-sums-sheet';
    const additions = [
      [values[pair[0]], values[pair[1]]],
      [work.subtotal, work.remaining]
    ];
    additions.forEach(([a, b], i) => {
      const plan = DungeonMath.analyze({a, b, op:'+'}, {firstIsSubtotal:i === 1});
      const section = document.createElement('section');
      const title = document.createElement('h3');
      title.textContent = i === 0 ? 'My first pair' : 'My subtotal and last number';
      const sum = document.createElement('p');
      sum.className = 'equation';
      sum.textContent = a + ' + ' + b + ' = ' + plan.answer;
      const list = document.createElement('ol');
      for (const column of plan.columns) {
        const row = document.createElement('li');
        const place = document.createElement('strong');
        place.textContent = column.place;
        const arithmetic = document.createElement('span');
        const terms = [...column.digits];
        if (column.incoming) terms.push(column.incoming);
        const leadingCarry = column.incoming && plan.rows.every(digits => digits[column.index] === ' ');
        arithmetic.textContent = leadingCarry ? column.incoming + ' carried in'
          : terms.join(' + ') + ' = ' + (column.digit + 10 * column.outgoing);
        const entry = document.createElement('small');
        entry.textContent = 'Write ' + column.digit + (column.outgoing ? ', carry ' + column.outgoing : '');
        row.append(place, arithmetic, entry);
        list.append(row);
      }
      section.append(title, sum, list);
      sheet.append(section);
    });
    details.append(summary, sheet);
    equation.after(details);
  }
  function reward(round, animate) {
    const receipt = round.receipt;
    const box = byId('workbench');
    const capture = receipt.capture;
    const campaign = capture && game.campaignView();
    const capturedName = capture && (campaign.administration[capture.id]?.countryName ?? capture.name);
    // Prefer continuing along the border just opened. Always name the destination before the player accepts.
    const onward = capture && !campaign.victory
      ? [...(capture.opened || []), ...campaign.nations[capture.id].neighbors, ...campaign.frontier]
          .find(id => campaign.frontier.includes(id))
      : undefined;
    const nextLabel = onward !== undefined ? 'Battle for ' + campaign.nations[onward].name : capture ? 'See your empire' : receipt.defeated ? 'Next encounter' : 'Next problem';
    const heading = capture ? (capture.victory ? 'World conquest complete!' : capturedName + ' conquered!') :
      receipt.levelUp ? 'Level up!' : receipt.defeated ? 'Encounter won!' : 'Your spell landed!';
    const generic=round.problem.kind==='lesson';
    const equation = generic ? round.problem.prompt+'  ·  '+receipt.answer : DungeonMath.operands(round.problem).join(round.problem.op === '-' ? ' − ' : ' + ') + ' = ' + receipt.answer;
    box.innerHTML = '<div class="receipt"><span class="reward-emblem" data-icon="spark"></span><h2 tabindex="-1"></h2><p class="equation"></p><p class="reward-note"></p><div class="take"><span><i data-icon="battle"></i><b></b> power</span><span><i data-icon="spark"></i><b></b> XP</span><span><i data-icon="coin"></i><b></b> coins</span></div><button type="button" class="next"></button></div>';
    box.querySelector('h2').textContent = heading;
    const resultEquation = box.querySelector('.equation');
    resultEquation.textContent = equation;
    if (generic) {
      const entry=game.lessonView().sessions.find(run=>run.id===round.lessonSessionId)?.history.find(item=>item.roundId===round.id);
      if(entry?.work) {
        const details=document.createElement('details'), summary=document.createElement('summary'), list=document.createElement('ol');
        details.className='worked-sums'; summary.textContent='Show my work';
        for(const item of entry.work){const li=document.createElement('li');li.textContent=item.prompt+'  '+item.answer;list.append(li);}
        details.append(summary,list);resultEquation.after(details);
      }
    }
    const paper=DungeonPaper.review(receipt.paper);
    if(paper) resultEquation.after(paper);
    if(receipt.critical) {
      const critical=document.createElement('div');
      critical.className='critical-hit';critical.dataset.criticalHit='';
      const title=document.createElement('strong');title.textContent='✦ Critical hit!';
      const time=document.createElement('span'),sec=Math.floor(receipt.elapsedMs/1000);
      time.textContent='Solved in '+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')+' · 2× spell power · +'+receipt.bonusXp+' bonus XP';
      critical.append(title,time);resultEquation.before(critical);
    }
    const rounding=MathWorkbench.estimateSummary(round.problem);
    if(rounding)resultEquation.after(rounding);
    if (receipt.pair) showPairWork(round.problem, receipt.pair, resultEquation);
    const notes = [];
    const academicId=DungeonLessons.topicOf(round)?.id;
    const learned=academicId && DungeonLessons.tracker(game.lessonView().sessions).lessons.find(item=>item.lessonId===academicId);
    if(learned && round.difficulty) {
      const badge=document.createElement('div');badge.className='lesson-milestone';badge.dataset.lessonMilestone='';
      const acquired=learned.mastered && learned.masteredRoundId===round.id;
      if(acquired)badge.classList.add('earned');
      const title=DungeonLessons.get(academicId).title;
      badge.textContent=acquired?'★ Lesson mastered · '+title:learned.mastered?'★ Extra practice · '+title:
        title+' · '+learned.qualifying+' / 3 independent mastery marks';
      resultEquation.before(badge);
      if(acquired && capture && game.campaignView().mathMode==='curriculum') {
        const planned=DungeonLessons.campaignPractice(game.lessonView().sessions);
        notes.push('Next battle lesson: '+DungeonLessons.get(planned.lessonId).title+'.');
      }
    }
    if (capture) {
      const country = campaign.nations[capture.id];
      const emblem = box.querySelector('.reward-emblem');
      if (capture.victory || !flag(country.iso2)) emblem.dataset.icon = capture.victory ? 'crown' : 'flag';
      else {
        emblem.removeAttribute('data-icon');
        emblem.textContent = flag(country.iso2);
        emblem.setAttribute('aria-hidden', 'true');
      }
      notes.push(capture.victory ? 'All ' + campaign.total + ' countries now share your banner.' : 'You now hold ' + campaign.owned.length + (campaign.owned.length === 1 ? ' country.' : ' countries.'));
      if (capture.newTier) notes.push('Campaign tier ' + capture.newTier + ' reached! ' + campaign.progression.label + '.');
      for (const move of capture.rivalMoves || []) {
        const territory = campaign.nations[move.countryId].name;
        notes.push(move.name + ' took ' + territory + (move.from === campaign.activeEmpireId ? ' from your empire.' : '.'));
      }
      if (capture.winner) {
        const victor = campaign.empires.find(f => f.id === capture.winner)?.name;
        if (victor) notes.push(victor + ' won the empire race!');
      }
      const opened = (capture.opened || []).map(id => campaign.nations[id].name);
      if (opened.length) {
        const names = opened.slice(0, 3);
        if (opened.length > 3) names.push((opened.length - 3) + ' more');
        notes.push('You can now reach ' + new Intl.ListFormat('en', {type:'conjunction'}).format(names) + '.');
      }
    }
    if (receipt.recommended != null) notes.push('Recommended lesson · '+DungeonLessons.forWorld(receipt.recommended).title+'.');
    if (receipt.levelUp) notes.push(game.view().hero.name + ' reached level ' + game.view().level + '.');
    if (!notes.length) notes.push(receipt.fullyWorked ? 'You completed every step of the problem.' : 'Show each step to earn full power.');
    box.querySelector('.reward-note').textContent = notes.join(' ');
    const nums = box.querySelectorAll('.take b');
    [receipt.damage, receipt.xp, receipt.coins].forEach((n, i) => { nums[i].textContent = '+' + n; });
    const next = box.querySelector('.next'); next.textContent = nextLabel;
    const keyHint = document.createElement('kbd');
    keyHint.textContent = '↵';
    keyHint.setAttribute('aria-hidden', 'true');
    next.append(keyHint);
    next.setAttribute('aria-keyshortcuts', 'Enter');
    next.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (!event.repeat) next.click();
    });
    next.addEventListener('click', () => {
      if (game.state.round?.id !== round.id) return;
      if (capture) {
        if (onward === undefined) return showCampaign(true);
        game.leaveCampaign();
        if (!game.invade(onward)) return showCampaign(true);

      } else {
        game.nextRound(DungeonMath.makeProblem);
      }
      mountRound();
      if (window.scrollY > 60) byId('workbench').scrollIntoView({block:'nearest'});
      const first = box.querySelector('[data-action="pick-addend"], [data-slide], [data-lesson-choice], input') || box;
      first.focus({preventScroll:true});
    });
    if(round.lessonId && !capture) {
      const rec=DungeonLessons.nextPractice(game.lessonView().sessions,round.lessonId,round.difficulty);
      if(rec && (rec.lessonId!==round.lessonId || rec.difficulty!==round.difficulty)) {
        const follow=document.createElement('button');follow.type='button'; follow.dataset.nextLesson='';
        follow.textContent='Try '+DungeonLessons.levels[rec.difficulty-1]+' · '+DungeonLessons.get(rec.lessonId).title;
        follow.addEventListener('click',()=>{if(game.startLesson(rec.lessonId,rec.difficulty))showBattle();});
        next.after(follow);
      }
    }
    let replay;
    if (capture) {
      replay = document.createElement('button');
      replay.type = 'button';
      replay.dataset.replayVictory = '';
      replay.textContent = 'Replay victory';
      next.after(replay);
      if (onward !== undefined) {
        const map = document.createElement('button');
        map.type = 'button';
        map.dataset.conquestMap = '';
        map.textContent = 'See your empire';
        next.after(map);
        map.addEventListener('click', () => showCampaign(true));
      }
      replay.addEventListener('click', () => playVictory(false));
    }
    function playVictory(automatic) {
      const nation = campaign.nations[capture.id];
      DungeonVictory.play(landscapes[nation.biome], capturedName, replay, automatic);
    }
    drawIcons(box);
    if (animate) {
      byId('scenery').classList.add('cast');
      if(receipt.critical)byId('scenery').classList.add('crit-cast');
      chime(receipt.defeated);
      if (capture) playVictory(true);
    }
    next.focus({preventScroll:true});
  }
  function mountRound() {
    DungeonVictory.close();
    stopTimer();
    bench?.destroy();
    bench = null;
    const round = game.startRound(DungeonMath.makeProblem);
    byId('scenery').classList.remove('cast','crit-cast');
    updateHUD();
    if (round.receipt) return reward(round, false);
    const renderer=round.problem.kind==='lesson'?DungeonLessonBoard:MathWorkbench;
    bench = renderer.mount(byId('workbench'), {
      problem:round.problem, mode:round.mode, draft:round.draft,
      onDraft(draft) { game.saveDraft(round.id, draft); saveStatus(); },
      onComplete(result) {
        stopTimer();
        if (!game.finishRound(round.id, result)) return;
        updateHUD();
        reward(round, true);
      }
    });
    timer=DungeonBattleClock.mount(byId('battle-timer'),game,round.id);
  }
  function setScreen(screen) {
    DungeonVictory.close();
    game.setScreen(screen);
    const mapVisible = screen === 'campaign';
    byId('campaign-host').hidden = !mapVisible;
    byId('battle-host').hidden = mapVisible;
    const skipLink = document.querySelector('.skip');
    skipLink.href = mapVisible ? '#campaign-host' : '#workbench';
    skipLink.textContent = mapVisible ? 'Go to campaign map' : 'Go to math workbench';
    for (const link of [byId('campaign-nav'), byId('battle-nav')]) {
      const active = link.id === screen + '-nav';
      link.classList.toggle('current', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
  function showBattle(focus = true) {
    setScreen('battle');
    mountRound();
    if (focus) {
      window.scrollTo(0, 0);
      if (!game.state.round?.receipt) byId('world-title').focus({preventScroll:true});
    }
  }
  function openPanel(name, afterSelection) {
    DungeonVictory.close();
    DungeonPanels.open(name, game, {
      onChange:updateHUD, onTravel:afterSelection || (() => showBattle()), onReset:() => showCampaign(true)
    });
  }
  function showCampaign(focus = false, countryId) {
    stopTimer();
    const capturedId = game.state.round?.receipt?.capture?.id;
    if (capturedId != null) game.leaveCampaign();
    bench?.destroy();
    bench = null;
    setScreen('campaign');
    const host = byId('campaign-host');
    DungeonCampaignMap.render(host, game, {
      onEra(id) { if(game.switchEra(id)) showCampaign(true); },
      onChooseCapital(id) { if (game.chooseCapital(id)) showCampaign(true,id); },
      onSwitchEmpire(id,country) {
        if (!game.switchEmpire(id)) return false;
        showCampaign(true,country);
        return true;
      },
      onInvade(id) { if (game.invade(id)) showBattle(); },
      onResume() {
        const {targetId, inBattle} = game.campaignView();
        if (inBattle || (targetId != null && game.invade(targetId))) showBattle();
      },
      onProgress:() => openPanel('progress'),
      onLesson(id) {
        openPanel('map',reason=>{
          if(reason!=='resume' && id!=null && game.campaignView().frontier.includes(id))game.invade(id);
          showBattle();
        });
      },
      onPractice:() => openPanel('map')
    }, {capturedId,countryId});
    updateHUD();
    if (focus) {
      window.scrollTo(0, 0);
      host.focus({preventScroll:true});
    }
  }
  document.querySelectorAll('[data-panel]').forEach(button => {
    button.addEventListener('click', () => openPanel(button.dataset.panel));
  });
  byId('music').addEventListener('click',()=>{
    game.setting('music',!game.state.settings.music);
    updateHUD();
  });
  byId('sound').addEventListener('click', () => {
    game.setting('sound', !game.state.settings.sound);
    if (game.state.settings.sound) chime(false);
    updateHUD();
  });
  byId('battle-nav').addEventListener('click', () => {
    if (game.state.screen !== 'battle') showBattle();
    else { byId('workbench').scrollIntoView({block:'nearest'}); byId('workbench').focus({preventScroll:true}); }
  });
  byId('campaign-nav').addEventListener('click', () => showCampaign(true));
  byId('empire-preview').addEventListener('click', () => showCampaign(true));
  if (game.state.screen === 'battle') showBattle(false);
  else showCampaign();
})();
