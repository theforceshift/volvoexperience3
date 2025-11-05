
// let capture; // Motion detection disabled
// let previousFrame; // Motion detection disabled
let grainBuffer;

// --- THAM SỐ CHO BACKGROUND ---
const PARTICLE_COUNT = 250; 
const PARTICLE_COLOR_PALETTE = ['#a2d2ff', '#bde0fe', '#6E86F7', '#C6E667', '#062DEC']; 
const PARTICLE_OPACITY = 100;
const PARTICLE_MIN_SPEED = 3; 
const PARTICLE_MAX_SPEED = 10;   
const PARTICLE_MIN_WEIGHT = 2;  
const PARTICLE_MAX_WEIGHT = 15; 
const FLOW_FIELD_RESOLUTION = 20; 
const FLOW_FIELD_FORCE = 0.8; 
const PERLIN_NOISE_SCALE = 0.02;
const PERLIN_TIME_EVOLUTION = 0.009;
const BACKGROUND_DECAY_RATE = 10;

// --- THAM SỐ CHO PARTICLE TƯƠNG TÁC (KHI GIỮ NÚT) ---
const INTERACTIVE_PARTICLE_COLOR = '#FF5017';
const INTERACTIVE_PARTICLE_SPAWN_RATE = 6;
const INTERACTIVE_PARTICLE_SPAWN_DURATION = 2000;
const INTERACTIVE_SPAWN_LOCATION_RATIO = 0.5;
const INTERACTIVE_PARTICLE_MIN_SPEED = 5;
const INTERACTIVE_PARTICLE_MAX_SPEED = 10;
const INTERACTIVE_PARTICLE_MIN_WEIGHT = 3;
const INTERACTIVE_PARTICLE_MAX_WEIGHT = 14;
const MAX_PARTICLE_LIMIT = 600;

// --- Biến cho Flow Field Background ---
let flowfieldLayer;
let flowfield;
let particles = [];
let zoff = 0;

// --- Interactivity Globals ---
let presenceButton;
let isHoldingButton = false;
let holdStartTime = 0;
let font;
let textPoints = [];
let textAnimation = { isAnimating: false, startTime: 0, duration: 3000 };
let textGlowBuffer;
let textColor; 
let backgroundColor;

// --- Data from Google Sheet ---
let messagesTable;
let loadedMessages = []; 
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0mNWVCtB6splBEobm2KLRHdwadKP-yenf2by4QBT2CRQtosg4YvMTXwef8CWp3GVmksq3SLfV2GYG/pub?output=csv';

// --- FONT SELECTION ---
const FONT_PATH = 'PlaywriteDKUloopet-Thin.ttf';

// --- BUTTON CONTROL ---
const BUTTON_VISIBILITY_TIMEOUT = 12000, BUTTON_SIZE = 60, BUTTON_FADE_SPEED = 0.05, MAX_HOLD_TIME = 3000;
const BUTTON_COOLDOWN_DURATION = 4000, BUTTON_GROW_SPEED = 0.1, BUTTON_GROW_FACTOR = 2.6;
const BUTTON_DRAW_SPEED = 0.04, BUTTON_STROKE_WEIGHT = 2;

// --- TEXT & MESSAGE CONTROL ---
const TEXT_FONT_SIZE = 45;
const TEXT_SAMPLE_FACTOR = 0.3;
const TEXT_OPACITY = 100;
const TEXT_BREATHING_MIN_SIZE = 2.5;
const TEXT_BREATHING_MAX_SIZE = 4.0;
const TEXT_BREATHING_SPEED = 0.002;
const TEXT_ANIM_MIN_DURATION = 1500, TEXT_ANIM_MAX_DURATION = 4000;

// --- VISUAL EFFECTS ---
const GRAIN_AMOUNT = 0;

