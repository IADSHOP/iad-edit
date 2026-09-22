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
  let playbackEnabled = true;
  let touchStart = null;
  let infoTimer = 0;
  let settleTimer = 0;
  let lastFrame = 0;

  const wrap = (n, length) => ((n % length) + length) % length;
  const nearestSlot = n => Math.sign(n) * Math.floor(Math.abs(n) + .5);
  const pad = n => String(n).padStart(2, '0');

  function updateInfo() {
    info.classList.add('is-changing');
    counter.classList.add('is-changing');
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => {
      if (works.length) {
        title.textContent = works[selected].title || works[selected].src;
        type.textContent = works[selected].type || 'SELECTED WORK';
        currentLabel.textContent = pad(selected + 1);
      } else {
        title.textContent = '—'; type.textContent = ''; currentLabel.textContent = '00';
      }
      info.classList.remove('is-changing');
      counter.classList.remove('is-changing');
    }, 160);
  }

  function pauseVideos() {
    playbackEnabled = false;
    slides.forEach(({ frame }) => {
      if (frame) {
        frame.removeAttribute('src');
        frame.hidden = true;
      }
    });
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
      card.style.pointerEvents = abs > 2 ? 'none' : 'auto';
      card.classList.toggle('is-active', abs < .02);
      card.classList.toggle('is-side', abs >= .02);
      card.setAttribute('aria-hidden', abs < .5 ? 'false' : 'true');

      if (abs < .02 && playbackEnabled) {
        if (!slide.frame) {
          const frame = document.createElement('iframe');
          frame.className = 'embed-frame';
          frame.title = works[index].title || '作品影片';
          frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
          frame.allowFullscreen = true;
          frame.referrerPolicy = 'strict-origin-when-cross-origin';
          slide.element.append(frame);
          slide.frame = frame;
        }
        const frame = slide.frame;
        const isTikTok = works[index].provider === 'tiktok';
        const embedUrl = isTikTok
          ? `https://www.tiktok.com/player/v1/${encodeURIComponent(works[index].id)}?autoplay=1&muted=1&controls=0&music_info=0&description=0&playsinline=1`
          : `https://www.youtube.com/embed/${encodeURIComponent(works[index].id)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0`;
        frame.hidden = false;
        if (frame.src !== embedUrl) frame.src = embedUrl;
      } else {
        if (slide.frame) {
          slide.frame.src = 'about:blank';
          slide.frame.hidden = true;
        }
      }
    });
  }

  function finishMotion() {
    const next = wrap(Math.round(position), slides.length);
    const changed = next !== selected;
    selected = next;
    targetPosition = position = next;
    motionPending = false;
    playbackEnabled = true;
    render();
    if (changed) updateInfo();
  }

  function animate(time) {
    if (!lastFrame) lastFrame = time;
    const dt = Math.min(40, time - lastFrame);
    lastFrame = time;
    const blend = 1 - Math.exp(-dt / 125);
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

  function scheduleSnap() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      targetPosition = nearestSlot(targetPosition);
      motionPending = true;
      startAnimation();
    }, 135);
  }

  function addMomentum(amount) {
    if (!slides.length) return;
    pauseVideos();
    const limit = 1.15;
    targetPosition += amount;
    targetPosition = Math.max(position - limit, Math.min(position + limit, targetPosition));
    motionPending = false;
    startAnimation();
    scheduleSnap();
  }

  function go(steps) {
    if (!slides.length || !steps) return;
    pauseVideos();
    clearTimeout(settleTimer);
    const base = nearestSlot(targetPosition);
    targetPosition = base + steps;
    motionPending = true;
    startAnimation();
  }

  works.forEach((work, index) => {
    const article = document.createElement('article');
    article.className = 'slide';
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', 'slide');
    article.setAttribute('aria-label', `${index + 1} / ${works.length}: ${work.title || work.src}`);
    const poster = document.createElement('img');
    poster.className = 'slide-poster';
    poster.src = work.poster;
    poster.alt = work.title || '';
    poster.draggable = false;
    article.append(poster);
    rail.append(article);
    slides.push({ element: article, poster, frame: null });
  });

  window.addEventListener('wheel', event => {
    if (innerWidth <= 700) return;
    event.preventDefault();
    const modeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = Math.max(-32, Math.min(32, event.deltaY * modeFactor));
    if (Math.abs(delta) > 0.01) addMomentum(delta * .10);
  }, { passive: false });

  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touchStart = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(dx < 0 ? 1 : -1);
    }
  });
  stage.addEventListener('pointercancel', () => { touchStart = null; });
  window.addEventListener('resize', render);
  render();
  updateInfo();
})();
