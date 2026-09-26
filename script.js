// State & Variables
const state = {
  speed: 15,          // km/h
  baseSpeed: 15,
  targetSpeed: 15,
  distance: 0,        // meters
  fishCount: 0,
  gear: 3,
  themeIndex: 0,
  themes: ['day', 'sunset', 'night'],
  shadesOn: true,
  pedalAngle: 0,
  lastFrameTime: performance.now(),
  lastFishSpawn: 0,
  lastScenerySpawn: 0
};

// Web Audio API for interactive sound effects without external assets
class SoundController {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBell() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Bicycle two-tone ping "Ding... Dong!"
    const playTone = (freq, time, dur) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // Bell envelope
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    };

    playTone(1760, now, 0.4);       // High A6
    playTone(2093, now + 0.1, 0.6); // High C7
  }

  playQuack() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Pelican guttural croak / honk
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.Q.setValueAtTime(3.5, now);

    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playCatch() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Cute gulp / pop sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPedalBoost() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Wind whoosh / gear click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

const sounds = new SoundController();

// DOM Elements
const viewport = document.getElementById('viewport');
const roadSurface = document.getElementById('road-surface');
const cloudsLayer = document.getElementById('clouds');
const sceneryLayer = document.getElementById('scenery');
const collectiblesLayer = document.getElementById('collectibles');
const notificationsLayer = document.getElementById('notifications');
const pelicanBike = document.getElementById('pelican-bike');

const frontSpokes = document.getElementById('front-spokes');
const backSpokes = document.getElementById('back-spokes');
const crankGroup = document.getElementById('crank-group');
const legFrontPath = document.getElementById('leg-front-path');
const footFront = document.getElementById('foot-front');
const throatPouch = document.getElementById('throat-pouch');
const pouchFishSil = document.getElementById('pouch-fish-silhouette');
const shades = document.getElementById('pelican-shades');

const distVal = document.getElementById('dist-val');
const speedVal = document.getElementById('speed-val');
const fishVal = document.getElementById('fish-val');
const gearSlider = document.getElementById('gear-slider');
const gearNum = document.getElementById('gear-num');

const btnPedal = document.getElementById('btn-pedal');
const btnBell = document.getElementById('btn-bell');
const btnQuack = document.getElementById('btn-quack');
const btnShades = document.getElementById('btn-shades');
const btnTheme = document.getElementById('btn-theme');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
const bikeBellBtn = document.getElementById('bike-bell-btn');

// Lists for spawned entities
let clouds = [];
let roadStripes = [];
let sceneryItems = [];
let fishes = [];

// Init Cloud layer
function initClouds() {
  for (let i = 0; i < 6; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    const w = 70 + Math.random() * 80;
    const h = 24 + Math.random() * 20;
    const top = 10 + Math.random() * 60;
    const left = (i / 6) * 100 + Math.random() * 10;
    cloud.style.width = `${w}px`;
    cloud.style.height = `${h}px`;
    cloud.style.top = `${top}px`;
    cloud.style.left = `${left}%`;
    cloud.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
    cloudsLayer.appendChild(cloud);
    clouds.push({ el: cloud, x: left, speed: 0.15 + Math.random() * 0.2 });
  }
}

// Init Road Stripes
function initRoadStripes() {
  for (let i = 0; i < 12; i++) {
    const stripe = document.createElement('div');
    stripe.className = 'road-stripe';
    stripe.style.width = '60px';
    stripe.style.left = `${i * 120}px`;
    roadSurface.appendChild(stripe);
    roadStripes.push({ el: stripe, x: i * 120 });
  }
}