// --- EMBEDDED P5.BRUSH LIBRARY LOGIC ---
(function() {
  p5.prototype.brush = {
    _styles: {}, _current: null, _color: { h: 0, s: 0, v: 0, a: 255 }, _weight: 1,
  };
  p5.prototype.brush.define = function(name, options) { this._styles[name] = options; };
  p5.prototype.brush.set = function(name) {
    if (!this._styles[name]) throw `Brush "${name}" not found!`;
    this._current = this._styles[name];
  };
  p5.prototype.brush.stroke = function(h, s, v, a) {
    let c = this._color;
    if (h instanceof p5.Color) {
      c.h = hue(h); c.s = saturation(h); c.v = brightness(h);
      c.a = s === undefined ? 100 : s; 
    } else { c.h = h; c.s = s; c.v = v; c.a = a; }
  };
  p5.prototype.brush.strokeWeight = function(weight) { this._weight = weight; };
  p5.prototype.brush.line = function(x1, y1, x2, y2, pg) {
    let target = pg || window;
    if (!this._current) return;
    let d = dist(x1, y1, x2, y2); let s = this._current.spacing * this._weight;
    let steps = Math.max(1, Math.round(d / s));
    for (let i = 0; i < steps; i++) {
      let t = i / steps;
      this._drawBrush(lerp(x1, x2, t), lerp(y1, y2, t), this._weight, target);
    }
  };
  p5.prototype.brush._drawBrush = function(x, y, w, target) {
    for (let i = 0; i < this._current.layers.length; i++) {
      let layer = this._current.layers[i];
      if (layer.mode) target.blendMode(layer.mode);
      let c = layer.color || this._color;
      let alpha = this._color.a === undefined ? 100 : this._color.a;
      target.fill(c.h, c.s, c.v, (layer.flow / 100) * alpha);
      target.noStroke();
      for (let j = 0; j < layer.strokes; j++) {
        let sx = x + (randomGaussian() * layer.jitter * w);
        let sy = y + (randomGaussian() * layer.jitter * w);
        let sw = max(0.1, w + (randomGaussian() * layer.scale * w));
        target.circle(sx, sy, sw);
      }
    }
  };
})();
// --- END OF EMBEDDED LIBRARY ---

function preload() {
  font = loadFont(FONT_PATH);
  messagesTable = loadTable(SPREADSHEET_URL, 'csv');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  if (messagesTable) {
    for (let r = 0; r < messagesTable.getRowCount(); r++) {
      const msg = messagesTable.getString(r, 0); 
      if (msg && msg.trim() !== '') { 
        loadedMessages.push(msg.trim());
      }
    }
  }
  if (loadedMessages.length === 0) {
    loadedMessages.push("Stay curious"); 
    console.warn("Could not load messages from spreadsheet or it was empty. Using default message.");
  }

  setupGraphics();
  setupButton();
}

function setupGraphics() {
  backgroundColor = color('#F7F2EE'); // <-- MÀU NỀN ĐÃ ĐƯỢC CẬP NHẬT TẠI ĐÂY
  textColor = color(0, 0, 100); 
  
  textGlowBuffer = createGraphics(width, height);
  textGlowBuffer.colorMode(HSB, 360, 100, 100, 100);

  setupFlowField();
  
  createGrainTexture();
}

function setupFlowField() {
  flowfieldLayer = createGraphics(width, height);
  flowfieldLayer.colorMode(HSB, 360, 100, 100, 100);
  flowfieldLayer.background(backgroundColor);

  brush.define('smoothStroke', {
    spacing: 0.3,
    layers: [{ 
      strokes: 3, 
      jitter: 0.1, 
      scale: 0.2,
      flow: 30 
    }]
  });

  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new FlowParticle(false));
  }

  const cols = floor(width / FLOW_FIELD_RESOLUTION);
  const rows = floor(height / FLOW_FIELD_RESOLUTION);
  flowfield = new Array(cols * rows);
}


function draw() {
  if (isHoldingButton && millis() - holdStartTime < INTERACTIVE_PARTICLE_SPAWN_DURATION) {
    spawnInteractiveParticles(INTERACTIVE_PARTICLE_SPAWN_RATE);
  }

  updateAndDrawFlowFieldBackground();
  image(flowfieldLayer, 0, 0);

  updateButton();
  drawButton();
  updateAndDrawText();
  applyGrain();
}

