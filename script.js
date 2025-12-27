document.addEventListener("DOMContentLoaded", () => {

  /* ================== SUPABASE CONFIG ================== */
  const SUPABASE_URL = "https://pyxfpgdfqrdjnghndonl.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGZwZ2RmcXJkam5naG5kb25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTA4NjQsImV4cCI6MjA4MjI2Njg2NH0.vNADBa5Tn1Yyyvto75aBIXYig586ilRF1ysuX7Fy_wg";

  const REST_FLOWERS = `${SUPABASE_URL}/rest/v1/flowers`;
  const HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  /* ================== ELEMENTS ================== */
  const intro = document.getElementById("intro");
  const garden = document.getElementById("garden");
  const enterBtn = document.getElementById("enterBtn");
  const world = document.getElementById("world");

  const submitBtn = document.getElementById("submitStory");
  const storyInput = document.getElementById("storyInput");
  const nameInput = document.getElementById("nameInput");
  const anonInput = document.getElementById("anonInput");
  const submitStatus = document.getElementById("submitStatus");

  /* ================== WORLD CONSTANTS ================== */
  const WORLD_SIZE = 5200;
  const WORLD_CENTER = WORLD_SIZE / 2;

  function clampToWorld(v) {
    return Math.max(120, Math.min(WORLD_SIZE - 120, v));
  }

  /* ================== CAMERA ================== */
  let camera = { x: 0, y: 0, zoom: 1, targetZoom: 1 };
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
    camera.targetZoom += e.deltaY * -0.001;
    camera.targetZoom = Math.min(Math.max(camera.targetZoom, 0.3), 1.5);
  });

  function getCameraWorldPosition() {
    return {
      wx: -camera.x + WORLD_CENTER,
      wy: -camera.y + WORLD_CENTER
    };
  }

  /* ================== AUDIO ================== */
  let audioCtx = null;
  let tracks = [];
  let hoverInstrument = null;

  // FIX: GitHub Pages requires correct absolute paths
  const BASE_PATH = window.location.pathname.replace(/\/$/, "");
  const trackDefs = [
    { name: "guitar1", file: `${BASE_PATH}/audio/guitar_1.ogg` },
    { name: "guitar2", file: `${BASE_PATH}/audio/guitar_2.ogg` },
    { name: "violin", file: `${BASE_PATH}/audio/violin.ogg` },
    { name: "soprano", file: `${BASE_PATH}/audio/soprano.ogg` },
    { name: "alto", file: `${BASE_PATH}/audio/alto.ogg` }
  ];

  async function startAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    await audioCtx.resume(); // REQUIRED for GitHub Pages

    const decoded = await Promise.all(
      trackDefs.map(async t => {
        try {
          const res = await fetch(t.file);
          if (!res.ok) throw new Error(`Audio fetch failed: ${t.file}`);
          const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
          return { ...t, buffer: buf };
        } catch (err) {
          console.error("Audio load error:", err);
          return null;
        }
      })
    );

    const validTracks = decoded.filter(Boolean);
    const startTime = audioCtx.currentTime + 0.25;

    validTracks.forEach(t => {
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

  /* ================== FLOWER SYSTEM ================== */
  const flowers = [];

  const COLORS = [
    "#f4d35e", "#ee964b", "#f95738", "#cdb4db",
    "#83c5be", "#6a994e", "#ffd6a5", "#bde0fe"
  ];

  function storyIntensity(story) {
    return Math.min(Math.max(story.length / 300, 0.2), 1);
  }

  function createTraits(story, instrument) {
    const intensity = storyIntensity(story);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return {
      petals: Math.round(5 + intensity * 6),
      petalW: 12 + intensity * 4,
      petalH: 24 + intensity * 10,
      radius: 18 + intensity * 8,
      color,
      gradient: `linear-gradient(180deg, ${color}, rgba(0,0,0,${0.2 + intensity * 0.2}))`,
      pulse: 1.5 + Math.random() * 0.6
    };
  }

  function motionClass(inst) {
    if (inst.startsWith("guitar")) return "motion-guitar";
    if (inst === "violin") return "motion-violin";
    return "motion-soprano";
  }

  function renderFlower(flower, planting = false) {
    const el = document.createElement("div");
    el.className = `flower ${planting ? "planting" : "live"} ${motionClass(flower.instrument)}`;
    el.style.left = `${flower.x}px`;
    el.style.top = `${WORLD_SIZE - flower.y}px`;
    el.style.transform = "translate(-50%, -100%)";

    const stem = document.createElement("div");
    stem.className = "stem";
    el.appendChild(stem);

    const blossom = document.createElement("div");
    blossom.className = "blossom";

    for (let i = 0; i < flower.traits.petals; i++) {
      const p = document.createElement("div");
      p.className = "petal";
      p.style.width = `${flower.traits.petalW}px`;
      p.style.height = `${flower.traits.petalH}px`;
      p.style.background = flower.traits.gradient;
      p.style.transform =
        `rotate(${(360 / flower.traits.petals) * i}deg) translateY(${flower.traits.radius}px) translateX(-50%)`;
      blossom.appendChild(p);
    }

    const center = document.createElement("div");
    center.className = "center";
    center.style.animationDuration = `${flower.traits.pulse}s`;
    blossom.appendChild(center);

    el.appendChild(blossom);

    const tip = document.createElement("div");
    tip.className = "tooltip";
    tip.innerHTML = `
      <div class="meta">${flower.anonymous ? "Anonymous" : (flower.name || "Anonymous")}</div>
      <div>${flower.story}</div>
    `;
    el.appendChild(tip);

    el.addEventListener("mouseenter", () => hoverInstrument = flower.instrument);
    el.addEventListener("mouseleave", () => hoverInstrument = null);

    world.appendChild(el);

    if (planting) {
      setTimeout(() => {
        el.classList.remove("planting");
        el.classList.add("live");
      }, 2200);
    }

    flower._el = el;
  }

  /* ================== AUDIO MIX ================== */
  function updateAudio() {
    if (!tracks.length) return;

    if (hoverInstrument) {
      tracks.forEach(t =>
        t.gain.gain.value = (t.name === hoverInstrument) ? 1.0 : 0.05
      );
      return;
    }

    if (!flowers.length) return;

    const { wx, wy } = getCameraWorldPosition();
    let closest = null;
    let dist = Infinity;

    flowers.forEach(f => {
      const d = Math.hypot(f.x - wx, f.y - wy);
      if (d < dist) {
        dist = d;
        closest = f.instrument;
      }
    });

    const z = (camera.zoom - 0.3) / 1.2;

    tracks.forEach(t => {
      if (t.name === closest) {
        t.gain.gain.value = 0.2 + z * 0.8;
      } else {
        t.gain.gain.value = 0.6 * (1 - z);
      }
    });
  }

  function animate() {
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.08;
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    updateAudio();
    requestAnimationFrame(animate);
  }

  /* ================== SUPABASE ================== */
  async function fetchFlowers() {
    try {
      const res = await fetch(`${REST_FLOWERS}?select=*&order=created_at.asc`, { headers: HEADERS });
      if (!res.ok) throw new Error("Supabase fetch failed");
      return await res.json();
    } catch (err) {
      console.error("Supabase fetch error:", err);
      return [];
    }
  }

  async function insertFlower(row) {
    try {
      const res = await fetch(REST_FLOWERS, {
        method: "POST",
        headers: { ...HEADERS, Prefer: "return=representation" },
        body: JSON.stringify(row)
      });
      if (!res.ok) throw new Error("Supabase insert failed");
      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error("Supabase insert error:", err);
      throw err;
    }
  }

  /* ================== SUBMIT ================== */
  submitBtn.addEventListener("click", async () => {
    const story = storyInput.value.trim();
    if (!story) return;

    submitBtn.disabled = true;
    submitStatus.textContent = "Planting…";

    try {
      const { wx, wy } = getCameraWorldPosition();
      const x = clampToWorld(wx + (Math.random() - 0.5) * 200);
      const y = clampToWorld(wy + (Math.random() - 0.5) * 200);

      const instrument = trackDefs[Math.floor(Math.random() * trackDefs.length)].name;
      const traits = createTraits(story, instrument);

      const saved = await insertFlower({
        x: Math.round(x),
        y: Math.round(y),
        instrument,
        traits,
        story,
        name: anonInput.checked ? null : nameInput.value.trim(),
        anonymous: anonInput.checked
      });

      const flower = { ...saved };
      flowers.push(flower);
      renderFlower(flower, true);

      storyInput.value = "";
      submitStatus.textContent = "Planted.";
      setTimeout(() => submitStatus.textContent = "", 900);

    } catch (e) {
      submitStatus.textContent = "Error planting flower.";
      console.error(e);
    }

    submitBtn.disabled = false;
  });

  /* ================== ENTER ================== */
  enterBtn.addEventListener("click", async () => {
    intro.style.display = "none";
    garden.style.display = "block";

    await startAudio(); // FIX: now allowed by browser

    const loaded = await fetchFlowers();
    loaded.forEach(f => {
      flowers.push(f);
      renderFlower(f, false);
    });

    requestAnimationFrame(animate);
  });

});
