(() => {
  const works = Array.isArray(window.OFFCUT_WORKS) ? window.OFFCUT_WORKS : [];
  const rail = document.querySelector('#rail');
  const stage = document.querySelector('#stage');
  const gallery = document.querySelector('.gallery');
  const info = document.querySelector('.work-info');
  const title = document.querySelector('#work-title');
  const type = document.querySelector('#work-type');
  const badge = document.querySelector('#work-badge');
  const counter = document.querySelector('#counter');
  const empty = document.querySelector('#empty');
  const slides = [];
  let anchorSlide;
  let position = 0;
  let selected = 0;
  let velocity = 0;
  let frameId = 0;
  let lastFrame = 0;
  let snapping = false;
  let snapTarget = null;
  let burstAnchor = 0;
  let burstIntent = 0;
  let burstActive = false;
  let snapTimer = 0;
  let infoTimer = 0;
  let idleTimer = 0;
  let youtubeApiPromise = null;
  let touchStart = null;

  const MIN_POSITION = -6;
  const MAX_POSITION = 6;
  const FAN_OFFSETS = [0, .205, .285, .352, .407, .448, .475];
  const pad = n => String(n).padStart(2, '0');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const currentWorkIndex = () => works.findIndex(work => work.position === selected);

  function updateCounter() {
    if (selected === 0) counter.textContent = 'HOME';
    else counter.textContent = `${selected < 0 ? 'L' : 'R'} ${pad(Math.abs(selected))} / 06`;
  }

  function updateInfo(animate = true) {
    clearTimeout(infoTimer);
    const workIndex = currentWorkIndex();
    const work = workIndex >= 0 ? works[workIndex] : null;
    info.classList.toggle('is-home', !work);
    if (animate && work) info.classList.add('is-changing');
    const apply = () => {
      title.textContent = work?.title || '';
      title.hidden = !work?.title;
      type.textContent = work?.category || '';
      badge.textContent = work?.badge || '';
      badge.hidden = !work?.badge;
      info.classList.remove('is-changing');
    };
    if (animate && work) infoTimer = setTimeout(apply, 120);
    else apply();
    updateCounter();
  }

  function clearInfoForMotion() {
    clearTimeout(infoTimer);
    info.classList.add('is-changing');
    infoTimer = setTimeout(() => {
      if (!snapping && !burstActive) return;
      title.textContent = '';
      type.textContent = '';
      badge.textContent = '';
      badge.hidden = true;
    }, 120);
  }

  function setInteracting() {
    gallery.classList.add('is-interacting');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => gallery.classList.remove('is-interacting'), 3800);
  }

  function stopPlayback() {
    let hadPlayback = false;
    slides.forEach(slide => {
      if (slide.frame || slide.player) hadPlayback = true;
      slide.element.classList.remove('is-playing', 'is-loading', 'is-paused');
      slide.playButton.disabled = false;
      slide.playButton.setAttribute('aria-label', `播放 ${slide.work.title || slide.work.category}`);
      slide.playButton.setAttribute('aria-pressed', 'false');
      clearTimeout(slide.fallbackTimer);
      slide.fallbackTimer = 0;
      slide.fallback?.remove();
      slide.fallback = null;
      if (slide.player) {
        try { slide.player.destroy(); } catch { /* The frame may already be navigating away. */ }
        slide.player = null;
      }
      if (slide.frame) {
        slide.frame.src = 'about:blank';
        slide.frame.remove();
        slide.frame = null;
      }
    });
    if (hadPlayback) window.IAD_BGM?.videoStopped();
  }

  function videoId(work) {
    try {
      const url = new URL(work.videoSource);
      if (work.videoType === 'youtube') return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
      return url.pathname.match(/\/video\/(\d+)/)?.[1] || '';
    } catch { return ''; }
  }

  function playbackUrl(work) {
    const id = videoId(work);
    if (!id) return '';
    if (work.videoType === 'tiktok') {
      return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&muted=1&controls=0&music_info=0&description=0&playsinline=1`;
    }
    const origin = location.origin && location.origin !== 'null' ? `&origin=${encodeURIComponent(location.origin)}` : '';
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&enablejsapi=1${origin}`;
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!youtubeApiPromise) {
      youtubeApiPromise = new Promise(resolve => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof previousReady === 'function') previousReady();
          resolve(window.YT);
        };
        const api = document.createElement('script');
        api.src = 'https://www.youtube.com/iframe_api';
        api.async = true;
        api.onerror = () => resolve(null);
        document.head.append(api);
      });
    }
    return youtubeApiPromise;
  }

  function revealIfPlaying(slide, index) {
    if (slide.frame && currentWorkIndex() === index && !snapping && !burstActive) {
      const wasPaused = slide.element.classList.contains('is-paused');
      clearTimeout(slide.fallbackTimer);
      slide.fallbackTimer = 0;
      slide.element.classList.remove('is-loading');
      slide.playButton.disabled = false;
      slide.element.classList.remove('is-paused');
      slide.element.classList.add('is-playing');
      slide.playButton.setAttribute('aria-label', `暫停 ${slide.work.title || slide.work.category}`);
      slide.playButton.setAttribute('aria-pressed', 'true');
      if (wasPaused) window.IAD_BGM?.videoResumed();
    }
  }

  function markVideoPaused(slide) {
    const wasPaused = slide.element.classList.contains('is-paused');
    slide.element.classList.remove('is-playing', 'is-loading');
    slide.element.classList.add('is-paused');
    slide.playButton.disabled = false;
    slide.playButton.setAttribute('aria-label', `繼續播放 ${slide.work.title || slide.work.category}`);
    slide.playButton.setAttribute('aria-pressed', 'false');
    if (!wasPaused) window.IAD_BGM?.videoPaused();
  }

  function restorePoster(slide, fallback = false) {
    clearTimeout(slide.fallbackTimer);
    slide.fallbackTimer = 0;
    slide.element.classList.remove('is-playing', 'is-loading', 'is-paused');
    slide.playButton.disabled = false;
    slide.playButton.setAttribute('aria-label', `播放 ${slide.work.title || slide.work.category}`);
    slide.playButton.setAttribute('aria-pressed', 'false');
    if (slide.player) {
      try { slide.player.destroy(); } catch { /* The frame may already be navigating away. */ }
      slide.player = null;
    }
    if (slide.frame) {
      slide.frame.src = 'about:blank';
      slide.frame.remove();
      slide.frame = null;
    }
    if (fallback && slide.work.videoType === 'tiktok') {
      const link = document.createElement('a');
      link.className = 'source-fallback';
      link.href = slide.work.videoSource;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'OPEN ON TIKTOK';
      slide.element.append(link);
      slide.fallback = link;
    }
    window.IAD_BGM?.videoStopped();
  }

  function onTikTokMessage(event) {
    if (event.origin !== 'https://www.tiktok.com') return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data['x-tiktok-player'] !== true) return;
    const index = slides.findIndex(slide => slide.frame?.contentWindow === event.source);
    if (index < 0 || index !== currentWorkIndex() || snapping || burstActive) return;
    const slide = slides[index];
    if (data.type === 'onPlayerReady') {
      const target = 'https://www.tiktok.com';
      slide.frame.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'mute' }, target);
      slide.frame.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'play' }, target);
    } else if (data.type === 'onStateChange' && data.value === 1) {
      revealIfPlaying(slide, index);
    } else if (data.type === 'onStateChange' && data.value === 2) {
      markVideoPaused(slide);
    } else if (data.type === 'onError') {
      restorePoster(slide, true);
    }
  }

  function startPlayback(index) {
    if (index !== currentWorkIndex() || snapping || burstActive || !works[index]) return;
    const slide = slides[index];
    if (slide.frame) {
      if (slide.element.classList.contains('is-playing')) {
        if (slide.player) slide.player.pauseVideo();
        else slide.frame.contentWindow?.postMessage({ 'x-tiktok-player': true, type: 'pause' }, 'https://www.tiktok.com');
        markVideoPaused(slide);
      } else {
        if (slide.player) slide.player.playVideo();
        else slide.frame.contentWindow?.postMessage({ 'x-tiktok-player': true, type: 'play' }, 'https://www.tiktok.com');
        slide.element.classList.remove('is-paused');
        slide.element.classList.add('is-loading');
        window.IAD_BGM?.videoResumed();
      }
      return;
    }
    const work = works[index];
    const src = playbackUrl(work);
    if (!src) return;

    window.IAD_BGM?.videoStarted();
    slide.fallback?.remove();
    slide.fallback = null;
    slide.playButton.disabled = true;
    slide.element.classList.add('is-loading');
    const frame = document.createElement('iframe');
    frame.className = 'embed-frame';
    frame.title = work.title || work.category;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.addEventListener('error', () => restorePoster(slide, true));
    slide.frame = frame;
    frame.src = src;
    slide.element.append(frame);
    if (work.videoType === 'tiktok') {
      slide.fallbackTimer = setTimeout(() => {
        if (slide.frame === frame && !slide.element.classList.contains('is-playing')) restorePoster(slide, true);
      }, 14000);
    }
    if (work.videoType === 'youtube') {
      loadYouTubeApi().then(YT => {
        if (slide.frame !== frame || index !== currentWorkIndex() || snapping || burstActive) return;
        if (!YT?.Player) {
          restorePoster(slide);
          return;
        }
        slide.player = new YT.Player(frame, {
          events: {
            onReady: event => {
              if (slide.frame !== frame || index !== currentWorkIndex() || snapping || burstActive) {
                event.target.destroy();
                return;
              }
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: event => {
              if (event.data === 1) revealIfPlaying(slide, index);
            else if (event.data === 2) markVideoPaused(slide);
            },
            onError: () => {
              if (slide.frame === frame) restorePoster(slide);
            }
          }
        });
      }).catch(() => {
        if (slide.frame === frame) restorePoster(slide);
      });
    }
  }

  function render() {
    empty.hidden = true;
    const progress = clamp(Math.abs(position), 0, 1);
    const personScale = 1 - progress * .44;
    const personY = progress * innerHeight * .18;
    anchorSlide.element.style.transform = `translate3d(-50%, calc(-50% + ${personY}px), ${-progress * 95}px) scale(${personScale})`;
    anchorSlide.element.style.opacity = '1';
    anchorSlide.element.style.zIndex = '12';

    slides.forEach((slide, index) => {
      const delta = slide.work.position - position;
      const distance = Math.abs(delta);
      const sideDistance = Math.min(distance, 1);
      const scale = distance < 1
        ? mix(1, .34, distance)
        : Math.max(.12, .34 - (distance - 1) * .052);
      const opacity = distance < 1
        ? mix(1, .78, distance)
        : Math.max(.28, .78 - (distance - 1) * .085);
      const fanDepth = clamp(distance, 0, 6);
      const fanIndex = Math.min(5, Math.floor(fanDepth));
      const fanOffset = mix(FAN_OFFSETS[fanIndex], FAN_OFFSETS[fanIndex + 1], fanDepth - fanIndex);
      const x = Math.sign(delta) * fanOffset * innerWidth;
      const centerY = slide.work.aspectRatio.startsWith('9') ? -innerHeight * .27 : -innerHeight * .22;
      const sideY = -innerHeight * (.09 + Math.max(0, fanDepth - 1) * .055);
      const y = distance < 1 ? mix(centerY, sideY, distance) : sideY;
      const rotateY = -Math.sign(delta) * Math.min(distance * 3.2, 20);
      const z = -Math.min(distance, 7) * 48;
      const card = slide.element;
      card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(distance < .5 ? 22 : Math.max(1, 11 - Math.round(distance)));
      card.style.filter = 'none';
      const isSelected = !burstActive && !snapping && slide.work.position === selected;
      card.classList.toggle('is-active', isSelected);
      card.classList.toggle('is-selected', isSelected);
      card.classList.toggle('is-side', !isSelected);
      card.setAttribute('aria-hidden', distance < .5 ? 'false' : 'true');
    });
  }

  function settle() {
    if (!burstActive) return;
    const projected = clamp(position + velocity / 6.2, MIN_POSITION, MAX_POSITION);
    const direction = Math.sign(burstIntent);
    const projectedTravel = Math.abs(projected - burstAnchor);
    let stepCount = Math.max(Math.round(projectedTravel), Math.round(Math.abs(burstIntent)));
    if (burstIntent !== 0) stepCount = Math.max(1, stepCount);
    stepCount = Math.min(4, stepCount);
    snapTarget = clamp(burstAnchor + direction * stepCount, MIN_POSITION, MAX_POSITION);
    if (!direction) snapTarget = clamp(Math.round(position + velocity / 6.2), MIN_POSITION, MAX_POSITION);
    snapping = true;
    velocity = 0;
    ensureFrame();
  }

  function finishSnap() {
    selected = clamp(Math.round(snapTarget), MIN_POSITION, MAX_POSITION);
    position = snapTarget = selected;
    velocity = 0;
    snapping = false;
    burstActive = false;
    burstIntent = 0;
    render();
    updateInfo(true);
  }

  function animate(time) {
    if (!lastFrame) lastFrame = time;
    const dt = Math.min(.04, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time;
    if (snapping && snapTarget !== null) {
      position += (snapTarget - position) * (1 - Math.exp(-dt / .078));
      if (Math.abs(snapTarget - position) < .002) {
        finishSnap();
        frameId = 0;
        lastFrame = 0;
        return;
      }
    } else {
      const next = position + velocity * dt;
      position = clamp(next, MIN_POSITION, MAX_POSITION);
      if (position === MIN_POSITION && velocity < 0 || position === MAX_POSITION && velocity > 0) velocity = 0;
      velocity *= Math.exp(-6.2 * dt);
    }
    render();
    frameId = requestAnimationFrame(animate);
  }

  function ensureFrame() {
    if (!frameId) frameId = requestAnimationFrame(animate);
  }

  function canMove(delta) {
    return !(position <= MIN_POSITION && delta < 0 && velocity <= 0)
      && !(position >= MAX_POSITION && delta > 0 && velocity >= 0);
  }

  function onWheel(event) {
    if (innerWidth <= 700 || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();
    const modeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = clamp(event.deltaY * modeFactor, -240, 240);
    if (!canMove(delta)) return;
    setInteracting();
    stopPlayback();
    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected;
      burstIntent = 0;
    }
    if (snapping && burstIntent && Math.sign(burstIntent) !== Math.sign(delta)) {
      velocity = 0;
      snapping = false;
      snapTarget = null;
    }
    clearInfoForMotion();
    snapping = false;
    snapTarget = null;
    burstIntent += delta * .004;
    velocity = clamp(velocity + delta * .016, -4.2, 4.2);
    ensureFrame();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 125);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  function onPointerUp(event) {
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const elapsed = Math.max(1, performance.now() - touchStart.time);
    touchStart = null;
    if (Math.abs(dy) <= 35 || Math.abs(dy) <= Math.abs(dx) * 1.2) return;
    const direction = dy < 0 ? -1 : 1;
    if (!canMove(direction)) return;
    setInteracting();
    stopPlayback();
    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected;
      burstIntent = 0;
    }
    if (snapping && burstIntent && Math.sign(burstIntent) !== direction) {
      velocity = 0;
      snapping = false;
      snapTarget = null;
    }
    clearInfoForMotion();
    snapping = false;
    snapTarget = null;
    const swipeImpulse = clamp(Math.abs(dy) / elapsed * 1.4, .8, 3.8);
    velocity = clamp(velocity + direction * swipeImpulse, -4.2, 4.2);
    burstIntent += direction;
    ensureFrame();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 125);
  }

  works.forEach((work, index) => {
    const article = document.createElement('article');
    article.className = `slide${work.aspectRatio.startsWith('9') ? ' slide--portrait' : ''}`;
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', 'artwork');
    article.setAttribute('aria-label', `${work.position < 0 ? 'LEFT' : 'RIGHT'} ${pad(Math.abs(work.position))} of 06${work.title ? `: ${work.title}` : ''}`);
    article.style.aspectRatio = work.aspectRatio;
    const depth = Math.abs(work.position) - 1;
    const initialX = Math.sign(work.position) * (innerWidth * (.035 + depth * .012));
    article.style.transform = `translate3d(calc(-50% + ${initialX}px), calc(-50% - ${innerHeight * .035}px), -${depth * 12}px) rotateY(${-Math.sign(work.position) * 4}deg) scale(.22)`;
    article.style.opacity = '.58';
    const poster = document.createElement('img');
    poster.className = 'slide-poster';
    poster.src = work.thumbnail;
    poster.alt = work.title || work.category;
    poster.loading = 'lazy';
    poster.decoding = 'async';
    poster.draggable = false;
    poster.style.setProperty('--idle-duration', `${10 + (index % 5)}s`);
    poster.style.setProperty('--idle-delay', `${-index * .7}s`);
    poster.addEventListener('error', () => {
      const fallback = work.thumbnailFallback && new URL(work.thumbnailFallback, document.baseURI).href;
      if (fallback && poster.src !== fallback) {
        poster.src = fallback;
        return;
      }
      article.classList.add('poster-unavailable');
    });
    article.append(poster);
    const shade = document.createElement('span');
    shade.className = 'play-shade';
    shade.setAttribute('aria-hidden', 'true');
    article.append(shade);
    const playButton = document.createElement('button');
    playButton.className = 'play-trigger';
    playButton.type = 'button';
    playButton.innerHTML = '<svg class="play-triangle" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points="20,10 90,50 20,90"></polygon></svg>';
    playButton.insertAdjacentHTML('beforeend', '<span class="pause-mark" aria-hidden="true">Ⅱ</span>');
    playButton.setAttribute('aria-label', `播放 ${work.title || work.category}`);
    playButton.setAttribute('aria-pressed', 'false');
    playButton.addEventListener('click', event => {
      event.stopPropagation();
      startPlayback(index);
    });
    article.append(playButton);
    rail.append(article);
    slides.push({ element: article, poster, shade, playButton, work, frame: null, player: null, fallback: null, fallbackTimer: 0 });
  });

  const anchorElement = document.createElement('article');
  anchorElement.className = 'slide slide-anchor';
  anchorElement.setAttribute('role', 'img');
  anchorElement.setAttribute('aria-label', 'Xavier + Sandwich');
  const anchorImage = document.createElement('img');
  anchorImage.className = 'slide-poster';
  anchorImage.src = 'xaviersandwich.png';
  anchorImage.alt = 'Xavier + Sandwich';
  anchorImage.loading = 'eager';
  anchorImage.decoding = 'async';
  anchorImage.draggable = false;
  anchorImage.style.setProperty('--idle-duration', '12s');
  anchorElement.append(anchorImage);
  rail.append(anchorElement);
  anchorSlide = { element: anchorElement };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('message', onTikTokMessage);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', () => { touchStart = null; });
  window.addEventListener('resize', render);

  updateInfo(false);
  gallery.classList.add('is-opening');
  requestAnimationFrame(() => {
    render();
    window.setTimeout(() => gallery.classList.remove('is-opening'), 1850);
  });
})();
