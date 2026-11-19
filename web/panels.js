/* Local menus for the adventure. All artwork is drawn from bundled pixel patterns. */
(function (root) {
  'use strict';
  const A = root.DungeonAdventure;
  const patterns = {
    leaf: ['     ddd', '   ddggd', '  dggggd', ' dgllggd', 'dgllggd ', 'dgggdd  ', ' ddd    ', ' d      '],
    gem: ['   dd   ', '  dllD  ', ' dlgggD ', 'dlgggggD', 'DllllggD', ' DglggD ', '  DggD  ', '   DD   '],
    arch: ['  ddddd ', ' dllllld', 'dlgggggd', 'dggd dgD', 'dggd dgD', 'dglD dlD', 'dggD dgD', 'DDDD DDD'],
    tower: ['dd dd dd', 'dlldglld', ' dllllD ', ' dgDDgD ', ' dgD gD ', ' dggglD ', ' dgDDgD ', 'DggDDggD'],
    flame: ['    d   ', '   dgd  ', '  ddlgd ', ' dgglgd ', 'dglgllgd', 'dgglllgg', ' dggllgD', '  DDDD  '],
    moon: ['   dd   ', '  dld   ', ' dlld   ', 'dlggd   ', 'dlgggd  ', 'dlggggdd', ' DgggggD', '  DDDDD '],
    wand: ['     dd ', '    dllD', '    DggD', '   ddDD ', '  dgd   ', ' dgd    ', 'dgd     ', 'DD      '],
    staff: ['    dd  ', '   dllD ', '   DggD ', '    dgD ', '   dgD  ', '  dgD   ', ' dgD    ', ' DD     '],
    blade: ['      dd', '     dlg', '    dlgD', '   dlgD ', '  dlgD  ', 'dDggD   ', ' dgDD   ', 'DD  D   '],
    crystal: ['    dd  ', '   dllD ', '  dlgggD', '   DggD ', '   dlD  ', '  dgD   ', ' dgD    ', ' DD     '],
    map: ['dD dd Dd','dldgldgd','dldgldgd','dgdgldld','dgdgldld','dldgldgd','dD dd DD'],
    bag: ['  dddd  ', '  dggd  ', '  dllD  ', ' dggggD ', 'dggllggD', 'dggllggD', 'dggggggD', ' DDDDDD '],
    book: [' dddd dd','dlggldld','dgllldld','dggggdld','dgllldld','dggggdld',' ddddDDd'],
    gear: ['   dd   ',' dDggDd ',' DggggD ','dggDDggd','dggDDggd',' DggggD ',' dDggDd ','   DD   '],
    lock: ['  dddd  ', ' dl  ld ', ' dg  gd ', 'dlllllld', 'dggddggD', 'dgDDgggD', 'dggggggD', ' DDDDDD '],
  };
  const colors = ['#78c594', '#a58add', '#c89b66', '#b8c3d2', '#ef9465', '#827fce'];
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function pixel(id, color) {
    const pattern = patterns[id] || patterns.gem;
    const c = el('canvas', 'dp-icon');
    c.width = 8;
    c.height = 8;
    c.setAttribute('aria-hidden', 'true');
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const palette = { d: '#4a5262', D: '#354354', g: color || '#85d4b8', l: '#ffdda0' };
    pattern.forEach((row, y) => [...row].forEach((p, x) => {
      if (palette[p]) { ctx.fillStyle = palette[p]; ctx.fillRect(x, y, 1, 1); }
    }));
    return c;
  }
  function button(text, fn, cls = 'dp-button') {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function inputLabel(text, control) {
    const label = el('label', 'dp-field');
    label.append(el('span', '', text), control);
    return label;
  }
  function select(options, value) {
    const s = el('select');
    options.forEach(([id, label]) => {
      const o = el('option', '', label);
      o.value = id;
      s.append(o);
    });
    s.value = value;
    return s;
  }
  function description(text) { return el('p', 'dp-description', text); }

  let current = null;
  function open(name, game, handlers = {}) {
    const names = {
      map: ['Lesson library', 'book'], lessons: ['Lesson library', 'book'], sessions: ['Practice sessions', 'book'],
      progress: ['Learning progress', 'book'], tutorial: ['Lesson tutorial', 'book'], inventory: ['Inventory', 'bag'], parent: ['Parent progress report', 'book'],
      settings: ['Game settings', 'gear'], help: ['How to play', 'book']
    };
    if (!names[name]) return;
    if (current?.open) current.close();
    const modal = el('dialog', 'dp-dialog');
    current = modal;
    const title = el('h2', '', names[name][0]);
    title.id = 'dp-title';
    modal.setAttribute('aria-labelledby', title.id);
    const header = el('div', 'dp-header');
    const closeButton = button('×', () => modal.close(), 'dp-close');
    closeButton.setAttribute('aria-label', 'Close ' + names[name][0]);
    header.append(pixel(names[name][1], '#79cdb1'), title, closeButton);
    const body = el('div', 'dp-body');
    modal.append(header, body);
    document.body.append(modal);
    const opener = document.activeElement;
    let authenticated = false;
    let confirmation = false;
    const change = () => handlers.onChange?.();
    function travel(index, override) {
      if (game.travel(index, override)) {
        modal.close();
        handlers.onTravel?.(index);
      }
    }
    const library = ['map','lessons','sessions','tutorial','progress'].includes(name);
    let libraryView;
    if (library) modal.classList.add('ll-dialog');
    function inventory() {
      const balance = el('p', 'dp-balance', game.state.coins + ' coins');
      body.append(balance, el('h3', '', 'Choose your hero'));
      const heroes = el('div', 'dp-heroes');
      A.HEROES.forEach(hero => {
        const selected = game.state.hero === hero.id;
        const b = button('', () => {
          game.equip(hero.id); change(); render(); focusItem(hero.id);
        }, 'dp-hero');
        b.dataset.item = hero.id;
        b.setAttribute('aria-pressed', String(selected));
        const portrait = el('img', 'dp-portrait');
        portrait.src = 'assets/' + hero.id + '.png';
        portrait.alt = '';
        b.append(portrait, el('strong', '', hero.name), el('span', 'dp-note', hero.role));
        heroes.append(b);
      });
      body.append(heroes, el('h3', '', 'Equipment'), description('Spend battle coins to change how your hero looks.'));
      const list = el('div', 'dp-list');
      A.WEAPONS.forEach(item => {
        const owned = game.state.owned.includes(item.id);
        const active = game.state.weapon === item.id;
        const b = button('', () => {
          if (game.equip(item.id)) { change(); render(); focusItem(item.id); }
        }, 'dp-route');
        b.dataset.item = item.id;
        b.setAttribute('aria-pressed', String(active));
        b.disabled = !owned && game.state.coins < item.cost;
        const art = el('span', 'dp-art');
        art.append(pixel(item.id, item.color));
        const text = active ? 'Equipped' : owned ? 'Equip' : item.cost + ' coins';
        b.append(art, el('strong', 'dp-main', item.name), el('span', 'dp-status', text));
        list.append(b);
      });
      body.append(list);
    }
    function focusItem(id) { body.querySelector('[data-item="' + id + '"]')?.focus(); }
    function settings() {
      const s = game.state.settings;
      const mode = select([['guided', 'Guided'], ['standard', 'Standard'], ['challenge', 'Challenge']], s.mode);
      const notes = {
        guided: 'Guided mode walks you through each step.',
        standard: 'Standard mode lets you work with place-value labels and optional hints.',
        challenge: 'Challenge mode gives you fewer prompts while you work.'
      };
      const note = description(notes[s.mode]);
      mode.addEventListener('change', () => {
        game.setting('mode', mode.value);
        note.textContent = notes[mode.value];
        change();
      });
      const controls=[['sound','Battle sound effects'],['music','Background music'],['timer','Quick-solve timer and critical hits']].map(([key,label])=>{
        const input=el('input');input.type='checkbox';input.checked=!!s[key];input.dataset.setting=key;
        input.addEventListener('change',()=>{game.setting(key,input.checked);change();});
        const row=el('label','dp-toggle');row.append(el('span','',label),input);return row;
      });
      body.append(inputLabel('Practice mode for the next problem', mode), note, ...controls,
        description('A fully worked problem completed within the time limit deals double damage. Turn the timer on before starting a new problem to earn a timed bonus. You can always take longer for the usual reward.'));
    }
    function help() {
      body.append(el('h3', '', 'Grow your empire'), description('Pick a real country as your home. Choose a country across your border or along a marked game sea route, then challenge its fantasy guardian. When its health reaches zero, the country flies your flag and opens new routes for your empire.'),
        description('One correct answer captures a regular or elite guardian. Bosses take up to two. Press Return on the result to continue to the next problem, or choose See your empire to pick your own target.'),
        description('Choose Manage empires to give another empire a name and a home country. You can play it yourself or let the computer move it. Use Playing as on the map to switch between the empires you control.'),
        el('h3', '', 'Choose your lesson'), description('Open Lessons to choose a topic and difficulty. Each tutorial includes a worked example. Use Sessions to continue a saved problem or practice one again.'),
        el('h3','','Work it out'),description('Choose Math paper to draw with a mouse or trackpad, or type your calculations. In fraction addition and subtraction, use the fraction workmat to round the amounts and build matching pieces.'),
        el('h3', '', 'Decimal addition and subtraction'), description('Line up the decimal points and work one column at a time.'));
      const list = el('ol', 'dp-help');
      [
        ['Line up the dots', 'Move each lower number until its decimal point sits directly under the top decimal point.'],
        ['Fill in the gaps', 'If one number ends early, fill its empty decimal places with zeros. Its value stays the same.'],
        ['Work right to left', 'Solve each column. Record a carry or borrow whenever you need one.'],
        ['Check your estimate', 'Enter the answer, then check it by rounding each number to a whole number.']
      ].forEach(([heading, copy]) => {
        const li = el('li'); li.append(el('strong', '', heading), description(copy)); list.append(li);
      });
      body.append(list, description('When a problem asks you to choose a pair, pick two numbers to add first. Align them, fill the empty decimal places, and work each column from right to left. Write your subtotal. Then use the same steps to add the third number and check your total.'), description('A mistake gives you another try. Hints are there to help, and you can take as long as you like.'),
        button('Back to the adventure', () => modal.close(), 'dp-button dp-primary'));
      const geography = el('details', 'dp-skills');
      geography.append(el('summary', '', 'About the world map'),
        description('The map uses country outlines from Natural Earth. The campaign includes the 193 United Nations member states, the Holy See (Vatican City), and the State of Palestine. Other land appears as map context.'),
        description('Dashed sea routes connect countries for gameplay. Each country’s guardian and battlefield belong to the fantasy game.'));
      body.append(geography);
    }
    function parentGate() {
      const hasPin = !!game.state.pin;
      body.append(description(hasPin ? 'Enter your local parent PIN to see learning progress and practice settings.'
        : 'Create a PIN for this Mac to keep progress reports and learning settings in the parent progress report.'));
      const form = el('form', 'dp-form');
      const pinBox = () => {
        const field = el('input');
        field.type = 'password'; field.inputMode = 'numeric'; field.pattern = '[0-9]{4,8}';
        field.minLength = 4; field.maxLength = 8; field.required = true;
        field.autocomplete = hasPin ? 'current-password' : 'new-password';
        return field;
      };
      const pin = pinBox();
      let confirm;
      form.append(inputLabel(hasPin ? 'Parent PIN' : 'Choose a PIN (4–8 digits)', pin));
      if (!hasPin) { confirm = pinBox(); form.append(inputLabel('Repeat PIN', confirm)); }
      const status = el('p', 'dp-error'); status.setAttribute('role', 'status');
      const submit = el('button', 'dp-button dp-primary', hasPin ? 'Open report' : 'Create PIN');
      submit.type = 'submit';
      form.append(status, submit);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (submit.disabled) return;
        if (!hasPin && pin.value !== confirm.value) {
          status.textContent = 'Those PINs differ. Try entering them again.'; confirm.focus(); return;
        }
        submit.disabled = true;
        try {
          authenticated = hasPin ? await game.verifyPin(pin.value) : await game.setPin(pin.value);
          if (authenticated && modal.open) {
            render(); title.tabIndex = -1; title.focus();
          } else {
            status.textContent = 'That PIN did not match. Try again.'; pin.select(); pin.focus();
          }
        } catch {
          status.textContent = 'This device could not verify a PIN. Close the report and reopen it in the Mac app.';
        } finally { submit.disabled = false; }
      });
      body.append(form);
    }
    function parent() {
      if (!authenticated) return parentGate();
      const s = game.state;
      const v = game.view();
      const stats = el('div', 'dp-stats');
      const accuracy = s.stats.count ? Math.round(100 * s.stats.firstTry / s.stats.count) + '%' : '—';
      [[s.stats.count, 'Solved'], [accuracy, 'First try'], [s.stats.independent, 'Independent'], [s.stats.hints, 'Hints used']].forEach(([value, label]) => {
        const stat = el('div', 'dp-stat'); stat.append(el('strong', '', value), el('span', '', label)); stats.append(stat);
      });
      const book = game.lessonView(), active = book.active;
      const current = game.currentMathLesson(), lesson = root.DungeonLessons.get(current?.lessonId);
      const level = root.DungeonLessons.levels[current?.difficulty-1];
      body.append(stats, el('h3', '', 'Current practice'),
        el('p', 'dp-world-name', [lesson?.title || 'Math practice',level].filter(Boolean).join(' · ')));
      const tracker=root.DungeonLessons.tracker(book.sessions);
      if (level && lesson) {
        const learned=tracker.lessons.find(record=>record.lessonId===lesson.id);
        body.append(description(learned.mastered?'Lesson mastered. '+learned.extraPractice+' extra practice problems completed.':
          Math.min(learned.qualifying,tracker.target)+' of '+tracker.target+' independent Core or Challenge problems toward mastery.'));
        if (active) body.append(description(active.completed+' completed in this practice session.'));
      } else {
        const meter = el('progress'); meter.max = 10; meter.value = v.mastered;
        meter.setAttribute('aria-label', 'First-try decimal problems with at most one hint');
        const recent = s.regions[v.worldIndex].recent.length;
        body.append(meter, description(recent ? v.mastered+' of the last '+recent+' problems in this decimal practice topic were solved on the first try with at most one hint.' :
          'Solve a decimal problem to start this practice record.'));
        if (v.focus) body.append(el('h4', '', 'Suggested practice'), description(A.PRACTICE[v.focus]));
      }
      const practiced=tracker.lessons.filter(record=>record.completed);
      if (practiced.length) {
        const details = el('details', 'dp-skills');
        details.append(el('summary', '', 'Practice by lesson'));
        const dl = el('dl', 'dp-data');
        for (const record of practiced) {
          dl.append(el('dt','',root.DungeonLessons.get(record.lessonId).title),
            el('dd','',record.independent+' of '+record.completed+' independent'));
        }
        details.append(dl);body.append(details);
      }
      if (book.legacyCount) {
        const earlier=el('details','dp-skills');
        earlier.append(el('summary','','Decimal practice by topic'),description('These totals include work saved before individual problems were recorded.'));
        const dl=el('dl','dp-data');
        s.regions.forEach((r,i)=>{
          if(r.stats.count)dl.append(el('dt','',i===A.SCHOOLWORK?'Three-decimal addition (both methods)':root.DungeonLessons.forWorld(i).title),
            el('dd','',r.stats.count+' solved'));
        });
        earlier.append(dl);body.append(earlier);
      }
      const errorGroups = Object.entries(s.stats.errors).sort((a, b) => b[1] - a[1]);
      if (errorGroups.length) {
        body.append(el('h3', '', 'Steps to revisit'));
        const dl = el('dl', 'dp-data');
        errorGroups.forEach(([key, n]) => dl.append(el('dt', '', A.SKILLS[key]), el('dd', '', n + (n === 1 ? ' retry' : ' retries'))));
        body.append(dl);
      }
      const sessions = [...s.sessions, s.session].filter(x => x.count).slice(-5).reverse();
      if (sessions.length) {
        body.append(el('h3', '', 'Recent sessions'));
        const dl = el('dl', 'dp-data');
        sessions.forEach(session => {
          const date = new Date(session.start);
          const when = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
            date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          dl.append(el('dt', '', when), el('dd', '', session.count + (session.count === 1 ? ' problem' : ' problems')));
        });
        body.append(dl);
      }
      body.append(el('h3', '', 'Learning settings'));
      const threshold = select(Array.from({ length: 10 }, (_, i) => [i + 1, (i + 1) + ' of 10']), s.settings.mastery);
      threshold.addEventListener('change', () => { game.setting('mastery', Number(threshold.value)); change(); render(); });
      const practice = select(A.WORLDS.map((_,i)=>[i,i===A.SCHOOLWORK?'Add three decimals (columns or pairs)':root.DungeonLessons.forWorld(i).title]), s.world);
      body.append(inputLabel('Mastery target for a decimal practice recommendation', threshold),
        inputLabel('Choose a decimal practice topic', practice), description('These topics use automatic decimal practice. To choose a particular lesson and level, open Lessons.'),
        button('Start selected practice', () => travel(Number(practice.value), true)));
      if (!confirmation) {
        body.append(button('Reset adventure…', () => { confirmation = true; render(); body.lastElementChild?.scrollIntoView({ block: 'nearest' }); }, 'dp-text dp-reset'));
      } else {
        const group = el('div', 'dp-danger');
        group.append(el('strong', '', 'Erase this adventure?'), description('This clears your empire, battles, coins, equipment, and learning history on this Mac. You can pick a new home country. Your PIN and settings are kept.'));
        const actions = el('div', 'dp-actions');
        actions.append(button('Keep adventure', () => { confirmation = false; render(); }),
          button('Erase progress', () => { game.reset(); modal.close(); handlers.onReset?.(); }, 'dp-button dp-remove'));
        group.append(actions); body.append(group);
      }
    }
    function render() {
      body.replaceChildren();
      if (library) {
        libraryView = root.DungeonLessonLibrary.mount(body, name, game, {
          setTitle(text) { title.textContent = text; closeButton.setAttribute('aria-label', 'Close ' + text); },
          close() { modal.close(); },
          play(reason) { modal.close(); handlers.onTravel?.(reason); }
        });
      } else ({ inventory, settings, help, parent })[name]();
    }
    modal.addEventListener('close', () => {
      libraryView?.destroy();
      modal.remove();
      if (current === modal) current = null;
      if (!current && opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
      handlers.onClose?.();
    }, { once: true });
    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const r = modal.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close();
    });
    render();
    modal.showModal();
    const first = name === 'parent' ? modal.querySelector('input') : closeButton;
    first?.focus({ preventScroll: true });
    return modal;
  }

  root.DungeonPanels = { open };
})(globalThis);
