// Answer through the actual keyboard or choice controls and return the submitted text.
const nativeLesson = (() => {
  const demand=(ok,message)=>{if(!ok)throw Error(message);};
  function answer(host,step,index,check=true,typed) {
    const stage=document.querySelector(host+' [data-lesson-step]');
    demand(stage && Number(stage.dataset.lessonStep)===index,'Wrong lesson step at '+index+' in '+host);
    const value=typed ?? String(Array.isArray(step.answer)?step.answer[0]:step.answer);
    const choices=[...document.querySelectorAll(host+' [data-lesson-choice]')];
    if (choices.length) {
      const choice=choices.find(b=>b.dataset.lessonChoice===String(value));
      demand(choice,'Required choice is missing'); choice.click();
      if (check) document.querySelector(host+' [data-action=check]').click();
    } else {
      const field=document.querySelector(host+' [data-field=lesson-answer]');
      demand(field,'No response field for '+step.prompt);
      field.value=value;
      field.dispatchEvent(new Event('input',{bubbles:true}));
      if (check) field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    }
    return value;
  }
  return {answer};
})();
