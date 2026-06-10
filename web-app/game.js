/* jshint esversion: 6, browser: true, module: true */
"use strict";

import Labyrinth from "./Labyrinth.js";
import Stats from "./Stats.js";

// ── Asset maps ────────────────────────────────────────────────────────────

const TILE_IMGS = {
    "straight":   "assets/StraighPathPiece.png",
    "corner":     "assets/CornerPathPiece.png",
    "t_junction": "assets/TjunctionPathPiece.png"
};

const HEART_IMGS = {
    "green":  "assets/GreenHeart.png",
    "red":    "assets/RedHeart.png",
    "grey":   "assets/GreyHeart.png",
    "purple": "assets/PurpleHeart.png"
};

const CHAR_IMGS = {
    "1": "assets/EarthCharacter.png",
    "2": "assets/FireCharacter.png",
    "3": "assets/Shadowcharacter.png",
    "4": "assets/WindCharacter.png"
};

const TRANSFORM_IMGS = {
    "1": "assets/Earchtransformed.png",
    "2": "assets/Firetranformed.png",
    "3": "assets/Shadowtransformed.png",
    "4": "assets/Windtransformed.png"
};

const WIN_SVGS = {
    "1": "assets/Earthwin.svg",
    "2": "assets/Firewin.svg",
    "3": "assets/Shadowwin.svg",
    "4": "assets/Windwin.svg"
};

// Player 1→green, 2→red, 3→purple, 4→grey (matches Labyrinth.heart order)
const PLAYER_COLORS = ["green", "red", "purple", "grey"];

// Index matches player number (index 0 unused)
const SPRITE_CLASSES = ["", "earth-walk-sprite", "fire-walk-sprite", "shadow-walk-sprite", "wind-walk-sprite"];
const PLAYER_TOKENS = ["", ".player-1", ".player-2", ".player-3", ".player-4"];

// Per-slot positions [left%, top%, size_px] for 1-4 players sharing a tile.
// Tokens are 62px on a 93px tile so offsets extend slightly outside — tile overflow is visible.
const TILE_POSITIONS = [
    [],
    [[50, 50, 62]],
    [[22, 50, 62], [78, 50, 62]],
    [[22, 25, 62], [78, 25, 62], [50, 75, 62]],
    [[22, 25, 62], [78, 25, 62], [22, 75, 62], [78, 75, 62]]
];

const GLOW_COLORS = {
    "green": "rgba(80, 200, 80, 0.9)",
    "red": "rgba(220, 70, 70, 0.9)",
    "purple": "rgba(170, 80, 220, 0.9)",
    "grey": "rgba(180, 190, 200, 0.9)"
};

// Maps game.html data-dir values to Labyrinth.js shift directions
const DIR_MAP = {
    "top":   "col_down",
    "bot":   "col_up",
    "left":  "row_right",
    "right": "row_left"
};

// ── Game state ────────────────────────────────────────────────────────────

const player_count = Number(sessionStorage.getItem("player_count")) || 2;
let game_state = Labyrinth.new_game(player_count);
let is_animating = false;
let collecting_heart = null;
let spawned_heart_pos = null;

// ── Tile helpers ──────────────────────────────────────────────────────────

const tile_img = function (tile) {
    const src = TILE_IMGS[tile.shape];
    const deg = tile.rotation * 90;
    return "<img src=\"" + src + "\" alt=\"\" style=\"transform: rotate(" + deg + "deg)\">";
};

const tile_heart = function (tile) {
    if (!tile.heart) { return ""; }
    return "<img class=\"tile-heart\" src=\"" + HEART_IMGS[tile.heart] + "\" alt=\"" + tile.heart + " heart\">";
};

// ── Board rendering ───────────────────────────────────────────────────────

const FIRE_W = 43;
const FIRE_H = 62;