// Scenery SVG templates (Palm trees, street lights, coastal rocks)
function createSceneryElement(type) {
  const wrapper = document.createElement('div');
  wrapper.className = 'scenery-item';
  wrapper.style.left = '105%';

  if (type === 'palm') {
    wrapper.innerHTML = `
      <svg width="70" height="150" viewBox="0 0 70 150">
        <!-- Palm Trunk -->
        <path d="M 25 150 Q 40 80 32 30" stroke="#8d6e63" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 25 140 L 35 130 M 28 110 L 37 100 M 30 75 L 38 65" stroke="#6d4c41" stroke-width="2"/>
        <!-- Palm Leaves -->
        <path d="M 32 30 Q 10 10 -15 25" stroke="#2e7d32" stroke-width="5" fill="none"/>
        <path d="M 32 30 Q 45 -5 65 15" stroke="#388e3c" stroke-width="5" fill="none"/>
        <path d="M 32 30 Q 20 -10 25 -25" stroke="#4caf50" stroke-width="4.5" fill="none"/>
        <path d="M 32 30 Q -5 30 -25 55" stroke="#1b5e20" stroke-width="4" fill="none"/>
        <path d="M 32 30 Q 55 35 75 50" stroke="#2e7d32" stroke-width="4" fill="none"/>
      </svg>
    `;
  } else if (type === 'lamp') {
    wrapper.innerHTML = `
      <svg width="35" height="130" viewBox="0 0 35 130">
        <line x1="18" y1="130" x2="18" y2="20" stroke="#334155" stroke-width="4"/>
        <path d="M 18 20 Q 18 5 30 5" fill="none" stroke="#334155" stroke-width="3"/>
        <circle cx="30" cy="12" r="5" fill="#fef08a"/>
        <path d="M 24 8 L 36 8 L 32 15 L 28 15 Z" fill="#475569"/>
      </svg>
    `;
  } else {
    // Coastal post / milestone
    wrapper.innerHTML = `
      <svg width="30" height="60" viewBox="0 0 30 60">
        <rect x="8" y="20" width="14" height="40" rx="3" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
        <rect x="8" y="28" width="14" height="6" fill="#ef4444"/>
      </svg>
    `;
  }
  return wrapper;
}

// Collectible Flying Fish
function spawnFish() {
  const fish = document.createElement('div');
  fish.className = 'collectible-fish';
  // Fish flies in air around pelican pouch level (50px to 140px above road)
  const y = 80 + Math.random() * 80;
  fish.style.top = `${y}px`;
  fish.style.left = '105%';
  
  fish.innerHTML = `
    <svg viewBox="0 0 40 24" width="40" height="24">
      <!-- Fish Body -->
      <path d="M 4 12 C 10 3, 28 4, 34 12 C 28 20, 10 21, 4 12 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
      <!-- Tail -->
      <polygon points="4,12 -2,4 -2,20" fill="#0284c7"/>
      <!-- Fin -->
      <polygon points="18,12 25,6 23,12" fill="#7dd3fc"/>
      <!-- Eye -->
      <circle cx="28" cy="10" r="2.5" fill="#ffffff"/>
      <circle cx="28.5" cy="10" r="1.2" fill="#0f172a"/>
      <!-- Scale shine -->
      <path d="M 16 9 Q 20 12 16 15" stroke="#e0f2fe" stroke-width="1" fill="none"/>
    </svg>
  `;

  collectiblesLayer.appendChild(fish);
  fishes.push({ el: fish, x: viewport.clientWidth + 50, y: y, collected: false });
}

// Show floating feedback (+1 🐟, 冲刺!, etc.)
function showNotification(text, color = '#f59e0b') {
  const msg = document.createElement('div');
  msg.className = 'floating-msg';
  msg.textContent = text;
  msg.style.color = color;
  msg.style.left = `${(Math.random() * 40 - 20)}px`;
  notificationsLayer.appendChild(msg);

  setTimeout(() => {
    if (msg.parentNode) msg.parentNode.removeChild(msg);
  }, 1200);
}

// Pedal Boost Action
function pedalBoost() {
  sounds.playPedalBoost();
  // Boost target speed depending on gear
  state.targetSpeed = Math.min(65, state.targetSpeed + 10 * (state.gear / 3));
  
  // Wiggle / bounce container
  pelicanBike.classList.add('sprinting');
  setTimeout(() => pelicanBike.classList.remove('sprinting'), 400);

  showNotification('⚡ 加速!', '#38bdf8');
}

// Ding Dong Bell Action
function ringBell() {
  sounds.playBell();
  showNotification('🔔 叮铃铃~', '#facc15');

  // Vibrate bell icon in SVG
  bikeBellBtn.style.transform = 'translate(268px, 105px) rotate(15deg)';
  setTimeout(() => {
    bikeBellBtn.style.transform = 'translate(268px, 105px) rotate(-15deg)';
    setTimeout(() => {
      bikeBellBtn.style.transform = 'translate(268px, 105px) rotate(0deg)';
    }, 100);
  }, 100);
}

// Pelican Quack Action
function pelicanQuack() {
  sounds.playQuack();
  showNotification('📢 嘎嘎嘎!', '#f97316');

  // Gular sac puff / expand animation
  throatPouch.style.transform = 'scale(1.2, 1.25)';
  throatPouch.style.transformOrigin = '270px 75px';
  setTimeout(() => {
    throatPouch.style.transform = 'scale(1, 1)';
  }, 350);
}

