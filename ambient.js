(() => {
  const audio = document.createElement('audio');
  const toggle = document.querySelector('[data-sound-toggle]');
  const targetVolume = 0.05;
  let enabled = false;
  let interacted = false;
  let manualChoice = false;
  let videoPlaying = false;
  let fadeTimer = 0;

  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;
  audio.setAttribute('data-level', '0');
  audio.src = 'audio/background.mp3';
  audio.hidden = true;
  audio.setAttribute('aria-hidden', 'true');
  document.body.append(audio);

  function updateToggle() {
    if (!toggle) return;
    toggle.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? '關閉背景音樂' : '開啟背景音樂');
  }

  function fadeTo(target, durationMs) {
    clearInterval(fadeTimer);
    const startVolume = audio.volume;
    const startedAt = performance.now();
    if (durationMs <= 0) {
      audio.volume = target;
      audio.setAttribute('data-level', String(target));
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
        if (target === 0 && !enabled && !videoPlaying) audio.pause();
      }
    }, 40);
  }

  async function playAtLowVolume(fadeDuration = 2500, mutedStart = false) {
    if (!enabled || videoPlaying) return;
    try {
      if (mutedStart) audio.muted = true;
      await audio.play();
      if (mutedStart) audio.muted = false;
      if (enabled && !videoPlaying) fadeTo(targetVolume, fadeDuration);
    } catch {
      audio.muted = false;
      enabled = false;
      updateToggle();
    }
  }

  function activateFromInteraction(event) {
    interacted = true;
    if (event?.target?.closest?.('[data-sound-toggle]')) return;
    if (!manualChoice) enabled = true;
    updateToggle();
    if (enabled && !videoPlaying) playAtLowVolume(event?.target?.closest?.('.play-trigger') ? 1800 : 2500, event?.type === 'wheel');
  }

  toggle?.addEventListener('click', () => {
    manualChoice = true;
    interacted = true;
    enabled = !enabled;
    updateToggle();
    if (enabled && !videoPlaying) playAtLowVolume(1800);
    else if (enabled) {
      fadeTo(0, 0);
      audio.play().catch(() => {});
    } else fadeTo(0, 700);
  });

  window.addEventListener('wheel', activateFromInteraction, { capture: true, passive: true });
  window.addEventListener('pointerup', activateFromInteraction, { capture: true, passive: true });

  window.IAD_BGM = {
    videoStarted() {
      videoPlaying = true;
      fadeTo(0, 800);
    },
    videoStopped() {
      videoPlaying = false;
      if (enabled && interacted) playAtLowVolume(1800);
      else if (!enabled) audio.pause();
    },
    state() {
      return { enabled, interacted, videoPlaying, volume: audio.volume, playing: !audio.paused };
    }
  };

  updateToggle();
})();
