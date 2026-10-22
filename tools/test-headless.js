// Headless test v Node: atrapa DOM, simulace snímků, bot, přechody stavů, NaN, PNG framebuffer.
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
var root = path.join(__dirname, '..');
var out = process.argv[2] || path.join(root, 'tools');
var fails = 0;
function check(c, msg) { if (!c) { fails++; console.log('CHYBA: ' + msg); } else { console.log('ok: ' + msg); } }

// ---------- atrapa DOM ----------
var handlers = {};
var fakeCtx = { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function (d) { fakeCtx.last = d; } };
var canvasObj = { getContext: function () { return fakeCtx; }, style: {}, addEventListener: function () {} };
globalThis.window = globalThis;
globalThis.document = {
    getElementById: function () { return canvasObj; },
    querySelectorAll: function () { return []; },
    addEventListener: function (n, f) { (handlers[n] = handlers[n] || []).push(f); },
    body: { style: {} }, hidden: false
};
globalThis.localStorage = { _d: {}, getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; }, setItem: function (k, v) { this._d[k] = String(v); } };
globalThis.requestAnimationFrame = function () {};
globalThis.matchMedia = function () { return { matches: false }; };
globalThis.innerWidth = 1024; globalThis.innerHeight = 768;
globalThis.addEventListener = function () {};
function fire(type, code, extra) { var e = Object.assign({ keyCode: code, repeat: false, preventDefault: function () {} }, extra || {}); (handlers[type] || []).forEach(function (f) { f(e); }); }

['engine', 'caves', 'font', 'gfx', 'sprites', 'sound', 'main'].forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
});
var DH = globalThis.DH, T = DH.T, G = DH.game, bot = require('./bot.js');

