/**
 * Al Page — lightweight, dependency-free interactions.
 * No external JavaScript libraries, scroll timers, image preloads, or blocking preloader.
 */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ready = (fn) => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

  ready(() => {
    const header = document.querySelector('.header');
    const navButton = document.getElementById('my-toggle');
    const navCollapse = document.getElementById('custom-collapse');
    const scrollUp = document.querySelector('.scroll-up');
    const navLinks = [...document.querySelectorAll('.navbar-nav a[href^="#"]')];
    const sections = [...document.querySelectorAll('#home, #services, #portfolio, #about, #contact')];

    // Smooth section navigation. Account for the sticky header.
    function jumpTo(hash) {
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY
        - (target.id === 'home' ? 0 : header.offsetHeight);
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const hash = link.getAttribute('href');
        if (!hash || hash === '#' || !document.getElementById(hash.slice(1))) return;
        event.preventDefault();
        jumpTo(hash);
        if (window.innerWidth < 768) setMenu(false);
      });
    });
    document.getElementById('scroll-up')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });

    // Bootstrap's CSS classes still style the mobile navbar; no Bootstrap JS needed.
    function setMenu(open) {
      navCollapse.classList.toggle('in', open);
      navButton.classList.toggle('collapsed', !open);
      navButton.setAttribute('aria-expanded', String(open));
    }
    navButton?.addEventListener('click', () => setMenu(!navCollapse.classList.contains('in')));
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && navCollapse.classList.contains('in')) setMenu(false);
    }, { passive: true });

    // A single, animation-frame-throttled scroll listener replaces multiple jQuery plugins.
    let scrollPending = false;
    const updateScroll = () => {
      scrollPending = false;
      const y = window.scrollY;
      scrollUp?.classList.toggle('is-visible', y > 100);
      header?.classList.toggle('is-stuck', y > 0 && header.getBoundingClientRect().top <= 0);
      let current = 'home';
      const threshold = (header?.offsetHeight || 0) + 80;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold) current = section.id;
      }
      navLinks.forEach((link) => link.parentElement.classList.toggle('active', link.hash === '#' + current));
    };
    const requestScroll = () => {
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(updateScroll);
      }
    };
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll, { passive: true });
    requestScroll();

    const pointerOK = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches;

    // Subtle 3D hover motion on Skills/About cards, independent of masonry.
    if (pointerOK) {
      document.querySelectorAll('.iconbox, .iconboxleft').forEach((card) => {
        let frame = null;
        card.addEventListener('pointermove', (event) => {
          if (frame !== null) return;
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / (rect.width || 1) - .5;
          const y = (event.clientY - rect.top) / (rect.height || 1) - .5;
          frame = requestAnimationFrame(() => {
            frame = null;
            card.style.setProperty('--card-tilt-x', `${(-y * 5).toFixed(2)}deg`);
            card.style.setProperty('--card-tilt-y', `${(x * 5).toFixed(2)}deg`);
          });
        }, { passive: true });
        card.addEventListener('pointerleave', () => {
          if (frame !== null) cancelAnimationFrame(frame);
          frame = null;
          card.style.removeProperty('--card-tilt-x');
          card.style.removeProperty('--card-tilt-y');
        });
      });
    }

    // Reveal animated elements only when approaching the screen.
    const animated = [...document.querySelectorAll('.wow')];
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
      document.documentElement.classList.add('animate-on-scroll');
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }, { rootMargin: '0px 0px 25px 0px', threshold: 0.08 });
      for (const element of animated) {
        if (element.dataset.wowDelay) element.style.setProperty('--reveal-delay', element.dataset.wowDelay);
        observer.observe(element);
      }
    }

    // Image-aware responsive masonry; filtered items move instead of waiting for ALL images to load.
    const portfolio = document.querySelector('.list-items-container');
    const items = portfolio ? [...portfolio.querySelectorAll('.list-item')] : [];
    const controls = [...document.querySelectorAll('#filter [data-group]')];
    let selectedGroup = 'all';
    let layoutPending = false;
    let previousColumns = 0;
    const active = (item) => selectedGroup === 'all' || (item.dataset.groups || '').split(/\s+/).includes(selectedGroup);
    function columns() {
      const width = window.innerWidth;
      return width > 1400 ? 4 : width > 900 ? 3 : width > 768 ? 2 : 1;
    }
    function layout() {
      layoutPending = false;
      if (!portfolio) return;
      const count = columns();
      const itemWidth = portfolio.clientWidth / count;
      if (!itemWidth) return;
      const heights = Array(count).fill(0);
      const gap = 20;
      for (const item of items) {
        if (!active(item)) continue;
        item.hidden = false;
        item.style.width = `${itemWidth}px`;
        let column = heights.indexOf(Math.min(...heights));
        item.style.transform = `translate3d(${Math.round(column * itemWidth)}px, ${Math.round(heights[column])}px, 0)`;
        heights[column] += item.getBoundingClientRect().height + gap;
      }
      portfolio.style.height = `${Math.max(0, Math.max(...heights) - gap)}px`;
      if (count !== previousColumns) {
        previousColumns = count;
        requestScroll();
      }
    }
    function scheduleLayout() {
      if (!layoutPending) {
        layoutPending = true;
        requestAnimationFrame(layout);
      }
    }
    if (portfolio && items.length) {
      portfolio.classList.add('js-masonry');
      for (const item of items) {
        for (const img of item.querySelectorAll('img')) {
          img.addEventListener('load', scheduleLayout);
          img.addEventListener('error', scheduleLayout);
        }
      }
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(scheduleLayout);
        items.forEach((item) => observer.observe(item));
        let lastWidth = portfolio.clientWidth;
        const widthObserver = new ResizeObserver(() => {
          const width = portfolio.clientWidth;
          if (width !== lastWidth) { lastWidth = width; scheduleLayout(); }
        });
        widthObserver.observe(portfolio);
      }
      window.addEventListener('resize', scheduleLayout, { passive: true });
      scheduleLayout();
    }
    function setFilter(group) {
      selectedGroup = group;
      for (const control of controls) {
        const chosen = control.dataset.group === group;
        control.classList.toggle('active', chosen);
        control.setAttribute('aria-pressed', String(chosen));
      }
      for (const item of items) {
        // Cancel an earlier transition if filters are clicked rapidly.
        if (item._hideTimer) clearTimeout(item._hideTimer);
        item._hideTimer = null;
        if (active(item)) {
          const wasHidden = item.hidden || item.classList.contains('filter-out');
          item.hidden = false;
          item.classList.remove('filter-out');
          if (wasHidden) {
            item.classList.add('filter-in');
            requestAnimationFrame(() => requestAnimationFrame(() => item.classList.remove('filter-in')));
          }
        } else {
          item.classList.add('filter-out');
          item._hideTimer = window.setTimeout(() => {
            if (!active(item)) item.hidden = true;
          }, reducedMotion.matches ? 0 : 200);
        }
      }
      scheduleLayout();
    }
    for (const control of controls) {
      control.addEventListener('click', () => setFilter(control.dataset.group));
      control.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setFilter(control.dataset.group);
        }
      });
    }

    // Play each hover GIF only ONCE and hold its actual final frame.
    // Most exported GIFs contain a NETSCAPE2.0 infinite-loop extension.
    // Removing that 19-byte metadata block leaves the original frames,
    // durations, quality and compression untouched; browsers then play
    // the animation once and stop on its final frame.
    function gifPlayOnce(buffer) {
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 19 || bytes[0] !== 71 || bytes[1] !== 73 || bytes[2] !== 70) {
        return new Blob([bytes], { type: 'image/gif' });
      }
      const isLoopId = (at, id) => {
        for (let i = 0; i < id.length; i++) {
          if (bytes[at + i] !== id.charCodeAt(i)) return false;
        }
        return true;
      };
      const pieces = [];
      let from = 0;
      // Standard GIF application extension: 21 FF 0B + 11-byte app ID
      // + 03 01 + 2-byte repeat count + 00 (block terminator).
      // Handles the two common GIF loop extension identifiers.
      for (let i = 13; i <= bytes.length - 19; i++) {
        if (bytes[i] !== 0x21 || bytes[i + 1] !== 0xFF || bytes[i + 2] !== 0x0B ||
            !(isLoopId(i + 3, 'NETSCAPE2.0') || isLoopId(i + 3, 'ANIMEXTS1.0')) ||
            bytes[i + 14] !== 0x03 || bytes[i + 15] !== 0x01 || bytes[i + 18] !== 0x00) continue;
        pieces.push(bytes.subarray(from, i));
        from = i + 19;
        i += 18;
      }
      pieces.push(bytes.subarray(from));
      return new Blob(pieces, { type: 'image/gif' });
    }

    // Start prefetching only when a motion tile approaches the viewport.
    // This greatly reduces first-hover looping while the one-shot GIF is
    // prepared. A native GIF is shown immediately if download isn't finished.
    // For file:// preview, run tools/stop_gif_loops.py after adding images.
    const gifObserver = ('IntersectionObserver' in window && location.protocol !== 'file:')
      ? new IntersectionObserver((entries, observer) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target._prepareOneShot?.();
            observer.unobserve(entry.target);
          }
        }, { rootMargin: '550px 0px' })
      : null;
    for (const item of items.filter((node) => node.classList.contains('motion'))) {
      const preview = item.querySelector('img[id]');
      if (!preview) continue;
      const still = preview.getAttribute('src');
      const animatedSrc = still.replace(/\.jpg$/i, '-active.gif');
      let hovering = false;
      let convertedGif = null;
      let request = null;
      let objectUrl = null;

      const releaseUrl = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      };
      const playOneShot = () => {
        if (!hovering || !convertedGif) return;
        releaseUrl();
        // A fresh blob URL restarts playback at the first GIF frame.
        objectUrl = URL.createObjectURL(convertedGif);
        preview.src = objectUrl;
      };
      const prepare = () => {
        if (location.protocol === 'file:' || request || convertedGif) return;
        request = fetch(animatedSrc)
          .then((response) => {
            if (!response.ok) throw new Error(`GIF request returned HTTP ${response.status}`);
            return response.arrayBuffer();
          })
          .then((buffer) => {
            convertedGif = gifPlayOnce(buffer);
            if (hovering) playOneShot();
          })
          .catch((error) => {
            console.warn('One-shot GIF preparation unavailable:', animatedSrc, error);
          })
          .finally(() => { request = null; });
      };
      item._prepareOneShot = prepare;
      gifObserver?.observe(item);
      const show = () => {
        if (hovering) return;
        hovering = true;
        if (convertedGif) playOneShot();
        else {
          // First frames are displayed while any download completes.
          preview.src = animatedSrc;
          prepare();
        }
      };
      const hide = () => {
        hovering = false;
        if (preview.getAttribute('src') !== still) preview.src = still;
        releaseUrl();
      };
      item.addEventListener('pointerenter', show);
      item.addEventListener('pointerleave', hide);
      item.addEventListener('focusin', show);
      item.addEventListener('focusout', hide);
    }

    // Browser-native, keyboard-accessible image gallery instead of Magnific Popup.
    const gallery = [...document.querySelectorAll('.simple-ajax-popup')];
    if (gallery.length && typeof HTMLDialogElement !== 'undefined') {
      const dialog = document.createElement('dialog');
      dialog.className = 'portfolio-lightbox';
      dialog.setAttribute('aria-label', 'Portfolio image gallery');
      dialog.innerHTML = `
        <button class="lightbox-close" type="button" aria-label="Close image">&times;</button>
        <button class="lightbox-prev" type="button" aria-label="Previous image">&#8249;</button>
        <img alt="">
        <button class="lightbox-next" type="button" aria-label="Next image">&#8250;</button>
        <div class="lightbox-missing" hidden>Image not included in this copy.</div>`;
      document.body.appendChild(dialog);
      const image = dialog.querySelector('img');
      const missing = dialog.querySelector('.lightbox-missing');
      let current = 0;
      function show(index) {
        current = (index + gallery.length) % gallery.length;
        missing.hidden = true;
        image.hidden = false;
        image.alt = gallery[current].closest('figure')?.querySelector('.portfolio-item-title')?.textContent.trim() || 'Portfolio image';
        image.src = gallery[current].getAttribute('href');
      }
      image.addEventListener('error', () => { image.hidden = true; missing.hidden = false; });
      gallery.forEach((link, index) => {
        link.setAttribute('aria-label', `Open portfolio image ${index + 1}`);
        link.addEventListener('click', (event) => {
          event.preventDefault();
          show(index);
          if (!dialog.open) dialog.showModal();
        });
      });
      dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
      dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
      dialog.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
      });
    }
  });
})();