function spawnInteractiveParticles(count) {
  if (particles.length >= MAX_PARTICLE_LIMIT) return;

  const buttonPos = presenceButton.pos;
  const spawnRadius = presenceButton.currentSize / 2;

  for (let i = 0; i < count; i++) {
    let p = new FlowParticle(true);
    
    if (random() < INTERACTIVE_SPAWN_LOCATION_RATIO) {
      p.pos.set(
        buttonPos.x + random(-spawnRadius, spawnRadius), 
        buttonPos.y + random(-spawnRadius, spawnRadius)
      );
    } else {
      p.pos.set(random(-50, 0), random(height));
    }
    
    p.updatePrev();
    particles.push(p);
  }
}

// --- LOGIC CHO FLOW FIELD BACKGROUND ---

function updateAndDrawFlowFieldBackground() {
    flowfieldLayer.noStroke();
    flowfieldLayer.fill(hue(backgroundColor), saturation(backgroundColor), brightness(backgroundColor), BACKGROUND_DECAY_RATE);
    flowfieldLayer.rect(0, 0, width, height);

    const cols = floor(width / FLOW_FIELD_RESOLUTION);
    const rows = floor(height / FLOW_FIELD_RESOLUTION);
    let yoff = 0;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            let index = x + y * cols;
            let angleNoise = noise(xoff, yoff, zoff) * TWO_PI;
            let perturbation = p5.Vector.fromAngle(angleNoise);
            perturbation.mult(0.4); 
            
            let baseFlow = createVector(1, 0); 
            let finalVector = baseFlow.add(perturbation);
            finalVector.setMag(FLOW_FIELD_FORCE);
            
            flowfield[index] = finalVector;
            xoff += PERLIN_NOISE_SCALE;
        }
        yoff += PERLIN_NOISE_SCALE;
    }
    zoff += PERLIN_TIME_EVOLUTION;

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.follow(flowfield);
        p.update();
        p.edges();
        p.show(flowfieldLayer);
        
        if (p.isDead) {
          particles.splice(i, 1);
        }
    }
}

class FlowParticle {
    constructor(isInteractive = false) {
        this.isInteractive = isInteractive;
        this.isDead = false;
        
        this.pos = createVector(random(width), random(height));
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        
        if (this.isInteractive) {
          this.setToInteractive();
        } else {
          this.setToDefault();
        }
        this.prevPos = this.pos.copy();
    }
    
    setToDefault() {
      this.color = color(random(PARTICLE_COLOR_PALETTE));
      this.weight = random(PARTICLE_MIN_WEIGHT, PARTICLE_MAX_WEIGHT);
      this.maxSpeed = random(PARTICLE_MIN_SPEED, PARTICLE_MAX_SPEED);
    }
    
    setToInteractive() {
      this.color = color(INTERACTIVE_PARTICLE_COLOR);
      this.weight = random(INTERACTIVE_PARTICLE_MIN_WEIGHT, INTERACTIVE_PARTICLE_MAX_WEIGHT);
      this.maxSpeed = random(INTERACTIVE_PARTICLE_MIN_SPEED, INTERACTIVE_PARTICLE_MAX_SPEED);
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
    }

    applyForce(force) { this.acc.add(force); }

