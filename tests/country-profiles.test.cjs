'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const profiles=require('../web/country-profiles.js');
const board=require('../web/campaign-data.js');
const capitals=require('../web/capitals.js');

test('the modern geography and statistics cover the playable sovereign roster without global aggregates',()=>{
  const counts={population:0,gdp:0,area:0,armedForces:0};
  assert.equal(board.NATIONS.length,195);
  for (const n of board.NATIONS) {
    const p=profiles.get(n.code);
    assert.equal(p.code,n.code);
    assert.equal(p.name,n.name);
    assert.equal(p.capital,capitals.get(n.id).name);
    assert.ok(p.region && p.subregion,p.code);
    assert.equal(p.links.geography,'https://data.un.org/legacy/en/iso/'+n.iso2.toLowerCase()+'.html');
    for (const metric of Object.keys(counts)) {
      const observation=p[metric];
      assert.notEqual(observation,undefined,'Missing field '+metric+' for '+p.code);
      if (observation===null) continue;
      assert.ok(Number.isFinite(observation.value) && observation.value>=0,n.code+' '+metric);
      assert.ok(Number.isInteger(observation.year) && observation.year>=1960 && observation.year<=2026);
      counts[metric]++;
    }
  }
  assert.deepEqual(counts,{population:195,gdp:194,area:195,armedForces:174});
  for (const code of ['WLD','HIC','ABW','toString',null]) assert.equal(profiles.get(code),null);
  assert.equal(profiles.get('mex').intermediateRegion,'Central America');
  assert.ok(profiles.get('PSE').capitalNote.includes('administrative seat'));
});

test('observations retain their own years and distinguish a historical zero from a reporting gap',()=>{
  const us=profiles.get('USA');
  assert.deepEqual(us.population,{value:341784857,year:2025});
  assert.deepEqual(us.gdp,{value:30769700000000,year:2025});
  assert.deepEqual(us.armedForces,{value:1395000,year:2020});
  assert.deepEqual(us.area,{value:9831510,year:2024});
  assert.deepEqual(profiles.get('STP').armedForces,{value:1000,year:1999});
  assert.deepEqual(profiles.get('ISL').armedForces,{value:0,year:2020});
  assert.equal(profiles.get('AND').armedForces,null);
  assert.equal(profiles.get('ERI').gdp.year,2011);
  assert.match(profiles.indicators.armedForces.definition,/paramilitary/i);
  assert.match(profiles.indicators.armedForces.contributors,/International Institute for Strategic Studies/);
  for (const indicator of Object.values(profiles.indicators)) {
    assert.equal(indicator.updated,'2026-11-11');
    assert.ok(indicator.url.endsWith(indicator.code));
    assert.match(indicator.downloadUrl,/downloadformat=csv/);
  }
});

test('supplemental country facts identify the actual source and reference date',()=>{
  const vatican=profiles.get('VAT'),northKorea=profiles.get('PRK');
  assert.equal(vatican.population.value,882);
  assert.equal(vatican.population.year,2024);
  assert.equal(new URL(vatican.population.url).hostname,'www.vaticanstate.va');
  assert.equal(vatican.area.value,.44);
  assert.equal(vatican.area.year,2025);
  assert.equal(new URL(vatican.area.url).hostname,'unfccc.int');
  assert.equal(vatican.gdp,null);
  assert.equal(vatican.armedForces,null);
  assert.equal(vatican.links.worldBank,null);
  assert.equal(northKorea.gdp.value,16447000000);
  assert.equal(northKorea.gdp.year,2023);
  assert.equal(northKorea.gdp.url,northKorea.links.geography);
  assert.match(northKorea.gdp.source,/United Nations/);
});

test('the original offline source archives reproduce the distributed profile data exactly',()=>{
  execFileSync('python3',['scripts/build-country-profiles.py','--check'],{cwd:path.resolve(__dirname,'..')});
});
