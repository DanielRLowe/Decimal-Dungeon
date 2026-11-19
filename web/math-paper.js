/* Per-problem graph paper. Ink uses coordinates in paper units so it survives resizing. */
(function(root) {
  'use strict';
  const width=480, height=310, maxStrokes=240, notesLimit=4000;
  const ns='http://www.w3.org/2000/svg';
  let nextId=0;
  function node(tag,cls,word) {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(word!=null)el.textContent=word;
    return el;
  }
  function svgNode(tag,attrs={}) {
    const el=document.createElementNS(ns,tag);
    for(const [name,val] of Object.entries(attrs))el.setAttribute(name,val);
    return el;
  }
  function validPaper(raw) {
    const strokes=Array.isArray(raw?.strokes)?raw.strokes.slice(0,maxStrokes)
      .filter(stroke=>Array.isArray(stroke)&&stroke.length>=2&&stroke.length<=4096&&stroke.length%2===0&&stroke.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=(i%2?height:width))):[];
    return {notes:typeof raw?.notes==='string'?raw.notes.slice(0,notesLimit):'',strokes};
  }
  function hasWork(paper) {return !!(paper?.notes?.trim() || paper?.strokes?.length);}
  function lineData(points) {
    const path=['M'+points[0]+' '+points[1]];
    for(let i=2;i<points.length;i+=2)path.push('L'+points[i]+' '+points[i+1]);
    if(points.length===2)path.push('l0.01 0');
    return path.join(' ');
  }
  function surface(label) {
    const id='paper-grid-'+(++nextId), svg=svgNode('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':label});
    const defs=svgNode('defs');
    const pattern=svgNode('pattern',{id,patternUnits:'userSpaceOnUse',width:16,height:16});
    pattern.append(svgNode('path',{d:'M16 0H0V16',fill:'none',stroke:'#bdd5d5','stroke-width':1}));
    defs.append(pattern);
    const ink=svgNode('g',{fill:'none',stroke:'#263f69','stroke-linecap':'round','stroke-linejoin':'round','stroke-width':2.4});
    svg.append(defs,svgNode('rect',{width,height,fill:'#fff8e5'}),svgNode('rect',{width,height,fill:'url(#'+id+')'}),ink);
    return {svg,ink};
  }
  function create(raw,changed,layout) {
    const data=validPaper(raw), redo=[];
    let open=raw?.open===true, mode=raw?.mode==='type'?'type':'draw', active=null;
    const toggle=node('button','mp-toggle','Math paper');toggle.type='button';toggle.dataset.paperToggle='';
    const sheet=node('section','mp-sheet');sheet.id='sheet-'+(++nextId);sheet.setAttribute('aria-label','My math paper');
    toggle.setAttribute('aria-controls',sheet.id);
    const tabs=node('div','mp-controls'), modes=node('div','mp-modes'), edits=node('div','mp-edits');
    function btn(text,action,key,parent) {
      const b=node('button','',text);b.type='button';b.addEventListener('click',action);if(key)b.dataset[key]='';parent.append(b);return b;
    }
    function snapshot(){return {open,mode,notes:data.notes,strokes:data.strokes};}
    function save(){changed(snapshot());}
    const drawBtn=btn('Draw',()=>switchMode('draw'),null,modes),typeBtn=btn('Type',()=>switchMode('type'),null,modes);
    drawBtn.dataset.paperMode='draw';typeBtn.dataset.paperMode='type';
    const undo=btn('Undo',()=>{if(!active && data.strokes.length){redo.push(data.strokes.pop());ink.lastChild?.remove();refresh();save();}},'paperUndo',edits);
    const again=btn('Redo',()=>{if(!active && redo.length){const stroke=redo.pop();data.strokes.push(stroke);ink.append(svgNode('path',{d:lineData(stroke)}));refresh();save();}},'paperRedo',edits);
    undo.setAttribute('aria-label','Undo last pencil stroke');again.setAttribute('aria-label','Redo pencil stroke');
    tabs.append(modes,edits);
    const {svg,ink}=surface('Graph paper for drawing calculations. Choose Type to use a keyboard.');
    svg.dataset.paperSurface='';
    for(const line of data.strokes)ink.append(svgNode('path',{d:lineData(line)}));
    const notes=node('textarea','mp-notes');
    notes.dataset.paperNotes='';notes.maxLength=notesLimit;notes.spellcheck=false;notes.value=data.notes;
    notes.placeholder='Write your working here…';notes.setAttribute('aria-label','Type your calculations on math paper');
    notes.addEventListener('input',()=>{data.notes=notes.value;save();});
    const prompt=node('p','mp-instruction');
    sheet.append(tabs,svg,notes,prompt);
    toggle.addEventListener('click',()=>{open=!open;refresh();save();layout?.();});
    function switchMode(next){mode=next;refresh();save();if(next==='type')notes.focus({preventScroll:true});}
    function refresh(){
      toggle.setAttribute('aria-expanded',String(open));sheet.hidden=!open;
      drawBtn.setAttribute('aria-pressed',String(mode==='draw'));typeBtn.setAttribute('aria-pressed',String(mode==='type'));
      undo.disabled=!data.strokes.length;again.disabled=!redo.length;edits.hidden=mode!=='draw';
      // Use the attribute for SVG as well as CSS.
      svg.toggleAttribute('hidden',mode!=='draw');notes.hidden=mode!=='type';
      prompt.textContent=mode==='type'?'Use Return for a new line.':data.strokes.length>=maxStrokes?'Page full. Undo a stroke to draw again.':'Draw with a mouse, trackpad or finger.';
    }
    function point(e) {
      const matrix=svg.getScreenCTM();if(!matrix)return null;
      const at=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
      return [Math.min(width,Math.max(0,Math.round(at.x))),Math.min(height,Math.max(0,Math.round(at.y)))];
    }
    function addPoint(e) {
      if(active?.id!==e.pointerId)return;
      const p=point(e), a=active.points;
      if(!p || p[0]===a[a.length-2]&&p[1]===a[a.length-1])return;
      if(a.length>=4096) {
        const simplified=[];for(let i=0;i<a.length-2;i+=4)simplified.push(a[i],a[i+1]);
        a.splice(0,a.length,...simplified);
      }
      a.push(...p);active.path.setAttribute('d',lineData(a));
    }
    function endStroke(e) {
      if(!active || e && active.id!==e.pointerId)return;
      if(e?.type==='pointerup')addPoint(e);
      data.strokes.push(active.points);redo.length=0;active=null;refresh();save();
    }
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==0||active||data.strokes.length>=maxStrokes)return;
      const p=point(e);if(!p)return;e.preventDefault();
      const path=svgNode('path',{d:lineData(p)});ink.append(path);active={id:e.pointerId,points:p,path};
      if(svg.hasPointerCapture && !svg.hasPointerCapture(e.pointerId)){
        try{svg.setPointerCapture(e.pointerId);}catch{/* Synthetic input can have no system pointer. */}
      }
    });
    svg.addEventListener('pointermove',addPoint);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(type,endStroke);
    // A Return in notes belongs to the paper even when the underlying exercise listens for it.
    sheet.addEventListener('keydown',e=>e.stopPropagation());
    refresh();
    return {toggle,sheet,snapshot,finishStroke:()=>endStroke(),get open(){return open;}};
  }
  function review(raw) {
    const data=validPaper(raw);
    if(!hasWork(data))return null;
    const details=node('details','mp-review');details.append(node('summary','','My math paper'));
    if(data.strokes.length){
      const {svg,ink}=surface('Drawing saved with this problem');
      for(const line of data.strokes)ink.append(svgNode('path',{d:lineData(line)}));
      details.append(svg);
    }
    if(data.notes.trim())details.append(node('pre','mp-saved-notes',data.notes));
    return details;
  }
  const api={create,review,hasWork,validPaper};
  root.DungeonPaper=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