    show(pg) {
        const c = this.color;
        brush.set('smoothStroke');
        brush.stroke(hue(c), saturation(c), brightness(c), PARTICLE_OPACITY);
        brush.strokeWeight(this.weight);
        brush.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y, pg);
        this.updatePrev();
    }

    updatePrev() { this.prevPos.x = this.pos.x; this.prevPos.y = this.pos.y; }

    resetParticle() {
      this.pos.x = -50;
      this.pos.y = random(height);
      this.setToDefault();
      this.vel.set(0, 0);
      this.acc.set(0, 0);
      this.updatePrev();
    }

    edges() {
        if (this.pos.x > width + 50 || this.pos.y > height + 50 || this.pos.y < -50) {
            if (this.isInteractive) {
              this.isDead = true;
            } else {
              this.resetParticle();
            }
        }
    }
    
    follow(vectors) {
        const x = floor(max(0, min(this.pos.x, width - 1)) / FLOW_FIELD_RESOLUTION);
        const y = floor(max(0, min(this.pos.y, height - 1)) / FLOW_FIELD_RESOLUTION);
        const cols = floor(width / FLOW_FIELD_RESOLUTION);
        const index = x + y * cols;
        const force = vectors[index];
        if (force) { this.applyForce(force); }
    }
}

// --- MOUSE AND TOUCH INPUT ---
function mousePressed() { handlePress(); }
function mouseReleased() { handleRelease(); }
function touchStarted() { handlePress(); return false; }
function touchEnded() { handleRelease(); return false; }

function handlePress() {
  if (presenceButton.isVisible && !isHoldingButton && !presenceButton.isOnCooldown && presenceButton.isFullyDrawn) {
    let d = dist(mouseX, mouseY, presenceButton.pos.x, presenceButton.pos.y);
    if (d < presenceButton.currentSize / 2) {
      isHoldingButton = true; 
      holdStartTime = millis(); 
      textPoints = []; 
      textAnimation.isAnimating = false;
    }
  }
}

function handleRelease() {
  if (isHoldingButton) {
    isHoldingButton = false;
    let holdDuration = min(millis() - holdStartTime, MAX_HOLD_TIME);
    startTextAnimation(holdDuration);
    presenceButton.isOnCooldown = true; 
    presenceButton.cooldownStartTime = millis();
  }
}

// ---- TEXT ANIMATION FUNCTIONS ----
function startTextAnimation(holdDuration) {
  const currentMessage = random(loadedMessages);
  
  textFont(font);
  textSize(TEXT_FONT_SIZE);
  textPoints = [];
  const maxWidth = width * 0.6;
  const words = currentMessage.split(' ');
  let line = '';
  let lines = [];
  
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const testWidth = textWidth(testLine);
    if (testWidth > maxWidth && i > 0) {
      lines.push(line);
      line = words[i] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const totalTextHeight = lines.length * (TEXT_FONT_SIZE * 1.2);
  let startY = height / 2 - 30 - totalTextHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i].trim();
    const lineWidth = textWidth(lineStr);
    const x = width / 2 - lineWidth / 2;
    const y = startY + (i * TEXT_FONT_SIZE * 1.2);
    
    const pointsForLine = font.textToPoints(lineStr, x, y, TEXT_FONT_SIZE, { 
      sampleFactor: TEXT_SAMPLE_FACTOR, 
      simplifyThreshold: 0 
    });
    textPoints = textPoints.concat(pointsForLine);
  }
  
  textAnimation.duration = map(holdDuration, 0, MAX_HOLD_TIME, TEXT_ANIM_MIN_DURATION, TEXT_ANIM_MAX_DURATION);
  textAnimation.startTime = millis();
  textAnimation.isAnimating = true;
}

function updateAndDrawText() {
  if (textPoints.length === 0) return;
  textGlowBuffer.clear();
  let progress = 1.0;
  if (textAnimation.isAnimating) {
    progress = constrain((millis()-textAnimation.startTime)/textAnimation.duration, 0, 1);
    if (progress >= 1) textAnimation.isAnimating = false;
  }
  const pointsToDraw = floor(progress * textPoints.length);
  
  textGlowBuffer.noStroke();
  textGlowBuffer.fill(hue(textColor), saturation(textColor), brightness(textColor), TEXT_OPACITY);

  for (let i = 0; i < pointsToDraw; i++) {
    const p = textPoints[i];
    
    textGlowBuffer.push();
    textGlowBuffer.translate(p.x, p.y);
    
    const angle = map(noise(i * 0.05, millis() * 0.0005), 0, 1, -QUARTER_PI, QUARTER_PI);
    textGlowBuffer.rotate(angle);
    
    const noiseValue = noise(i * 0.1, millis() * TEXT_BREATHING_SPEED);
    const currentDotSize = map(noiseValue, 0, 1, TEXT_BREATHING_MIN_SIZE, TEXT_BREATHING_MAX_SIZE);
    
    textGlowBuffer.ellipse(0, 0, currentDotSize * 1.5, currentDotSize);
    textGlowBuffer.pop();
  }
  
  push();
  blendMode(DIFFERENCE);
  image(textGlowBuffer, 0, 0);
  pop(); 
}

