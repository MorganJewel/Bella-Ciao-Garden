document.addEventListener("DOMContentLoaded", () => {

/* ================== SUPABASE ================== */
const SUPABASE_URL = "https://pyxfpgdfqrdjnghndonl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGZwZ2RmcXJkam5naG5kb25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTA4NjQsImV4cCI6MjA4MjI2Njg2NH0.vNADBa5Tn1Yyyvto75aBIXYig586ilRF1ysuX7Fy_wg";

const REST_FLOWERS = `${SUPABASE_URL}/rest/v1/flowers`;
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json"
};

/* ================== DOM ================== */
const intro = document.getElementById("intro");
const garden = document.getElementById("garden");
const enterBtn = document.getElementById("enterBtn");
const world = document.getElementById("world");

const submitBtn = document.getElementById("submitStory");
const storyInput = document.getElementById("storyInput");
const nameInput = document.getElementById("nameInput");
const anonInput = document.getElementById("anonInput");

/* ================== WORLD ================== */
const WORLD_SIZE = 7000;
const WORLD_CENTER = WORLD_SIZE / 2;
const CELL_SIZE = 190;
const GRID_COLS = Math.floor(WORLD_SIZE / CELL_SIZE);

function clamp(v) {
  return Math.max(120, Math.min(WORLD_SIZE - 120, v));
}

/* ================== CAMERA ================== */
let camera = {
  x: -WORLD_CENTER,
  y: -WORLD_CENTER,
  zoom: 1,
  targetZoom: 1
};

let dragging = false;
let lastX = 0;
let lastY = 0;

document.addEventListener("mousedown", e => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("mouseup", () => dragging = false);
document.addEventListener("mousemove", e => {
  if (!dragging) return;
  camera.x += (e.clientX - lastX) / camera.zoom;
  camera.y += (e.clientY - lastY) / camera.zoom;
  lastX = e.clientX;
  lastY = e.clientY;
});
document.addEventListener("wheel", e => {
  e.preventDefault();
  camera.targetZoom += e.deltaY * -0.001;
  camera.targetZoom = Math.min(Math.max(camera.targetZoom, 0.35), 1.6);
}, { passive: false });

/* ================== AUDIO ================== */
let audioCtx = null;
let audioStarted = false;
let tracks = [];
let hoverInstrument = null;

const BASE = "/Bella-Ciao-Garden";
const trackDefs = [
  { name: "guitar1", file: `${BASE}/audio/guitar_1.ogg` },
  { name: "guitar2", file: `${BASE}/audio/guitar_2.ogg` },
  { name: "violin",  file: `${BASE}/audio/violin.ogg` },
  { name: "soprano", file: `${BASE}/audio/soprano.ogg` },
  { name: "alto",    file: `${BASE}/audio/alto.ogg` }
];

async function startAudio() {
  if (audioStarted) return;
  audioStarted = true;

  const decoded = await Promise.all(
    trackDefs.map(async t => {
      const res = await fetch(t.file);
      const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
      return { ...t, buffer: buf };
    })
  );

  const startTime = audioCtx.currentTime + 0.25;

  decoded.forEach(t => {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = t.buffer;
    src.loop = true;
    gain.gain.value = 0.6;
    src.connect(gain).connect(audioCtx.destination);
    src.start(startTime);
    tracks.push({ name: t.name, gain });
  });
}

function updateAudioMix() {
  if (!tracks.length) return;

  if (hoverInstrument) {
    tracks.forEach(t =>
      t.gain.gain.value = (t.name === hoverInstrument) ? 1.0 : 0.05
    );
  } else {
    tracks.forEach(t => t.gain.gain.value = 0.6);
  }
}

/* ================== FLOWERS ================== */
const flowers = [];
const COLORS = ["#f4d35e", "#ee964b", "#f95738", "#cdb4db", "#83c5be"];

function createTraits(story) {
  const intensity = Math.min(Math.max(story.length / 280, 0.2), 1);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    petals: Math.round(6 + intensity * 6),
    petalW: 12 + intensity * 4,
    petalH: 24 + intensity * 10,
    radius: 22 + intensity * 10,
    gradient: `linear-gradient(180deg, ${color}, rgba(0,0,0,0.25))`
  };
}

function gridPosition(index) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const jitter = 45;
  return {
    x: clamp(col * CELL_SIZE + CELL_SIZE / 2 + (Math.random() - 0.5) * jitter),
    y: clamp(row * CELL_SIZE + CELL_SIZE / 2 + (Math.random() - 0.5) * jitter)
  };
}

function renderFlower(flower) {
  const el = document.createElement("div");
  el.className = "flower";
  el.style.left = `${flower.x}px`;
  el.style.top = `${flower.y}px`;
  el.style.transform = "translate(-50%, -100%)";

  const blossom = document.createElement("div");
  blossom.className = "blossom";

  for (let i = 0; i < flower.traits.petals; i++) {
    const p = document.createElement("div");
    p.className = "petal";
    p.style.width = `${flower.traits.petalW}px`;
    p.style.height = `${flower.traits.petalH}px`;
    p.style.background = flower.traits.gradient;
    p.style.transform =
      `rotate(${(360 / flower.traits.petals) * i}deg)
       translateY(${flower.traits.radius}px)
       translateX(-50%)`;
    blossom.appendChild(p);
  }

  el.appendChild(blossom);

  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.innerHTML = `
    <div class="tip-name">
      ${flower.anonymous ? "Anonymous" : (flower.name || "Anonymous")}
    </div>
    <div class="tip-story">
      ${flower.story || ""}
    </div>
  `;
  el.appendChild(tip);

  el.addEventListener("mouseenter", () => {
    hoverInstrument = flower.instrument;
    el.classList.add("active");
  });

  el.addEventListener("mouseleave", () => {
    hoverInstrument = null;
    el.classList.remove("active");
  });

  world.appendChild(el);
}

/* ================== SUPABASE I/O ================== */
async function fetchFlowers() {
  const res = await fetch(`${REST_FLOWERS}?select=*&order=created_at.asc`, { headers: HEADERS });
  return await res.json();
}

async function insertFlower(row) {
  const res = await fetch(REST_FLOWERS, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  const data = await res.json();
  return data[0];
}

/* ================== SUBMIT ================== */
submitBtn.addEventListener("click", async () => {
  const story = storyInput.value.trim();
  if (!story) return;

  const index = flowers.length;
  const { x, y } = gridPosition(index);

  const saved = await insertFlower({
    x: Math.round(x),
    y: Math.round(y),
    instrument: trackDefs[Math.floor(Math.random() * trackDefs.length)].name,
    traits: createTraits(story),
    story,
    name: anonInput.checked ? null : nameInput.value.trim(),
    anonymous: anonInput.checked
  });

  flowers.push(saved);
  renderFlower(saved);
  storyInput.value = "";
});

/* ================== ENTER ================== */
enterBtn.addEventListener("click", async () => {
  intro.style.display = "none";
  garden.style.display = "block";

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  await startAudio();

  const loaded = await fetchFlowers();
  loaded.forEach((f, i) => {
    if (!f.x || !f.y) {
      const pos = gridPosition(i);
      f.x = pos.x;
      f.y = pos.y;
    }
    flowers.push(f);
    renderFlower(f);
  });

  requestAnimationFrame(function animate() {
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.08;
    world.style.transform =
      `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    updateAudioMix();
    requestAnimationFrame(animate);
  });
});

});