const animate_player_move = function (sprite_class, path_rects, on_complete) {
    const sprite = document.createElement("div");
    sprite.className = sprite_class;
    document.body.appendChild(sprite); /*jshint ignore:line*/

    let step = 0;
    const step_dur = 200;

    function do_step() {
        if (step >= path_rects.length - 1) {
            sprite.remove();
            on_complete();
            return;
        }
        const fr = path_rects[step];
        const tr = path_rects[step + 1];
        if (!fr || !tr) {
            step += 1;
            do_step();
            return;
        }

        const from_cx = fr.left + fr.width / 2;
        const from_cy = fr.top + fr.height / 2;
        const to_cx = tr.left + tr.width / 2;
        const to_cy = tr.top + tr.height / 2;
        const dx = to_cx - from_cx;
        const dy = to_cy - from_cy;

        let rot = 0;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                rot = 90;
            } else {
                rot = 270;
            }
        } else if (dy > 0) {
            rot = 180;
        }

        const fx = from_cx - FIRE_W / 2;
        const fy = from_cy - FIRE_H / 2;
        const tx = to_cx - FIRE_W / 2;
        const ty = to_cy - FIRE_H / 2;

        sprite.animate([
            {
                transform: "translate(" + fx + "px," + fy + "px) rotate(" + rot + "deg)"
            },
            {
                transform: "translate(" + tx + "px," + ty + "px) rotate(" + rot + "deg)"
            }
        ], {
            duration: step_dur,
            easing: "linear",
            fill: "forwards"
        }).finished.then(function () {
            step += 1;
            do_step();
        });
    }

    do_step();
};

const animate_heart_collect = function (color, from_rect, to_rect, player, slot_index) {
    const from_x = from_rect.left + from_rect.width / 2;
    const from_y = from_rect.top + from_rect.height / 2;
    const to_x = to_rect.left + to_rect.width / 2;
    const to_y = to_rect.top + to_rect.height / 2;
    const mid_x = (from_x + to_x) / 2;
    const mid_y = Math.min(from_y, to_y) - 120;
    const glow = GLOW_COLORS[color] || "rgba(255,255,200,0.9)";
    const size = 40;

    const el = document.createElement("img");
    el.src = HEART_IMGS[color];
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.zIndex = "9999";
    el.style.pointerEvents = "none";
    el.style.objectFit = "contain";
    document.body.appendChild(el);

    el.animate([
        {
            transform: "translate(" + (from_x - size / 2) + "px," + (from_y - size / 2) + "px) scale(1)",
            filter: "drop-shadow(0 0 8px " + glow + ")"
        },
        {
            transform: "translate(" + (mid_x - size / 2) + "px," + (mid_y - size / 2) + "px) scale(1.4)",
            filter: "drop-shadow(0 0 18px " + glow + ")"
        },
        {
            transform: "translate(" + (to_x - size / 2) + "px," + (to_y - size / 2) + "px) scale(0.8)",
            filter: "drop-shadow(0 0 6px " + glow + ")"
        }
    ], {
        duration: 750,
        easing: "ease-in-out"
    }).finished.then(function () {
        el.remove();
        collecting_heart = null;
        const slots = document.querySelectorAll("#panel_" + player + " .heart_row .heart");
        if (slots[slot_index]) {
            slots[slot_index].src = HEART_IMGS[color];
        }
        if (game_state.winner === player) {
            show_winner(player);
        }
    });
};

const do_heart_anim = function (player, tile_rect, heart_taken) {
    if (!heart_taken || !tile_rect) {
        return;
    }
    let slot_index = 0;
    if (collecting_heart) {
        slot_index = collecting_heart.slot_index;
    }
    const slots = document.querySelectorAll( /*jshint ignore:line*/
        "#panel_" + player + " .heart_row .heart"
    );
    if (slots[slot_index]) {
        animate_heart_collect( /*jshint ignore:line*/
            PLAYER_COLORS[player - 1],
            tile_rect,
            slots[slot_index].getBoundingClientRect(),
            player,
            slot_index
        );
    }
};