function savePng(name, scr) {
    // vykreslení do RGBA a zvětšení 3x
    var d = fakeCtx.last.data, S = 3, W = 256 * S, H = 192 * S, raw = Buffer.alloc((W * 4 + 1) * H), o = 0, x, y;
    for (y = 0; y < H; y++) {
        raw[o++] = 0;
        for (x = 0; x < W; x++) { var s = (((y / S) | 0) * 256 + ((x / S) | 0)) * 4; raw[o++] = d[s]; raw[o++] = d[s + 1]; raw[o++] = d[s + 2]; raw[o++] = 255; }
    }
    var crcT = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } crcT[n] = c >>> 0; }
    function crc(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) { c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
    function chunk(t, data) { var l = Buffer.alloc(4); l.writeUInt32BE(data.length); var td = Buffer.concat([Buffer.from(t), data]); var cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); }
    var ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
    fs.writeFileSync(path.join(out, name), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function nanCheck() {
    var g = G._get(), bad = false;
    if (!isFinite(g.score) || !isFinite(g.lives) || !isFinite(g.camx) || !isFinite(g.camy)) { bad = true; }
    if (g.cave) { for (var i = 0; i < g.cave.t.length; i++) { if (g.cave.t[i] > 13) { bad = true; } } if (!isFinite(g.cave.px) || !isFinite(g.cave.time)) { bad = true; } }
    return !bad;
}
function frames(n) { for (var i = 0; i < n; i++) { G._step(); if (!nanCheck()) { fails++; console.log('CHYBA: NaN/neplatná buňka ve snímku'); return; } } }

// ---------- pravidla automatu ----------
function mk(rows, extra) { var d = Object.assign({ rows: rows, need: 1, time: 100, seed: 1, v1: 10, v2: 20, theme: { dirt: 2, steel: 1 } }, extra || {}); return DH.loadCave(d); }
function at(c, x, y) { return c.t[y * c.w + x]; }
var c;
c = mk(['#####', '#r  #', '#   #', '#####']);
DH.tick(c, null); DH.tick(c, null);
check(at(c, 1, 3 - 1) === T.ROCK, 'kámen padá volně dolů (dopadl na dno)');
// kutálení po kameni
c = mk(['#####', '# r #', '# r #', '#####'.replace('#####', '#####')]);
c = mk(['######', '#  r #', '#  r #', '#    #', '######']);
DH.tick(c, null); DH.tick(c, null); DH.tick(c, null);
check(at(c, 3, 3) === T.ROCK && (at(c, 2, 3) === T.ROCK || at(c, 4, 3) === T.ROCK || at(c, 3, 2) === T.ROCK), 'kameny se kutálejí / skládají (' + [at(c, 2, 3), at(c, 3, 3), at(c, 4, 3)].join('') + ')');
// kutálení: kámen na kameni s volnými stranami spadne do strany
c = mk(['#######', '#     #', '#  r  #', '#  r  #', '#######']);
c.t[2 * 7 + 3] = T.E; c.t[1 * 7 + 3] = T.ROCK;      // dva kameny na sobě: spodní na dně
c = mk(['#######', '#  r  #', '#  r  #', '#     #', '#######']);
DH.tick(c, null);       // spodní padne na dno, horní padne za ním
DH.tick(c, null);
DH.tick(c, null);
check(at(c, 3, 3) === T.ROCK && at(c, 3, 2) === T.ROCK || at(c, 2, 3) === T.ROCK || at(c, 4, 3) === T.ROCK, 'sloupec kamenů se zhroutí / rozkutálí');
// kámen padá na hráče = smrt
c = mk(['#####', '# r #', '#   #', '# P #', '#####']);
DH.tick(c, null); DH.tick(c, null);
check(c.dead, 'padající kámen zabije hráče');
// kámen v klidu na hráči nezabíjí
c = mk(['#####', '#.r.#', '#.P.#', '#####']); c.t[1*5+2]=T.ROCK;
DH.tick(c, null); DH.tick(c, null);
check(!c.dead, 'kámen v klidu hráče nezabíjí');
// diamant: sběr, otevření východu
c = mk(['#####', '#Pd.X', '#####'].map(function (s, i) { return i === 1 ? '#Pd.X#' : '######'; }), { need: 1 });
DH.tick(c, { dx: 1, dy: 0 });
check(c.diamonds === 1 && c.exitOpen, 'sebrání diamantu otevře východ');
DH.tick(c, { dx: 1, dy: 0 }); DH.tick(c, { dx: 1, dy: 0 });
check(c.won, 'vstup do otevřeného východu = vítězství');
// motýl po výbuchu: 9 diamantů
c = mk(['#######', '#.....#', '#.....#', '#  B  #', '#     #', '#######']);
c.t[1 * 7 + 3] = T.ROCK; c.t[2 * 7 + 3] = T.ROCK; c.fall[2 * 7 + 3] = 1; c.t[2 * 7 + 3] = T.E;
c.t[2 * 7 + 3] = T.ROCK; c.fall[2 * 7 + 3] = 1; c.t[3 * 7 + 3] = T.BUTT; c.aux[3 * 7 + 3] = 0; c.t[1 * 7 + 3] = T.E;
DH.tick(c, null); for (var q = 0; q < 8; q++) { DH.tick(c, null); }
var dcount = 0; for (q = 0; q < c.t.length; q++) { if (c.t[q] === T.DIAM) { dcount++; } }
check(dcount >= 6, 'motýl rozdrcený kamenem dá diamanty (' + dcount + ')');
// světluška se drží zdi
c = mk(['########', '#      #', '#  F   #', '#      #', '########']);
var seen = {}; for (q = 0; q < 30; q++) { DH.tick(c, null); for (var yy = 0; yy < c.h; yy++) for (var xx = 0; xx < c.w; xx++) if (c.t[yy * c.w + xx] === T.FIRE) seen[xx + ',' + yy] = 1; }
check(Object.keys(seen).length >= 4, 'světluška obíhá místnost (' + Object.keys(seen).length + ' polí)');
// magická zeď
c = mk(['#####', '#.r.#', '#...#', '#   #', '#   #', '#M###'.replace('#M###', '#.###'), '#####'].slice(0, 6));
c = mk(['#####', '# r #', '#   #', '#MMM#', '#   #', '#   #', '#####']);
c.t[1 * 5 + 2] = T.ROCK;
for (q = 0; q < 6; q++) { DH.tick(c, null); }
dcount = 0; for (q = 0; q < c.t.length; q++) { if (c.t[q] === T.DIAM) { dcount++; } }
check(dcount === 1 && c.magicState >= 1, 'magická zeď promění kámen v diamant');
// houba se zasekne -> diamanty
c = mk(['#####', '#WWW#', '#WAW#', '#WWW#', '#####']);
for (q = 0; q < 5; q++) { DH.tick(c, null); }
check(at(c, 2, 2) === T.DIAM, 'uzavřená houba se změní v diamanty');
// push
c = mk(['######', '#Pr  #', '######']);
DH.tick(c, { dx: 1, dy: 0 }); DH.tick(c, { dx: 1, dy: 0 });
check(at(c, 3, 1) === T.ROCK && c.px === 2, 'hráč tlačí kámen');

// ---------- průchod hrou ----------
check(G._get().state === 'title', 'start na titulní obrazovce');
G._draw(); savePng('shot-title.png');
fire('keydown', 32); fire('keyup', 32);
check(G._get().state === 'intro', 'title -> intro');
frames(120);
check(G._get().state === 'play', 'intro -> play');

// bot hraje první 4 jeskyně přes celou hru
function playCave(maxFrames) {
    var n = 0;
    while (G._get().state === 'play' && n < maxFrames) {
        var g = G._get(), inp = bot.decide(g.cave);
        G._held.left = inp.dx < 0; G._held.right = inp.dx > 0; G._held.up = inp.dy < 0; G._held.down = inp.dy > 0;
        frames(1); n++;
    }
    G._held.left = G._held.right = G._held.up = G._held.down = false;
    return n;
}
var shot = false;
for (var lv = 0; lv < 4; lv++) {
    var idx = G._get().caveIndex, safety = 0;
    check(idx === lv, 'jeskyně ' + (lv + 1) + ' načtena');
    var midway = 0;
    while (G._get().state !== 'complete' && safety++ < 30) {
        var s = G._get().state;
        if (s === 'play') { playCave(9000); if (!shot && G._get().cave.diamonds >= 3) { G._draw(); savePng('shot-play.png'); shot = true; } }
        else { frames(1); }
        if (G._get().state === 'over') { break; }
    }
    check(G._get().state === 'complete', 'bot dokončil jeskyni ' + (lv + 1) + ' (skóre ' + G._get().score + ')');
    if (lv === 1) { G._draw(); }
    frames(1500);
}
check(G._get().caveIndex === 4 && /intro|play/.test(G._get().state), 'po jeskyni 4 následuje jeskyně 5');
G._draw(); savePng('shot-cave5.png');
frames(120);

// smrt a konec hry: R = restart života
var lives0 = G._get().lives;
fire('keydown', 82); fire('keyup', 82);
check(G._get().state === 'dying', 'play -> dying (R)');
frames(200);
check(G._get().lives === lives0 - 1 && /intro|play/.test(G._get().state), 'dying -> nový život (' + G._get().lives + ')');
for (var l = 0; l < 6 && G._get().state !== 'over'; l++) { frames(120); if (G._get().state === 'play') { fire('keydown', 82); fire('keyup', 82); frames(200); } }
check(G._get().state === 'over', 'dying -> over');
G._draw(); savePng('shot-over.png');
var hiNow = G._get().hi;
check(hiNow > 0 && localStorage.getItem('diamanty.hi') === String(hiNow), 'rekord uložen do localStorage (' + hiNow + ')');
fire('keydown', 13); fire('keyup', 13);
check(G._get().state === 'title', 'over -> title');

// pauza a visibilitychange
fire('keydown', 13); frames(120);
fire('keydown', 80); check(G._get().state === 'paused', 'P pozastaví hru'); G._draw(); savePng('shot-pause.png');
fire('keydown', 80); check(G._get().state === 'play', 'P pokračuje');
document.hidden = true; (handlers.visibilitychange || []).forEach(function (f) { f(); }); check(G._get().state === 'paused', 'visibilitychange -> pauza');
document.hidden = false; fire('keydown', 80);
fire('keydown', 77); fire('keydown', 77);

// časový limit
var cv = G._get().cave; cv.time = 2; frames(200);
check(['dying', 'intro', 'over'].indexOf(G._get().state) >= 0, 'vypršení času ukončí život');

// vykreslení všech jeskyní bez chyb
for (var ci = 0; ci < DH.CAVES.length; ci++) { G._setCave(ci); G._draw(); if (ci === 7) { savePng('shot-cave8.png'); } }
check(true, 'vykresleny všechny jeskyně');
// dlouhá simulace bez vstupu v jeskyni s houbou/magií (stabilita)
for (ci = 4; ci < 8; ci++) { G._setCave(ci); frames(120 + 3000); }
check(nanCheck(), 'dlouhá simulace bez NaN');
console.log(fails ? ('SELHÁNÍ: ' + fails) : 'VŠE OK');
process.exit(fails ? 1 : 0);
