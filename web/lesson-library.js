/* The lesson shelf, tutorials and saved practice sessions share the game's local dialog. */
(function (root) {
  'use strict';
  const classic = ['decimal-tenths','decimal-hundredths','decimal-align','decimal-thousandths','decimal-carry','decimal-subtract','decimal-three','decimal-pairs'];
  const levels = ['','Foundation','Core','Challenge'];
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function action(text, fn, cls = 'll-button') {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function date(at) {
    return new Date(at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }
  function count(n, one, many = one + 's') { return n + ' ' + (n === 1 ? one : many); }
  function problemText(p) {
    if (p.a != null && p.b != null) return root.DungeonMath.operands(p).join(p.op === '-' ? ' − ' : ' + ');
    return p.prompt || p.title || root.DungeonLessons.identify(p)?.title || 'Practice problem';
  }
  function location(entry) {
    if (entry.nationId == null) return 'Practice';
    const era = root.DungeonEras.get(entry.eraId || 'modern');
    const name = era?.board.NATIONS[entry.nationId]?.name || 'Campaign';
    return era ? name + ' · ' + (era.label || era.title || era.name || era.id) : name;
  }
  function runLabel(run) {
    return root.DungeonLessons.get(run.displayLessonId || run.lessonId)?.title || 'Practice session';
  }
  function mount(body, initial, game, ui) {
    const lessons = root.DungeonLessons;
    const domainOf = lesson => classic.includes(lesson.id) ? 'Decimal addition and subtraction' : lesson.domain;
    const order = [...lessons.list].sort((a, b) => {
      const rank = x => x.id === 'decimal-three' ? -2 : x.id === 'decimal-pairs' ? -1 : classic.includes(x.id) ? classic.indexOf(x.id) : 20;
      return rank(a) - rank(b);
    });
    const domains = Array.from(new Set(order.map(domainOf)));
    let difficulty = game.lessonView().active?.difficulty || 2;
    let domain = '', query = '', board = null, search;
    let trackDomain = '', trackState = '';
    function page(title) {
      board?.destroy();
      board = null;
      ui.setTitle(title);
      body.replaceChildren();
      const modal = body.closest('dialog');
      if (modal) modal.scrollTop = 0;
    }
    function focusPage() {
      const heading = body.closest('dialog')?.querySelector('.dp-header h2');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    }
    function line(text) { return el('p','ll-copy',text); }
    function begin(id) { if (game.startLesson(id, difficulty)) ui.play('start'); }
    function levelControl() {
      const field = el('fieldset','ll-levels');
      const legend = el('legend','','Practice difficulty');
      field.append(legend);
      for (let i = 1; i <= 3; i++) {
        const label = el('label','ll-level');
        const radio = el('input');
        radio.type = 'radio'; radio.name = 'lesson-difficulty'; radio.value = i;
        radio.dataset.difficulty = i; radio.checked = i === difficulty;
        radio.addEventListener('change', () => { if (radio.checked) difficulty = i; });
        label.append(radio,el('span','',levels[i])); field.append(label);
      }
      return field;
    }
    function currentTopic() { return lessons.get(game.currentMathLesson().lessonId); }
    function sessionInfo(v,cp) {
      const run = v.active || v.activeAutomatic;
      const bar = el('section','ll-current');
      const info = el('div');
      const now = currentTopic();
      info.append(el('span','ll-label','Current practice'),el('h3','',now?.title || 'Math practice'));
      const progress = cp.progression;
      if (v.active) info.append(line(levels[run.difficulty] + ' · ' + count(run.completed,'problem') + ' completed in this session. Next up is problem ' + (run.completed+1) + '.'));
      else {
        if (cp.campaignMath === 'curriculum') {
          const upcoming = cp.plannedLesson && lessons.get(cp.plannedLesson.lessonId);
          info.append(line('Country battles follow the grade 5 curriculum.' + (upcoming ? ' Next battle · '+upcoming.title+' ('+levels[cp.plannedLesson.difficulty]+').' : '')));
        } else {
          const target = progress.nextAt ? ' Reach ' + count(progress.nextAt,'country','countries') + ' for ' + progress.nextLabel + '.' : '';
          info.append(line('Campaign decimals advance as you claim countries.' + target));
        }
      }
      bar.append(info);
      if (v.active) {
        const automatic = action('Use automatic progression', () => { if (game.automaticMath()) ui.play('automatic'); }, 'll-link');
        const resume = action('Continue session',() => { if (game.resumeLesson(run.id)) ui.play('resume'); },'ll-button');
        resume.dataset.resumeSession = run.id;
        const actions = el('div','ll-actions'); actions.append(resume,automatic);
        automatic.dataset.automatic = ''; bar.append(actions);
      } else {
        const shortcut = action('View sessions', () => { sessions(); focusPage(); }, 'll-link');
        shortcut.dataset.openSessions = ''; bar.append(shortcut);
      }
      return bar;
    }
    function recommendation(view,campaign,mastery) {
      const isCurriculum = !view.active && campaign.mathMode === 'curriculum' && campaign.plannedLesson;
      let suggested;
      if (isCurriculum) {
        const lesson = campaign.plannedLesson;
        const record = mastery.lessons.find(item => item.lessonId === lesson.lessonId);
        suggested = {...lesson, independent:record.qualifying, target:mastery.target, extra:record.mastered};
      } else suggested = lessons.nextPractice(view.sessions,view.active?.lessonId,view.active?.difficulty);
      const card = el('section','ll-recommendation');
      if (!suggested) {
        card.append(el('span','ll-label','Lesson progress'),el('h3','','All practice levels completed'),
          line('You have solved three problems independently at every lesson level. Choose any lesson to practice again.'));
        return card;
      }
      const lesson = lessons.get(suggested.lessonId);
      card.dataset.recommendation = lesson.id;
      card.append(el('span','ll-label',suggested.extra?'Extra practice':'Recommended next'),el('h3','',lesson.title));
      const meter = el('progress');
      meter.max = suggested.target;
      meter.value = suggested.independent;
      meter.setAttribute('aria-label',levels[suggested.difficulty]+' independent practice progress');
      if (suggested.extra) card.append(line(levels[suggested.difficulty]+' · All lessons mastered. This campaign battle revisits an earlier lesson.'));
      else card.append(line(levels[suggested.difficulty]+' · '+suggested.independent+' of '+suggested.target+' solved independently.'),meter,
        line(isCurriculum ? 'Three independent Core or Challenge answers advance the campaign curriculum.' : 'Three independent answers at one level earn a new recommendation.'));
      const follow = action(suggested.extra?'Start extra practice':'Start recommended practice',() => { if (game.startLesson(lesson.id,suggested.difficulty)) ui.play('start'); },'ll-primary');
      follow.dataset.startRecommendation = lesson.id;
      follow.dataset.recommendedLevel = suggested.difficulty;
      card.append(follow);
      return card;
    }
    function shelf() {
      page('Lesson library');
      const view = game.lessonView();
      const campaign = game.campaignView(), mastery = lessons.tracker(view.sessions);
      const summary = el('div','ll-overview');
      summary.append(sessionInfo(view,campaign),recommendation(view,campaign,mastery)); body.append(summary);
      const statusBar = el('div','ll-mastery-link');
      const stat = el('span','',mastery.mastered+' of '+mastery.total+' lessons mastered');
      const track = action('View learning progress',() => { progressPage(); focusPage(); },'ll-link');
      track.dataset.openProgress = '';
      statusBar.append(stat,track); body.append(statusBar);
      const controls = el('div','ll-controls');
      const filter = el('div','ll-filter');
      const searchLabel = el('label','ll-field');
      search = el('input','ll-input'); search.type = 'search'; search.placeholder = 'Find a skill or standard'; search.value = query;
      search.dataset.lessonSearch = '';
      searchLabel.append(el('span','','Search lessons'),search);
      const domainLabel = el('label','ll-field');
      const pick = el('select','ll-input'); pick.dataset.lessonDomain = '';
      for (const name of ['',...domains]) {
        const option = el('option','',name || 'All topics');
        option.value = name; pick.append(option);
      }
      pick.value = domain;
      domainLabel.append(el('span','','Topic'),pick);
      filter.append(searchLabel,domainLabel);
      controls.append(levelControl(),filter); body.append(controls);
      const status = el('span','ll-sr'); status.setAttribute('role','status');
      const list = el('div','ll-results'); list.dataset.lessonList = ''; body.append(status,list);
      const counts = new Map();
      for (const run of view.sessions) for (const e of run.history) {
        const id = lessons.topicOf(e)?.id;
        if (id) counts.set(id,(counts.get(id)||0)+1);
      }
      function cards() {
        list.replaceChildren();
        const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        for (const category of domains) {
          if (domain && domain !== category) continue;
          const matches = order.filter(lesson => {
            if (domainOf(lesson) !== category) return false;
            const text = [lesson.title,lesson.domain,category,lesson.codes?.join(' ')].join(' ').toLocaleLowerCase();
            return words.every(word => text.includes(word));
          });
          if (!matches.length) continue;
          const section = el('section','ll-domain'), heading = el('h3','ll-domain-title',category);
          const grid = el('div','ll-cards');
          for (const lesson of matches) {
            const item = el('article','ll-card');
            item.dataset.lessonId = lesson.id;
            const index = classic.indexOf(lesson.id);
            const label = (lesson.codes || []).join(' · ');
            const buttons = el('div','ll-actions');
            const practice = action('Practice',() => begin(lesson.id),'ll-primary');
            practice.dataset.lessonPractice = lesson.id;
            if (index >= 0 && index < root.DungeonAdventure.WORLDS.length) practice.dataset.world = index;
            practice.append(el('span','ll-sr',' ' + lesson.title));
            const learn = action('Tutorial',() => { tutorial(lesson, 'shelf'); focusPage(); },'ll-link');
            learn.dataset.learnLesson = lesson.id; learn.setAttribute('aria-label','Tutorial for ' + lesson.title);
            buttons.append(practice,learn);
            if (label) item.append(el('span','ll-card-note',label));
            item.append(el('h4','',lesson.title));
            if (counts.get(lesson.id)) item.append(el('span','ll-completed',count(counts.get(lesson.id),'problem')+' completed'));
            item.append(buttons);
            grid.append(item);
          }
          section.append(heading,grid); list.append(section);
        }
        status.textContent = count(list.querySelectorAll('[data-lesson-id]').length,'lesson') + ' found';
        if (!list.children.length) list.append(line('No lessons match this search. Try another word or change the topic.'));
      }
      search.addEventListener('input',() => { query = search.value; cards(); });
      pick.addEventListener('change',() => { domain = pick.value; cards(); });
      cards();
    }
    function back(text, fn) {
      const b = action('‹  '+text,() => { fn(); focusPage(); },'ll-link ll-back');
      b.dataset.lessonBack = ''; return b;
    }
    function tutorial(lesson, from) {
      if (!lesson) { shelf(); return; }
      page('Lesson tutorial');
      if (from === 'shelf') body.append(back('All lessons',shelf));
      const top = el('section','ll-intro');
      top.append(el('span','ll-label',domainOf(lesson)),el('h3','',lesson.title),line(lesson.tutorial.intro));
      body.append(top);
      const steps = el('ol','ll-steps');
      for (const step of lesson.tutorial.steps) steps.append(el('li','',step));
      body.append(steps);
      if (lesson.tutorial.model && root.DungeonLessonBoard?.model) body.append(root.DungeonLessonBoard.model(lesson.tutorial.model));
      const footer = el('div','ll-footer');
      if (from === 'shelf') {
        const start = action('Start this lesson',() => begin(lesson.id),'ll-primary');
        start.dataset.tutorialStart = lesson.id;
        footer.append(levelControl(),start);
      } else {
        const resume = action('Back to my problem',ui.close,'ll-primary');
        resume.dataset.tutorialReturn = ''; footer.append(resume);
      }
      body.append(footer);
    }
    function progressPage() {
      page('Learning progress');
      const view = game.lessonView(), tracker = lessons.tracker(view.sessions);
      const history = new Map();
      for (const run of view.sessions) {
        for (const e of run.history) {
          const id = lessons.topicOf(e)?.id, old = history.get(id);
          if (id && (!old || e.at > old.entry.at || e.at === old.entry.at && e.roundId > old.entry.roundId)) history.set(id,{run,entry:e});
        }
      }
      const statusOf = item => item.mastered ? 'Mastered' : item.completed ? 'In progress' : 'Unstarted';
      const summary = el('section','ll-intro ll-mastery-head');
      summary.dataset.masteredCount = tracker.mastered;
      const total = tracker.total;
      const underway = tracker.lessons.filter(item=>statusOf(item)==='In progress').length;
      summary.append(el('span','ll-label','Lesson mastery'),el('h3','',tracker.mastered+' of '+total+' mastered'),
        line(underway+' in progress · '+(total-tracker.mastered-underway)+' unstarted'));
      const meter = el('progress'); meter.max = total; meter.value = tracker.mastered; meter.setAttribute('aria-label','Mastered lessons');
      summary.append(meter,line('Master a lesson with three independent Core or Challenge problems. Country battles count. Foundation builds practice, and reviews let you repeat a saved problem.'));
      body.append(summary);
      const filter = el('div','ll-filter');
      function choice(label,options,value,fn,attribute) {
        const field=el('label','ll-field'), select=el('select','ll-input');
        select.dataset[attribute]='';
        options.forEach(([v,text])=>{const opt=el('option','',text);opt.value=v;select.append(opt);});
        select.value=value;select.addEventListener('change',()=>{fn(select.value);rows();});
        field.append(el('span','',label),select);filter.append(field);
      }
      choice('Topic',[['','All topics'],...domains.map(d=>[d,d])],trackDomain,v=>{trackDomain=v;},'progressDomain');
      choice('Progress',[['','All lessons'],...['Mastered','In progress','Unstarted'].map(d=>[d,d])],trackState,v=>{trackState=v;},'progressStatus');
      const controls=el('div','ll-controls');controls.append(levelControl(),filter);body.append(controls);
      const statById = new Map(tracker.lessons.map(item=>[item.lessonId,item]));
      const list = el('div','ll-results'); body.append(list);
      function rows() {
        list.replaceChildren();
        for (const category of domains) {
          if (trackDomain && trackDomain !== category) continue;
          const all = order.filter(l=>domainOf(l)===category);
          const matching = all.filter(l=>!trackState || statusOf(statById.get(l.id))===trackState);
          if (!matching.length) continue;
          const section=el('section','ll-domain');
          const earned=all.filter(l=>statById.get(l.id).mastered).length;
          section.append(el('h3','ll-domain-title',category+' · '+earned+' of '+all.length+' mastered'));
          for (const lesson of matching) {
            const item=statById.get(lesson.id), marker=statusOf(item);
            const row=el('article','ll-tracked');
            row.dataset.trackedLesson=lesson.id;row.dataset.masteryStatus=marker;
            const main=el('div','ll-tracked-main'), title=el('div','ll-tracked-title');
            title.append(el('h4','',lesson.title),el('span','ll-tracked-status',marker));
            const desc=item.completed ? count(item.completed,'problem')+' completed · '+item.independent+' independent · '+item.qualifying+' at Core or Challenge' :
              'Earn '+tracker.target+' independent Core or Challenge solves';
            main.append(title,line(desc));
            if (item.mastered) main.append(line('Mastered '+date(item.masteredAt)+' · '+count(item.extraPractice,'extra problem')+' since mastery · '+count(item.reviews,'review')));
            else if (item.reviews) main.append(line(count(item.reviews,'review')+' completed'));
            const actions=el('div','ll-actions'), start=action(item.mastered?'Extra practice':'Practice',() => begin(lesson.id),'ll-button');
            start.dataset.trackerPractice=lesson.id;actions.append(start);
            const target=history.get(lesson.id);
            if (target) {
              const revisit=action('Revisit problem',() => { review(target.run.id,target.entry.roundId,progressPage);focusPage(); },'ll-link');
              revisit.dataset.trackerRevisit=lesson.id;actions.append(revisit);
            }
            row.append(main,actions);section.append(row);
          }
          list.append(section);
        }
        if (!list.children.length) list.append(line('No lessons match these filters.'));
      }
      rows();
    }
    function sessions() {
      page('Practice sessions');
      const v = game.lessonView();
      const choose = action('Choose a lesson',() => { shelf(); focusPage(); },'ll-link');
      const total = v.sessions.reduce((n,r) => n+r.completed,0);
      const intro = el('section','ll-current');
      const title = el('div');
      title.append(el('span','ll-label','Practice history'),el('h3','',count(total,'completed problem')),
        line('Continue a session or work through one of its problems again.'));
      intro.append(title,choose); body.append(intro);
      if (v.legacyCount) body.append(line(count(v.legacyCount,'earlier problem')+' recorded in the parent progress report before individual problem history was available.'));
      if (!v.sessions.length) { body.append(line('Your first session appears here when you start a lesson or play a battle.')); return; }
      const list = el('div','ll-runs');
      for (const run of v.sessions) {
        const active = run.id === (v.active || v.activeAutomatic)?.id;
        const card = el('article','ll-run'); card.dataset.sessionId = run.id;
        const info = el('div');
        info.append(el('span','ll-card-note','Session '+run.id+' · '+date(run.startedAt)),
          el('h3','',runLabel(run)),line((run.automatic ? 'Automatic' : levels[run.difficulty]) + ' · ' + count(run.completed,'problem') + ' completed' +
            (active ? ' · Current' : '') + (run.hasDraft ? ' · In progress' : '')));
        const tools = el('div','ll-actions');
        const inspect = action('View problems',() => { session(run.id); focusPage(); },'ll-button');
        inspect.dataset.viewSession = run.id;
        const resume = action('Continue session',() => { if (game.resumeLesson(run.id)) ui.play('resume'); },'ll-link');
        resume.dataset.resumeSession = run.id; tools.append(inspect,resume);
        card.append(info,tools); list.append(card);
      }
      body.append(list);
    }
    function session(id) {
      const run = game.lessonView().sessions.find(r => r.id === id);
      if (!run) { sessions(); return; }
      page('Session '+run.id);
      body.append(back('All sessions',sessions));
      const independent = run.history.filter(e=>e.independent).length;
      const head = el('section','ll-intro');
      head.append(el('span','ll-label',date(run.startedAt)),el('h3','',runLabel(run)),
        line((run.automatic?'Automatic progression':levels[run.difficulty])+' · '+count(run.completed,'problem')+' completed · '+independent+' solved independently'));
      if (run.completed) head.append(line(count(run.xp,'XP','XP')+' · '+count(run.coins,'coin')+' earned'));
      body.append(head);
      if (run.pending?.length) {
        const pending = el('section','ll-history');
        pending.append(el('h4','','Unfinished problems'));
        for (const entry of run.pending) {
          const where = location(entry);
          const item = el('div','ll-entry');
          const resume = action('Resume problem',() => { if (game.resumeLesson(id,entry.roundId)) ui.play('resume'); });
          resume.dataset.resumeProblem = entry.roundId;
          const topic=lessons.get(entry.lessonId);
          item.append(el('span','',[topic?.title,where,'Problem '+entry.roundId].filter(Boolean).join(' · ')),resume); pending.append(item);
        }
        body.append(pending);
      }
      const list = el('div','ll-history');
      for (const [i,entry] of run.history.entries()) {
        const row = el('article','ll-entry'); row.dataset.roundId = entry.roundId;
        const details = el('div'), lesson = lessons.topicOf(entry);
        details.append(el('span','ll-card-note','Problem '+(i+1)+(lesson ? ' · '+lesson.title : '')+' · '+location(entry)),
          el('h4','',problemText(entry.problem)),line('Answer '+entry.answer+' · '+(entry.independent ? 'Independent' : 'With support')));
        if (entry.reviewCount) details.append(el('span','ll-completed',count(entry.reviewCount,'review')+' completed'));
        if (entry.work?.length || entry.pair || entry.problem.c!=null) details.append(workRecord(entry));
        const paper=root.DungeonPaper.review(entry.paper);
        if(paper)details.append(paper);
        const replay = action(entry.hasReviewDraft ? 'Continue review' : 'Practice again',() => { review(id,entry.roundId); focusPage(); });
        replay.dataset.revisit = entry.roundId;
        row.append(details,replay); list.append(row);
      }
      body.append(list);
      if (!run.history.length) body.append(line('Each problem you finish in this session will appear here.'));
      const resume = action('Continue this session',() => { if (game.resumeLesson(id)) ui.play('resume'); },'ll-primary');
      resume.dataset.resumeSession = id; body.append(resume);
    }
    function workRecord(entry) {
      const details = el('details','ll-work');
      details.append(el('summary','','Show checked work'));
      const steps = el('ol');
      if (entry.work?.length) {
        entry.work.forEach(step => {
          const li = el('li');
          li.append(el('span','',step.prompt),el('strong','',step.answer)); steps.append(li);
        });
      } else if(entry.pair) {
        const values = root.DungeonMath.operands(entry.problem);
        const result = root.DungeonMath.pairPlan(entry.problem,entry.pair);
        steps.append(el('li','',values[entry.pair[0]]+' + '+values[entry.pair[1]]+' = '+result.subtotal),
          el('li','',result.subtotal+' + '+result.remaining+' = '+result.answer));
      }
      if(steps.children.length)details.append(steps);
      const rounding=root.MathWorkbench.estimateSummary(entry.problem);
      if(rounding)details.append(rounding);
      return details;
    }
    function review(id, roundId, fromTracker) {
      const entry = game.reviewLessonProblem(id,roundId);
      if (!entry) { session(id); return; }
      page('Problem review');
      body.append(back(fromTracker?'Learning progress':'Session '+id,fromTracker || (() => session(id))));
      const intro = el('h3','',lessons.topicOf(entry)?.title || 'Practice problem');
      const host = el('section','ll-board'); host.dataset.reviewBoard = '';
      body.append(intro,host);
      const engine = entry.problem.kind === 'lesson' ? root.DungeonLessonBoard : root.MathWorkbench;
      board = engine.mount(host,{problem:entry.problem,mode:entry.mode,draft:entry.draft,
        onDraft(draft) { game.saveReviewDraft(id,roundId,draft); },
        onComplete(result) {
          game.finishReview(id,roundId);
          page('Review complete');
          const done = el('section','ll-intro'); done.dataset.reviewComplete = '';
          done.append(el('span','ll-label','Session '+id),el('h3','',lessons.topicOf(entry)?.title || 'Problem complete'),line(problemText(entry.problem)),
              el('p','ll-answer','Answer '+(result.answer ?? entry.answer)));
          const rounding=root.MathWorkbench.estimateSummary(entry.problem);
          if(rounding)done.append(rounding);
          const backToSession = action(fromTracker?'Back to progress':'Back to session',() => { if (fromTracker) fromTracker(); else session(id); focusPage(); },'ll-primary');
          body.append(done,backToSession); focusPage();
        }});
    }
    if (initial === 'progress') progressPage();
    else if (initial === 'sessions') sessions();
    else if (initial === 'tutorial') tutorial(currentTopic(),'game');
    else shelf();
    return {destroy() { board?.destroy(); }};
  }
  root.DungeonLessonLibrary = { mount };
})(globalThis);
