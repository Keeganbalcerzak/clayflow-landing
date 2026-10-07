const canvas = document.querySelector("#clay-canvas");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#prompt-form");
const promptInput = document.querySelector("#prompt-input");
const textureRange = document.querySelector("#texture-range");
const motionRange = document.querySelector("#motion-range");
const frameCount = document.querySelector("#frame-count");
const stageButtons = Array.from(document.querySelectorAll(".stage"));

const stageState = {
  seed: 0.18,
  diffuse: 0.46,
  sculpt: 0.72,
  shoot: 0.94
};

let activeStage = "sculpt";
let frame = 24;
let lastTick = 0;
let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let palette = buildPalette(promptInput.value);
let targetPalette = palette;
let blobs = createBlobs(promptInput.value);

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function seeded(seed) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixColor(a, b, amount) {
  const ah = a.replace("#", "");
  const bh = b.replace("#", "");
  const ar = parseInt(ah.slice(0, 2), 16);
  const ag = parseInt(ah.slice(2, 4), 16);
  const ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16);
  const bg = parseInt(bh.slice(2, 4), 16);
  const bb = parseInt(bh.slice(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * amount).toString(16).padStart(2, "0");
  const rg = Math.round(ag + (bg - ag) * amount).toString(16).padStart(2, "0");
  const rb = Math.round(ab + (bb - ab) * amount).toString(16).padStart(2, "0");
  return `#${rr}${rg}${rb}`;
}

function buildPalette(prompt) {
  const sets = [
    ["#ff6b57", "#14b8a6", "#2f64ff", "#c5f04a", "#ffe3dc"],
    ["#2f64ff", "#ff7d54", "#36c7b7", "#f5d34c", "#e7f0ff"],
    ["#18a999", "#f05243", "#5b6cff", "#d3ef54", "#e9fbf7"],
    ["#ed5f4d", "#22b8cf", "#3238a8", "#c7ec4f", "#fff1ec"]
  ];
  const index = hashString(prompt) % sets.length;
  return {
    primary: sets[index][0],
    secondary: sets[index][1],
    cobalt: sets[index][2],
    lime: sets[index][3],
    wash: sets[index][4],
    dark: "#2a2e35",
    floor: "#dce6ee"
  };
}

