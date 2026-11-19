const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {byEra,sources} = require('../web/historical-country-facts.js');
const atlas = require('../web/historical-atlas.js');

test('each dated map has a self-contained fact record for every historical playable state', () => {
  for (const [era, snapshot] of Object.entries(atlas)) {
    const records=byEra[era];
    assert.deepEqual(Object.keys(records).sort(),snapshot.nations.map(n=>n.code).sort());
    for(const record of Object.values(records)){
      assert.equal(record.year,Number(snapshot.date.slice(0,4)));
      assert.ok(record.scope);
      for(const key of ['population','militaryPersonnel','gdp']){
        assert.ok(record[key]===null || Number.isSafeInteger(record[key]) && record[key]>=0);
      }
      assert.ok(record.population===null ? record.populationSource===null : ['cow','mpd'].includes(record.populationSource));
      if(record.gdp!==null)assert.ok(record.gdpScope && record.gdp%1_000_000===0);
      if(record.flag){
        assert.match(record.flag.source,/^https:\/\//);
        assert.ok(record.flag.caption);
        if(record.flag.src)assert.ok(fs.existsSync(path.resolve(__dirname,'../web',record.flag.src)));
        else assert.match(record.flag.emoji,/^[\u{1F1E6}-\u{1F1FF}]{2}$/u);
      }
    }
  }
  assert.match(sources.cow.url,/correlatesofwar\.org/);
  assert.match(sources.mpd.url,/rug\.nl/);
});

test('keeps military reference-year, empire coverage, missing records and reported zeros distinct', () => {
  const [early,first,second]=[byEra['1886'],byEra.ww1,byEra.ww2];
  assert.deepEqual([early.USA.population,first.USA.population,second.USA.population],[57938000,99111000,131028000]);
  assert.deepEqual([early.USA.militaryPersonnel,first.USA.militaryPersonnel,second.USA.militaryPersonnel],[39000,166000,334000]);
  assert.equal(early.CAN.population,4711000);
  assert.equal(early.CAN.populationSource,'mpd');
  assert.equal(early.CAN.militaryPersonnel,null);
  assert.equal(first.CAN.population,8093000);
  assert.equal(first.AUS.population,4933000);
  assert.equal(first.NZL.population,1143000);
  assert.equal(second.CAN.populationSource,'cow');
  assert.equal(first.SWE.militaryPersonnel,null);
  assert.equal(second.PAN.militaryPersonnel,0);
  assert.equal(first.SRB.population,4023000);
  assert.equal(first.MNE.population,null);
  assert.equal(first.GBR.population,46048000);
  assert.match(first.GBR.scope,/United Kingdom/);
  assert.equal(second.AUT.population,null);
  assert.equal(second.RUS.population,170315000);
});

test('GDP uses both values from the same historical series and never a modern successor of a joint state', () => {
  const early=byEra['1886'];
  // MPD's United States 1886 observation: 6,471.7104 international dollars per person,
  // mid-year population 58,164 thousand. COW has a different population estimate.
  assert.equal(early.USA.gdp,Math.round(6471.7104*58164000/1e6)*1e6);
  assert.ok(early.CAN.gdp>0);
  assert.equal(early.AHU.gdp,null);
  assert.equal(early.SWE.gdp,null);
  assert.equal(byEra.ww1.TUR.gdp,null);
  assert.match(byEra.ww1.GBR.gdpScope,/United Kingdom/);
});

test('changes the US star count by date and never applies modern Chinese or German flags by country code', () => {
  for(const [era,expected] of [['1886',38],['ww1',48],['ww2',48]]){
    const flag=byEra[era].USA.flag;
    const svg=fs.readFileSync(path.resolve(__dirname,'../web',flag.src),'utf8');
    assert.equal((svg.match(/<polygon\b/g)||[]).length,expected);
  }
  assert.ok(byEra.ww1.DEU.flag.src);
  assert.equal(byEra.ww2.DEU.flag,undefined);
  assert.equal(byEra.ww1.CHN.flag.src,'assets/historical-flags/china-five-colors.svg');
  assert.equal(byEra.ww2.CHN.flag.emoji,'🇹🇼');
  assert.equal(byEra['1886'].SWE.flag,undefined);
});
