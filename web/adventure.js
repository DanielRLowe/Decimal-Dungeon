/* Decimal Dungeon's local adventure and progress model. */
(function (root) {
  'use strict';

  const SAVE_KEY = 'decimal-dungeon.adventure.v1';
  const CLOCK_KEY = SAVE_KEY + '.clock';
  const modernBoard = typeof module !== 'undefined' && module.exports ? require('./campaign-data.js') : root.DungeonCampaign;
  const modernCapitals = typeof module !== 'undefined' && module.exports ? require('./capitals.js') : root.DungeonCapitals;
  function registry() {
    return root.DungeonLessons || (typeof module !== 'undefined' && module.exports ? require('./lessons.js') : null);
  }

  const BIOMES = [
    { icon: 'leaf', monsters: ['Moss Slime', 'Fern Slime'], special: 'Golden Slime', boss: 'King Slime' },
    { icon: 'gem', monsters: ['Crystal Sprite', 'Quartz Hopper'], special: 'Prism Sprite', boss: 'Amethyst Golem' },
    { icon: 'arch', monsters: ['Pebble Golem', 'Rune Sprite'], special: 'Treasure Mimic', boss: 'The Rune Keeper' },
    { icon: 'tower', monsters: ['Bone Squire', 'Lantern Wisp'], special: 'Silver Sentinel', boss: 'The Bone Knight' },
    { icon: 'flame', monsters: ['Ember Drake', 'Cinder Sprite'], special: 'Gilded Drake', boss: 'The Ember Dragon' },
    { icon: 'moon', monsters: ['Shadow Wisp', 'Moon Moth'], special: 'Twilight Sprite', boss: 'The Moon Guardian' }
  ];
  const SCHOOLWORK = BIOMES.length;
  const schoolworkBiome = 4;
  const WORLDS = [...BIOMES, {...BIOMES[schoolworkBiome], icon:'book', biome:schoolworkBiome}]
    .map((setting,world) => {
      const title=registry().forWorld(world).title;
      return {...setting,name:title,skill:title};
    });
  const MONSTER_ART = Object.freeze({
    'Moss Slime': 'slime', 'Fern Slime': 'fern', 'Golden Slime': 'slime', 'King Slime': 'slime',
    'Crystal Sprite': 'sprite', 'Quartz Hopper': 'hopper', 'Prism Sprite': 'sprite', 'Amethyst Golem': 'golem',
    'Pebble Golem': 'golem', 'Rune Sprite': 'sprite', 'Treasure Mimic': 'mimic', 'The Rune Keeper': 'keeper',
    'Bone Squire': 'squire', 'Lantern Wisp': 'wisp', 'Silver Sentinel': 'squire', 'The Bone Knight': 'squire',
    'Ember Drake': 'drake', 'Cinder Sprite': 'sprite', 'Gilded Drake': 'drake', 'The Ember Dragon': 'drake',
    'Shadow Wisp': 'wisp', 'Moon Moth': 'moth', 'Twilight Sprite': 'sprite', 'The Moon Guardian': 'guardian'
  });
  const HEROES = [
    { id: 'ranger', name: 'Rowan', role: 'Forest ranger', color: '#81d0a5' },
    { id: 'mage', name: 'Nova', role: 'Star mage', color: '#bda7f3' },
    { id: 'knight', name: 'Pip', role: 'Dawn knight', color: '#f5b47c' }
  ];
  const WEAPONS = [
    { id: 'wand', name: 'Apprentice wand', cost: 0, color: '#ba9476' },
    { id: 'staff', name: 'Moon staff', cost: 24, color: '#bca9f6' },
    { id: 'blade', name: 'Amber blade', cost: 40, color: '#f1b864' },
    { id: 'crystal', name: 'Crystal wand', cost: 60, color: '#7ae2d6' }
  ];
  const SKILLS = {
    align: 'Decimal alignment', zeros: 'Placeholder zeros', columns: 'Column arithmetic',
    regroup: 'Carrying and borrowing', answer: 'Final answer', estimate: 'Estimation', reasoning:'Lesson reasoning'
  };
  const PRACTICE = {
    align: 'Slide each lower number until all decimal points share one column.',
    zeros: 'Write a zero in each empty decimal place before you add or subtract.',
    columns: 'Start at the right edge. Work one column at a time.',
    regroup: 'Use the little boxes to keep track of each carry or borrow.',
    answer: 'Read the result from left to right, including its decimal point.',
    estimate: 'Round each number to a whole number, then check the size of the answer.',
    reasoning:'Read the question, work through its steps, and use the lesson example to check your thinking.'
  };
  const modes = ['guided', 'standard', 'challenge'];
  const levelCost = 100;
  const numberIn = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

  const CAMPAIGN_LEVELS = [
    {at:1, world:0, label:'Adding tenths'},
    {at:2, world:1, label:'Adding hundredths'},
    {at:4, world:2, label:'Matching decimal places and carrying'},
    {at:6, world:3, label:'Adding thousandths and choosing a pair'},
    {at:9, world:4, label:'Carrying and adding pairs of decimals'},
    {at:13, world:SCHOOLWORK, label:'Adding three decimals to four places'}
  ];
  const rivalColors = ['#d67b83', '#88a6ec', '#dba76e'];
  function levelAt(peak) {
    let level = 0;
    while (level + 1 < CAMPAIGN_LEVELS.length && peak >= CAMPAIGN_LEVELS[level + 1].at) level++;
    return level;
  }
  function factionName(raw) {
    if (typeof raw !== 'string' || /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/u.test(raw)) return null;
    const name = raw.trim().normalize('NFC').replace(/\s+/gu, ' ');
    return name && [...name].length <= 32 ? name : null;
  }

  function freshStats() {
    return { count: 0, firstTry: 0, independent: 0, hints: 0, errors: {} };
  }

  function mapKey(eraId) { return eraId === 'modern' ? 'earth-v1' : 'earth-' + eraId + '-v1'; }
  function newCampaign(eraId = 'modern') {
    return {
      map:mapKey(eraId), mathMode:'curriculum', capitalId:null, seatId:null, administration:{}, owned:[], targetId:null, inBattle:false, garrisons:{},
      empireName:'Your empire', peakHoldings:0, turn:0, spells:0, lastProblem:null, rivals:[], nextRival:1,
      rivalMoves:[], raceGoal:null, winner:null
    };
  }

  function newRegion(recommended) {
    return { unlocked: true, recommended, clears: 0, health: null, bossCleared: false, recent: [], parkedRound: null, practiceSpells: 0, stats: freshStats() };
  }

  function fresh(now) {
    return {
      version: 1, combatVersion: 2, world: 0, xp: 0, coins: 0, hero: 'ranger', weapon: 'wand', owned: ['wand'],
      settings: { mode: 'guided', sound: true, music:false, timer:true, mastery: 8 },
      stats: freshStats(), round: null, serial: 0, pin: null, screen: 'campaign', eraId:'modern', eraCampaigns:{}, campaign: newCampaign(),
      regions: WORLDS.map((_, i) => newRegion(i === 0)),
      lessonBook: { activeId:null, autoId:null, serial:0, runs:[], legacyCount:0 },
      history: [], sessions: [], session: { start: now, last: now, count: 0 }
    };
  }

  function battleTargetMs(problem) {
    if (problem.kind === 'lesson') {
      const seconds = problem.steps.reduce((sum, step) => {
        if (step.plot || step.format === 'fraction') return sum + 50;
        if (step.choices) return sum + 25;
        return sum + 40;
      }, 50);
      return seconds * 1000;
    }
    const math = root.DungeonMath || require('./math.js');
    function writtenSeconds(sheet) {
      const carries = sheet.columns.filter(column => column.outgoing > 0).length;
      return 30 + 15 * (sheet.rows.length - 1) + 10 * sheet.blanks.length + 13 * sheet.columns.length + 10 * carries;
    }
    if (problem.kind === 'pair') {
      const values = math.operands(problem);
      const choices = [[0,1],[0,2],[1,2]].map(pair => {
        const first = math.analyze({a:values[pair[0]], b:values[pair[1]], op:'+'});
        const second = math.analyze({a:first.answer,b:values[3-pair[0]-pair[1]],op:'+'},{firstIsSubtotal:true});
        return writtenSeconds(first) + writtenSeconds(second);
      });
      // The child can choose any pair and has time for both complete calculations.
      return (65 + Math.max(...choices)) * 1000;
    }
    return (35 + writtenSeconds(math.analyze(problem))) * 1000;
  }

  function validSave(s) {
    return s && s.version === 1 && Array.isArray(s.regions) && numberIn(s.world, 0, s.regions.length - 1)
      && numberIn(s.regions.length, BIOMES.length, WORLDS.length) && s.regions.every(r => r && r.stats && Array.isArray(r.recent))
      && s.settings && s.stats && s.session && Array.isArray(s.owned) && Array.isArray(s.sessions)
      && Array.isArray(s.history) && numberIn(s.serial, 0, Number.MAX_SAFE_INTEGER);
  }

  function enemy(biome, kind, variant, health, campaign = false) {
    const world = BIOMES[biome];
    const name = kind === 'boss' ? world.boss : kind === 'special' ? world.special : world.monsters[variant % world.monsters.length];
    const maxSpells = kind === 'boss' ? 2 : 1;
    const spellPower = campaign ? 10 : 30;
    const maxHp = maxSpells * spellPower;
    const hp = health ?? maxHp;
    return { name, kind, maxHp, hp, maxSpells, spellsLeft: Math.ceil(hp / spellPower) };
  }

  function enemyAt(index, region) {
    const slot = region.clears % 5;
    return enemy(WORLDS[index].biome ?? index, slot === 4 ? 'boss' : slot === 2 ? 'special' : 'normal', region.clears, region.health);
  }

  function upgradePacing(state, board) {
    const c = state.campaign;
    const defaults = newCampaign();
    for (const key of ['empireName','peakHoldings','turn','spells','lastProblem','rivals','nextRival','rivalMoves','raceGoal','winner']) {
      if (!(key in c)) c[key] = defaults[key];
    }
    c.peakHoldings = Math.max(c.peakHoldings, c.owned.length);
    if (state.combatVersion === 2) return;
    c.turn = Math.max(c.turn, c.owned.length - 1);
    function remaining(hp, biome, kind, minimumSpell) {
      if (hp === null) return hp;
      const oldMax = kind === 'boss' ? 90 + biome * 5 : kind === 'special' ? 45 + biome * 3 : 30 + biome * 2;
      const newMax = minimumSpell * (kind === 'boss' ? 2 : 1);
      if (hp >= oldMax) return newMax;
      // A previously wounded boss always needs at most one more correct spell.
      return Math.max(1, Math.min(minimumSpell, Math.ceil(newMax * hp / oldMax)));
    }
    state.regions.forEach((region, i) => {
      region.health = remaining(region.health, WORLDS[i].biome ?? i, enemyAt(i,region).kind, 30);
    });
    for (const [id, garrison] of Object.entries(c.garrisons)) {
      const n = board.NATIONS[id];
      garrison.hp = remaining(garrison.hp, n.biome, n.rank, 10);
    }
    // Initial rendering creates a round before the player touches it. A blank,
    // obsolete campaign round can be regenerated directly at the migrated level.
    const floor = CAMPAIGN_LEVELS[levelAt(c.peakHoldings)].world;
    const unstarted = r => c.mathMode === 'classic' && r && !r.draft && !r.receipt && r.world < floor;
    if (c.inBattle && unstarted(state.round)) state.round = null;
    for (const garrison of Object.values(c.garrisons)) {
      for (const [slot, round] of Object.entries(garrison.rounds)) if (unstarted(round)) delete garrison.rounds[slot];
    }
    state.combatVersion = 2;
  }

  function focusFor(region) {
    const errors = {};
    region.recent.slice(-5).forEach((r, i) => {
      for (const [key, count] of Object.entries(r.errors)) {
        errors[key] = (errors[key] || 0) + Math.min(count, 3) * (i + 1);
      }
    });
    return Object.keys(errors).sort((a, b) => errors[b] - errors[a])[0] || null;
  }

  function addStats(stats, entry) {
    stats.count++;
    stats.firstTry += Number(entry.firstTry);
    stats.independent += Number(entry.independent);
    stats.hints += entry.hints;
    for (const [k, n] of Object.entries(entry.errors)) stats.errors[k] = (stats.errors[k] || 0) + n;
  }

  function checkRecommendations(s) {
    const newly = [];
    s.regions.forEach((r, index) => {
      const next = s.regions[index + 1];
      if (next && !next.recommended && r.bossCleared && r.recent.length === 10 &&
          r.recent.filter(x => x.mastered).length >= s.settings.mastery) {
        next.recommended = true;
        newly.push(index + 1);
      }
    });
    return newly;
  }

  function open(storage, options = {}) {
    const clock = options.now || Date.now;
    const monotonic = options.monotonicNow || (() => root.performance?.now() ?? Date.now());
    let timingRound = null, lastTick = 0;
    const lessons = () => options.lessons || registry();
    function eraData(id) {
      if (!['modern','ww1','ww2','1886'].includes(id)) return null;
      const collection = options.eras || root.DungeonEras;
      if (collection) return collection.get(id);
      if (id === 'modern') return {id, board:modernBoard, capitals:modernCapitals};
      return typeof module !== 'undefined' && module.exports ? require('./eras.js').get(id) : null;
    }
    let board = modernBoard, capitals = modernCapitals;
    let available = true;
    let state = fresh(clock());
    try {
      if (storage === undefined) storage = root.DungeonNativeStorage || root.localStorage;
      if (!storage) available = false;
      const saved = storage?.getItem(SAVE_KEY);
      if (saved) {
        const decoded = JSON.parse(saved);
        if (validSave(decoded)) {
          state = decoded;
          state.eraId ??= 'modern';
          state.eraCampaigns ??= {};
          const era = eraData(state.eraId);
          board = era.board;
          capitals = era.capitals;
          delete state.settings.sessionMinutes;
          state.settings.music ??= false;
          state.settings.timer ??= true;
          const timing = state.round?.timing;
          if (timing?.token) {
            let checkpoint;
            try { checkpoint = JSON.parse(storage.getItem(CLOCK_KEY) || 'null'); }
            catch { /* The full save still contains its last measured duration. */ }
            if (checkpoint?.token === timing.token && numberIn(checkpoint.elapsedMs,0,Number.MAX_SAFE_INTEGER)) {
              timing.elapsedMs = Math.max(timing.elapsedMs,checkpoint.elapsedMs);
            }
          }
          if (state.regions.length === BIOMES.length) state.regions.push(newRegion(false));
          if (state.campaign?.map !== mapKey(state.eraId)) {
            if (state.campaign?.inBattle) {
              state.round = state.regions[state.world].parkedRound;
              state.regions[state.world].parkedRound = null;
            }
            state.campaign = newCampaign(state.eraId);
            // Original releases created the opening puzzle simply by launching.
            // Resume old work only when the player actually started an adventure.
            state.screen = state.round && (state.round.draft || state.round.receipt || state.stats.count || state.world) ? 'battle' : 'campaign';
          }
          state.campaign.mathMode ??= 'curriculum';
          state.campaign.administration ??= {};
          state.campaign.seatId ??= state.campaign.capitalId;
          upgradePacing(state, board);
          if (!state.lessonBook) {
            state.lessonBook = {activeId:null, autoId:null, serial:0, runs:[], legacyCount:state.stats.count};
            importParkedWork();
          }
          state.regions.forEach((region, index) => {
            region.recommended ??= index === 0 || (index !== SCHOOLWORK && region.unlocked);
            region.unlocked = true;
          });
        }
      }
    } catch { available = false; }

    function roundTiming(round) {
      if (!round.timing) {
        // An older partially written solution has no record of the time already spent.
        const token = root.crypto?.randomUUID?.() || (clock() + '-' + round.id + '-' + Math.random());
        round.timing = {token, targetMs:battleTargetMs(round.problem), elapsedMs:0,
          eligible:state.settings.timer && !round.draft, tracked:false};
      }
      return round.timing;
    }
    function tick() {
      if (!timingRound) return;
      const now = monotonic();
      if (now > lastTick) timingRound.timing.elapsedMs += now - lastTick;
      lastTick = now;
      if (state.round !== timingRound || state.screen !== 'battle' || !state.settings.timer || timingRound.receipt) timingRound = null;
    }
    function stopClock() {
      tick();
      timingRound = null;
    }
    function battleTiming(id) {
      if (state.round?.id !== id || state.round.receipt) return null;
      tick();
      const timing = roundTiming(state.round);
      return {elapsedMs:Math.floor(timing.elapsedMs), targetMs:timing.targetMs, eligible:timing.eligible,
        tracked:timing.tracked, running:timingRound === state.round};
    }
    function setBattleActive(id, running) {
      if (typeof running !== 'boolean') return false;
      if (!running) {
        if (timingRound?.id !== id) return false;
        stopClock();
        save();
        return true;
      }
      if (state.screen !== 'battle' || state.round?.id !== id || state.round.receipt || !state.settings.timer) return false;
      if (timingRound === state.round) return true;
      stopClock();
      timingRound = state.round;
      roundTiming(timingRound).tracked = true;
      lastTick = monotonic();
      save();
      return true;
    }
    function checkpointBattle(id) {
      if (timingRound?.id !== id) return false;
      tick();
      if (!timingRound) return false;
      // Heartbeats persist only the clock, keeping large lesson histories out of this write.
      const {token,elapsedMs} = timingRound.timing;
      try { storage.setItem(CLOCK_KEY,JSON.stringify({token,elapsedMs:Math.floor(elapsedMs)})); return true; }
      catch { return false; }
    }
    function save() {
      tick();
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(state));
        available = true;
      } catch { available = false; }
    }
    function sessionStart(now) {
      if (state.session.count) state.sessions = [...state.sessions, { ...state.session }].slice(-30);
      state.session = { start: now, last: now, count: 0 };
    }
    function touch() {
      const now = clock();
      if (now - state.session.last >= 30 * 60 * 1000 || now < state.session.last) sessionStart(now);
      state.session.last = now;
    }
    function findRun(id) { return state.lessonBook.runs.find(run => run.id === id); }
    function activeRun() { return findRun(state.lessonBook.activeId); }
    function context() {
      const c = state.campaign;
      return {world:state.world, nationId:c.inBattle ? c.targetId : null, eraId:state.eraId};
    }
    function slot(location, run) {
      const era = location.eraId && location.eraId !== 'modern' ? location.eraId + '/' : '';
      const area = location.nationId == null ? 'training' : 'country:' + location.nationId;
      return era + area + (run?.lessonId ? '' : ':' + location.world);
    }
    function createRun(lessonId, difficulty) {
      const book = state.lessonBook, now = clock();
      const run = {id:++book.serial, lessonId, difficulty, automatic:lessonId === null,
        startedAt:now, lastAt:now, completed:0, created:0, parked:{}, location:context(), history:[]};
      book.runs.push(run);
      book.activeId = run.id;
      if (run.automatic) book.autoId = run.id;
      return run;
    }
    function importParkedWork() {
      let run;
      function importRound(round, world, nationId) {
        if (!round || round.receipt) return false;
        run ||= createRun(null,null);
        round.lessonSessionId = run.id;
        round.practiceWorld = world;
        round.eraId = state.eraId;
        run.parked[slot({world,nationId,eraId:state.eraId},run)] = round;
        run.created++;
        return true;
      }
      state.regions.forEach((region,world) => {
        if (importRound(region.parkedRound,world,null)) region.parkedRound = null;
      });
      for (const [countryId,garrison] of Object.entries(state.campaign.garrisons)) {
        for (const [world,round] of Object.entries(garrison.rounds)) {
          if (importRound(round,Number(world),Number(countryId))) delete garrison.rounds[world];
        }
      }
    }
    function ensureRun() {
      const existing = activeRun();
      if (existing && !(existing.automatic && !state.round && existing.completed && clock() - existing.lastAt >= 30 * 60 * 1000)) return existing;
      return createRun(null, null);
    }
    function summarize(run) {
      if (!run) return null;
      const current = activeRun()?.id === run.id ? state.round : null;
      const pending = [current, ...Object.values(run.parked)].filter(r => r && !r.receipt)
        .map(r => ({roundId:r.id, eraId:r.eraId || 'modern', nationId:r.nationId, world:r.world,
          lessonId:lessonForRound(r)?.lessonId, hasWork:!!r.draft}));
      const parked=run.parked[run.recoveryKey] || run.parked[slot(run.location,run)];
      const recent=run.history[run.history.length-1];
      const displayLessonId=run.lessonId || lessonForRound(current || parked)?.lessonId ||
        pending[0]?.lessonId || registry().topicOf(recent)?.id;
      return {id:run.id, lessonId:run.lessonId, displayLessonId, difficulty:run.difficulty, automatic:run.automatic,
        startedAt:run.startedAt, lastAt:run.lastAt, completed:run.completed, location:{eraId:'modern',...run.location},
        pending, hasDraft:pending.length > 0, xp:run.history.reduce((n,h) => n + h.xp,0),
        coins:run.history.reduce((n,h) => n + h.coins,0),
        history:run.history.map(({reviewDraft,...entry}) => ({eraId:'modern', ...entry, hasReviewDraft:!!reviewDraft}))};
    }
    function lessonView() {
      const active = activeRun();
      return {active:active?.lessonId ? summarize(active) : null, activeAutomatic:active?.automatic ? summarize(active) : null,
        sessions:[...state.lessonBook.runs].sort((a,b) => b.lastAt - a.lastAt || b.id - a.id).map(summarize),
        legacyCount:state.lessonBook.legacyCount};
    }
    function findRecord(runId, roundId) { return findRun(runId)?.history.find(record => record.roundId === roundId); }
    function reviewLessonProblem(runId, roundId) {
      const record = findRecord(runId, roundId);
      if (!record) return null;
      const {reviewDraft, ...snapshot} = record;
      return JSON.parse(JSON.stringify({eraId:'modern', ...snapshot, draft:reviewDraft || null}));
    }
    function saveReviewDraft(runId, roundId, draft) {
      const record = findRecord(runId, roundId);
      if (!record || !draft || typeof draft !== 'object') return false;
      record.reviewDraft = draft;
      save();
      return true;
    }
    function finishReview(runId, roundId) {
      const record = findRecord(runId, roundId);
      if (!record || !record.reviewDraft) return false;
      record.reviewCount++;
      delete record.reviewDraft;
      save();
      return true;
    }
    function defenderAt(id) {
      if (id === null || id === state.campaign.capitalId) return null;
      const nation = board.NATIONS[id];
      const health = state.campaign.owned.includes(id) ? 0 : state.campaign.garrisons[id]?.hp;
      return enemy(nation.biome, nation.rank, nation.variant, health, true);
    }
    function frontier() {
      const { owned } = state.campaign;
      return board.NATIONS.filter(n => !owned.includes(n.id) && n.neighbors.some(id => owned.includes(id))).map(n => n.id);
    }
    function countryProfile(id) {
      const original = capitals.get(id);
      const nation = board.NATIONS[id];
      const changes = state.campaign.administration[id] || {};
      return {
        countryName:changes.countryName ?? nation.name, capitalName:changes.capitalName ?? original.name,
        x:changes.x ?? original.x, y:changes.y ?? original.y, originalCountryName:nation.name,
        originalCapitalName:original.name, originalX:original.x, originalY:original.y, note:original.note,
        customCountryName:changes.countryName !== undefined, customCapitalName:changes.capitalName !== undefined,
        customLocation:changes.x !== undefined
      };
    }
    function updateCountry(id, fields) {
      const c = state.campaign;
      if (!c.owned.includes(id) || !fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
      const validKeys = ['countryName','capitalName','x','y','resetLocation','seat'];
      if (Object.keys(fields).some(k => !validKeys.includes(k))) return false;
      const changes = {...c.administration[id]};
      const original = capitals.get(id);
      for (const key of ['countryName','capitalName']) {
        if (!Object.hasOwn(fields, key)) continue;
        const raw = fields[key];
        if (typeof raw !== 'string' || /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/u.test(raw)) return false;
        const name = raw.trim().normalize('NFC').replace(/\s+/gu, ' ');
        if ([...name].length > 40) return false;
        const defaultName = key === 'countryName' ? board.NATIONS[id].name : original.name;
        if (!name || name === defaultName) delete changes[key];
        else changes[key] = name;
      }
      for (const flag of ['seat','resetLocation']) {
        if (Object.hasOwn(fields, flag) && typeof fields[flag] !== 'boolean') return false;
      }
      const hasLocation = Object.hasOwn(fields, 'x') || Object.hasOwn(fields, 'y');
      if (hasLocation && (fields.resetLocation || !capitals.containsPoint(id, fields.x, fields.y))) return false;
      if (fields.resetLocation || (hasLocation && fields.x === original.x && fields.y === original.y)) {
        delete changes.x; delete changes.y;
      } else if (hasLocation) {
        changes.x = fields.x; changes.y = fields.y;
      }
      if (Object.keys(changes).length) c.administration[id] = changes;
      else delete c.administration[id];
      if (fields.seat) c.seatId = id;
      save();
      return true;
    }
    function progression() {
      const c = state.campaign;
      const level = levelAt(c.peakHoldings);
      const band = CAMPAIGN_LEVELS[level];
      const next = CAMPAIGN_LEVELS[level + 1];
      // The selected practice track is a floor. Subtraction is a separate operation.
      const world = state.world === 5 ? 5 : Math.max(state.world, band.world);
      return {tier:level + 1, label:band.label, world, bandWorld:band.world, nextAt:next?.at ?? null, nextLabel:next?.label ?? null};
    }
    function campaignLesson() {
      const c = state.campaign, level = progression();
      const tier = level.tier;
      const pairs = tier === 4 ? c.spells % 3 === 0 : tier === 5 ? c.spells % 2 === 0 : tier === 6 && c.spells % 3 !== 2;
      const pair = state.world !== 5 && (pairs || (state.world === SCHOOLWORK && c.spells % 2 === 1));
      return {world:pair ? SCHOOLWORK : level.world, pair, tier};
    }
    function plannedLesson() {
      const run = activeRun();
      if (run?.lessonId) return {lessonId:run.lessonId,difficulty:run.difficulty};
      if (state.campaign.mathMode !== 'curriculum') return null;
      const catalog = lessons();
      return catalog?.campaignPractice?.(state.lessonBook.runs) || null;
    }
    function lessonForRound(round) {
      if (!round) return null;
      const id=registry().topicOf(round)?.id || round.lessonId;
      return id ? {lessonId:id,difficulty:round.difficulty || round.problem?.level || null} : null;
    }
    function classicTopic(world,pair) {
      return {lessonId:pair?'decimal-pairs':registry().forWorld(world).id,difficulty:null};
    }
    function belowCampaignLevel(round) {
      return state.campaign.mathMode==='classic' && !activeRun()?.lessonId && round && !round.lessonId &&
        !round.draft && !round.receipt && round.world<progression().world;
    }
    function battleLessonFor(id) {
      const c=state.campaign, run=activeRun(), place={...context(),nationId:id};
      const here=c.inBattle && c.targetId===id;
      const stored=id==null?null:here?state.round:
        run?.parked[slot(place,run)] || (!run?.lessonId && c.garrisons[id]?.rounds?.[state.world]);
      const resumed=stored && !stored.receipt?.capture && (here || !belowCampaignLevel(stored)) && lessonForRound(stored);
      if (resumed) return resumed;
      const selected=plannedLesson();
      if (selected) return selected;
      const {world,pair}=campaignLesson();
      return classicTopic(world,pair);
    }
    function currentMathLesson() {
      const current=lessonForRound(state.round);
      if (current) return current;
      if (state.campaign.inBattle) return battleLessonFor(state.campaign.targetId);
      const run=activeRun();
      if (run?.lessonId) return {lessonId:run.lessonId,difficulty:run.difficulty};
      if (state.screen==='campaign') return battleLessonFor(state.campaign.targetId);
      const region=state.regions[state.world], count=region.practiceSpells ?? region.stats.count;
      return classicTopic(state.world,state.world===SCHOOLWORK && count%2===1);
    }
    function ownerMap() {
      const c = state.campaign, map = {};
      for (const id of c.owned) map[id] = 'player';
      for (const rival of c.rivals) for (const id of rival.owned) map[id] = rival.id;
      return map;
    }
    function setEmpireName(raw) {
      const c = state.campaign, name = factionName(raw);
      if (!name || c.rivals.some(r => r.name.toLowerCase() === name.toLowerCase())) return false;
      c.empireName = name;
      save();
      return true;
    }
    function addRival(rawName, homeId) {
      const c = state.campaign, name = factionName(rawName);
      if (!name || c.capitalId === null || c.rivals.length >= rivalColors.length || c.winner ||
          !numberIn(homeId, 0, board.NATIONS.length - 1) || ownerMap()[homeId] || homeId === c.targetId ||
          c.rivals.some(r => r.homeId === homeId || r.name.toLowerCase() === name.toLowerCase()) ||
          name.toLowerCase() === c.empireName.toLowerCase()) return false;
      const color = rivalColors.find(value => !c.rivals.some(r => r.color === value));
      c.rivals.push({id:'r' + c.nextRival++, name, color, homeId, owned:[homeId]});
      c.raceGoal ??= Math.min(board.NATIONS.length, Math.max(12, c.owned.length + 5));
      save();
      return true;
    }
    function removeRival(id) {
      const c = state.campaign;
      if (!c.rivals.some(r => r.id === id)) return false;
      c.rivals = c.rivals.filter(r => r.id !== id);
      c.rivalMoves = c.rivalMoves.filter(m => m.rivalId !== id);
      if (!c.rivals.length) { c.raceGoal = null; c.winner = null; }
      else if (c.winner === id) {
        c.winner = null;
        c.raceGoal = Math.min(board.NATIONS.length, Math.max(12, c.owned.length + 5, ...c.rivals.map(r => r.owned.length + 5)));
      }
      save();
      return true;
    }
    function advanceRivals(capturedId) {
      const c = state.campaign;
      c.rivalMoves = [];
      if (!c.rivals.length || c.winner) return;
      if (c.owned.length >= c.raceGoal || c.rivals.every(r => !r.owned.length)) { c.winner = 'player'; return; }
      const owners = ownerMap();
      // Nobody loses their founding country to a CPU or a country they just won
      // this turn. The human can still challenge rival capitals and finish the map.
      const protectedIds = new Set([c.capitalId, capturedId, ...c.rivals.filter(r => r.owned.includes(r.homeId)).map(r => r.homeId)]);
      for (const [index, rival] of c.rivals.entries()) {
        const adjacent = new Set(rival.owned.flatMap(id => board.NATIONS[id].neighbors));
        const targets = [...adjacent].filter(id => owners[id] !== rival.id && !protectedIds.has(id)).sort((a,b) => a-b);
        if (!targets.length) continue;
        const contest = (c.turn + index) % 3 === 0;
        const preferred = targets.filter(id => contest ? owners[id] === 'player' : !owners[id]);
        const choices = preferred.length ? preferred : targets;
        const countryId = choices[(c.turn + rival.homeId + index) % choices.length];
        const from = owners[countryId] ?? null;
        if (from === 'player') {
          c.owned = c.owned.filter(id => id !== countryId);
          if (c.seatId === countryId) c.seatId = c.capitalId;
        } else if (from) {
          const previous = c.rivals.find(r => r.id === from);
          previous.owned = previous.owned.filter(id => id !== countryId);
        }
        rival.owned.push(countryId);
        owners[countryId] = rival.id;
        protectedIds.add(countryId);
        c.rivalMoves.push({rivalId:rival.id, name:rival.name, countryId, from});
        if (rival.owned.length >= c.raceGoal) { c.winner = rival.id; break; }
      }
    }
    function campaignView() {
      const c = state.campaign;
      const defenders = Object.fromEntries(board.NATIONS.filter(n => n.id !== c.capitalId).map(n => [n.id, defenderAt(n.id)]));
      return {
        eraId:state.eraId, board, capitals, campaignMath:c.mathMode,
        mathMode:activeRun()?.lessonId ? 'fixed' : c.mathMode, plannedLesson:plannedLesson(), empireName:c.empireName, peakHoldings:c.peakHoldings, progression:progression(), turn:c.turn,
        rivals:c.rivals.map(r => ({...r, owned:r.owned.slice()})), owners:ownerMap(),
        rivalMoves:c.rivalMoves.map(m => ({...m})), raceGoal:c.raceGoal, winner:c.winner,
        administration: Object.fromEntries(c.owned.map(id => [id, countryProfile(id)])), seatId:c.seatId,
        nations: board.NATIONS, capitalId: c.capitalId ?? board.CAPITAL_ID, needsCapital: c.capitalId === null,
        owned: c.owned.slice(), frontier: frontier(),
        targetId: c.targetId, inBattle: c.inBattle, victory: c.owned.length === board.NATIONS.length,
        claimed: c.owned.length, total: board.NATIONS.length, defenders, defender: defenders[c.targetId] || null
      };
    }
    function chooseCapital(id) {
      const c = state.campaign;
      if (c.capitalId !== null || !numberIn(id, 0, board.NATIONS.length - 1)) return false;
      c.capitalId = id;
      c.seatId = id;
      c.owned = [id];
      c.peakHoldings = 1;
      return setScreen('campaign');
    }
    function setScreen(value) {
      if (value !== 'campaign' && value !== 'battle') return false;
      state.screen = value;
      save();
      return true;
    }
    function parkCurrent() {
      const round = state.round;
      if (!round) return;
      let run = activeRun();
      if (!run && !round.receipt) {
        run = createRun(null,null);
        round.lessonSessionId = run.id;
        run.created++;
      }
      const place = context();
      if (run) {
        run.location = place;
        round.practiceWorld = place.world;
        round.eraId = place.eraId;
        const key = round.recoveryKey || slot(place,run);
        if (round.recoveryKey) run.recoveryKey = round.recoveryKey;
        if (!round.receipt?.capture) run.parked[key] = round;
      } else if (place.nationId === null) {
        state.regions[place.world].parkedRound = round;
      } else {
        const garrison = state.campaign.garrisons[place.nationId];
        if (garrison) garrison.rounds[place.world] = round;
      }
      state.round = null;
    }
    function restoreCurrent(roundId) {
      const place = context(), run = activeRun();
      if (run) {
        const selectedKey = roundId == null ? null : Object.keys(run.parked).find(k => run.parked[k].id === roundId);
        const recovery = run.parked[run.recoveryKey];
        const preferred = place.nationId == null && recovery && (recovery.eraId || 'modern') === place.eraId ? run.recoveryKey : slot(place,run);
        const key = selectedKey ?? preferred;
        state.round = run.parked[key] ?? null;
        delete run.parked[key];
        run.location = place;
      }
      // Saves made before the lesson library stored automatic work under its world or garrison.
      if (!state.round && !run?.lessonId) {
        if (place.nationId === null) {
          const region = state.regions[place.world];
          state.round = region.parkedRound;
          region.parkedRound = null;
        } else {
          const garrison = state.campaign.garrisons[place.nationId];
          state.round = garrison?.rounds[place.world] ?? null;
          if (garrison) delete garrison.rounds[place.world];
        }
      }
    }
    function switchEra(id) {
      const era = eraData(id);
      if (!era || era.id !== id) return false;
      if (id === state.eraId) return true;
      const currentRun = state.lessonBook.activeId;
      const captured = state.round?.receipt?.capture ? state.round : null;
      parkCurrent();
      // The snapshot holds the political game; each lesson holds its own unfinished math.
      state.eraCampaigns[state.eraId] = {campaign:state.campaign, world:state.world, screen:state.screen, runId:currentRun ?? state.lessonBook.activeId, captured};
      const old = state.eraCampaigns[id];
      delete state.eraCampaigns[id];
      state.eraId = id;
      board = era.board;
      capitals = era.capitals;
      state.campaign = old?.campaign || newCampaign(id);
      state.campaign.mathMode ??= 'curriculum';
      state.screen = old?.screen || 'campaign';
      if (old) {
        state.world = old.world;
        state.lessonBook.activeId = old.runId;
        const run = activeRun();
        if (run?.automatic) state.lessonBook.autoId = run.id;
      }
      state.round = old?.captured ?? null;
      if (!state.round) restoreCurrent();
      save();
      return true;
    }
    function invade(id) {
      if (!numberIn(id, 0, board.NATIONS.length - 1) || !frontier().includes(id)) return false;
      const c = state.campaign;
      if (c.inBattle && c.targetId === id) return setScreen('battle');
      parkCurrent();
      c.garrisons[id] ??= { hp: defenderAt(id).maxHp, rounds: {} };
      c.targetId = id;
      c.inBattle = true;
      restoreCurrent();
      if (belowCampaignLevel(state.round)) state.round = null;
      return setScreen('battle');
    }
    function restoreTraining() {
      const c = state.campaign;
      if (!c.inBattle) return;
      parkCurrent();
      if (c.owned.includes(c.targetId)) c.targetId = null;
      c.inBattle = false;
      restoreCurrent();
    }
    function leaveCampaign() {
      restoreTraining();
      return setScreen('campaign');
    }
    function releaseCapture() {
      if (state.round?.receipt?.capture || (state.campaign.inBattle && state.campaign.owned.includes(state.campaign.targetId))) restoreTraining();
    }
    function startLesson(lessonId, difficulty) {
      if (!numberIn(difficulty,1,3) || !lessons()?.has(lessonId)) return false;
      releaseCapture();
      parkCurrent();
      const run = createRun(lessonId, difficulty);
      setScreen('battle');
      return run.id;
    }
    function resumeLesson(id, roundId) {
      const run = findRun(id);
      if (!run) return false;
      if (activeRun()?.id === id && (roundId == null || state.round?.id === roundId)) {
        const unfinished = !state.round && roundId == null && Object.values(run.parked).find(r => !r.receipt);
        return unfinished ? resumeLesson(id,unfinished.id) : setScreen('battle');
      }
      const selected = roundId == null ? null : Object.values(run.parked).find(r => r.id === roundId && !r.receipt);
      if (roundId != null && !selected) return false;
      const target = selected ? {eraId:selected.eraId || 'modern', nationId:selected.nationId, world:selected.practiceWorld ?? run.location.world}
        : {eraId:'modern', ...run.location};
      if (target.eraId !== state.eraId && !switchEra(target.eraId)) return false;
      releaseCapture();
      parkCurrent();
      state.lessonBook.activeId = run.id;
      if (run.automatic) state.lessonBook.autoId = run.id;
      state.world = target.world;
      const c = state.campaign;
      const canFight = target.nationId != null && frontier().includes(target.nationId);
      c.inBattle = canFight;
      if (canFight) {
        c.targetId = target.nationId;
        c.garrisons[c.targetId] ??= {hp:defenderAt(c.targetId).maxHp, rounds:{}};
      } else if (c.targetId != null && c.owned.includes(c.targetId)) c.targetId = null;
      const stranded = !canFight && target.nationId != null ? run.parked[slot(target,run)] : null;
      if (stranded && !stranded.receipt) {
        // Another session may have already captured this target. Retain the
        // unfinished mathematics in practice, without reopening the country.
        delete run.parked[slot(target,run)];
        stranded.recoveryKey = 'retired:' + stranded.id;
        run.recoveryKey = stranded.recoveryKey;
        stranded.nationId = null;
        stranded.campaignTier = null;
        state.round = stranded;
        run.location = context();
      } else restoreCurrent(selected?.id);
      run.lastAt = clock();
      return setScreen('battle');
    }
    function unpinLesson() {
      if (!activeRun()?.lessonId) return;
      releaseCapture();
      parkCurrent();
      state.lessonBook.activeId = state.lessonBook.autoId;
      restoreCurrent();
    }
    function automaticMath() {
      unpinLesson();
      return setScreen('battle');
    }
    function setCampaignMath(value) {
      if (!['curriculum','classic'].includes(value)) return false;
      unpinLesson();
      state.campaign.mathMode = value;
      save();
      return true;
    }
    function view() {
      const c = state.campaign;
      const worldIndex = state.round?.world ?? (c.inBattle ? campaignLesson().world : state.world);
      const region = state.regions[worldIndex];
      const nation = c.inBattle ? board.NATIONS[c.targetId] : null;
      return {
        world: WORLDS[worldIndex], worldIndex, biomeIndex: nation?.biome ?? WORLDS[state.world].biome ?? state.world, nation,
        enemy: nation ? defenderAt(nation.id) : enemyAt(state.world, state.regions[state.world]),
        encounter: (nation ? region : state.regions[state.world]).clears + 1, level: 1 + Math.floor(state.xp / levelCost),
        levelXp: state.xp % levelCost, nextLevelXp: levelCost,
        hero: HEROES.find(h => h.id === state.hero), weapon: WEAPONS.find(w => w.id === state.weapon),
        focus: focusFor(region), mastered: region.recent.filter(r => r.mastered).length
      };
    }
    function startRound(makeProblem) {
      touch();
      if (state.round?.receipt) return state.round;
      const run = ensureRun();
      if (!state.round) {
        const c = state.campaign;
        const lesson = c.inBattle ? campaignLesson() : {world:state.world, tier:0, pair:false};
        const region = state.regions[lesson.world];
        const count = c.inBattle ? region.stats.count : region.practiceSpells ?? region.stats.count;
        const first = count === 0 && !lesson.pair && (!c.inBattle || c.peakHoldings <= 1);
        const pair = lesson.pair || (!c.inBattle && lesson.world === SCHOOLWORK && count % 2 === 1);
        const campaignCarry = c.inBattle && lesson.tier >= 3 && lesson.world <= 4;
        const selected = run.lessonId ? {lessonId:run.lessonId, difficulty:run.difficulty} : c.inBattle ? plannedLesson() : null;
        let problem;
        if (selected) {
          const key = selected.lessonId + ':' + selected.difficulty;
          const issued = state.lessonBook.issued ??= {};
          const index = run.lessonId ? run.created : issued[key] || 0;
          problem = lessons().make(selected.lessonId,selected.difficulty,index);
          if (!run.lessonId) issued[key] = index + 1;
        } else {
          problem = makeProblem(lesson.world, {first, pair, tier:lesson.tier, focus:campaignCarry ? 'regroup' : focusFor(region),
            avoid:c.inBattle ? c.lastProblem : null});
        }
        state.round = {
          id: ++state.serial, world:selected ? (problem.kind === 'lesson' ? state.world : problem.world) : lesson.world,
          mode:state.settings.mode, problem, practiceWorld:state.world, eraId:state.eraId, nationId:c.inBattle ? c.targetId : null,
          campaignTier:!selected && c.inBattle ? lesson.tier : null, draft:null, receipt:null
        };
        if (selected) Object.assign(state.round,selected);
        if (c.inBattle) state.round.campaignMath = run.lessonId ? 'fixed' : selected ? 'curriculum' : 'classic';
        run.created++;
      }
      const timing = roundTiming(state.round);
      if (!state.settings.timer) timing.eligible = false;
      state.round.lessonSessionId = run.id;
      state.round.eraId ??= state.eraId;
      if (run.lessonId) {
        state.round.lessonId = run.lessonId;
        state.round.difficulty = run.difficulty;
      }
      run.location = context();
      run.lastAt = clock();
      save();
      return state.round;
    }
    function finishRound(id, result) {
      const round = state.round;
      if (!round || round.id !== id) return null;
      if (round.receipt) return round.receipt;
      if (!result || !numberIn(result.damage, 10, 35)) return null;
      touch();
      const region = state.regions[round.world];
      const c = state.campaign;
      const combatRegion = state.regions[state.world];
      const decimal = round.problem.kind !== 'lesson';
      const enemy = c.inBattle ? defenderAt(c.targetId) : enemyAt(state.world, combatRegion);
      if (c.inBattle && (!c.garrisons[c.targetId] || round.nationId !== c.targetId)) return null;
      const errors = {};
      for (const k of Object.keys(SKILLS)) {
        const count = result.errors?.[k];
        if (numberIn(count, 1, Number.MAX_SAFE_INTEGER)) errors[k] = count;
      }
      const hints = numberIn(result.hints, 0, 1000) ? result.hints : 0;
      const firstTry = !Object.keys(errors).length;
      const fullyWorked = !!result.fullyWorked;
      const independent = fullyWorked && firstTry && hints === 0 && !!result.independent;
      const entry = {
        at: clock(), world: round.world, mode: round.mode, firstTry, fullyWorked, independent,
        mastered: fullyWorked && firstTry && hints <= 1, hints, errors
      };
      const timing = roundTiming(round);
      stopClock();
      const elapsedMs = Math.floor(timing.elapsedMs);
      const critical = !!(state.settings.timer && timing.eligible && timing.tracked && fullyWorked && timing.elapsedMs <= timing.targetMs);
      const baseDamage = result.damage, bonusDamage = critical ? baseDamage : 0;
      const damage = baseDamage + bonusDamage;
      const afterHp = Math.max(0, enemy.hp - damage);
      const defeated = afterHp === 0;
      const xp = damage + (defeated ? (enemy.kind === 'boss' ? 30 : 10) : 0);
      const coins = (fullyWorked ? 4 : 1) + (defeated ? (enemy.kind === 'boss' ? 12 : 4) : 0);
      const previousLevel = Math.floor(state.xp / levelCost);
      state.xp += xp;
      state.coins += coins;
      const run = findRun(round.lessonSessionId) || ensureRun();
      entry.lessonSessionId = run.id;
      entry.eraId = state.eraId;
      if (round.lessonId) { entry.lessonId = round.lessonId; entry.difficulty = round.difficulty; }
      addStats(state.stats, entry);
      if (decimal) {
        if (!c.inBattle && !round.lessonId) region.practiceSpells = (region.practiceSpells ?? region.stats.count) + 1;
        addStats(region.stats, entry);
        region.recent = [...region.recent, entry].slice(-10);
      }
      state.history = [...state.history, entry].slice(-120);
      state.session.count++;
      let capture = null;
      if (c.inBattle) {
        // A resumed legacy draft counts towards learning and rewards, without
        // consuming the first scheduled puzzle in the new campaign sequence.
        if (round.campaignTier) c.spells++;
        if (!round.lessonId) c.lastProblem = round.problem;
        if (defeated) {
          const nation = board.NATIONS[c.targetId];
          const previous = new Set(frontier());
          const previousTier = levelAt(c.peakHoldings);
          const prior = c.rivals.find(r => r.owned.includes(nation.id));
          if (prior) prior.owned = prior.owned.filter(id => id !== nation.id);
          c.owned.push(nation.id);
          c.turn++;
          c.peakHoldings = Math.max(c.peakHoldings, c.owned.length);
          const previousWinner = c.winner;
          advanceRivals(nation.id);
          delete c.garrisons[nation.id];
          const tier = levelAt(c.peakHoldings);
          capture = { id: nation.id, eraId:state.eraId, name: c.administration[nation.id]?.countryName || nation.name,
            victory: c.owned.length === board.NATIONS.length, opened: frontier().filter(id => !previous.has(id)),
            peakHoldings:c.peakHoldings, newTier:tier > previousTier ? tier + 1 : null, previousOwner:prior?.id ?? null,
            rivalMoves:c.rivalMoves.map(m => ({...m})), winner:previousWinner ? null : c.winner };
          if (decimal && enemy.kind === 'boss') region.bossCleared = true;
        } else c.garrisons[c.targetId].hp = afterHp;
      } else if (defeated) {
        combatRegion.clears++;
        combatRegion.health = null;
        if (decimal && enemy.kind === 'boss') region.bossCleared = true;
      } else combatRegion.health = afterHp;
      const recommended = checkRecommendations(state)[0] ?? null;
      round.receipt = {
        damage, baseDamage, critical, bonusDamage, bonusXp:bonusDamage, elapsedMs, targetMs:timing.targetMs,
        xp, coins, defeated, unlocked:null, recommended, enemy, capture,
        beforeHp: enemy.hp, afterHp, levelUp: Math.floor(state.xp / levelCost) > previousLevel,
        answer: String(result.answer ?? ''), fullyWorked
      };
      if (result.paper) {
        const paperTools = root.DungeonPaper || require('./math-paper.js');
        const paper = paperTools.validPaper(result.paper);
        if (paperTools.hasWork(paper)) round.receipt.paper = {notes:paper.notes,strokes:paper.strokes.map(stroke => stroke.slice())};
      }
      if (fullyWorked && round.problem.kind === 'pair' && Array.isArray(result.pair) && result.pair.length === 2 &&
          result.pair[0] !== result.pair[1] && result.pair.every(i => numberIn(i, 0, 2))) {
        round.receipt.pair = result.pair.slice();
      }
      run.completed++;
      run.lastAt = entry.at;
      run.location = context();
      run.history.push({roundId:round.id, eraId:state.eraId, at:entry.at, problem:round.problem, answer:round.receipt.answer,
        nationId:round.nationId ?? null, world:round.world, mode:round.mode, lessonId:round.lessonId ?? null,
        difficulty:round.difficulty ?? null, campaignMath:round.campaignMath ?? (round.nationId != null ? 'classic' : null), independent, firstTry, hints, errors, fullyWorked, xp, coins, reviewCount:0});
      const record = run.history[run.history.length-1];
      Object.assign(record,{critical,baseDamage,damage,bonusXp:bonusDamage,elapsedMs,targetMs:timing.targetMs});
      if (round.receipt.paper) record.paper = round.receipt.paper;
      if (round.receipt.pair) record.pair = [...round.receipt.pair];
      if (Array.isArray(result.work)) record.work = result.work.map(({prompt,answer}) => ({prompt,answer}));
      round.draft = null;
      save();
      return round.receipt;
    }
    function travel(index) {
      if (!numberIn(index, 0, WORLDS.length - 1)) return false;
      restoreTraining();
      if (index !== state.world) {
        parkCurrent();
        state.world = index;
        restoreCurrent();
      }
      return setScreen('battle');
    }
    function setting(key, value) {
      const valid = (key === 'mode' && modes.includes(value))
        || (['sound','music','timer'].includes(key) && typeof value === 'boolean')
        || (key === 'mastery' && numberIn(value, 1, 10));
      if (!valid) return false;
      if (key === 'timer' && !value && state.round && !state.round.receipt) {
        stopClock();
        roundTiming(state.round).eligible = false;
      }
      state.settings[key] = value;
      if (key === 'mastery') checkRecommendations(state);
      save();
      return true;
    }
    function equip(id) {
      if (HEROES.some(h => h.id === id)) state.hero = id;
      else {
        const item = WEAPONS.find(x => x.id === id);
        if (!item) return false;
        if (!state.owned.includes(id)) {
          if (state.coins < item.cost) return false;
          state.coins -= item.cost;
          state.owned.push(id);
        }
        state.weapon = id;
      }
      save();
      return true;
    }
    return {
      get state() { return state; },
      get storageAvailable() { return available; },
      battleTiming, setBattleActive, checkpointBattle, view, startRound, finishRound, travel, setting, equip, campaignView, battleLessonFor, currentMathLesson, chooseCapital, invade, leaveCampaign, setScreen,
      switchEra, setCampaignMath, lessonView, startLesson, resumeLesson, automaticMath, reviewLessonProblem, saveReviewDraft, finishReview,
      updateCountry, setEmpireName, addRival, removeRival,
      renameCountry(id, name) { return updateCountry(id, {countryName:name}); },
      setCountryCapital(id, changes) {
        if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return false;
        const {name, ...location} = changes;
        if (Object.keys(location).some(k => !['x','y','resetLocation'].includes(k))) return false;
        return updateCountry(id, Object.hasOwn(changes, 'name') ? {...location, capitalName:name} : location);
      },
      setEmpireSeat(id) { return updateCountry(id, {seat:true}); },
      saveDraft(id, draft) {
        if (state.round?.id !== id || state.round.receipt) return false;
        touch();
        state.round.draft = draft;
        const run = findRun(state.round.lessonSessionId);
        if (run) run.lastAt = clock();
        save();
        return true;
      },
      nextRound(makeProblem) {
        if (state.round?.receipt?.capture) return state.round;
        if (state.round?.receipt) {
          const recovered = state.round.recoveryKey;
          state.round = null;
          if (recovered && activeRun()) {
            delete activeRun().recoveryKey;
            restoreCurrent();
          }
        }
        return startRound(makeProblem);
      },
      async setPin(pin) {
        if (state.pin || !/^[0-9]{4,8}$/.test(pin)) return false;
        const salt = root.crypto.getRandomValues(new Uint8Array(16));
        const hash = await pinHash(pin, salt);
        if (state.pin) return false;
        state.pin = { salt: Array.from(salt), hash };
        save();
        return true;
      },
      async verifyPin(pin) {
        if (!state.pin || !/^[0-9]{4,8}$/.test(pin)) return false;
        return state.pin.hash === await pinHash(pin, Uint8Array.from(state.pin.salt));
      },
      reset() {
        const { pin, settings } = state;
        state = fresh(clock());
        board = modernBoard;
        capitals = modernCapitals;
        state.pin = pin;
        state.settings = settings;
        save();
      }
    };
  }

  async function pinHash(pin, salt) {
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await root.crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 90000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  }

  const adventure = { open, battleTargetMs, WORLDS, SCHOOLWORK, MONSTER_ART, HEROES, WEAPONS, SKILLS, PRACTICE };
  root.DungeonAdventure = adventure;
  if (typeof module !== 'undefined' && module.exports) module.exports = adventure;
})(globalThis);
