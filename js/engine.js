// Jádro hry Diamantový havíř: buněčný automat podzemí (bez DOM, testovatelné v Node).
// Jeden krok (tick) = jedno políčko pohybu hráče a jedna aktualizace celé mřížky.
(function (root) {
    'use strict';

    var DH = root.DH = root.DH || {};

    var T = { E: 0, DIRT: 1, STEEL: 2, BRICK: 3, ROCK: 4, DIAM: 5, PLAYER: 6, EXIT: 7, FIRE: 8, BUTT: 9, MAGIC: 10, AMOE: 11, EXPL: 12, EXPD: 13 };
    DH.T = T;

    var CH2T = { ' ': T.E, '.': T.DIRT, '#': T.STEEL, 'W': T.BRICK, 'r': T.ROCK, 'd': T.DIAM, 'P': T.PLAYER, 'X': T.EXIT, 'F': T.FIRE, 'B': T.BUTT, 'M': T.MAGIC, 'A': T.AMOE };
    DH.CH2T = CH2T;

    var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // 0 nahoru, 1 vpravo, 2 dolů, 3 vlevo
    DH.DX = DX; DH.DY = DY;

    var EXPLODE_TICKS = 4;
    DH.TICK_FRAMES = 4;          // logický tick každé 4 snímky 50 Hz (12,5 kroků za sekundu)

    function loadCave(def) {
        var rows = def.rows, h = rows.length, w = rows[0].length, n = w * h;
        var c = {
            def: def, w: w, h: h,
            t: new Uint8Array(n), aux: new Uint8Array(n), fall: new Uint8Array(n), done: new Uint32Array(n),
            stamp: 0, px: 0, py: 0, diamonds: 0, need: def.need, time: def.time, timeFrames: 0,
            exitOpen: false, dead: false, won: false, rs: (def.seed * 2654435761) | 0,
            magicState: 0, magicTimer: 0, amoebaState: 0, amoebaCount: 0, pushT: 0,
            face: 1, moved: false, ev: null, tickNo: 0
        };
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var ch = rows[y].charAt(x), i = y * w + x;
                var v = CH2T[ch];
                if (v === undefined) { v = T.E; }
                c.t[i] = v;
                if (v === T.PLAYER) { c.px = x; c.py = y; }
                if (v === T.FIRE) { c.aux[i] = 3; }
                if (v === T.BUTT) { c.aux[i] = 0; }
            }
        }
        c.ev = newEv();
        return c;
    }

    function newEv() { return { dig: 0, diamond: 0, rock: 0, boom: 0, magic: 0, open: 0, step: 0, points: 0, done: 0 }; }

    function rnd(c) {
        c.rs = (c.rs + 0x6D2B79F5) | 0;
        var t = Math.imul(c.rs ^ (c.rs >>> 15), 1 | c.rs);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // výbuch 3x3 se středem (x,y); type = EXPL (zmizí) nebo EXPD (zbydou diamanty)
    function explode(c, x, y, type) {
        var w = c.w;
        if (c.t[y * w + x] === T.PLAYER) { c.dead = true; }
        c.t[y * w + x] = type; c.aux[y * w + x] = EXPLODE_TICKS; c.fall[y * w + x] = 0;
        c.ev.boom++;
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                var nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= c.h || (dx === 0 && dy === 0)) { continue; }
                var i = ny * w + nx, v = c.t[i];
                if (v === T.STEEL || v === T.EXIT || v === T.EXPL || v === T.EXPD) { continue; }
                if (v === T.FIRE || v === T.BUTT) {
                    explode(c, nx, ny, v === T.BUTT ? T.EXPD : T.EXPL);
                    continue;
                }
                if (v === T.PLAYER) { c.dead = true; }
                c.t[i] = type; c.aux[i] = EXPLODE_TICKS; c.fall[i] = 0;
            }
        }
    }
    DH.killPlayer = function (c) { if (!c.dead) { c.dead = true; explode(c, c.px, c.py, T.EXPL); } };

    function playerStep(c, inp) {
        var w = c.w, dir = -1;
        c.moved = false;
        if (inp.dx > 0) { dir = 1; } else if (inp.dx < 0) { dir = 3; } else if (inp.dy > 0) { dir = 2; } else if (inp.dy < 0) { dir = 0; }
        if (dir < 0) { c.pushT = 0; return; }
        if (dir === 1) { c.face = 1; } else if (dir === 3) { c.face = -1; }
        var nx = c.px + DX[dir], ny = c.py + DY[dir];
        if (nx < 0 || ny < 0 || nx >= w || ny >= c.h) { return; }
        var i = c.py * w + c.px, j = ny * w + nx, v = c.t[j], move = false;
        if (v === T.E) {
            move = !inp.fire;
            if (move) { c.ev.step++; }
        } else if (v === T.DIRT) {
            c.t[j] = T.E; c.ev.dig++; move = !inp.fire;
        } else if (v === T.DIAM) {
            c.t[j] = T.E; c.fall[j] = 0; collect(c); move = !inp.fire;
        } else if (v === T.ROCK && DY[dir] === 0 && !inp.fire) {
            var bx = nx + DX[dir], bi = ny * w + bx;
            if (bx > 0 && bx < w - 1 && c.t[bi] === T.E) {
                c.pushT++;
                if (c.pushT >= 2) {
                    c.t[bi] = T.ROCK; c.fall[bi] = 0; c.done[bi] = c.stamp;
                    c.t[j] = T.E; c.fall[j] = 0; c.ev.rock++; move = true; c.pushT = 0;
                }
                c.moved = true;
            } else { c.pushT = 0; }
        } else if (v === T.EXIT && c.exitOpen) {
            c.t[j] = T.E; move = true; c.won = true; c.ev.done = 1;
        }
        if (v !== T.ROCK) { c.pushT = 0; }
        if (move) {
            c.t[i] = T.E; c.t[j] = T.PLAYER; c.px = nx; c.py = ny; c.moved = true;
        }
    }

    function collect(c) {
        c.diamonds++;
        c.ev.diamond++;
        c.ev.points += c.diamonds <= c.need ? c.def.v1 : c.def.v2;
        if (!c.exitOpen && c.diamonds >= c.need) { c.exitOpen = true; c.ev.open = 1; }
    }

    function stepRock(c, x, y) {
        var w = c.w, i = y * w + x, v = c.t[i], below = c.t[i + w];
        if (below === T.E) {
            c.t[i] = T.E; c.fall[i] = 0;
            c.t[i + w] = v; c.fall[i + w] = 1; c.done[i + w] = c.stamp;
            return;
        }
        if (c.fall[i]) {
            if (below === T.FIRE || below === T.BUTT) { explode(c, x, y + 1, below === T.BUTT ? T.EXPD : T.EXPL); return; }
            if (below === T.PLAYER) { explode(c, x, y + 1, T.EXPL); return; }
            if (below === T.MAGIC && c.magicState < 2) {
                if (c.magicState === 0) { c.magicState = 1; c.magicTimer = c.def.magicTime || 160; }
                c.ev.magic++;
                if (y + 2 < c.h && c.t[i + 2 * w] === T.E) {
                    c.t[i] = T.E; c.fall[i] = 0;
                    c.t[i + 2 * w] = v === T.ROCK ? T.DIAM : T.ROCK; c.fall[i + 2 * w] = 1; c.done[i + 2 * w] = c.stamp;
                    return;
                }
                c.fall[i] = 0;
                return;
            }
        }
        if (below === T.ROCK || below === T.DIAM || below === T.BRICK) {
            if (c.t[i - 1] === T.E && c.t[i + w - 1] === T.E) {
                c.t[i] = T.E; c.fall[i] = 0;
                c.t[i - 1] = v; c.fall[i - 1] = 1;
                return;
            }
            if (c.t[i + 1] === T.E && c.t[i + w + 1] === T.E) {
                c.t[i] = T.E; c.fall[i] = 0;
                c.t[i + 1] = v; c.fall[i + 1] = 1; c.done[i + 1] = c.stamp;
                return;
            }
        }
        c.fall[i] = 0;
    }

    function stepCreature(c, x, y) {
        var w = c.w, i = y * w + x, v = c.t[i], d = c.aux[i], k, ni;
        for (k = 0; k < 4; k++) {
            var nv = c.t[(y + DY[k]) * w + x + DX[k]];
            if (nv === T.PLAYER || nv === T.AMOE) { explode(c, x, y, v === T.BUTT ? T.EXPD : T.EXPL); return; }
        }
        var fire = v === T.FIRE;
        var tl = fire ? (d + 3) & 3 : (d + 1) & 3;      // světluška přednostně vlevo, motýl vpravo
        ni = (y + DY[tl]) * w + x + DX[tl];
        if (c.t[ni] === T.E) {
            c.t[i] = T.E; c.t[ni] = v; c.aux[ni] = tl; c.done[ni] = c.stamp; return;
        }
        ni = (y + DY[d]) * w + x + DX[d];
        if (c.t[ni] === T.E) {
            c.t[i] = T.E; c.t[ni] = v; c.aux[ni] = d; c.done[ni] = c.stamp; return;
        }
        c.aux[i] = fire ? (d + 1) & 3 : (d + 3) & 3;
    }

    function stepAmoeba(c, x, y, st) {
        var w = c.w, i = y * w + x;
        if (c.amoebaState === 1) { c.t[i] = T.ROCK; return; }
        if (c.amoebaState === 2) { c.t[i] = T.DIAM; return; }
        st.count++;
        var k, nv;
        for (k = 0; k < 4; k++) {
            nv = c.t[(y + DY[k]) * w + x + DX[k]];
            if (nv === T.E || nv === T.DIRT) { st.grow = true; }
        }
        if (rnd(c) < (c.def.amoebaRate || 0.04)) {
            k = Math.floor(rnd(c) * 4) & 3;
            var ni = (y + DY[k]) * w + x + DX[k];
            if (c.t[ni] === T.E || c.t[ni] === T.DIRT) { c.t[ni] = T.AMOE; c.done[ni] = c.stamp; }
        }
    }

    function tick(c, inp) {
        var w = c.w, h = c.h, x, y, i;
        c.ev = newEv();
        c.stamp++;
        c.tickNo++;
        if (!c.dead && !c.won) { playerStep(c, inp || { dx: 0, dy: 0, fire: false }); }
        var st = { count: 0, grow: false };
        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) {
                i = y * w + x;
                if (c.done[i] === c.stamp) { continue; }
                switch (c.t[i]) {
                    case T.ROCK: case T.DIAM: stepRock(c, x, y); break;
                    case T.FIRE: case T.BUTT: stepCreature(c, x, y); break;
                    case T.AMOE: stepAmoeba(c, x, y, st); break;
                    case T.EXPL: case T.EXPD:
                        if (--c.aux[i] <= 0) { c.t[i] = c.t[i] === T.EXPD ? T.DIAM : T.E; c.fall[i] = 0; c.done[i] = c.stamp; }
                        break;
                    default: break;
                }
            }
        }
        if (c.magicState === 1 && --c.magicTimer <= 0) { c.magicState = 2; }
        if (c.amoebaState === 0 && st.count > 0) {
            c.amoebaCount = st.count;
            if (st.count >= (c.def.amoebaMax || 70)) { c.amoebaState = 1; }
            else if (!st.grow) { c.amoebaState = 2; }
        } else if (st.count === 0) { c.amoebaState = 0; c.amoebaCount = 0; }
        return c.ev;
    }

    DH.loadCave = loadCave;
    DH.tick = tick;
    DH.explode = explode;
})(typeof window !== 'undefined' ? window : globalThis);
