/*jslint browser */
import Labyrinth from "./Labyrinth.js";
import Stats from "./Stats.js";

// This file contains the code for the main game screen. 
// It handles rendering the game board, player panels, 
// and animations for player movement and heart collection.
// It uses the Labyrinth module to manage the game state 
// and the Stats module to record player statistics.

// image paths.
const tile_imgs = {
    "straight": "assets/StraighPathPiece.png",
    "corner": "assets/CornerPathPiece.png",
    "t_junction": "assets/TjunctionPathPiece.png"
};

const heart_imgs = {
    "green": "assets/GreenHeart.png",
    "red": "assets/RedHeart.png",
    "grey": "assets/GreyHeart.png",
    "purple": "assets/PurpleHeart.png"
};

const char_imgs = {
    "1": "assets/EarthCharacter.png",
    "2": "assets/FireCharacter.png",
    "3": "assets/Shadowcharacter.png",
    "4": "assets/WindCharacter.png"
};

const transform_imgs = {
    "1": "assets/Earthtransformed.png",
    "2": "assets/Firetranformed.png",
    "3": "assets/Shadowtransformed.png",
    "4": "assets/Windtransformed.png"
};

const win_svgs = {
    "1": "assets/Earthwin.svg",
    "2": "assets/Firewin.svg",
    "3": "assets/Shadowwin.svg",
    "4": "assets/Windwin.svg"
};

const player_colours = Labyrinth.heart;

const sprite_classes = [
    "",
    "earth-walk-sprite",
    "fire-walk-sprite",
    "shadow-walk-sprite",
    "wind-walk-sprite"
];

const player_tokens = [
    "",
    ".player-1",
    ".player-2",
    ".player-3",
    ".player-4"
];

// player token positions when more than one player is on a tile.
const tile_positions = [
    [],
    [[50, 50, 62]],
    [[22, 50, 62], [78, 50, 62]],
    [[22, 25, 62], [78, 25, 62], [50, 75, 62]],
    [[22, 25, 62], [78, 25, 62], [22, 75, 62], [78, 75, 62]]
];

const glow_colours = {
    "green": "rgba(80, 200, 80, 0.9)",
    "red": "rgba(220, 70, 70, 0.9)",
    "purple": "rgba(170, 80, 220, 0.9)",
    "grey": "rgba(180, 190, 200, 0.9)"
};

// Directions used by the arrow buttons.
const direction_map = {
    "top": "column_down",
    "bot": "column_up",
    "left": "row_right",
    "right": "row_left"
};

// current game state
const player_count = Number(sessionStorage.getItem("player_count")) || 2;
let game_state = Labyrinth.new_game(player_count);
let is_animating = false;
let collecting_heart = null;
let spawned_heart_pos = null;

/**
 * Returns an HTML img string for a tile's path image, rotated to match the tile.
 * @function
 * @param {Labyrinth.Tile} tile The tile to render.
 * @returns {string} An HTML img element string.
 */
const tile_img = function (tile) {
    const src = tile_imgs[tile.shape];
    const degrees = tile.rotation * 90;

    return (
        "<img src=\"" +
        src +
        "\" alt=\"\" style=\"transform: rotate(" +
        degrees +
        "deg)\">"
    );
};

/**
 * Returns an HTML img string for a tile's heart, or an empty string if none.
 * @function
 * @param {Labyrinth.Tile} tile The tile to render.
 * @returns {string} An HTML img element string, or empty string.
 */
const tile_heart = function (tile) {
    if (!tile.heart) {
        return "";
    }

    return (
        "<img class=\"tile-heart\" src=\"" +
        heart_imgs[tile.heart] +
        "\" alt=\"" +
        tile.heart +
        " heart\">"
    );
};
// animate sprite moving.
const sprite_width = 43;
const sprite_height = 62;

/**
 * Animates a player sprite walking along a path of tile positions.
 * @function
 * @param {string} sprite_class The CSS class for the character sprite.
 * @param {DOMRect[]} path_rects Bounding rects for each tile along the path.
 * @param {Function} on_complete Callback fired when the animation finishes.
 */
