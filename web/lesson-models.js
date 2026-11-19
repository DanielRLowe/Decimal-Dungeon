(function (root) {
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function el(name, text) {const n=document.createElement(name);if(text!=null)n.textContent=text;return n;}
  function v(parent,name,attrs,text) {
    const n=document.createElementNS(ns,name);
    for (const [k,x] of Object.entries(attrs)) n.setAttribute(k,x);
    if(text!=null)n.textContent=text;
    parent.append(n);return n;
  }
  function line(p,x1,y1,x2,y2,stroke='#668499',extra={}) {return v(p,'line',{x1,y1,x2,y2,stroke,...extra});}
  function label(p,x,y,text,extra={}) {return v(p,'text',{x,y,fill:'#e7e6d5','font-size':12,'text-anchor':'middle',...extra},text);}
  function svgFigure(parent,width,height,name) {
    const s=v(parent,'svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':name});
    v(s,'title',{},name);return s;
  }
  function grid(fig,m,ctx) {
    const max=m.max||10, pad=34, side=205, bottom=side+pad, step=side/max;
    const s=svgFigure(fig,side+2*pad,side+pad+34,m.caption||'First-quadrant coordinate grid');
    s.dataset.plot='';
    for(let i=0;i<=max;i++) {
      const at=pad+i*step, h=bottom-i*step;
      line(s,at,pad,at,bottom,i?'#43556a':'#d0d5c9');line(s,pad,h,bottom,h,i?'#43556a':'#d0d5c9');
      label(s,at,bottom+15,i,{'font-size':10}); if(i)label(s,pad-12,h+3,i,{'font-size':10});
    }
    label(s,bottom+16,bottom+3,'x');label(s,pad,18,'y');
    const dots=[...(m.points||[])];
    for (const [i,val] of (ctx.verified||[]).entries()) {
      const step=ctx.steps?.[i];
      if (step?.plot) {const coords=coordinate(val);if(coords)dots.push([...coords,step.pointLabel||'']);}
    }
    const selected=ctx.step?.plot && coordinate(ctx.value);
    if (selected) dots.push([...selected,ctx.step.pointLabel||'',true]);
    for(const [x,y,name,preview] of dots) {
      const cx=pad+x*step,cy=bottom-y*step;
      v(s,'circle',{cx,cy,r:preview?6:4.5,fill:preview?'#fbd081':'#87e2c4',stroke:'#142434','stroke-width':1.5});
      if(name)label(s,cx+8,cy-6,name,{'text-anchor':'start',fill:'#fff3cc','font-size':11});
    }
    if(dots.length) v(s,'desc',{},dots.map(([x,y,name])=>(name||'Point')+' at ('+x+', '+y+')').join('. '));
    if (ctx.step?.plot && ctx.set) {
      s.setAttribute('tabindex','0');s.setAttribute('role','group');
      s.setAttribute('aria-label','Plot a point. Click a grid intersection or use the arrow keys. You can also type x, y.');
      s.classList.add('lc-click-grid');
      s.addEventListener('click',e=>{
        const matrix=s.getScreenCTM(); if(!matrix)return;
        const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
        const x=Math.round((point.x-pad)/step),y=Math.round((bottom-point.y)/step);
        if(x>=0&&x<=max&&y>=0&&y<=max) ctx.set(x+', '+y,'grid');
      });
      s.addEventListener('keydown',e=>{
        const moves={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
        if(!moves[e.key])return;
        e.preventDefault();const [x,y]=coordinate(ctx.value)||[0,0], [dx,dy]=moves[e.key];
        ctx.set(Math.min(max,Math.max(0,x+dx))+', '+Math.min(max,Math.max(0,y+dy)),'grid');
      });
    }
    fig.append(el('figcaption',[m.xLabel?'x = '+m.xLabel:'',m.yLabel?'y = '+m.yLabel:'',m.caption].filter(Boolean).join(' · ')||'Coordinate grid'));
  }
  function coordinate(value) {
    let raw=String(value??'').trim();
    if(raw.startsWith('(')&&raw.endsWith(')'))raw=raw.slice(1,-1);
    const match=/^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(raw);
    return match?[Number(match[1]),Number(match[2])]:null;
  }
  function prism(fig,m) {
    const {l,w,h}=m, top=m.top||0, height=h+top;
    const scale=Math.min(240/(l+w*.52),145/(height+w*.34)), x0=27,y0=35+(height+w*.34)*scale;
    const project=(x,y,z)=>[x0+(x+.52*y)*scale,y0-(z+.34*y)*scale];
    const dimensions=l+' cubes across, '+w+' deep and '+h+' high';
    const description=top?'A base '+dimensions+' with a second block '+m.b+' across and '+top+' high on top.':'The stack is '+dimensions+'.';
    const s=svgFigure(fig,300,y0+30,description);
    function face(coords,fill) {v(s,'polygon',{points:coords.map(p=>project(...p).join(',')).join(' '),fill,stroke:'#243b4e','stroke-width':1.1});}
    function edge(a,b) {line(s,...project(...a),...project(...b),'#385568',{'stroke-width':.8});}
    function block(length,base,thick,colors) {
      const z=base+thick;
      face([[0,0,base],[length,0,base],[length,0,z],[0,0,z]],colors[0]);
      face([[length,0,base],[length,w,base],[length,w,z],[length,0,z]],colors[1]);
      face([[0,0,z],[length,0,z],[length,w,z],[0,w,z]],colors[2]);
      for(let i=1;i<length;i++){edge([i,0,base],[i,0,z]);edge([i,0,z],[i,w,z]);}
      for(let j=1;j<w;j++){edge([0,j,z],[length,j,z]);edge([length,j,z],[length,j,base]);}
      for(let k=base+1;k<z;k++){edge([0,0,k],[length,0,k]);edge([length,0,k],[length,w,k]);}
    }
    block(l,0,h,['#75bdad','#518b8c','#a8d9be']);
    if(top) block(m.b,h,top,['#d5a462','#af7d4f','#efd295']);
    fig.append(el('figcaption',m.caption || 'The gold block sits on the green block.'));
  }
  function model(m,ctx={}) {
    if (!m) return null;
    const fig=el('figure');fig.className='lc-model';
    if(m.type==='coordinates') grid(fig,m,ctx);
    else if(m.type==='prism'||m.type==='composite') prism(fig,m);
    else if(m.type==='table') {
      const t=el('table'),head=el('thead'),hr=el('tr');for(const cell of m.headers){const th=el('th',cell);th.scope='col';hr.append(th);}head.append(hr);t.append(head);
      const body=el('tbody');for(const row of m.rows){const tr=el('tr');for(const cell of row)tr.append(el('td',cell));body.append(tr);}t.append(body);fig.append(t);if(m.caption)fig.append(el('figcaption',m.caption));
    } else if(m.type==='numberline') {
      const s=svgFigure(fig,320,99,'Number line from '+m.min+' to '+m.max);
      const start=28,end=292,mid=(m.min+m.max)/2;
      line(s,start,48,end,48,'#acc7bc',{'stroke-width':2});
      for(const [x,n] of [[start,m.min],[(start+end)/2,Number(mid.toFixed(7))],[end,m.max]]){line(s,x,40,x,55);label(s,x,74,n);}
      const x=start+(end-start)*(m.value-m.min)/(m.max-m.min);
      v(s,'circle',{cx:x,cy:48,r:5,fill:'#ffcf7b'});label(s,Math.max(25,Math.min(295,x)),28,m.value,{fill:'#ffda91'});
    } else if(m.type==='bars') {
      for(const b of (m.bars||[m])) {
        const total=Math.max(1,Math.ceil(b.numerator/b.denominator)), div=el('div');div.className='lc-bars';
        if(b.label)div.append(el('strong',b.label));
        for(let i=0;i<total;i++){const bar=el('span');bar.className='lc-bar';bar.style.gridTemplateColumns='repeat('+b.denominator+',1fr)';
          for(let j=0;j<b.denominator;j++){const cell=el('i');if(i*b.denominator+j<b.numerator)cell.className='filled';bar.append(cell);}div.append(bar);}
        div.setAttribute('aria-label',(b.label||'Fraction')+' '+b.numerator+' of '+b.denominator+' equal parts');fig.append(div);
      }
      if(m.caption)fig.append(el('figcaption',m.caption));
    } else if(m.type==='fraction-area') {
      const s=svgFigure(fig,255,175,'Area grid with '+m.cols+' columns and '+m.rows+' rows');
      const cell=Math.min(210/m.cols,132/m.rows),x=(255-cell*m.cols)/2,y=16;
      for(let j=0;j<m.rows;j++)for(let i=0;i<m.cols;i++) {
        const col=i<m.shadedCols,row=j<m.shadedRows;
        v(s,'rect',{x:x+i*cell,y:y+j*cell,width:cell,height:cell,stroke:'#5a6c7b',fill:col&&row?'#f2c880':col?'#7699ba':row?'#8cb9a8':'#243548'});
      }
      fig.append(el('figcaption',m.caption||'Gold cells belong to both shaded regions.'));
    } else if(m.type==='line-plot') {
      const width=300, s=svgFigure(fig,width,130,m.caption||'Line plot');
      const margin=35,dx=(width-2*margin)/(m.labels.length-1);
      line(s,margin-9,93,width-margin+9,93,'#b7d8c7');
      m.labels.forEach((word,i)=>{
        const x=margin+i*dx, completed=(ctx.steps||[]).findIndex(t=>t.tick===i);
        const current=ctx.step?.tick===i;
        const n=completed>=0 && completed<(ctx.verified||[]).length ? Number(ctx.verified[completed]) : current ? Number(ctx.value) : 0;
        for(let j=0;j<Math.max(0,Math.min(5,n));j++)label(s,x,82-j*15,'×',{fill:current?'#ffcd7b':'#a1dfc3','font-size':17});
        line(s,x,88,x,98);label(s,x,115,word,{fill:current?'#ffda91':'#dae6e9'});
      });
      fig.append(el('figcaption',m.caption)); 
    } else if(m.type==='shape') {
      const outlines={'square':[[96,26],[182,26],[182,112],[96,112]],'rectangle':[[65,34],[211,34],[211,103],[65,103]],
        'rhombus':[[138,21],[222,68],[138,115],[54,68]],'parallelogram':[[96,28],[222,28],[184,111],[58,111]],
        'equilateral triangle':[[138,12],[79,114],[197,114]],'right triangle':[[75,34],[75,115],[209,115]]};
      const s=svgFigure(fig,275,135,'Figure to classify'); v(s,'polygon',{points:outlines[m.name].map(pt=>pt.join(',')).join(' '),fill:'#447b79',stroke:'#aad8bb','stroke-width':3});
      if(m.name==='right triangle')v(s,'path',{d:'M75 103h12v12',fill:'none',stroke:'#ffce80','stroke-width':2});
    } else return null;
    return fig;
  }
  root.DungeonLessonModels={model,coordinate};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.DungeonLessonModels;
})(globalThis);
