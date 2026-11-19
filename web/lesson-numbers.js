// Original practice aligned to the 2021 Tennessee fifth-grade mathematics standards.
(function (root, factory) {
  const catalogue = factory();
  root.DungeonNumberLessons = catalogue;
  if (typeof module === 'object' && module.exports) module.exports = catalogue;
})(globalThis, function () {
  'use strict';
  const OA = 'Expressions and patterns', NBT = 'Base ten and decimals', NF = 'Fractions';
  const lessons = [];
  function lesson(id,title,domain,codes,intro,worked,generate) {
    lessons.push({id,title,domain,codes,tutorial:{intro,steps:worked},
      make(level,index,rng=Math.random) {
        const pick=(lo,hi)=>lo+Math.floor(rng()*(hi-lo+1));
        return generate(level,index,pick,rng);
      }});
  }
  const step=(prompt,answer,hint)=>({prompt,answer:String(answer),hint});
  const fraction=(prompt,answer,hint)=>({...step(prompt,answer,hint),format:'fraction'});
  function select(prompt,answer,others,hint,k) {
    const choices=[...new Set([String(answer),...others.map(String)])];
    const shift=k%choices.length;
    return {...step(prompt,answer,hint),choices:choices.slice(shift).concat(choices.slice(0,shift))};
  }
  function gcd(a,b){return b?gcd(b,a%b):a;}
  function ratio(n,d){const g=gcd(Math.abs(n),d);return d===g?String(n/g):(n/g)+'/'+(d/g);}
  function mixed(n,d){const whole=Math.floor(n/d), r=n%d;return r?(whole?whole+' ':'')+ratio(r,d):String(whole);}
  function dec(n,places,trim=false) {
    if(!places)return String(n);
    const digits=String(n).padStart(places+1,'0');
    const text=digits.slice(0,-places)+'.'+digits.slice(-places);
    return trim?text.replace(/0+$/,'').replace(/\.$/,''):text;
  }
  function word(n){
    const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    if(n<20)return small[n];
    if(n<100)return ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'][Math.floor(n/10)]+(n%10?'-'+small[n%10]:'');
    return small[Math.floor(n/100)]+' hundred'+(n%100?' '+word(n%100):'');
  }
  const places=['ones','tenths','hundredths','thousandths'];
  const names=['whole','tenth','hundredth','thousandth'];
  const line=(min,max,value)=>({type:'numberline',min,max,value});
  const bars=(items)=>({type:'bars',bars:items});
  const bar=(label,numerator,denominator)=>({label,numerator,denominator});
  function proper(den,pick) {
    const ns=Array.from({length:den-1},(_,i)=>i+1).filter(n=>gcd(n,den)===1);
    return ns[pick(0,ns.length-1)];
  }
  // Round to the nearest half, counting halves. Exact ties go up.
  const halves=(n,d)=>Math.floor((4*n+d)/(2*d));
  function table(headers,rows,caption){return {type:'table',headers,rows:rows.map(r=>r.map(String)),caption};}

  lesson('expressions-order','Order of operations',OA,['5.OA.A.1'],
    'Work from the innermost group out. Within a group, multiply or divide from left to right before adding or subtracting from left to right.',
    ['For 3 + [(7 + 5) × 2 − 4] ÷ 5, the parentheses give 12.',
     'Inside the brackets, 12 × 2 = 24 and 24 − 4 = 20.',
     'Outside the brackets, divide first. The answer is 3 + 20 ÷ 5 = 7.'],
    (level,i,pick)=>{
      const a=pick(3,9+level*4), b=pick(2,8), k=pick(2,5), m=pick(2,5);
      const grouped=a+b;
      if(level===1)return {prompt:'Evaluate '+k+' × ('+a+' + '+b+').',steps:[
        step('What is the sum inside the parentheses?',grouped,'Do the grouped addition first.'),
        step('Multiply that sum by '+k+'.',grouped*k,'There are '+k+' equal groups of your sum.')]};
      if(level===2){
        const part=pick(2,6), sub=part*m;
        return {prompt:'Evaluate '+k+' × ('+a+' + '+b+') − '+sub+' ÷ '+m+'.',steps:[
          step('Evaluate the parentheses.',grouped,'Start with the addition inside the curved brackets.'),
          step('What is the product before the subtraction?',grouped*k,'Multiply the first factor by the grouped sum.'),
          step('What is '+sub+' ÷ '+m+'?',part,'Do the division before subtracting.'),
          step('Now find the difference.',grouped*k-part,'Subtract the quotient from the product.')]};
      }
      const initial=pick(4,15),cut=pick(1,4)*m,factor=k*m,inside=grouped*factor-cut;
      return {prompt:'Evaluate '+initial+' + [('+a+' + '+b+') × '+factor+' − '+cut+'] ÷ '+m+'.',steps:[
        step('What is the innermost sum?',grouped,'The parentheses are inside the square brackets.'),
        step('Multiply the sum by '+factor+'.',grouped*factor,'Multiplication comes before subtraction.'),
        step('What is the value of the entire bracket?',inside,'Subtract '+cut+' from the product.'),
        step('Divide the bracket value by '+m+'.',inside/m,'Finish the division before adding the first number.'),
        step('What is the complete expression worth?',initial+inside/m,'Add '+initial+' to the quotient.')]};
    });

  lesson('expressions-write','Write and interpret expressions',OA,['5.OA.A.2'],
    'Write the calculation the story describes. Parentheses keep quantities together. You can often describe a result without calculating it.',
    ['A tray holds 8 blue and 5 green tiles. One tray has 8 + 5 tiles.',
     'Four identical trays give the expression 4 × (8 + 5). You can type 4*(8+5).',
     'That expression is four times the number on a single tray. You know this from the factor 4.'],
    (level,i,pick)=>{
      const a=pick(8,level===3?99:24),b=pick(2,7),k=pick(2,level+4), subtract=level>1&&i%2===1;
      const sign=subtract?'−':'+',inside=a+' '+sign+' '+b, form=k+' × ('+inside+')';
      const expr=subtract?[a+'-'+b]:[a+'+'+b,b+'+'+a];
      const expressions=[];
      for(const inner of expr)for(const mult of ['*','x','×'])for(const [open,close] of [['(',')'],['[',']']]){
        expressions.push(k+mult+open+inner+close,open+inner+close+mult+k);
      }
      const question=subtract?'Each rack begins with '+a+' books. You lend '+b+' books from each of '+k+' identical racks.':'Each rack holds '+a+' large books and '+b+' small books. There are '+k+' identical racks.';
      return {solution:form,prompt:question+' Write an expression for the total books '+(subtract?'left on':'on')+' the racks.',steps:[
        select('Which expression describes one rack?',inside,[a+' × '+b,subtract? a+' + '+b : a+' − '+b],'Consider just one rack before counting all racks.',i+level),
        {prompt:'Type the expression for all racks. Use parentheses and * for multiplication.',answer:expressions,hint:'Put the one-rack expression inside parentheses. Multiply the group by the number of racks.'},
        step('Without evaluating '+form+', how many times as large is it as the one-rack quantity?',k,'Count the copies of the same parenthesized quantity.')]};
    });

  lesson('pattern-pairs','Two patterns on a graph',OA,['5.OA.B.3','5.OA.B.3.a','5.OA.B.3.b'],
    'Apply each rule once per turn. Match terms from the same turn to make a point. The first rule gives x and the second gives y.',
    ['Start x at 1 and add 1. Start y at 2 and add 2. After one move the terms are 2 and 4.',
     'The next pair is (3, 6). The y value is twice the x value.',
     'To graph (3, 6), travel 3 units right and then 6 units up from the origin.'],
    (level,i,pick)=>{
      const start=level===1?0:pick(1,2),dx=level===1?pick(1,2):1,r=level===2?pick(2,3):2,offset=level===3?pick(1,3):0;
      const y0=r*start+offset,x1=start+dx,y1=y0+r*dx,x2=x1+dx,y2=y1+r*dx;
      const rule=r+' times x'+(offset?' plus '+offset:'');
      return {prompt:'Start x at '+start+' and add '+dx+' each turn. Start y at '+y0+' and add '+(dx*r)+' each turn.',model:{type:'coordinates',max:12,points:[[start,y0,'Start']]},steps:[
        step('After one turn, what is x?',x1,'Apply the first rule once.'),
        step('After the same turn, what is y?',y1,'Apply the second rule once to its starting value.'),
        select('Which rule links y to x at every turn?',rule,[r+' times x'+(offset?'':' plus 1'),'x plus '+(offset+1)],'Test both the starting pair and the pair after one turn.',i+1),
        {prompt:'Apply both rules once more. Plot the new (x, y) point.',answer:x2+','+y2,plot:true,hint:'Move right by the new x and up by the new y. Match terms from the same turn.'}]};
    });

  lesson('place-value','What a digit is worth',NBT,['5.NBT.A.1'],
    'Moving a digit one place left makes its value ten times as large. One place right makes its value one tenth as large.',
    ['In 4.44, the first 4 is 4 ones. The next 4 is 4 tenths, or 0.4.',
     'The final 4 is 4 hundredths, or 0.04. Ten copies of 0.04 make 0.4.'],
    (level,i,pick)=>{
      const d=pick(2,9), left=level-1,right=level;
      const text=left===0?d+'.'+d:pick(1,8)+'.'+(left===2?pick(1,8):'')+d+d;
      return {prompt:'Compare the digit '+d+' in the '+places[left]+' and '+places[right]+' places of '+text+'.',steps:[
        step('What is its value in the '+places[left]+' place?',dec(d,left),'Multiply the digit by the value of its column.'),
        step('What is its value one column to the right?',dec(d,right),'Each column to the right is one tenth as large.'),
        step('How many copies of the smaller value make the larger one?',10,'One place-value unit can be traded for ten of the next smaller unit.'),
        fraction('What fraction of the larger value is the smaller value?','1/10','Write the part represented by one of those ten equal copies.')]};
    });

  lesson('powers-of-ten','Powers of ten',NBT,['5.NBT.A.2'],
    'The exponent counts factors of ten. Multiplying by ten shifts each digit one place left in a place-value chart. Dividing shifts each digit one place right.',
    ['10³ means 10 × 10 × 10, or 1,000. So 24 × 10³ = 24,000.',
     'In 3.56 × 10², 3 ones become 3 hundreds. The result is 356.',
     'For 356 ÷ 10², the digits move back two places. The result is 3.56.'],
    (level,i,pick)=>{
      const exp=level,pow=10**exp, sym='10'+['','¹','²','³'][exp],whole=pick(12,88),mode=i%3;
      const raw=pick(125,895), source=mode===0?String(whole):mode===1?dec(raw,level):dec(raw,3-exp);
      const result=mode===0?String(whole*pow):mode===1?String(raw):dec(raw,3);
      const dividing=mode===2;
      const steps=[step('In '+sym+', how many factors of ten are multiplied?',exp,'The small raised exponent counts the factors.'),
        step('Write '+sym+' as an ordinary whole number.',pow,'Start at 1 and multiply by ten once for every factor.')];
      steps.push(mode===0?step('How many extra zeros go after '+source+' in the product?',exp,'Each whole-number multiplication by ten appends one zero.'):
        select('Which way do the digits move on a fixed place-value chart?',dividing?'Right':'Left',[dividing?'Left':'Right','Stay in place'],'A larger result puts the same digits in larger-value places.',i));
      steps.push(step('Calculate '+source+(dividing?' ÷ ':' × ')+sym+'.',result,'Move every digit the same number of places, filling empty columns with zeros.'));
      return {prompt:'Track the place values in '+source+(dividing?' ÷ ':' × ')+sym+'.',steps};
    });

  lesson('decimal-forms','Read and write decimals',NBT,['5.NBT.A.3'],
    'The word “and” separates the whole number from its fraction. The last decimal place names the size of the pieces.',
    ['Sixteen and forty-two thousandths is 16.042. The 4 belongs in the hundredths column.',
     'The expanded expression is (1 × 10) + (6 × 1) + (0 × 1/10) + (4 × 1/100) + (2 × 1/1000).',
     'Forty-two thousandths and forty-two hundredths have different values. The denominator tells you how many decimal places to write.'],
    (level,i,pick)=>{
      const count=level,scale=10**count,whole=level===1?pick(1,9):pick(12,level===3?299:89);
      const frac=level===3&&i%2===0?pick(11,89):pick(2,scale-1),digits=String(frac).padStart(count,'0');
      const value=whole+'.'+digits,spoken=word(whole)+' and '+word(frac)+' '+places[count];
      const components=[...String(whole)].map((v,k)=>'('+v+' × '+10**(String(whole).length-k-1)+')');
      const expanded=components.concat([...digits].map((v,k)=>'('+v+' × 1/'+10**(k+1)+')')).join(' + ');
      const swapped=expanded.replace(/^(\(\d+ × )(\d+)(\))/,(_,prefix,unit,suffix)=>prefix+(Number(unit)*10)+suffix);
      return {solution:value+' · '+spoken,prompt:i%2===0?'Build the numeral for '+spoken+'.':'Write '+value+' in words and expanded form.',steps:[
        step('How many '+places[count]+' are in the fractional part?',frac,'Read all the digits to the right of the decimal together.'),
        step('Write the complete numeral in standard form.',value,'Leave one digit space for every decimal place, including any needed zero.'),
        select('Choose the complete word form.',spoken,[word(whole)+' and '+word(frac)+' '+places[count===3?2:count+1],word(whole)+' and '+word(frac-1)+' '+places[count]],'Name the decimal part from its final place.',i+2),
        select('Which expanded expression matches the numeral?',expanded,[swapped,'('+whole+' × '+scale+') + '+frac],'Multiply each digit by its place value, then add the parts.',i+level)]};
    });

  lesson('decimal-compare','Compare decimals',NBT,['5.NBT.A.3'],
    'Compare the ones first, then the tenths, hundredths, and thousandths. Trailing zeros can make the places easier to match.',
    ['Compare 2.7 with 2.698 by writing 2.700 above 2.698.',
     'The ones tie. Seven tenths is more than six tenths, so 2.7 > 2.698. The extra digits do not change that comparison.'],
    (level,i,pick)=>{
      const scale=10**level,w=pick(1,16),a=level===1?pick(2,7):pick(2,8)*10**(level-1);
      const b=i%3===0?a:i%3===1?a-1:a+1, left=dec(w*scale+a,level,true),right=dec(w*scale+b,level)+(a===b&&level===1?'0':'');
      const sign=a===b?'=':a<b?'<':'>';
      return {prompt:'Compare '+left+' and '+right+'. Their whole-number parts are equal.',steps:[
        step('How many '+places[level]+' are in the fractional part of '+left+'?',a,'Rewrite both fractional parts using the same-sized unit.'),
        step('How many '+places[level]+' are in the fractional part of '+right+'?',b,'A zero at the end does not change a decimal’s value.'),
        select('Which symbol belongs in '+left+' □ '+right+'?',sign,['<','=','>'],'Compare the two counts in the same unit.',i)]};
    });

  lesson('decimal-round','Round on a number line',NBT,['5.NBT.A.4'],
    'Use the two nearest marks for the requested place. A point below the midpoint rounds to the lower mark. At the midpoint or above it, round up.',
    ['To round 3.746 to hundredths, locate 3.74 and 3.75. Their midpoint is 3.745.',
     '3.746 lies just above the midpoint, so it rounds to 3.75.'],
    (level,i,pick)=>{
      const d=level-1,low=pick(8,32)*10**d+pick(0,10**d-1),tail=i%4===0?5:pick(1,9),v=low*10+tail;
      const lo=dec(low,d),hi=dec(low+1,d),num=dec(v,d+1),mid=dec(low*10+5,d+1);
      return {prompt:'Round '+num+' to the nearest '+(d===0?'whole number':names[d])+'.',model:line(Number(lo),Number(hi),Number(num)),steps:[
        step('What is the lower endpoint?',lo,'Read the mark just below the given number at the requested place.'),
        step('What number is halfway between '+lo+' and '+hi+'?',mid,'The midpoint is five units of the next smaller place above the lower endpoint.'),
        select('Where does '+num+' lie relative to the midpoint?',tail<5?'Below':tail===5?'At the midpoint':'Above',['Below','At the midpoint','Above'],'Compare the number and the midpoint in matching places.',i),
        step('What is the rounded number?',tail<5?lo:hi,'Choose the nearer endpoint. At an exact tie, choose the higher endpoint.')]};
    });

  lesson('whole-multiply','Multiply with partial products',NBT,['5.NBT.B.5'],
    'Split one factor into hundreds, tens, and ones. Each partial product counts a different part of the same rectangle. Add the parts.',
    ['For 236 × 14, split 14 into 10 and 4.',
     'The 10-column strip has 236 × 10 = 2,360 squares. The 4-column strip has 236 × 4 = 944 squares.',
     'The entire rectangle has 2,360 + 944 = 3,304 squares.'],
    (level,i,pick)=>{
      const a=level===1?pick(12,79):level===2?pick(104,795):pick(1024,6995);
      const b=level===1?pick(2,9):pick(1,8)*10+pick(2,9)+(level===3?pick(1,6)*100:0);
      const split=level===1?a:b, other=level===1?b:a;
      const parts=[...String(split)].map((v,k,ds)=>Number(v)*10**(ds.length-k-1)).filter(Boolean);
      return {prompt:'A rectangular mosaic has '+a+' rows and '+b+' tiles per row. How many tiles are there?',
        model:table(['Strip','Tiles in each strip'],parts.map(p=>[p+' '+(level===1?'rows':'columns'),p+' × '+other]),'One rectangle split into strips'),
        steps:[...parts.map(p=>step('How many tiles are in the '+p+'-'+(level===1?'row':'column')+' strip?',p*other,
          'Multiply '+other+' by '+p+'. A tens or hundreds strip keeps its place-value zeros.')),
        step('Add the partial products. How many tiles cover the whole mosaic?',a*b,'Each strip is a separate part of the same mosaic.')]};
    });

  lesson('whole-divide','Divide and interpret remainders',NBT,['5.NBT.B.6'],
    'Take out a large group you can multiply mentally. Then count how many more equal groups fit. Any remainder must be smaller than one group.',
    ['For 735 cards in packs of 24, 30 packs use 24 × 30 = 720 cards.',
     '735 − 720 = 15. There are 30 full packs and 15 cards left.',
     'Check by reversing the division. 24 × 30 + 15 = 735.'],
    (level,i,pick)=>{
      const d=level===1?pick(3,9):level===2?pick(11,29):pick(21,49);
      const q=level===1?pick(1,4)*10+pick(1,8):level===2?pick(2,6)*10+pick(1,9):pick(10,19)*10+pick(1,9);
      const r=i%4===3?0:pick(1,d-1),n=d*q+r,chunk=Math.floor(q/10)*10,rem=n-d*chunk;
      return {solution:q+' full envelopes and '+r+' loose cards',prompt:'Pack '+n+' cards into envelopes of '+d+'. Find the full envelopes and loose cards.',
        model:table(['Full envelopes','Cards packed'],[[1,d],...(chunk===10?[]:[[10,10*d]]),[chunk,'?']],'Equal groups of cards'),
        steps:[step('Start with '+chunk+' envelopes. How many cards do they use?',chunk*d,'Multiply the envelope count by the number of cards per envelope.'),
          step('How many cards are still on the table?',rem,'Subtract the cards already packed from the original amount.'),
          step('How many more full envelopes fit?',q-chunk,'Find the largest number of groups of '+d+' that fit in the leftover cards.'),
          step('How many full envelopes did you pack altogether?',q,'Combine the starting envelopes with the additional ones.'),
          step('How many cards are left loose?',r,'Subtract the cards in all full envelopes. The remainder must be smaller than '+d+'.')]};
    });

  lesson('decimal-multiply','Multiply decimals and estimate',NBT,['5.NBT.B.7'],
    'Name the unit of each factor. One tenth times one tenth makes one hundredth. Estimate first so you can check the size of the result.',
    ['A strip is 2.4 meters long and 0.6 meter wide. Using 2.5 × 0.6 gives an estimate of 1.5 square meters.',
     '24 tenths × 6 tenths gives 144 hundredths because 24 × 6 = 144.',
     '144 hundredths is 1.44 square meters, close to the estimate.'],
    (level,i,pick)=>{
      const pa=level===3?2:1,pb=level===1?0:1, a=level===1?pick(12,69):level===2?pick(13,59):pick(112,698),b=level===1?pick(2,8):pick(3,9);
      const A=dec(a,pa),B=dec(b,pb),p=pa+pb,unit=places[p];
      const approxUnit=level===3?1:0, rounded=Math.floor((a+5)/10),approx=dec(rounded,approxUnit),est=dec(rounded*b,approxUnit+pb,true);
      return {prompt:'A banner measures '+A+' meters by '+B+' meters. Find its area in square meters.',
        steps:[step('Round '+A+' to the nearest '+(approxUnit?'tenth':'whole number')+'.',approx,'Use the next smaller place to choose the nearest value.'),
          step('Use that rounded length with the original width. Estimate the area.',est,'Multiply '+approx+' by '+B+' for this estimate.'),
          step('Set the decimal points aside. What is '+a+' × '+b+'?',a*b,'The digits tell you how many small units you have.'),
          select('What is the unit of those '+(a*b)+' pieces?',unit,['ones','tenths','hundredths','thousandths'],'Combine the number of decimal places in the two factors.',i+level),
          step('What is the exact area in square meters?',dec(a*b,p,true),'Write the product in its unit and compare its size with your estimate.')]};
    });

  lesson('decimal-divide','Divide decimals and estimate',NBT,['5.NBT.B.7'],
    'You can divide by working in a smaller unit. Give the total and each group the same unit before you divide. Use a nearby easy total to estimate.',
    ['Share 8.4 liters among 4 tanks. A nearby total is 8 liters, so expect about 2 liters each. Divide 84 tenths by 4 to get 21 tenths, or 2.1 liters.',
     'For 3 liters in 0.25-liter scoops, use hundredths for both quantities. 300 ÷ 25 = 12 scoops. Check that 12 × 0.25 = 3.'],
    (level,i,pick)=>{
      if(level===1||i%2===0){
        const p=level===1?1:2,d=pick(2,level===3?15:8),q=pick(2,level*3+3)*10**p+pick(1,10**p-1);
        const n=q*d,N=dec(n,p),approx=Math.round(q/10**p),compat=approx*d;
        return {prompt:'Divide '+N+' liters equally among '+d+' tanks. How many liters go in each?',
          steps:[step('Use '+compat+' liters as a nearby total. About how many liters would each tank get?',approx,'Divide the nearby whole-number total by '+d+'.'),
            step('Rename '+N+' liters in '+places[p]+'. How many '+places[p]+' is that?',n,'Multiply the number of liters by '+10**p+'.'),
            step('How many '+places[p]+' go into one tank?',q,'Divide the count of small units by the number of tanks.'),
            step('What is the exact amount in liters per tank?',dec(q,p,true),'Convert back to liters and check against your estimate.')]};
      }
      const denoms=level===2?[20,25,50]:[40,80,125],c=denoms[pick(0,denoms.length-1)],w=pick(2,level*4+3);
      const near=Math.max(1,Math.round(w/5))*5+(w%5===0?5:0),div=dec(c,2,true),nearQ=dec(near*10000/c,2,true);
      return {prompt:'A dispenser holds '+w+' liters. Each scoop holds '+div+' liter. How many scoops is that, including any partial scoop?',
        steps:[step('For a nearby '+near+' liters, estimate the scoop count using '+Math.round(near*100)+' hundredths ÷ '+c+'.',nearQ,'Convert the nearby total into hundredths of a liter and divide.'),
          step('How many hundredths are in each '+div+'-liter scoop?',c,'One liter is 100 hundredths.'),
          step('How many hundredths are in the actual '+w+' liters?',w*100,'Multiply the number of liters by 100.'),
          step('How many scoops does the actual amount fill?',dec(w*10000/c,2,true),'Divide the actual hundredths of a liter by the hundredths in one scoop.')]};
    });

  const denomPairs=[[[2,4],[3,6],[2,6]],[[3,4],[4,6],[6,8]],[[6,8],[8,12],[5,8]]];
  for(const subtract of [false,true]){
    lesson(subtract?'fraction-subtract':'fraction-add',subtract?'Subtract unlike fractions':'Add unlike fractions',NF,['5.NF.A.1','5.NF.A.2'],
      'The denominators tell you the sizes of the pieces. Rename both amounts in equal-sized pieces before you combine or compare them. Round to the nearest half to estimate.',
      subtract?['A spool starts with 2 1/4 meters. Cut off 5/6 meter. A half-meter estimate is 2 1/2 − 1 = 1 1/2.',
        'Cut each quarter into 3 pieces. Each whole now has 12 pieces. Two whole bars give 24 pieces, and the shaded quarter gives 3 more. That makes 27/12. The 5 sixths give 10/12.',
        '27/12 − 10/12 = 17/12, or 1 5/12 meters left.']:
      ['Combine 1 1/3 cups and 3/4 cup. Rounding to the nearest half gives 1 1/2 + 1 = 2 1/2 cups. At an exact halfway point, round upward.',
       'Cut each third into 4 pieces. The whole bar gives 12 pieces and the shaded third gives 4 more. That makes 16/12. Cut each quarter into 3 pieces and count the 3 shaded quarters to get 9/12.',
       '16/12 + 9/12 = 25/12, or 2 1/12 cups. That is close to the estimate.'],
      (level,i,pick)=>{
        let [d,e]=denomPairs[level-1][pick(0,2)],a=proper(d,pick),b=proper(e,pick);
        if(subtract&&((level===1&&a*e<b*d)||(level>1&&i%2===0&&a*e>b*d))){[d,e]=[e,d];[a,b]=[b,a];}
        a+=(level===1?0:pick(2,level+2))*d;
        b+=(level===3?1:0)*e;
        const m=d*e/gcd(d,e),an=a*(m/d),bn=b*(m/e),sgn=subtract?-1:1;
        const A=mixed(a,d),B=mixed(b,e),unit=subtract?'meters':'cups';
        return {prompt:subtract?'A spool holds '+A+' meters of ribbon. You cut off '+B+' meters. How many meters remain?':
          'A recipe uses '+A+' cups of oats and '+B+' cups of seeds. How many cups is that together?',
          fractionWork:{op:subtract?'-':'+',unit,operands:[{numerator:a,denominator:d},{numerator:b,denominator:e}]},
          model:bars([bar('Fractional part of '+A+' '+unit,a%d,d),bar('Fractional part of '+B+' '+unit,b%e,e)]),
          steps:[fraction('Round each amount to the nearest half, then '+(subtract?'subtract':'add')+' for an estimate. Round exact ties up.',
            ratio(halves(a,d)+sgn*halves(b,e),2),'Use the nearest whole or half for each amount before combining them.'),
            step('What is the least common denominator for '+d+' and '+e+'?',m,'Find the smallest positive number in both denominators’ multiplication tables.'),
            step('How many 1/'+m+' pieces make '+A+'?',an,'Each whole bar has '+m+' pieces. Count the whole bars, then add the shaded pieces in the last bar.'),
            step('How many 1/'+m+' pieces make '+B+'?',bn,'Count every shaded piece, including the pieces in any whole bars. This count is the numerator.'),
            fraction('What is the exact amount in '+unit+'?',ratio(an+sgn*bn,m),'Keep the common denominator. '+(subtract?'Subtract':'Add')+' the numerators and simplify if you can.')]};
      });
  }

  lesson('fraction-sharing','Share whole things equally',NF,['5.NF.B.3'],
    'A fraction bar can mean division. The amount you share is the numerator. The number of equal shares is the denominator.',
    ['Share 7 identical flatbreads among 3 hikers. Each hiker first gets 2 whole flatbreads. One remains.',
     'Split the last bread into 3 equal parts. Each hiker gets 2 1/3 flatbreads. The division 7 ÷ 3 is also the fraction 7/3.'],
    (level,i,pick)=>{
      const d=pick(level===1?3:4,level===3?12:7),r=proper(d,pick),q=level===1?0:pick(1,level*2);
      const n=q*d+r;
      return {prompt:'Share '+n+' identical flatbreads equally among '+d+' hikers. All the bread is shared.',
        steps:[select('Which division represents one hiker’s share?',n+' ÷ '+d,[d+' ÷ '+n,n+' × '+d],'Start with the total bread, then divide by the number of hikers.',i+1),
          step('How many whole flatbreads can each hiker have first?',q,'Find the number of complete rounds in which every hiker gets a whole bread.'),
          step('How many flatbreads still need to be cut?',r,'Subtract the bread already handed out from the total.'),
          fraction('What fraction of a flatbread does each hiker get from the ones still to be cut?',ratio(r,d),'Cut each remaining bread into '+d+' equal parts and give each hiker one piece of each.'),
          fraction('How much bread does one hiker get in all?',ratio(n,d),'Combine the whole breads and the share of the cut breads.')]};
    });

  lesson('fraction-of-quantity','A fraction of a quantity',NF,['5.NF.B.4','5.NF.B.4.a'],
    'To find a/b of an amount, split the amount into b equal shares and take a shares. You can also take a copies of the amount and then divide by b.',
    ['Find 3/4 of 2/3 liter. A fourth of 2/3 is 2/12, or 1/6 liter.',
     'Three of those shares give 3 × 1/6 = 1/2 liter.',
     'Try multiplying first. Three copies of 2/3 liter make 2 liters. Dividing 2 by 4 gives the same 1/2 liter.'],
    (level,i,pick)=>{
      const d=pick(level===1?3:4,level===3?9:6),n=pick(2,d-1);
      const e=level===1?1:pick(3,level===2?6:9);
      const q=e===1?d*pick(2,5):proper(e,pick)+(level===3?e*pick(1,2):0),Q=mixed(q,e),coef=n+'/'+d;
      return {solution:mixed(n*q,d*e)+' liters',prompt:'One jug holds '+Q+' liters of water. Find '+coef+' of the water in the jug by two routes.',
        model:bars([bar('One whole bar represents '+Q+' liters. The marked portion is '+coef+' of the jug.',n,d)]),
        steps:[fraction('Divide the jug into '+d+' equal shares. How many liters are in just one share?',ratio(q,e*d),'Divide the original quantity by '+d+'.'),
          fraction('Take '+n+' of those shares. How many liters is that?',ratio(n*q,d*e),'Multiply the size of one share by '+n+'.'),
          fraction('Now multiply first. How many liters would '+n+' full jugs hold?',ratio(n*q,e),'Multiply the original jug amount by the numerator.'),
          select('Which last operation gives the same result as the first route?','Divide by '+d,['Multiply by '+d,'Divide by '+n],'The denominator tells how many equal shares to make.',i+1)]};
    });

  lesson('fraction-area','Tile a fractional rectangle',NF,['5.NF.B.4','5.NF.B.4.b'],
    'Choose square tiles whose side length fits both sides of the rectangle exactly. Count across and down. Multiply the tile count by the area of one tile.',
    ['A rectangle is 3/4 meter wide and 1/2 meter high. Tile it with squares that measure 1/4 meter on each side.',
     'It fits 3 tiles across and 2 down, for 6 tiles. Each tile is 1/4 × 1/4 = 1/16 square meter.',
     'The area is 6/16 = 3/8 square meter. Multiplying the side lengths gives the same product, 3/4 × 1/2 = 3/8.'],
    (level,i,pick)=>{
      const pairs=[[[2,2],[3,3],[4,4]],[[2,4],[2,3],[3,6]],[[3,4],[4,6],[3,9]]];
      const [d,e]=pairs[level-1][pick(0,2)],a=proper(d,pick),b=proper(e,pick),D=d*e/gcd(d,e),across=a*(D/d),down=b*(D/e);
      return {prompt:'The shaded rectangle is '+ratio(a,d)+' meter wide and '+ratio(b,e)+' meter high. The full grid is one square meter. Each tile side measures 1/'+D+' meter.',
        model:{type:'fraction-area',cols:D,rows:D,shadedCols:across,shadedRows:down},
        steps:[step('How many little tiles fit across the shaded width?',across,'Count the shaded columns, or rewrite the width with a denominator of '+D+'.'),
          step('How many tiles fit down the shaded height?',down,'Count the shaded rows.'),
          fraction('What is the area of ONE little tile, in square meters?',ratio(1,D*D),'Multiply the tile’s side length by itself.'),
          step('How many tiles cover the shaded rectangle?',across*down,'Multiply the count across by the count down.'),
          fraction('What is the shaded area in square meters?',ratio(a*b,d*e),'Multiply the tile count by the area of one tile. The same result comes from multiplying the two side lengths.')]};
    });

  lesson('fraction-scaling','Predict a product’s size',NF,['5.NF.B.5','5.NF.B.5.a','5.NF.B.5.b'],
    'Think of the second factor as a scale. With a positive starting amount, half a copy is smaller, exactly one copy stays equal, and more than one copy is larger.',
    ['Without multiplying, 5/4 × 7/8 must be greater than 7/8 because 5/4 is more than one copy.',
     '3/5 × 7/8 must be smaller than 7/8 because 3/5 is less than one copy.',
     '4/4 is exactly one. Multiplying 7/8 by 4/4 renames it as 28/32 while keeping its size.'],
    (level,i,pick)=>{
      const d=pick(3,level+5),mode=i%3,n=mode===0?pick(1,d-1):mode===1?d+pick(1,d-1):d;
      const e=pick(3,level+6),a=proper(e,pick)+(level===3?e:0),Q=mixed(a,e),coef=n+'/'+d,k=pick(2,level+4),sign=mode===0?'<':mode===1?'>':'=';
      return {solution:mode===0?'The second ribbon is shorter.':mode===1?'The second ribbon is longer.':'The ribbons have equal lengths.',prompt:'A ribbon is '+Q+' meter long. A second ribbon is '+coef+' times as long. Compare the lengths without calculating the product.',
        steps:[select('Compare the scale '+coef+' to 1. Which symbol fits?',sign,['<','=','>'],'Compare its numerator with its denominator.',i),
          select('How does the second length compare with the first?',mode===0?'Shorter':mode===1?'Longer':'Same length',['Shorter','Longer','Same length'],'Think about whether you have less than one copy, one copy, or more than one copy.',i+1),
          step('Rename the first length '+a+'/'+e+' by multiplying by '+k+'/'+k+'. What is the new numerator?',a*k,'Multiply the original numerator by '+k+'.'),
          step('What is the matching denominator?',e*k,'Multiply the original denominator by the same factor.'),
          select('Why did the renamed length stay equal?','The factor equals 1',['Every factor makes a product larger','The denominator stayed the same'],'A nonzero number divided by itself is one.',i+2)]};
    });

  lesson('mixed-products','Multiply amounts in a recipe',NF,['5.NF.B.6'],
    'A fractional number of batches uses that fraction of the ingredients. Rename each mixed number as one fraction, then multiply the numerators and denominators.',
    ['A batch needs 1 1/2 cups of flour. For 2 1/3 batches, rename the two amounts as 3/2 cups and 7/3 batches.',
     'Multiply 3/2 × 7/3 = 21/6. Divide numerator and denominator by 3 to get 7/2.',
     'You need 3 1/2 cups. That makes sense for a little more than two batches of 1 1/2 cups.'],
    (level,i,pick)=>{
      const d=pick(2,level+4),e=level===1?1:pick(2,level+4);
      const a=proper(d,pick)+(level>1?pick(1,3)*d:0);
      const b=e===1?pick(2,6):proper(e,pick)+(level===3?pick(1,3)*e:0);
      return {prompt:'Each batch uses '+mixed(a,d)+' cups of flour. How much flour will '+mixed(b,e)+' batches use?',
        steps:[step('Write the flour per batch with denominator '+d+'. What numerator goes on top?',a,'Convert each whole cup into '+d+' pieces and add the fractional pieces.'),
          step('Write the batch count with denominator '+e+'. What numerator goes on top?',b,'A whole number is a fraction over 1. For a mixed number, count all the pieces.'),
          step('Multiplying straight across, what is the product of the two numerators?',a*b,'Multiply the counts on top of the two fractions.'),
          step('What is the product of the two denominators?',d*e,'Multiply the counts on the bottom.'),
          fraction('How many cups of flour does the recipe need?',ratio(a*b,d*e),'Combine the numerator and denominator products. You can enter a fraction or a mixed number.')]};
    });

  lesson('fraction-divide-whole','Share part of a whole',NF,['5.NF.B.7','5.NF.B.7.a','5.NF.B.7.c'],
    'Start with a unit fraction such as 1/3. Sharing that one piece among four people cuts it into four smaller pieces. Keep track of the size compared to the original whole.',
    ['Share 1/3 of a sheet equally among 4 artists. Cut each third of the full sheet into 4 smaller strips.',
     'The whole sheet now contains 3 × 4 = 12 equal strips. Each artist gets 1/12 of the whole sheet.',
     'Reverse the division to check. Four shares of 1/12 make 4/12 = 1/3 of the sheet.'],
    (level,i,pick)=>{
      const d=pick(2,level+4),k=pick(2+level-1,level+4);
      return {solution:ratio(1,d*k)+' of the sheet per artist',prompt:'Share 1/'+d+' of a sheet of paper equally among '+k+' artists. What part of the whole sheet does each artist get?',
        model:bars([bar('The piece to share, compared with a whole sheet',1,d)]),
        steps:[step('Into how many pieces should you cut the marked part?',k,'Make one equal piece for each artist.'),
          step('Imagine cutting every original part the same way. How many equal pieces would fill the whole sheet?',d*k,'Multiply the number of original parts by the pieces in each part.'),
          fraction('What fraction of the whole sheet does one artist receive?',ratio(1,d*k),'One artist gets one of the new small pieces.'),
          fraction('Combine all '+k+' shares to check. What fraction of the whole sheet should you get?',ratio(1,d),'Multiply the size of one artist’s share by the number of artists.')]};
    });

  lesson('whole-divide-fraction','Count fractional groups',NF,['5.NF.B.7','5.NF.B.7.b','5.NF.B.7.c'],
    'Division can ask how many servings fit. Count the unit-fraction pieces in all the wholes, then see how many pieces make one serving.',
    ['Two liters contain 8 quarter-liters, so 2 ÷ 1/4 = 8 servings of 1/4 liter.',
     'For 3 liters in servings of 2/5 liter, there are 15 fifths altogether. Each serving uses two fifths.',
     '15 ÷ 2 = 7 1/2 servings, counting a partial serving. Check that 7 1/2 × 2/5 = 3 liters.'],
    (level,i,pick)=>{
      const d=pick(level===1?2:4,level+5),a=level===1||i%3===2?1:pick(2,d-1),w=pick(level===1?1:3,level*3+2);
      return {solution:mixed(w*d,a)+' servings',prompt:'A pitcher holds '+w+' liters. A serving is '+a+'/'+d+' liter. How many servings does the pitcher hold, including partial servings?',
        model:bars([bar('One serving as part of one liter',a,d)]),
        steps:[step('How many pieces of size 1/'+d+' liter are in the entire pitcher?',w*d,'Each whole liter contains '+d+' of those pieces.'),
          step('How many of those little pieces make one serving?',a,'The numerator counts how many equal pieces make up one serving.'),
          fraction('How many servings can the pitcher supply?',ratio(w*d,a),'Divide all the little pieces by the number of pieces per serving. Include any fractional part of a serving.'),
          select('Which check would return the total liters?','Servings × liters per serving',['Servings + liters per serving','Servings ÷ liters per serving'],'Multiply the number of equal groups by the size of one group.',i+1)]};
    });

  return lessons;
});