// Toggle Sunglasses
function toggleShades() {
  state.shadesOn = !state.shadesOn;
  shades.style.display = state.shadesOn ? 'block' : 'none';
  showNotification(state.shadesOn ? '😎 戴上墨镜' : '👀 摘下墨镜', '#a855f7');
}

// Cycle Themes: Day -> Sunset -> Night
function cycleTheme() {
  state.themeIndex = (state.themeIndex + 1) % state.themes.length;
  const theme = state.themes[state.themeIndex];
  document.documentElement.setAttribute('data-theme', theme);

  if (theme === 'day') {
    themeIcon.textContent = '🌅';
    themeText.textContent = '海边白昼';
    showNotification('☀️ 白昼海岸', '#38bdf8');
  } else if (theme === 'sunset') {
    themeIcon.textContent = '🌙';
    themeText.textContent = '落日黄昏';
    showNotification('🌇 落日晚霞', '#f97316');
  } else {
    themeIcon.textContent = '☀️';
    themeText.textContent = '静谧星夜';
    showNotification('🌌 星夜海风', '#818cf8');
  }
}

// Catch Fish Event
function catchFish(fishObj) {
  fishObj.collected = true;
  state.fishCount++;
  fishVal.textContent = `${state.fishCount} 🐟`;
  sounds.playCatch();
  showNotification('+1 大肥鱼! 🐟', '#22c55e');

  // Expand throat pouch briefly & flash fish inside
  throatPouch.style.transform = 'scale(1.3, 1.4)';
  throatPouch.style.transformOrigin = '270px 75px';
  pouchFishSil.style.opacity = '1';

  setTimeout(() => {
    throatPouch.style.transform = 'scale(1, 1)';
    pouchFishSil.style.opacity = '0';
  }, 450);

  // Remove fish element
  if (fishObj.el.parentNode) {
    fishObj.el.parentNode.removeChild(fishObj.el);
  }
}

