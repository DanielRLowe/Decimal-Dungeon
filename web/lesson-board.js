/* A lesson is a sequence of checked, independently resumable written steps. */
(function (root) {
  'use strict';
  const models = root.DungeonLessonModels || (typeof require==='function' ? require('./lesson-models.js') : null);
  function text(value) {
    return String(value ?? '').replace(/(\d)([¼½¾⅐-⅞])/g,'$1 $2').normalize('NFKC').trim().toLowerCase()
      .replace(/⁄/g,'/').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/[\[{]/g,'(').replace(/[\]}]/g,')');
  }
  function rational(value) {
    if (value.length > 100) return null;
    let m=/^([+-]?)(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(value);
    if (m && BigInt(m[4])>0n) {
      const d=BigInt(m[4]);
      return [(m[1]==='-'?-1n:1n)*(BigInt(m[2]||0)*d+BigInt(m[3])),d];
    }
    m=/^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value);
    if (!m || !m[2] && !m[3]) return null;
    return [(m[1]==='-'?-1n:1n)*BigInt((m[2]||'0')+(m[3]||'')),10n**BigInt((m[3]||'').length)];
  }
  function matches(step,raw) {
    let supplied=text(raw);
    if (!supplied || supplied.length>500) return false;
    return [].concat(step.answer).some(candidate=>{
      const expected=text(candidate);
      if(step.plot) {
        const a=models.coordinate(raw), b=models.coordinate(candidate);
        return !!a && !!b && a[0]===b[0] && a[1]===b[1];
      }
      if(supplied===expected) return true;
      // Accept conventional thousands separators only in standalone numbers.
      const ungroup=s=>/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)?s.replaceAll(',',''):s;
      const provided=rational(ungroup(supplied)), target=rational(ungroup(expected));
      if(target) return !!provided && (step.format==='fraction' || !supplied.includes('/')) &&
        provided[0]*target[1]===target[0]*provided[1];
      return supplied.replace(/\s+/g,'')===expected.replace(/\s+/g,'');
    });
  }
  function element(tag,cls,word) {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(word!=null) node.textContent=word;
    return node;
  }
  function button(label,cls,fn) {
    const node=element('button',cls,label);
    node.type='button'; node.addEventListener('click',fn); return node;
  }
  function mount(host,{problem,draft,onDraft,onComplete}) {
    const steps=problem.steps, identity=JSON.stringify([problem.lessonId,problem.prompt,steps.map(s=>s.answer)]);
    const fractionModel=root.DungeonFractionWorkmat.readProblem(problem);
    const saved=draft?.identity===identity?draft:{};
    let verified=[];
    for(const value of saved.verified || []) {
      if(verified.length>=steps.length-1 || !matches(steps[verified.length],value)) break;
      verified.push(String(value));
    }
    let value=String(saved.value??''),hints=saved.hints||0,errors=saved.errors||0,hinted=!!saved.hinted,closed=false, message='';
    let paperDraft=saved.paper, updateLayout;
    let fractionWork=saved.fractionWork && fractionModel ? root.DungeonFractionWorkmat.safeState(fractionModel,saved.fractionWork) : undefined;
    let numeratorFromMat=null;
    const previous=saved.numeratorFromMat;
    if(previous && previous.stage===verified.length && previous.value===value && (previous.stage===2 || previous.stage===3)){
      const sum=fractionWork?.sums?.[previous.stage-2];
      if(sum?.status==='verified' && sum.value===value)numeratorFromMat={stage:previous.stage,value};
      else value='';
    }
    const paper=root.DungeonPaper.create(paperDraft,next=>{paperDraft=next;persist();},()=>updateLayout?.());
    const persist=()=>{if(!closed)onDraft?.(snapshot());};
    function snapshot() {return {identity,verified:[...verified],value,hints,errors,hinted,...(paperDraft?{paper:paperDraft}:{}),...(fractionWork?{fractionWork}:{}),...(numeratorFromMat?{numeratorFromMat:{...numeratorFromMat}}:{})};}
    function render(focus=false) {
      const index=verified.length, step=steps[index];
      const operand=fractionModel && (index===2 || index===3) ? fractionModel.operands[index-2] : null;
      const shell=element('article','lc-board');shell.dataset.lessonBoard='';
      shell.dataset.lessonStep=index;
      const head=element('header','lc-head'), top=element('div');
      top.append(element('span','lc-eyebrow','Math workbench'),element('h2','',problem.prompt));
      head.append(top,paper.toggle);
      const body=element('div','lc-body'),left=element('div','lc-visual'), right=element('div',operand?'lc-task lc-numerator-task':'lc-task');
      const earlier=element('ol','lc-record');
      verified.forEach((answer,i)=>{const li=element('li');li.append(element('span','',steps[i].prompt),element('b','',answer));earlier.append(li);});
      function draw() {
        left.replaceChildren();
        const mat=root.DungeonFractionWorkmat.render(problem,index,fractionWork,saveMat,()=>{
          if(!closed && shell.isConnected && index===verified.length)field?.focus();
        });
        const fig=mat || models.model(problem.model,{value,steps,step,verified,set:(next,origin)=>{
          value=next;message='';persist();render();
          if(origin==='grid')host.querySelector('[data-plot]')?.focus({preventScroll:true});
        }});
        left.append(paper.sheet);
        if(fig)left.append(fig);
        if(earlier.children.length) {
          const details=element('details','lc-done');details.open=!fig;
          details.append(element('summary','','My checked work ('+earlier.children.length+')'),earlier);left.append(details);
        }
        updateLayout=()=>{
          left.hidden=!fig && !verified.length && !paper.open;
          body.classList.toggle('lc-single',left.hidden);
        };
        updateLayout();
      }
      const progress=element('div','lc-progress','Step '+(index+1)+' of '+steps.length);
      const label=element('h3','',step.prompt);label.tabIndex=-1;
      right.append(progress,label);
      const group=element('div','lc-entry');let field=null;
      function saveMat(next,event){
        if(closed || !shell.isConnected || index!==verified.length)return;
        fractionWork=next;
        const sum=operand ? next.sums?.[index-2] : null;
        if(numeratorFromMat && (sum?.status!=='verified' || sum.value!==numeratorFromMat.value)){
          if(value===numeratorFromMat.value){value='';field.value='';}
          numeratorFromMat=null;
        }
        if(operand && event?.stage===index){
          if(typeof event.numerator==='string' && sum?.status==='verified' && sum.value===event.numerator && matches(step,event.numerator)){
            value=event.numerator;field.value=value;numeratorFromMat={stage:index,value};message='';announce();
          }else if(event.retry===true)errors++;
        }
        persist();
      }
      function check() {
        if(closed || !shell.isConnected) return;
        if(!value.trim()){message='Enter or choose an answer for this step.';return announce();}
        if(!matches(step,value)){errors++;message='Try this step again. Use the hint if you need a starting point.';persist();announce();field?.select();return;}
        verified.push(value.trim());value='';numeratorFromMat=null;message='';hinted=false;
        if(verified.length===steps.length) {
          paper.finishStroke();closed=true;
          onComplete({answer:problem.solution??verified[verified.length-1],work:verified.map((answer,i)=>({prompt:steps[i].prompt,answer})),
            ...(root.DungeonPaper.hasWork(paperDraft)?{paper:root.DungeonPaper.validPaper(paperDraft)}:{}),
            damage:35,fullyWorked:true,independent:hints===0&&errors===0,hints,errors:{reasoning:errors}});
        } else {persist();render(true);}
      }
      if(step.choices) {
        const choices=element('div','lc-options');choices.setAttribute('role','group');choices.setAttribute('aria-label',step.prompt);
        step.choices.forEach(option=>{
          const b=button(option,'lc-option',()=>{value=option;message='';persist();announce();for(const other of choices.children)other.setAttribute('aria-pressed',String(other===b));});
          b.dataset.lessonChoice=option;b.setAttribute('aria-pressed',String(option===value));choices.append(b);
          b.addEventListener('keydown',event=>{if(event.key==='Enter'&&value===option&&!event.repeat){event.preventDefault();check();}});
        });group.append(choices);
      } else {
        field=element('input','lc-input');field.type='text';field.maxLength=240;field.autocomplete='off';field.spellcheck=false;
        field.dataset.field='lesson-answer';field.value=value;field.setAttribute('aria-label',operand?'Numerator. '+step.prompt:step.prompt);
        if(step.plot)field.placeholder='x, y';
        else if(operand){field.placeholder='Numerator';field.inputMode='numeric';}
        else if(index===0 && fractionModel) field.placeholder='Your estimate';
        else if(step.format==='fraction') field.placeholder='Fraction or mixed number';
        field.addEventListener('input',()=>{numeratorFromMat=null;value=field.value;message='';persist();announce();if(step.plot||step.tick!=null)draw();});
        field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();if(!event.repeat)check();}});
        if(operand) {
          const fraction=element('div','lc-count-fraction');
          const denominator=element('b','lc-fixed-den',fractionModel.den);
          fraction.append(field,element('span','','Total shaded pieces'),denominator,element('span','','Pieces per whole'));
          group.append(fraction);
        } else group.append(field);
      }
      const actions=element('div','lc-actions'), submit=button(index===steps.length-1?'Finish problem':operand?'Submit numerator':'Check step','lc-submit',check);
      submit.dataset.action='check';
      const hint=button('Hint','lc-hint',()=>{if(!hinted){hinted=true;hints++;persist();}message='';announce();});
      hint.dataset.action='hint';actions.append(submit,hint);
      const feedback=element('div','lc-feedback');feedback.setAttribute('role','status');
      function announce(){feedback.textContent=[message,hinted?step.hint:''].filter(Boolean).join(' ');}
      right.append(group,actions,feedback);draw();announce();body.append(left,right);shell.append(head,body);host.replaceChildren(shell);
      if(focus)(field||group.querySelector('button')||label).focus({preventScroll:true});
    }
    render();return {destroy(){paper.finishStroke();closed=true;},getDraft:snapshot};
  }
  const api={mount,matches,model:models?.model};
  root.DungeonLessonBoard=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