const animate_player_move = function (sprite_class, path_rects, on_complete) {
    const sprite = document.createElement("div");
    sprite.className = sprite_class;
    document.body.appendChild(sprite);

    let step = 0;
    const step_duration = 200;

    function do_step() {
        if (step >= path_rects.length - 1) {
            sprite.remove();
            on_complete();
            return;
        }

        const from_rect = path_rects[step];
        const to_rect = path_rects[step + 1];

        if (!from_rect || !to_rect) {
            step += 1;
            do_step();
            return;
        }

        const from_centre_x = from_rect.left + from_rect.width / 2;
        const from_centre_y = from_rect.top + from_rect.height / 2;
        const to_centre_x = to_rect.left + to_rect.width / 2;
        const to_centre_y = to_rect.top + to_rect.height / 2;

        const dx = to_centre_x - from_centre_x;
        const dy = to_centre_y - from_centre_y;

        let rotation = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                rotation = 90;
            } else {
                rotation = 270;
            }
        } else if (dy > 0) {
            rotation = 180;
        }

        const from_x = from_centre_x - sprite_width / 2;
        const from_y = from_centre_y - sprite_height / 2;
        const to_x = to_centre_x - sprite_width / 2;
        const to_y = to_centre_y - sprite_height / 2;

        sprite.animate([
            {
                transform: (
                    "translate(" +
                    from_x +
                    "px," +
                    from_y +
                    "px) rotate(" +
                    rotation +
                    "deg)"
                )
            },
            {
                transform: (
                    "translate(" +
                    to_x +
                    "px," +
                    to_y +
                    "px) rotate(" +
                    rotation +
                    "deg)"
                )
            }
        ], {
            duration: step_duration,
            easing: "linear",
            fill: "forwards"
        }).finished.then(function () {
            step += 1;
            do_step();
        });
    }

    do_step();
};

// animate a heart being collected and placed in the player's panel.
const animate_heart_collect = function (
    colour,
    from_rect,
    to_rect,
    player,
    slot_index
) {
    const from_x = from_rect.left + from_rect.width / 2;
    const from_y = from_rect.top + from_rect.height / 2;
    const to_x = to_rect.left + to_rect.width / 2;
    const to_y = to_rect.top + to_rect.height / 2;
    const mid_x = (from_x + to_x) / 2;
    const mid_y = Math.min(from_y, to_y) - 120;
    const glow = glow_colours[colour] || "rgba(255,255,200,0.9)";
    const size = 40;

    const img = document.createElement("img");
    img.src = heart_imgs[colour];
    img.style.position = "fixed";
    img.style.left = "0";
    img.style.top = "0";
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.style.zIndex = "9999";
    img.style.pointerEvents = "none";
    img.style.objectFit = "contain";
    document.body.appendChild(img);

    img.animate([
        {
            transform: (
                "translate(" +
                (from_x - size / 2) +
                "px," +
                (from_y - size / 2) +
                "px) scale(1)"
            ),
            filter: "drop-shadow(0 0 8px " + glow + ")"
        },
        {
            transform: (
                "translate(" +
                (mid_x - size / 2) +
                "px," +
                (mid_y - size / 2) +
                "px) scale(1.4)"
            ),
            filter: "drop-shadow(0 0 18px " + glow + ")"
        },
        {
            transform: (
                "translate(" +
                (to_x - size / 2) +
                "px," +
                (to_y - size / 2) +
                "px) scale(0.8)"
            ),
            filter: "drop-shadow(0 0 6px " + glow + ")"
        }
    ], {
        duration: 750,
        easing: "ease-in-out"
    }).finished.then(function () {
        img.remove();
        collecting_heart = null;

        const slots = document.querySelectorAll(
            "#panel_" + player + " .heart_row .heart"
        );

        if (slots[slot_index]) {
            slots[slot_index].src = heart_imgs[colour];
            if (game_state.winner === player) {
                slots[slot_index].classList.add("glowing");
            }
        }

        if (game_state.winner === player) {
            show_winner(player);
        }
    });
};

/**
 * Triggers the heart collection animation if a heart was taken this move.
 * @function
 * @param {Labyrinth.Player} player The player who moved.
 * @param {DOMRect} tile_rect Bounding rect of the tile the heart was on.
 * @param {boolean} heart_taken Whether a heart was collected this move.
 */
