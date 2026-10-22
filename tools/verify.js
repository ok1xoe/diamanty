// Ověření jeskyní: statická dosažitelnost (zjednodušený model) + bot na skutečném enginu.
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.DH = undefined;
['engine', 'caves'].forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f });
});
var DH = globalThis.DH, T = DH.T, bot = require('./bot.js');
var botCaves = parseInt(process.argv[2] || '4', 10), fail = 0;

DH.CAVES.forEach(function (def, n) {
    var c = DH.loadCave(def), w = c.w, h = c.h, i;
    // statika: flood fill přes vše kromě oceli, cihel a magické zdi
    var seen = new Uint8Array(w * h), st = [c.py * w + c.px], dia = 0, exitOk = false, rocksAbove = 0;
    seen[st[0]] = 1;
    while (st.length) {
        i = st.pop();
        var x = i % w, y = (i / w) | 0;
        if (c.t[i] === T.DIAM) { dia++; }
        if (c.t[i] === T.EXIT) { exitOk = true; }
        for (var k = 0; k < 4; k++) {
            var j = (y + DH.DY[k]) * w + x + DH.DX[k];
            if (seen[j]) { continue; }
            var v = c.t[j];
            if (v === T.STEEL || v === T.BRICK || v === T.MAGIC) { continue; }
            seen[j] = 1; st.push(j);
        }
    }
    var magicSupply = 0, players = 0;
    for (i = 0; i < w * h; i++) {
        if (c.t[i] === T.PLAYER) { players++; }
        if (c.t[i] === T.MAGIC) { magicSupply = 16; }
    }
    var ok = exitOk && players === 1 && dia + magicSupply >= def.need && dia + magicSupply >= def.need + 0;
    console.log('Jeskyně ' + (n + 1) + ' ' + def.name + ': dosažitelné diamanty ' + dia + ' (+' + magicSupply + ' magie), potřeba ' + def.need + ', východ ' + exitOk + (ok ? '  STATIKA OK' : '  STATIKA CHYBA'));
    if (!ok) { fail++; }
    if (n < botCaves) {
        var res = null;
        for (var attempt = 0; attempt < 4 && !(res && res.won); attempt++) {
            var cv = DH.loadCave(def), ticks = 0;
            var maxTicks = def.time * 12;
            while (!cv.won && !cv.dead && ticks < maxTicks) {
                DH.tick(cv, bot.decide(cv)); ticks++;
                for (i = 0; i < cv.w * cv.h; i++) { if (cv.t[i] > 13) { throw new Error('neplatná buňka'); } }
            }
            res = { won: cv.won, dead: cv.dead, ticks: ticks, dia: cv.diamonds };
        }
        console.log('   bot: ' + JSON.stringify(res) + ' (pokus ' + attempt + ')');
        if (!res.won) { fail++; }
    }
});
process.exit(fail ? 1 : 0);
