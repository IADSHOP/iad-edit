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

  let selected = 0;
  let position = 0;
  let targetPosition = 0;
  let animationFrame = 0;
  let motionPending = false;
  let hasInteracted = false;
  let playbackTimer = 0;
  let infoTimer = 0;
  let snapTimer = 0;
  let lastFrame = 0;
  let wheelGestureActive = false;
  let wheelBase = 0;
  let wheelDistance = 0;
  let queuedWheelDistance = 0;
  let queuedWheelSteps = 0;
  let touchStart = null;
  let animationEase = 150;

  const wrap = (n, length) => ((n % length) + length) % length;
  const nearestSlot = n => Math.sign(n) * Math.floor(Math.abs(n) + .5);
  const pad = n => String(n).padStart(2, '0');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateInfo(animate = true) {
    clearTimeout(infoTimer);
    if (animate) {
      info.classList.add('is-changing');
      counter.classList.add('is-changing');
    }
    const apply = () => {
      const work = works[selected];
      title.textContent = work?.title || '—';
      type.textContent = work?.category || '';
      currentLabel.textContent = works.length ? pad(selected + 1) : '00';
      info.classList.remove('is-changing');
      counter.classList.remove('is-changing');
    };
    if (animate) infoTimer = setTimeout(apply, 130);
    else apply();
  }

  function stopPlayback() {
    clearTimeout(playbackTimer);
    slides.forEach(slide => {
      slide.element.classList.remove('is-playing');
      if (slide.frame) {
        slide.frame.src = 'about:blank';
        slide.frame.remove();
        slide.frame = null;
      }
    });
  }

  function getVideoId(work) {
    try {
      const url = new URL(work.videoSource);
      if (work.videoType === 'youtube') {
        return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
      }
      const match = url.pathname.match(/\/video\/(\d+)/);
      return match?.[1] || '';
    } catch {
      return '';
    }
  }

  function embedUrlFor(work) {
    const id = getVideoId(work);
    if (!id) return '';
    if (work.videoType === 'tiktok') {
      return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&muted=1&controls=0&music_info=0&description=0&playsinline=1`;
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0`;
  }

  function startPlayback(index) {
    if (!hasInteracted || index !== selected || motionPending || !works[index]) return;
    stopPlayback();
    const work = works[index];
    const embedUrl = embedUrlFor(work);
    if (!embedUrl) return;

    const slide = slides[index];
    const frame = document.createElement('iframe');
    frame.className = 'embed-frame';
    frame.title = work.title || '作品影片';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.addEventListener('load', () => {
      if (slide.frame === frame && selected === index && !motionPending) {
        slide.element.classList.add('is-playing');
      }
    }, { once: true });
    frame.src = embedUrl;
    slide.frame = frame;
    slide.element.append(frame);
  }

  function schedulePlayback(index) {
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => startPlayback(index), 400);
  }

  function render() {
    const count = slides.length;
    totalLabel.textContent = pad(count);
    empty.hidden = count !== 0;

    slides.forEach((slide, index) => {
      let delta = index - position;
      delta = ((delta + count / 2) % count + count) % count - count / 2;
      const abs = Math.abs(delta);
      const card = slide.element;
      const scale = abs < 1 ? 1 - abs * .24 : abs < 2 ? .76 - (abs - 1) * .26 : Math.max(.28, .50 - (abs - 2) * .075);
      const opacity = abs < 1 ? 1 - abs * .24 : abs < 2 ? .76 - (abs - 1) * .28 : Math.max(.12, .48 - (abs - 2) * .12);
      const blur = abs < 1 ? abs * .35 : abs < 2 ? .35 + (abs - 1) * .45 : Math.min(1.8, .8 + (abs - 2) * .2);
      const x = delta * (innerWidth < 700 ? 57 : 44);
      const rotateY = delta * -34;
      const translateZ = -Math.min(abs, 4) * (innerWidth < 700 ? 105 : 150);

      card.style.transform = `translate(-50%, -50%) translateX(${x}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.filter = `brightness(${Math.max(.8, 1 - abs * .055)}) blur(${blur}px)`;
      card.style.outlineColor = `rgba(38, 38, 35, ${Math.max(.025, .15 - abs * .04)})`;
      card.style.zIndex = String(20 - Math.round(abs * 2));
      card.classList.toggle('is-active', abs < .02);
      card.classList.toggle('is-side', abs >= .02);
      card.setAttribute('aria-hidden', abs < .5 ? 'false' : 'true');
    });
  }

  function finishMotion() {
    const next = wrap(Math.round(position), slides.length);
    const changed = next !== selected;
    selected = next;
    position = targetPosition = next;
    motionPending = false;
    render();

    if (changed) updateInfo();
    if (queuedWheelSteps && hasInteracted) {
      const step = Math.sign(queuedWheelSteps);
      queuedWheelSteps -= step;
      beginStep(step);
      return;
    }
    if (hasInteracted) schedulePlayback(selected);
  }

  function animate(time) {
    if (!lastFrame) lastFrame = time;
    const dt = Math.min(40, time - lastFrame);
    lastFrame = time;
    const blend = 1 - Math.exp(-dt / animationEase);
    position += (targetPosition - position) * blend;

    if (Math.abs(targetPosition - position) < .001) {
      position = targetPosition;
      if (motionPending) finishMotion();
      else render();
      animationFrame = 0;
      lastFrame = 0;
      return;
    }
    render();
    animationFrame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  }

  function beginStep(step, swipeVelocity = 0) {
    if (!works.length || !step) return;
    stopPlayback();
    wheelGestureActive = false;
    wheelDistance = 0;
    clearTimeout(snapTimer);
    targetPosition = selected + Math.sign(step);
    animationEase = clamp(190 - swipeVelocity * 45, 115, 190);
    motionPending = true;
    startAnimation();
  }

  function queueWheelStep(distance) {
    queuedWheelDistance = clamp(queuedWheelDistance + distance, -1.8, 1.8);
    const wholeSteps = Math.trunc(queuedWheelDistance / .58);
    if (wholeSteps) {
      // Cap queued follow-up movement so a burst is played as steps, never skipped.
      queuedWheelSteps = clamp(queuedWheelSteps + wholeSteps, -2, 2);
      queuedWheelDistance -= wholeSteps * .58;
    }
  }

  function onWheel(event) {
    if (innerWidth <= 700 || Math.abs(event.deltaY) < .01 || !works.length) return;
    event.preventDefault();
    hasInteracted = true;
    stopPlayback();

    const modeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = clamp(event.deltaY * modeFactor * .04, -0.72, 0.72);

    if (motionPending && !wheelGestureActive) {
      queueWheelStep(delta);
      return;
    }

    if (!wheelGestureActive) {
      wheelGestureActive = true;
      wheelBase = selected;
      wheelDistance = 0;
    }
    wheelDistance = clamp(wheelDistance + delta, -.92, .92);
    targetPosition = wheelBase + wheelDistance;
    motionPending = false;
    startAnimation();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const step = Math.abs(wheelDistance) >= .18 ? Math.sign(wheelDistance) : nearestSlot(wheelDistance);
      wheelGestureActive = false;
      wheelDistance = 0;
      targetPosition = wheelBase + step;
      motionPending = true;
      startAnimation();
    }, 125);
  }

  function onTouchStart(event) {
    if (event.pointerType !== 'touch') return;
    touchStart = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  function onTouchEnd(event) {
    if (!touchStart || event.pointerType !== 'touch') return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const elapsed = Math.max(1, performance.now() - touchStart.time);
    touchStart = null;
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;

    hasInteracted = true;
    const direction = dx < 0 ? 1 : -1;
    if (motionPending) queuedWheelSteps = clamp(queuedWheelSteps + direction, -2, 2);
    else beginStep(direction, Math.abs(dx) / elapsed);
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
        if (poster.src !== new URL(work.thumbnailFallback, document.baseURI).href) {
          poster.src = work.thumbnailFallback;
        }
      });
    }
    article.append(poster);
    rail.append(article);
    slides.push({ element: article, poster, frame: null });
  });

  window.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onTouchStart);
  stage.addEventListener('pointerup', onTouchEnd);
  stage.addEventListener('pointercancel', () => { touchStart = null; });
  window.addEventListener('resize', render);

  render();
  updateInfo(false);
  // Keep the landing view quiet: playback only follows a deliberate selection.
})();