const do_heart_anim = function (player, tile_rect, heart_taken) {
    if (!heart_taken || !tile_rect) {
        return;
    }

    let slot_index = 0;

    if (collecting_heart) {
        slot_index = collecting_heart.slot_index;
    }

    const slots = document.querySelectorAll(
        "#panel_" + player + " .heart_row .heart"
    );

    if (slots[slot_index]) {
        animate_heart_collect(
            player_colours[player - 1],
            tile_rect,
            slots[slot_index].getBoundingClientRect(),
            player,
            slot_index
        );
    }
};

/**
 * Handles a tile click during the move phase, applying the move and
 * triggering any walk or heart-collect animations.
 * @function
 * @param {number} column The column index of the clicked tile.
 * @param {number} row The row index of the clicked tile.
 */
const handle_tile_click = function (column, row) {
    if (game_state.phase !== "move" || is_animating) {
        return;
    }

    const new_state = Labyrinth.apply_move(
        game_state.current_player,
        [column, row],
        game_state
    );

    if (new_state === undefined) {
        return;
    }

    const player = game_state.current_player;
    // compare the old state to the new state to see if a heart was collected. 
    const heart_taken = (
        new_state.player_hearts[player - 1] >
        game_state.player_hearts[player - 1]
    );

    if (heart_taken) {
        Stats.record_heart("Player " + player);
    }

    let tile_rect = null;

    // Save the screen position of the tile for the heart animation.
    if (heart_taken) {
        const tile_el = document.querySelector(
            "#game_board .tile[data-column=\"" +
            column +
            "\"][data-row=\"" +
            row +
            "\"]"
        );

        if (tile_el) {
            tile_rect = tile_el.getBoundingClientRect();
        }

        collecting_heart = {
            player: player,
            colour: player_colours[player - 1],
            slot_index: Labyrinth.hearts_collected(player, game_state)
        };
        
        spawned_heart_pos = new_state.spawned_heart_pos;
    }

    let path_rects = null;

    // Get the screen positions of each tile in the movement path.
    if (player >= 1 && player <= 4) {
        const path = Labyrinth.find_path(
            game_state.player_positions[player - 1],
            [column, row],
            game_state.board
        );

        if (path.length > 1) {
            path_rects = path.map(function (pos) {
                const path_tile = document.querySelector(
                    "#game_board .tile[data-column=\"" +
                    pos[0] +
                    "\"][data-row=\"" +
                    pos[1] +
                    "\"]"
                );

                if (path_tile) {
                    return path_tile.getBoundingClientRect();
                }

                return null;
            });
        }
    }

    game_state = new_state;
    render();

    if (player >= 1 && player <= 4 && path_rects) {
        is_animating = true;

        const token_selector = player_tokens[player];
        const dest_tile = document.querySelector(
            "#game_board .tile[data-column=\"" +
            column +
            "\"][data-row=\"" +
            row +
            "\"]"
        );

        if (dest_tile && dest_tile.querySelector(token_selector)) {
            dest_tile.querySelector(token_selector).style.visibility = "hidden";
        }

        animate_player_move(
            sprite_classes[player],
            path_rects,
            function () {
                is_animating = false;

                const final_tile = document.querySelector(
                    "#game_board .tile[data-column=\"" +
                    column +
                    "\"][data-row=\"" +
                    row +
                    "\"]"
                );

                if (final_tile && final_tile.querySelector(token_selector)) {
                    final_tile.querySelector(
                        token_selector
                    ).style.visibility = "visible";
                }

                do_heart_anim(player, tile_rect, heart_taken);
            }
        );
    } else {
        do_heart_anim(player, tile_rect, heart_taken);
    }
};

/**
 * Rebuilds the game board DOM from the current game state, marking
 * reachable tiles and attaching click listeners during the move phase.
 * @function
 */
