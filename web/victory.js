(function () {
  'use strict';
  const film = document.getElementById('victory-film');
  const video = document.getElementById('victory-video');
  const caption = document.getElementById('victory-caption');
  const skip = document.getElementById('skip-victory');
  let country = '';
  let returnFocus = null;
  let showingVictory = false;
  let playback = 0;

  function close() {
    playback++;
    video.pause();
    if (film.open) {
      const restoreFocus = film.contains(document.activeElement);
      film.close();
      if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    }
    returnFocus = null;
  }
  function play(landscape, name, replay, automatic) {
    close();
    if (automatic && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const currentPlayback = playback;
    country = name;
    returnFocus = automatic ? document.querySelector('#workbench .next') : replay;
    showingVictory = false;
    caption.textContent = 'Battle for ' + country;
    const source = 'assets/victories/' + landscape + '.mp4';
    if (video.getAttribute('src') !== source) video.src = source;
    else video.currentTime = 0;
    film.show();
    film.scrollIntoView({block:'nearest'});
    if (!automatic) skip.focus({preventScroll:true});
    video.play().catch(() => {
      if (playback === currentPlayback) close();
    });
  }
  video.addEventListener('timeupdate', () => {
    if (!showingVictory && video.currentTime >= 3.9) {
      showingVictory = true;
      caption.textContent = 'Victory in ' + country + '!';
    }
  });
  video.addEventListener('ended', close);
  video.addEventListener('error', close);
  skip.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && film.open && !document.querySelector('dialog:modal')) {
      event.preventDefault();
      close();
    }
  });
  window.DungeonVictory = {play, close};
})();
