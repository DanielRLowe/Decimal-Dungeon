const {test}=require('node:test');
const assert=require('node:assert/strict');
const aid=require('../web/place-value.js');
const board=require('../web/lesson-board.js');

test('1.99 distinguishes the two nines and accepts equivalent decimal notation',()=>{
  const exercise=aid.make('1.99',1);
  assert.deepEqual(exercise.steps.map(s=>s.answer),['0.9','0.09','10','1/10']);
  assert.ok(board.matches(exercise.steps[0],'.90'));
  assert.equal(board.matches(exercise.steps[0],'99'),false);
  assert.match(exercise.steps[0].prompt,/9 tenths/);
});

test('a saved exercise gets the new model while its original question and answers stay intact',()=>{
  const saved={lessonId:'place-value',prompt:'Compare the digit 9 in the tenths and hundredths places of 1.99.',
    steps:['0.9','0.09','10','1/10'].map(answer=>({answer}))};
  const adapted=aid.fromSaved(saved);
  assert.equal(adapted.model.left,1);
  assert.equal(adapted.model.text,'1.99');
  assert.equal(saved.model,undefined);
  assert.deepEqual(adapted.steps.map(s=>s.answer),saved.steps.map(s=>s.answer));
  assert.equal(aid.fromSaved({...saved,lessonId:'other'}).model,undefined);
});
