// Bot pro testy: BFS k nejbližšímu diamantu / východu na skutečném enginu.
'use strict';
var DH = globalThis.DH, T = DH.T;

function danger(c) {
    var w = c.w, h = c.h, d = new Uint8Array(w * h), x, y, i, a, b;
    for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
            i = y * w + x; var v = c.t[i];
            if (v === T.FIRE || v === T.BUTT) {
                for (a = -2; a <= 2; a++) { for (b = -2; b <= 2; b++) {
                    if (Math.abs(a) + Math.abs(b) <= 2 && x + a > 0 && y + b > 0 && x + a < w && y + b < h) { d[(y + b) * w + x + a] = 1; }
                } }
            }
            if (v === T.EXPL || v === T.EXPD) { d[i] = 1; }
            if ((v === T.ROCK || v === T.DIAM) && (c.fall[i] || (c.t[i + w] === T.E))) {
                // padající kámen: sloupec pod ním
                for (a = 1; a <= 6 && y + a < h; a++) { d[(y + a) * w + x] = 1; if (c.t[(y + a) * w + x] !== T.E) { break; } }
            }
        }
    }
    return d;
}

function plan(c, avoid) {
    var w = c.w, h = c.h, start = c.py * w + c.px, prev = new Int32Array(w * h).fill(-2), q = [start], qi = 0, i, k;
    prev[start] = -1;
    var d = avoid ? danger(c) : null;
    while (qi < q.length) {
        i = q[qi++];
        var v = c.t[i];
        if (i !== start && ((!c.exitOpen && v === T.DIAM) || (c.exitOpen && v === T.EXIT))) { return first(prev, i, start); }
        var x = i % w, y = (i / w) | 0;
        for (k = 0; k < 4; k++) {
            var nx = x + DH.DX[k], ny = y + DH.DY[k], j = ny * w + nx;
            if (prev[j] !== -2) { continue; }
            var nv = c.t[j];
            var pushable = nv === T.ROCK && DH.DY[k] === 0 && c.t[ny * w + nx + DH.DX[k]] === T.E;
            if (!(nv === T.E || nv === T.DIRT || nv === T.DIAM || pushable || (nv === T.EXIT && c.exitOpen))) { continue; }
            if (d && d[j]) { continue; }
            prev[j] = i; q.push(j);
        }
    }
    return -1;
}
function first(prev, i, start) {
    while (prev[i] !== start) { i = prev[i]; }
    return i;
}

function decide(c) {
    var j = plan(c, true);
    if (j < 0) { j = plan(c, false); }
    if (j < 0) { return { dx: 0, dy: 0, fire: false }; }
    var dx = (j % c.w) - c.px, dy = ((j / c.w) | 0) - c.py;
    return { dx: dx, dy: dy, fire: false };
}
module.exports = { decide: decide };