const handle_tile_click = function (column, row) {
    if (game_state.phase !== "move" || is_animating) {
        return;
    }
    const new_state = Labyrinth.apply_move(
        game_state.current_player, [column, row], game_state
    );
    if (new_state === undefined) {
        return;
    }

    const player = game_state.current_player;
    const heart_taken = (
        new_state.player_hearts[player - 1].length <
        game_state.player_hearts[player - 1].length
    );

    if (heart_taken) {
        Stats.record_treasure("Player " + player);
    }
    if (new_state.winner !== undefined) {
        Stats.record_home_return("Player " + new_state.winner);
    }

    let tile_rect = null;
    if (heart_taken) {
        const tile_el = document.querySelector( /*jshint ignore:line*/
            "#game_board .tile[data-col=\"" + column + "\"][data-row=\"" + row + "\"]"
        );
        if (tile_el) {
            tile_rect = tile_el.getBoundingClientRect();
        }
        collecting_heart = {
            player: player,
            color: PLAYER_COLORS[player - 1],
            slot_index: Labyrinth.hearts_collected(player, game_state)
        };
        new_state.board.forEach(function (col_tiles, c) {
            col_tiles.forEach(function (tile, r) {
                if (tile.heart && !game_state.board[c][r].heart) {
                    spawned_heart_pos = [c, r];
                }
            });
        });
    }

    // Capture path rects before render() replaces the DOM — all players are animated
    let path_rects = null;
    if (player >= 1 && player <= 4) {
        const path = Labyrinth.find_path(game_state.player_positions[player - 1], [column, row], game_state.board); /*jshint ignore:line*/
        if (path.length > 1) {
            path_rects = path.map(function (pos) {
                let path_tile = document.querySelector( /*jshint ignore:line*/
                    "#game_board .tile[data-col=\"" + pos[0] + "\"][data-row=\"" + pos[1] + "\"]"
                );
                if (path_tile) {
                    return path_tile.getBoundingClientRect();
                }
                return null;
            });
        }
    }

    game_state = new_state;
    render(); /*jshint ignore:line*/

    if (player >= 1 && player <= 4 && path_rects) {
        is_animating = true;
        const token_sel = PLAYER_TOKENS[player];
        const dest_tile = document.querySelector( /*jshint ignore:line*/
            "#game_board .tile[data-col=\"" + column + "\"][data-row=\"" + row + "\"]"
        );
        if (dest_tile && dest_tile.querySelector(token_sel)) {
            dest_tile.querySelector(token_sel).style.visibility = "hidden";
        }
        animate_player_move(SPRITE_CLASSES[player], path_rects, function () { /*jshint ignore:line*/
            is_animating = false;
            const fin_tile = document.querySelector( /*jshint ignore:line*/
                "#game_board .tile[data-col=\"" + column + "\"][data-row=\"" + row + "\"]"
            );
            if (fin_tile && fin_tile.querySelector(token_sel)) {
                fin_tile.querySelector(token_sel).style.visibility = "visible";
            }
            do_heart_anim(player, tile_rect, heart_taken); /*jshint ignore:line*/
        });
    } else {
        do_heart_anim(player, tile_rect, heart_taken); /*jshint ignore:line*/
    }
};

const render_board = function () {
    const board_el = document.getElementById("game_board");
    if (!board_el) { return; }
    board_el.classList.toggle("phase-move", game_state.phase === "move");
    [1, 2, 3, 4].forEach(function (i) {
        board_el.classList.toggle("player-" + i + "-turn", i === game_state.current_player);
    });
    board_el.innerHTML = "";

    const reachable_set = new Set();
    if (game_state.phase === "move") {
        const pos = game_state.player_positions[game_state.current_player - 1];
        Labyrinth.reachable_positions(pos, game_state.board).forEach(function (p) {
            reachable_set.add(p[0] + "," + p[1]);
        });
    }

    let row = 0;
    while (row < Labyrinth.board_size) {
        let col = 0;
        while (col < Labyrinth.board_size) {
            const tile = game_state.board[col][row];
            const el = document.createElement("div");
            el.className = "tile";
            el.dataset.col = col;
            el.dataset.row = row;

            let overlay = "";
            let on_tile = [];
            game_state.player_positions.forEach(function (p, idx) {
                if (p[0] === col && p[1] === row) {
                    on_tile.push(idx + 1);
                }
            });
            let pos_set = TILE_POSITIONS[on_tile.length] || TILE_POSITIONS[1];
            on_tile.forEach(function (pnum, slot) {
                let tpos = pos_set[slot];
                overlay += "<img class=\"player-token player-" + pnum + "\" src=\"" + CHAR_IMGS[String(pnum)] + "\" alt=\"Player " + pnum + "\" style=\"width:" + tpos[2] + "px;height:" + tpos[2] + "px;top:" + tpos[1] + "%;left:" + tpos[0] + "%\">";
            });

            el.innerHTML = "<div class=\"tile-clip\">" + tile_img(tile) + tile_heart(tile) + "</div>" + overlay;

            if (spawned_heart_pos && col === spawned_heart_pos[0] && row === spawned_heart_pos[1]) {
                if (el.querySelector(".tile-heart")) {
                    el.querySelector(".tile-heart").classList.add("spawning");
                }
                spawned_heart_pos = null;
            }

            if (reachable_set.has(col + "," + row)) {
                el.classList.add("reachable");
                el.addEventListener("click", (function (c, r) {
                    return function () { handle_tile_click(c, r); };
                }(col, row)));
            }

            board_el.appendChild(el);
            col += 1;
        }
        row += 1;
    }
};

