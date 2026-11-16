/**
 * Flight Deck V10 — lightweight terminal radar and instrument approach game.
 * All radar contacts, proximity alerts, and PAPI indications are FICTIONAL.
 * This is an interactive illustration, not ATC, TCAS or flight guidance.
 */
(() => {
  'use strict';
  const init = () => {
    const home = document.getElementById('home');
    const canvas = document.getElementById('aviation-canvas');
    if (!home || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rad = Math.PI / 180;
    const heading = h => String((Math.round(h) + 360) % 360).padStart(3, '0');
    const flightLevel = fl => String(Math.round(fl)).padStart(3, '0');
    const angleError = (to, from) => ((to - from + 540) % 360) - 180;
    const themeKeys = { a: 'sky', s: 'radar', d: 'night' };
    const validThemes = new Set(Object.values(themeKeys));
    const TRAFFIC_RATE = 0.35; // User-selected slower terminal radar simulation
    const AIRPORT_X = .58, AIRPORT_Y = .52;
    // Fictional scope scale: the thin approach ring is labelled 5 NM.
    const AIRPORT_5NM_SCREEN_RADIUS = .085;
    const HANDOFF_HOLD_SECONDS = 3.8;
    const MAX_INCIDENTS = 2;
    const labels = {
      sky: 'DAY VFR · CLEAR SKIES',
      radar: 'VECTOR DESK · SYNTHETIC TRAFFIC',
      night: 'NIGHT APPROACH · RWY 27'
    };
    const themeButtons = [...document.querySelectorAll('.theme-key')];
    const environmentLabel = document.getElementById('environment-label');
    const selectedName = document.getElementById('tracked-callsign');
    const alertCount = document.getElementById('radar-alert-count');
    const vectorReadout = document.getElementById('vector-readout');
    const trafficStatus = document.getElementById('traffic-status');
    const trafficDetail = document.getElementById('traffic-detail');
    const pauseTraffic = document.getElementById('radar-pause');
    const papiLabel = document.getElementById('night-papi');
    const papiLamps = document.getElementById('night-papi-lights');
    const localizerLabel = document.getElementById('night-localizer');
    const glideslopeLabel = document.getElementById('night-glideslope');
    const locNeedle = document.getElementById('night-loc-needle');
    const gsNeedle = document.getElementById('night-gs-needle');
    const instrumentLoc = document.getElementById('night-instrument-loc');
    const instrumentGs = document.getElementById('night-instrument-gs');
    const steerOutput = document.getElementById('night-steer-output');
    const sinkOutput = document.getElementById('night-sink-output');
    const steerMarker = document.getElementById('night-steer-marker');
    const sinkMarker = document.getElementById('night-sink-marker');
    let theme = 'sky', width = 0, height = 0, pixelRatio = 1;
    let onScreen = true, animating = false, raf = 0, lastFrame = 0;
    let simTime = 0, paused = false;
    let selected = null, drag = null, alertState = 'clear', lastStatusUpdate = -1000;
    let incidents = 0, lastConflictPhrase = '', nextTrack = 1, licenseNotified = false;
    const wrecks = [];
    const licensePopup = document.getElementById('game-popup');
    const popupAuthority = document.getElementById('game-popup-authority');
    const altReadout = document.getElementById('radar-altitude-label');
    const climbButton = document.getElementById('radar-climb');
    const descendButton = document.getElementById('radar-descend');
    const incidentReadout = document.getElementById('radar-incidents');
    const commReadout = document.getElementById('radar-comms');
    const nightAltitude = document.getElementById('night-altitude');
    const nightStatus = document.getElementById('night-approach-state');
    const approachMessage = document.getElementById('approach-message');
    const approachTitle = document.getElementById('approach-message-title');
    const approachText = document.getElementById('approach-message-text');
    let storyInitialized = false;
    let activeConflicts = [];
    const pointer = { x: .5, y: .55, active: false, overUI: false };
    const nightYoke = document.getElementById('night-yoke-cursor');
    const nightYokeGraphic = document.getElementById('night-yoke-graphic');
    const nightYokeStatus = document.getElementById('night-yoke-status');
    const radarMobileToggle = document.getElementById('radar-mobile-toggle');
    const radarMobileClose = document.getElementById('radar-mobile-close');
    const radarControlsPanel = document.getElementById('radar-controls-panel');
    const radarMobileSelected = document.getElementById('radar-mobile-selected');
    const tiltEnable = document.getElementById('night-tilt-enable');
    const tiltCalibrate = document.getElementById('night-tilt-calibrate');
    const motionStatus = document.getElementById('night-motion-status');
    const touchStick = document.getElementById('night-touch-stick');
    const touchKnob = document.getElementById('night-stick-knob');
    const tilt = { enabled:false, base:null, calibrated:false, lastEvent:0, x:0, y:0 };
    let touchStickPointer = null;
    const isTouchUI = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    function setRadarDrawer(open) {
      radarControlsPanel.classList.toggle('mobile-open',open);
      radarMobileToggle.setAttribute('aria-expanded',String(open));
    }
    radarMobileToggle.addEventListener('click', () => setRadarDrawer(!radarControlsPanel.classList.contains('mobile-open')));
    radarMobileClose.addEventListener('click', () => setRadarDrawer(false));
    function setMotionStatus(message) { motionStatus.textContent = message; }
    function useTouchFlight(x,y) {
      approach.controlX = clamp(x,-1,1);
      approach.controlY = clamp(y,-1,1);
      approach.hasInput = true;
      updateFlightControlVisuals();
    }
    function moveTouchStick(x,y) {
      const r=touchStick.getBoundingClientRect();
      const dx=clamp((x - (r.left+r.width/2))/(r.width*.38),-1,1);
      const dy=clamp((y - (r.top+r.height/2))/(r.height*.38),-1,1);
      touchKnob.style.transform = `translate(-50%,-50%) translate(${dx * r.width*.32}px,${dy * r.height*.32}px)`;
      useTouchFlight(dx,dy);
    }
    touchStick.addEventListener('pointerdown', e => {
      if(theme!=='night' || (e.pointerType==='mouse' && e.button!==0)) return;
      if(tilt.enabled) return;
      touchStickPointer=e.pointerId;
      touchStick.setPointerCapture?.(e.pointerId);
      moveTouchStick(e.clientX,e.clientY);
      e.preventDefault();
    });
    touchStick.addEventListener('pointermove', e => {
      if(touchStickPointer===e.pointerId) { moveTouchStick(e.clientX,e.clientY); e.preventDefault(); }
    });
    function finishStick(e) {
      if(touchStickPointer!==e.pointerId) return;
      touchStickPointer=null;
      touchKnob.style.transform='translate(-50%,-50%)';
      if(!tilt.enabled) useTouchFlight(0,0);
      if(touchStick.hasPointerCapture?.(e.pointerId)) touchStick.releasePointerCapture(e.pointerId);
    }
    touchStick.addEventListener('pointerup',finishStick);
    touchStick.addEventListener('pointercancel',finishStick);
    function motionAngle() {
      return (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    }
    // A new neutral is established when Night is selected or RECENTRE is pressed.
    function recalibrateTilt() {
      tilt.base = null;
      tilt.calibrated = false;
      tilt.x = 0; tilt.y = 0;
      useTouchFlight(0,0);
      if (tilt.enabled) setMotionStatus('Hold the device comfortably; taking this angle as level…');
    }
    function onOrientation(e) {
      if(!tilt.enabled || theme!=='night' || e.beta==null || e.gamma==null) return;
      const theta=motionAngle();
      const roll = e.gamma * Math.cos(theta) + e.beta * Math.sin(theta);
      const pitch = e.beta * Math.cos(theta) - e.gamma * Math.sin(theta);
      if(!tilt.base) {
        tilt.base={roll,pitch};
        tilt.calibrated=true;
        setMotionStatus('TILT ACTIVE · This is level · RECENTRE anytime');
      }
      const dx=clamp((roll-tilt.base.roll)/23,-1,1);
      // Tilting the top forward commands a faster descent.
      const dy=clamp((tilt.base.pitch-pitch)/24,-1,1);
      tilt.x += (dx-tilt.x)*.25;
      tilt.y += (dy-tilt.y)*.25;
      tilt.lastEvent=performance.now();
      useTouchFlight(tilt.x,tilt.y);
    }
    window.addEventListener('deviceorientation',onOrientation,{passive:true});
    tiltEnable.addEventListener('click', async () => {
      if(tilt.enabled) {
        tilt.enabled=false;
        tilt.base=null;
        tiltEnable.textContent='ENABLE TILT';
        tiltEnable.setAttribute('aria-pressed','false');
        tiltCalibrate.disabled=true;
        useTouchFlight(0,0);
        setMotionStatus('Tilt off · drag the touch yoke');
        return;
      }
      if (!window.DeviceOrientationEvent) {setMotionStatus('No motion sensor · use the touch yoke');return;}
      try {
        if(typeof DeviceOrientationEvent.requestPermission==='function') {
          const permission=await DeviceOrientationEvent.requestPermission();
          if(permission!=='granted') {setMotionStatus('Sensor permission denied · touch yoke available');return;}
        }
        tilt.enabled=true;
        tiltEnable.textContent='TILT ON';
        tiltEnable.setAttribute('aria-pressed','true');
        tiltCalibrate.disabled=false;
        recalibrateTilt();
      } catch (_) {setMotionStatus('Tilt unavailable · use touch yoke');}
    });
    tiltCalibrate.addEventListener('click', recalibrateTilt);
    // This is an accelerated game simulation, NOT a real-world flight model.
    // 8.25 NM at 315 ft/NM begins almost exactly on the nominal glidepath at 2,600 ft.
    const APPROACH_START_DISTANCE = 8.25;
    const APPROACH_GROUND_SPEED = .275;   // NM per game second (accelerated time)
    const GLIDEPATH_FEET_PER_NM = 315;
    const NOMINAL_DESCENT_RATE = APPROACH_GROUND_SPEED * GLIDEPATH_FEET_PER_NM;
    const approach = {
      controlX: 0, controlY: 0, lateral: 0, lateralRate: 0,
      distance: APPROACH_START_DISTANCE, altitude: 2600, descentRate: NOMINAL_DESCENT_RATE,
      runwayDrift: 0, bank: 0, whites: 2, phase: 'approach', phaseTime: 0,
      goodTime: 0, finalTime: 0, stableTail: 0, hasInput: false, localizer: 0,
      glideslope: 0, visualGlideslope: 0, runwayVisibility: .05
    };

    const flights = [
      ['ACA582', .65, .54, 205, 95, 245],
      ['WJA204', .81, .22, 120, 125, 284],
      ['DAL1842', .46, .22, 57, 75, 240],
      ['JZA492', .23, .71, 333, 110, 205],
      ['FLG4551', .39, .43, 96, 86, 188],
      ['ASA5271', .73, .82, 310, 140, 289],
      ['UAL1534', .87, .64, 252, 50, 255],
      ['CGR921', .20, .30, 161, 120, 222],
      ['PAL283', .54, .77, 5, 70, 198],
      ['N560HX', .67, .12, 202, 40, 190],
      ['SWA812', .15, .52, 82, 90, 244],
      ['BAW267', .91, .34, 280, 130, 275]
    ].map(([callsign,x,y,bearing,level,speed], i) => ({
      callsign, x, y, bearing, level, targetLevel:level, speed,
      targetBearing: bearing, targetSpeed: speed, baseSpeed: speed,
      baseVelocity: (.006 + (i % 4) * .0016) * TRAFFIC_RATE,
      trail: [], trailClock: 0, conflict: 'clear', crashed:false,
      speech:'', speechUntil:0, previousAlert:'clear', enteredSector: true, handoff: null, handoffUntil: 0
    }));
    const originalFlights = flights.map(t => ({...t, trail: []}));
    // Radio chatter is deliberately fictional and randomly chosen per event.
    const taQuips = [
      "ATC, is that other guy supposed to be there?",
      "Traffic in sight. Unfortunately.",
      "We appear to be sharing a very small piece of sky.",
      "Requesting a refund on this vector.",
      "That is extremely close for an introductory flight.",
      "ATC, confirm this is not a formation flight?",
      "Traffic spotted. Personal space not spotted.",
      "I can read the other pilot’s checklist from here.",
      "That aircraft is getting suspiciously detailed.",
      "ATC, I believe our separation has become theoretical.",
      "We are now close enough to exchange phone numbers.",
      "Was that a traffic advisory or a matchmaking service?",
      "I can see what the other pilot had for breakfast.",
      "That was not covered in the preflight briefing.",
      "Requesting slightly more sky, please.",
      "ATC, this seems like a good time to review your radar.",
      "We have traffic at twelve o’clock and rising anxiety.",
      "I thought this was controlled airspace.",
      "That aircraft appears to be occupying our future position.",
      "ATC, please advise if this is part of the airshow."
    ];
    const raQuips = [
      "TCAS: CLIMB! Also maybe scream a little.",
      "ATC, ready to copy a number... yours.",
      "Did we just invent formation flying?",
      "This is going directly in the incident report.",
      "We would prefer a different flight level, immediately.",
      "TCAS has requested hazard pay.",
      "ATC, we are currently reconsidering our career choices.",
      "I can now identify the other pilot by facial expression.",
      "Our TCAS just developed a nervous twitch.",
      "ATC, separation appears to be measured in centimetres.",
      "That was close enough to invalidate our insurance.",
      "TCAS says descend. My survival instinct says teleport.",
      "Mayday? Not yet. But keep the paperwork nearby.",
      "ATC, please stop introducing us to other aircraft.",
      "The other pilot just waved. I did not wave back.",
      "We have upgraded from traffic advisory to existential crisis.",
      "That manoeuvre was sponsored by pure adrenaline.",
      "ATC, our passengers have discovered religion.",
      "We are now conducting an unscheduled stress test.",
      "TCAS is yelling louder than my flight instructor."
    ];
    const crashQuips = [
      "Well, that is going to require two forms.",
      "ATC, there is a minor issue with the airspace.",
      "The insurance company has left the chat.",
      "The regulator would like a very long word.",
      "We regret to inform you that the separation was zero.",
      "ATC, you can cancel our flight following. Permanently.",
      "This is going to make the evening news.",
      "The Transportation Safety Board has entered the chat.",
      "ATC, confirm we are cleared to become debris?",
      "Our maintenance schedule just got significantly longer.",
      "The aircraft are now technically one aircraft.",
      "That was an exceptionally aggressive approach to formation flying.",
      "The flight school has begun updating its website.",
      "ATC, we have successfully reduced two radar targets to zero.",
      "The incident report now requires a table of contents.",
      "Somewhere, an aviation lawyer just felt a disturbance.",
      "Management has requested that we stop doing that.",
      "The good news is that neither aircraft is speeding anymore.",
      "This is why the simulator has a restart button.",
      "The NTSB would like to know who programmed this radar."
    ];
    const climbQuips = [
      "Climbing. The sky bill goes up too.",
      "Climbing. Gravity has filed a complaint.",
      "Roger, climbing. Fuel economy has left the chat.",
      "Climbing. We were getting tired of that altitude anyway.",
      "Climbing. The passengers have been informed. Emotionally.",
      "Going up. Hopefully this was the correct instruction.",
      "Climbing. The engine is expressing its concerns.",
      "Roger, climbing. The clouds are about to become colleagues.",
      "Climbing. We can almost see our house from here.",
      "Positive rate. Negative bank account.",
      "Climbing. The altimeter is doing its best.",
      "Roger, up we go. Physics permitting.",
      "Climbing. ATC apparently wants us closer to space.",
      "Ascending. The coffee has begun its own descent.",
      "Climbing. Our service ceiling would like a word.",
      "Roger, climbing. The aircraft reluctantly agrees.",
      "Climbing. The mountain was making us uncomfortable.",
      "Going up. This better not be another sightseeing detour.",
      "Climbing. The autopilot is questioning management.",
      "Roger, climbing. Please advise when we reach the moon."
    ];
    const descendQuips = [
      "Descending. Hope the terrain got the memo.",
      "Descending. Gravity has enthusiastically accepted.",
      "Roger, descending. The ground is looking increasingly detailed.",
      "Descending. The passengers have stopped asking questions.",
      "Going down. In a professionally controlled manner. Probably.",
      "Descending. Terrain separation remains a personal preference.",
      "Roger, descending. Gravity is handling most of the paperwork.",
      "Descending. The altimeter is counting down to something.",
      "Going down. We assume there is an airport involved.",
      "Descending. The mountains have requested a meeting.",
      "Roger, descending. We can now read the road signs.",
      "Descending. The ground appears to be approaching us as well.",
      "Going down. This better be the correct airport.",
      "Descending. Our landing gear would appreciate some advance notice.",
      "Roger, descending. The birds are becoming a concern.",
      "Descending. The flight attendants have stopped smiling.",
      "Going down. Hopefully not in the historical sense.",
      "Descending. The terrain awareness system is clearing its throat.",
      "Roger, descending. Our altitude is now on a budget.",
      "Descending. We would like to confirm the runway exists."
    ];
    function randomQuip(quips, previous = '') {
      if (quips.length === 1) return quips[0];
      let pick = quips[Math.floor(Math.random() * quips.length)];
      if (pick === previous) pick = quips[(quips.indexOf(pick) + 1) % quips.length];
      return pick;
    }

    // Fictional radio chatter for terminal sector handoffs.
    const towerQuips = [
      'Tower 123.45, copied. Please have the runway ready.',
      'Switching to tower. Your radar screen is now someone else’s problem.',
      '123.45, thanks Approach. We will try landing this one.',
      'Contacting tower. Time to trade vectors for pavement.',
      'Roger, tower 123.45. We can finally see a runway-shaped object.',
      'Switching frequency. Tell the next controller we behaved.',
      'Tower, good evening. Approach says we are your responsibility now.',
      '123.45, going to tower. Save us a parking spot.'
    ];
    const departureQuips = [
      'Departure, good day. We have successfully escaped that radar screen.',
      '124.70, checking in. The terminal controller sends their regards.',
      'Switching to departure. Our altitude is now someone else’s spreadsheet.',
      'Contact departure, copied. Thank you for your enthusiastic vectors.',
      '124.70, see you later. Preferably from a safer distance.',
      'Departure frequency set. Our pilots have stopped holding their breath.'
    ];
    const centreQuips = [
      'Centre 132.80, checking in. The terminal area has released us.',
      'Switching to centre. They say your radar has fewer surprises.',
      '132.80, good day. We made it out of the terminal zone.',
      'Thanks Approach. We are off to bother the next sector.',
      'Centre frequency selected. Please preserve our personal space.',
      '132.80 copied. Climbing into the land of cruise control.'
    ];
    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: ((i * 79.51 + 13) % 101) / 101,
      y: ((i * 48.73 + 11) % 83) / 110,
      alpha: .25 + (i % 5) * .10,
      radius: .55 + (i % 3) * .30,
      phase: i * .43
    }));


    // Four broad weather banks rather than tiny near-aircraft particles.
    // They grow and move from the centre/horizon up through the upper sky.
    // Broad, immersive cloud fields. Each bank is a quarter-screen or larger;
    // none of the miniature particle/streak shapes used in earlier versions.
    const cloudBanks = Array.from({length: 13}, (_, i) => ({
      lane: Math.sin(i * 2.17) * .46,
      depth: (i + .3) / 13,
      speed: .038 + (i % 4) * .004,
      size: 1.08 + (i % 4) * .13,
      sprite: i % 3
    }));
    function resetCloudBank(p) {
      p.lane = (Math.random() - .5) * 1.12;
      p.depth = -.02; // emerge unseen, then gradually fade in
      p.size = 1.05 + Math.random() * .43;
      p.speed = .034 + Math.random() * .012;
      p.sprite = Math.floor(Math.random() * 3);
    }
    const smoothstep = (a,b,v) => {const x=clamp((v-a)/(b-a),0,1); return x*x*(3-2*x);};
    // Bake each large, irregular, feathered cloud texture ONCE; per-frame work
    // is just a few drawImage operations rather than dozens of new gradients.
    function makeCloudSprite(seed) {
      const image = document.createElement('canvas');
      image.width = 700; image.height = 340;
      const paint = image.getContext('2d');
      if (!paint) return null;
      let n = seed * 9301 + 49297;
      const random = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
      // Irregular overlapping cloud masses; softly illuminated on upper edges.
      const drawLobe = (x,y,rx,ry,shade,opacity) => {
        paint.save();
        paint.translate(x,y); paint.scale(rx,ry);
        const g = paint.createRadialGradient(0,-.11,.01,0,0,1);
        g.addColorStop(0,`rgba(${shade},${Math.min(shade+15,255)},${Math.min(shade+32,255)},${opacity})`);
        g.addColorStop(.36,`rgba(${shade-22},${shade-7},${shade+12},${opacity*.83})`);
        g.addColorStop(.76,`rgba(87,111,145,${opacity*.30})`);
        g.addColorStop(1,'rgba(69,92,121,0)');
        paint.fillStyle=g; paint.fillRect(-1,-1,2,2);
        paint.restore();
      };
      // Broad diffuse body supplies the quarter-screen cloud-bank scale.
      drawLobe(350,187,330,125,186,.60);
      for(let i=0;i<21;i++) {
        const x=140+random()*420;
        const y=120+random()*98;
        const rx=66+random()*92;
        const ry=45+random()*65;
        drawLobe(x,y,rx,ry,158+Math.floor(random()*56),.30+random()*.24);
      }
      return image;
    }
    const cloudSprites = [makeCloudSprite(11),makeCloudSprite(27),makeCloudSprite(43)];
    const cloudLayer = document.createElement('canvas');
    const cloudPaint = cloudLayer.getContext('2d');
    function resize() {
      const bounds = home.getBoundingClientRect();
      width = Math.round(bounds.width);
      height = Math.round(bounds.height);
      pixelRatio = Math.min(1.6, window.devicePixelRatio || 1);
      if (!width || !height) return;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      cloudLayer.width = width;
      cloudLayer.height = Math.ceil(height * .75);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      render();
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(home);
    window.addEventListener('resize', resize, { passive: true });
    function shouldAnimate() {
      return !reduced.matches && !document.hidden && onScreen && (theme === 'radar' || theme === 'night');
    }
    function reconcile() {
      if (shouldAnimate() && !animating) {
        animating = true;
        lastFrame = 0;
        raf = requestAnimationFrame(tick);
      } else if (!shouldAnimate() && animating) {
        cancelAnimationFrame(raf);
        animating = false;
      }
      if (!animating) render();
    }
    function tick(time) {
      if (!shouldAnimate()) { animating = false; return; }
      raf = requestAnimationFrame(tick);
      if (lastFrame && time - lastFrame < 32) return; // ~30 fps
      const dt = lastFrame ? Math.min(.09, (time - lastFrame) / 1000) : 0;
      lastFrame = time;
      simTime += dt;
      if (theme === 'radar' && !paused && !licenseNotified) updateFlights(dt);
      if (theme === 'radar') {
        wrecks.forEach(w => { w.age += dt; });
        for(let k=wrecks.length-1;k>=0;k--) if(wrecks[k].age>5) wrecks.splice(k,1);
      }
      if (theme === 'night') {
        updateCloudVectors(dt);
        advanceApproach(dt);
      }
      render();
    }

    function updateCloudVectors(dt) {
      for (const bank of cloudBanks) {
        bank.depth += dt * bank.speed * (.48 + 2.0 * Math.pow(Math.max(0, bank.depth), 2.1));
        if (bank.depth > 1.14) resetCloudBank(bank);
      }
    }
    const observe = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      reconcile();
      reconcileStoryTimer();
    }, { threshold: .01 });
    observe.observe(home);
    document.addEventListener('visibilitychange', () => { reconcile(); reconcileStoryTimer(); });
    reduced.addEventListener?.('change', () => { reconcile(); reconcileStoryTimer(); });

    function setTheme(next) {
      if (!validThemes.has(next)) next = 'sky';
      const previousTheme = theme;
      theme = next;
      root.dataset.flightTheme = next;
      themeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === next)));
      environmentLabel.textContent = labels[next];
      drag = null; pointer.active = false;
      nightYoke.classList.remove('is-visible');
      if (next !== 'night') approachMessage.hidden = true;
      if (next === 'night' && previousTheme !== 'night') { resetApproach(); if(tilt.enabled) recalibrateTilt(); }
      if (next !== 'radar') setRadarDrawer(false);
      if (storyInitialized) { showLeg(0); reconcileStoryTimer(); }
      // Theme changes are temporary. A reload always starts a fresh Sky session.
      reconcile();
    }
    // Clear the persistent theme left by older versions (e.g. stuck in Night).
    try { localStorage.removeItem('garden-flight-theme'); } catch (_) { /* storage restricted */ }
    setTheme('sky');
    themeButtons.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));

    // The narrated flight log is entertaining but never blocks visitors from using the page.
    const stories = {
      sky: [
        ["OPENING", "I'm the guy who turned a portfolio into a mildly unnecessary aviation experience.", "Hi, my name is Al and I thought a normal homepage was simply too easy."],
        ["CONFESSION", "I fly actual airplanes, which somehow feels less chaotic than centering a div.", "My hobbies include aviation, design, and explaining to CSS that I am, in fact, in charge here."],
        ["ORIGIN STORY", "One day I wanted a website. Then I wanted it to feel alive.", "That is how this page became part portfolio, part cockpit, and part evidence for a future time-management intervention."],
        ["QUALIFICATIONS", "I like making things look sharp, move nicely, and occasionally behave themselves.", "Posters, logos, motion graphics, websites—if it needs polish, I usually want to touch it."],
        ["REALISM", "Yes, I am a pilot. No, that does not make me better at JavaScript.", "It only means I now say ‘that seems unstable’ when a button shifts by two pixels."],
        ["WORK ETHIC", "I genuinely enjoy learning new tools.", "Mostly because every project eventually bullies me into discovering one more thing I did not know yesterday."],
        ["FINE PRINT", "Everything below this hero section is my actual work.", "The weird flight deck above it is just my website having main-character energy."],
        ["HANDOFF", "Anyway, enough about the dramatic opening sequence.", "Scroll down, have a look around, and pretend this briefing was perfectly standard."]
      ],
      radar: [
        ["CHECK-IN", "I got handed the radar room and immediately adopted a deeply confident tone.", "Hi, my name is Al and apparently today I am also an air traffic controller."],
        ["POWER TRIP", "Every aircraft out there is waiting for me to sound important.", "Click one, draw a vector, and enjoy the brief thrill of issuing life-changing instructions with a mouse."],
        ["TECHNIQUE", "This is not realistic ATC, but it is realistic enough to create paperwork.", "Turns happen slowly, speeds are limited, and the pilots absolutely will judge your choices."],
        ["ALTITUDES", "Need vertical separation? Great. You can climb or descend them 1,000 feet at a time.", "Which is a polite way of saying you now have one more axis on which to cause problems."],
        ["HUMAN FACTORS", "When airplanes get too close, the radio chatter gets increasingly spicy.", "Nothing says professionalism like ‘ATC, ready to copy a number?’ appearing in a speech bubble."],
        ["CONSEQUENCES", "If two tracks actually collide, the simulator counts it as an incident.", "Two incidents and the regulator appears to ask why you turned the sector into a cutscene."],
        ["CAREER OUTLOOK", "You can still recover from a bad vector if you catch it early.", "Which is also my general approach to life, email, and accidentally deleting semicolons."],
        ["SHIFT END", "If the airspace seems busy, add more traffic.", "This is either confidence or a cry for help. Possibly both."]
      ],
      night: [
        ["BRIEFING", "The day shift is over, the lights are on, and now we are pretending this is a stable idea.", "Hi, my name is Al and I have elected to fly a night approach through clouds for your entertainment."],
        ["INSTRUMENT SCAN", "This time the mouse is not just for vibes—it controls where the airplane sits on approach.", "Steer left or right; move the mouse up to descend slower or down to descend faster. The needles will absolutely narc on you."],
        ["WEATHER", "The cloud ahead is no longer a flat fog wall.", "It now rushes toward you like you are actually flying into it, which feels dramatically more motivational."],
        ["VISUAL CUES", "The runway starts as a tiny glow and climbs into view as you fly closer. It stays very faint through the clouds.", "If that sounds poetic, it is. If it sounds safe, that depends entirely on your mouse hand."],
        ["PAPI JUDGEMENT", "Four little lights remain dedicated to evaluating your life choices.", "Keep them within one light of perfect and they may allow you to meet the runway instead of a go-around."],
        ["LOCALIZER", "The new localizer / glideslope instrument at the bottom tells you how crooked things have become.", "When the needles are centred, congratulations: you are briefly competent."],
        ["DECISION HEIGHT", "Break out of cloud, see the runway, and try not to overcorrect like a caffeinated student pilot.", "A smooth approach earns applause. A bad one earns a deeply theatrical go-around."],
        ["TOUCHDOWN", "If you nail it, you land. If not, the clouds come back and Radar gets you again.", "It is the circle of aviation life, except somehow with more JavaScript."]
      ]
    };
        const storyTitle = document.getElementById('story-title');
    const storyBody = document.getElementById('story-description');
    const storyStage = document.getElementById('story-stage');
    const storyCounter = document.getElementById('story-counter');
    const progress = document.getElementById('story-progress');
    const prev = document.getElementById('story-prev');
    const next = document.getElementById('story-next');
    const storyPlay = document.getElementById('story-autoplay');
    let legIndex = 0, autoStory = !reduced.matches, storyTimer = null;
    function showLeg(index) {
      const story = stories[theme];
      legIndex = (index + story.length) % story.length;
      const [stage, title, body] = story[legIndex];
      storyTitle.textContent = title;
      storyBody.textContent = body;
      storyStage.textContent = `${String(legIndex+1).padStart(2,'0')} / ${stage}`;
      storyCounter.textContent = `${String(legIndex+1).padStart(2,'0')} / ${String(story.length).padStart(2,'0')}`;
      progress.style.width = `${((legIndex + 1) / story.length) * 100}%`;
      progress.parentElement.setAttribute('aria-valuenow', String(legIndex + 1));
      prev.disabled = false;
      next.innerHTML = `${legIndex === story.length - 1 ? 'AGAIN' : 'NEXT'} <i class="fas fa-${legIndex === story.length - 1 ? 'redo' : 'chevron-right'}" aria-hidden="true"></i>`;
      home.dataset.storyPhase = String(legIndex + 1);
    }
    function reconcileStoryTimer() {
      if (storyTimer !== null) clearTimeout(storyTimer);
      storyTimer = null;
      if (autoStory && onScreen && !document.hidden && !reduced.matches) {
        storyTimer = setTimeout(() => { showLeg(legIndex + 1); reconcileStoryTimer(); }, 6500);
      }
    }
    function setAutoStory(isPlaying) {
      autoStory = isPlaying;
      storyPlay.textContent = isPlaying ? '❚❚ PAUSE' : '▶ PLAY';
      storyPlay.setAttribute('aria-pressed', String(isPlaying));
      storyPlay.title = isPlaying ? 'Pause the automatic story' : 'Resume the automatic story';
      reconcileStoryTimer();
    }
    prev.addEventListener('click', () => { showLeg(legIndex - 1); reconcileStoryTimer(); });
    next.addEventListener('click', () => { showLeg(legIndex + 1); reconcileStoryTimer(); });
    storyPlay.addEventListener('click', () => setAutoStory(!autoStory));
    showLeg(0);
    storyInitialized = true;
    setAutoStory(autoStory);

    window.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target?.isContentEditable || e.target?.closest?.('input, textarea, select, [role="textbox"]')) return;
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (themeKeys[key]) { e.preventDefault(); setTheme(themeKeys[key]); return; }
      const r = home.getBoundingClientRect();
      if (r.bottom < 120 || r.top > innerHeight - 100) return;
      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && !e.target?.closest?.('a, button')) {
        e.preventDefault(); showLeg(legIndex + (e.key === 'ArrowRight' ? 1 : -1)); reconcileStoryTimer();
      }
    });

    function pagePoint(e) {
      const r = home.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function isUI(e) { return !!e.target.closest('.theme-console, .radar-console, .night-console, .night-touch-stick, .night-motion-tools, .approach-instrument, a, button'); }
    function getContactAt(x,y) {
      const hits = [];
      for (const t of flights) {
        if (t.crashed || t.handoff) continue;
        const tx = t.x * width, ty = t.y * height;
        const ds = Math.hypot(tx - x, ty - y);
        // Accept both the aircraft glyph and the nearby data tag as selection points.
        const labelX = tx + (tx > width - 160 ? -122 : 12);
        const labelY = clamp(ty - 22, 18, height - 35);
        const onLabel = x >= labelX - 4 && x <= labelX + 130 && y >= labelY - 12 && y <= labelY + 27;
        if (ds <= (isTouchUI()?43:30) || onLabel) hits.push({ t, d: onLabel ? Math.min(ds, 22) : ds });
      }
      hits.sort((a,b) => a.d - b.d);
      return hits[0]?.t || null;
    }
    function selectTrack(t) {
      selected = t && !t.crashed && !t.handoff ? t : null;
      selectedName.textContent = selected ? selected.callsign : '— — —';
      radarMobileSelected.textContent = selected ? selected.callsign : 'SELECT TRACK';
      climbButton.disabled = descendButton.disabled = !selected;
      updateAltitudeReadout();
      updateVectorReadout();
      updateAlert(true);
      if (reduced.matches) render();
    }
    function updateAltitudeReadout() {
      const summary = selected
        ? `${selected.callsign} · FL${flightLevel(selected.level)} → FL${flightLevel(selected.targetLevel)} · 1,200 FPM SIM`
        : 'SELECT A TRACK TO CHANGE ALTITUDE';
      if (altReadout.textContent !== summary) altReadout.textContent = summary;
    }
    function commandAltitude(delta) {
      if (!selected || selected.crashed || selected.handoff) return;
      selected.targetLevel = clamp(Math.round(selected.targetLevel / 10) * 10 + delta, 30, 390);
      updateAltitudeReadout();
      selected.speech = randomQuip(delta > 0 ? climbQuips : descendQuips, selected.speech);
      selected.speechUntil = simTime + 3.2;
      commReadout.textContent = `${selected.callsign} · FL${flightLevel(selected.targetLevel)}: ${selected.speech}`;
      if (reduced.matches) render();
    }
    climbButton.addEventListener('click', () => commandAltitude(10));
    descendButton.addEventListener('click', () => commandAltitude(-10));
    function updateVectorReadout() {
      if (!selected) {
        vectorReadout.textContent = 'SELECT A TRACK · DRAG FROM THE AIRCRAFT TO ISSUE A VECTOR';
      } else if (drag && drag.moved) {
        const p = vectorCommand(drag.track, drag.x, drag.y);
        vectorReadout.textContent = `PREVIEW ${heading(p.bearing)}° / ${Math.round(p.speed)} KT · RELEASE TO ASSIGN`;
      } else {
        vectorReadout.textContent = `HDG ${heading(selected.bearing)}° → ${heading(selected.targetBearing)}° · SPD ${Math.round(selected.speed)} → ${Math.round(selected.targetSpeed)} KT`;
      }
    }
    function vectorCommand(track, x, y) {
      const dx = x - track.x * width, dy = y - track.y * height;
      const length = Math.hypot(dx,dy);
      const newHeading = (Math.atan2(dx, -dy) / rad + 360) % 360;
      // A 1 cm (≈38 CSS px at 96 DPI) minimum-speed zone.
      // Beyond that, line length raises commanded speed up to the +6% cap.
      const minLength = 38;
      const maxLength = 220;
      const fraction = clamp((length - minLength) / (maxLength - minLength), 0, 1);
      return { bearing: newHeading, speed: track.baseSpeed * (.94 + fraction * .12), length };
    }
    function updateNightYoke(px, py) {
      // An illustration of the actual control demand: turn and pull/push.
      // It replaces the hidden cursor on the flyable part of the hero only.
      nightYoke.style.left = `${px}px`;
      nightYoke.style.top = `${py}px`;
      const bank = approach.controlX * 24;
      const pull = approach.controlY * 13;
      nightYokeGraphic.style.transform = `perspective(220px) rotateZ(${bank}deg) rotateX(${pull}deg) translateY(${pull * .22}px)`;
      const pitch = approach.controlY < -.20 ? 'PULL' : approach.controlY > .20 ? 'PUSH' : 'LEVEL';
      const roll = approach.controlX < -.20 ? 'LEFT' : approach.controlX > .20 ? 'RIGHT' : 'CENTRE';
      nightYokeStatus.textContent = `${pitch} · ${roll}`;
    }
    home.addEventListener('pointermove', e => {
      const p = pagePoint(e);
      pointer.x = clamp(p.x / Math.max(width,1), 0, 1);
      pointer.y = clamp(p.y / Math.max(height,1), 0, 1);
      pointer.overUI = isUI(e);
      pointer.active = !pointer.overUI && e.pointerType !== 'touch';
      if (theme === 'night' && pointer.overUI) {
        // Do not neutralize a touch drag inside the on-screen yoke.
        if (e.pointerType !== 'touch' && !tilt.enabled && touchStickPointer === null) {
          approach.controlX = 0; approach.controlY = 0;
        }
        nightYoke.classList.remove('is-visible');
      }
      if (theme === 'radar') {
        if (drag && drag.id === e.pointerId) {
          drag.x = p.x; drag.y = p.y;
          drag.moved = drag.moved || Math.hypot(p.x - drag.startX, p.y - drag.startY) >= 10;
          updateVectorReadout();
        }
        if (reduced.matches) render();
      } else if (theme === 'night') {
        if (!pointer.overUI && e.pointerType !== 'touch' && !tilt.enabled) {
          // Mouse position acts as a joystick input, never an instantaneous teleport.
          // Up reduces rate of descent; down increases rate; left/right steer laterally.
          approach.controlX = clamp((pointer.x - .5) * 2, -1, 1);
          approach.controlY = clamp((pointer.y - .5) * 2, -1, 1);
          approach.hasInput = true;
          nightYoke.classList.toggle('is-visible', pointer.active);
          if (pointer.active) updateNightYoke(p.x, p.y);
          if (reduced.matches) render();
        }
      }
    }, { passive: true });
    home.addEventListener('pointerleave', e => {
      if (drag && e.pointerId === drag.id) return; // captured pointer can go beyond the home rectangle
      pointer.active = false;
      nightYoke.classList.remove('is-visible');
      if (theme === 'night' && !tilt.enabled && touchStickPointer===null) { approach.controlX = 0; approach.controlY = 0; }
      if (reduced.matches) render();
    });
    home.addEventListener('pointerdown', e => {
      if (theme !== 'radar' || isUI(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const p = pagePoint(e);
      const hit = getContactAt(p.x, p.y);
      selectTrack(hit);
      if (hit) {
        drag = { track: hit, id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false };
        home.setPointerCapture?.(e.pointerId);
        // Touch drag must not become a page-scroll gesture.
        if (e.cancelable) e.preventDefault();
      }
    });
    function finishVector(e, cancelled = false) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      if (!cancelled && d.moved) {
        const p = pagePoint(e);
        const cmd = vectorCommand(d.track, p.x, p.y);
        if (cmd.length >= 10) {
          d.track.targetBearing = cmd.bearing;
          d.track.targetSpeed = clamp(cmd.speed, d.track.baseSpeed * .94, d.track.baseSpeed * 1.06);
        }
      }
      drag = null;
      updateVectorReadout();
      if (home.hasPointerCapture?.(e.pointerId)) home.releasePointerCapture(e.pointerId);
      if (reduced.matches) render();
    }
    home.addEventListener('pointerup', e => finishVector(e));
    home.addEventListener('pointercancel', e => finishVector(e,true));
    document.getElementById('radar-clear').addEventListener('click', () => selectTrack(null));
    pauseTraffic.addEventListener('click', () => {
      paused = !paused;
      pauseTraffic.textContent = paused ? 'RESUME TRAFFIC' : 'PAUSE TRAFFIC';
      pauseTraffic.setAttribute('aria-pressed', String(paused));
      updateAlert(true);
    });

    function handoffTrack(t, kind) {
      if (t.crashed || t.handoff) return;
      t.handoff = kind;
      t.handoffUntil = simTime + HANDOFF_HOLD_SECONDS;
      const isTower = kind === 'tower';
      const unit = isTower ? 'Tower' : kind === 'departure' ? 'Departure' : 'Centre';
      const frequency = isTower ? '123.45' : kind === 'departure' ? '124.70' : '132.80';
      const quips = isTower ? towerQuips : kind === 'departure' ? departureQuips : centreQuips;
      t.speech = randomQuip(quips, t.speech);
      t.speechUntil = t.handoffUntil;
      t.conflict = 'clear';
      commReadout.textContent = `ATC → ${t.callsign}: Contact ${unit} ${frequency}. ${t.callsign}: ${t.speech}`;
      if (selected === t) selectTrack(null);
    }
    function updateFlights(dt) {
      const fieldX = AIRPORT_X * width, fieldY = AIRPORT_Y * height;
      const towerRadius = Math.min(width,height) * AIRPORT_5NM_SCREEN_RADIUS;
      for (let i = flights.length - 1; i >= 0; i--) {
        const t = flights[i];
        if (t.crashed) continue;
        if (t.handoff) {
          if (simTime >= t.handoffUntil) flights.splice(i, 1);
          continue;
        }
        // Fixed-wing aircraft need time to turn: maximum 12° of heading change/s.
        const turn = angleError(t.targetBearing, t.bearing);
        t.bearing = (t.bearing + clamp(turn, -12 * dt, 12 * dt) + 360) % 360;
        t.speed += clamp(t.targetSpeed - t.speed, -3.5 * dt, 3.5 * dt);
        t.speed = clamp(t.speed, t.baseSpeed * .94, t.baseSpeed * 1.06);
        t.level += clamp(t.targetLevel - t.level, -1.2 * dt, 1.2 * dt);
        const delta = t.baseVelocity * (t.speed / t.baseSpeed) * dt;
        t.x += Math.sin(t.bearing * rad) * delta;
        t.y -= Math.cos(t.bearing * rad) * delta * width / Math.max(1,height);
        t.enteredSector ||= (t.x >= .055 && t.x <= .945 && t.y >= .055 && t.y <= .945);
        t.trailClock += dt;
        if (t.trailClock > .30) {
          t.trailClock = 0;
          t.trail.push({ x: t.x, y: t.y });
          if (t.trail.length > 18) t.trail.shift();
        }
        // A clearance to 3,000 ft and an airport penetration hand off to Tower.
        // Game scale only, not an actual NM-to-pixel conversion.
        const distanceToAirport = Math.hypot(t.x * width - fieldX, t.y * height - fieldY);
        if (t.targetLevel <= 30 && t.level <= 40 && distanceToAirport <= towerRadius) {
          handoffTrack(t, 'tower');
          continue;
        }
        // Tracks must enter the visible sector before they may EXIT it.
        // New aircraft start outside the scope and are not immediately handed off.
        const outwardX = (t.x < .04 && Math.sin(t.bearing * rad) < -.10) ||
                         (t.x > .96 && Math.sin(t.bearing * rad) > .10);
        const outwardY = (t.y < .04 && Math.cos(t.bearing * rad) > .10) ||
                         (t.y > .96 && Math.cos(t.bearing * rad) < -.10);
        if (t.enteredSector && (outwardX || outwardY)) {
          handoffTrack(t, t.level < 100 ? 'departure' : 'centre');
        }
      }
      updateAlert(false);
      if (selected) updateAltitudeReadout();
    }
    function velocity(t) {
      const pps = t.baseVelocity * width * (t.speed / t.baseSpeed);
      return { x: Math.sin(t.bearing * rad) * pps, y: -Math.cos(t.bearing * rad) * pps };
    }
    function resetRadar() {
      flights.splice(0, flights.length, ...originalFlights.map(t => ({...t, trail: [], crashed: false,
        speech: '', speechUntil:0, conflict:'clear', previousAlert:'clear', enteredSector:true, handoff:null, handoffUntil:0})));
      wrecks.length = 0;
      incidents = 0;
      licenseNotified = false;
      paused = false;
      nextTrack = 1;
      document.getElementById('radar-pause').textContent = 'PAUSE';
      pauseTraffic.setAttribute('aria-pressed','false');
      incidentReadout.textContent = '0';
      licensePopup.hidden = true;
      selected = null;
      selectedName.textContent = '— — —';
      climbButton.disabled = descendButton.disabled = true;
      updateAltitudeReadout();
      updateVectorReadout();
      commReadout.textContent = 'ATC: New shift, new scope, suspiciously clean incident log.';
      updateAlert(true);
      reconcile();
    }
    document.getElementById('radar-reset').addEventListener('click', resetRadar);
    document.getElementById('game-restart').addEventListener('click', resetRadar);
    document.getElementById('game-dismiss').addEventListener('click', () => { licensePopup.hidden=true; });
    function createEdgeSpawn() {
      const live = flights.filter(t => !t.crashed);
      for (let attempt = 0; attempt < 25; attempt++) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = -.08; y = .08 + Math.random() * .84; }
        else if (side === 1) { x = 1.08; y = .08 + Math.random() * .84; }
        else if (side === 2) { x = .08 + Math.random() * .84; y = -.10; }
        else { x = .08 + Math.random() * .84; y = 1.10; }
        const targetX = .44 + Math.random() * .24;
        const targetY = .36 + Math.random() * .30;
        const bearing = (Math.atan2(targetX - x, -(targetY - y)) / rad + 360) % 360;
        const tooClose = live.some(t => Math.hypot((t.x - x) * width, (t.y - y) * height) < 120);
        if (tooClose) continue;
        const baseSpeed = 210 + Math.round(Math.random() * 28);
        const baseLevel = 60 + Math.round(Math.random() * 10) * 10;
        return { x, y, bearing, baseSpeed, baseLevel };
      }
      return { x: -.08, y: .24 + Math.random() * .5, bearing: 90, baseSpeed: 220, baseLevel: 90 };
    }
    document.getElementById('radar-add').addEventListener('click', () => {
      if (licenseNotified) return;
      if (flights.filter(t=>!t.crashed && !t.handoff).length >= 20) { commReadout.textContent = 'ATC: Airspace full. Please stop collecting airplanes.'; return; }
      const index = nextTrack++;
      const spawn = createEdgeSpawn();
      const t = { callsign:`SIM${String(700+index)}`, x:spawn.x, y:spawn.y,
        bearing:spawn.bearing, targetBearing:spawn.bearing,
        level:spawn.baseLevel, targetLevel:spawn.baseLevel, speed:spawn.baseSpeed, targetSpeed:spawn.baseSpeed, baseSpeed:spawn.baseSpeed,
        baseVelocity:.008 * TRAFFIC_RATE, trail:[],trailClock:0, conflict:'clear', crashed:false,
        speech:'Checking in from the edge of the map. Please be gentle.',speechUntil:simTime+3,previousAlert:'clear', enteredSector:false, handoff:null, handoffUntil:0};
      flights.push(t);
      commReadout.textContent=`ATC: ${t.callsign} entering from the sector edge at FL${flightLevel(t.level)}.`;
      if (reduced.matches) render();
    });
    async function showLicenseReview() {
      licensePopup.hidden = false;
      licenseNotified = true;
      paused = true;
      popupAuthority.textContent = 'Aviation authority · Identifying your regional paperwork department…';
      document.getElementById('game-restart').focus({preventScroll:true});
      // Fictional game-over after TWO separate collisions. No storage of IP/country.
      const controller = new AbortController();
      const timeout=setTimeout(()=>controller.abort(),3500);
      let code='';
      try {
        const response=await fetch('https://api.country.is/', {mode:'cors',signal:controller.signal,cache:'no-store'});
        if (response.ok) {
          const info=await response.json();
          if (typeof info.country === 'string' && /^[A-Z]{2}$/.test(info.country)) code=info.country;
        }
      } catch (_) { /* offline, local file, or endpoint unavailable */ }
      finally {clearTimeout(timeout);}
      const agencies={
        CA:['Transport Canada','Your delegation has been revoked. Please surrender your headset and double-double.'],
        US:['FAA','The FAA would like you to copy a telephone number. Actually, all of them.'],
        GB:['UK Civil Aviation Authority','The CAA has asked you to remain on frequency. Forever.'],
        AU:['CASA','CASA requests that you refrain from turning the sky into a demolition derby.'],
        NZ:['Civil Aviation Authority of New Zealand','Your aviation licence has departed. It will not be returning.'],
        DE:['Luftfahrt-Bundesamt','The Luftfahrt-Bundesamt has noted your inventive interpretation of separation.'],
        FR:['DGAC','The DGAC has requested that your next vector be toward the exit.'],
        IE:['Irish Aviation Authority','The IAA is strongly recommending a new hobby.']
      };
      const [authority,message]=agencies[code] || ['Regional aviation authority','The regulator has reviewed your technique and recommends trains.'];
      if (licenseNotified) {
        popupAuthority.textContent = code ? `${authority} · ${code} (IP country)` : 'Regional aviation authority · Offline/default';
        document.getElementById('game-popup-message').textContent=`${message} Two mid-air collisions. Your licence is no longer in the chat.`;
      }
    }
    function crash(a,b) {
      if (a.crashed||b.crashed||a.handoff||b.handoff) return;
      a.crashed=b.crashed=true;
      const x=(a.x+b.x)*width*.5, y=(a.y+b.y)*height*.5;
      wrecks.push({x,y,age:0,callsigns:`${a.callsign} / ${b.callsign}`});
      if (selected===a||selected===b) {
        selected=null; selectedName.textContent='— — —';
        climbButton.disabled=descendButton.disabled=true;
        updateAltitudeReadout();updateVectorReadout();
      }
      incidents++;
      incidentReadout.textContent=String(incidents);
      commReadout.textContent=`MAYDAY (${a.callsign} / ${b.callsign}): ${randomQuip(crashQuips)}`;
      if (incidents>=MAX_INCIDENTS && !licenseNotified) showLicenseReview();
    }
    function alertQuote(t, severity) {
      const quotes=severity==='resolution'?raQuips:taQuips;
      t.speech=randomQuip(quotes, t.speech);
      t.speechUntil=simTime+4.0;
    }
    function updateAlert(force) {
      if (theme!=='radar') return;
      const scale=Math.max(300,Math.min(width,height));
      const redDistance=scale*.068, amberDistance=scale*.14, collisionDistance=scale*.023;
      const conflicts=[];
      flights.forEach(t=>{t.conflict='clear';});
      for(let i=0;i<flights.length;i++) for(let j=i+1;j<flights.length;j++) {
        const a=flights[i],b=flights[j];
        if(a.crashed||b.crashed||a.handoff||b.handoff) continue;
        const dx=(b.x-a.x)*width,dy=(b.y-a.y)*height,dist=Math.hypot(dx,dy);
        const altFt=Math.abs(a.level-b.level)*100;
        // An actual hit in the GAME requires co-location and <200 ft vertical gap.
        if(dist<collisionDistance && altFt<200){crash(a,b);continue;}
        const av=velocity(a),bv=velocity(b),dvx=bv.x-av.x,dvy=bv.y-av.y;
        const rv2=dvx*dvx+dvy*dvy;
        const seconds=rv2?clamp(-(dx*dvx+dy*dvy)/rv2,0,15):0;
        const closest=Math.hypot(dx+dvx*seconds,dy+dvy*seconds);
        let severity='clear';
        if(altFt<=500 && dist<redDistance) severity='resolution';
        else if(altFt<=1000 && (dist<amberDistance||(seconds<10 && closest<redDistance*1.25))) severity='traffic';
        if(severity!=='clear'){
          if(severity==='resolution'||a.conflict!=='resolution') a.conflict=severity;
          if(severity==='resolution'||b.conflict!=='resolution') b.conflict=severity;
          conflicts.push({a,b,severity,dist,altFt,seconds});
        }
      }
      for(const t of flights){
        if(t.crashed || t.handoff) continue;
        if(t.conflict!=='clear'&&t.previousAlert!==t.conflict) alertQuote(t,t.conflict);
        t.previousAlert=t.conflict;
      }
      activeConflicts=conflicts;
      const worst=conflicts.find(c=>c.severity==='resolution')||conflicts[0];
      const state=licenseNotified?'resolution':!worst?'clear':worst.severity;
      const tally = String(conflicts.length).padStart(2,'0');
      if (alertCount.textContent !== tally) alertCount.textContent=tally;
      if(force||state!==alertState||simTime-lastStatusUpdate>1.2){
        const changed=state!==alertState;
        alertState=state;lastStatusUpdate=simTime;
        trafficStatus.dataset.alert=state;
        if(licenseNotified){
          trafficStatus.textContent='✖ SECTOR CLOSED · LICENCE REVOKED';
          trafficDetail.textContent=`${incidents} incidents · reset scope to try again`;
        } else if(state==='resolution'){
          trafficStatus.textContent='⚠ PROXIMITY ALERT · SIM RA';
          trafficDetail.textContent=`${worst.a.callsign} / ${worst.b.callsign} · ${Math.round(worst.dist)} px · Δ${Math.round(worst.altFt)} ft`;
          if(changed) commReadout.textContent=`${worst.a.callsign}: ${worst.a.speech}`;
        } else if(state==='traffic'){
          trafficStatus.textContent='▲ TRAFFIC ADVISORY · SIM TA';
          trafficDetail.textContent=`${worst.a.callsign} / ${worst.b.callsign} · closing traffic`;
          if(changed) commReadout.textContent=`${worst.b.callsign}: ${worst.b.speech}`;
        } else {
          trafficStatus.textContent='● SEPARATION NORMAL';
          trafficDetail.textContent=selected
            ?`${selected.callsign} · FL${flightLevel(selected.level)} · click and drag to vector`
            :'Select a track. Drag to vector; change altitude with the arrows.';
        }
      }
    }
        function resetApproach() {
      approach.controlX = 0; approach.controlY = 0;
      approach.lateral = 0; approach.lateralRate = 0;
      approach.distance = APPROACH_START_DISTANCE;
      approach.altitude = 2600;
      approach.descentRate = NOMINAL_DESCENT_RATE;
      approach.runwayDrift = 0; approach.bank = 0; approach.whites = 2;
      approach.phase = 'approach'; approach.phaseTime = 0;
      approach.goodTime = 0; approach.finalTime = 0; approach.stableTail = 0; approach.hasInput = false;
      approach.localizer = 0; approach.glideslope = 0; approach.visualGlideslope = 0; approach.runwayVisibility = .05;
      approachMessage.hidden = true;
      cloudBanks.forEach((bank, i) => { bank.depth = [.22,.46,.72,.92,.07][i]; });
      updateApproachInstruments();
      updateNightPanel();
      updateFlightControlVisuals();
    }
    function updateNightPanel() {
      const alt=Math.max(0,Math.round(approach.altitude/10)*10);
      const text = `${alt.toLocaleString('en-CA')} FT · ${alt>1150?'IMC / IN CLOUD':'RUNWAY IN SIGHT'}`;
      if (nightAltitude.textContent !== text) nightAltitude.textContent = text;
      if(approach.phase==='landed'){
        nightStatus.textContent='✓ TOUCHDOWN · LANDED';
      } else if(approach.phase==='goaround') {
        nightStatus.textContent='↗ GO AROUND · RETURNING TO RADAR';
      } else if(alt>1200){
        nightStatus.textContent='DESCENDING THROUGH CLOUD';
      } else if(alt>300){
        nightStatus.textContent='RUNWAY IN SIGHT · STABILIZE APPROACH';
      } else {
        nightStatus.textContent='SHORT FINAL · KEEP THE NEEDLES CENTRED';
      }
    }
    function finishApproach(success) {
      approach.phase=success?'landed':'goaround';
      approach.phaseTime=0;
      approachMessage.hidden=false;
      approachMessage.dataset.result=success?'landed':'goaround';
      approachTitle.textContent=success?'✓ NICE LANDING, CAPTAIN':'✖ GO AROUND!';
      approachText.textContent=success
        ?'Runway made contact with wheels. The passengers applaud. Your instructor pretends not to smile.'
        :'Unstable approach. The runway has decided to leave. Climb away—Radar will take you back.';
      document.getElementById('approach-retry').textContent=success?'FLY IT AGAIN':'RETRY INSTEAD';
      updateNightPanel();
    }
    function updateApproachInstruments() {
      // CDI geometry: the needle points TOWARD the correct path, not the airplane.
      // Aircraft RIGHT of localizer -> vertical needle LEFT.
      // Aircraft ABOVE glideslope -> horizontal needle BELOW the centre.
      const locFullScale = Math.max(.075, approach.distance * .07);
      const gsFullScale = Math.max(85, approach.distance * 38);
      approach.localizer = clamp(approach.lateral / locFullScale, -1, 1);
      const desiredAltitude = approach.distance * GLIDEPATH_FEET_PER_NM;
      approach.glideslope = clamp((approach.altitude - desiredAltitude) / gsFullScale, -1, 1);
      if (reduced.matches) approach.visualGlideslope = approach.glideslope;
      updatePapi();
      updateFlightControlVisuals();
    }
    function advanceApproach(dt) {
      if (approach.phase === 'landed') return;
      if (approach.phase === 'goaround') {
        approach.phaseTime += dt;
        if (approach.phaseTime > 4.2) setTheme('radar');
        return;
      }
      if (dt <= 0) return;
      // Mouse steers *rate of movement*, not an instantaneous position.
      const desiredLateralRate = approach.controlX * .078; // NM/s, accelerated game time
      approach.lateralRate += (desiredLateralRate - approach.lateralRate) * Math.min(1, dt * 1.65);
      approach.lateral = clamp(approach.lateral + approach.lateralRate * dt, -1.45, 1.45);
      const desiredDescentRate = NOMINAL_DESCENT_RATE * (1 + .78 * approach.controlY);
      approach.descentRate += (desiredDescentRate - approach.descentRate) * Math.min(1, dt * 1.7);
      approach.altitude = Math.max(0, approach.altitude - approach.descentRate * dt);
      approach.distance = Math.max(0, approach.distance - APPROACH_GROUND_SPEED * dt);

      const progress = 1 - approach.distance / APPROACH_START_DISTANCE;
      approach.runwayVisibility = clamp(.05 + progress * 1.05, .05, 1);
      // Moving the aircraft right leaves the runway/LOC path to the left of it.
      const runwayShift = clamp(-approach.lateral / Math.max(.33, approach.distance * .47) * .30, -.22, .22);
      approach.runwayDrift += (runwayShift - approach.runwayDrift) * Math.min(1, dt * 2.8);
      approach.bank += (approach.controlX * .16 - approach.bank) * Math.min(1, dt * 2.8);
      updateApproachInstruments();
      // Smooth only the visual runway perspective, not the ILS/PAPI/scoring data.
      // High on glidepath = taller runway picture; low = flatter runway picture.
      approach.visualGlideslope +=
        (approach.glideslope - approach.visualGlideslope) * Math.min(1, dt * 3.4);

      if (approach.distance < 3.8) {
        approach.finalTime += dt;
        const stable = Math.abs(approach.whites - 2) <= 1 &&
          Math.abs(approach.localizer) < .78 && Math.abs(approach.glideslope) < .78;
        approach.stableTail = stable ? approach.stableTail + dt : 0;
        if (stable) approach.goodTime += dt;
      }
      // Threshold crossing is based on horizontal progress, not reaching zero altitude.
      // This allows a genuinely too-high / too-low approach to fail correctly.
      if (approach.distance <= 0) {
        // Forgiving, but the pilot must still establish a reasonably stable final.
        const onCentre = Math.abs(approach.localizer) < .85;
        const glideOK = Math.abs(approach.glideslope) < .86;
        const papiOK = Math.abs(approach.whites - 2) <= 1;
        const mostlyStable = approach.finalTime > 0 &&
          (approach.goodTime / approach.finalTime >= .32 || approach.stableTail >= 2);
        finishApproach(onCentre && glideOK && papiOK && mostlyStable);
      }
      updateNightPanel();
      updateFlightControlVisuals();
    }
    document.getElementById('night-restart').addEventListener('click',resetApproach);
    document.getElementById('approach-retry').addEventListener('click',resetApproach);
    let lastPapiWhites = -1;
    function updateFlightControlVisuals() {
      const steering = approach.controlX;
      const sinkMultiplier = approach.descentRate / NOMINAL_DESCENT_RATE;
      const steerText = Math.abs(steering) < .12 ? 'WINGS LEVEL' :
        steering < 0 ? `STEERING LEFT ${Math.round(-steering * 100)}%` :
          `STEERING RIGHT ${Math.round(steering * 100)}%`;
      const sinkText = sinkMultiplier < .94 ? 'SLOWER DESCENT' :
        sinkMultiplier > 1.06 ? 'FASTER DESCENT' : 'NOMINAL DESCENT';
      steerOutput.textContent = steerText;
      sinkOutput.textContent = `${sinkText} · ${Math.round(sinkMultiplier * 100)}%`;
      steerMarker.style.left = `${50 + steering * 43}%`;
      // Display ACTUAL aircraft descent rate, not only the demanded control.
      sinkMarker.style.left = `${clamp(50 + (sinkMultiplier - 1) / .78 * 43, 7, 93)}%`;
    }
    function updatePapi() {
      // White = high, red = low; both PAPI and GS share the same path error.
      const error = approach.glideslope;
      const whites = error > .53 ? 4 : error > .16 ? 3 : error >= -.16 ? 2 : error >= -.53 ? 1 : 0;
      approach.whites = whites;
      const red = 4 - whites;
      const verdict = whites === 2 ? 'ON GLIDEPATH' : whites > 2 ? 'TOO HIGH' : 'TOO LOW';
      const papiText = `PAPI ${whites} WHITE / ${red} RED · ${verdict}`;
      if (papiLabel.textContent !== papiText) papiLabel.textContent = papiText;
      if (whites !== lastPapiWhites) {
        lastPapiWhites = whites;
        papiLamps.replaceChildren(...Array.from({length: 4}, (_, i) => {
          const lamp = document.createElement('i');
          lamp.className = i < whites ? 'papi-white' : 'papi-red';
          return lamp;
        }));
      }
      const locText = Math.abs(approach.localizer) < .12 ? 'LOCALIZER · CENTRED'
        : approach.localizer < 0 ? 'LOCALIZER · FLY RIGHT' : 'LOCALIZER · FLY LEFT';
      const gsText = Math.abs(approach.glideslope) < .12 ? 'GLIDESLOPE · ON PROFILE'
        : approach.glideslope < 0 ? 'GLIDESLOPE · LOW, REDUCE DESCENT'
          : 'GLIDESLOPE · HIGH, INCREASE DESCENT';
      if (localizerLabel.textContent !== locText) localizerLabel.textContent = locText;
      if (glideslopeLabel.textContent !== gsText) glideslopeLabel.textContent = gsText;
      const shortLoc = locText.replace('LOCALIZER · ', 'LOC · ');
      const shortGs = gsText.replace('GLIDESLOPE · ', 'GS · ');
      if (instrumentLoc.textContent !== shortLoc) instrumentLoc.textContent = shortLoc;
      if (instrumentGs.textContent !== shortGs) instrumentGs.textContent = shortGs;
      // Aircraft on the RIGHT needs a needle on the LEFT. High requires needle BELOW.
      locNeedle.style.transform = `translateX(${-approach.localizer * 52}px)`;
      gsNeedle.style.transform = `translateY(${approach.glideslope * 52}px)`;
    }
    updateApproachInstruments();
    updateNightPanel();

    function render() {
      if (!width || !height) return;
      ctx.clearRect(0,0,width,height);
      if (theme === 'radar') drawRadar();
      if (theme === 'night') drawNight();
    }
    function drawRadar() {
      ctx.save();
      const cx = width*.58, cy = height*.52;
      const range = Math.min(width*.65,height*.8);
      const glow = ctx.createRadialGradient(cx,cy,range*.04,cx,cy,range*1.18);
      glow.addColorStop(0,'rgba(15,87,44,.23)');
      glow.addColorStop(.62,'rgba(6,40,20,.075)');
      glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
      ctx.lineWidth=1; ctx.strokeStyle='rgba(102,246,138,.20)';
      for(let i=1;i<=5;i++){ctx.beginPath();ctx.arc(cx,cy,range*i/5,0,Math.PI*2);ctx.stroke();}
      ctx.setLineDash([4,12]);
      ctx.strokeStyle='rgba(132,255,164,.18)';
      ctx.beginPath();ctx.moveTo(cx-range,cy);ctx.lineTo(cx+range,cy);ctx.moveTo(cx,cy-range);ctx.lineTo(cx,cy+range);ctx.stroke();ctx.setLineDash([]);
      for(let a=0;a<360;a+=30){let t=a*rad;ctx.beginPath();ctx.moveTo(cx+Math.sin(t)*range*.97,cy-Math.cos(t)*range*.97);ctx.lineTo(cx+Math.sin(t)*range*1.02,cy-Math.cos(t)*range*1.02);ctx.stroke();}
      ctx.font='11px monospace';ctx.fillStyle='rgba(136,255,169,.5)';
      ctx.fillText('270',cx-range,cy-12);ctx.fillText('090',cx+range-33,cy-12);ctx.fillText('000',cx+10,cy-range+17);
      // Rotating radar sweep, rendered only while Radar is visible.
      const sweep=simTime*.39;
      const cone=ctx.createRadialGradient(cx,cy,4,cx,cy,range);
      cone.addColorStop(0,'rgba(102,255,143,.13)');cone.addColorStop(1,'rgba(102,255,143,0)');
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,range,sweep-.27,sweep);ctx.closePath();ctx.fillStyle=cone;ctx.fill();
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweep)*range,cy+Math.sin(sweep)*range);
      ctx.strokeStyle='rgba(146,255,167,.48)';ctx.shadowColor='#75ffa5';ctx.shadowBlur=9;ctx.stroke();ctx.shadowBlur=0;
      // Light airway lines recall an older green-screen ATC scope.
      ctx.strokeStyle='rgba(150,245,164,.20)';ctx.setLineDash([8,12]);
      ctx.beginPath();ctx.moveTo(width*.04,height*.72);ctx.lineTo(width*.39,height*.53);ctx.lineTo(width*.86,height*.48);ctx.moveTo(width*.32,height*.11);ctx.lineTo(width*.55,height*.36);ctx.lineTo(width*.92,height*.83);ctx.stroke();ctx.setLineDash([]);
      // 5 NM terminal handoff ring, deliberately small and unobtrusive.
      const fieldX = AIRPORT_X * width, fieldY = AIRPORT_Y * height;
      const handoffRadius = Math.min(width, height) * AIRPORT_5NM_SCREEN_RADIUS;
      ctx.save();
      ctx.strokeStyle='rgba(143,255,160,.47)';ctx.lineWidth=1;
      ctx.setLineDash([3,7]);
      ctx.beginPath();ctx.arc(fieldX,fieldY,handoffRadius,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.font='bold 10px ui-monospace,monospace';ctx.fillStyle='rgba(176,255,180,.80)';
      ctx.fillText('5 NM · TWR',fieldX + handoffRadius*.48,fieldY-handoffRadius*.80);
      ctx.restore();
      // Minimal airport depiction, like a labelled symbol on a real ATC scope.
      ctx.save();ctx.translate(fieldX,fieldY);ctx.rotate(-.12);
      ctx.strokeStyle='rgba(160,255,175,.56)';ctx.lineWidth=1.4;
      ctx.strokeRect(-11,-24,22,48);
      ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(0,40);ctx.stroke();
      ctx.setLineDash([]);ctx.fillStyle='rgba(110,245,137,.86)';ctx.font='bold 9px ui-monospace,monospace';
      ctx.fillText('35',-7,-14);ctx.fillText('17',-6,20);ctx.restore();
      ctx.font='10px ui-monospace,monospace';ctx.fillStyle='rgba(160,255,175,.72)';
      ctx.fillText('SIM / TWR',fieldX+22,fieldY-24);
      ctx.fillText('◈ AIRFIELD',fieldX+22,fieldY-11);
      for(const w of wrecks) {
        const life=1-w.age/5;
        if(life<=0)continue;
        ctx.save();ctx.globalAlpha=life;
        ctx.strokeStyle='#ff5368';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(w.x,w.y,Math.min(38,3+w.age*15),0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(w.x-11,w.y-11);ctx.lineTo(w.x+11,w.y+11);
        ctx.moveTo(w.x+11,w.y-11);ctx.lineTo(w.x-11,w.y+11);ctx.stroke();
        ctx.font='bold 10px ui-monospace,monospace';ctx.fillStyle='#ff96a4';
        ctx.fillText(`INCIDENT · ${w.callsigns}`,clamp(w.x+20,10,width-260),clamp(w.y-15,16,height-16));
        ctx.restore();
      }
      // Conflict connectors make aircraft-aircraft advisories immediately obvious.
      for(const c of activeConflicts){
        ctx.strokeStyle=c.severity==='resolution'?'rgba(255,75,94,.68)':'rgba(255,202,80,.48)';
        ctx.lineWidth=c.severity==='resolution'?1.8:1.2;
        ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(c.a.x*width,c.a.y*height);ctx.lineTo(c.b.x*width,c.b.y*height);ctx.stroke();ctx.setLineDash([]);
      }
      const fs=width<650?9:11;
      for(const t of flights){
        if(t.crashed)continue;
        const x=t.x*width,y=t.y*height;
        if(x < -40 || x > width+80 || y < -35 || y > height+70) continue;
        const color=t.handoff?'#67c7e0':t.conflict==='resolution'?'#ff5367':t.conflict==='traffic'?'#ffd371':selected===t?'#75ecff':'#a5ffb4';
        ctx.strokeStyle=color;ctx.globalAlpha=.26;ctx.lineWidth=1.3;
        ctx.beginPath();t.trail.forEach((p,i)=>{if(!i)ctx.moveTo(p.x*width,p.y*height);else ctx.lineTo(p.x*width,p.y*height);});ctx.stroke();ctx.globalAlpha=1;
        // The actual and commanded headings are different while turning.
        if(selected===t && Math.abs(angleError(t.targetBearing,t.bearing))>1){
          const b=t.targetBearing*rad;
          ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(b)*39,y-Math.cos(b)*39);ctx.strokeStyle='rgba(115,236,255,.6)';ctx.stroke();ctx.setLineDash([]);
        }
        ctx.save();ctx.translate(x,y);ctx.rotate(t.bearing*rad);ctx.strokeStyle=color;ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-6,7);ctx.lineTo(0,3);ctx.lineTo(6,7);ctx.closePath();ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(0,-21);ctx.stroke();ctx.restore();
        const left=x>width-160,tx=x+(left?-122:12),ty=clamp(y-22,18,height-35);
        ctx.strokeStyle=color;ctx.globalAlpha=.58;ctx.beginPath();ctx.moveTo(x+(left?-5:5),y-4);ctx.lineTo(tx,ty+7);ctx.stroke();ctx.globalAlpha=1;
        ctx.fillStyle=color;ctx.shadowColor='#000';ctx.shadowBlur=5;
        ctx.font=`bold ${fs}px ui-monospace,monospace`;ctx.fillText(t.callsign,tx,ty);
        ctx.font=`${fs}px ui-monospace,monospace`;
        const altitudeMark=Math.abs(t.targetLevel-t.level)>1?(t.targetLevel>t.level?'↑':'↓'):'';
        ctx.fillText(t.handoff ? `→ ${t.handoff.toUpperCase()} · HANDOFF` : `${flightLevel(t.level)}${altitudeMark}  ${heading(t.bearing)}°  ${Math.round(t.speed)}KT`,tx,ty+fs+1);ctx.shadowBlur=0;
        if(t.speech && simTime<t.speechUntil && width>=650){
          const q=t.speech;
          ctx.font='10px ui-monospace,monospace';
          const sw=Math.min(295,ctx.measureText(q).width+19);
          const sx=clamp(x-sw/2,8,width-sw-8),sy=clamp(y+28,48,height-38);
          ctx.fillStyle='rgba(3,26,12,.94)';ctx.strokeStyle=t.conflict==='resolution'?'#fa586c':'#9fedb0';ctx.lineWidth=1;
          ctx.fillRect(sx,sy,sw,25);ctx.strokeRect(sx,sy,sw,25);
          ctx.fillStyle=t.conflict==='resolution'?'#ffc7ce':'#d3ffdf';ctx.fillText(q,sx+9,sy+16);
        }
        if(selected===t){
          ctx.strokeStyle='#75ecff';ctx.lineWidth=1.6;ctx.strokeRect(x-14,y-14,28,28);
          ctx.beginPath();ctx.arc(x,y,21,0,Math.PI*2);ctx.strokeStyle='rgba(117,236,255,.45)';ctx.stroke();
        }else if(t.conflict==='resolution'){
          ctx.strokeStyle='#ff5367';ctx.strokeRect(x-13,y-13,26,26);
        }
      }
      // Dragged heading/speed vector with an arrowhead and numerical preview.
      if(drag && drag.moved){
        const t=drag.track,x=t.x*width,y=t.y*height;
        const dx=drag.x-x,dy=drag.y-y;
        const d=Math.hypot(dx,dy);
        if(d>3){
          const bearing=Math.atan2(dy,dx),arrow=10;
          ctx.strokeStyle='#b6ffff';ctx.fillStyle='#b6ffff';ctx.lineWidth=2;
          ctx.setLineDash([9,5]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(drag.x,drag.y);ctx.stroke();ctx.setLineDash([]);
          ctx.beginPath();ctx.moveTo(drag.x,drag.y);ctx.lineTo(drag.x-Math.cos(bearing-.50)*arrow,drag.y-Math.sin(bearing-.50)*arrow);
          ctx.lineTo(drag.x-Math.cos(bearing+.50)*arrow,drag.y-Math.sin(bearing+.50)*arrow);ctx.closePath();ctx.fill();
          const cmd=vectorCommand(t,drag.x,drag.y);
          ctx.font='bold 12px ui-monospace,monospace';ctx.fillStyle='#e0ffff';
          const tx=clamp(drag.x+10,10,width-135),ty=clamp(drag.y-12,18,height-10);
          ctx.fillText(`${heading(cmd.bearing)}° / ${Math.round(cmd.speed)}KT`,tx,ty);
        }
      }
      // Mouse is an ATC-style green laser point; it is NOT an aircraft.
      if(pointer.active){
        const x=pointer.x*width,y=pointer.y*height;
        ctx.strokeStyle='rgba(147,255,166,.9)';ctx.fillStyle='#c7ffd3';ctx.lineWidth=1;
        ctx.shadowColor='#7aff9d';ctx.shadowBlur=12;
        ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x-10,y);ctx.moveTo(x+10,y);ctx.lineTo(x+14,y);ctx.moveTo(x,y-14);ctx.lineTo(x,y-10);ctx.moveTo(x,y+10);ctx.lineTo(x,y+14);ctx.stroke();
      }
      ctx.restore();
    }
    function getRunwayGeometry() {
      const progress = clamp(1 - approach.distance / APPROACH_START_DISTANCE, 0, 1);
      const retreat = approach.phase === 'goaround' ? Math.min(1, approach.phaseTime / 3) : 0;
      const runwayBottom = height * (1.06 + retreat * .12);
      const referenceHorizon = height * (.76 - progress * .24 + retreat * .26);
      const glideError = clamp(approach.visualGlideslope, -1, 1);
      // Scale the projected *depth* so the runway's shape changes, rather
      // than merely translating the whole drawing up and down the screen.
      const referenceDepth = runwayBottom - referenceHorizon;
      const pictureDepth = referenceDepth * (1 + glideError * .43);
      const horizon = clamp(runwayBottom - pictureDepth, height * .18, height * .97);
      const widthFactor = 1 - glideError * .09; // higher = visually more elongated
      return {
        horizon, runwayBottom,
        center: width * (.5 + approach.runwayDrift * .9),
        farHalf: Math.max(8, width * (.010 + progress * .01) * widthFactor),
        nearHalf: Math.min(width * .29, width * (.14 + progress * .14) * widthFactor),
        glideError
      };
    }
    function drawNight() {
      ctx.save();
      for(const s of stars){
        ctx.globalAlpha=s.alpha*(reduced.matches?1:.78+.22*Math.sin(simTime*.7+s.phase));
        ctx.fillStyle='#d9eaff';ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.radius,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
      const progress = 1 - approach.distance / APPROACH_START_DISTANCE;
      const retreat=approach.phase==='goaround'?Math.min(1,approach.phaseTime/3.0):0;
      // The path-relative runway picture changes with glidepath error:
      // HIGH: a long/steep trapezoid (threshold farther up the screen).
      // LOW: a short/flat trapezoid (threshold closer to the bottom).
      // On slope, preserve the original reference picture at any given range.
      // All geometry, lights and ground cues share these projected coordinates.
      const runway = getRunwayGeometry();
      const {horizon, center, farHalf, nearHalf, runwayBottom} = runway;
      const runwayAlpha = approach.runwayVisibility;
      ctx.globalAlpha = runwayAlpha;
      ctx.fillStyle='rgba(3,12,25,.76)';ctx.beginPath();ctx.moveTo(center-farHalf,horizon);ctx.lineTo(center+farHalf,horizon);ctx.lineTo(center+nearHalf,runwayBottom);ctx.lineTo(center-nearHalf,runwayBottom);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(170,220,255,.30)';ctx.lineWidth=2;ctx.stroke();
      for(let i=0;i<19;i++){
        const phase=(i/19+simTime*.022)%1;
        const depth=Math.max(.02, phase*phase);
        const y=horizon+depth*(runwayBottom-horizon);
        const spread=farHalf+depth*(nearHalf-farHalf);
        const r=.8+depth*3.8;
        for(const side of [-1,1]){
          ctx.fillStyle=i%5===0?'#fff7d2':'#77d7ff';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=7+r*2;
          ctx.beginPath();ctx.arc(center+side*spread,y,r,0,Math.PI*2);ctx.fill();
        }
        if(i%3===0 && depth<.95){ctx.fillStyle='rgba(244,245,240,.80)';ctx.fillRect(center-Math.max(1,depth*2),y,Math.max(2,depth*4),5+depth*14);}
      }
      for(let i=-4;i<=4;i++){
        ctx.fillStyle='#eefff3';ctx.shadowColor='#defefb';ctx.shadowBlur=11;
        ctx.fillRect(center+i*Math.max(10,width*.012)-2,horizon+Math.min(38,(runwayBottom-horizon)*.12),4,4);
      }
      ctx.shadowBlur=0;
      const papiX=center-Math.max(70,width*.085);
      for(let i=0;i<4;i++){
        ctx.fillStyle=i<approach.whites?'#ffffff':'#ff4657';
        ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=17;
        ctx.beginPath();ctx.arc(papiX+i*17,horizon+3,4,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
      for(let i=0;i<34;i++){
        const x=((i*71.9)%100)/100*width,y=horizon+Math.sin(i*12.1)*18;
        const twinkle=.15+.35*Math.sin(simTime*.45+i)**2;
        ctx.fillStyle=`rgba(255,200,103,${twinkle*runwayAlpha})`;ctx.fillRect(x,y,i%4===0?3:2,2);
      }
      ctx.globalAlpha = 1;
      drawCloudVectors(progress, horizon);
      // Plane stays tail-on near the centre; control input banks it and moves the runway.
      // Do not teleport the plane to the cursor position.
      drawRearAircraft(width * .5, height * (width < 650 ? .61 : .55), approach.bank);
      ctx.restore();
    }
    function drawCloudVectors(progress, horizon){
      let cover=clamp((approach.altitude-550)/1650,0,1);
      if(approach.phase==='goaround') cover=clamp(.30+approach.phaseTime/2,0,1);
      if(approach.phase==='landed') cover=0;
      if(cover<.008) return;
      ctx.save();
      const retreat=retreatClamp();
      // Flying high: cloud layer reaches much LOWER in the view. Descending
      // beneath the base: cloud ceiling rises toward the top of the screen.
      // The lower-horizon fog remains separate and intentionally subtle.
      const cloudBase=height * (.68 - progress*.29);
      const upperLimit=Math.max(40,Math.min(horizon - 8,cloudBase));
      const layer = cloudPaint || ctx;
      layer.clearRect(0,0,width,cloudLayer.height);
      layer.save();
      layer.beginPath();layer.rect(0,0,width,upperLimit);layer.clip();
      const skyFog=layer.createLinearGradient(0,0,0,upperLimit);
      skyFog.addColorStop(0,'rgba(16,31,54,0)');
      skyFog.addColorStop(.58,`rgba(63,85,113,${cover*.045})`);
      skyFog.addColorStop(1,`rgba(42,60,84,${cover*.15})`);
      layer.fillStyle=skyFog;layer.fillRect(0,0,width,upperLimit);

      for(const bank of cloudBanks){
        const depth=clamp(bank.depth,0,1.14);
        const scale=depth**1.36;
        const bankW=width*(.35+.62*scale)*bank.size;
        const bankH=height*(.23+.35*scale)*bank.size;
        const x=width*(.5+bank.lane*(.19+1.02*scale)-approach.localizer*.014);
        const y=upperLimit*(.96-1.12*scale);
        // Fully invisible at spawn: alpha ramps from ZERO gradually. The
        // sprite's feathering, not a hard reset, defines cloud-bank edges.
        const enter=smoothstep(.015,.25,depth);
        const leave=1-smoothstep(1.00,1.14,depth);
        layer.globalAlpha=cover*(.43+.45*scale)*enter*leave*(1-retreat*.55);
        const sprite=cloudSprites[bank.sprite];
        if(sprite && layer.globalAlpha>.001) layer.drawImage(sprite,x-bankW/2,y-bankH/2,bankW,bankH);
      }
      layer.restore();
      if(cloudPaint){
        layer.save();layer.globalCompositeOperation='destination-in';
        const fade=layer.createLinearGradient(0,upperLimit*.78,0,upperLimit);
        fade.addColorStop(0,'rgba(0,0,0,1)');
        fade.addColorStop(1,'rgba(0,0,0,0)');
        layer.fillStyle=fade;layer.fillRect(0,0,width,upperLimit);
        layer.restore();
        ctx.drawImage(cloudLayer,0,0);
      }

      // Below the runway horizon, retain the gentle near-static haze only.
      ctx.save();
      ctx.beginPath();ctx.rect(0,Math.max(0,horizon),width,Math.max(0,height-horizon));ctx.clip();
      for(let i=0;i<8;i++){
        const bandY=horizon+(i/8)*(height-horizon);
        const bandH=28+i*12;
        const alpha=cover*(.018+i*.003)*(1-retreat);
        const fog=ctx.createLinearGradient(0,bandY-bandH,0,bandY+bandH);
        fog.addColorStop(0,'rgba(185,198,214,0)');
        fog.addColorStop(.5,`rgba(190,205,220,${alpha})`);
        fog.addColorStop(1,'rgba(185,198,214,0)');
        ctx.fillStyle=fog;ctx.fillRect(0,bandY-bandH,width,bandH*2);
      }
      ctx.restore();
      ctx.restore();
    }
    function retreatClamp(){ return approach.phase==='goaround' ? clamp(approach.phaseTime/2.2,0,1) : 0; }
    function drawRearAircraft(x,y,roll){
      // Tail-on high-wing, fixed-gear light trainer rather than a swept-wing jet.
      ctx.save();ctx.translate(x,y);ctx.rotate(roll);
      const s=clamp(Math.min(width/880,height/620),.66,1.13);
      ctx.scale(s,s);
      ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=1.8;
      ctx.shadowColor='rgba(97,180,243,.4)';ctx.shadowBlur=8;
      const fus=ctx.createLinearGradient(0,-24,0,27);
      fus.addColorStop(0,'#ecf7ff');fus.addColorStop(.5,'#a7cadf');fus.addColorStop(1,'#4e718c');
      ctx.fillStyle=fus;ctx.strokeStyle='#d2eaff';
      ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(-5,-7);ctx.lineTo(-5,15);ctx.lineTo(5,15);ctx.lineTo(5,-7);ctx.closePath();ctx.fill();ctx.stroke();
      // High, straight wing and struts.
      ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-63,-11);ctx.lineTo(-76,-11);
      ctx.lineTo(-76,-5);ctx.lineTo(-62,-3);ctx.lineTo(-6,3);
      ctx.lineTo(6,3);ctx.lineTo(62,-3);ctx.lineTo(76,-5);ctx.lineTo(76,-11);
      ctx.lineTo(63,-11);ctx.lineTo(7,-4);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#53718a';ctx.fillRect(-11,1,22,23);
      ctx.fillStyle='#d9ebf5';ctx.beginPath();ctx.ellipse(0,9,10,16,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.lineWidth=1.5;ctx.strokeStyle='#98bad3';
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(side*9,13);ctx.lineTo(side*41,-6);ctx.stroke();
      }
      ctx.fillStyle='#d9ecf5';ctx.beginPath();ctx.moveTo(-25,17);ctx.lineTo(25,17);ctx.lineTo(29,22);ctx.lineTo(-29,22);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#b6cede';ctx.lineWidth=2;
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(side*8,19);ctx.lineTo(side*19,32);ctx.stroke();
        ctx.fillStyle='#172d43';ctx.beginPath();ctx.ellipse(side*19,32,4,7,0,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=14;ctx.fillStyle='#fe5b69';ctx.shadowColor='#ff3f56';ctx.beginPath();ctx.arc(-76,-8,2.8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#75ffba';ctx.shadowColor='#75ffba';ctx.beginPath();ctx.arc(76,-8,2.8,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.textAlign='center';ctx.font='bold 10px ui-monospace,monospace';ctx.fillStyle='#b9e8ff';
      ctx.fillText('YOU · SHORT FINAL',0,56);
      ctx.restore();
    }
        // BFCache can restore an old game without re-running this file.
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      resetRadar();
      resetApproach();
      setTheme('sky');
      showLeg(0);
      setAutoStory(!reduced.matches);
    });
    resize();
    reconcile();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{ once: true });
  else init();
})();
