(() => {
  const audio = document.createElement('audio');
  const toggle = document.querySelector('[data-music-toggle]');
  const volumeButtons = Array.from(document.querySelectorAll('[data-music-level]'));
  let userMusicLevel = 1;
  let userMusicVolume = userMusicLevel / 100;
  let musicManuallyPaused = false;
  let playRequested = false;
  let videoPlaying = false;
  let hasInteracted = false;
  let musicStarting = false;
  let fadeTimer = 0;

  audio.loop = true;
  audio.preload = 'none';
  audio.volume = userMusicVolume;
  audio.setAttribute('data-level', String(userMusicVolume));
  audio.src = 'audio/background.mp3';
  audio.hidden = true;
  audio.setAttribute('aria-hidden', 'true');
  document.body.append(audio);

  function reflectVolume() {
    volumeButtons.forEach(button => {
      const selected = Number(button.dataset.musicLevel) === userMusicLevel;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function updateControl() {
    if (!toggle) return;
    const shouldPlay = playRequested && !musicManuallyPaused;
    toggle.textContent = shouldPlay ? 'PAUSE' : 'PLAY';
    toggle.setAttribute('aria-pressed', String(shouldPlay));
    toggle.setAttribute('aria-label', shouldPlay ? '暫停背景音樂' : '播放背景音樂');
  }

  function fadeTo(target, durationMs, pauseAtEnd = false) {
    clearInterval(fadeTimer);
    const startVolume = audio.volume;
    const startedAt = performance.now();
    if (durationMs <= 0) {
      audio.volume = target;
      audio.setAttribute('data-level', String(target));
      if (pauseAtEnd) audio.pause();
      return;
    }
    fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      const eased = progress * progress * (3 - 2 * progress);
      audio.volume = startVolume + (target - startVolume) * eased;
      audio.setAttribute('data-level', audio.volume.toFixed(4));
      if (progress >= 1) {
        audio.volume = target;
        audio.setAttribute('data-level', String(target));
        clearInterval(fadeTimer);
        fadeTimer = 0;
        if (pauseAtEnd) audio.pause();
      }
    }, 40);
  }

  async function startMusic(duration = 2500) {
    if (musicManuallyPaused || !playRequested || musicStarting) return;
    if (videoPlaying) {
      fadeTo(0, 0);
      updateControl();
      return;
    }
    try {
      musicStarting = true;
      if (audio.paused) {
        audio.volume = 0;
        audio.setAttribute('data-level', '0');
      }
      await audio.play();
      musicStarting = false;
      if (playRequested && !musicManuallyPaused && !videoPlaying) fadeTo(userMusicVolume, duration);
    } catch {
      musicStarting = false;
      playRequested = false;
      updateControl();
    }
  }

  function tryFirstInteraction(event) {
    hasInteracted = true;
    if (event?.target?.closest?.('[data-music-toggle]')) return;
    if (!playRequested && !musicManuallyPaused) {
      playRequested = true;
      updateControl();
      startMusic(2500);
    }
  }

  toggle?.addEventListener('click', () => {
    hasInteracted = true;
    if (playRequested && !musicManuallyPaused) {
      musicManuallyPaused = true;
      playRequested = false;
      fadeTo(0, 600, true);
    } else {
      musicManuallyPaused = false;
      playRequested = true;
      if (videoPlaying) {
        fadeTo(0, 0);
        audio.play().catch(() => {});
      }
      else startMusic(2200);
    }
    updateControl();
  });

  volumeButtons.forEach(button => button.addEventListener('click', () => {
    const level = Number(button.dataset.musicLevel);
    if (!Number.isInteger(level) || level < 1 || level > 10) return;
    userMusicLevel = level;
    userMusicVolume = userMusicLevel / 100;
    reflectVolume();
    if (videoPlaying || musicManuallyPaused) return;
    if (playRequested) fadeTo(userMusicVolume, 300);
  }));

  window.addEventListener('wheel', tryFirstInteraction, { capture: true, passive: true });
  window.addEventListener('pointerdown', tryFirstInteraction, { capture: true, passive: true });
  window.addEventListener('pointerup', tryFirstInteraction, { capture: true, passive: true });
  window.addEventListener('touchstart', tryFirstInteraction, { capture: true, passive: true });
  window.addEventListener('click', tryFirstInteraction, { capture: true, passive: true });

  window.IAD_BGM = {
    videoStarted() {
      videoPlaying = true;
      if (playRequested && !musicManuallyPaused) fadeTo(0, 800);
    },
    videoPaused() {
      videoPlaying = false;
      if (playRequested && !musicManuallyPaused) {
        if (audio.paused) startMusic(1000);
        else fadeTo(userMusicVolume, 1000);
      }
    },
    videoResumed() {
      videoPlaying = true;
      if (playRequested && !musicManuallyPaused) fadeTo(0, 800);
    },
    videoStopped() {
      videoPlaying = false;
      if (playRequested && !musicManuallyPaused) startMusic(1800);
      else {
        fadeTo(0, 0);
        audio.pause();
      }
    },
    state() {
      return {
        playRequested,
        musicManuallyPaused,
        hasInteracted,
        videoPlaying,
        userMusicLevel,
        userMusicVolume,
        volume: audio.volume,
        playing: !audio.paused
      };
    }
  };

  reflectVolume();
  updateControl();
})();
