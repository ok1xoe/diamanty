// Hra Diamantový havíř: stavy hry, vykreslení, vstup, smyčka 50 Hz.
(function (root) {
    'use strict';

    var DH = root.DH;
    var T = DH.T;
    var canvas = document.getElementById('screen');
    var ctx = canvas.getContext('2d');
    var scr = new DH.Screen();

    var VW = 32, VH = 20;
    var state = 'title';        // title | intro | play | dying | complete | over | win | paused
    var cave = null, caveIndex = 0, camx = 0, camy = 0;
    var score = 0, lives = 3, hi = 0, nextLife = 2500;
    var stateTimer = 0, frame = 0, prevState = 'play', flashT = 0, fireLocked = false;
    var held = { left: false, right: false, up: false, down: false, fire: false };
    var pend = { left: false, right: false, up: false, down: false };
    var lastDir = '';

    try { hi = parseInt(localStorage.getItem('diamanty.hi'), 10) || 0; } catch (e) { hi = 0; }

    // ---------- pomocné ----------
    function pad(n, len) { var s = String(Math.max(0, n | 0)); while (s.length < len) { s = '0' + s; } return s; }

    function line(row, str, ink, x) {
        var px = x === undefined ? Math.floor((256 - DH.textWidth(str, 1)) / 2) : x;
        DH.drawText(scr, px, row * 8 - 1, str, ink, 1);
    }

    function addScore(n) {
        score += n;
        if (score > hi) {
            hi = score;
            try { localStorage.setItem('diamanty.hi', String(hi)); } catch (e) { /* ignorovat */ }
        }
        if (score >= nextLife) { lives = Math.min(lives + 1, 9); nextLife += 2500; DH.sound.exit(); }
    }

    function setBorder(color) {
        var c = DH.PAL[color & 15];
        document.body.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }

    // ---------- průběh hry ----------
    function startGame() {
        score = 0; lives = 3; nextLife = 2500; caveIndex = 0;
        loadCave();
    }

    function loadCave() {
        cave = DH.loadCave(DH.CAVES[caveIndex]);
        state = 'intro';
        stateTimer = 110;
        flashT = 0;
        camx = clamp(cave.px - 16, 0, cave.w - VW);
        camy = clamp(cave.py - 10, 0, cave.h - VH);
        setBorder(0);
        DH.sound.stopTune();
    }

    function toTitle() {
        state = 'title';
        setBorder(0);
        DH.sound.startTune();
    }

    function startDying() {
        state = 'dying';
        stateTimer = 75;
        DH.sound.die();
    }

    function startComplete() {
        state = 'complete';
        stateTimer = 0;
        DH.sound.exit();
    }

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function updateCamera() {
        if (cave.px - camx < 7) { camx = cave.px - 7; }
        if (cave.px - camx > VW - 8) { camx = cave.px - (VW - 8); }
        if (cave.py - camy < 5) { camy = cave.py - 5; }
        if (cave.py - camy > VH - 6) { camy = cave.py - (VH - 6); }
        camx = clamp(camx, 0, cave.w - VW);
        camy = clamp(camy, 0, cave.h - VH);
    }

    function inputNow() {
        var names = ['left', 'right', 'up', 'down'], dir = '', i;
        function on(k) { return held[k] || pend[k]; }
        if (lastDir && on(lastDir)) { dir = lastDir; }
        else { for (i = 0; i < 4; i++) { if (on(names[i])) { dir = names[i]; break; } } }
        pend.left = pend.right = pend.up = pend.down = false;
        return {
            dx: dir === 'right' ? 1 : (dir === 'left' ? -1 : 0),
            dy: dir === 'down' ? 1 : (dir === 'up' ? -1 : 0),
            fire: held.fire && !fireLocked
        };
    }

    function handleEvents(ev) {
        if (ev.points) { addScore(ev.points); }
        if (ev.diamond) { DH.sound.diamond(); }
        else if (ev.rock) { DH.sound.rock(); }
        else if (ev.dig) { DH.sound.dig(); }
        else if (ev.step && (cave.tickNo & 1)) { DH.sound.step(); }
        if (ev.boom) { DH.sound.boom(); }
        if (ev.magic && (cave.tickNo & 3) === 0) { DH.sound.magic(); }
        if (ev.open) { flashT = 14; DH.sound.open(); }
    }

    function playFrame() {
        if (frame % DH.TICK_FRAMES === 0) {
            handleEvents(DH.tick(cave, inputNow()));
        }
        updateCamera();
        if (cave.dead) { startDying(); return; }
        if (cave.won) { startComplete(); return; }
        if (++cave.timeFrames >= 50) {
            cave.timeFrames = 0;
            if (cave.time > 0) { cave.time--; }
            if (cave.time <= 10 && cave.time > 0) { DH.sound.warn(); }
            if (cave.time <= 0) { DH.killPlayer(cave); startDying(); }
        }
    }

    function step() {
        frame++;
        if (flashT > 0) { flashT--; setBorder(flashT & 2 ? 15 : 0); if (flashT === 0) { setBorder(0); } }
        switch (state) {
            case 'intro':
                if (--stateTimer <= 0) { state = 'play'; }
                break;
            case 'play':
                playFrame();
                break;
            case 'dying':
                if (frame % DH.TICK_FRAMES === 0) { DH.tick(cave, { dx: 0, dy: 0, fire: false }); }
                if (--stateTimer <= 0) {
                    lives--;
                    if (lives < 0) { state = 'over'; DH.sound.over(); }
                    else { loadCave(); }
                }
                break;
            case 'complete':
                if (cave.time > 0) {
                    cave.time--;
                    addScore(5);
                    if ((frame & 1) === 0) { DH.sound.tick(); }
                } else if (++stateTimer > 40) {
                    caveIndex++;
                    if (caveIndex >= DH.CAVES.length) { state = 'win'; DH.sound.win(); }
                    else { loadCave(); }
                }
                break;
            default: break;
        }
    }

    // ---------- vykreslení ----------
    function tileDraw(c, r, v, i) {
        var th = cave.def.theme, S = DH.SPR, f = (frame >> 3) & 1, a, ink, rows;
        switch (v) {
            case T.E: return;
            case T.DIRT: ink = th.dirt; rows = S.dirt; break;
            case T.STEEL: ink = th.steel | 8; rows = S.steel; break;
            case T.BRICK: ink = 10; rows = S.brick; break;
            case T.ROCK: ink = 7; rows = S.rock; break;
            case T.DIAM: ink = f ? 15 : 13; rows = S.diamond[f]; break;
            case T.EXIT:
                if (cave.exitOpen) { ink = f ? 15 : 14; rows = S.exit; } else { ink = 7; rows = S.door; }
                break;
            case T.FIRE: ink = 12; rows = S.fire[(frame >> 2) & 1]; break;
            case T.BUTT: ink = 11; rows = S.butt[(frame >> 2) & 1]; break;
            case T.MAGIC:
                if (cave.magicState === 2) { ink = th.steel | 8; rows = S.steel; }
                else { ink = cave.magicState === 1 ? 9 + ((frame >> 1) % 6) : 13; rows = S.magic[(frame >> 2) & 1]; }
                break;
            case T.AMOE: ink = 4; rows = S.amoeba[(frame >> 4) & 1]; break;
            case T.EXPL: case T.EXPD:
                a = cave.aux[i];
                rows = S.boom[a >= 4 ? 0 : (a >= 3 ? 1 : (a === 2 ? 2 : 1))];
                ink = v === T.EXPD ? (a & 1 ? 15 : 13) : (a & 1 ? 14 : 10);
                break;
            case T.PLAYER:
                rows = DH.SPR.player[cave.moved ? 1 + ((frame >> 2) & 1) : 0];
                scr.setCell(c, r, 14, 0, true);
                scr.pattern(c, r, mirror(rows, cave.face < 0), 14);
                return;
            default: return;
        }
        scr.setCell(c, r, ink & 7, 0, ink & 8);
        scr.pattern(c, r, rows, ink);
    }

    var mirrorCache = {};
    function mirror(rows, flip) {
        if (!flip) { return rows; }
        var key = rows.join('');
        if (!mirrorCache[key]) {
            mirrorCache[key] = rows.map(function (s) { return s.split('').reverse().join(''); });
        }
        return mirrorCache[key];
    }

    function drawCave() {
        scr.clear(0, 7);
        var r, c;
        for (r = 0; r < VH; r++) {
            for (c = 0; c < VW; c++) {
                var i = (camy + r) * cave.w + camx + c;
                tileDraw(c, r, cave.t[i], i);
            }
        }
    }

    function drawHud() {
        scr.fillCells(0, 20, 32, 4, 7, 1, 1);
        scr.block(0, 160, 256, 32, 0, 0, false);
        // řádek 20: diamanty, hodnota, čas
        var open = cave.exitOpen;
        line(20, 'DIAMANTY ' + pad(cave.diamonds, 2) + '/' + pad(cave.need, 2) + '   ČAS ' + pad(cave.time, 3), open && ((frame >> 3) & 1) ? 14 : 15);
        line(21, 'SKÓRE ' + pad(score, 6) + '   REKORD ' + pad(hi, 6), 15);
        line(22, 'JESKYNĚ ' + (caveIndex + 1) + '/' + DH.CAVES.length + ': ' + cave.def.name, 13);
        line(23, open ? 'VÝCHOD JE OTEVŘEN!' : 'ŽIVOTY', 14, open ? undefined : 8);
        if (!open) {
            for (var i = 0; i < Math.min(lives, 9); i++) { scr.sprite(56 + i * 9, 23 * 8, DH.SPR.player[0], 14, false); }
        }
    }

    function drawTitle() {
        scr.clear(0, 7);
        var title = 'DIAMANTOVÝ HAVÍŘ';
        var x = Math.floor((256 - DH.textWidth(title, 2)) / 2);
        var cols = [10, 14, 12, 13, 11, 9];
        for (var i = 0; i < title.length; i++) {
            DH.drawText(scr, x + i * 12, 8, title.charAt(i), cols[(i + (frame >> 3)) % cols.length], 2);
        }
        var r, S = DH.SPR;
        for (r = 0; r < 32; r++) {
            scr.setCell(r, 0, 1, 0, true); scr.pattern(r, 0, S.steel, 9);
            scr.setCell(r, 23, 1, 0, true); scr.pattern(r, 23, S.steel, 9);
        }
        line(4, 'REKORD ' + pad(hi, 6), 14);
        function legend(row, rows, ink, txt) {
            scr.setCell(2, row, ink & 7, 0, ink & 8);
            scr.pattern(2, row, rows, ink);
            line(row, txt, 7, 32);
        }
        legend(6, S.player[(frame >> 3) % 3], 14, 'HAVÍŘ KOPE HLÍNU A SBÍRÁ');
        legend(7, S.diamond[(frame >> 3) & 1], 13, 'DIAMANTY - SEBER JICH DOST');
        legend(8, S.rock, 7, 'KÁMEN PADÁ A DRTÍ I TEBE');
        legend(9, S.fire[(frame >> 2) & 1], 12, 'SVĚTLUŠKA - VÝBUCH POBLÍŽ');
        legend(10, S.butt[(frame >> 2) & 1], 11, 'MOTÝL - PO VÝBUCHU DIAMANTY');
        legend(11, S.magic[(frame >> 2) & 1], 10 + ((frame >> 2) % 5), 'KOUZELNÁ ZEĎ: KÁMEN > DIAMANT');
        legend(12, S.amoeba[(frame >> 4) & 1], 4, 'HOUBA ROSTE, NECH JI ZAVŘENOU');
        line(14, 'ŠIPKY/WASD - POHYB', 15);
        line(15, 'MEZERNÍK + SMĚR - KOPAT BEZ KROKU', 15);
        line(16, 'P PAUZA   M ZVUK   R RESTART ŽIVOTA', 15);
        line(18, 'SEBER POTŘEBNÉ DIAMANTY A PROJDI', 5);
        line(19, 'OTEVŘENÝM VÝCHODEM PŘED KONCEM ČASU', 5);
        if ((frame >> 4) & 1) { line(21, 'STISKNI MEZERNÍK NEBO KLEPNI', 14); }
    }

    function banner(a, b, c) {
        scr.fillCells(3, 6, 26, 6, 7, 1, 1);
        scr.block(24, 48, 208, 48, 0, 0, false);
        DH.drawText(scr, Math.floor((256 - DH.textWidth(a, 2)) / 2), 52, a, 15, 2);
        line(9, b, 15);
        if (c) { line(10, c, 14); }
    }

    function draw() {
        if (state === 'title') {
            drawTitle();
        } else {
            drawCave();
            drawHud();
            if (state === 'paused') { banner('PAUZA', 'P - POKRAČOVAT'); }
            else if (state === 'over') { banner('KONEC HRY', 'SKÓRE ' + pad(score, 6), 'MEZERNÍK = MENU'); }
            else if (state === 'win') { banner('VÍTĚZSTVÍ!', 'SKÓRE ' + pad(score, 6), 'MEZERNÍK = MENU'); }
            else if (state === 'intro') { banner('JESKYNĚ ' + (caveIndex + 1), cave.def.name.toUpperCase(), 'POTŘEBA DIAMANTŮ: ' + cave.need); }
            else if (state === 'complete') { scr.fillCells(1, 7, 30, 3, 7, 1, 1); scr.block(8, 56, 240, 24, 0, 0, false); line(8, 'JESKYNĚ HOTOVA - BONUS ZA ČAS', 15); }
        }
        scr.render(ctx);
    }

    // ---------- vstup ----------
    function press() {
        DH.sound.unlock();
        if (state === 'title') { fireLocked = true; startGame(); }
        else if (state === 'over' || state === 'win') { toTitle(); }
        else if (state === 'intro') { stateTimer = 0; }
    }

    function togglePause() {
        if (state === 'play' || state === 'intro') { prevState = state; state = 'paused'; }
        else if (state === 'paused') { state = prevState; }
    }

    var KEYS = {
        37: 'left', 65: 'left', 39: 'right', 68: 'right', 38: 'up', 87: 'up', 40: 'down', 83: 'down', 32: 'fire', 16: 'fire'
    };

    document.addEventListener('keydown', function (e) {
        var k = KEYS[e.keyCode];
        if (k) {
            e.preventDefault();
            held[k] = true;
            if (k !== 'fire') { pend[k] = true; lastDir = k; }
            if (!e.repeat && (e.keyCode === 32 || e.keyCode === 38 || e.keyCode === 87)) { press(); }
        } else if (e.keyCode === 13) {
            e.preventDefault();
            press();
        } else if (e.keyCode === 80) {
            togglePause();
        } else if (e.keyCode === 77) {
            if (!DH.sound.toggleMute() && state === 'title') { DH.sound.startTune(); }
        } else if (e.keyCode === 82) {
            if (state === 'play') { DH.killPlayer(cave); startDying(); }
        }
        DH.sound.unlock();
    });

    document.addEventListener('keyup', function (e) {
        var k = KEYS[e.keyCode];
        if (k) { held[k] = false; if (k === 'fire') { fireLocked = false; } }
    });

    Array.prototype.forEach.call(document.querySelectorAll('#touch button'), function (b) {
        var act = b.getAttribute('data-act');
        function down(e) {
            e.preventDefault();
            DH.sound.unlock();
            if (act === 'pause') { togglePause(); return; }
            held[act] = true;
            if (act !== 'fire') { pend[act] = true; lastDir = act; }
            press();
        }
        function up(e) { e.preventDefault(); if (act !== 'pause') { held[act] = false; if (act === 'fire') { fireLocked = false; } } }
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    canvas.addEventListener('pointerdown', function () {
        if (state === 'title' || state === 'over' || state === 'win' || state === 'intro') { press(); }
        else if (state === 'paused') { togglePause(); }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && (state === 'play' || state === 'intro')) { prevState = state; state = 'paused'; }
    });

    // ---------- celočíselné měřítko ----------
    function fit() {
        var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        var availH = window.innerHeight - (touch ? 160 : 24);
        var s = Math.min(window.innerWidth / 256, availH / 192);
        s = s >= 1 ? Math.floor(s) : Math.max(0.5, s);
        canvas.style.width = Math.round(256 * s) + 'px';
        canvas.style.height = Math.round(192 * s) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();

    // ---------- smyčka (pevný krok 50 Hz) ----------
    var last = 0, acc = 0, STEP = 20;

    function loop(ts) {
        var dt = Math.min(250, ts - last || 0);
        last = ts;
        if (state !== 'paused') {
            acc += dt;
            while (acc >= STEP) { step(); acc -= STEP; }
        } else {
            acc = 0;
            frame++;
        }
        draw();
        requestAnimationFrame(loop);
    }

    DH.game = {
        _get: function () { return { state: state, cave: cave, score: score, lives: lives, caveIndex: caveIndex, hi: hi, camx: camx, camy: camy }; },
        _step: step, _draw: draw, _held: held, _pend: pend, _press: press, _screen: scr,
        _setCave: function (i) { caveIndex = i; loadCave(); }
    };

    toTitle();
    requestAnimationFrame(loop);
})(window);
