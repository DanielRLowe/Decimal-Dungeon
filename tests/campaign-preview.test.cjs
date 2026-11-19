'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const adventure=require('../web/adventure.js');
const math=require('../web/math.js');
const source=fs.readFileSync(require.resolve('../web/campaign.js'),'utf8');

// Record SVG updates as well as the resulting markup. HUD refreshes should not
// require the native browser to parse a megabyte of unchanged country geometry.
function fixture() {
  let writes=0;
  class Element {
    constructor(tag) {
      this.tag=tag; this.children=[]; this.attributes=new Map();
      this.dataset=new Proxy({},{set:(o,k,v)=>{writes++;o[k]=String(v);return true;}});
    }
    get firstElementChild() { return this.children[0]; }
    setAttribute(k,v) { writes++;this.attributes.set(k,String(v)); }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    replaceChildren(...nodes) { writes++;this.children=nodes; }
    append(...nodes) { writes++;this.children.push(...nodes); }
    *descendants() {
      for (const child of this.children) {yield child;yield* child.descendants();}
    }
  }
  const browser={document:{createElementNS:(ns,tag)=>{
    assert.equal(ns,'http://www.w3.org/2000/svg');
    return new Element(tag);
  }}};
  vm.runInNewContext(source,browser);
  const host=new Element('span');
  return {host,render:view=>browser.DungeonCampaignMap.renderPreview(host,view),writes:()=>writes,
    get:(key,value)=>[...host.descendants()].find(e=>e.getAttribute(key)===value)};
}

test('the sidebar uses every sovereign path from the selected historical or modern atlas',()=>{
  const f=fixture(),game=adventure.open(null);
  let old=null;
  for (const era of ['modern','ww2','ww1','1886','modern']) {
    game.switchEra(era);
    const v=game.campaignView();
    f.render(v);
    const svg=f.host.firstElementChild;
    assert.notEqual(svg,old);
    assert.equal(svg.getAttribute('viewBox'),'0 0 1000 540');
    assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid meet');
    assert.equal(svg.getAttribute('data-preview-era'),era);
    assert.equal(svg.getAttribute('aria-hidden'),'true');
    assert.equal(svg.getAttribute('focusable'),'false');
    assert.equal([...svg.descendants()].filter(e=>e.getAttribute('data-preview-country')).length,v.total);
    for (const n of v.nations) {
      const path=f.get('data-preview-country',n.code);
      assert.equal(path.getAttribute('d'),n.path,n.name+' outline');
      assert.equal(path.getAttribute('fill'),n.color,n.name+' political color');
      assert.equal(path.dataset.owner,'neutral');
    }
    assert.ok(f.get('d',v.board.landPath));
    assert.ok(f.get('d',v.capitals.lakePath));
    for(const el of svg.descendants()) {
      assert.ok(!el.attributes.has('id') && !el.attributes.has('tabindex') && !el.attributes.has('role'));
      assert.ok(!['a','button'].includes(el.tag));
    }
    old=svg;
  }
});

test('seat, tiny rival holdings and target use saved campaign state without redrawing unrelated geometry',()=>{
  const f=fixture(),game=adventure.open(null);
  const id=code=>game.campaignView().nations.find(n=>n.code===code).id;
  f.render(game.campaignView());
  const usa=f.get('data-preview-country','USA'),mex=f.get('data-preview-country','MEX'),vat=f.get('data-preview-country','VAT');
  assert.ok(game.chooseCapital(id('USA')));
  assert.ok(game.addRival('River Empire',id('VAT')));
  assert.ok(game.invade(id('MEX')));
  let view=game.campaignView();
  f.render(view);
  const seat=f.get('data-preview-seat','USA'),site=view.administration[id('USA')];
  assert.equal(seat.getAttribute('transform'),'translate('+site.x+' '+site.y+')');
  assert.equal(usa.dataset.owner,'player');
  assert.equal(usa.getAttribute('fill'),'#e5bb64');
  assert.equal(mex.dataset.previewStatus,'frontier');
  const target=view.nations[id('MEX')];
  assert.equal(f.get('data-preview-target','MEX').getAttribute('transform'),'translate('+target.x+' '+target.y+')');
  assert.equal(vat.dataset.owner,view.rivals[0].id);
  assert.equal(vat.getAttribute('fill'),view.rivals[0].color);
  assert.equal(f.get('data-preview-holding','VAT').getAttribute('fill'),view.rivals[0].color);
  const before=f.writes();
  const round=game.startRound(math.makeProblem);
  game.saveDraft(round.id,{value:'unfinished'});
  game.setting('music',true);
  f.render(game.campaignView());
  assert.equal(f.writes(),before,'A draft or Music change must not repaint the minimap');
  const inland=view.nations[id('USA')];
  assert.ok(game.setCountryCapital(inland.id,{x:inland.x,y:inland.y}));
  f.render(game.campaignView());
  assert.equal(f.get('data-preview-seat','USA').getAttribute('transform'),'translate('+inland.x+' '+inland.y+')');
  const won=game.finishRound(round.id,{damage:35,answer:'4',fullyWorked:true,independent:true,hints:0,errors:{}});
  assert.equal(won.capture.id,id('MEX'));
  assert.ok(game.setEmpireSeat(id('MEX')));
  view=game.campaignView();f.render(view);
  assert.equal(f.get('data-preview-country','MEX'),mex,'Capturing a country must keep its original SVG path');
  assert.equal(mex.getAttribute('fill'),usa.getAttribute('fill'));
  assert.equal(mex.dataset.owner,'player');
  assert.ok(f.get('data-preview-seat','MEX'));
  assert.equal(f.get('data-preview-seat','USA'),undefined);
  assert.equal(f.get('data-preview-target','MEX'),undefined);
});
