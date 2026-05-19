/* ============================================================
   FrameStitch — app.js
   Image-to-video editor with transitions
   ============================================================ */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const State = {
  frames:      [],   // { id, label, dur, color, libId }
  transitions: [],   // { id, type, label, color, dur, afterFrameId }
  library:     [],   // { id, label, uploaded, uploadedImg, pal, dur }
  selectedId:  null,
  playing:     false,
  currentTime: 0,
  zoom:        72,   // px per second
  totalDur:    0,
  history:     [],
  future:      [],
  uid:         1,
};

/* ============================================================
   CONSTANTS
   ============================================================ */
const FRAME_COLORS = [
  '#2563eb','#0d9488','#e05c3a','#7c3aed',
  '#d97706','#059669','#0891b2','#9333ea',
];

const SAMPLE_PALETTES = [
  { id:'pal-sky',      name:'Sunrise walk',    type:'sky',      bg:['#1e3a5f','#2d6a9f','#87ceeb','#e8f4f8'] },
  { id:'pal-forest',   name:'Mountain mist',   type:'forest',   bg:['#2d5a27','#4a8c3f','#8cc47a','#d4edda'] },
  { id:'pal-lavender', name:'Lavender field',  type:'lavender', bg:['#5c2d7a','#9b59b6','#c39bd3','#f5eef8'] },
  { id:'pal-coral',    name:'Coral sunset',    type:'coral',    bg:['#7a2d1e','#c0392b','#e8967a','#fdecea'] },
  { id:'pal-emerald',  name:'Deep forest',     type:'emerald',  bg:['#1a4a3e','#27ae60','#82e0aa','#e9f7ef'] },
  { id:'pal-golden',   name:'Golden hour',     type:'golden',   bg:['#4a3000','#d4870a','#f0c040','#fff8e1'] },
];

const TRANSITION_DEFS = [
  { type:'fade',       label:'Fade',        color:'#2563eb', dur:0.8 },
  { type:'dissolve',   label:'Dissolve',    color:'#7c3aed', dur:0.7 },
  { type:'wipe-right', label:'Wipe right',  color:'#0d9488', dur:0.6 },
  { type:'wipe-left',  label:'Wipe left',   color:'#059669', dur:0.6 },
  { type:'wipe-up',    label:'Wipe up',     color:'#0891b2', dur:0.5 },
  { type:'zoom-in',    label:'Zoom in',     color:'#d97706', dur:0.7 },
  { type:'zoom-out',   label:'Zoom out',    color:'#b45309', dur:0.7 },
  { type:'slide-left', label:'Slide left',  color:'#e05c3a', dur:0.6 },
  { type:'flash',      label:'Flash',       color:'#ca8a04', dur:0.35 },
  { type:'rotate',     label:'Rotate',      color:'#9333ea', dur:0.8 },
  { type: 'page-turn-right', label: 'Page Turn Right', color: '#be185d', dur: 0.9 },
  { type: 'page-turn-left',  label: 'Page Turn Left',  color: '#9f1239', dur: 0.9 },
];

/* ============================================================
   CANVAS PAINTING — sample / generated images
   ============================================================ */