// ── Spare tile ────────────────────────────────────────────────────────────

const rotate_spare = function () {
    if (game_state.phase !== "shift") { return; }
    game_state = Object.freeze(
        Object.assign({}, game_state, {
            spare_tile: Labyrinth.rotate_tile(game_state.spare_tile)
        })
    );
    render();
};

const render_spare_tile = function () {
    const el = document.getElementById("spare_tile");
    if (!el) { return; }
    const tile_el = document.createElement("div");
    tile_el.className = "tile";
    tile_el.innerHTML = tile_img(game_state.spare_tile) + tile_heart(game_state.spare_tile);
    tile_el.style.cursor = game_state.phase === "shift" ? "pointer" : "default";
    tile_el.onclick = game_state.phase === "shift" ? rotate_spare : null;
    el.classList.toggle("shift_active", game_state.phase === "shift");
    el.innerHTML = "";
    el.appendChild(tile_el);
};

// ── Push arrows ───────────────────────────────────────────────────────────

const handle_shift = function (direction, index) {
    if (is_animating) { return; }
    is_animating = true;

    const shift = { direction: direction, index: index };
    const size = 93;
    const duration = 600;
    let attr = "";
    let dx = 0;
    let dy = 0;
    if (direction === "row_right") { attr = "row"; dx =  size; }
    if (direction === "row_left")  { attr = "row"; dx = -size; }
    if (direction === "col_down")  { attr = "col"; dy =  size; }
    if (direction === "col_up")    { attr = "col"; dy = -size; }

    const board_el = document.getElementById("game_board");
    if (board_el && attr) {
        board_el.querySelectorAll(".tile[data-" + attr + "=\"" + index + "\"]").forEach(
            function (tile) {
                tile.style.transition = "transform " + duration + "ms ease";
                tile.style.transform = "translate(" + dx + "px, " + dy + "px)";
            }
        );
    }

    setTimeout(function () {
        is_animating = false;
        const new_state = Labyrinth.apply_shift(shift, game_state);
        if (new_state !== undefined) {
            game_state = new_state;
            render();
        }
    }, duration);
};

const render_arrows = function () {
    const valid = game_state.phase === "shift"
        ? Labyrinth.valid_shifts(game_state)
        : [];

    document.querySelectorAll(".push_arrow").forEach(function (arrow) {
        const direction = DIR_MAP[arrow.dataset.dir];
        const index = Number(
            arrow.dataset.col !== undefined ? arrow.dataset.col : arrow.dataset.row
        );
        const legal = valid.some(function (s) {
            return s.direction === direction && s.index === index;
        });
        arrow.classList.toggle("shift_active", legal);
        arrow.style.opacity = legal ? "1" : "0.3";
        arrow.style.pointerEvents = legal ? "auto" : "none";
        arrow.onclick = legal
            ? (function (d, i) { return function () { handle_shift(d, i); }; }(direction, index))
            : null;
    });
};

// ── Win animation ─────────────────────────────────────────────────────────