const render_board = function () {
    const board_el = document.getElementById("game_board");

    if (!board_el) {
        return;
    }

    board_el.classList.toggle("phase-move", game_state.phase === "move");

    [1, 2, 3, 4].forEach(function (player_number) {
        board_el.classList.toggle(
            "player-" + player_number + "-turn",
            player_number === game_state.current_player
        );
    });

    board_el.innerHTML = "";

    // find which tiles are reachable by the current player.
    const reachable_set = new Set();

    if (game_state.phase === "move") {
        const position = game_state.player_positions[
            game_state.current_player - 1
        ];

        Labyrinth.reachable_positions(
            position,
            game_state.board
        ).forEach(function (pos) {
            reachable_set.add(pos[0] + "," + pos[1]);
        });
    }

    let row = 0;

    // Loop through the board and create tile elements for each position.
    while (row < Labyrinth.board_size) {
        let column = 0;

        while (column < Labyrinth.board_size) {
            const tile = game_state.board[column][row];
            const tile_el = document.createElement("div");

            tile_el.className = "tile";
            tile_el.dataset.column = column;
            tile_el.dataset.row = row;

            //add player tokens to the tile.
            let overlay = "";
            const on_tile = [];

            game_state.player_positions.forEach(function (pos, index) {
                if (pos[0] === column && pos[1] === row) {
                    on_tile.push(index + 1);
                }
            });

            const pos_set = tile_positions[on_tile.length] || tile_positions[1];

            on_tile.forEach(function (player_number, slot) {
                const pos = pos_set[slot];

                overlay += (
                    "<img class=\"player-token player-" +
                    player_number +
                    "\" src=\"" +
                    char_imgs[String(player_number)] +
                    "\" alt=\"Player " +
                    player_number +
                    "\" style=\"width:" +
                    pos[2] +
                    "px;height:" +
                    pos[2] +
                    "px;top:" +
                    pos[1] +
                    "%;left:" +
                    pos[0] +
                    "%\">"
                );
            });

            tile_el.innerHTML = (
                "<div class=\"tile-clip\">" +
                tile_img(tile) +
                tile_heart(tile) +
                "</div>" +
                overlay
            );

            // If a heart was spawned on this tile, 
            // add a "spawning" class to the heart image to trigger the fade in animation.
            if (
                spawned_heart_pos &&
                column === spawned_heart_pos[0] &&
                row === spawned_heart_pos[1]
            ) {
                if (tile_el.querySelector(".tile-heart")) {
                    tile_el.querySelector(".tile-heart").classList.add(
                        "spawning"
                    );
                }

                spawned_heart_pos = null;
            }

            // makes the reachable tiles clickable.
            if (reachable_set.has(column + "," + row)) {
                tile_el.classList.add("reachable");

                tile_el.addEventListener("click", (function (c, r) {
                    return function () {
                        handle_tile_click(c, r);
                    };
                }(column, row)));
            }

            board_el.appendChild(tile_el);
            column += 1;
        }

        row += 1;
    }
};

/**
 * Rotates the spare tile 90° clockwise if it is the shift phase.
 * @function
 */
const rotate_spare = function () {
    if (game_state.phase !== "shift") {
        return;
    }

    game_state = Object.freeze(
        Object.assign({}, game_state, {
            spare_tile: Labyrinth.rotate_tile(game_state.spare_tile)
        })
    );

    render();
};

/**
 * Renders the spare tile panel and wires up the rotate-on-click handler.
 * @function
 */
const render_spare_tile = function () {
    const spare_el = document.getElementById("spare_tile");

    if (!spare_el) {
        return;
    }

    const tile_el = document.createElement("div");
    tile_el.className = "tile";
    tile_el.innerHTML = tile_img(game_state.spare_tile) +
        tile_heart(game_state.spare_tile);
    tile_el.style.cursor = game_state.phase === "shift"
        ? "pointer"
        : "default";
    tile_el.onclick = game_state.phase === "shift"
        ? rotate_spare
        : null;

    spare_el.classList.toggle("shift_active", game_state.phase === "shift");
    spare_el.innerHTML = "";
    spare_el.appendChild(tile_el);
};

/**
 * Animates tiles sliding when a push arrow is clicked, then applies the shift
 * to the game state.
 * @function
 * @param {string} direction The shift direction (e.g. "column_down").
 * @param {number} index The row or column index being shifted.
 */