const Paint = {
  thumb(canvas, pal) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, p = pal.bg;
    ctx.clearRect(0, 0, w, h);
    if (pal.type === 'sky') {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,p[0]); g.addColorStop(0.5,p[1]); g.addColorStop(1,p[2]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = p[3]; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.ellipse(w/2,h*1.1,w*0.7,h*0.5,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (pal.type === 'forest' || pal.type === 'emerald') {
      ctx.fillStyle = p[1]; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = p[0]; ctx.fillRect(0,h*0.55,w,h);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i%2 ? p[1] : p[0];
        const tx = w*(0.08+i*0.19);
        ctx.beginPath(); ctx.moveTo(tx,h*0.55); ctx.lineTo(tx-14,h*0.88); ctx.lineTo(tx+14,h*0.88); ctx.closePath(); ctx.fill();
      }
    } else if (pal.type === 'golden' || pal.type === 'coral') {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,p[0]); g.addColorStop(0.5,p[1]); g.addColorStop(1,p[2]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = p[3]; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(w*0.5,h*0.4,h*0.35,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createRadialGradient(w*0.4,h*0.4,0,w*0.5,h*0.5,w*0.7);
      g.addColorStop(0,p[2]); g.addColorStop(0.6,p[1]); g.addColorStop(1,p[0]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = p[3]; ctx.globalAlpha = 0.15+i*0.05;
        ctx.beginPath(); ctx.arc(w*(0.25+i*0.25),h*(0.3+i*0.15),18+i*10,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },

  preview(canvas, item, t) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // Uploaded video — draw the current video frame
    if (item.isVideo && item.videoEl) {
      ctx.drawImage(item.videoEl, 0, 0, w, h);
      return;
    }

    // Uploaded image — draw it directly
    if (item.uploadedImg && !item.isVideo) {
      ctx.drawImage(item.uploadedImg, 0, 0, w, h);
      return;
    }
    const pal = item.pal, p = pal.bg;
    const wave = Math.sin(t * 0.8) * 5;

    if (pal.type === 'sky') {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,p[0]); g.addColorStop(0.5,p[1]); g.addColorStop(1,p[2]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = p[3]; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(w/2, h*(1.08+Math.sin(t*0.3)*0.02), w*0.75, h*0.55, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(w*(0.15+i*0.28)+wave*0.3, h*(0.18+i%2*0.08), 22+i*7, 8+i*3, 0, 0, Math.PI*2); ctx.fill();
      }
    } else if (pal.type === 'forest' || pal.type === 'emerald') {
      ctx.fillStyle = p[1]; ctx.fillRect(0,0,w,h);
      const gy = ctx.createLinearGradient(0,h*0.4,0,h);
      gy.addColorStop(0,p[0]); gy.addColorStop(1,'#0a2a0a');
      ctx.fillStyle = gy; ctx.fillRect(0,h*0.4,w,h);
      for (let i = 0; i < 7; i++) {
        const tx = w*(0.05+i*0.14), ty = h*(0.44+Math.sin(t*0.6+i)*0.008);
        ctx.fillStyle = i%2 ? p[0] : p[1];
        ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx-16,h*0.9); ctx.lineTo(tx+16,h*0.9); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx,ty-22); ctx.lineTo(tx-12,ty+4); ctx.lineTo(tx+12,ty+4); ctx.closePath(); ctx.fill();
      }
    } else if (pal.type === 'golden' || pal.type === 'coral') {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,p[0]); g.addColorStop(0.4,p[1]); g.addColorStop(0.7,p[2]); g.addColorStop(1,p[3]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = 'rgba(255,200,80,0.12)';
      ctx.beginPath(); ctx.arc(w*0.5+wave, h*0.42, h*0.32, 0, Math.PI*2); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(w*(0.4+Math.sin(t*0.4)*0.04), h*(0.4+Math.cos(t*0.3)*0.04), 0, w*0.5, h*0.5, w*0.7);
      g.addColorStop(0,p[2]); g.addColorStop(0.6,p[1]); g.addColorStop(1,p[0]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = p[3]; ctx.globalAlpha = 0.07+Math.sin(t*0.5+i)*0.02;
        ctx.beginPath(); ctx.arc(w*(0.28+i*0.22), h*(0.28+i*0.16), 28+i*14+Math.sin(t+i)*4, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
};

/* ============================================================
   TRANSITIONS (canvas compositing)
   ============================================================ */
const Transitions = {
  apply(ctx, canA, canB, progress, type, W, H) {
    const p = Math.max(0, Math.min(1, progress));
    switch (type) {
      case 'fade':
      case 'dissolve':
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(canB, 0, 0);
        ctx.globalAlpha = 1;
        break;

      case 'wipe-right':
        ctx.drawImage(canA, 0, 0);
        ctx.drawImage(canB, 0, 0, W*p, H, 0, 0, W*p, H);
        break;

      case 'wipe-left': {
        const ox = W*(1-p);
        ctx.drawImage(canA, 0, 0);
        ctx.drawImage(canB, ox, 0, W*p, H, ox, 0, W*p, H);
        break;
      }

      case 'wipe-up':
        ctx.drawImage(canA, 0, 0);
        ctx.drawImage(canB, 0, 0, W, H*p, 0, 0, W, H*p);
        break;

      case 'zoom-in': {
        const s = 1 + p * 0.25;
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = p;
        ctx.save();
        ctx.translate(W/2, H/2); ctx.scale(s, s); ctx.translate(-W/2, -H/2);
        ctx.drawImage(canB, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }

      case 'zoom-out': {
        const s = 1.25 - p * 0.25;
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = p;
        ctx.save();
        ctx.translate(W/2, H/2); ctx.scale(s, s); ctx.translate(-W/2, -H/2);
        ctx.drawImage(canB, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }

      case 'slide-left':
        ctx.drawImage(canA, -W*p, 0);
        ctx.drawImage(canB, W*(1-p), 0);
        break;

      case 'flash': {
        const fl = p < 0.5 ? p*2 : (1-p)*2;
        ctx.drawImage(p < 0.5 ? canA : canB, 0, 0);
        ctx.fillStyle = `rgba(255,255,255,${fl})`;
        ctx.fillRect(0, 0, W, H);
        break;
      }

      case 'rotate':
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = p;
        ctx.save();
        ctx.translate(W/2, H/2);
        ctx.rotate((p - 0.5) * 0.4);
        ctx.translate(-W/2, -H/2);
        ctx.drawImage(canB, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;

      case 'page-turn-right': {
        ctx.drawImage(canB, 0, 0);
        const foldX = W * (1 - p);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, foldX, H);
        ctx.clip();
        ctx.drawImage(canA, 0, 0);
        ctx.restore();
        const shadowGrad = ctx.createLinearGradient(foldX, 0, foldX + 40, 0);
        shadowGrad.addColorStop(0,   'rgba(0,0,0,0.35)');
        shadowGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(foldX, 0, 40, H);
        const curlWidth = Math.min(60, foldX + 30);
        ctx.save();
        ctx.transform(1, 0, 0.3 * p, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(foldX, 0, curlWidth, H);
        ctx.clip();
        ctx.globalAlpha = 0.55 - p * 0.3;
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = 1;
        const curlHighlight = ctx.createLinearGradient(foldX, 0, foldX + curlWidth, 0);
        curlHighlight.addColorStop(0,   'rgba(255,255,255,0.25)');
        curlHighlight.addColorStop(0.4, 'rgba(255,255,255,0.05)');
        curlHighlight.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = curlHighlight;
        ctx.fillRect(foldX, 0, curlWidth, H);
        ctx.restore();
        break;
      }

      case 'page-turn-left': {
        ctx.drawImage(canB, 0, 0);
        const foldX = W * p;
        ctx.save();
        ctx.beginPath();
        ctx.rect(foldX, 0, W - foldX, H);
        ctx.clip();
        ctx.drawImage(canA, 0, 0);
        ctx.restore();
        const shadowGrad = ctx.createLinearGradient(foldX, 0, foldX - 40, 0);
        shadowGrad.addColorStop(0,   'rgba(0,0,0,0.35)');
        shadowGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(foldX - 40, 0, 40, H);
        const curlWidth = Math.min(60, W - foldX + 30);
        ctx.save();
        ctx.transform(1, 0, -0.3 * p, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(foldX - curlWidth, 0, curlWidth, H);
        ctx.clip();
        ctx.globalAlpha = 0.55 - p * 0.3;
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = 1;
        const curlHighlight = ctx.createLinearGradient(foldX, 0, foldX - curlWidth, 0);
        curlHighlight.addColorStop(0,   'rgba(255,255,255,0.25)');
        curlHighlight.addColorStop(0.4, 'rgba(255,255,255,0.05)');
        curlHighlight.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = curlHighlight;
        ctx.fillRect(foldX - curlWidth, 0, curlWidth, H);
        ctx.restore();
        break;
      }

      default:
        ctx.drawImage(canA, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(canB, 0, 0);
        ctx.globalAlpha = 1;
    }
  },
};

/* ============================================================
   PREVIEW RENDERER
   ============================================================ */
const Renderer = {
  canvas: null,
  ctx:    null,
  offA:   null,
  offB:   null,
  W: 560,
  H: 315,

  init() {
    this.canvas = document.getElementById('preview-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.offA   = document.createElement('canvas');
    this.offB   = document.createElement('canvas');
    this.offA.width = this.offB.width = this.W;
    this.offA.height = this.offB.height = this.H;
  },

  draw() {
    const { ctx, offA, offB, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    if (State.frames.length === 0) {
      ctx.fillStyle = '#f0ede8';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a09890';
      ctx.font = '500 14px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Upload images or drag samples to the timeline', W/2, H/2 - 10);
      ctx.font = '400 12px "DM Sans", sans-serif';
      ctx.fillStyle = '#c8c2b8';
      ctx.fillText('Click "Upload images" or drop files on the left panel', W/2, H/2 + 12);
      return;
    }

    let offset = 0;
    let curFrame = null, nxtFrame = null, curTrans = null, localTime = 0;
    for (let i = 0; i < State.frames.length; i++) {
      const f   = State.frames[i];
      const tr  = State.transitions.find(t => t.afterFrameId === f.id);
      const end = offset + f.dur;
      const transStart = tr ? end - tr.dur / 2 : Infinity;
      const transEnd   = tr ? end + tr.dur / 2 : Infinity;
      if (tr && State.currentTime >= transStart && State.currentTime < transEnd) {
        curFrame  = f;
        nxtFrame  = State.frames[i + 1] || null;
        curTrans  = tr;
        localTime = State.currentTime - transStart;
        break;
      }
      if (State.currentTime >= offset && State.currentTime < end) {
        curFrame  = f;
        localTime = State.currentTime - offset;
        break;
      }
      offset += f.dur;
    }

    if (!curFrame) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }

    const libA = State.library.find(l => l.id === curFrame.libId);
    const libB = nxtFrame ? State.library.find(l => l.id === nxtFrame.libId) : null;

    if (curTrans && libB) {
      const prog = Math.max(0, Math.min(1, localTime / curTrans.dur));
      Paint.preview(offA, libA, State.currentTime);
      Paint.preview(offB, libB, State.currentTime);
      Transitions.apply(ctx, offA, offB, prog, curTrans.type, W, H);
    } else if (libA) {
      Paint.preview(this.canvas, libA, State.currentTime);
    }

    // Timecode overlay
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8, 8, 72, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '500 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatTime(State.currentTime), 13, 16.5);
  },
};

/* ============================================================
   PLAYER
   ============================================================ */
const Player = {
  raf:     null,
  lastTs:  null,

  toggle() {
    if (State.frames.length === 0) { UI.toast('Add frames to the timeline first'); return; }
    State.playing = !State.playing;
    if (State.playing) {
      if (State.currentTime >= State.totalDur) State.currentTime = 0;
      document.getElementById('play-icon').innerHTML = '<rect x="3" y="2" width="3" height="10" rx="1"/><rect x="8" y="2" width="3" height="10" rx="1"/>';
      this.lastTs = null;
      this.raf = requestAnimationFrame(ts => this._tick(ts));
    } else {
      document.getElementById('play-icon').innerHTML = '<polygon points="4,2 12,7 4,12"/>';
      if (this.raf) cancelAnimationFrame(this.raf);
    }
  },

  _tick(ts) {
    if (!this.lastTs) this.lastTs = ts;
    const dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    State.currentTime = Math.min(State.totalDur, State.currentTime + dt);
    UI.updateTransport();
    Timeline.updatePlayhead();
    // Sync any video frames in the current library to the playback position
    let vOffset = 0;
    for (const f of State.frames) {
      const lib = State.library.find(l => l.id === f.libId);
      if (lib && lib.isVideo && lib.videoEl) {
        const localT = State.currentTime - vOffset;
        if (localT >= 0 && localT <= f.dur) {
          lib.videoEl.currentTime = Math.min(localT, lib.videoEl.duration);
        }
      }
      vOffset += f.dur;
    }
    Renderer.draw();
    Timeline.scrollToPlayhead();
    if (State.currentTime >= State.totalDur) {
      State.playing = false;
      document.getElementById('play-icon').innerHTML = '<polygon points="4,2 12,7 4,12"/>';
      return;
    }
    this.raf = requestAnimationFrame(ts => this._tick(ts));
  },

  seekTo(t) {
    State.currentTime = Math.max(0, Math.min(State.totalDur, t));
    UI.updateTransport();
    Timeline.updatePlayhead();
    Renderer.draw();
  },

  scrubClick(e) {
    const bar  = document.getElementById('scrub-bar');
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.seekTo(pct * State.totalDur);
  },
};

/* ============================================================
   UPLOAD
   ============================================================ */
const Upload = {
  dzOver(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.add('drag-over');
  },
  dzLeave() {
    document.getElementById('drop-zone').classList.remove('drag-over');
  },
  dzDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length) this.handleFiles(files);
  },
  onFileInput(e) {
    this.handleFiles(Array.from(e.target.files));
    e.target.value = '';
  },
  handleFiles(files) {
    const valid = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!valid.length) { UI.toast('Please upload image or video files'); return; }
    UI.toast(`Loading ${valid.length} file${valid.length > 1 ? 's' : ''}…`);
    valid.forEach(f => {
      if (f.type.startsWith('image/')) this._loadFile(f);
      else this._loadVideo(f);
    });
  },
  _loadFile(file) {
    const id    = `up${State.uid++}`;
    const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const entry = { id, label, uploaded: true, uploadedImg: null, pal: SAMPLE_PALETTES[0], dur: 5, loading: true };
    State.library.unshift(entry);
    LibraryUI.render();
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        entry.uploadedImg = img;
        entry.loading     = false;
        LibraryUI.render();
        UI.toast(`"${label}" added to library`);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },
  _loadVideo(file) {
    const id    = `up${State.uid++}`;
    const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const entry = {
      id, label, uploaded: true, isVideo: true,
      uploadedImg: null, videoEl: null,
      pal: SAMPLE_PALETTES[0], dur: null, loading: true
    };
    State.library.unshift(entry);
    LibraryUI.render();

    const video   = document.createElement('video');
    video.preload = 'metadata';
    video.muted   = true;
    video.src     = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      entry.dur     = parseFloat(video.duration.toFixed(1));
      entry.videoEl = video;
      entry.loading = false;
      video.currentTime = Math.min(0.5, video.duration * 0.1);
    };

    video.onseeked = () => {
      if (entry.uploadedImg) return;
      const c = document.createElement('canvas');
      c.width = 160; c.height = 90;
      c.getContext('2d').drawImage(video, 0, 0, 160, 90);
      const img = new Image();
      img.src   = c.toDataURL();
      img.onload = () => {
        entry.uploadedImg = img;
        LibraryUI.render();
        UI.toast(`"${label}" added to library`);
      };
    };
  },
};

/* ============================================================
   LIBRARY UI
   ============================================================ */
const LibraryUI = {
  render() {
    const grid     = document.getElementById('img-grid');
    const lbl      = document.getElementById('lib-label');
    const uploaded = State.library.filter(m => m.uploaded);
    const samples  = State.library.filter(m => !m.uploaded);

    lbl.textContent = uploaded.length
      ? `${uploaded.length} uploaded · ${samples.length} samples`
      : 'Sample images';

    grid.innerHTML = '';
    [...uploaded, ...samples].forEach(m => {
      const card = document.createElement('div');
      card.className = 'img-card';
      card.draggable = true;
      card.title = `${m.label} — double-click or drag to add`;

      if (m.uploaded && m.uploadedImg) {
        const img = document.createElement('img');
        img.src = m.uploadedImg.src;
        img.alt = m.label;
        card.appendChild(img);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 110; canvas.height = 82;
        card.appendChild(canvas);
        setTimeout(() => Paint.thumb(canvas, m.pal), 0);
      }

      const labelEl = document.createElement('div');
      labelEl.className = 'img-label';
      labelEl.textContent = m.label;
      card.appendChild(labelEl);

      const badge = document.createElement('div');
      badge.className = `img-badge ${m.uploaded ? 'uploaded' : 'sample'}`;
      badge.textContent = m.uploaded ? 'Uploaded' : 'Sample';
      card.appendChild(badge);

      // Delete button (only for uploaded images)
      if (m.uploaded) {
        const del = document.createElement('button');
        del.className = 'img-del';
        del.title = 'Remove from library';
        del.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>';
        del.onclick = e => { e.stopPropagation(); App.removeFromLibrary(m.id); };
        card.appendChild(del);
      }

      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('libId', m.id);
        e.dataTransfer.setData('src', 'lib');
      });
      card.addEventListener('dblclick', () => App.addFrameFromLib(m.id));
      grid.appendChild(card);
    });
  },

  renderTransitions() {
    const list = document.getElementById('trans-list');
    list.innerHTML = '';
    TRANSITION_DEFS.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'trans-card';
      card.draggable = true;
      card.innerHTML = `
        <div class="trans-icon" style="background:${t.color}18;border:1px solid ${t.color}30">
          <svg width="20" height="14" viewBox="0 0 20 14">
            <rect x="0" y="1" width="8" height="12" rx="2" fill="${t.color}" opacity=".45"/>
            <rect x="12" y="1" width="8" height="12" rx="2" fill="${t.color}" opacity=".88"/>
            <line x1="8" y1="7" x2="12" y2="7" stroke="${t.color}" stroke-width="1.5"/>
          </svg>
        </div>
        <span class="trans-name">${t.label}</span>
        <span class="trans-dur">${t.dur}s</span>`;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('tidx', i);
        e.dataTransfer.setData('src', 'trans');
      });
      card.addEventListener('dblclick', () => App.addTransitionAfterSelected(i));
      list.appendChild(card);
    });
  },
};

