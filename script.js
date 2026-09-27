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
  let anchorSlide;
  // The opening image is carousel item 0; video works follow it at positions 1..N.
  let position = 0;
  let selected = null;
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
  let youtubeApiPromise = null;
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

  function clearSelectionForMotion() {
    if (selected === null) return;
    selected = null;
    clearTimeout(infoTimer);
    info.classList.add('is-changing');
    counter.classList.add('is-changing');
    infoTimer = setTimeout(() => {
      if (selected !== null) return;
      title.textContent = '';
      type.textContent = '';
      currentLabel.textContent = '—';
      info.classList.add('is-empty');
      info.classList.remove('is-changing');
      counter.classList.remove('is-changing');
    }, 130);
  }

  function stopPlayback() {
    slides.forEach(slide => {
      slide.element.classList.remove('is-playing', 'is-loading');
      slide.playButton.disabled = false;
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
    window.IAD_BGM?.videoStopped();
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
    if (slide.frame && selected === index && !snapping) {
      slide.element.classList.remove('is-loading');
      slide.playButton.disabled = false;
      slide.element.classList.add('is-playing');
    }
  }

  function restorePoster(slide) {
    slide.element.classList.remove('is-playing', 'is-loading');
    slide.playButton.disabled = false;
    if (slide.player) {
      try { slide.player.destroy(); } catch { /* The frame may already be navigating away. */ }
      slide.player = null;
    }
    if (slide.frame) {
      slide.frame.src = 'about:blank';
      slide.frame.remove();
      slide.frame = null;
    }
    window.IAD_BGM?.videoStopped();
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
    } else if (data.type === 'onError') {
      restorePoster(slide);
    }
  }

  function startPlayback(index) {
    if (index !== selected || snapping || !works[index]) return;
    const slide = slides[index];
    if (slide.frame) return;
    const work = works[index];
    const src = playbackUrl(work);
    if (!src) return;

    window.IAD_BGM?.videoStarted();

    slide.playButton.disabled = true;
    slide.element.classList.add('is-loading');
    const frame = document.createElement('iframe');
    frame.className = 'embed-frame';
    frame.title = work.title || '作品影片';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.addEventListener('error', () => restorePoster(slide));
    slide.frame = frame;
    frame.src = src;
    slide.element.append(frame);
    if (work.videoType === 'youtube') {
      loadYouTubeApi().then(YT => {
        if (slide.frame !== frame || selected !== index || snapping) return;
        if (!YT?.Player) {
          restorePoster(slide);
          return;
        }
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
            },
            onError: () => {
              if (slide.frame === frame) restorePoster(slide);
            }
          }
        });
      }).catch(() => {});
    }
  }

  function render() {
    const items = [anchorSlide, ...slides];
    const count = items.length;
    totalLabel.textContent = pad(slides.length);
    empty.hidden = true;
    items.forEach((slide, index) => {
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
      const isSelected = !burstActive && !snapping && (index === 0 ? selected === null : selected === index - 1);
      card.classList.toggle('is-active', isSelected);
      card.classList.toggle('is-selected', isSelected);
      card.classList.toggle('is-side', !isSelected);
      card.setAttribute('aria-hidden', abs < .5 ? 'false' : 'true');
    });
  }

  function settle() {
    if (!slides.length || !burstActive) return;
    const projected = position + velocity / 6.2;
    const direction = Math.sign(burstIntent);
    const projectedTravel = Math.max(0, (projected - burstAnchor) * direction);
    let stepCount = Math.max(Math.round(projectedTravel), Math.round(Math.abs(burstIntent)));
    // A tiny input still moves one item; repeated inputs accumulate symmetrically.
    if (burstIntent !== 0) stepCount = Math.max(1, stepCount);
    stepCount = Math.min(4, stepCount);
    snapTarget = direction && stepCount ? burstAnchor + direction * stepCount : burstAnchor;
    snapping = true;
    velocity = 0;
    ensureFrame();
  }

  function finishSnap() {
    const itemPosition = wrap(Math.round(snapTarget), slides.length + 1);
    const next = itemPosition === 0 ? null : itemPosition - 1;
    const changed = next !== selected;
    selected = next;
    position = snapTarget = itemPosition;
    velocity = 0;
    snapping = false;
    burstActive = false;
    burstIntent = 0;
    render();
    if (changed) updateInfo(true);
  }

  function animate(time) {
    if (!lastFrame) lastFrame = time;
    const dt = Math.min(.04, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time;

    if (snapping && snapTarget !== null) {
      position += (snapTarget - position) * (1 - Math.exp(-dt / .075));
      if (Math.abs(snapTarget - position) < .002) {
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
    stopPlayback();

    const modeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = clamp(event.deltaY * modeFactor, -240, 240);
    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected === null ? 0 : selected + 1;
      burstIntent = 0;
    }
    interruptSnapForDirection(Math.sign(delta));
    clearSelectionForMotion();
    snapping = false;
    snapTarget = null;
    burstIntent += delta * .004;
    velocity = clamp(velocity + delta * .016, -4.2, 4.2);
    ensureFrame();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 125);
  }

  function interruptSnapForDirection(direction) {
    if (!snapping || !burstActive || !direction || !burstIntent || Math.sign(burstIntent) === direction) return;
    // Keep the signed accumulated input, so reversal cancels prior travel naturally.
    velocity = 0;
    snapping = false;
    snapTarget = null;
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

    stopPlayback();
    if (!burstActive) {
      burstActive = true;
      burstAnchor = selected === null ? 0 : selected + 1;
      burstIntent = 0;
    }
    const direction = dx < 0 ? 1 : -1;
    interruptSnapForDirection(direction);
    clearSelectionForMotion();
    snapping = false;
    snapTarget = null;
    const swipeImpulse = clamp(Math.abs(dx) / elapsed * 2.2, .8, 3.8);
    velocity = clamp(velocity + direction * swipeImpulse, -4.2, 4.2);
    burstIntent += direction;
    ensureFrame();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 125);
  }

  function renderAnchorCutout(image) {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;
    try {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.className = 'slide-poster anchor-cutout';
      canvas.width = width;
      canvas.height = height;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', image.alt);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const frame = context.getImageData(0, 0, width, height);
      const pixels = frame.data;
      const count = width * height;
      const background = [0, 0, 0];
      let samples = 0;
      const top = Math.max(1, Math.floor(height * .02));
      for (let x = Math.floor(width * .02); x < width * .98; x += 8) {
        const offset = (top * width + x) * 4;
        background[0] += pixels[offset];
        background[1] += pixels[offset + 1];
        background[2] += pixels[offset + 2];
        samples++;
      }
      for (let channel = 0; channel < 3; channel++) background[channel] /= samples;

      const isBackdrop = index => {
        const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
        const lightness = (r + g + b) / 3;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const dr = r - background[0], dg = g - background[1], db = b - background[2];
        return lightness > 185 && chroma < 38 && dr * dr + dg * dg + db * db < 2500;
      };

      const mask = new Uint8Array(count);
      const queue = new Int32Array(count);
      let read = 0, write = 0;
      const add = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const point = y * width + x;
        if (mask[point]) return;
        const offset = point * 4;
        if (!isBackdrop(offset)) return;
        mask[point] = 1;
        queue[write++] = point;
      };
      for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1); }
      for (let y = 1; y < height - 1; y += 1) { add(0, y); add(width - 1, y); }
      while (read < write) {
        const point = queue[read++];
        const x = point % width;
        const y = (point - x) / width;
        add(x - 1, y); add(x + 1, y); add(x, y - 1); add(x, y + 1);
      }

      for (let point = 0; point < count; point++) {
        if (!mask[point]) continue;
        const offset = point * 4;
        pixels[offset + 3] = 0;
        const x = point % width;
        const y = (point - x) / width;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!dx && !dy || nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (mask[neighbor]) continue;
          const near = neighbor * 4;
          const dr = pixels[near] - background[0], dg = pixels[near + 1] - background[1], db = pixels[near + 2] - background[2];
          const distance = Math.sqrt(dr * dr + dg * dg + db * db);
          if (distance < 48) pixels[near + 3] = Math.min(pixels[near + 3], Math.round(clamp((distance - 8) / 40, 0, 1) * 255));
        }
      }
      context.putImageData(frame, 0, 0);
      image.replaceWith(canvas);
      anchorSlide.poster = canvas;
    } catch {
      // Keep the original image visible if canvas processing is unavailable.
    }
  }

  const anchorElement = document.createElement('article');
  anchorElement.className = 'slide slide-anchor';
  anchorElement.setAttribute('role', 'group');
  anchorElement.setAttribute('aria-roledescription', 'slide');
  anchorElement.setAttribute('aria-label', '中央觀看位置：本人與三明治');
  const anchorImage = document.createElement('img');
  anchorImage.className = 'slide-poster';
  anchorImage.src = '本人圖.jfif';
  anchorImage.alt = '本人與三明治背對鏡頭';
  anchorImage.loading = 'eager';
  anchorImage.decoding = 'async';
  anchorImage.draggable = false;
  anchorImage.addEventListener('load', () => renderAnchorCutout(anchorImage), { once: true });
  anchorElement.append(anchorImage);
  rail.append(anchorElement);
  anchorSlide = { element: anchorElement, poster: anchorImage, isAnchor: true };

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
    const shade = document.createElement('span');
    shade.className = 'play-shade';
    shade.setAttribute('aria-hidden', 'true');
    article.append(shade);
    const playButton = document.createElement('button');
    playButton.className = 'play-trigger';
    playButton.type = 'button';
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', `播放作品 ${work.title}`);
    playButton.addEventListener('click', event => {
      event.stopPropagation();
      startPlayback(index);
    });
    article.append(playButton);
    rail.append(article);
    slides.push({ element: article, poster, shade, playButton, frame: null, player: null });
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
