/* Original grade-five measurement, data and geometry practice. Models are data,
   so each saved puzzle can be reconstructed without rerolling its measurements. */
(function (root) {
  'use strict';
  const lessons = [];
  const MD = 'Measurement and data', G = 'Geometry';
  const number = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
  const ask = (prompt, answer, hint, extra = {}) => ({prompt, answer:String(answer), hint, ...extra});
  function lesson(id, title, domain, codes, intro, steps, make) {
    lessons.push({id, title, domain, codes, tutorial:{intro, steps}, make});
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function fraction(n, d) { const g = gcd(n,d); return d === g ? String(n/g) : n/g + '/' + d/g; }

  const units = [
    ['meters','centimeters',100,'rope','m','cm'], ['feet','inches',12,'ribbon','ft','in'],
    ['hours','minutes',60,'practice time','h','min'], ['liters','milliliters',1000,'water','L','mL'],
    ['pounds','ounces',16,'clay','lb','oz'], ['dollars','cents',100,'savings','$','¢'],
    ['kilograms','grams',1000,'rice','kg','g'], ['cups','fluid ounces',8,'juice','cups','fl oz'],
    ['yards','feet',3,'cloth','yd','ft'], ['minutes','seconds',60,'music','min','s']
  ];
  lesson('unit-conversions','Convert and combine measurements',MD,['5.MD.A.1'],
    'Keep every measurement in the same unit before combining amounts. A larger unit contains several smaller ones.',
    ['A box holds 2.5 feet of ribbon. Each foot contains 12 inches, so 2.5 × 12 = 30 inches.',
     'Another piece is 8 inches long. Together the pieces measure 30 + 8 = 38 inches.',
     'Check the direction. The number of inches should be larger than the number of feet.'],
    (level, index, rng) => {
      const [large, small, factor, item] = units[index % units.length];
      const whole = number(rng,1,level*3), part = level > 1 ? (factor%4 === 0 ? .25*number(rng,1,3) : 0.5) : 0;
      const amount = whole + part, converted = amount*factor;
      const extra = number(rng,2,9+level*4), used = level === 3 ? number(rng,1,extra) : 0;
      const steps = [ask('How many '+small+' make one of the larger units?',factor,'Read the unit relationship in the problem.'),
        ask('Convert '+amount+' '+large+' to '+small+'.', converted, 'Multiply the larger-unit amount by the conversion factor.'),
        ask('Combine the two amounts in '+small+'.', converted+extra,'Add the extra amount after converting the first amount.')];
      if (used) steps.push(ask('After using '+used+' '+small+', how much is left in '+small+'?',converted+extra-used,'Subtract from the combined amount.'));
      return {prompt:'Your '+item+' comes in two amounts, '+amount+' '+large+' and '+extra+' '+small+'. One of the larger units equals '+factor+' '+small+'. How much '+item+(used?' remains after using '+used+' '+small:' is there altogether')+'?',steps};
    });

  lesson('line-plots','Build and read a fraction line plot',MD,['5.MD.B.2'],
    'A line plot puts one mark above a measurement for each time it occurs.',
    ['Four strips measure ¼, ½, ½ and ¾ foot. Count one mark above ¼, two above ½ and one above ¾.',
     'The two half-foot strips account for 2 × ½ = 1 foot. All four strips total 2 feet.',
     'Sharing that length equally gives 2 ÷ 4 = ½ foot per strip.'],
    (level, index, rng) => {
      const den = [2,4,8][level-1], base=number(rng,0,2)*den+1;
      const ticks = Array.from({length:level===1?3:4},(_,i)=>base+i);
      const counts = ticks.map(()=>number(rng,1,3));
      if (level===3) counts[number(rng,0,counts.length-1)] = 0;
      const labels = ticks.map(t=>fraction(t, den));
      const samples = ticks.flatMap((t,i)=>Array(counts[i]).fill(fraction(t,den)));
      for (let j=samples.length-1;j>0;j--) {const k=number(rng,0,j);[samples[k],samples[j]]=[samples[j],samples[k]];}
      const total = ticks.reduce((sum,t,i)=>sum+t*counts[i],0);
      const steps = labels.map((name,i)=>ask('How many X marks go above '+name+' foot?',counts[i],
        'Count only the samples equal to '+name+'. Each sample supplies one mark.',{tick:i}));
      steps.push(ask('What is the total length of all the strips, in feet?',fraction(total,den),
        'Multiply each length by the number of marks above it, then add.',{format:'fraction'}));
      if (level===3) steps.push(ask('If this length were shared equally among the strips, how many feet would each get?',
        fraction(total,den*samples.length),'Divide the total length by the number of strips.',{format:'fraction'}));
      return {prompt:'The strips measure '+samples.join(', ')+' feet. Build a line plot of these measurements.',
        model:{type:'line-plot',labels,caption:'Strip length in feet'},steps};
    });

  lesson('unit-cubes','Pack a solid with unit cubes',MD,['5.MD.C.3','5.MD.C.3.a','5.MD.C.3.b','5.MD.C.4'],
    'Volume counts how many equally sized cubes fill a solid with no overlaps or gaps.',
    ['Imagine cubes with edges of 1 inch. Each cube has a volume of 1 cubic inch.',
     'A layer 3 cubes long and 2 cubes deep holds 6 cubes. Two equal layers hold 12.',
     'The volume is 12 cubic inches. A drawing of the outside faces also represents the cubes hidden inside.'],
    (level,index,rng)=>{
      const l=number(rng,2,3+level), w=number(rng,2,level+2),h=number(rng,1+level,level+2);
      const unit=['centimeter','inch','foot','block'][index%4];
      const out={centimeter:'cubic centimeters',inch:'cubic inches',foot:'cubic feet',block:'unit blocks'}[unit];
      return {solution:l*w*h+' '+out,prompt:'This box is packed with identical '+(unit==='block'?'unit blocks':'cubes with one-'+unit+' edges')+'. How much space do they fill?',
        model:{type:'prism',l,w,h,unit:'',caption:'Each small cell is one cube.'},
        steps:[ask('How many cubes fill one bottom layer?',l*w,'Count the rows in a layer and the cubes in each row.'),
          ask('How many layers are stacked?',h,'Count vertically from bottom to top.'),
          ask('How many cubes fill the entire solid?',l*w*h,'Multiply the number in a layer by the layer count.'),
          ask('Which unit describes the volume?',out,'Volume counts three-dimensional units.',{choices:[out,'square units','linear units']})]};
    });
  lesson('prism-volume','Find the volume of a rectangular prism',MD,['5.MD.C.5','5.MD.C.5.a','5.MD.C.5.b'],
    'Every layer of a rectangular prism has the same base area. Volume equals base area times height.',
    ['A crate is 4 ft long, 3 ft wide and 2 ft tall. Its base covers 4 × 3 = 12 square feet.',
     'It takes 2 layers of 12 unit cubes to fill the crate. The volume is 12 × 2 = 24 cubic feet.',
     'You can group the factors either way. (4 × 3) × 2 and 4 × (3 × 2) both give 24.'],
    (level,index,rng)=>{
      const l=number(rng,3,4+level*2),w=number(rng,2,4+level),h=number(rng,2,level+4);
      if (level===3 && index%2) return {prompt:'A rectangular tank holds '+l*w*h+' cubic feet. Its base measures '+l+' ft by '+w+' ft. Find its height.',
        steps:[ask('Find the base area in square feet.',l*w,'Multiply the lengths of the two base edges.'),
          ask('Which calculation finds the number of layers?',l*w*h+' ÷ '+l*w,'Each layer contains one base area.',{choices:[l*w*h+' ÷ '+l*w,l*w*h+' × '+l*w,l*w*h+' − '+l*w]}),
          ask('What is the height in feet?',h,'Divide the total volume by the base area.')]};
      return {solution:l*w*h+' cubic feet',prompt:'A storage crate measures '+l+' ft by '+w+' ft by '+h+' ft. Find its volume.',
        model:{type:'prism',l,w,h,unit:'ft',caption:'Storage crate'},
        steps:[ask('What is the base area in square feet?',l*w,'Multiply length by width.'),
          ask('What is the volume in cubic feet?',l*w*h,'Multiply the base area by the height.'),
          ask('Which expression groups the same three factors another way?',l+' × ('+w+' × '+h+')','All three edge lengths must be multiplied.',{choices:[l+' × ('+w+' × '+h+')',l+' + ('+w+' × '+h+')',l+' × ('+w+' + '+h+')']})]};
    });
  lesson('composite-volume','Combine volumes of joined prisms',MD,['5.MD.C.5','5.MD.C.5.c'],
    'Split a stepped solid into rectangular blocks. Each piece must cover its own part of the solid exactly once.',
    ['A low block measures 4 × 2 × 1 feet and holds 8 cubic feet.',
     'A second block on top measures 2 × 2 × 2 feet and holds 8 cubic feet.',
     'The blocks touch along a face. Their total volume is 8 + 8 = 16 cubic feet.'],
    (level,index,rng)=>{
      const w=number(rng,2,3+level),l=number(rng,4,5+level),h=number(rng,1,level+1);
      const b=number(rng,1,l-1), top=number(rng,2,level+3);
      return {prompt:'A stepped display has a bottom block '+l+' × '+w+' × '+h+' ft and a shorter block '+b+' × '+w+' × '+top+' ft on top. Find the volume.',
        model:{type:'composite',l,w,h,b,top,unit:'ft'},
        steps:[ask('What is the bottom block’s volume in cubic feet?',l*w*h,'Multiply its three dimensions.'),
          ask('What is the upper block’s volume in cubic feet?',b*w*top,'Count only the extra layers above the bottom block.'),
          ask('How do the two volumes fit together?','Add them because the blocks do not overlap.','Think about whether any cube was counted twice.',{choices:['Add them because the blocks do not overlap.','Multiply them because they touch.','Use only the larger volume.']}),
          ask('How many cubic feet fill the complete display?',w*(l*h+b*top),'Add the partial volumes.')]};
    });

  lesson('coordinate-grid','Plot and label ordered pairs',G,['5.G.A.1'],
    'Start at the origin, (0, 0). The first coordinate moves horizontally along x. The second moves vertically along y.',
    ['To plot A(4, 2), start at (0, 0) and move 4 units right.',
     'Move 2 units up and mark A. Its ordered pair is (4, 2).',
     'B(2, 4) is a different point. It is across 2 and up 4.'],
    (level,index,rng)=>{
      const max=4+2*level,x=number(rng,1,max-1),y=(x+number(rng,1,max-1))%max;
      const steps=[ask('How far to the right do you move to reach A?',x,'Read the first number.'),ask('How far up do you move?',y,'Read the second number.'),
        ask('Plot A on the grid.',x+','+y,'Start at the origin and move right, then up.',{plot:true,pointLabel:'A'})];
      if (level>1) steps.push(ask('Plot B with A’s coordinates reversed.',y+','+x,'Exchange the horizontal and vertical distances.',{plot:true,pointLabel:'B'}));
      return {prompt:'Mark A('+x+', '+y+') on the coordinate grid.'+(level>1?' Then plot the point with its coordinates reversed.':''),model:{type:'coordinates',max,points:[]},steps};
    });
  lesson('coordinate-stories','Read a story from a coordinate graph',G,['5.G.A.1','5.G.A.2'],
    'The axes tell you the meaning of each coordinate. Read their units before answering.',
    ['On a route map, x measures miles east and y measures miles north. A shelter at (3, 4) is 3 miles east and 4 miles north of camp.',
     'A second shelter 2 miles farther east has the coordinates (5, 4). Its northward distance is unchanged.',
     'Plot the second point and compare the horizontal distance between shelters.'],
    (level,index,rng)=>{
      const max=4+2*level, x=number(rng,1,max-3), y=number(rng,1,max-3), dx=number(rng,1,3), dy=level>1?number(rng,1,2):0;
      return {prompt:'On this trail map each unit is one mile. The bridge is marked B. A lookout is '+dx+' miles east'+(dy?' and '+dy+' miles north':'')+' of the bridge.',
        model:{type:'coordinates',max,points:[[x,y,'B']],xLabel:'Miles east',yLabel:'Miles north'},
        steps:[ask('Read B. How many miles north of camp is the bridge?',y,'Trace across to the vertical axis.'),
          ask('How far east of camp is the lookout?',x+dx,'Read the horizontal coordinate of B and add the eastward trip.'),
          ask('Plot the lookout, L.',(x+dx)+','+(y+dy),'East changes x. North changes y.',{plot:true,pointLabel:'L'}),
          ask('Following those east and north trail segments, how many miles is it from the bridge to the lookout?',dx+dy,'Add the two distances walked.')]};
    });

  const shapes=[
    ['square','four equal sides and four right angles','rectangle','rhombus','A square is also a rhombus because its four sides are equal.'],
    ['rectangle','two pairs of equal opposite sides, four right angles, and unequal neighboring sides','parallelogram','quadrilateral','A rectangle belongs to the parallelogram family because opposite sides are parallel.'],
    ['rhombus','four equal sides and no right angles','parallelogram','quadrilateral','Every rhombus is a parallelogram because both pairs of opposite sides are parallel.'],
    ['parallelogram','two pairs of parallel sides, unequal neighboring sides, and no right angles','quadrilateral','polygon','Four straight sides make it a quadrilateral.'],
    ['equilateral triangle','three equal sides','isosceles triangle','triangle','It has at least two equal sides, so it is an isosceles triangle too.'],
    ['right triangle','three unequal sides and one right angle','triangle','polygon','One 90-degree angle makes it a right triangle.']
  ];
  lesson('shape-families','Classify shapes by their properties',G,['5.G.B.3'],
    'A figure can belong to several families at once. A smaller family inherits the properties of its larger family.',
    ['Four straight sides make a square a quadrilateral. Its two pairs of parallel sides also make it a parallelogram.',
     'A square has four right angles like every rectangle and four equal sides like every rhombus.',
     'An ordinary rectangle may have unequal neighboring sides. Being a rectangle alone does not guarantee it is a square.'],
    (level,index,rng)=>{
      const item=shapes[(index+level-1)%shapes.length], [name,clue,parent,other,reason]=item;
      return {solution:name+' · '+parent,prompt:'A figure has '+clue+'. Use those properties to classify it.',
        model:{type:'shape',name},steps:[
          ask('What is its most specific name among these choices?',name,'Use every property in the description.',{choices:[name,...shapes.map(x=>x[0]).filter(n=>n!==name).sort((a,b)=>a.localeCompare(b)).slice(index%3,index%3+2)]}),
          ask('Which larger family also contains every '+name+'?',parent,'Look for a property shared by every member of the smaller family.',{choices:[parent,'circle','pentagon']}),
          ...(level>1?[ask('Which explanation is always true?',reason,'Decide whether the defining properties guarantee the claim.',{choices:[reason,'Every polygon has four equal sides.','Every polygon has a right angle.']})]:[]),
          ...(level===3?[ask('Which additional category also fits this figure?',other,'A shape can belong to more than two families.',{choices:[other,'hexagon','oval']})]:[])]};
    });
  root.DungeonSpaceLessons = lessons;
  if (typeof module !== 'undefined' && module.exports) module.exports = lessons;
})(globalThis);