/* ============================================================
   TIMELINE
   ============================================================ */
const Timeline = {
  pps() { return State.zoom; },

  render() {
    const totalPx = Math.max(500, State.totalDur * this.pps() + 200);
    document.getElementById('tl-inner').style.width = totalPx + 'px';
    this.renderRuler(totalPx);
    this.renderFrameTrack(totalPx);
    this.renderFxTrack(totalPx);
    this.updatePlayhead();
  },

  renderRuler(totalPx) {
    const ruler = document.getElementById('ruler');
    ruler.innerHTML = '';
    ruler.style.width = totalPx + 'px';
    const step = this.pps() >= 80 ? 1 : this.pps() >= 40 ? 2 : 5;
    const maxT = Math.ceil(totalPx / this.pps()) + 1;
    for (let t = 0; t <= maxT; t += step) {
      const mark = document.createElement('div');
      mark.className = 'ruler-mark';
      mark.style.left = (t * this.pps()) + 'px';
      mark.innerHTML = `<div class="ruler-tick"></div><div class="ruler-label">${formatTime(t)}</div>`;
      ruler.appendChild(mark);
    }
  },

  renderFrameTrack(totalPx) {
    const track = document.getElementById('frame-track');
    track.innerHTML = '';
    track.style.width = totalPx + 'px';
    let offset = 0;

    State.frames.forEach(f => {
      const lib = State.library.find(l => l.id === f.libId);
      const block = document.createElement('div');
      block.className = 'frame-block' + (f.id === State.selectedId ? ' selected' : '');
      block.style.left  = (offset * this.pps()) + 'px';
      block.style.width = (f.dur * this.pps()) + 'px';
      block.style.background  = f.color + '20';
      block.style.borderColor = f.id === State.selectedId ? 'var(--blue)' : f.color + '55';

      if (lib && lib.uploadedImg) {
        const img = document.createElement('img');
        img.src = lib.uploadedImg.src;
        img.alt = f.label;
        block.appendChild(img);
      } else if (lib) {
        const c = document.createElement('canvas');
        c.width = 80; c.height = 34;
        block.appendChild(c);
        setTimeout(() => Paint.thumb(c, lib.pal), 0);
      }

      const lbl = document.createElement('div');
      lbl.className = 'frame-label';
      lbl.textContent = f.label;
      block.appendChild(lbl);

      block.addEventListener('click', () => App.select(f.id));
      block.draggable = true;
      block.addEventListener('dragstart', e => {
        e.dataTransfer.setData('fid', f.id);
        e.dataTransfer.setData('src', 'reorder');
      });
      track.appendChild(block);
      offset += f.dur;
    });

    track.addEventListener('dragover', e => { e.preventDefault(); track.classList.add('drop-active'); });
    track.addEventListener('dragleave', () => track.classList.remove('drop-active'));
    track.addEventListener('drop', e => {
      e.preventDefault();
      track.classList.remove('drop-active');
      const src = e.dataTransfer.getData('src');

      if (src === 'lib') {
        App.addFrameFromLib(e.dataTransfer.getData('libId'));
      }

      if (src === 'move-trans') {
        const rect   = track.getBoundingClientRect();
        const dropX  = e.clientX - rect.left + document.getElementById('tl-scroll').scrollLeft;
        let offset   = 0;
        let targetId = null;
        for (let i = 0; i < State.frames.length - 1; i++) {
          offset += State.frames[i].dur;
          if (dropX < offset * Timeline.pps()) {
            targetId = State.frames[i].id;
            break;
          }
        }
        if (!targetId) targetId = State.frames[State.frames.length - 2].id;
        App.moveTransition(e.dataTransfer.getData('transId'), targetId);
      }
    });
  },

  renderFxTrack(totalPx) {
    const track = document.getElementById('fx-track');
    track.innerHTML = '';
    track.style.width = totalPx + 'px';
    let offset = 0;

    State.frames.forEach((f, i) => {
      offset += f.dur;
      const tr = State.transitions.find(t => t.afterFrameId === f.id);
      if (tr && i < State.frames.length - 1) {
        const tw    = tr.dur * this.pps();
        const block = document.createElement('div');
        block.className = 'fx-block' + (tr.id === State.selectedId ? ' selected' : '');
        block.style.left        = (offset * this.pps() - tw/2) + 'px';
        block.style.width       = tw + 'px';
        block.style.background  = tr.color + '18';
        block.style.borderColor = tr.id === State.selectedId ? 'var(--blue)' : tr.color + '44';
        block.style.color       = tr.color;
        block.textContent       = tr.label;
        block.title             = `${tr.label} · ${tr.dur}s`;
        block.addEventListener('click', () => App.select(tr.id));
        block.draggable = true;
        block.addEventListener('dragstart', e => {
          e.dataTransfer.setData('transId', tr.id);
          e.dataTransfer.setData('src', 'move-trans');
        });
        track.appendChild(block);
      }
    });

    track.addEventListener('dragover', e => { e.preventDefault(); track.classList.add('drop-active'); });
    track.addEventListener('dragleave', () => track.classList.remove('drop-active'));
    track.addEventListener('drop', e => {
      e.preventDefault();
      track.classList.remove('drop-active');
      if (e.dataTransfer.getData('src') === 'trans') {
        App.addTransitionAfterSelected(+e.dataTransfer.getData('tidx'));
      }
    });
  },

  updatePlayhead() {
    document.getElementById('playhead').style.left = (State.currentTime * this.pps()) + 'px';
  },

  scrollToPlayhead() {
    const sc  = document.getElementById('tl-scroll');
    const px  = State.currentTime * this.pps();
    if (px < sc.scrollLeft || px > sc.scrollLeft + sc.clientWidth - 80) {
      sc.scrollLeft = px - sc.clientWidth / 3;
    }
  },

  zoomIn()  { State.zoom = Math.min(200, State.zoom * 1.4); this._updateZoomLabel(); this.render(); },
  zoomOut() { State.zoom = Math.max(18,  State.zoom / 1.4); this._updateZoomLabel(); this.render(); },
  fitView() {
    const w = document.getElementById('tl-scroll').clientWidth;
    if (State.totalDur > 0) State.zoom = Math.max(18, Math.min(200, (w - 50) / State.totalDur));
    this._updateZoomLabel();
    this.render();
  },
  _updateZoomLabel() {
    document.getElementById('zoom-info').textContent = (State.zoom / 72).toFixed(1) + '×';
  },
};