const handle_shift = function (direction, index) {
    if (is_animating) {
        return;
    }

    is_animating = true;

    // Animate the pushed row or column before applying the shift to the game state.
    const shift = {
        direction: direction,
        index: index
    };

    const size = 93;
    const duration = 600;
    let attr = "";
    let dx = 0;
    let dy = 0;

    if (direction === "row_right") {
        attr = "row";
        dx = size;
    }

    if (direction === "row_left") {
        attr = "row";
        dx = -size;
    }

    if (direction === "column_down") {
        attr = "column";
        dy = size;
    }

    if (direction === "column_up") {
        attr = "column";
        dy = -size;
    }

    const board_el = document.getElementById("game_board");

    if (board_el && attr) {
        board_el.querySelectorAll(
            ".tile[data-" + attr + "=\"" + index + "\"]"
        ).forEach(function (tile) {
            tile.style.transition = "transform " + duration + "ms ease";
            tile.style.transform = "translate(" + dx + "px, " + dy + "px)";
        });
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

// Enable all push arrows during the shift phase.
/**
 * Updates push arrow visibility and click handlers based on which shifts
 * are legal in the current game state.
 * @function
 */
const render_arrows = function () {
    const active = game_state.phase === "shift";

    document.querySelectorAll(".push_arrow").forEach(function (arrow) {
        const direction = direction_map[arrow.dataset.dir];
        const index = Number(
            arrow.dataset.column !== undefined
            ? arrow.dataset.column
            : arrow.dataset.row
        );

        arrow.classList.toggle("shift_active", active);
        arrow.style.opacity = active ? "1" : "0.3";
        arrow.style.pointerEvents = active ? "auto" : "none";

        arrow.onclick = (
            active
            ? (function (d, i) {
                return function () {
                    handle_shift(d, i);
                };
            }(direction, index))
            : null
        );
    });
};

// Update the player panels to show the current players(hides unused ones), 
// updates collected hearts, and highlights player panel of active player.
/**
 * Updates each player panel to show collected hearts and highlights the
 * active player.
 * @function
 */
const render_players = function () {
    document.querySelectorAll(".player_panel").forEach(function (panel) {
        const player_number = Number(panel.dataset.player);

        if (player_number > game_state.player_count) {
            panel.style.display = "none";
            return;
        }

        panel.style.display = "";
        panel.classList.toggle(
            "active_player",
            player_number === game_state.current_player
        );

        const colour = player_colours[player_number - 1];
        const collected = Labyrinth.hearts_collected(
            player_number,
            game_state
        );

        let flight_slot = -1;

        if (
            collecting_heart !== null &&
            collecting_heart.player === player_number
        ) {
            flight_slot = collecting_heart.slot_index;
        }

        const heart_row = panel.querySelector(".heart_row");

        if (heart_row) {
            heart_row.querySelectorAll(".heart").forEach(function (
                slot,
                index
            ) {
                const filled = index < collected && index !== flight_slot;

                slot.src = (
                    filled
                    ? heart_imgs[colour]
                    : "assets/HeartSlot.png"
                );

                slot.classList.toggle("glowing", filled && collected === 3);
            });
        }
    });
};

// When a player wins, creates the final win overlay with the winner image and buttons.
function show_win_ui(player) {
    const screen_el = document.getElementById("game_screen");

    if (!screen_el) {
        return;
    }

    const page_location = window.location;
    const ui = document.createElement("div");

    ui.id = "win_ui";
    ui.innerHTML = (
        "<img class=\"win-svg\" src=\"" +
        win_svgs[String(player)] +
        "\" alt=\"\">" +
        "<div class=\"win-btn-row\">" +
        "<button class=\"win-btn\" id=\"win_play_btn\">Play Again</button>" +
        "<button class=\"win-btn\" id=\"win_menu_btn\">Menu</button>" +
        "</div>"
    );

    screen_el.appendChild(ui);

    // Add event listeners to the buttons to reload the page or go back to the menu.
    const play_btn = document.getElementById("win_play_btn");

    if (play_btn) {
        play_btn.addEventListener("click", function () {
            page_location.reload();
        });
    }

    const menu_btn = document.getElementById("win_menu_btn");

    if (menu_btn) {
        menu_btn.addEventListener("click", function () {
            page_location.href = "index.html";
        });
    }
}

// Animate the transformation of the winning player's character image.
function trigger_transform(player, panel, char_img) {
    const new_img = document.createElement("img");

    new_img.src = transform_imgs[String(player)];
    new_img.className = "panel_character";
    panel.insertBefore(new_img, char_img);

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

        panel.querySelectorAll(".heart").forEach(function (heart) {
            heart.style.display = "none";
        });

        panel.animate([
            {
                filter: (
                    "brightness(1.6) drop-shadow(0 0 50px " +
                    "rgba(255, 230, 100, 0.9))"
                )
            },
            {
                filter: (
                    "brightness(1) drop-shadow(0 0 20px " +
                    "rgba(255, 230, 100, 0.3))"
                )
            }
        ], {
            duration: 1200,
            easing: "ease-out",
            fill: "forwards"
        });

        show_win_ui(player);
    });
}