// Physics & Animation Loop
function animate(currentTime) {
  const dt = Math.min((currentTime - state.lastFrameTime) / 1000, 0.1);
  state.lastFrameTime = currentTime;

  // Base speed depends on gear
  state.baseSpeed = 8 + (state.gear - 1) * 6; // gear 1=8, 3=20, 5=32 km/h
  
  // Smooth speed decay back toward baseSpeed
  if (state.speed < state.targetSpeed) {
    state.speed += (state.targetSpeed - state.speed) * Math.min(dt * 6, 1);
  } else {
    state.speed -= (state.speed - state.baseSpeed) * Math.min(dt * 0.8, 1);
  }

  // Update target speed decay
  if (state.targetSpeed > state.baseSpeed) {
    state.targetSpeed -= (state.targetSpeed - state.baseSpeed) * Math.min(dt * 0.7, 1);
  } else {
    state.targetSpeed = state.baseSpeed;
  }

  // Update distance
  const speedMps = (state.speed * 1000) / 3600; // meters per second
  state.distance += speedMps * dt;

  // UI updates
  distVal.textContent = `${(state.distance / 1000).toFixed(2)} km`;
  speedVal.textContent = `${Math.round(state.speed)} km/h`;

  // Rotate wheels & pedals
  const wheelCircumference = 2 * Math.PI * 0.35; // approx 2.2m per rotation
  const rotations = (speedMps * dt) / wheelCircumference;
  state.pedalAngle = (state.pedalAngle + rotations * 360) % 360;

  // Wheel spokes rotation
  frontSpokes.setAttribute('transform', `rotate(${state.pedalAngle})`);
  backSpokes.setAttribute('transform', `rotate(${state.pedalAngle})`);
  crankGroup.setAttribute('transform', `translate(195, 240) rotate(${state.pedalAngle})`);

  // Animate Pelican's front leg & foot with the pedal crank
  const rad = (state.pedalAngle * Math.PI) / 180;
  const pedalX = 195 + 18 * Math.cos(rad);
  const pedalY = 240 + 16 * Math.sin(rad);
  
  // Calculate knee position
  const hipX = 185;
  const hipY = 185;
  const kneeX = (hipX + pedalX) / 2 + 12 * Math.sin(rad);
  const kneeY = (hipY + pedalY) / 2 + 14 * Math.cos(rad);

  legFrontPath.setAttribute('d', `M ${hipX} ${hipY} Q ${kneeX} ${kneeY} ${pedalX} ${pedalY}`);
  footFront.setAttribute('transform', `translate(${pedalX - 212}, ${pedalY - 225})`);

  // Move Road stripes
  const roadPixelSpeed = speedMps * 25 * dt;
  roadStripes.forEach(s => {
    s.x -= roadPixelSpeed;
    if (s.x < -80) {
      s.x += roadStripes.length * 120;
    }
    s.el.style.left = `${s.x}px`;
  });

  // Move Clouds
  clouds.forEach(c => {
    c.x -= c.speed * (state.speed / 15) * dt * 8;
    if (c.x < -20) {
      c.x = 105;
    }
    c.el.style.left = `${c.x}%`;
  });

  // Move Scenery
  const sceneryPixelSpeed = speedMps * 20 * dt;
  for (let i = sceneryItems.length - 1; i >= 0; i--) {
    const item = sceneryItems[i];
    item.x -= sceneryPixelSpeed;
    item.el.style.left = `${item.x}px`;
    if (item.x < -100) {
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
      sceneryItems.splice(i, 1);
    }
  }

  // Spawn Scenery periodically
  if (currentTime - state.lastScenerySpawn > 2400 / (state.speed / 15)) {
    state.lastScenerySpawn = currentTime;
    const types = ['palm', 'lamp', 'post'];
    const selected = types[Math.floor(Math.random() * types.length)];
    const el = createSceneryElement(selected);
    sceneryLayer.appendChild(el);
    sceneryItems.push({ el: el, x: viewport.clientWidth + 50 });
  }

  // Move & check collision for flying fish
  const pelicanRect = pelicanBike.getBoundingClientRect();
  // Pelican beak / mouth hit area relative to screen
  const mouthHitX = pelicanRect.left + pelicanRect.width * 0.78;
  const mouthHitY = pelicanRect.top + pelicanRect.height * 0.28;
  const hitRadius = 45;

  const fishPixelSpeed = speedMps * 22 * dt;
  for (let i = fishes.length - 1; i >= 0; i--) {
    const f = fishes[i];
    f.x -= fishPixelSpeed;
    f.el.style.left = `${f.x}px`;

    const fRect = f.el.getBoundingClientRect();
    const fishCenterX = fRect.left + fRect.width / 2;
    const fishCenterY = fRect.top + fRect.height / 2;

    // Check distance between beak and fish
    const dist = Math.hypot(fishCenterX - mouthHitX, fishCenterY - mouthHitY);
    if (!f.collected && dist < hitRadius) {
      catchFish(f);
      fishes.splice(i, 1);
      continue;
    }

    // Despawn fish if offscreen
    if (f.x < -60) {
      if (f.el.parentNode) f.el.parentNode.removeChild(f.el);
      fishes.splice(i, 1);
    }
  }

  // Spawn Fish randomly
  if (currentTime - state.lastFishSpawn > 3200 / (state.speed / 15)) {
    state.lastFishSpawn = currentTime;
    if (Math.random() > 0.3) {
      spawnFish();
    }
  }

  requestAnimationFrame(animate);
}

// Gear slider change
gearSlider.addEventListener('input', (e) => {
  state.gear = parseInt(e.target.value, 10);
  const titles = ['1 档 (悠闲慢骑)', '2 档 (海风漫游)', '3 档 (标准巡航)', '4 档 (快速飞驰)', '5 档 (暴风追击)'];
  gearNum.textContent = titles[state.gear - 1];
  showNotification(`变速: ${titles[state.gear - 1]}`, '#0284c7');
});

// Event Listeners
btnPedal.addEventListener('click', (e) => {
  e.stopPropagation();
  pedalBoost();
});

btnBell.addEventListener('click', (e) => {
  e.stopPropagation();
  ringBell();
});

btnQuack.addEventListener('click', (e) => {
  e.stopPropagation();
  pelicanQuack();
});

btnShades.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShades();
});

btnTheme.addEventListener('click', (e) => {
  e.stopPropagation();
  cycleTheme();
});

bikeBellBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  ringBell();
});

// Viewport click/tap -> pedal accelerate
viewport.addEventListener('click', () => {
  pedalBoost();
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    pedalBoost();
  } else if (e.code === 'KeyB') {
    ringBell();
  } else if (e.code === 'KeyQ') {
    pelicanQuack();
  } else if (e.code === 'KeyG') {
    toggleShades();
  } else if (e.code === 'KeyT') {
    cycleTheme();
  } else if (e.key >= '1' && e.key <= '5') {
    gearSlider.value = e.key;
    gearSlider.dispatchEvent(new Event('input'));
  }
});

// Initialization
initClouds();
initRoadStripes();
requestAnimationFrame(animate);