/* ============================================================
   INSPECTOR UI
   — All user-controlled values written via .textContent,
     .value, or .style to prevent XSS. No innerHTML for
     any data derived from frame labels, filenames, or IDs.
   ============================================================ */
const Inspector = {

  // ── small DOM helpers ────────────────────────────────────────

  _el(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  },

  _sectionLabel(text) {
    const el = this._el('div', 'prop-section-label');
    el.textContent = text;
    return el;
  },

  _propRow(keyText, valueEl) {
    const row = this._el('div', 'prop-row');
    const key = this._el('span', 'prop-key');
    key.textContent = keyText;
    row.appendChild(key);
    row.appendChild(valueEl);
    return row;
  },

  _textInput(value, onChange) {
    const input = this._el('input', 'prop-input');
    input.value = value;
    input.addEventListener('change', () => onChange(input.value));
    return input;
  },

  _numberInput(value, step, min, max, onChange) {
    const input = this._el('input', 'prop-input');
    input.type  = 'number';
    input.step  = step;
    input.min   = min;
    if (max !== undefined) input.max = max;
    input.value = value;
    input.addEventListener('change', () => onChange(+input.value));
    return input;
  },

  // ── main render ─────────────────────────────────────────────

  render() {
    const body  = document.getElementById('insp-body');
    const frame = State.frames.find(f => f.id === State.selectedId);
    const trans = State.transitions.find(t => t.id === State.selectedId);

    body.innerHTML = '';

    if (!frame && !trans) {
      const msg = this._el('div', 'no-sel');
      const strong = document.createElement('strong');
      strong.textContent = 'Nothing selected';
      msg.appendChild(strong);
      msg.appendChild(document.createTextNode('Click a frame or transition on the timeline to edit its properties.'));
      body.appendChild(msg);
      return;
    }

    if (frame) {
      this._renderFrame(body, frame);
    } else if (trans) {
      this._renderTransition(body, trans);
    }
  },

  _renderFrame(body, frame) {
    const lib = State.library.find(l => l.id === frame.libId);

    // Thumbnail
    if (lib && lib.uploadedImg) {
      const wrap = this._el('div', 'insp-thumb');
      const img  = document.createElement('img');
      img.src    = lib.uploadedImg.src;           // blob/data URL — safe
      img.alt    = frame.label;                   // textContent equivalent on alt
      wrap.appendChild(img);
      body.appendChild(wrap);
    } else if (lib) {
      const wrap   = this._el('div', 'insp-thumb');
      const canvas = document.createElement('canvas');
      canvas.id     = 'insp-thumb-canvas';
      canvas.width  = 180;
      canvas.height = 101;
      wrap.appendChild(canvas);
      body.appendChild(wrap);
      setTimeout(() => {
        const c = document.getElementById('insp-thumb-canvas');
        if (c) Paint.thumb(c, lib.pal);
      }, 0);
    }

    // Section
    const section = this._el('div', 'prop-section');
    section.appendChild(this._sectionLabel('Frame'));

    // Label row
    section.appendChild(this._propRow('Label',
      this._textInput(frame.label, val => App.updateFrame(frame.id, 'label', val))
    ));

    // Duration row
    section.appendChild(this._propRow('Duration',
      this._numberInput(frame.dur.toFixed(1), '0.1', '0.1', undefined,
        val => App.updateFrame(frame.id, 'dur', val))
    ));

    // Color row
    const swatch = this._el('div', 'color-swatch');
    swatch.style.background = frame.color;
    swatch.addEventListener('click', () => App.cycleColor(frame.id));
    section.appendChild(this._propRow('Color', swatch));

    body.appendChild(section);

    // Tag
    const tag = this._el('div', `insp-tag ${lib && lib.uploaded ? 'uploaded' : 'sample'}`);
    tag.textContent = lib && lib.uploaded ? 'Uploaded image' : 'Sample image';
    body.appendChild(tag);
  },

  _renderTransition(body, trans) {
    // Icon preview — uses only trusted constant colors from TRANSITION_DEFS
    const iconWrap = this._el('div');
    Object.assign(iconWrap.style, {
      width: '100%', height: '56px', borderRadius: '10px',
      background: trans.color + '10', border: `1px solid ${trans.color}20`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '12px',
    });
    // SVG is built from constant color values — not user input — so innerHTML is safe here
    iconWrap.innerHTML = `
      <svg width="44" height="26" viewBox="0 0 44 26">
        <rect x="0" y="1" width="18" height="24" rx="3" fill="${trans.color}" opacity=".4"/>
        <rect x="26" y="1" width="18" height="24" rx="3" fill="${trans.color}" opacity=".9"/>
        <line x1="18" y1="13" x2="26" y2="13" stroke="${trans.color}" stroke-width="2"/>
      </svg>`;
    body.appendChild(iconWrap);

    // Section
    const section = this._el('div', 'prop-section');
    section.appendChild(this._sectionLabel('Transition'));

    // Type select
    const select = this._el('select', 'prop-select');
    TRANSITION_DEFS.forEach(t => {
      const opt   = document.createElement('option');
      opt.value   = t.type;                       // constant — safe
      opt.textContent = t.label;                  // constant — safe
      opt.selected = (t.type === trans.type);
      select.appendChild(opt);
    });
    select.addEventListener('change', () => App.updateTransition(trans.id, 'type', select.value));
    section.appendChild(this._propRow('Type', select));

    // Duration
    section.appendChild(this._propRow('Duration',
      this._numberInput(trans.dur.toFixed(2), '0.05', '0.1', '3',
        val => App.updateTransition(trans.id, 'dur', val))
    ));

    body.appendChild(section);
  },
};