// Move the winning player's panel into the centre of the screen.
function show_winner(player) {
    const panel = document.getElementById("panel_" + player);
    const screen_el = document.getElementById("game_screen");

    if (!panel || !screen_el) {
        return;
    }

    const panel_rect = panel.getBoundingClientRect();
    const screen_rect = screen_el.getBoundingClientRect();
    const css_scale = screen_rect.width / 1440;

    const sx = (panel_rect.left - screen_rect.left) / css_scale;
    const sy = (panel_rect.top - screen_rect.top) / css_scale;
    const panel_w = panel_rect.width / css_scale;
    const panel_h = panel_rect.height / css_scale;

    screen_el.appendChild(panel);
    panel.style.left = sx + "px";
    panel.style.top = sy + "px";
    panel.style.margin = "0";

    const dx = (720 - panel_w / 2) - sx;
    const dy = (416 - panel_h / 2) - sy;

    panel.style.setProperty("--win-dx", dx + "px");
    panel.style.setProperty("--win-dy", dy + "px");
    panel.classList.add("panel-winner");

    const colour = player_colours[player - 1];

    // After a delay, fly the collected hearts into the winning character.
    setTimeout(function () {
        const char_img = panel.querySelector(".panel_character");
        const heart_slots = panel.querySelectorAll(".heart");

        if (!char_img || !heart_slots.length) {
            return;
        }

        const char_rect = char_img.getBoundingClientRect();
        const centre_x = char_rect.left + char_rect.width / 2;
        const centre_y = char_rect.top + char_rect.height / 2;

        let arrived = 0;
        const total = heart_slots.length;

        heart_slots.forEach(function (slot, index) {
            const slot_rect = slot.getBoundingClientRect();
            const heart_x = slot_rect.left + slot_rect.width / 2;
            const heart_y = slot_rect.top + slot_rect.height / 2;
            const size = 130;
            const flying_heart = document.createElement("img");

            flying_heart.src = heart_imgs[colour];
            flying_heart.style.cssText = (
                "position:fixed;left:0;top:0;width:" +
                size +
                "px;height:" +
                size +
                "px;z-index:10001;pointer-events:none;object-fit:contain;"
            );

            document.body.appendChild(flying_heart);
            slot.style.visibility = "hidden";

            flying_heart.animate([
                {
                    transform: (
                        "translate(" +
                        (heart_x - size / 2) +
                        "px," +
                        (heart_y - size / 2) +
                        "px) scale(1)"
                    ),
                    filter: (
                        "drop-shadow(0 0 10px " +
                        (glow_colours[colour] || "white") +
                        ")"
                    ),
                    opacity: 1
                },
                {
                    transform: (
                        "translate(" +
                        (centre_x - size / 2) +
                        "px," +
                        (centre_y - size / 2) +
                        "px) scale(1)"
                    ),
                    filter: "drop-shadow(0 0 30px white) brightness(2)",
                    opacity: 0
                }
            ], {
                duration: 380,
                delay: index * 130,
                easing: "ease-in",
                fill: "both"
            }).finished.then(function () {
                flying_heart.remove();
                arrived += 1;

                if (arrived === total) {
                    trigger_transform(player, panel, char_img);
                }
            });
        });
    }, 950);
}

// Scale the game screen to fit within the window while maintaining aspect ratio.
const scale_screen = function () {
    const screen = document.getElementById("game_screen");

    if (!screen) {
        return;
    }

    const scale = Math.min(window.innerWidth / 1440, window.innerHeight / 832);
    const tx = (window.innerWidth - 1440 * scale) / 2;
    const ty = (window.innerHeight - 832 * scale) / 2;

    screen.style.transform = "scale(" + scale + ")";
    screen.style.left = tx + "px";
    screen.style.top = ty + "px";
};

const render = function () {
    render_board();
    render_spare_tile();
    render_arrows();
    render_players();
};

// Let the spare tile be rotated with the keyboard.
document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        rotate_spare();
    }
});

// Rescale the game screen when the browser window changes size.
window.addEventListener("resize", scale_screen);

scale_screen();
render();