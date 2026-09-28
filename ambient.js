(() => {
  const audio = document.createElement('audio');
  const toggle = document.querySelector('[data-music-toggle]');
  const volumeInput = document.querySelector('[data-music-volume]');
  const volumeLevels = [0.01, 0.10, 0.30, 0.50, 0.80];
  let userMusicLevel = 1;
  let userMusicVolume = volumeLevels[userMusicLevel - 1];
  let musicEnabledByUser = false;
  let videoPlaying = false;
  let musicStarting = false;
  let fadeTimer = 0;

  audio.loop = true;
  audio.preload = 'none';
  audio.volume = userMusicVolume;
  audio.src = 'audio/background.mp3';
  audio.hidden = true;
  audio.setAttribute('aria-hidden', 'true');
  document.body.append(audio);

  function reflectVolume() {
    if (!volumeInput) return;
    volumeInput.value = String(userMusicLevel);
    volumeInput.setAttribute('aria-valuetext', `${Math.round(userMusicVolume * 100)}%`);
    volumeInput.parentElement?.setAttribute('data-level', String(userMusicLevel));
  }

  function updateControl() {
    if (!toggle) return;
    toggle.classList.toggle('is-playing', musicEnabledByUser);
    toggle.setAttribute('aria-pressed', String(musicEnabledByUser));
    toggle.setAttribute('aria-label', musicEnabledByUser ? '暫停背景音樂' : '播放背景音樂');
  }

  function fadeTo(target, durationMs, pauseAtEnd = false) {
    clearInterval(fadeTimer);
    fadeTimer = 0;
    const startVolume = audio.volume;
    const startedAt = performance.now();
    if (durationMs <= 0) {
      audio.volume = target;
      if (pauseAtEnd) audio.pause();
      return;
    }
    fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      const eased = progress * progress * (3 - 2 * progress);
      audio.volume = startVolume + (target - startVolume) * eased;
      if (progress >= 1) {
        audio.volume = target;
        clearInterval(fadeTimer);
        fadeTimer = 0;
        if (pauseAtEnd) audio.pause();
      }
    }, 32);
  }

  async function startMusic(duration = 700) {
    if (!musicEnabledByUser || videoPlaying || musicStarting) return;
    try {
      musicStarting = true;
      if (audio.paused) audio.volume = 0;
      await audio.play();
      musicStarting = false;
      if (musicEnabledByUser && !videoPlaying) fadeTo(userMusicVolume, duration);
      else fadeTo(0, 0, true);
    } catch {
      musicStarting = false;
      musicEnabledByUser = false;
      updateControl();
    }
  }

  toggle?.addEventListener('click', () => {
    musicEnabledByUser = !musicEnabledByUser;
    updateControl();
    if (!musicEnabledByUser) {
      fadeTo(0, 320, true);
    } else if (videoPlaying) {
      fadeTo(0, 0, true);
    } else {
      startMusic();
    }
  });

  volumeInput?.addEventListener('input', () => {
    userMusicLevel = Math.max(1, Math.min(5, Math.round(Number(volumeInput.value))));
    userMusicVolume = volumeLevels[userMusicLevel - 1];
    reflectVolume();
    if (!musicEnabledByUser || videoPlaying) {
      if (audio.paused) audio.volume = userMusicVolume;
      return;
    }
    fadeTo(userMusicVolume, 240);
  });

  window.IAD_BGM = {
    videoStarted() {
      videoPlaying = true;
      if (musicEnabledByUser) fadeTo(0, 650, true);
    },
    videoPaused() {
      videoPlaying = false;
      if (musicEnabledByUser) startMusic(650);
    },
    videoResumed() {
      videoPlaying = true;
      if (musicEnabledByUser) fadeTo(0, 450, true);
    },
    videoStopped() {
      videoPlaying = false;
      if (musicEnabledByUser) startMusic(850);
      else fadeTo(0, 0, true);
    },
    state() {
      return {
        musicEnabledByUser,
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