/* ============================================================
   UI HELPERS
   ============================================================ */
const UI = {
  switchTab(name, el) {
    document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('tab-images').style.display      = name === 'images'      ? '' : 'none';
    document.getElementById('tab-transitions').style.display = name === 'transitions' ? '' : 'none';
  },

  updateTransport() {
    const cur = formatTime(State.currentTime);
    const tot = formatTime(State.totalDur);
    document.getElementById('time-code').textContent = `${cur} / ${tot}`;
    const pct = State.totalDur > 0 ? (State.currentTime / State.totalDur * 100) : 0;
    document.getElementById('scrub-fill').style.width = pct.toFixed(1) + '%';
    document.getElementById('scrub-thumb').style.left = pct.toFixed(1) + '%';
  },

  _toastTimer: null,
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2400);
  },
};

/* ============================================================
   MAIN APP — public API
   ============================================================ */
const App = {
  init() {
    Renderer.init();
    this._initLibrary();
    LibraryUI.renderTransitions();
    Timeline.render();
    Renderer.draw();
    this._bindKeys();
    this._bindTimelineClick();

    // Boot with sample frames
    setTimeout(() => {
      this.addFrameFromLib('pal-sky');
      this.addFrameFromLib('pal-forest');
      this.addFrameFromLib('pal-lavender');
      // Add two starter transitions
      const t1 = TRANSITION_DEFS[0];
      State.transitions.push({ id:`t${State.uid++}`, ...t1, afterFrameId: State.frames[0].id });
      const t2 = TRANSITION_DEFS[2];
      State.transitions.push({ id:`t${State.uid++}`, ...t2, afterFrameId: State.frames[1].id });
      this._recalc();
      Timeline.render();
      Renderer.draw();
    }, 80);
  },

  _initLibrary() {
    SAMPLE_PALETTES.forEach(pal => {
      State.library.push({ id: pal.id, label: pal.name, uploaded: false, uploadedImg: null, pal, dur: 5 });
    });
    LibraryUI.render();
  },

  triggerUpload() {
    document.getElementById('file-input').click();
  },

  addFrameFromLib(libId) {
    const lib = State.library.find(l => l.id === libId);
    if (!lib) return;
    if (lib.loading) { UI.toast('Image still loading, please wait…'); return; }
    this._saveHistory();
    State.frames.push({
      id:    `f${State.uid++}`,
      label: lib.label,
      dur:   parseFloat(lib.dur.toFixed(1)),
      color: FRAME_COLORS[State.frames.length % FRAME_COLORS.length],
      libId: lib.id,
    });
    this._recalc();
    Timeline.render();
    Renderer.draw();
    UI.toast(`Added "${lib.label}"`);
  },

  addTransitionAfterSelected(tIdx) {
    if (State.frames.length < 2) { UI.toast('Need at least 2 frames to add a transition'); return; }
    const afterId = (State.selectedId && State.frames.find(f => f.id === State.selectedId))
      ? State.selectedId
      : State.frames[State.frames.length - 2].id;
    const def = TRANSITION_DEFS[tIdx];
    this._saveHistory();
    const existing = State.transitions.findIndex(t => t.afterFrameId === afterId);
    if (existing >= 0) State.transitions.splice(existing, 1);
    State.transitions.push({ id:`t${State.uid++}`, ...def, afterFrameId: afterId });
    Timeline.render();
    UI.toast(`Applied ${def.label} transition`);
  },

  select(id) {
    State.selectedId = id;
    Timeline.render();
    Inspector.render();
  },

  deleteSelected() {
    if (!State.selectedId) return;
    this._saveHistory();
    State.frames      = State.frames.filter(f => f.id !== State.selectedId);
    State.transitions = State.transitions.filter(t => t.id !== State.selectedId && t.afterFrameId !== State.selectedId);
    State.selectedId  = null;
    this._recalc();
    Timeline.render();
    Inspector.render();
    Renderer.draw();
  },

  moveTransition(transId, newAfterFrameId) {
    const tr = State.transitions.find(t => t.id === transId);
    if (!tr) return;
    const conflict = State.transitions.find(t => t.afterFrameId === newAfterFrameId && t.id !== transId);
    if (conflict) { UI.toast('A transition already exists there — delete it first'); return; }
    this._saveHistory();
    tr.afterFrameId = newAfterFrameId;
    Timeline.render();
    UI.toast('Transition moved');
  },

  splitFrame() {
    let offset = 0;
    for (let i = 0; i < State.frames.length; i++) {
      const f = State.frames[i];
      if (State.currentTime > offset + 0.1 && State.currentTime < offset + f.dur - 0.1) {
        const local = State.currentTime - offset;
        this._saveHistory();
        const newF = { ...f, id:`f${State.uid++}`, label: f.label + ' B', dur: parseFloat((f.dur - local).toFixed(1)) };
        f.dur = parseFloat(local.toFixed(1));
        State.frames.splice(i + 1, 0, newF);
        this._recalc();
        Timeline.render();
        UI.toast('Frame split at playhead');
        return;
      }
      offset += f.dur;
    }
    UI.toast('Place the playhead inside a frame to split it');
  },

  updateFrame(id, key, val) {
    const f = State.frames.find(f => f.id === id);
    if (!f) return;
    this._saveHistory();
    if (key === 'dur') f.dur = Math.max(0.1, +val);
    else f[key] = val;
    this._recalc();
    Timeline.render();
  },

  cycleColor(id) {
    const f = State.frames.find(f => f.id === id);
    if (!f) return;
    this._saveHistory();
    f.color = FRAME_COLORS[(FRAME_COLORS.indexOf(f.color) + 1) % FRAME_COLORS.length];
    Timeline.render();
    Inspector.render();
  },

  updateTransition(id, key, val) {
    const t = State.transitions.find(t => t.id === id);
    if (!t) return;
    this._saveHistory();
    if (key === 'type') {
      const def = TRANSITION_DEFS.find(d => d.type === val);
      Object.assign(t, { type: def.type, label: def.label, color: def.color });
    } else if (key === 'dur') {
      t.dur = Math.max(0.1, Math.min(3, +val));
    }
    Timeline.render();
    Inspector.render();
  },

  removeFromLibrary(id) {
    State.library = State.library.filter(l => l.id !== id);
    LibraryUI.render();
    UI.toast('Removed from library');
  },

  openExport() {
    if (State.frames.length === 0) { UI.toast('Add frames before exporting'); return; }
    document.getElementById('exp-frames').textContent = State.frames.length;
    document.getElementById('exp-dur').textContent    = State.totalDur.toFixed(1) + 's';
    document.getElementById('modal-progress-fill').style.width = '0%';
    document.getElementById('modal-status').textContent = 'Ready to export';
    document.getElementById('modal-overlay').classList.remove('modal-hidden');
  },

  closeExport() {
    document.getElementById('modal-overlay').classList.add('modal-hidden');
  },

  startExport() {
    if (State.frames.length === 0) return;

    const canvas   = document.getElementById('preview-canvas');
    const stream   = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks   = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'FrameStitch_export.webm';
      a.click();
      URL.revokeObjectURL(url);
      document.getElementById('modal-status').textContent = 'Done — file downloaded!';
    };

    State.currentTime = 0;
    recorder.start();
    document.getElementById('modal-status').textContent = 'Recording…';

    const fps      = 30;
    const interval = 1000 / fps;

    const renderLoop = setInterval(() => {
      State.currentTime += 1 / fps;
      const progress = (State.currentTime / State.totalDur) * 100;
      document.getElementById('modal-progress-fill').style.width = progress.toFixed(0) + '%';
      Renderer.draw();

      if (State.currentTime >= State.totalDur) {
        clearInterval(renderLoop);
        recorder.stop();
      }
    }, interval);
  },

  undo() {
    if (!State.history.length) { UI.toast('Nothing to undo'); return; }
    State.future.push(JSON.stringify({ frames: State.frames, transitions: State.transitions }));
    const snap = JSON.parse(State.history.pop());
    State.frames = snap.frames; State.transitions = snap.transitions;
    this._recalc(); Timeline.render(); Inspector.render(); Renderer.draw();
  },

  redo() {
    if (!State.future.length) { UI.toast('Nothing to redo'); return; }
    State.history.push(JSON.stringify({ frames: State.frames, transitions: State.transitions }));
    const snap = JSON.parse(State.future.pop());
    State.frames = snap.frames; State.transitions = snap.transitions;
    this._recalc(); Timeline.render(); Inspector.render(); Renderer.draw();
  },

  _recalc() {
    State.totalDur = State.frames.reduce((s, f) => s + f.dur, 0);
    if (State.currentTime > State.totalDur) State.currentTime = Math.max(0, State.totalDur);
    UI.updateTransport();
  },

  _saveHistory() {
    State.history.push(JSON.stringify({ frames: State.frames, transitions: State.transitions }));
    if (State.history.length > 60) State.history.shift();
    State.future = [];
  },

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space')                            { e.preventDefault(); Player.toggle(); }
      if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); this.undo(); }
      if ((e.metaKey || e.ctrlKey) &&  e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); this.redo(); }
      if (e.code === 'ArrowLeft')  Player.seekTo(State.currentTime - 0.5);
      if (e.code === 'ArrowRight') Player.seekTo(State.currentTime + 0.5);
    });
  },

  _bindTimelineClick() {
    document.getElementById('tl-scroll').addEventListener('click', e => {
      const rect = document.getElementById('tl-inner').getBoundingClientRect();
      Player.seekTo((e.clientX - rect.left) / Timeline.pps());
    });
  },
};

/* ============================================================
   UTILITIES
   ============================================================ */
function formatTime(seconds) {
  const m   = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(1);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());
