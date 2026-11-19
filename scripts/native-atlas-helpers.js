// Assertions shared by the native map and lesson playthroughs. Each view uses an isolated save.
const nativeAtlas = (() => {
  const q = selector => document.querySelector(selector);
  const text = selector => q(selector)?.textContent.trim();
  const expect = (condition,message) => { if (!condition) throw Error(message); };
  const currentView = () => DungeonAdventure.open().campaignView();
  const state = () => JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
  const click = selector => {
    const button = q(selector);
    expect(button?.getClientRects().length && !button.disabled, 'Missing visible control ' + selector);
    button.click();
  };
  const close = () => click('dialog[open] .dp-close');
  function preview(view = currentView()) {
    const button = q('#empire-preview');
    const container = q('#campaign-miniature');
    const svg = container?.querySelector('svg');
    expect(button?.getClientRects().length && button.contains(container) && container.querySelectorAll('svg').length === 1,
      'The battle sidebar must contain one visible campaign preview');
    expect(svg.dataset.previewEra === view.eraId && svg.getAttribute('viewBox') === '0 0 1000 540' &&
      svg.getAttribute('aria-hidden') === 'true' && !svg.querySelector('a,button,[role=button],[tabindex]'),
      'The decorative country geography must use its active era and leave navigation to its parent button');
    expect(text('#preview-era') === DungeonEras.get(view.eraId).title,'The preview caption shows the wrong era');
    const counts = text('#world-count').match(/\d+/g)?.map(Number);
    expect(counts?.length === 2 && counts[0] === view.owned.length && counts[1] === view.nations.length,
      'The sidebar holding count does not match the active campaign');
    const shapes = new Map([...svg.querySelectorAll('path[data-preview-country]')].map(el => [el.dataset.previewCountry,el]));
    expect(shapes.size === view.nations.length, 'Missing political boundaries in the preview of ' + view.eraId);
    for (const country of view.nations) {
      const shape = shapes.get(country.code);
      expect(shape && shape.getAttribute('d') === country.path && shape.getAttribute('fill') &&
        shape.dataset.owner === (view.owners[country.id] || 'neutral'),
        'Stale geography, missing color or wrong ownership for ' + country.name + ' in ' + view.eraId);
    }
    const seat = view.needsCapital ? null : view.nations[view.seatId];
    const target = view.frontier.includes(view.targetId) ? view.nations[view.targetId] : null;
    for (const [key,expected] of [['seat',seat],['target',target]]) {
      const attr = 'data-preview-' + key, markers = svg.querySelectorAll('[' + attr + ']');
      expect(markers.length === (expected ? 1 : 0) && (!expected || markers[0].getAttribute(attr) === expected.code),
        'The preview ' + key + ' differs from the current ' + view.eraId + ' empire');
    }
    return shapes;
  }
  function openPreview(view = currentView()) {
    const shapes = preview(view);
    click('#empire-preview');
    const map = q('#campaign-host .cm-map');
    expect(map?.getClientRects().length && q('[data-campaign-era]').value === view.eraId,
      'The sidebar button must open the playable era it depicts');
    const countries = map.querySelectorAll('[data-iso3]');
    expect(countries.length === shapes.size, 'Main and preview maps contain different country sets');
    for (const country of countries) {
      const mini = shapes.get(country.dataset.iso3), ground = country.querySelector('.cm-ground');
      expect(mini && mini.getAttribute('d') === ground?.getAttribute('d') &&
        mini.getAttribute('fill') === ground.getAttribute('fill') && mini.dataset.owner === country.dataset.owner,
        'Preview and full map disagree on the shape, paint or owner of ' + country.dataset.iso3);
    }
  }
  function dossierTitle() {
    const title = text('#campaign-host [data-campaign-math] strong')?.split(' · ')[0];
    expect(title && DungeonLessons.list.some(lesson => lesson.title === title),
      'A selected country must preview an identifiable math topic');
    return title;
  }
  function checkDossier(promised) {
    expect(text('#lesson-title') === promised,'The country promised ' + promised + ' but gave ' + text('#lesson-title'));
  }
  function headings(id,view = currentView()) {
    const round = state().round, lesson = DungeonLessons.get(id);
    expect(lesson && text('#lesson-title') === lesson.title, 'The battle lesson header should say ' + (lesson?.title || id));
    const nation = round.nationId == null ? null : view.nations[round.nationId];
    const name = nation ? (view.administration[nation.id]?.countryName || nation.name) : lesson.title;
    expect(text('#world-title') === name, 'Expected the main battle heading to say ' + name);
    if (nation && view.eraId !== 'modern') {
      const date = DungeonEras.get(view.eraId).date, heading = text('#world-number');
      expect(heading.includes(date), 'Historical battle heading for ' + view.eraId + ' should include ' + date +
        ', displayed “' + heading + '” in round ' + round.id + ' (' + (round.receipt ? 'receipt' : 'live') + ')');
    }
    expect(q('#workbench')?.getAttribute('aria-label') === 'Math workbench','The workbench needs an accurate accessible name');
    return lesson.title;
  }
  function panels(id) {
    const title = headings(id), round = state().round;
    click('[data-panel=map]');
    expect(text('dialog[open] .ll-current h3') === title,'The lesson library lost the actual exercise ' + title);
    for (const lesson of DungeonLessons.list) {
      const card = q('dialog[open] [data-lesson-id="' + lesson.id + '"]');
      expect(card?.querySelector('h4')?.textContent === lesson.title &&
        card.querySelector('[data-lesson-practice]')?.textContent.trim() === 'Practice ' + lesson.title,
        'The library should identify ' + lesson.id + ' by its math title');
    }
    close();
    click('[data-panel=tutorial]');
    expect(text('dialog[open] .ll-intro h3') === title,'The tutorial opens on another skill instead of ' + title);
    close();
    click('[data-panel=sessions]');
    expect(text('dialog[open] [data-session-id="' + round.lessonSessionId + '"] h3') === title,
      'The session card gives the wrong name for ' + title);
    click('dialog[open] [data-view-session="' + round.lessonSessionId + '"]');
    expect(text('dialog[open] .ll-intro h3') === title,'The session details do not match the actual exercise');
    const pending = q('dialog[open] [data-resume-problem="' + round.id + '"]');
    expect(pending?.parentElement.textContent.includes(title),'The unfinished problem omitted its actual lesson');
    close();
    expect(state().round.id === round.id,'Inspecting academic labels switched the active exercise');
  }
  function report(id) {
    const title = DungeonLessons.get(id).title;
    expect(text('dialog[open] #dp-title') === 'Parent progress report' && text('dialog[open] .dp-world-name')?.split(' · ')[0] === title,
      'The parent progress report must identify the active exercise as ' + title);
  }
  async function openReport(id) {
    click('[data-panel=parent]');
    const fields = [...document.querySelectorAll('dialog[open] input[type=password]')];
    expect(fields.length > 0,'The parent report must be PIN-protected');
    fields.forEach(field => { field.value = '3141'; });
    q('dialog[open] form').requestSubmit();
    const deadline = performance.now() + 4500;
    while (!q('dialog[open] .dp-world-name') && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve,20));
    report(id);
    close();
  }
  return {preview,openPreview,dossierTitle,checkDossier,headings,panels,report,openReport};
})();