function show_win_ui(player) {
    const screen_el = document.getElementById( /*jshint ignore:line*/
        "game_screen"
    );
    if (!screen_el) {
        return;
    }
    /* jshint ignore:start */
    const page_loc = window.location;
    /* jshint ignore:end */
    const ui = document.createElement( /*jshint ignore:line*/
        "div"
    );
    ui.id = "win_ui";
    ui.innerHTML = "<img class=\"win-svg\" src=\"" + WIN_SVGS[String(player)] + "\" alt=\"\">"
            + "<div class=\"win-btn-row\">"
            + "<button class=\"win-btn\" id=\"win_play_btn\">Play Again</button>"
            + "<button class=\"win-btn\" id=\"win_menu_btn\">Menu</button>"
            + "</div>";
    screen_el.appendChild(ui);
    const play_btn = document.getElementById( /*jshint ignore:line*/
        "win_play_btn"
    );
    if (play_btn) {
        play_btn.addEventListener("click", function () {
            page_loc.reload();
        });
    }
    const menu_btn = document.getElementById( /*jshint ignore:line*/
        "win_menu_btn"
    );
    if (menu_btn) {
        menu_btn.addEventListener("click", function () {
            page_loc.href = "index.html";
        });
    }
}

function trigger_transform(player, panel, char_img) {
    // Overlay the new character behind the old one
    const new_img = document.createElement( /*jshint ignore:line*/
        "img"
    );
    new_img.src = TRANSFORM_IMGS[String(player)];
    new_img.className = "panel_character";
    panel.insertBefore(new_img, char_img); // old char stays on top initially

    // Old character: quick flash to white, then slow fade out
    char_img.animate([
        {
            filter: "brightness(1)",
            opacity: 1
        },
        {
            filter: "brightness(6) saturate(0)",
            opacity: 1,
            offset: 0.2
        },
        {
            filter: "brightness(6) saturate(0)",
            opacity: 0
        }
    ], {
        duration: 1600,
        easing: "ease-in-out",
        fill: "forwards"
    });

    // New character: slow fade in through the flash, then slow dim to normal
    new_img.animate([
        {
            filter: "brightness(6)",
            opacity: 0
        },
        {
            filter: "brightness(3)",
            opacity: 1,
            offset: 0.5
        },
        {
            filter: "brightness(1)",
            opacity: 1
        }
    ], {
        duration: 1600,
        delay: 400,
        easing: "ease-out",
        fill: "both"
    }).finished.then(function () {
        char_img.remove();
        panel.querySelectorAll(".heart").forEach(function (h) {
            h.style.display = "none";
        });
        // Dim the panel back to normal brightness after transformation
        panel.animate([
            {
                filter: "brightness(1.6) drop-shadow(0 0 50px rgba(255, 230, 100, 0.9))"
            },
            {
                filter: "brightness(1) drop-shadow(0 0 20px rgba(255, 230, 100, 0.3))"
            }
        ], {
            duration: 1200,
            easing: "ease-out",
            fill: "forwards"
        });
        show_win_ui(player);
    });
}

