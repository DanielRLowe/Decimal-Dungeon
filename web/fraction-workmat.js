/* Hands-on companions for the existing five checked steps in unlike-fraction lessons. */
(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const stages=['Round both amounts','Find a shared unit','Rename the first amount','Rename the second amount','Combine the pieces'];
  const halfText=h=>h%2?(Math.floor(h/2)?Math.floor(h/2)+' ':'')+'1/2':String(h/2);
  const mixed=(n,d)=>{const w=Math.floor(n/d),r=n%d;return r?(w?w+' ':'')+r+'/'+d:String(w);};
  function readProblem(p){
    if(!p)return null;
    const op=p.lessonId==='fraction-add'?'+':p.lessonId==='fraction-subtract'?'-':null;
    if(!op)return null;
    // Earlier releases stored the two fractional parts and each full amount's
    // label. Recover the original wholes as well as their displayed denominators.
    let parts=p.fractionWork?.operands;
    if(!Array.isArray(parts)){
      const bars=p.model?.bars;
      if(Array.isArray(bars)&&bars.length===2){
        parts=bars.map(b=>{
          const num=String(b.label||'').match(/(?:^|\bof\s+)(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\b/i);
          if(!num)return null;
          return {numerator:Number(num[1]||0)*Number(num[3])+Number(num[2]),denominator:Number(num[3])};
        });
      }
      if(!parts?.every(Boolean)){
        const tokens=[...String(p.prompt||'').matchAll(/\b(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\b/g)];
        if(tokens.length!==2)return null;
        parts=tokens.map(t=>({numerator:Number(t[1]||0)*Number(t[3])+Number(t[2]),denominator:Number(t[3])}));
      }
    }
    if(parts.length!==2||parts.some(x=>!x||!Number.isSafeInteger(x.numerator)||!Number.isSafeInteger(x.denominator)||x.numerator<0||x.denominator<2||x.denominator>24||x.numerator>12*x.denominator))return null;
    const den=parts[0].denominator*parts[1].denominator/gcd(parts[0].denominator,parts[1].denominator);
    if(den>120)return null;
    const operands=parts.map(({numerator:n,denominator:d})=>({n,d,w:Math.floor(n/d),r:n%d,
      part:(n%d)*(den/d),count:n*(den/d),nearest:Math.floor((4*n+d)/(2*d)),text:mixed(n,d)}));
    if(op==='-'&&operands[0].count<operands[1].count)return null;
    return {op,den,operands,unit:p.fractionWork?.unit||(op==='+'?'cups':'meters'),key:op+operands.map(x=>x.n+'/'+x.d).join(':')};
  }
  const sliceNames={2:'half',3:'third',4:'quarter',5:'fifth',6:'sixth',8:'eighth',10:'tenth',12:'twelfth'};
  function sliceName(d,many=false){
    const singular=sliceNames[d]||'original slice';
    return many?(singular==='half'?'halves':singular+'s'):singular;
  }
  function cutDirection(current,goal,d){
    if(current<goal)return 'Use + to put more pieces in each '+sliceName(d)+'.';
    if(current>goal)return 'Use − to put fewer pieces in each '+sliceName(d)+'.';
    return 'The cuts match. Each small piece is 1/'+goal+' of a whole.';
  }
  function selectedIndices(raw,size){
    if(!Array.isArray(raw))return [];
    return [...new Set(raw.filter(i=>Number.isInteger(i)&&i>=0&&i<size))].sort((a,b)=>a-b);
  }
  const multipleCount=(spec,o)=>Math.max(5,Math.min(18,2*(spec.den/o.d)+1));
  function safeState(spec,old){
    const s=old?.key===spec.key?old:{};
    const num=(value,lo,hi,fallback)=>Number.isInteger(value)&&value>=lo&&value<=hi?value:fallback;
    const pair=(key,fn)=>spec.operands.map((o,i)=>fn(s[key]?.[i],o));
    const counts=pair('counts',v=>({whole:String(v?.whole??'').replace(/\D/g,'').slice(0,4),part:String(v?.part??'').replace(/\D/g,'').slice(0,4)}));
    const moves=[];
    const st={version:1,key:spec.key,marks:pair('marks',(v,o)=>num(v,2*o.w,2*o.w+2,null)),
      multiples:pair('multiples',(v,o)=>v%o.d===0?num(v,o.d,multipleCount(spec,o)*o.d,null):null),splits:pair('splits',(v,o)=>num(v,1,spec.den/o.d+2,1)),counts,moves,
      checked:Array.from({length:5},(_,i)=>s.checked?.[i]===true)};
    st.sums=spec.operands.map((o,j)=>{
      const saved=s.sums?.[j];
      if(!saved || !st.checked[j+2] || !evaluate(spec,st,j+2).ok)return emptySum();
      const value=String(saved.value??'').slice(0,12);
      const valid=validInteger(value,o.count) && (o.w!==0 || value===st.counts[j].part);
      const status=saved.status==='verified'&&valid?'verified':saved.status==='retry'&&!valid?'retry':'draft';
      return {value,status};
    });
    st.tallies=spec.operands.map((o,j)=>{
      const parsed={whole:[],part:[]};
      if(st.splits[j]*o.d!==spec.den)return parsed;
      for(const [kind,size,worth] of [['whole',o.w,spec.den],['part',o.r,st.splits[j]]]){
        const ids=selectedIndices(s.tallies?.[j]?.[kind],size);
        if(counts[j][kind]===String(ids.length*worth))parsed[kind]=ids;
      }
      return parsed;
    });
    if(Array.isArray(s.moves)){
      let pile=startingPile(spec);
      for(const action of s.moves.slice(0,240)){
        const next=tryMove(spec,pile,action);if(!next)continue;
        moves.push(action);pile=next;
      }
    }
    return st;
  }
  function setSplit(spec,s,j,value){
    const o=spec.operands[j];
    if(!o||!Number.isInteger(value)||value<1||value>spec.den/o.d+2||value===s.splits[j])return false;
    for(const kind of ['whole','part']){
      if(s.tallies[j][kind].length)s.counts[j][kind]='';
      s.tallies[j][kind]=[];
    }
    s.sums[j]=emptySum();s.splits[j]=value;s.checked[j+2]=false;return true;
  }
  function toggleTally(spec,s,j,kind,i){
    const o=spec.operands[j];
    if(!o||!['whole','part'].includes(kind)||s.splits[j]*o.d!==spec.den)return false;
    if(!Number.isInteger(i)||i<0||i>=(kind==='whole'?o.w:o.r))return false;
    const ids=s.tallies[j][kind],worth=kind==='whole'?spec.den:s.splits[j];
    s.tallies[j][kind]=ids.includes(i)?ids.filter(n=>n!==i):[...ids,i].sort((a,b)=>a-b);
    s.counts[j][kind]=String(s.tallies[j][kind].length*worth);
    s.sums[j]=emptySum();s.checked[j+2]=false;return true;
  }
  function emptySum(){return {value:'',status:'draft'};}
  function validInteger(value,target){return /^\d{1,12}$/.test(value.trim()) && Number(value)===target;}
  function setSum(spec,s,j,raw){
    if(!spec.operands[j]?.w || !s.checked[j+2] || !evaluate(spec,s,j+2).ok)return false;
    const value=String(raw??'').slice(0,12);
    if(value!==s.sums[j].value)s.sums[j]={value,status:'draft'};
    return true;
  }
  function sumFeedback(s,j){
    if(!s.sums[j].value.trim())return 'Enter your sum, then check it.';
    const whole=Number(s.counts[j].whole),part=Number(s.counts[j].part),nextTen=10-whole%10;
    if(nextTen<part && nextTen<10){
      return 'Start at '+whole+'. Use '+nextTen+' of the '+part+' pieces to reach the next ten. Then add the pieces left.';
    }
    return 'Start at '+whole+' and count forward '+part+', one piece at a time.';
  }
  function checkSum(spec,s,j){
    const o=spec.operands[j];
    if(!o || !s.checked[j+2] || !evaluate(spec,s,j+2).ok)return {ok:false,text:'Check your piece counts first.'};
    const value=(o.w?s.sums[j].value:s.counts[j].part).trim();
    if(validInteger(value,o.count)){
      s.sums[j]={value,status:'verified'};
      return {ok:true,value,text:'Your numerator is ready to submit.'};
    }
    s.sums[j].status='retry';
    return {ok:false,text:sumFeedback(s,j)};
  }
  function startingPile(s){const a=s.operands[0];return {whole:a.w,loose:a.part,movedWhole:0,movedLoose:0};}
  function tryMove(s,pile,action){
    const b=s.operands[1],sign=s.op==='+'?1:-1;
    const p={...pile};
    if(action==='whole'&&p.movedWhole<b.w && (sign===1||p.whole>0)){p.movedWhole++;p.whole+=sign;}
    else if(action==='piece'||action==='five'){
      const count=action==='five'?5:1;
      if(count>b.part-p.movedLoose || (sign===-1&&p.loose<count))return null;
      p.movedLoose+=count;p.loose+=sign*count;
    }else if(action==='trade'&&sign===1&&p.loose>=s.den){p.whole++;p.loose-=s.den;}
    else if(action==='trade'&&sign===-1&&p.loose<b.part-p.movedLoose&&p.whole>b.w-p.movedWhole){p.whole--;p.loose+=s.den;}
    else return null;
    return p;
  }
  function pileState(spec,state){return state.moves.reduce((p,action)=>tryMove(spec,p,action)||p,startingPile(spec));}
  function evaluate(spec,s,index){
    const [a,b]=spec.operands,d=spec.den;
    if(index===0){
      for(const [i,v] of spec.operands.entries()){
        const mark=s.marks[i];
        if(mark==null)return {ok:false,text:'Choose a benchmark for '+v.text+'.'};
        if(mark!==v.nearest){
          const tie=(4*v.r)%v.d===0&&(4*v.r/v.d)%2===1;
          if(tie)return {ok:false,text:v.text+' is exactly halfway between two benchmarks. Choose the higher of those two.'};
          return {ok:false,text:'Look at the dot for '+v.text+'. Which of its three marks is closest?'};
        }
      }
      return {ok:true,text:'Both marks fit. Now '+(spec.op==='+'?'add':'subtract')+' your rounded amounts for the estimate.'};
    }
    if(index===1){
      const [left,right]=s.multiples;
      if(left==null||right==null)return {ok:false,text:'Select one number from each row of multiples.'};
      if(left!==right)return {ok:false,text:'The denominators have to match. Look for the same number in both rows.'};
      if(left!==d)return {ok:false,text:'That number works for both strips. Look for an earlier match to get the least common denominator.'};
      return {ok:true,text:'Your numbers match, and there is no earlier match. Enter that denominator in the lesson.'};
    }
    if(index<4){
      const j=index-2,o=spec.operands[j],split=s.splits[j],v=s.counts[j];
      if(o.d*split!==d)return {ok:false,text:'You have '+(o.d*split)+' pieces per bar. The goal is '+d+'. '+cutDirection(o.d*split,d,o.d)};
      if(o.w && (v.whole===''||Number(v.whole)!==o.w*d))return {ok:false,text:'Count the whole bars first. Tap each bar once, or multiply '+o.w+' × '+d+' and write that count.'};
      if(v.part===''||Number(v.part)!==o.part)return {ok:false,text:'Count the shaded '+sliceName(o.d,true)+'. Each shaded '+sliceName(o.d)+' has '+split+' small pieces. Tap them, or find '+o.r+' × '+split+'.'};
      return {ok:true,text:o.w?'Your piece counts match. Add them to find the numerator.':'Your shaded pieces are the numerator.'};
    }
    const pile=pileState(spec,s);
    if(pile.movedWhole<b.w)return {ok:false,text:'You still have whole bars to '+(spec.op==='+'?'move in.':'take away.')};
    if(pile.movedLoose<b.part){
      if(spec.op==='-'&&pile.loose<b.part-pile.movedLoose)return {ok:false,text:'You need more loose pieces to finish taking away the second amount. Trade one whole bar for '+d+' pieces.'};
      return {ok:false,text:'You still need to '+(spec.op==='+'?'move in ':'take away ')+(b.part-pile.movedLoose)+' loose '+(b.part-pile.movedLoose===1?'piece.':'pieces.')};
    }
    if(pile.loose>=d)return {ok:false,text:'A full row of '+d+' loose pieces can be traded for one whole bar.'};
    return {ok:true,text:'Your mat balances. Write the amount as a mixed number or a single fraction in the lesson.'};
  }
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;};
  const button=(text,cls,click)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',click);return b;};
  function render(problem,stepIndex,savedState,onChange,focusAnswer){
    const spec=readProblem(problem);
    if(!spec||!Number.isInteger(stepIndex)||stepIndex<0||stepIndex>=stages.length)return null;
    const s=safeState(spec,savedState),shell=el('section','fm-workmat');
    shell.dataset.fractionWorkmat='';shell.setAttribute('aria-label','Fraction workmat');
    let index=stepIndex;
    const persist=event=>onChange?.(JSON.parse(JSON.stringify(s)),event);
    function redraw(restore){
      body.replaceChildren();
      shell.dataset.fmStage=String(index);
      title.textContent=stages[index];
      if(index===0)rounding();else if(index===1)multiples();else if(index<4)rename();else combine();
      const renaming=index===2||index===3;
      check.textContent=renaming?(s.splits[index-2]*spec.operands[index-2].d===spec.den?'Check piece counts':'Check cut size'):
        ['Check rounding','Check common denominator','','',spec.op==='+'?'Check combined pieces':'Check remaining pieces'][index];
      clearFeedback();
      if(s.checked[index])announce();
      if(restore){
        let control=[...shell.querySelectorAll('[data-fm-focus]')].find(n=>n.dataset.fmFocus===restore&&!n.disabled);
        if(!control)control=shell.querySelector('[data-fm-check]');
        control?.focus({preventScroll:true});
      }
    }
    function change(fn,restore){
      fn();s.checked[index]=false;persist();redraw(restore);
    }
    function clearFeedback(){
      feedback.textContent='';feedback.classList.remove('fm-ok');delete feedback.dataset.correct;
      worked.replaceChildren();worked.hidden=true;
    }
    function equivalence(o,value){
      const eq=el('div','fm-equivalence');eq.dataset.fmEquivalence='';
      const ratio=el('span','fm-stacked'),num=el('b','',value);num.dataset.fmNumerator='';
      ratio.append(num,el('span','fm-sr','/'),el('span','fm-bottom',spec.den));
      eq.append(el('span','',o.text+' = '),ratio);
      eq.setAttribute('aria-label',o.text+' equals '+value+' over '+spec.den);
      return eq;
    }
    function finishCount(j){
      const result=checkSum(spec,s,j),current=index===stepIndex;
      const event=current?{stage:index,...(result.ok?{numerator:result.value}:{retry:!!s.sums[j].value.trim()})}:undefined;
      persist(event);announce();
      if(result.ok && current){focusAnswer?.();}
      else if(!result.ok){
        const input=worked.querySelector('[data-fm-sum]');input?.focus();input?.select();
      }
    }
    function workingSum(j){
      const o=spec.operands[j],sum=s.sums[j],values=s.counts[j],current=index===stepIndex;
      worked.hidden=false;
      if(o.w){
        const label=el('label','fm-sum-line'),caption=el('span','fm-earned-label','Add your pieces');
        const expression=el('span','fm-sum-expression',values.whole+' + '+values.part+' =');
        const input=el('input','fm-sum-input');input.type='text';input.inputMode='numeric';input.autocomplete='off';
        input.maxLength=12;input.value=sum.value;input.dataset.fmSum='';
        input.setAttribute('aria-label','Sum of '+values.whole+' and '+values.part);
        label.append(caption,expression,input);
        const buttonCheck=button('Check sum','fm-sum-check',()=>finishCount(j));buttonCheck.dataset.fmCheckSum='';
        const status=el('p','fm-sum-feedback');status.dataset.fmSumFeedback='';status.setAttribute('role','status');
        if(sum.status==='retry'){
          status.textContent=sumFeedback(s,j);status.dataset.correct='false';
        }
        input.addEventListener('input',()=>{
          if(input.value===s.sums[j].value)return;
          setSum(spec,s,j,input.value);
          status.textContent='';delete status.dataset.correct;
          worked.querySelector('[data-fm-equivalence]')?.remove();
          worked.querySelector('[data-fm-to-answer]')?.remove();
          persist();
        });
        input.addEventListener('keydown',event=>{
          if(event.key==='Enter'&&!event.isComposing){
            event.preventDefault();event.stopPropagation();if(!event.repeat)finishCount(j);
          }
        });
        worked.append(label,buttonCheck,status);
        if(sum.status==='verified'){
          status.textContent=current?'Sum checked. You can submit your numerator.':'Sum checked.';
          status.dataset.correct='true';
        }
      }
      if(sum.status==='verified'){
        worked.append(equivalence(o,sum.value));
        if(current && typeof focusAnswer==='function'){
          const go=button('Go to numerator','fm-transfer',()=>focusAnswer());
          go.dataset.fmToAnswer='';worked.append(go);
        }
      }else if(!o.w){
        // A past build saved checked counts but did not transfer an answer.
        // Only a deliberate check can copy the learner's prior count.
        worked.hidden=true;
      }
    }
    function announce(){
      const result=evaluate(spec,s,index);
      const building=body.querySelector('[data-fm-buildsum]');if(building&&result.ok)building.hidden=true;
      let note=result.text;
      if(result.ok && (index===2||index===3) && spec.operands[index-2].w===0 && index===stepIndex){
        note=s.sums[index-2].status==='verified'?'Piece count checked. You can submit your numerator.':'Choose Check piece counts to copy your count to the numerator.';
      }
      feedback.textContent=note;feedback.classList.toggle('fm-ok',result.ok);feedback.dataset.correct=String(result.ok);
      worked.replaceChildren();worked.hidden=true;
      if(result.ok&&(index===2||index===3))workingSum(index-2);
    }
    const heading=el('header','fm-head'),title=el('h4');
    heading.append(el('span','fm-kicker','Fraction workmat'),title);
    if(stepIndex>0){
      const wrap=el('label','fm-stage-chooser');wrap.append(el('span','','View work'));
      const select=el('select');select.dataset.fmView='';
      stages.slice(0,stepIndex+1).forEach((name,i)=>{const option=el('option','',name);option.value=String(i);select.append(option);});
      select.value=String(index);
      select.addEventListener('change',()=>{index=Number(select.value);redraw();});
      wrap.append(select);heading.append(wrap);
    }
    const body=el('div','fm-body'),foot=el('div','fm-foot');
    const check=button('','fm-check',()=>{
      s.checked[index]=true;
      if(index===2||index===3){
        const j=index-2;
        if(!spec.operands[j].w && evaluate(spec,s,index).ok){finishCount(j);return;}
      }
      persist();announce();
      if(index===stepIndex)worked.querySelector('[data-fm-sum]')?.focus({preventScroll:true});
    });
    check.dataset.fmCheck='';const feedback=el('p','fm-feedback');feedback.dataset.fmFeedback='';feedback.setAttribute('role','status');
    const worked=el('div','fm-earned');worked.hidden=true;
    const live=el('span','fm-sr');live.setAttribute('role','status');live.setAttribute('aria-atomic','true');
    foot.append(check,feedback);shell.append(heading,body,foot,worked,live);
    function rounding(){
      body.append(el('p','fm-instruction','Choose the nearest benchmark for each dot. The short ticks mark ties. At a tie, choose the higher benchmark.'));
      spec.operands.forEach((o,j)=>{
        const card=el('div','fm-card'),row=el('div','fm-card-title'),name=el('strong','',o.text+' '+spec.unit);
        row.append(name);card.append(row);
        const line=el('div','fm-line');line.setAttribute('role','img');line.setAttribute('aria-label',o.text+' on a line from '+o.w+' to '+(o.w+1)+', with a half mark between them.');
        for(let k=0;k<=4;k++){const tick=el('i',k%2?'fm-quarter':'fm-tick');tick.style.left=k*25+'%';line.append(tick);}
        const dot=el('i','fm-dot');dot.style.left=(100*o.r/o.d)+'%';line.append(dot);
        const choices=el('div','fm-benchmarks');choices.setAttribute('role','group');choices.setAttribute('aria-label','Nearest half to '+o.text);
        for(let k=0;k<3;k++){
          const h=2*o.w+k, key='round-'+j+'-'+k,btn=button(halfText(h),'fm-pick',()=>change(()=>{s.marks[j]=h;},key));
          btn.dataset.fmBenchmark=String(j);btn.dataset.halves=String(h);btn.dataset.fmFocus=key;btn.setAttribute('aria-pressed',String(s.marks[j]===h));choices.append(btn);
        }
        card.append(line,choices);body.append(card);
      });
      if(s.marks.every(x=>x!==null))body.append(el('p','fm-equation',halfText(s.marks[0])+' '+(spec.op==='+'?'+':'−')+' '+halfText(s.marks[1])+' = ?'));
    }
    function multiples(){
      body.append(el('p','fm-instruction','Skip-count along each row. Choose the first number that both rows share.'));
      spec.operands.forEach((o,j)=>{
        const card=el('div','fm-card'),picks=el('div','fm-chips');
        card.append(el('strong','fm-card-title','Count by '+o.d));
        picks.setAttribute('role','group');picks.setAttribute('aria-label','Multiples of '+o.d);
        // Include the next shared multiple when compact. Give neither row a
        // characteristic endpoint at the intended first match.
        const size=multipleCount(spec,o);
        for(let k=1;k<=size;k++){
          const val=k*o.d,key='multiple-'+j+'-'+val,btn=button(val,'fm-pick',()=>change(()=>{s.multiples[j]=val;},key));
          btn.dataset.fmMultiple=String(j);btn.dataset.value=String(val);btn.dataset.fmFocus=key;btn.setAttribute('aria-pressed',String(s.multiples[j]===val));picks.append(btn);
        }
        card.append(picks);body.append(card);
      });
    }
    function strip(count,den,filled,description,groupEvery){
      const strip=el('div','fm-strip');strip.setAttribute('role','img');strip.setAttribute('aria-label',description);
      for(let i=0;i<count;i++){
        const cell=el('i',i<filled?'fm-filled':'');if(groupEvery&&i&&i%groupEvery===0)cell.classList.add('fm-cut');
        strip.append(cell);
      }
      strip.style.gridTemplateColumns='repeat('+den+',minmax(0,1fr))';return strip;
    }
    function rename(){
      const j=index-2,o=spec.operands[j],split=s.splits[j],per=o.d*split,ready=per===spec.den;
      body.append(el('p','fm-instruction','Make '+o.text+' in pieces of size 1/'+spec.den+'. Start with the cuts in one whole bar.'));
      const card=el('div','fm-card fm-cut-card'),controls=el('div','fm-split-tools');
      controls.append(el('span','','Pieces in each '+sliceName(o.d)));
      for(const [dir,label,adj] of [['down','−',-1],['up','+',1]]){
        if(dir==='up')controls.append(el('output','fm-badge',split));
        const key='cut-'+dir,btn=button(label,'fm-small',()=>{
          change(()=>setSplit(spec,s,j,split+adj),key);
          const current=s.splits[j]*o.d;live.textContent=current+' pieces per whole. Goal '+spec.den+'. '+cutDirection(current,spec.den,o.d);
        });
        btn.dataset.fmSplit=dir;btn.dataset.fmFocus=key;btn.setAttribute('aria-label',adj>0?'Use more pieces per '+sliceName(o.d):'Use fewer pieces per '+sliceName(o.d));
        btn.disabled=adj<0?split<=1:split>=spec.den/o.d+2;controls.append(btn);
      }
      card.append(controls);
      const comparison=el('div','fm-compare');comparison.dataset.fit=String(ready);
      for(const [attr,label,value] of [['fmCurrent','Pieces per bar',per],['fmGoal','Goal per bar',spec.den]]){
        const cell=el('span','fm-measure'),amount=el('b','',value);amount.dataset[attr]='';
        cell.append(el('span','',label),amount);comparison.append(cell);
      }
      card.append(comparison);
      const groupCells=()=>{
        const part=el('span','fm-mini-cells');part.setAttribute('aria-hidden','true');
        part.style.gridTemplateColumns='repeat('+split+',minmax(0,1fr))';
        for(let n=0;n<split;n++)part.append(el('i'));
        return part;
      };
      const barGroups=()=>{
        const groups=el('span','fm-bar-groups');groups.style.gridTemplateColumns='repeat('+o.d+',minmax(0,1fr))';return groups;
      };
      if(!ready){
        const preview=barGroups();preview.classList.add('fm-cut-preview');
        for(let n=0;n<o.d;n++)preview.append(groupCells());
        card.append(preview);
      }
      card.append(el('p','fm-cut-equation',o.d+' '+sliceName(o.d,true)+' × '+split+' '+(split===1?'piece':'pieces')+' each = '+per+' per whole'));
      const direction=el('p','fm-cut-direction',cutDirection(per,spec.den,o.d));direction.dataset.fmDirection='';
      card.append(direction);body.append(card);
      if(!ready)return;

      const countCard=el('div','fm-card fm-count-card');countCard.append(el('strong','fm-card-title','Count '+o.text));
      const shortName=sliceName(o.d);
      countCard.append(el('p','fm-count-how',o.w?'Tap each whole bar and each shaded '+shortName+', or type your counts below.':
        'Tap each shaded '+shortName+', or type your count below.'));
      function counter(kind,i){
        const isWhole=kind==='whole',key='tally-'+j+'-'+kind+'-'+i,selected=s.tallies[j][kind].includes(i);
        const b=button('','fm-tally fm-tally-'+kind,()=>{
          change(()=>toggleTally(spec,s,j,kind,i),key);
          live.textContent=s.counts[j][kind]+' pieces counted in '+(isWhole?'whole bars.':'the fractional part.');
        });
        b.dataset.fmTally=kind;b.dataset.index=String(i);b.dataset.fmFocus=key;b.setAttribute('aria-pressed',String(selected));
        b.setAttribute('aria-label',(isWhole?'Whole bar ':('Shaded '+shortName+' '))+(i+1)+', '+(isWhole?spec.den:split)+' pieces');
        return b;
      }
      if(o.w){
        const wholes=el('div','fm-tally-wholes');wholes.setAttribute('role','group');wholes.setAttribute('aria-label','Count the whole bars');
        for(let i=0;i<o.w;i++){
          const b=counter('whole',i),bar=barGroups(),sel=s.tallies[j].whole.includes(i);
          for(let k=0;k<o.d;k++)bar.append(groupCells());
          b.append(el('span','fm-bar-name','Bar '+(i+1)),bar,el('span','fm-pickmark',sel?String((s.tallies[j].whole.indexOf(i)+1)*spec.den):'+'));
          wholes.append(b);
        }
        countCard.append(wholes);
      }
      const caption=el('div','fm-part-cap',o.r+'/'+o.d+' of one bar');countCard.append(caption);
      const parts=barGroups();parts.classList.add('fm-tally-parts');parts.setAttribute('role','group');parts.setAttribute('aria-label','Count the shaded '+sliceName(o.d,true));
      for(let i=0;i<o.d;i++){
        if(i>=o.r){const blank=el('span','fm-unshaded');blank.setAttribute('aria-hidden','true');blank.append(groupCells());parts.append(blank);continue;}
        const b=counter('part',i);b.append(groupCells(),el('span','fm-part-mark',s.tallies[j].part.includes(i)?String((s.tallies[j].part.indexOf(i)+1)*split):'+'));parts.append(b);
      }
      countCard.append(parts);body.append(countCard);
      const fields=el('div','fm-counts'),buildSum=el('p','fm-build-sum');buildSum.dataset.fmBuildsum='';
      function showBuilding(){
        const {whole,part}=s.counts[j];
        buildSum.hidden=part===''||(o.w>0&&whole==='');
        buildSum.textContent=buildSum.hidden?'':o.w?whole+' + '+part+' = ? pieces':part+' shaded pieces';
      }
      for(const [id,label] of [['whole','Pieces in whole bars'],['part','Pieces in shaded '+sliceName(o.d,true)]]){
        if(id==='whole'&&!o.w)continue;
        const wrap=el('label','fm-count');wrap.append(el('span','',label));
        const input=el('input');input.type='text';input.inputMode='numeric';input.autocomplete='off';input.maxLength=4;input.value=s.counts[j][id];input.dataset.fmCount=id;
        input.addEventListener('input',()=>{
          const v=input.value.replace(/\D/g,'').slice(0,4);
          if(input.value!==v)input.value=v;
          s.counts[j][id]=v;s.tallies[j][id]=[];s.sums[j]=emptySum();s.checked[index]=false;
          for(const b of countCard.querySelectorAll('[data-fm-tally="'+id+'"]')){
            b.setAttribute('aria-pressed','false');
            b.querySelector(id==='whole'?'.fm-pickmark':'.fm-part-mark').textContent='+';
          }
          clearFeedback();showBuilding();persist();
        });
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();check.click();}});
        wrap.append(input);fields.append(wrap);
      }
      showBuilding();body.append(fields,buildSum);
    }
    function combine(){
      const [a,b]=spec.operands,p=pileState(spec,s),add=spec.op==='+',den=spec.den;
      body.append(el('p','fm-instruction','Start with '+a.text+'. '+(add?'Move in ':'Take away ')+b.text+' using pieces of size 1/'+den+'.'));
      const card=el('div','fm-card');
      card.append(el('strong','fm-card-title','On your mat'));
      const blocks=el('div','fm-wholes');
      for(let i=0;i<p.whole;i++)blocks.append(el('i','fm-whole','1'));
      blocks.setAttribute('aria-hidden','true');
      card.append(el('span','fm-strip-caption',p.whole+' whole '+(p.whole===1?'bar':'bars')),blocks);
      card.append(el('span','fm-strip-caption',p.loose+' loose '+(p.loose===1?'piece':'pieces')+' of size 1/'+den));
      for(let r=0;r<Math.max(1,Math.ceil(p.loose/den));r++)card.append(strip(den,den,clamp(p.loose-r*den,0,den),'Loose fraction pieces'));
      body.append(card);
      const moveWord=add?'Move in':'Take away';
      const tray=el('div','fm-tray');tray.append(el('strong','fm-strip-caption',moveWord+' · '+(b.w-p.movedWhole)+' whole bars and '+(b.part-p.movedLoose)+' pieces remaining'));
      const controls=el('div','fm-chips');
      const actions=[...(b.w?[['whole',moveWord+' 1 whole']]:[]),['piece',moveWord+' 1 piece'],...(b.part>=5?[['five',moveWord+' 5 pieces']]:[]),
        ['trade',add?'Trade '+den+' pieces for 1 whole':'Trade 1 whole for '+den+' pieces'],['undo','Undo move']];
      for(const [id,label] of actions){
        const key='move-'+id,btn=button(label,'fm-move',()=>change(()=>{if(id==='undo')s.moves.pop();else s.moves.push(id);},key));
        btn.dataset.fmMove=id;btn.dataset.fmFocus=key;btn.disabled=id==='undo'?!s.moves.length:!tryMove(spec,p,id);
        controls.append(btn);
      }
      tray.append(controls);body.append(tray);
    }
    redraw();return shell;
  }
  const api={render,readProblem,safeState,tryMove,startingPile,pileState,evaluate,setSplit,toggleTally,setSum,checkSum};
  root.DungeonFractionWorkmat=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