// ---- PRESENCE BUTTON FUNCTIONS ----
function setupButton() {
  presenceButton = {
    pos: createVector(width/2, height*3/4), size: BUTTON_SIZE, isVisible: true,
    lastActiveTime: 0, currentAlpha: 0, targetAlpha: 100, 
    currentSize: BUTTON_SIZE, targetSize: BUTTON_SIZE, isOnCooldown: false, 
    cooldownStartTime: 0, drawProgress: 0, isFullyDrawn: false
  };
}

function updateButton() {
  const now = millis();
  if (presenceButton.isOnCooldown && now > presenceButton.cooldownStartTime + BUTTON_COOLDOWN_DURATION) {
    presenceButton.isOnCooldown = false;
  }

  if (isHoldingButton) {
    presenceButton.targetSize = BUTTON_SIZE * BUTTON_GROW_FACTOR;
    presenceButton.targetAlpha = 100;
  } else if (presenceButton.isOnCooldown) {
    presenceButton.targetAlpha = 0;
    presenceButton.targetSize = BUTTON_SIZE;
  } else {
    presenceButton.targetSize = BUTTON_SIZE;
    presenceButton.targetAlpha = 100;
  }
  
  presenceButton.currentAlpha = lerp(presenceButton.currentAlpha, presenceButton.targetAlpha, BUTTON_FADE_SPEED);
  presenceButton.currentSize = lerp(presenceButton.currentSize, presenceButton.targetSize, BUTTON_GROW_SPEED);
  
  if (presenceButton.targetAlpha > 0 && !presenceButton.isFullyDrawn) {
    presenceButton.drawProgress = min(1, presenceButton.drawProgress + BUTTON_DRAW_SPEED);
    if (presenceButton.drawProgress >= 1) presenceButton.isFullyDrawn = true;
  } else if (presenceButton.targetAlpha === 0) {
    presenceButton.drawProgress = 0;
    presenceButton.isFullyDrawn = false;
  }
}

function drawButton() {
  if (presenceButton.currentAlpha < 1) return;
  push();
  let overallAlpha = presenceButton.currentAlpha;
  strokeWeight(BUTTON_STROKE_WEIGHT); stroke(0, 0, 0, 80*(overallAlpha/100)); noFill();
  let endAngle = -HALF_PI + presenceButton.drawProgress * TWO_PI;
  arc(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize, presenceButton.currentSize, -HALF_PI, endAngle);
  if (presenceButton.isFullyDrawn) {
    noStroke(); fill(0, 0, 0, 5 * (overallAlpha/100));
    circle(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize);
  }
  pop();
}

// ---- OPTIMIZED GRAIN FUNCTION ----
function createGrainTexture() {
  if (GRAIN_AMOUNT <= 0) return;
  grainBuffer = createGraphics(width, height);
  let numParticles = (width * height / 100) * GRAIN_AMOUNT;
  grainBuffer.strokeWeight(1.5);
  for (let i = 0; i < numParticles; i++) {
    grainBuffer.stroke(0, 0, 0, 15);
    grainBuffer.point(random(width), random(height));
  }
}

function applyGrain() {
  if (GRAIN_AMOUNT <= 0 || !grainBuffer) return;
  push();
  blendMode(MULTIPLY); tint(255, 50);
  image(grainBuffer, 0, 0);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupGraphics(); 
  setupButton();
  textPoints = [];
  textAnimation.isAnimating = false;
}
