(() => {
  const works = Array.isArray(window.IAD_WORKS) ? window.IAD_WORKS : [];
  const rail = document.querySelector('#rail');
  const stage = document.querySelector('#stage');
  const info = document.querySelector('.work-info');
  const counter = document.querySelector('.counter');
  const title = document.querySelector('#work-title');
  const type = document.querySelector('#work-type');
  const currentLabel = document.querySelector('#current');
  const totalLabel = document.querySelector('#total');
  const empty = document.querySelector('#empty');
  const slides = [];

  // Start in the gap between the last and first works: no work is selected yet.
  let position = works.length ? works.length - .5 : 0;
  let selected = null;
  let velocity = 0;
  let frameId = 0;
  let lastFrame = 0;
  let snapping = false;
  let snapTarget = null;
  let burstAnchor = position;
  let burstIntent = 0;
  let burstActive = false;
  let burstFromEmpty = true;
  let snapTimer = 0;
  let playbackTimer = 0;
  let infoTimer = 0;
  let youtubeApiPromise = null;
  let hasInteracted = false;
  let touchStart = null;

  const wrap = (n, length) => ((n % length) + length) % length;
  const pad = n => String(n).padStart(2, '0');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateInfo(animate = true) {
    clearTimeout(infoTimer);
    const hasSelection = selected !== null && works[selected];
    info.classList.toggle('is-empty', !hasSelection);
    if (animate && hasSelection) {
      info.classList.add('is-changing');
      counter.classList.add('is-changing');
    }
    const apply = () => {
      const work = hasSelection ? works[selected] : null;
      title.textContent = work?.title || '';
      type.textContent = work?.category || '';
      currentLabel.textContent = hasSelection ? pad(selected + 1) : '—';
      info.classList.remove('is-changing');
      counter.classList.remove('is-changing');
    };
    if (animate && hasSelection) infoTimer = setTimeout(apply, 130);
    else apply();
  }

  function stopPlayback() {
    clearTimeout(playbackTimer);
    slides.forEach(slide => {
      slide.element.classList.remove('is-playing');
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
      return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=0&muted=1&controls=0&music_info=0&description=0&playsinline=1`;
    }
    const origin = location.origin && location.origin !== 'null' ? `&origin=${encodeURIComponent(location.origin)}` : '';
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=0&mute=1&playsinline=1&controls=0&rel=0&enablejsapi=1${origin}`;
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
        document.head.append(api);
      });
    }
    return youtubeApiPromise;
  }

  function revealIfPlaying(slide, index) {
    if (slide.frame && selected === index && !snapping) slide.element.classList.add('is-playing');
  }

  function onTikTokMessage(event) {
    if (event.origin !== 'https://www.tiktok.com') return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data['x-tiktok-player'] !== true) return;
    const index = slides.findIndex(slide => slide.frame?.contentWindow === event.source);
    if (index < 0 || index !== selected || snapping) return;
    const slide = slides[index];
    if (data.type === 'onPlayerReady') {
      const target = 'https://www.tiktok.com';
      slide.frame.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'mute' }, target);
      slide.frame.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'play' }, target);
    } else if (data.type === 'onStateChange' && data.value === 1) {
      revealIfPlaying(slide, index);
    }
  }

  function startPlayback(index) {
    if (index !== selected || snapping || !works[index]) return;
    const slide = slides[index];
    if (slide.frame) return;
    const work = works[index];
    const src = playbackUrl(work);
    if (!src) return;

    const frame = document.createElement('iframe');
    frame.className = 'embed-frame';
    frame.title = work.title || '作品影片';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    slide.frame = frame;
    frame.src = src;
    slide.element.append(frame);
    if (work.videoType === 'youtube') {
      loadYouTubeApi().then(YT => {
        if (!YT?.Player || slide.frame !== frame || selected !== index || snapping) return;
        slide.player = new YT.Player(frame, {
          events: {
            onReady: event => {
              if (slide.frame !== frame || selected !== index || snapping) {
                event.target.destroy();
                return;
              }
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: event => {
              if (event.data === 1) revealIfPlaying(slide, index);
            }
          }
        });
      }).catch(() => {});
    }
  }

  function schedulePlayback(index) {
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => startPlayback(index), 400);
  }

  function render() {
    const count = slides.length;
    totalLabel.textContent = pad(count);
    empty.hidden = count !== 0;
    stage.classList.toggle('is-empty', selected === null && !hasInteracted);
    slides.forEach((slide, index) => {
      let delta = index - position;
      delta = ((delta + count / 2) % count + count) % count - count / 2;
      const abs = Math.abs(delta);
      const scale = abs < 1 ? 1 - abs * .24 : abs < 2 ? .76 - (abs - 1) * .26 : Math.max(.28, .50 - (abs - 2) * .075);
      const opacity = abs < 1 ? 1 - abs * .24 : abs < 2 ? .76 - (abs - 1) * .28 : Math.max(.12, .48 - (abs - 2) * .12);
      const blur = abs < 1 ? abs * .35 : abs < 2 ? .35 + (abs - 1) * .45 : Math.min(1.8, .8 + (abs - 2) * .2);
      const x = delta * (innerWidth < 700 ? 57 : 44);
      const rotateY = delta * -34;
      const translateZ = -Math.min(abs, 4) * (innerWidth < 700 ? 105 : 150);
      const card = slide.element;
      card.style.transform = `translate(-50%, -50%) translateX(${x}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.filter = `brightness(${Math.max(.8, 1 - abs * .055)}) blur(${blur}px)`;
      card.style.outlineColor = `rgba(38, 38, 35, ${Math.max(.025, .15 - abs * .04)})`;
      card.style.zIndex = String(20 - Math.round(abs * 2));
      card.classList.toggle('is-active', selected === index);
      card.classList.toggle('is-side', selected !== index);
      card.setAttribute('aria-hidden', abs < .5 ? 'false' : 'true');
    });
  }

  function settle() {
    if (!slides.length || !burstActive) return;
    const projected = position + velocity / 6.2;
    const displacement = projected - burstAnchor;
    let stepCount = Math.round(Math.abs(displacement));
    if (Math.abs(burstIntent) >= .02) stepCount = Math.max(1, stepCount);
    if (burstFromEmpty && burstIntent !== 0) stepCount = Math.max(1, stepCount);
    stepCount = Math.min(4, stepCount);
    const direction = Math.sign(Math.abs(displacement) >= .02 ? displacement : burstIntent);
    snapTarget = burstFromEmpty && direction && stepCount
      ? Math.round(burstAnchor + direction * .5) + direction * (stepCount - 1)
      : burstAnchor + direction * stepCount;
    if (!direction || !stepCount) snapTarget = burstAnchor;
    snapping = true;
    velocity = 0;
    ensureFrame();
  }

  function finishSnap() {
    const next = wrap(Math.round(snapTarget), slides.length);
    const changed = next !== selected;
    selected = next;
    position = snapTarget = next;
    velocity = 0;
    snapping = false;
    burstActive = false;
    burstIntent = 0;
    render();
    if (changed) updateInfo(true);
    if (hasInteracted) schedulePlayback(selected);
  }

  function animate(time) {
    if (!lastFrame) lastFrame = time;
    const dt = Math.min(.04, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time;

    if (snapping && snapTarget !== null) {
      position += (snapTarget - position) * (1 - Math.exp(-dt / .12));
      if (Math.abs(snapTarget - position) < .001) {
        finishSnap();
        frameId = 0;
        lastFrame = 0;
        return;
      }
    } else {
      position += velocity * dt;
      velocity *= Math.exp(-6.2 * dt);
    }

    render();
    frameId = requestAnimationFrame(animate);
  }

  function ensureFrame() {
    if (!frameId) frameId = requestAnimationFrame(animate);
  }

  function onWheel(event) {
    if (innerWidth <= 700 || !slides.length || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();
    hasInteracted = true;
    clearTimeout(playbackTimer);
    stopPlayback();

    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected === null ? position : selected;
      burstFromEmpty = selected === null;
      burstIntent = 0;
    }
    snapping = false;
    snapTarget = null;
    const modeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = clamp(event.deltaY * modeFactor, -240, 240);
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
    if (!touchStart || event.pointerType !== 'touch' || !slides.length) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const elapsed = Math.max(1, performance.now() - touchStart.time);
    touchStart = null;
    if (Math.abs(dx) <= 35 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;

    hasInteracted = true;
    clearTimeout(playbackTimer);
    stopPlayback();
    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected === null ? position : selected;
      burstFromEmpty = selected === null;
      burstIntent = 0;
    }
    snapping = false;
    snapTarget = null;
    const direction = dx < 0 ? 1 : -1;
    const swipeImpulse = clamp(Math.abs(dx) / elapsed * 2.2, .8, 3.8);
    velocity = clamp(velocity + direction * swipeImpulse, -4.2, 4.2);
    burstIntent += direction * clamp(Math.abs(dx) / 180, .35, 1.6);
    ensureFrame();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 125);
  }

  works.forEach((work, index) => {
    const article = document.createElement('article');
    article.className = 'slide';
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', 'slide');
    article.setAttribute('aria-label', `${index + 1} / ${works.length}: ${work.title}`);
    const poster = document.createElement('img');
    poster.className = 'slide-poster';
    poster.src = work.thumbnail;
    poster.alt = work.title || '';
    poster.loading = 'lazy';
    poster.decoding = 'async';
    poster.draggable = false;
    if (work.thumbnailFallback) {
      poster.addEventListener('error', () => {
        const fallback = new URL(work.thumbnailFallback, document.baseURI).href;
        if (poster.src !== fallback) poster.src = fallback;
      });
    }
    article.append(poster);
    rail.append(article);
    slides.push({ element: article, poster, frame: null });
  });

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('message', onTikTokMessage);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', () => { touchStart = null; });
  window.addEventListener('resize', render);

  render();
  updateInfo(false);
})();
