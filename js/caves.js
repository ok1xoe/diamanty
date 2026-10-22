// Jeskyně: deterministický generátor (podle seedu) + definice osmi jeskyní rostoucí obtížnosti.
// Znaky: # ocel, . hlína, W cihly, r kámen, d diamant, P hráč, X východ, F světluška, B motýl,
// M magická zeď, A houba, mezera = prázdno.
(function (root) {
    'use strict';

    var DH = root.DH = root.DH || {};
    var W = 40, H = 22;

    function mulberry(seed) {
        var a = seed | 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function generate(def) {
        var r = mulberry(def.seed), g = [], x, y, k, n;
        for (y = 0; y < H; y++) {
            g.push([]);
            for (x = 0; x < W; x++) { g[y].push((x === 0 || y === 0 || x === W - 1 || y === H - 1) ? '#' : '.'); }
        }
        function inside(a, b) { return a > 0 && b > 0 && a < W - 1 && b < H - 1; }
        function set(a, b, ch) { if (inside(a, b)) { g[b][a] = ch; } }
        var reserved = [];
        function overlaps(rx, ry, rw, rh) {
            for (var q = 0; q < reserved.length; q++) {
                var s = reserved[q];
                if (rx < s[0] + s[2] + 1 && s[0] < rx + rw + 1 && ry < s[1] + s[3] + 1 && s[1] < ry + rh + 1) { return true; }
            }
            return false;
        }
        var ex = def.exit[0], ey = def.exit[1];
        reserved.push([1, 1, 7, 6]);                 // start
        reserved.push([ex - 2, ey - 2, 5, 5]);       // východ

        // kameny
        for (y = 1; y < H - 1; y++) { for (x = 1; x < W - 1; x++) { if (r() < def.rock) { g[y][x] = 'r'; } } }

        // zvláštní útvary rezervujeme dřív než cihly
        var mg = def.magic, am = def.amoeba;
        if (mg) { reserved.push([mg.x - 1, mg.y - 6, 10, 11]); }
        if (am) { reserved.push([am.x - 1, am.y - 1, 9, 7]); }

        // cihlové zdi
        for (n = 0; n < def.walls; n++) {
            var horiz = r() < 0.6, len = 4 + Math.floor(r() * 6);
            var wx = 3 + Math.floor(r() * (W - 14)), wy = 5 + Math.floor(r() * (H - 9));
            var okw = true;
            for (k = 0; k < len; k++) { if (overlaps(horiz ? wx + k : wx, horiz ? wy : wy + k, 1, 1)) { okw = false; } }
            if (!okw) { continue; }
            for (k = 0; k < len; k++) { set(horiz ? wx + k : wx, horiz ? wy : wy + k, 'W'); }
        }

        // prázdná komora (nad ní kameny nahradíme hlínou, ať nepadají hned na začátku)
        function carve(cx, cy, cw, ch) {
            for (var yy = cy; yy < cy + ch; yy++) { for (var xx = cx; xx < cx + cw; xx++) { set(xx, yy, ' '); } }
            for (var xx2 = cx - 1; xx2 <= cx + cw; xx2++) { if (inside(xx2, cy - 1) && g[cy - 1][xx2] === 'r') { g[cy - 1][xx2] = '.'; } }
            reserved.push([cx, cy, cw, ch]);
        }

        // magická zeď: kameny na hlíněné římse, pod zdí komora
        if (mg) {
            for (k = 0; k < 8; k++) {
                set(mg.x + k, mg.y, 'M');
                set(mg.x + k, mg.y - 4, '.');
                set(mg.x + k, mg.y - 5, 'r');
                set(mg.x + k, mg.y - 6, 'r');
                set(mg.x + k, mg.y + 4, '.');
                for (var q = 1; q <= 3; q++) { set(mg.x + k, mg.y - q, ' '); set(mg.x + k, mg.y + q, ' '); }
            }
            for (k = -6; k <= 4; k++) { set(mg.x - 1, mg.y + k, '.'); set(mg.x + 8, mg.y + k, '.'); }
            for (k = 0; k < 8; k++) { set(mg.x + k, mg.y - 7, '.'); }
        }

        // houba v cihlové kapse s jedním otvorem do hlíny
        if (am) {
            for (y = 0; y < 5; y++) { for (x = 0; x < 7; x++) { set(am.x + x, am.y + y, (x === 0 || y === 0 || x === 6 || y === 4) ? 'W' : ' '); } }
            set(am.x + 3, am.y + 2, 'A');
            set(am.x, am.y + 2, '.');
            for (x = -1; x < 8; x++) { if (inside(am.x + x, am.y - 1) && g[am.y - 1][am.x + x] === 'r') { g[am.y - 1][am.x + x] = '.'; } }
        }

        // světlušky a motýli, každý ve vlastní komoře 6x3
        var kinds = [], f;
        for (f = 0; f < (def.fire || 0); f++) { kinds.push('F'); }
        for (f = 0; f < (def.butt || 0); f++) { kinds.push('B'); }
        kinds.forEach(function (kind) {
            for (var tries = 0; tries < 200; tries++) {
                var cx = 3 + Math.floor(r() * (W - 11)), cy = 4 + Math.floor(r() * (H - 9));
                if (overlaps(cx, cy, 6, 3)) { continue; }
                carve(cx, cy, 6, 3);
                set(cx + 2, cy + 1, kind);
                return;
            }
        });

        // start a východ
        for (y = 1; y <= 5; y++) { for (x = 1; x <= 6; x++) { if (g[y][x] === 'r' || g[y][x] === 'W') { g[y][x] = '.'; } } }
        for (y = ey - 1; y <= ey + 1; y++) { for (x = ex - 1; x <= ex + 1; x++) { if (inside(x, y)) { g[y][x] = '.'; } } }
        g[2][2] = 'P';
        g[ey][ex] = 'X';

        // diamanty
        var placed = 0, guard = 0;
        while (placed < def.dia && guard++ < 10000) {
            x = 1 + Math.floor(r() * (W - 2)); y = 1 + Math.floor(r() * (H - 2));
            if (g[y][x] === '.' && !(x < 7 && y < 6) && !(Math.abs(x - ex) < 2 && Math.abs(y - ey) < 2)) { g[y][x] = 'd'; placed++; }
        }
        return g.map(function (row) { return row.join(''); });
    }

    var DEFS = [
        { name: 'Mělká štola', seed: 11, rock: 0.07, walls: 3, dia: 20, need: 12, time: 140, exit: [36, 19], v1: 10, v2: 15, theme: { dirt: 2, steel: 1 } },
        { name: 'Světlušky', seed: 22, rock: 0.10, walls: 4, dia: 22, need: 14, fire: 2, time: 150, exit: [37, 3], v1: 10, v2: 15, theme: { dirt: 6, steel: 5 } },
        { name: 'Motýlí údolí', seed: 33, rock: 0.11, walls: 5, dia: 24, need: 16, fire: 1, butt: 2, time: 160, exit: [36, 19], v1: 12, v2: 18, theme: { dirt: 1, steel: 1 } },
        { name: 'Pád kamenů', seed: 44, rock: 0.15, walls: 5, dia: 26, need: 18, fire: 2, butt: 2, time: 170, exit: [3, 19], v1: 12, v2: 20, theme: { dirt: 6, steel: 5 } },
        { name: 'Kouzelná zeď', seed: 55, rock: 0.09, walls: 4, dia: 12, need: 20, fire: 1, time: 180, exit: [36, 19], v1: 15, v2: 25, magic: { x: 16, y: 10 }, magicTime: 220, theme: { dirt: 3, steel: 1 } },
        { name: 'Houbový důl', seed: 66, rock: 0.12, walls: 4, dia: 24, need: 20, fire: 2, time: 170, exit: [37, 3], v1: 15, v2: 25, amoeba: { x: 24, y: 14 }, amoebaRate: 0.03, amoebaMax: 60, theme: { dirt: 2, steel: 3 } },
        { name: 'Motýlí farma', seed: 77, rock: 0.13, walls: 4, dia: 14, need: 24, fire: 1, butt: 4, time: 190, exit: [36, 19], v1: 15, v2: 30, magic: { x: 14, y: 11 }, magicTime: 220, theme: { dirt: 1, steel: 2 } },
        { name: 'Hluboký důl', seed: 88, rock: 0.16, walls: 5, dia: 20, need: 28, fire: 3, butt: 3, time: 210, exit: [3, 19], v1: 20, v2: 40, magic: { x: 20, y: 9 }, magicTime: 200, amoeba: { x: 28, y: 15 }, amoebaRate: 0.03, amoebaMax: 60, theme: { dirt: 2, steel: 4 } }
    ];
    DEFS.forEach(function (d) { d.rows = generate(d); });

    DH.CAVES = DEFS;
    DH.CAVE_W = W; DH.CAVE_H = H;
})(typeof window !== 'undefined' ? window : globalThis);
