/* Both fresh and previously saved place-value exercises use the same teaching aid. */
(function(root) {
  'use strict';
  const places=['ones','tenths','hundredths','thousandths'];
  const units=['one','tenth','hundredth','thousandth'];
  const values=['1','0.1','0.01','0.001'];

  function digitValue(digit,column) {
    return column === 0 ? digit : '0.'+'0'.repeat(column-1)+digit;
  }

  function make(text,left) {
    const digits=text.replace('.',''), digit=digits[left], right=left+1;
    const worth=i=>digitValue(digit,i);
    const entry=i=>({
      prompt:'Write the value of '+digit+' '+places[i]+' as '+(i?'a decimal.':'a whole number.'),
      answer:worth(i),
      hint:i?'One '+units[i]+' is '+values[i]+'. Start with 0 and a decimal point. Put '+digit+' in the '+places[i]+' column and fill any places before it with zeros.':
        'Each square stands for one whole. Count the shaded squares.'
    });
    return {prompt:'In '+text+', compare the '+places[left]+' and '+places[right]+' digits.',model:{type:'place-value',text,left},steps:[
      entry(left),entry(right),
      {prompt:'How many copies of '+worth(right)+' make '+worth(left)+'?',answer:'10',hint:'Count the small boxes that fill one larger box in the picture.'},
      {prompt:'One '+worth(right)+' is what fraction of '+worth(left)+'?',answer:'1/10',format:'fraction',hint:'The strip has ten equal boxes. Write the fraction for one box out of the whole strip.'}
    ]};
  }
  function fromSaved(problem) {
    if(problem.lessonId!=='place-value'||problem.model)return problem;
    const match=/places of (\d\.\d{1,3})\.$/.exec(problem.prompt);
    if(!match)return problem;
    const text=match[1], updated=make(text,text.length-3);
    if(!problem.steps.every((step,i)=>step.answer===updated.steps[i]?.answer))return problem;
    return {...problem,...updated};
  }
  function view(fig,model,index) {
    const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
    const digits=model.text.replace('.',''),left=model.left, column=left+Math.min(index,1);
    const d=Number(digits[column]);
    const chart=el('div','pv-chart');
    chart.setAttribute('role','group');
    chart.setAttribute('aria-label','Place-value chart for '+model.text);
    Array.from(digits).forEach((digit,i)=>{
      if(i===1)chart.append(el('b','pv-point','.'));
      const active=index<2?i===column:i===left||i===left+1;
      const cell=el('div','pv-column'+(active?' pv-selected':''));
      if(active)cell.setAttribute('aria-current','true');
      cell.append(el('small','',places[i]),el('strong','',digit),el('small','',values[i]+' each'));
      chart.append(cell);
    });
    fig.append(chart);
    const comparison=index>=2;
    const labels=['Each box is one whole','One whole split into ten tenths','One whole split into 100 hundredths',
      'One tenth enlarged and split into 100 thousandths'];
    const label=comparison?'Split the larger value into ten equal parts':labels[column];
    const count=comparison?10:[d,10,100,100][column];
    const picture=el('div','pv-pieces'+(count===100?' pv-square':''));
    picture.setAttribute('aria-hidden','true');
    for(let i=0;i<count;i++)picture.append(el('i',i<(comparison?1:d)?'pv-filled':''));
    fig.append(el('p','pv-label',label),picture);
    const caption=comparison?'The whole strip stands for '+digitValue(digits[left],left)+'. Each small box stands for '+digitValue(digits[left+1],left+1)+'.':
      d+' shaded '+places[column]+'. Read only the highlighted column.';
    fig.append(el('figcaption','',caption));
  }
  const api={make,fromSaved,view};
  root.DungeonPlaceValue=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