function createBlobs(prompt) {
  const rand = seeded(hashString(prompt));
  const count = 30;
  return Array.from({ length: count }, (_, index) => {
    const size = 18 + rand() * 54;
    const lane = index / Math.max(1, count - 1);
    return {
      x: 0.07 + lane * 0.78 + (rand() - 0.5) * 0.09,
      y: 0.15 + rand() * 0.56,
      size,
      wobble: 0.45 + rand() * 1.5,
      phase: rand() * Math.PI * 2,
      colorPick: rand(),
      stretch: 0.76 + rand() * 0.62
    };
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.round(rect.width * dpr));
  const height = Math.max(220, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function clayGradient(x, y, radius, base, light) {
  const gradient = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius
  );
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.34, base);
  gradient.addColorStop(1, mixColor(base, "#111827", 0.28));
  return gradient;
}

function drawBlob(x, y, radius, color, stretch, seed, grain) {
  const rand = seeded(seed);
  const points = 18;
  ctx.beginPath();
  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const pressure = 0.88 + rand() * 0.18;
    const px = x + Math.cos(angle) * radius * pressure * stretch;
    const py = y + Math.sin(angle) * radius * pressure * (1.08 - stretch * 0.12);
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      const prevAngle = ((index - 0.5) / points) * Math.PI * 2;
      const cpX = x + Math.cos(prevAngle) * radius * 1.08 * stretch;
      const cpY = y + Math.sin(prevAngle) * radius * 1.08;
      ctx.quadraticCurveTo(cpX, cpY, px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = clayGradient(x, y, radius * 1.35, color, mixColor(color, "#ffffff", 0.32));
  ctx.shadowColor = "rgba(35, 39, 47, 0.18)";
  ctx.shadowBlur = radius * 0.32;
  ctx.shadowOffsetY = radius * 0.18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.11 + grain * 0.12;
  for (let dot = 0; dot < 130; dot += 1) {
    const dx = x + (rand() - 0.5) * radius * 2.2 * stretch;
    const dy = y + (rand() - 0.5) * radius * 2.1;
    const dotSize = 0.8 + rand() * 1.8;
    ctx.beginPath();
    ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = rand() > 0.45 ? "#ffffff" : "#0f172a";
    ctx.fill();
  }
  ctx.restore();
}

function drawStageFloor(width, height, progress) {
  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, "#f8fbff");
  sky.addColorStop(0.38, palette.wash);
  sky.addColorStop(0.72, "#edf4f8");
  sky.addColorStop(1, "#dbe7ee");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.58;
  ctx.fillStyle = "#ffffff";
  for (let index = 0; index < 7; index += 1) {
    const x = width * (0.08 + index * 0.055);
    const y = height * (0.32 + Math.sin(index * 1.7 + progress) * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, height * (0.11 + index * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.roundRect(width * 0.04, height * 0.11, width * 0.78, height * 0.5, 28);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, height * 0.68);
  ctx.bezierCurveTo(width * 0.24, height * 0.56, width * 0.62, height * 0.78, width, height * 0.61);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = palette.floor;
  ctx.fill();

  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#27303b";
  ctx.lineWidth = 1;
  for (let x = -width; x < width * 2; x += Math.max(46, width * 0.045)) {
    ctx.beginPath();
    ctx.moveTo(x + progress * 20, height * 0.72);
    ctx.lineTo(x + width * 0.42, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCharacter(width, height, time, progress, grain) {
  const base = width < 720 ? Math.min(height * 0.52, width * 1.7) : Math.min(width, height);
  const cx = width * (width < 720 ? 0.68 : 0.72) + Math.sin(time * 0.55) * base * 0.012;
  const cy = height * (width < 720 ? 0.31 : 0.5);
  const hold = Number(motionRange.value) / 100;
  const frameStep = Math.round(time * (4 + hold * 7)) / (4 + hold * 7);
  const bob = Math.sin(frameStep * 3.2) * height * 0.012;

  drawBlob(cx, cy + base * 0.075 + bob, base * 0.12, palette.primary, 0.86, 11 + frame, grain);
  drawBlob(cx - base * 0.014, cy - base * 0.067 + bob, base * 0.082, palette.secondary, 0.9, 31 + frame, grain);
  drawBlob(cx - base * 0.118, cy + base * 0.055 + bob, base * 0.047, palette.cobalt, 0.72, 43 + frame, grain);
  drawBlob(cx + base * 0.12, cy + base * 0.052 + bob, base * 0.05, palette.cobalt, 0.72, 51 + frame, grain);
  drawBlob(cx - base * 0.055, cy + base * 0.215 + bob, base * 0.042, palette.dark, 0.62, 65 + frame, grain);
  drawBlob(cx + base * 0.062, cy + base * 0.215 + bob, base * 0.044, palette.dark, 0.62, 67 + frame, grain);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - base * 0.037, cy - base * 0.083 + bob, base * 0.013, 0, Math.PI * 2);
  ctx.arc(cx + base * 0.033, cy - base * 0.088 + bob, base * 0.013, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(cx - base * 0.035, cy - base * 0.082 + bob, base * 0.0056, 0, Math.PI * 2);
  ctx.arc(cx + base * 0.034, cy - base * 0.087 + bob, base * 0.0056, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(17, 24, 39, 0.7)";
  ctx.lineWidth = Math.max(2, base * 0.005);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - base * 0.024, cy - base * 0.018 + bob);
  ctx.quadraticCurveTo(cx + base * 0.007, cy + base * 0.004 + bob, cx + base * 0.043, cy - base * 0.018 + bob);
  ctx.stroke();

  if (progress > 0.6) {
    const glow = ctx.createRadialGradient(cx + base * 0.19, cy + base * 0.03, 4, cx + base * 0.19, cy + base * 0.03, base * 0.16);
    glow.addColorStop(0, "rgba(197, 240, 74, 0.88)");
    glow.addColorStop(1, "rgba(197, 240, 74, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx + base * 0.05, cy - base * 0.13, base * 0.32, base * 0.32);
    drawBlob(cx + base * 0.19, cy + base * 0.04 + bob, base * 0.04, palette.lime, 1.02, 77 + frame, grain);
  }
}

function drawDiffusionTrail(width, height, time, progress, grain) {
  const base = Math.min(width, height);
  blobs.forEach((blob, index) => {
    const reveal = Math.min(1, Math.max(0, progress * 1.55 - index * 0.032));
    if (reveal <= 0) return;
    const jitter = Math.sin(time * blob.wobble + blob.phase) * base * 0.012 * (1.25 - progress * 0.45);
    const x = blob.x * width + jitter;
    const y = blob.y * height + Math.cos(time * 0.8 + blob.phase) * base * 0.01;
    const radius = blob.size * (0.42 + reveal * 0.72) * (base / 740);
    const color = blob.colorPick > 0.66 ? palette.primary : blob.colorPick > 0.33 ? palette.secondary : palette.cobalt;
    ctx.globalAlpha = 0.2 + reveal * 0.72;
    drawBlob(x, y, radius, color, blob.stretch, index * 99 + frame, grain);
    ctx.globalAlpha = 1;
  });
}

function drawSetPieces(width, height, time, progress, grain) {
  const base = Math.min(width, height);
  const drift = Math.sin(time * 0.34) * base * 0.01;
  drawBlob(width * 0.9 + drift, height * 0.64, base * 0.115, mixColor(palette.secondary, "#ffffff", 0.08), 1.34, 301 + frame, grain);
  drawBlob(width * 0.82 - drift, height * 0.7, base * 0.08, mixColor(palette.cobalt, "#ffffff", 0.18), 0.72, 302 + frame, grain);
  drawBlob(width * 0.64, height * 0.71, base * 0.055, palette.lime, 1.18, 303 + frame, grain);
  drawBlob(width * 0.22, height * 0.66, base * 0.045, mixColor(palette.primary, "#ffffff", 0.18), 0.86, 304 + frame, grain);

  ctx.globalAlpha = 0.24 + progress * 0.16;
  ctx.strokeStyle = mixColor(palette.cobalt, "#ffffff", 0.1);
  ctx.lineWidth = Math.max(5, base * 0.012);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.57, height * 0.31);
  ctx.bezierCurveTo(width * 0.72, height * 0.16, width * 0.9, height * 0.34, width * 0.8, height * 0.49);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFrameGhosts(width, height, time, progress, grain) {
  if (progress < 0.35) return;
  const base = width < 720 ? Math.min(height * 0.52, width * 1.7) : Math.min(width, height);
  const cx = width * (width < 720 ? 0.68 : 0.72);
  const cy = height * (width < 720 ? 0.31 : 0.5);
  for (let index = 0; index < 3; index += 1) {
    ctx.save();
    ctx.globalAlpha = 0.08 + index * 0.035;
    ctx.translate(-base * (0.08 + index * 0.045), Math.sin(time + index) * base * 0.006);
    drawBlob(cx, cy + base * 0.075, base * (0.12 - index * 0.012), palette.primary, 0.86, 401 + index + frame, grain * 0.6);
    drawBlob(cx - base * 0.014, cy - base * 0.067, base * (0.082 - index * 0.008), palette.secondary, 0.9, 431 + index + frame, grain * 0.6);
    ctx.restore();
  }
}

function render(now = 0) {
  resizeCanvas();
  const width = canvas.width;
  const height = canvas.height;
  const time = reducedMotion ? 0.8 : now / 1000;
  const progress = stageState[activeStage];
  const grain = Number(textureRange.value) / 100;

  Object.keys(palette).forEach((key) => {
    if (typeof palette[key] === "string" && targetPalette[key]) {
      palette[key] = mixColor(palette[key], targetPalette[key], 0.05);
    }
  });

  drawStageFloor(width, height, progress);
  drawSetPieces(width, height, time, progress, grain);

  ctx.save();
  ctx.globalAlpha = 0.16 + progress * 0.12;
  ctx.translate(Math.sin(time * 0.4) * 4, Math.cos(time * 0.45) * 3);
  drawDiffusionTrail(width, height, time - 0.5, Math.max(0.15, progress - 0.15), grain);
  ctx.restore();

  drawFrameGhosts(width, height, time, progress, grain);
  drawDiffusionTrail(width, height, time, progress, grain);
  drawCharacter(width, height, time, progress, grain);

  if (!reducedMotion && now - lastTick > 520) {
    frame = (frame + 1) % 999;
    frameCount.textContent = String(frame).padStart(3, "0");
    lastTick = now;
  }

  if (!reducedMotion) {
    requestAnimationFrame(render);
  }
}

function evolveScene() {
  const value = promptInput.value.trim() || "soft clay product world";
  targetPalette = buildPalette(`${value}-${activeStage}`);
  blobs = createBlobs(`${value}-${Date.now()}`);
  frame = (frame + 7) % 999;
  frameCount.textContent = String(frame).padStart(3, "0");
  render(performance.now());
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  evolveScene();
});

stageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stageButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeStage = button.dataset.stage;
    evolveScene();
  });
});

textureRange.addEventListener("input", () => render(performance.now()));
motionRange.addEventListener("input", () => render(performance.now()));

window.addEventListener("resize", () => render(performance.now()));
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  reducedMotion = event.matches;
  if (!reducedMotion) requestAnimationFrame(render);
});

requestAnimationFrame(render);