function show_winner(player) {
    const panel = document.getElementById( /*jshint ignore:line*/
        "panel_" + player
    );
    const screen_el = document.getElementById("game_screen"); /*jshint ignore:line*/
    if (!panel || !screen_el) {
        return;
    }

    const panel_rect = panel.getBoundingClientRect(); /*jshint ignore:line*/
    const screen_rect = screen_el.getBoundingClientRect(); /*jshint ignore:line*/
    const css_scale = screen_rect.width / 1440;

    const sx = (panel_rect.left - screen_rect.left) / css_scale;
    const sy = (panel_rect.top - screen_rect.top) / css_scale;
    const pw = panel_rect.width / css_scale;
    const ph = panel_rect.height / css_scale;

    screen_el.appendChild(panel); /*jshint ignore:line*/
    panel.style.left = sx + "px";
    panel.style.top = sy + "px";
    panel.style.margin = "0";

    const dx = (720 - pw / 2) - sx;
    const dy = (416 - ph / 2) - sy;
    panel.style.setProperty("--win-dx", dx + "px");
    panel.style.setProperty("--win-dy", dy + "px");
    panel.classList.add("panel-winner");

    // After panel animation settles, absorb the hearts into the character
    const color = PLAYER_COLORS[player - 1];
    setTimeout(function () { /*jshint ignore:line*/
        const char_img = panel.querySelector(".panel_character");
        const heart_slots = panel.querySelectorAll(".heart");
        if (!char_img || !heart_slots.length) {
            return;
        }
        const char_rect = char_img.getBoundingClientRect(); /*jshint ignore:line*/
        const cx = char_rect.left + char_rect.width / 2;
        const cy = char_rect.top + char_rect.height / 2;
        let arrived = 0;
        const total = heart_slots.length;
        heart_slots.forEach(function (slot, idx) {
            let sr = slot.getBoundingClientRect(); /*jshint ignore:line*/
            let hx = sr.left + sr.width / 2;
            let hy = sr.top + sr.height / 2;
            let sz = 130;
            let fly = document.createElement( /*jshint ignore:line*/
                "img"
            );
            fly.src = HEART_IMGS[color];
            fly.style.cssText = "position:fixed;left:0;top:0;width:" + sz + "px;height:" + sz + "px;z-index:10001;pointer-events:none;object-fit:contain;";
            document.body.appendChild(fly); /*jshint ignore:line*/
            slot.style.visibility = "hidden";
            fly.animate([
                {
                    transform: "translate(" + (hx - sz / 2) + "px," + (hy - sz / 2) + "px) scale(1)",
                    filter: "drop-shadow(0 0 10px " + (GLOW_COLORS[color] || "white") + ")",
                    opacity: 1
                },
                {
                    transform: "translate(" + (cx - sz / 2) + "px," + (cy - sz / 2) + "px) scale(1)",
                    filter: "drop-shadow(0 0 30px white) brightness(2)",
                    opacity: 0
                }
            ], {
                duration: 380,
                delay: idx * 130,
                easing: "ease-in",
                fill: "both"
            }).finished.then(function () {
                fly.remove();
                arrived += 1;
                if (arrived === total) {
                    trigger_transform(player, panel, char_img);
                }
            });
        });
    }, 950);
}


// ── Player panels ─────────────────────────────────────────────────────────

const render_players = function () {
    document.querySelectorAll(".player_panel").forEach(function (panel) {
        const p = Number(panel.dataset.player);
        if (p > game_state.player_count) {
            panel.style.display = "none";
            return;
        }
        panel.style.display = "";
        panel.classList.toggle("active_player", p === game_state.current_player);

        const color = PLAYER_COLORS[p - 1];
        const collected = Labyrinth.hearts_collected(p, game_state);
        let flight_slot = -1;
        if (collecting_heart !== null && collecting_heart.player === p) {
            flight_slot = collecting_heart.slot_index;
        }
        const heart_row = panel.querySelector(".heart_row");
        if (heart_row) {
            heart_row.querySelectorAll(".heart").forEach(function (slot, idx) {
                let filled = idx < collected && idx !== flight_slot;
                slot.src = filled
                    ? HEART_IMGS[color]
                    : "assets/HeartSlot.png";
                slot.classList.toggle("glowing", filled && collected === 3);
            });
        }
    });
};

// ── Scale screen ──────────────────────────────────────────────────────────

const scale_screen = function () {
    const screen = document.getElementById("game_screen");
    if (!screen) { return; }
    const scale = Math.min(window.innerWidth / 1440, window.innerHeight / 832);
    const tx = (window.innerWidth - 1440 * scale) / 2;
    const ty = (window.innerHeight - 832 * scale) / 2;
    screen.style.transform = "scale(" + scale + ")";
    screen.style.left = tx + "px";
    screen.style.top = ty + "px";
};

// ── Master render ─────────────────────────────────────────────────────────

const render = function () {
    render_board();
    render_spare_tile();
    render_arrows();
    render_players();
};

// ── Events ────────────────────────────────────────────────────────────────

document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        rotate_spare();
    }
});

window.addEventListener("resize", scale_screen);

// ── Init ──────────────────────────────────────────────────────────────────

scale_screen();
render();
