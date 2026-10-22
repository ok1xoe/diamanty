// Vlastní sprity 8x8 (řetězce, X = bod). Vše kresleno kódem, žádné obrázky.
(function (root) {
    'use strict';

    var DH = root.DH = root.DH || {};

    DH.SPR = {
        dirt: ['........', '.X...X..', '....X...', 'X.......', '..X...X.', '......X.', '.X..X...', '...X...X'],
        rock: ['..XXXX..', '.XXXXXX.', 'XXX.XXXX', 'XXXXXXXX', 'XXXXXX.X', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'],
        steel: ['XXXXXXXX', 'X.XXXX.X', 'XX.XX.XX', 'XXX..XXX', 'XXX..XXX', 'XX.XX.XX', 'X.XXXX.X', 'XXXXXXXX'],
        brick: ['XXX.XXXX', 'XXX.XXXX', '........', 'XXXXXX.X', 'XXXXXX.X', '........', 'XXX.XXXX', 'XXX.XXXX'],
        diamond: [
            ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '........'],
            ['...XX...', '..X..X..', '.X.XX.X.', 'XXXXXXXX', '.X.XX.X.', '..X..X..', '...XX...', '........']
        ],
        door: ['XXXXXXXX', 'X......X', 'X.XXXX.X', 'X.X..X.X', 'X.X..X.X', 'X.XXXX.X', 'X......X', 'XXXXXXXX'],
        exit: ['..XXXX..', '.X....X.', 'X..XX..X', 'X.XXXX.X', 'X..XX..X', 'X..XX..X', '.X....X.', '..XXXX..'],
        magic: [['X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X'],
                ['.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.', '.X.X.X.X', 'X.X.X.X.']],
        fire: [
            ['...XX...', '.X.XX.X.', '..XXXX..', 'XXXXXXXX', 'XXXXXXXX', '..XXXX..', '.X.XX.X.', '...XX...'],
            ['..X..X..', '...XX...', '.XXXXXX.', '.XXXXXX.', '.XXXXXX.', '.XXXXXX.', '...XX...', '..X..X..']
        ],
        butt: [
            ['XX....XX', 'XXX..XXX', 'XXXXXXXX', '.XXXXXX.', '.XXXXXX.', 'XXXXXXXX', 'XXX..XXX', 'XX....XX'],
            ['........', 'XX....XX', 'XXX..XXX', '.XXXXXX.', '.XXXXXX.', 'XXX..XXX', 'XX....XX', '........']
        ],
        amoeba: [
            ['..XXX...', '.XXXXX..', 'XXX.XXX.', 'XXXXXXXX', '.XXX.XXX', 'XXXXXXX.', '.XXXXX..', '..X.X...'],
            ['...XX...', '.XXXXXX.', 'XX.XXXXX', 'XXXXXX.X', 'XXXXXXXX', '.XX.XXX.', '.XXXXXX.', '...XX...']
        ],
        boom: [
            ['........', '........', '...XX...', '..XXXX..', '..XXXX..', '...XX...', '........', '........'],
            ['..X..X..', '...XX...', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '...XX...', '..X..X..'],
            ['X.X..X.X', '.X.XX.X.', 'X.X..X.X', '..X..X..', '..X..X..', 'X.X..X.X', '.X.XX.X.', 'X.X..X.X']
        ],
        // havíř: helma s lampou, 3 fáze (stoj, krok A, krok B)
        player: [
            ['..XXXX..', '.XXXXXX.', '..X..X..', '..XXXX..', '.XXXXXX.', 'X.XXXX.X', '..X..X..', '.XX..XX.'],
            ['..XXXX..', '.XXXXXX.', '..X..X..', '..XXXX..', '.XXXXXX.', 'X.XXXX.X', '..XXX...', '.XX.XX..'],
            ['..XXXX..', '.XXXXXX.', '..X..X..', '..XXXX..', '.XXXXXX.', 'X.XXXX.X', '...XXX..', '..XX.XX.']
        ]
    };
})(typeof window !== 'undefined' ? window : globalThis);
