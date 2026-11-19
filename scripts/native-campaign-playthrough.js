// Exercise the real political map in isolated mainland and island campaigns.
const query = selector => document.querySelector(selector);
const campaign = () => DungeonAdventure.open().campaignView();
const save = () => JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const checkKey = 'native-campaign-check';
const visible = element => element && element.getClientRects().length > 0;
const sorted = items => items.map(String).sort();
const sameIds = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function assert(condition, message) {
  if (!condition) throw Error(message);
}

async function waitFor(check, message) {
  const deadline = performance.now() + 5000;
  while (!check() && performance.now() < deadline) await new Promise(done => setTimeout(done, 30));
  assert(check(), message);
}

function click(element, message) {
  assert(visible(element) && !element.disabled, message);
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function action(name) {
  click(query('[data-action="' + name + '"]'), 'Workbench action unavailable: ' + name);
}

function enter(element, value) {
  assert(visible(element), 'Expected a workbench answer field');
  element.value = String(value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function nationNode(id) {
  return query('#campaign-host [data-territory-id="' + id + '"]');
}

function hasMap() {
  return visible(query('#campaign-host [data-territory-id]'));
}

function checkVisibleBorders(view) {
  const nodes = document.querySelectorAll('#campaign-host [data-territory-id][data-status]');
  const idsFor = status => Array.from(nodes)
    .filter(node => node.dataset.status === status).map(node => node.dataset.territoryId);
  assert(hasMap() && nodes.length === view.nations.length && nodes.length === view.total,
    'Every country in the campaign must have one selectable outline');
  assert(sameIds(idsFor('owned'), view.owned), 'The painted ownership and saved holdings differ');
  assert(sameIds(idsFor('frontier'), view.frontier), 'The playable map border and saved frontier differ');
  assert(idsFor('locked').length + view.frontier.length + view.owned.length === view.total, 'A holding has no map status');
}

function country(code) {
  const nation = campaign().nations.find(n => n.code === code);
  assert(nation, 'Missing real country: ' + code);
  return nation;
}

function ground(nation) {
  const node = nationNode(nation.id);
  assert(node?.dataset.iso3 === nation.code, 'Wrong selectable country outline for ' + nation.name);
  const path = node.querySelector('path.cm-ground');
  assert(visible(path) && path.getTotalLength() > 0, 'Country outline is missing for ' + nation.name);
  assert(path.getAttribute('d').trim() === nation.path.trim(), 'The actual boundaries of ' + nation.name + ' were not rendered');
  return path;
}

function appearance(nation) {
  const style = getComputedStyle(ground(nation));
  return {fill: style.fill, stroke: style.stroke, width: style.strokeWidth, opacity: style.opacity, filter: style.filter};
}

function pickCountry(nation) {
  const picker = query('#campaign-host select[data-pick]');
  if (picker) {
    picker.value = nation.id;
    picker.dispatchEvent(new Event('change', {bubbles: true}));
  } else {
    click(nationNode(nation.id), nation.name + ' is unavailable');
  }
  assert(nationNode(nation.id).getAttribute('aria-pressed') === 'true', 'The country selection did not take effect');
}

async function chooseHome(code) {
  assert(hasMap(), 'A new player should begin on the political map');
  const home = country(code);
  if (campaign().needsCapital) {
    pickCountry(home);
    click(query('#campaign-host [data-home="' + home.id + '"]'), 'The starting country could not be confirmed');
    await waitFor(() => !campaign().needsCapital, 'The selected starting country was not saved');
  }
  const mode = query('#campaign-host [data-campaign-math-mode]');
  assert(visible(mode),'Campaign math selection is missing');
  mode.value = 'classic';
  mode.dispatchEvent(new Event('change',{bubbles:true}));
  const start = campaign();
  assert(start.capitalId === home.id && sameIds(start.owned, [home.id]), 'Wrong starting country: ' + home.name);
  return home;
}

// Sample both countries' displayed vector outlines along their common boundary.
// This also catches a layout that paints named countries in an unrelated grid.
function verifyLandBorder(a, b) {
  assert(a.neighbors.includes(b.id) && b.neighbors.includes(a.id) && !a.seaNeighbors.includes(b.id),
    a.name + ' and ' + b.name + ' must share a land border');
  const first = ground(a), second = ground(b);
  const width = second.ownerSVGElement.viewBox.baseVal.width;
  const step = width / 900;
  assert(Number.isFinite(step) && step > 0, 'World map has no coordinate system');
  const total = second.getTotalLength();
  const contacts = [];
  for (let distance = 0; distance < total; distance += step) {
    const point = second.getPointAtLength(distance);
    const touching = [[0, 0], [step, 0], [-step, 0], [0, step], [0, -step]].some(([dx, dy]) =>
      first.isPointInFill(new DOMPoint(point.x + dx, point.y + dy)));
    if (touching && contacts.every(p => Math.hypot(point.x - p.x, point.y - p.y) > 4 * step)) contacts.push(point);
    if (contacts.length >= 3) return;
  }
  throw Error('The painted boundaries of ' + a.name + ' and ' + b.name + ' do not meet along a border');
}

function verifyCrossing(a, b) {
  assert(a.seaNeighbors.includes(b.id) && b.seaNeighbors.includes(a.id), 'Missing reciprocal game sea link');
  pickCountry(a);
  const route = Array.from(document.querySelectorAll('#campaign-host path[data-sea-route]'))
    .find(node => sameIds([node.dataset.from, node.dataset.to], [a.id, b.id]));
  assert(visible(route) && route.getTotalLength() > 0, 'Missing visible sea route from ' + a.name + ' to ' + b.name);
  const style = getComputedStyle(route);
  assert(style.stroke !== 'none' && style.strokeDasharray !== 'none', 'Sea connections must be visibly marked with a dashed line');
}

async function verifyVictoryFilm() {
  const film = query('#victory-film');
  const video = query('#victory-video');
  const replay = query('#workbench [data-replay-victory]');
  assert(film && video && visible(replay), 'A conquest receipt should offer its victory film');
  async function watchFirstFrames() {
    await waitFor(() => film.open && visible(video) && video.readyState >= 2 && video.videoWidth > 0,
      'The conquest film did not load a playable video image');
    assert(video.currentSrc.startsWith('file:') && /\.mp4(?:$|[?#])/.test(video.currentSrc) &&
      video.duration > 0 && video.duration <= 15, 'The conquest film must be a short bundled video');
    await waitFor(() => video.currentTime > 0.04, 'The conquest film did not play');
    assert(!film.matches(':modal') && visible(query('#workbench .next')) && !query('#workbench .next').disabled,
      'The conquest film should leave the map control available');
    click(query('#skip-victory'), 'Skip victory film control missing');
    await waitFor(() => !film.open, 'Skipping the conquest film did not close it');
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches || film.open) await watchFirstFrames();
  click(replay, 'Conquest receipt did not allow a replay');
  await watchFirstFrames();
}

const renamedCountry = 'Cedar Republic';
const renamedCapital = 'Cedar Landing';

function setField(control, value) {
  assert(control, 'Country editor field missing');
  control.value = value;
  control.dispatchEvent(new Event('input', {bubbles:true}));
  control.dispatchEvent(new Event('change', {bubbles:true}));
}

function verifyEdits(id, originalCapitalId, previous, expected) {
  const view = campaign(), admin = view.administration[id];
  assert(view.capitalId === originalCapitalId && view.seatId === id, 'Moving the seat must retain the original home country');
  assert(admin.countryName === renamedCountry && admin.capitalName === renamedCapital &&
    admin.originalCountryName !== renamedCountry && admin.originalCapitalName !== renamedCapital,
    'Country and capital names did not persist');
  const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.1;
  assert(near(admin.x, expected.x) && near(admin.y, expected.y) && (previous.x !== admin.x || previous.y !== admin.y),
    'The capital site did not move to the selected location');
  const marker = query('#campaign-host [data-capital-marker="' + id + '"]');
  assert(visible(marker) && marker.hasAttribute('data-empire-seat') && near(marker.dataset.x, expected.x) && near(marker.dataset.y, expected.y),
    'The visible capital marker should identify the new seat at the selected location');
  assert(!query('#campaign-host [data-capital-marker="' + originalCapitalId + '"][data-empire-seat]'),
    'The old home should no longer carry the empire seat marker');
  const search = query('#campaign-host [data-search]');
  setField(search, renamedCountry);
  const result = query('#campaign-host [data-match="' + id + '"]');
  assert(visible(result) && result.textContent.includes(renamedCountry), 'The renamed country could not be found through map search');
  click(result, 'Renamed country search result is unavailable');
  assert(query('#campaign-host .cm-dossier')?.textContent.includes(renamedCountry) ||
    query('#campaign-host').innerText.includes(renamedCountry), 'The edited country name is absent from the map');
  const again = query('#campaign-host [data-manage]');
  click(again, 'The owned country lost its editor');
  assert(query('#campaign-host [data-country-name]').value === renamedCountry &&
    query('#campaign-host [data-capital-name]').value === renamedCapital, 'Saved names did not reopen in the editor');
  click(query('#campaign-host [data-admin-cancel]'), 'The editor could not be closed');
}

function editMexico(id) {
  const view = campaign(), before = view.administration[id];
  pickCountry(country('MEX'));
  click(query('#campaign-host [data-manage]'), 'A captured country should expose its optional editor');
  setField(query('#campaign-host [data-country-name]'), renamedCountry);
  setField(query('#campaign-host [data-capital-name]'), renamedCapital);
  const sites = query('#campaign-host [data-capital-site]');
  assert(sites, 'No accessible capital location picker');
  const alternatives = Array.from(sites.options).filter(option => !option.disabled && option.value !== sites.value);
  assert(alternatives.length >= 2, 'Mexico should have alternative capital locations inside its border');
  const chosen = {x:Number(alternatives[1].dataset.x), y:Number(alternatives[1].dataset.y)};
  setField(sites, alternatives[0].value);
  click(query('#campaign-host [data-pick-location]'), 'Direct map placement is unavailable');
  const svg = ground(country('MEX')).ownerSVGElement;
  function clickLocation(position) {
    const point = new DOMPoint(position.x, position.y).matrixTransform(svg.getScreenCTM());
    const event = new MouseEvent('click', {bubbles:true, cancelable:true, clientX:point.x, clientY:point.y});
    // MouseEvent rounds to CSS pixels. Compare against the projected pixel the page actually receives.
    const clicked = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    svg.dispatchEvent(event);
    return {x:clicked.x, y:clicked.y};
  }
  const instructions = query('#campaign-host [data-admin-message]').textContent;
  clickLocation(country('GTM'));
  const feedback = query('#campaign-host [data-admin-message]').textContent;
  assert(feedback && feedback !== instructions, 'An invalid capital point should display a placement correction');
  const selectedPoint = clickLocation(chosen);
  const seat = query('#campaign-host [data-seat]');
  assert(seat && !seat.checked && !seat.disabled, 'A second owned country should be eligible to hold the empire seat');
  seat.click();
  click(query('#campaign-host [data-admin-save]'), 'Country editor cannot save');
  const check = {id, originalCapitalId:view.capitalId, previous:{x:before.x,y:before.y}, expected:selectedPoint};
  verifyEdits(id, view.capitalId, check.previous, check.expected);
  DungeonNativeStorage.setItem('native-custom-map-check', JSON.stringify(check));
}

if (scenario === 'island') {
  const home = await chooseHome('JPN');
  const view = campaign();
  checkVisibleBorders(view);
  assert(view.frontier.length > 0 && view.frontier.every(id => home.seaNeighbors.includes(id)),
    'An island home should expand via its marked sea connections');
  const target = view.nations.find(n => view.frontier.includes(n.id));
  verifyCrossing(home, target);
  pickCountry(target);
  click(query('#campaign-host [data-invade="' + target.id + '"]'), 'The island crossing is not playable');
  await waitFor(() => visible(query('[data-slide]')), 'Crossing from the island did not open a battle');
  assert(campaign().targetId === target.id, 'The sea crossing opened the wrong country');
  return home.name + ' home selection and a marked, playable sea crossing to ' + target.name + ' verified';
}

if (pass === 0) {
  const home = await chooseHome('USA');
  const initial = campaign();
  for (const code of ['USA', 'BRA', 'EGY', 'FRA', 'IND', 'AUS']) ground(country(code));
  checkVisibleBorders(initial);
  const distant = country('IND');
  assert(!initial.frontier.includes(distant.id), 'India should not be an opening U.S. frontier');
  pickCountry(distant);
  const invadeDistant = query('#campaign-host [data-invade="' + distant.id + '"]');
  assert(!visible(invadeDistant) || invadeDistant.disabled, 'A distant country cannot be taken without a route');
  assert(!visible(query('#campaign-host [data-manage]')), 'Unowned countries should not have editing controls');
  const sea = country('CUB');
  verifyCrossing(home, sea);
  const target = country('MEX');
  const beyond = country('GTM');
  verifyLandBorder(home, target);
  verifyLandBorder(target, beyond);
  assert(initial.frontier.includes(target.id) && !initial.frontier.includes(beyond.id),
    'Mexico must border the USA, with Guatemala beyond Mexico');
  const countryBefore = appearance(target), outerBefore = appearance(beyond);
  const empireFill = appearance(home).fill;
  assert(countryBefore.fill !== empireFill, 'The rival and home countries should be visually distinct');
  const boss = country('CAN');
  pickCountry(boss);
  click(query('#campaign-host [data-invade="' + boss.id + '"]'), 'Cannot reach the Canadian guardian');
  await waitFor(() => visible(query('[data-slide]')), 'Boss battle did not open');
  const defender = campaign().defender;
  assert(defender.kind === 'boss' && defender.maxSpells <= 2, 'The campaign boss should need at most two worked spells');
  nativeMath.solveOrdinary(save().round.problem);
  const receipt = save().round.receipt;
  assert(receipt?.fullyWorked && receipt.afterHp === Math.max(0, defender.hp - receipt.damage),
    'The completed place-value work did not reach the boss');
  assert(document.activeElement === query('#workbench .next'), 'A worked boss result should focus the next problem');
  if (!receipt.capture) {
    assert(!query('#victory-film')?.open && !query('#workbench [data-replay-victory]'), 'A partial hit played a conquest film');
    const before = save().round.id;
    nativeMath.pressReturn(document.activeElement);
    assert(save().round.id !== before && !save().round.receipt && campaign().targetId === boss.id,
      'Return after a partial hit should continue the same boss');
  }
  nativeAtlas.openPreview(campaign());
  const beforeMexico = campaign();
  pickCountry(target);
  click(query('#campaign-host [data-invade="' + target.id + '"]'), 'Selected country has no invade control');
  await waitFor(() => visible(query('[data-slide]')), 'Invasion did not open the math workbench');
  nativeAtlas.preview(campaign());
  nativeAtlas.headings(DungeonLessons.identify(save().round.problem).id);
  assert(campaign().defender.maxSpells === 1 && campaign().defender.kind === 'normal', 'One worked spell should capture Mexico');
  DungeonNativeStorage.setItem(checkKey, JSON.stringify({
    id: target.id, targetCode: target.code, nextCode: beyond.code, empireFill, countryBefore, outerBefore,
    hp: campaign().defender.hp, owned: beforeMexico.owned, frontier: beforeMexico.frontier,
    expectedOwned: [...beforeMexico.owned, target.id],
    expectedFrontier: [...new Set([...beforeMexico.frontier, ...target.neighbors])]
      .filter(id => id !== target.id && !beforeMexico.owned.includes(id))
  }));
  return 'Worldwide country outlines, real land and sea borders, and fully worked boss combat verified';
}

const check = JSON.parse(DungeonNativeStorage.getItem(checkKey));
if (pass === 1) {
  // A stored receipt can reopen in battle, or be resumed from the campaign map.
  if (hasMap()) {
    click(nationNode(check.id), 'Saved campaign target disappeared');
    click(query('#campaign-host [data-resume]'), 'Saved expedition cannot be resumed');
  }
  await waitFor(() => visible(query('[data-slide]')), 'The saved Mexico problem did not reopen');
  const view = campaign();
  assert(view.targetId === check.id && view.defender.hp === check.hp && sameIds(view.owned, check.owned),
    'The campaign lost damage or awarded a capture on relaunch');
  nativeAtlas.preview(view);
  let captured = false;
  const maxSpells = 1;
  for (let turn = 0; turn < maxSpells && !captured; turn++) {
    await waitFor(() => visible(query('[data-slide]')), 'Next campaign problem did not start');
    assert(campaign().targetId === check.id, 'The next problem changed the chosen defender');
    nativeMath.solveOrdinary(save().round.problem);
    await waitFor(() => save().round?.receipt, 'The worked spell did not produce a result');
    const receipt = save().round.receipt;
    assert(receipt.damage >= 30, 'Worked spell should earn full alignment, column and estimation power');
    if (receipt.capture) {
      assert(receipt.capture.id === check.id && receipt.afterHp === 0, 'Wrong holding captured');
      captured = true;
    }
  }
  assert(captured, 'Completing enough verified spells did not capture the holding');
  nativeAtlas.preview(campaign());
  await verifyVictoryFilm();
  click(query('#workbench [data-conquest-map]'), 'Return to campaign map unavailable after capture');
  await waitFor(hasMap, 'Map did not reopen after the capture');
} else {
  assert((pass === 2 || pass === 3) && hasMap(), 'Relaunch should restore the campaign map after a capture');
}

const expanded = campaign();
assert(sameIds(expanded.owned, check.expectedOwned), 'Previously owned and captured holdings should both be retained');
assert(sameIds(expanded.frontier, check.expectedFrontier), 'The new border should include the captured holding’s exposed neighbors');
assert(expanded.frontier.some(id => !check.frontier.includes(id)), 'The move should open a new attack option');
checkVisibleBorders(expanded);
const target = country(check.targetCode), beyond = country(check.nextCode);
const ownedPaint = appearance(target);
assert(ownedPaint.fill === check.empireFill && ownedPaint.fill !== check.countryBefore.fill,
  target.name + ' must repaint in the home empire’s color');
assert(expanded.frontier.includes(beyond.id) && nationNode(beyond.id).dataset.status === 'frontier',
  beyond.name + ' should become a visibly playable frontier');
assert(JSON.stringify(appearance(beyond)) !== JSON.stringify(check.outerBefore),
  beyond.name + ' should change its rendered fill or outline when the border opens');
// Center the captured country using the same picker a player uses. The visual
// QA snapshots can now compare the same border following a fresh process start.
pickCountry(target);
if (pass === 2) {
  editMexico(check.id);
  return 'Country and capital renamed, capital relocated, new seat marked and country searchable';
}
if (pass === 3) {
  const edits = JSON.parse(DungeonNativeStorage.getItem('native-custom-map-check'));
  verifyEdits(edits.id, edits.originalCapitalId, edits.previous, edits.expected);
  return 'Relaunch preserved country and capital names, relocated capital, seat and expanded border';
}
return 'Captured Mexico, played and replayed its bundled conquest film, and verified the new Guatemalan frontier';
