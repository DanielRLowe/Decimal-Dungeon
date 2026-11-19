(function (root) {
  'use strict';
  const modeNames = {guided:'Guided', standard:'Standard', challenge:'Challenge'};
  const books = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M2 4h7l3 2 3-2h7v14h-7l-3 2-3-2H2V4Z" fill="currentColor" opacity=".2"/><path d="M2 4h7l3 2 3-2h7v14h-7l-3 2-3-2H2V4Zm10 3v12M5 8h3m-3 4h4m7-4h3m-4 4h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const bulb = '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M7 12c0-2-2-2.5-2-5a5 5 0 0 1 10 0c0 2.5-2 3-2 5l-.5 1h-5L7 12Zm1 4h4m-3 2h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));

  function estimateSummary(problem) {
    if (!problem || problem.op!=='+' || problem.c==null) return null;
    const plan=root.DungeonMath.analyze(problem);
    const summary=document.createElement('section');
    summary.className='wb-rounding-summary';summary.dataset.estimateSummary='';
    summary.setAttribute('aria-label','Check the two ways to round');
    const rows=[
      ['Round each addend, then add',plan.roundedOperands.join(' + ')+' = '+plan.estimate,'roundedAddends'],
      ['Add first, then round the exact total',plan.answer+' rounds to '+plan.roundedAnswer,'roundedTotal']
    ];
    const list=document.createElement('dl');
    for(const [label,equation,key] of rows){
      const row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');
      term.textContent=label;value.textContent=equation;value.dataset[key]='';
      row.append(term,value);list.append(row);
    }
    summary.append(list);
    if(plan.estimate!==plan.roundedAnswer){
      const note=document.createElement('p');
      const scale=10**plan.precision;
      const gap=Math.abs(plan.estimate*scale-plan.total)/scale;
      note.textContent='Rounding each starting number still gets you close. Your estimate of '+plan.estimate+
        ' is '+gap+' away from the exact sum of '+plan.answer+'.';
      summary.append(note);
    }
    return summary;
  }

  function mount(container, options) {
    const math = root.DungeonMath;
    const p = options.problem;
    const originalPlan = math.analyze(p);
    const originalNumbers = math.operands(p);
    const threeAddends = originalNumbers.length === 3;
    const grouped = p.kind === 'pair' && threeAddends && p.op === '+';
    const signature = [p.world, p.a, p.op, ...originalNumbers.slice(1)].join('/') + (grouped?'/pair':'');
    const offset = p.offset === -1 ? -1 : 1;
    let plan=originalPlan, numbers=originalNumbers, multiple=threeAddends;
    function freshLedger(count, direction) {
      return {shift:direction, shifts:Array.from({length:count},(_,i)=>i===0?0:i===1?direction:-direction),
        activeRow:1, pos:0, zeros:{}, digit:'', transfer:'', final:'',
        steps:{align:false,zeros:false,columns:false,answer:false,estimate:false}};
    }
    function validPair(pair) {
      return Array.isArray(pair) && pair.length===2 && pair[0]!==pair[1] &&
        pair.every(i=>Number.isInteger(i)&&i>=0&&i<originalNumbers.length);
    }
    function stagesForActiveAddition() {
      if (state.stage==='pair') return ['pair'];
      return ['align',...(plan.blanks.length?['zeros']:[]),'columns',...(grouped&&state.pairLeg===1?['subtotal']:['answer','estimate'])];
    }
    function setActivePlan() {
      if (!grouped || !validPair(state.activePair) || state.stage==='pair') {
        numbers=originalNumbers;plan=originalPlan;
      } else {
        const pair=math.pairPlan(p,state.activePair);
        numbers=state.pairLeg===2?[pair.subtotal,pair.remaining]:state.activePair.map(i=>originalNumbers[i]);
        plan=math.analyze({a:numbers[0],b:numbers[1],op:'+'},{firstIsSubtotal:state.pairLeg===2});
      }
      multiple=numbers.length===3;
    }
    const fresh={signature,stage:grouped?'pair':'align',...freshLedger(grouped?2:originalNumbers.length,offset),
      rounded:originalNumbers.map(()=>''),guess:null,hints:0,errors:{},stepHints:{},guide:false,clue:'',message:''};
    if(grouped) Object.assign(fresh,{pairWorkVersion:1,pair:[],activePair:[],pairLeg:0,resumeStage:null,subtotal:'',firstWork:null});
    const saved=options.draft?.signature===signature ? options.draft : null;
    const state=saved?{...fresh,...clone(saved),steps:{...fresh.steps,...saved.steps}}:fresh;
    state.rounded=originalNumbers.map((_,i)=>String(state.rounded?.[i]??'').slice(0,16));
    if(saved&&!Array.isArray(saved.shifts)) state.shifts[1]=state.shift;
    if(grouped && saved && (saved.pairWorkVersion!==1 || (saved.stage!=='pair'&&!validPair(saved.activePair)))) {
      // Previous group spells recorded a typed subtotal, but no checked column work on either addition.
      const chosen=Array.isArray(saved.pair)?saved.pair.filter((i,k,list)=>Number.isInteger(i)&&i>=0&&i<3&&list.indexOf(i)===k).slice(0,2):[];
      Object.assign(state,fresh,{pair:chosen,guide:!!saved.guide,hints:saved.hints||0,errors:{...saved.errors},stepHints:{...saved.stepHints}});
      if(saved.stage!=='pair'&&validPair(chosen)) Object.assign(state,{activePair:[...chosen],pairLeg:1,stage:'align'});
    }
    setActivePlan();
    function earliestWork(work, sheet) {
      if(!work?.steps?.align || !Array.isArray(work.shifts) || work.shifts.length!==sheet.rows.length || work.shifts.some(v=>v!==0)) return 'align';
      if(sheet.blanks.length && (!work.steps.zeros || !math.checkZeros(sheet.blanks,work.zeros||{}))) return 'zeros';
      if(!work.steps.columns || work.pos!==sheet.columns.length) return 'columns';
      return null;
    }
    function subtotalVerified() {
      const work = state.firstWork;
      if (!validPair(state.activePair) || !validPair(work?.pair) ||
          !state.activePair.every((i,k)=>i===work.pair[k])) return false;
      const [a,b]=state.activePair.map(i=>originalNumbers[i]);
      const sheet=math.analyze({a,b,op:'+'});
      return !earliestWork(work,sheet) && work.steps.subtotal && math.sameDecimal(work.subtotal,sheet.answer);
    }
    if (!grouped && saved?.stage==='quick') {
      // Resume independently verified progress and discard the shortcut's answer box.
      state.stage=earliestWork(state,plan)||'answer';
      state.final='';state.steps.answer=false;state.message='';state.clue='';
    }
    delete state.beforeQuick;
    const mode = Object.hasOwn(modeNames,String(options.mode).toLowerCase()) ? String(options.mode).toLowerCase() : 'guided';
    const guided = mode === 'guided';
    const minimal = mode === 'challenge';
    const subtract = p.op === '-';
    const symbol = subtract ? '−' : '+';
    const regroupName = subtract ? 'borrow' : 'carry';
    const equationSpeech = originalNumbers.join(subtract ? ' minus ' : ' plus ');
    const equationHtml = originalNumbers.map(escape).join(' <span>'+symbol+'</span> ');
    let closed = false;
    const paper=root.DungeonPaper?.create(state.paper,next=>{state.paper=next;save();});
    let pointer = null;
    let scrollToEntry = false;

    function save() { if (!closed) options.onDraft?.(clone(state)); }
    function column() { return plan.columns[Math.min(state.pos, plan.columns.length-1)]; }
    function rowName(index) { return index === 0 ? 'Top' : multiple ? (index === 1 ? 'Middle' : 'Bottom') : 'Lower'; }
    function unaligned() { return state.shifts.findIndex((shift,index)=>index>0 && shift!==0); }
    function notifyError(key, message, focusName) {
      state.errors[key] = (state.errors[key] || 0) + 1;
      state.message = message;
      options.onError?.(key);
      save();
      draw(focusName);
    }
    function advance(stage) {
      state.stage = stage;
      state.message = '';
      state.clue = '';
      save();
      draw('stage');
    }
    function finish() {
      if (closed) return;
      const missing=earliestWork(state,plan);
      if(missing) return advance(missing);
      if(!state.steps.answer || !math.sameDecimal(state.final,plan.answer)) return advance('answer');
      if(grouped && (state.pairLeg!==2 || !state.steps.subtotal || !subtotalVerified())) return startLeg(1);
      state.steps.estimate=true;
      paper?.finishStroke();
      closed=true;
      const result={damage:math.spellDamage(state.steps),hints:state.hints,errors:{...state.errors},steps:{...state.steps},
        answer:originalPlan.answer,fullyWorked:true,independent:!state.hints&&!Object.values(state.errors).some(Boolean)};
      if(root.DungeonPaper?.hasWork(state.paper))result.paper=root.DungeonPaper.validPaper(state.paper);
      if(grouped) {
        result.pair=[...state.activePair];
        result.steps.zeros ||= state.firstWork.steps.zeros;
      }
      detach();
      container.innerHTML = '<div class="wb-shell wb-cast" role="status">Problem complete! <strong>' + result.damage + ' power</strong></div>';
      options.onComplete?.(result);
    }

    function startLeg(leg) {
      const direction=leg===1?offset:-offset;
      Object.assign(state,freshLedger(2,direction),{pairLeg:leg,stage:'align',guess:null,rounded:originalNumbers.map(()=>''),resumeStage:null});
      if(leg===1) {state.subtotal='';state.firstWork=null;}
      else state.steps.subtotal=true;
      setActivePlan();
      return advance('align');
    }
    function title() {
      switch (state.stage) {
        case 'pair': return 'Choose two to add first';
        case 'subtotal': return 'Find your first sum';
        case 'align': return 'Line up the decimals';
        case 'zeros': return 'Fill the empty places';
        case 'columns': return (subtract ? 'Subtract' : 'Add') + ' the ' + column().place;
        case 'estimate': return threeAddends?'Round each addend, then add':'Check with an estimate';
        default: return 'Read your answer';
      }
    }
    function borrowHelp(c) {
      const donor = plan.columns.slice(state.pos+1).find(other => other.top > 0);
      const next = plan.columns[state.pos+1];
      if (donor && next && donor.index !== next.index) {
        return 'Borrow from the ' + donor.place + ' through the empty ' + next.place + ' place. Mark a 1 above the next place to track the trade.';
      }
      return 'Borrow one from the next place. That gives you ten more in this column. Mark a 1 above the next place.';
    }
    function instructions() {
      switch (state.stage) {
        case 'pair': return minimal ? 'Select two addends for your first sum.' : 'Pick any two number tiles. Look for a pair that might be easy to add in your head.';
        case 'subtotal': return 'Read your completed columns and write their sum. This subtotal becomes the top number in your next addition.';
        case 'align': return (minimal ? 'Align the decimal points.' : multiple ? 'Move the middle and bottom numbers separately. Line up both gold dots beneath the top dot.' : 'Slide the lower number until its decimal point sits directly under the first one.') + (numbers.some(value=>!value.includes('.')) ? ' A whole number’s decimal point comes after its last digit.' : '');
        case 'zeros': return minimal ? 'Complete the empty decimal places.' : 'Type a placeholder digit in each empty square so all the numbers reach the same place.';
        case 'columns': {
          if (minimal) return 'Fill the result digit and any ' + regroupName + '.';
          const c = column();
          if (guided && c.incoming && plan.rows.every(row => row[c.index] === ' ')) return 'Your carry starts a new place. Write the carried digit below the line.';
          const prior = c.incoming ? (subtract ? ' Take away the 1 already borrowed from this place.' : ' Include the '+c.incoming+' carried into this place.') : '';
          const extra = state.pos < plan.width - 1 ? (subtract ? ' If you need to borrow, mark 1 above the next place.' : multiple ? ' Carry the number of whole tens to the next place.' : ' Carry a 1 above the next column if your total reaches 10.') : '';
          return (guided ? (subtract ? 'Subtract the lower digit from the upper digit.' : multiple ? 'Add all three digits in the highlighted column.' : 'Add the digits in the highlighted column.') + prior + extra : 'Enter the result digit below the line and any ' + regroupName + ' above the next column.');
        }
        case 'answer': return minimal ? 'Write the result as a decimal.' : 'Read your completed work from left to right. Include the decimal point.';
        default: return threeAddends ? 'Round each original addend to the nearest whole number. Then choose the sum of your three rounded numbers.' : 'Round each starting number to the nearest whole number. Then ' + (subtract ? 'subtract' : 'add') + ' the rounded numbers.';
      }
    }
    function hint() {
      if (state.hints >= 3) return;
      const id = (grouped?'leg'+state.pairLeg+'-':'')+(state.stage === 'columns' ? 'c'+state.pos : state.stage);
      const already = state.stepHints[id] || 0;
      let clue;
      switch (state.stage) {
        case 'pair': {
          const pairs=[[0,1],[0,2],[1,2]];
          const trailing=pair=>(math.pairPlan(p,pair).subtotal.split('.')[1]||'').match(/0*$/)[0].length;
          const friendly=pairs.sort((a,b)=>trailing(b)-trailing(a))[0];
          clue=already ? 'Look at '+originalNumbers[friendly[0]]+' and '+originalNumbers[friendly[1]]+'. See how many decimal places become zeros when you add them.' : 'Look for decimal parts that fit together. For example, 0.36 and 0.54 make 0.90. Every pair can work.';
          break;
        }
        case 'subtotal': clue='Trace the decimal point straight down, then read each result digit from left to right.'; break;
        case 'align': {
          const row = state.shifts[state.activeRow] ? state.activeRow : unaligned();
          clue = row < 0 ? 'All decimal points share a vertical line. Check their positions.' : 'Find the gold dots. Move the '+rowName(row).toLowerCase()+' row one place '+(state.shifts[row]>0?'left':'right')+'.';
          break;
        }
        case 'zeros': clue = already ? 'For example, 0.4 and 0.40 both mean four tenths.' : 'A zero after the last decimal digit keeps a number’s value the same.'; break;
        case 'columns': {
          const c = column();
          if (subtract) clue = 'Start with ' + c.top + (c.incoming ? ' minus the 1 already borrowed' : '') + '. ' + (c.outgoing ? borrowHelp(c) : 'There is enough in this place already.') + ' Then take away ' + c.bottom + '.';
          else clue = 'Try ' + c.digits.join(' + ') + (c.incoming ? ' + the carried '+c.incoming : '') + '. ' + (already ? 'Put the ones digit of that total below the line.' : 'Each group of ten becomes one in the next place.');
          break;
        }
        case 'estimate': clue = already ? 'Look at each tenths digit before combining the whole numbers.' : 'Round up when the tenths digit is 5 or more. Otherwise keep the whole number.'; break;
        default: clue = 'The answer’s decimal point belongs directly underneath the other two decimal points.';
      }
      state.stepHints[id] = already + 1;
      state.hints++;
      state.clue = clue;
      state.message = '';
      options.onHint?.(state.stage);
      save();
      draw('hint');
    }

    function check() {
      if (closed) return;
      switch (state.stage) {
        case 'pair': {
          if(state.pair.length!==2) {state.message='Choose two of the three numbers first.';save();return draw('choice');}
          const same=validPair(state.activePair)&&state.pair.every(i=>state.activePair.includes(i));
          if(same && state.resumeStage) {
            state.pair=[...state.activePair];state.stage=state.resumeStage;state.resumeStage=null;
            setActivePlan(); return advance(state.stage);
          }
          state.activePair=[...state.pair];
          return startLeg(1);
        }
        case 'subtotal': {
          const missing=earliestWork(state,plan);
          if(missing)return advance(missing);
          if(!state.subtotal.trim()) { state.message='Enter the sum shown below the line.';save();return draw('subtotal'); }
          if(!math.sameDecimal(state.subtotal,plan.answer)) return notifyError('answer','Check the decimal point and read the digits below the line from left to right.','subtotal');
          state.firstWork={pair:[...state.activePair],shifts:[...state.shifts],zeros:{...state.zeros},pos:state.pos,
            steps:{...state.steps,subtotal:true},subtotal:state.subtotal};
          return startLeg(2);
        }
        case 'align': {
          const row=unaligned();
          if (row!==-1) {
            state.activeRow=row;
            return notifyError('align','Move the '+rowName(row).toLowerCase()+' row until its gold point lines up with the top one.','align');
          }
          state.steps.align = true;
          return advance(plan.blanks.length ? 'zeros' : 'columns');
        }
        case 'zeros':
          if (!math.checkZeros(plan.blanks, state.zeros)) {
            const wrong = plan.blanks.find(b => state.zeros[b.row+'-'+b.index] !== '0');
            return notifyError('zeros','Use a digit that keeps the number’s value the same when you add it at the end.','z'+wrong.row+'-'+wrong.index);
          }
          state.steps.zeros = true;
          return advance('columns');
        case 'columns': {
          const c = column();
          if (!/^\d$/.test(state.digit)) {
            state.message = 'Enter one result digit in the highlighted square below the line.';
            save(); return draw('digit');
          }
          const report = math.checkColumn(c, state.digit, state.transfer);
          if (report.error === 'regroup') {
            const clue = c.outgoing
              ? (subtract ? borrowHelp(c) : c.outgoing===2 ? 'Your total makes two groups of ten. Put a 2 in the carry box above the next place.' : 'Your total makes one group of ten. Put a 1 in the carry box above the next place.')
              : 'This column needs no ' + regroupName + '. Leave the little box empty or enter 0.';
            return notifyError('regroup', clue, 'transfer');
          }
          if (!report.ok) {
            const clue = subtract ? 'Check the two digits in this place. Include any borrowing before you subtract.' : 'Add every digit in this column and any number carried in. Put the ones digit of that total below the line.';
            return notifyError('columns',clue,'digit');
          }
          state.pos++;
          state.digit = ''; state.transfer = ''; state.clue = ''; state.message = '';
          if (state.pos === plan.columns.length) { state.steps.columns = true; return advance(grouped && state.pairLeg===1?'subtotal':'answer'); }
          save(); return draw('digit');
        }
        case 'answer':
          if (!state.final.trim()) { state.message = 'Enter your decimal answer first.'; save(); return draw('final'); }
          if (!math.sameDecimal(state.final,plan.answer)) return notifyError('answer','Check the decimal point and read each place from left to right. You can try again.','final');
          state.steps.answer = true;
          return advance('estimate');
        case 'estimate': {
          if (threeAddends) {
            const missing=state.rounded.findIndex(value=>!value.trim());
            if (missing!==-1) {state.message='Round '+originalNumbers[missing]+' to the nearest whole number first.';save();return draw('rounded'+missing);}
            const wrong=state.rounded.findIndex((value,i)=>!math.sameDecimal(value,originalPlan.roundedOperands[i]));
            if (wrong!==-1) return notifyError('estimate','Check the tenths digit of '+originalNumbers[wrong]+'. A digit of 5 or more rounds up.','rounded'+wrong);
          }
          if (state.guess === null) { state.message = 'Choose your estimate first.'; save(); return draw('estimate'); }
          if (state.guess !== originalPlan.estimate) {
            const triedRoundedTotal=threeAddends && state.guess===originalPlan.roundedAnswer;
            const message=triedRoundedTotal ? originalPlan.answer+' does round to '+originalPlan.roundedAnswer+
              '. Here you rounded each addend first. What is '+originalPlan.roundedOperands.join(' + ')+'?' :
              threeAddends ? 'Your rounded addends are correct. Add those three whole numbers and choose their total.' :
                'Round each number separately first. A tenths digit of 5 or more rounds the whole number up.';
            return notifyError('estimate',message,'estimate');
          }
          return finish();
        }
      }
    }

    function input(name, value, label, extraClass = '', placeholder = '') {
      return '<input class="wb-digit-input ' + extraClass + '" data-field="' + name + '" aria-label="' + escape(label) + '" value="' + escape(value) + '" placeholder="' + placeholder + '" inputmode="numeric" maxlength="1" autocomplete="off" autocapitalize="off" spellcheck="false">';
    }
    function fieldCell(content, i, more = '') {
      const dot = i === plan.wholeWidth - 1 && plan.precision ? '<span class="wb-dot" aria-hidden="true">.</span>' : '';
      return '<span class="wb-cell ' + more + '">' + content + dot + '</span>';
    }
    function pairBoard() {
      const tiles=originalNumbers.map((v,i)=>{
        const chosen=state.pair.includes(i);
        return '<button type="button" data-action="pick-addend" data-index="'+i+'" aria-pressed="'+chosen+'" aria-label="'+(chosen?'Deselect ':'Select ')+escape(v)+'" '+(!chosen&&state.pair.length===2?'disabled':'')+'>'+escape(v)+'</button>';
      }).join('');
      const note=state.pair.length===2 ? 'Set aside '+originalNumbers[[0,1,2].find(i=>!state.pair.includes(i))]+' for the last step.' : state.pair.length===1 ? 'Choose one more number.' : 'Choose two numbers';
      return '<div class="wb-board wb-group-board"><div class="wb-pair-tiles" role="group" aria-label="Choose two addends">'+tiles+'</div><p class="wb-group-note" role="status">'+escape(note)+'</p></div>';
    }
    function legContext() {
      if(!grouped || state.stage==='pair') return '';
      const chosen=state.activePair.map(i=>originalNumbers[i]), work=math.pairPlan(p,state.activePair);
      const first=state.pairLeg===1;
      const note=first?'Set aside '+work.remaining+'.':'Your subtotal · '+chosen.join(' + ')+' = '+work.subtotal;
      return '<div class="wb-leg-context"><strong>'+(first?'First addition':'Second addition')+'</strong><span>'+escape(numbers.join(' + '))+'</span><p data-pair-note>'+escape(note)+'</p></div>';
    }
    function board() {
      if(state.stage==='pair') return pairBoard();
      const step = state.stage;
      const canMove = step === 'align';
      const c = column();
      function numberRow(rowNumber) {
        const cells = plan.rows[rowNumber].map((d, i) => {
          const missing = d === ' ' && i >= plan.wholeWidth;
          const z = rowNumber + '-' + i;
          let value = d === ' ' ? '' : d;
          if (missing && step === 'zeros') value = input('z'+z, state.zeros[z] || '', rowName(rowNumber) + ' number, '+ plan.columns[plan.width-1-i].place+' placeholder', 'wb-placeholder','·');
          if (missing && state.steps.zeros) value = '0';
          const hasTile = d !== ' ' || (missing && (step === 'zeros' || state.steps.zeros));
          const classes = (hasTile ? 'wb-tile ' : '') + (missing && state.steps.zeros ? 'wb-filled ' : '') + (step === 'columns' && c.index === i ? 'wb-active-col' : '');
          return fieldCell(value, i, classes);
        }).join('');
        const moveable = rowNumber > 0 && canMove;
        const shift = moveable ? state.shifts[rowNumber] : 0;
        const moveAttrs = moveable ? ' data-slide="'+rowNumber+'" tabindex="0" role="slider" aria-label="'+rowName(rowNumber)+' number position. Use the left and right arrow keys." aria-valuemin="-1" aria-valuemax="1" aria-valuenow="'+shift+'" aria-valuetext="'+(shift === 0 ? 'Middle' : shift < 0 ? 'Left' : 'Right')+' position"' : '';
        return '<div class="wb-lane" data-operand-row="'+rowNumber+'">'+(rowNumber === numbers.length-1 ? '<span class="wb-operator" aria-hidden="true">'+symbol+'</span>' : '') +
          '<div class="wb-row' + (moveable ? ' wb-movable' : '') + '" style="--shift:'+shift+'"'+moveAttrs+'>' + cells + '</div></div>';
      }
      const solvedCount = state.pos;
      const doneCols = plan.columns.slice(0,solvedCount);
      const carryRow = plan.rows[0].map((_,i) => {
        const known = doneCols.find(x => x.index === i+1);
        let content = '';
        if (known && known.outgoing) content = '<span class="wb-carry-done">'+known.outgoing+'</span>';
        if (step === 'columns' && i === c.index-1) content = input('transfer',state.transfer,(subtract ? 'Borrow from ' : 'Carry into ') + plan.columns[plan.width-1-i].place,'wb-carry','·');
        return '<span class="wb-cell wb-note-cell">'+content+'</span>';
      }).join('');
      const result = plan.rows[0].map((_,i) => {
        const done = doneCols.find(x=>x.index === i);
        const active = step === 'columns' && c.index === i;
        const value = active ? input('digit', state.digit, 'Result digit in the '+c.place+' column','wb-result-input','?') : done ? done.digit : '';
        return fieldCell(value, i, 'wb-result ' + (active ? 'wb-current' : done ? 'wb-verified' : 'wb-unfilled'));
      }).join('');
      const guide = guided || state.guide;
      const labels = plan.columns.slice().reverse().map(c => {
        const exponent = plan.wholeWidth - c.index - 1;
        const value = exponent >= 0 ? '1'+'0'.repeat(exponent) : '0.'+'0'.repeat(-exponent-1)+'1';
        return '<span title="'+c.place+'" aria-label="'+c.place+', place value '+value+'">'+value+'</span>';
      }).join('');
      const toggle = mode === 'standard' ? '<button class="wb-guide-btn" type="button" data-action="guide" aria-pressed="'+guide+'">'+(guide?'Hide':'Show')+' place guide</button>' : '';
      const sliders = canMove ? plan.rows.slice(1).map((_,i)=>{
        const row=i+1, label=rowName(row), direction=state.shifts[row];
        return '<div class="wb-sliders" role="group" aria-label="Move '+label.toLowerCase()+' number">'+
          (multiple?'<span class="wb-slider-label">'+label+' row</span>':'')+
          '<button type="button" data-action="left" data-row="'+row+'" aria-label="Move '+label.toLowerCase()+' number left" '+(direction===-1?'disabled':'')+'><span aria-hidden="true">‹</span> Left</button>'+
          '<button type="button" data-action="right" data-row="'+row+'" aria-label="Move '+label.toLowerCase()+' number right" '+(direction===1?'disabled':'')+'>Right <span aria-hidden="true">›</span></button></div>';
      }).join('') : '';
      return '<div class="wb-board'+(multiple||grouped?' wb-multi-board':'')+(plan.precision>=4?' wb-wide-places':'')+'" style="--n:'+plan.width+'"><span class="wb-sr">Problem: '+escape(numbers.join(subtract?' minus ':' plus '))+'</span>' +
        '<div class="wb-grid'+(guide?' wb-guided':'')+'" style="--wb-whole:'+plan.wholeWidth+'">' + (guide && (mode === 'standard' || !canMove) ? '<div class="wb-places">'+labels+'</div>' : '') +
        (step === 'columns' || solvedCount ? '<div class="wb-row wb-carries">'+carryRow+'</div>' : '') +
        plan.rows.map((_,row)=>numberRow(row)).join('') + '<div class="wb-line"></div><div class="wb-row wb-result-row">'+result+'</div></div>' +
        (sliders?'<div class="wb-row-controls">'+sliders+'</div>':'')+toggle+'</div>';
    }
    function estimateChoices() {
      const n = originalPlan.estimate;
      const candidates = [Math.max(0,n-2), Math.max(0,n-1),n,n+1,n+2];
      const lower = Number(p.a.replace('.','').slice(-1)) % 3;
      const choices = threeAddends ? [n, originalPlan.roundedAnswer] : [n];
      const set = [...new Set([...choices,candidates[lower],candidates[lower+1],n+2,n+1,n+3])].slice(0,3).sort((a,b)=>a-b);
      const rounding = threeAddends ? '<div class="wb-rounding">'+originalNumbers.map((value,i)=>
        '<label>'+escape(value)+'<input data-field="rounded'+i+'" aria-label="Round '+escape(value)+' to the nearest whole number" value="'+escape(state.rounded[i])+'" inputmode="numeric" maxlength="16" autocomplete="off" placeholder="?"></label>'
      ).join('<span aria-hidden="true">+</span>')+'</div>' : '';
      return rounding+(threeAddends?'<p class="wb-estimate-question">What is the sum of your three whole numbers?</p>':'')+'<div class="wb-estimates" role="group" aria-label="Choose an estimate">'+set.map(v=>'<button type="button" aria-pressed="'+(state.guess===v)+'" data-guess="'+v+'">'+v+'</button>').join('')+'</div>';
    }
    function draw(focusName) {
      if (closed) return;
      const s = state.stage;
      const stages = stagesForActiveAddition();
      const stageNumber = stages.indexOf(s)+1;
      const progress = s==='pair' ? 'Choose your grouping' : 'Step '+stageNumber+' of '+stages.length;
      const columnCount = s==='columns' ? '<span class="wb-column-count">Column '+(state.pos+1)+' of '+plan.columns.length+'</span>' : '';
      const action = {pair:'Use this pair',subtotal:'Check subtotal',align:'Check alignment', zeros:'Check zeros',columns:'Check column',answer:'Check answer',estimate:'Check estimate'}[s];
      const buttonHtml = '<button type="button" class="wb-primary" data-action="check" '+(s==='pair'&&state.pair.length!==2?'disabled':'')+'>'+action+'</button>';
      const extra = grouped && s!=='pair' ? '<button type="button" class="wb-text-btn" data-action="change-pair">Change pair</button>' : '';
      const answerField=s==='subtotal'?'subtotal':'final',answerLabel=s==='subtotal'?'Your subtotal':'Your answer';
      const entry = ['answer','subtotal'].includes(s) ? '<input class="wb-final" data-field="'+answerField+'" inputmode="decimal" aria-label="'+answerLabel+'" placeholder="'+answerLabel+'" autocomplete="off" maxlength="18" value="'+escape(state[answerField])+'">' : '';
      const dots = s === 'pair' ? '' : '<div class="wb-dots" aria-hidden="true">' + stages.map((k,i)=>'<i class="'+(i+1 === stageNumber ? 'wb-here' : i+1<stageNumber ? 'wb-done' : '')+'"></i>').join('') + '</div>';
      container.innerHTML = '<section class="wb-shell" aria-label="Math workbench" data-stage="'+s+'"'+(grouped?' data-pair-leg="'+state.pairLeg+'"':'')+'><header class="wb-header"><div class="wb-title-group"><span class="wb-book">'+books+'</span><div><h2>Math workbench</h2><p class="wb-equation" aria-label="'+escape(equationSpeech)+'">'+equationHtml+'</p></div></div>' +
        '<div class="wb-tools"><span class="wb-mode">'+modeNames[mode]+'</span>' +
        '<button type="button" class="wb-hint" data-action="hint" '+(state.hints>=3?'disabled':'')+' aria-label="Get a hint, '+(3-state.hints)+' remaining">'+bulb+'<span>Hint</span><span class="wb-hint-count">'+(3-state.hints)+'</span></button></div></header>' +
        legContext()+'<div class="wb-body"><div class="wb-paper-column">'+board()+'</div><div class="wb-task"><div class="wb-step">'+dots+'<span>'+progress+'</span>'+columnCount+'</div>' +
        '<h3 data-stage-heading tabindex="-1">'+title()+'</h3><p class="wb-instructions">'+instructions()+'</p>'+entry+(s==='estimate'?estimateChoices():'') +
        '<div class="wb-feedback" role="status" aria-live="polite">'+(state.message?'<p class="wb-msg">'+escape(state.message)+'</p>':'')+(state.clue?'<p class="wb-clue">'+bulb+escape(state.clue)+'</p>':'')+'</div>' +
        '<div class="wb-actions">'+buttonHtml+extra+'</div></div></div></section>';
      if(paper){
        container.querySelector('.wb-tools').prepend(paper.toggle);
        container.querySelector('.wb-paper-column').append(paper.sheet);
      }
      if (focusName === 'stage') {
        if (s === 'align') focusName='align';
        else if (s === 'columns') focusName = 'digit';
        else if (s === 'answer') focusName = 'final';
        else if (s === 'pair') focusName='choice';
        else if (s === 'subtotal') focusName='subtotal';
        else if (s === 'zeros') focusName = 'z'+plan.blanks[0].row+'-'+plan.blanks[0].index;
        else if (s === 'estimate' && threeAddends) focusName = 'rounded0';
      }
      let selector = focusName === 'align' ? '[data-slide="'+state.activeRow+'"]' : focusName === 'estimate' ? '[data-guess]' :
        focusName === 'stage' ? '[data-stage-heading]' : focusName === 'hint' ? '[data-action="hint"]:not([disabled])' :
        ['left','right'].includes(focusName) ? '[data-action="'+focusName+'"][data-row="'+state.activeRow+'"]:not([disabled])' :
        focusName==='guide' ? '[data-action="guide"]' :
        focusName==='choice' ? '[data-action="pick-addend"]:not([disabled])' :
        focusName?.startsWith('choice-') ? '[data-action="pick-addend"][data-index="'+focusName.slice(7)+'"]' :
        focusName ? '[data-field="'+focusName+'"]' : '';
      if (selector) {
        const target = container.querySelector(selector) || (s==='align' && container.querySelector('[data-slide="'+state.activeRow+'"]')) || container.querySelector('[data-stage-heading]');
        if (target) { target.focus({preventScroll:!scrollToEntry}); if (target.tagName === 'INPUT') target.select(); }
      }
      scrollToEntry = false;
    }
    function move(by, focus, row=state.activeRow) {
      if (state.stage !== 'align') return;
      if (!Number.isInteger(row) || row<=0 || row>=numbers.length) return;
      state.activeRow=row; state.shifts[row]=Math.max(-1,Math.min(1,state.shifts[row]+by));
      state.shift=state.shifts[1]; state.message=''; state.clue=''; save(); draw(focus);
    }
    function click(e) {
      const b = e.target.closest('button');
      if (!b || !container.contains(b) || closed) return;
      if (state.stage==='estimate' && b.hasAttribute('data-guess')) { state.guess=Number(b.dataset.guess); state.message=''; save(); draw(); container.querySelector('[data-guess][aria-pressed="true"]')?.focus({preventScroll:true}); return; }
      switch (b.dataset.action) {
        case 'pick-addend': {
          if(state.stage!=='pair')return;
          const i=Number(b.dataset.index);
          if(!Number.isInteger(i)||i<0||i>2)return;
          if(state.pair.includes(i))state.pair=state.pair.filter(x=>x!==i);
          else if(state.pair.length<2)state.pair.push(i);
          state.clue='';state.message='';save();return draw('choice-'+i);
        }
        case 'change-pair': {
          if(!grouped || state.stage==='pair')return;
          state.resumeStage=state.stage;state.pair=[...state.activePair];state.stage='pair';
          setActivePlan();return advance('pair');
        }
        case 'check': scrollToEntry=true; return check();
        case 'hint': return hint();
        case 'guide': state.guide=!state.guide; save(); return draw('guide');
        case 'left': return move(-1,'left',b.dataset.row ? Number(b.dataset.row):state.activeRow);
        case 'right': return move(1,'right',b.dataset.row ? Number(b.dataset.row):state.activeRow);

      }
    }
    function handleInput(e) {
      const name = e.target.dataset.field;
      if (!name) return;
      const wholeField=name.startsWith('rounded');
      const value = name === 'final' || name==='subtotal' ? e.target.value : wholeField ? e.target.value.slice(0,16) : e.target.value.replace(/[^0-9]/g,'').slice(-1);
      e.target.value = value;
      if (name.startsWith('z')) state.zeros[name.slice(1)] = value;
      else if (wholeField) state.rounded[Number(name.slice(7))]=value;
      else if (['digit','transfer','final','subtotal'].includes(name)) state[name] = value;
      state.message=''; container.querySelector('.wb-msg')?.remove(); save();
    }
    function key(e) {
      if (e.target.hasAttribute('data-slide') && ['ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault(); return move(e.key==='ArrowLeft'?-1:1,'align',Number(e.target.dataset.slide));
      }
      if (e.target.hasAttribute('data-slide') && e.key==='Enter' && !e.isComposing) {
        e.preventDefault(); if(!e.repeat) check(); return;
      }
      if (e.key==='Enter' && e.target.dataset.field && !e.isComposing) {
        e.preventDefault();
        if (e.target.dataset.field.startsWith('z')) {
          const unfilled = plan.blanks.find(b => !state.zeros[b.row+'-'+b.index]);
          if (unfilled && e.target.value) { container.querySelector('[data-field="z'+unfilled.row+'-'+unfilled.index+'"]').focus(); return; }
        }
        if (e.target.dataset.field.startsWith('rounded') && e.target.value) {
          const empty=state.rounded.findIndex(value=>!value.trim());
          if (empty!==-1) {container.querySelector('[data-field="rounded'+empty+'"]').focus();return;}
          if (state.guess===null) {container.querySelector('[data-guess]').focus();return;}
        }
        check();
      }
    }
    function startDrag(e) {
      const row = e.target.closest('[data-slide]');
      if (!row || e.button!==0) return;
      pointer = {id:e.pointerId,x:e.clientX,width:row.getBoundingClientRect().width/plan.width,row:Number(row.dataset.slide)};
      row.setPointerCapture?.(e.pointerId);
    }
    function endDrag(e) {
      if (!pointer || pointer.id!==e.pointerId) return;
      const d = (e.clientX-pointer.x)/pointer.width, row=pointer.row; pointer=null;
      if (Math.abs(d)>.4) move(Math.sign(d)*Math.max(1,Math.round(Math.abs(d))),'align',row);
    }
    function cancelDrag() {pointer=null;}
    const listeners = {click, input:handleInput, keydown:key, pointerdown:startDrag, pointerup:endDrag, pointercancel:cancelDrag};
    function detach() { for (const [type, fn] of Object.entries(listeners)) container.removeEventListener(type,fn); }
    for (const [type,fn] of Object.entries(listeners)) container.addEventListener(type,fn);
    draw();
    return {getDraft:()=>clone(state), destroy:()=>{paper?.finishStroke();closed=true;detach();}};
  }
  root.MathWorkbench = {mount,estimateSummary};
})(globalThis);
