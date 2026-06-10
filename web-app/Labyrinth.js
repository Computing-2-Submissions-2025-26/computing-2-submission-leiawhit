import R from "./ramda.js";
/**
 * Labyrinth.js is a module to model and play the Labyrinth board game.
 * https://en.wikipedia.org/wiki/Labyrinth_(board_game)
 * @namespace Labyrinth
 * @author Leia
 * @version 2024/25
 */
const Labyrinth = Object.create(null);

/**
 * A path shape determines which sides of a tile are open as a corridor.
 * @memberof Labyrinth
 * @typedef {("straight" | "corner" | "t_junction")} Shape
 */

/**
 * A clockwise rotation in 90° increments.
 * @memberof Labyrinth
 * @typedef {(0 | 1 | 2 | 3)} Rotation
 */

/**
 * A single tile in the maze.
 * @memberof Labyrinth
 * @typedef {object} Tile
 * @property {Labyrinth.Shape} shape
 * @property {Labyrinth.Rotation} rotation
 * @property {(string | undefined)} heart
 * @property {boolean} fixed True for the 16 unmovable tiles.
 */

/**
 * A position on the board as [column, row], both 0-indexed.
 * @memberof Labyrinth
 * @typedef {number[]} Position
 */

/**
 * A player number.
 * @memberof Labyrinth
 * @typedef {(1 | 2 | 3 | 4)} Player
 */

/**
 * The phase of the current player's turn.
 * @memberof Labyrinth
 * @typedef {("shift" | "move")} Phase
 */

/**
 * A sliding action. Direction is which edge the spare tile enters from,
 * and index is the row or column it slides into (must be 1, 3, or 5).
 * @memberof Labyrinth
 * @typedef {object} Shift
 * @property {("row_right" | "row_left" | "column_down" | "column_up")} direction
 * @property {(1 | 3 | 5)} index
 */

/**
 * The complete game state.
 * @memberof Labyrinth
 * @typedef {object} GameState
 * @property {Labyrinth.Tile[][]} board 7×7 grid, indexed board[col][row].
 * @property {Labyrinth.Tile} spare_tile The tile waiting off the board.
 * @property {Labyrinth.Position[]} player_positions
 * @property {string[][]} player_hearts Remaining hearts per player.
 * @property {number} player_count
 * @property {Labyrinth.Player} current_player
 * @property {Labyrinth.Phase} phase
 * @property {(Labyrinth.Shift | undefined)} last_shift
 * @property {(Labyrinth.Player | undefined)} winner
 */

/**
 * The board side length.
 * @memberof Labyrinth
 */
Labyrinth.board_size = 7;

/**
 * The eight treasure keys used in the game.
 * @memberof Labyrinth
 */
Labyrinth.heart = Object.freeze([
    "green", "red", "purple", "grey",
]);
        
/**
 * Base openings for each shape at rotation 0, as [north, east, south, west].
 * @memberof Labyrinth
 */
Labyrinth.shape_openings = Object.freeze({
    "straight":   [true, false, true,  false],
    "corner":     [false, true,  true, false],
    "t_junction": [false, true,  true,  true]
});

/**
 * The home corner for each player. Turns go clockwise from player 1.
 * @memberof Labyrinth
 */
Labyrinth.home_positions = Object.freeze({
    1: [0, 0],
    2: [6, 0],
    3: [6, 6],
    4: [0, 6]
});

/**
 * Returns the effective open sides of a tile after applying its rotation.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Tile} tile
 * @returns {boolean[]} [north, east, south, west]
 */
Labyrinth.tile_openings = function (tile) {
    const base = Labyrinth.shape_openings[tile.shape];
    const rotate_once = ([north, east, south, west]) => [west, north, east, south];
    return R.range(0, tile.rotation).reduce(rotate_once, base);
};

/**
 * Returns a new tile rotated one step clockwise.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Tile} tile
 * @returns {Labyrinth.Tile}
 */
Labyrinth.rotate_tile = function (tile) {
    return Object.freeze({
        shape: tile.shape,
        rotation: (tile.rotation + 1) % 4,
        heart: tile.heart,
        fixed: tile.fixed
    });
};

const direction_index = {
    "north": 0, "east": 1, "south": 2, "west": 3
};

const opposite_direction = {
    "north": "south", "east": "west", "south": "north", "west": "east"
};

const direction_delta = {
    "north": [0, -1], "east": [1, 0], "south": [0, 1], "west": [-1, 0]
};

/**
 * Returns whether two adjacent tiles share an open passage,
 * given the direction of travel from tile_a to tile_b.
 * @memberof Labyrinth
 * @function
 * @param {("north" | "east" | "south" | "west")} direction
 * @param {Labyrinth.Tile} tile_a
 * @param {Labyrinth.Tile} tile_b
 * @returns {boolean}
 */
Labyrinth.tiles_connected = function (direction, tile_a, tile_b) {
    const a = Labyrinth.tile_openings(tile_a);
    const b = Labyrinth.tile_openings(tile_b);
    return (
        a[direction_index[direction]] &&
        b[direction_index[opposite_direction[direction]]]
    );
};

const in_bounds = ([column, row]) => (
    column >= 0 && column < Labyrinth.board_size &&
    row >= 0 && row < Labyrinth.board_size
);

const positions_equal = ([a_column, a_row], [b_column, b_row]) => (
    a_column === b_column && a_row === b_row
);

/**
 * Returns all positions reachable from a starting position
 * by traversing connected tile openings. Includes the start.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Position} start
 * @param {Labyrinth.Tile[][]} board
 * @returns {Labyrinth.Position[]}
 */
Labyrinth.reachable_positions = function (start, board) {
    const key_of = ([column, row]) => `${column},${row}`;
    const visited = new Set([key_of(start)]);
    let tiles = [start];

    while (tiles.length > 0) {
        const next_tiles = [];
        tiles.forEach(function ([column, row]) {
            const tile_a = board[column][row];
            Object.entries(direction_delta).forEach(function ([direction, [dc, dr]]) {
                const neighbour = [column + dc, row + dr];
                if (!in_bounds(neighbour) || visited.has(key_of(neighbour))) {
                    return;
                }
                const tile_b = board[neighbour[0]][neighbour[1]];
                if (Labyrinth.tiles_connected(direction, tile_a, tile_b)) {
                    visited.add(key_of(neighbour));
                    next_tiles.push(neighbour);
                }
            });
        });
        tiles = next_tiles;
    }

    return Array.from(visited).map((key) => key.split(",").map(Number));
};

/**
 * Returns the shortest path from start to destination as an array of positions,
 * or just [start] if destination is unreachable.
 * @memberof Labyrinth
 */
Labyrinth.find_path = function (start, destination, board) {
    const key_of = (pos) => pos[0] + "," + pos[1];
    const dest_key = key_of(destination);
    const prev = {};
    prev[key_of(start)] = null;
    let frontier = [start];

    while (frontier.length > 0) {
        const next_frontier = [];
        frontier.forEach(function (pos) {
            const tile_a = board[pos[0]][pos[1]];
            Object.entries(direction_delta).forEach(function ([dir, [dc, dr]]) {
                const nb = [pos[0] + dc, pos[1] + dr];
                const nb_key = key_of(nb);
                if (!in_bounds(nb) || Object.prototype.hasOwnProperty.call(prev, nb_key)) {
                    return;
                }
                if (Labyrinth.tiles_connected(dir, tile_a, board[nb[0]][nb[1]])) {
                    prev[nb_key] = pos;
                    next_frontier.push(nb);
                }
            });
        });
        if (Object.prototype.hasOwnProperty.call(prev, dest_key)) {
            break;
        }
        frontier = next_frontier;
    }

    if (!Object.prototype.hasOwnProperty.call(prev, dest_key)) {
        return [start];
    }

    const path = [];
    let cur = destination;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev[key_of(cur)];
    }
    return path;
};

const make_tile = (shape, rotation, heart, fixed) => Object.freeze({
    shape, rotation, heart, fixed
});

/**
 * Returns the 16 fixed tiles keyed by "column,row".
 * @memberof Labyrinth
 * @function
 * @returns {object}
 */
Labyrinth.fixed_tiles = function () {
    const corner = (rotate) => make_tile("corner", rotate, undefined, true);
    const t = (rotate) => make_tile("t_junction", rotate, undefined, true);
    return Object.freeze({
        "0,0": corner(0), "6,0": corner(1),
        "0,6": corner(3), "6,6": corner(2),
        "2,0": t(2), "4,0": t(2),
        "2,6": t(0), "4,6": t(0),
        "0,2": t(1), "0,4": t(1),
        "6,2": t(3), "6,4": t(3),
        "2,2": t(1), "4,2": t(2),
        "2,4": t(0), "4,4": t(3)
    });
};


// Fisher-Yates shuffle
const shuffle = function (array) {
    const arr = array.slice();
    let i = arr.length;
    while (i > 0) {
        const j = Math.floor(Math.random() * i);
        i -= 1;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const build_movable_area = function (player_count) {
    const shapes = [
        ...R.repeat("corner", 12),
        ...R.repeat("straight", 10),
        ...R.repeat("t_junction", 12)
    ];
    const shuffled_shapes = shuffle(shapes);
    const active_hearts = Labyrinth.heart.slice(0, player_count);
    const heart_indices = shuffle(R.range(0, shapes.length)).slice(0, player_count);
    const heart_by_index = R.fromPairs(R.zip(heart_indices, active_hearts));
    return shuffled_shapes.map((shape, i) => make_tile(
        shape,
        Math.floor(Math.random() * 4),
        heart_by_index[i],
        false
    ));
};

/**
 * Creates a new randomised starting state for 2, 3, or 4 players.
 * @memberof Labyrinth
 * @function
 * @param {number} player_count
 * @returns {Labyrinth.GameState}
 */
Labyrinth.new_game = function (player_count) {

    const fixed = Labyrinth.fixed_tiles();
    const movable_area = build_movable_area(player_count);
    let area_index = 0;

    const board = R.range(0, Labyrinth.board_size).map((column) => (
        R.range(0, Labyrinth.board_size).map(function (row) {
            const key = `${column},${row}`;
            if (fixed[key]) {
                return fixed[key];
            }
            const tile = movable_area[area_index];
            area_index += 1;
            return tile;
        })
    ));

    const spare_tile = movable_area[area_index];

    const active_hearts = Labyrinth.heart.slice(0, player_count);
    const player_hearts = R.range(0, player_count).map(
        (i) => [active_hearts[i], active_hearts[i], active_hearts[i]]
    );

    const player_positions = R.range(1, player_count + 1).map(
        (p) => Labyrinth.home_positions[p]
    );

    return Object.freeze({
        board,
        spare_tile,
        player_positions,
        player_hearts,
        player_count,
        current_player: 1,
        phase: "shift",
        last_shift: undefined,
        winner: undefined
    });
};


/**
 * Returns the shifts that are legal for the current turn.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.GameState} state
 * @returns {Labyrinth.Shift[]}
 */
Labyrinth.valid_shifts = function (state) {
    const directions = ["row_right", "row_left", "col_down", "col_up"];
    const indices = [1, 3, 5];
    return R.xprod(directions, indices).map(
        ([direction, index]) => ({ direction, index })
    );
};

const shift_row_right = function (index, spare, board) {
    const new_spare = board[6][index];
    const new_board = board.map((column, column_index) => column.map(
        (tile, row_index) => (
            row_index !== index
            ? tile
            : (column_index === 0 ? spare : board[column_index - 1][index])
        )
    ));
    return { board: new_board, spare_tile: new_spare };
};

const shift_row_left = function (index, spare, board) {
    const last = Labyrinth.board_size - 1;
    const new_spare = board[0][index];
    const new_board = board.map((column, column_index) => column.map(
        function (tile, row_index) {
            if (row_index !== index) {
                return tile;
            }
            if (column_index === last) {
                return spare;
            }
            return board[column_index + 1][index];
        }
    ));
    return { board: new_board, spare_tile: new_spare };
};

const shift_col_down = function (index, spare, board) {
    const new_spare = board[index][6];
    const new_col = [spare, ...board[index].slice(0, 6)];

    const new_board = board.map(function (column, idx) {
        if (idx === index) {
            return new_col;
        } else {
            return column;
        }
    });

    return {
        board: new_board,
        spare_tile: new_spare
    };
};

const shift_col_up = function (index, spare, board) {
    const new_spare = board[index][0];
    const new_col = [...board[index].slice(1), spare];

    const new_board = board.map(function (column, idx) {
        if (idx === index) {
            return new_col;
        } else {
            return column;
        }
    });

    return {
        board: new_board,
        spare_tile: new_spare
    };
};

const shift_implementations = {
    "row_right": shift_row_right,
    "row_left":  shift_row_left,
    "col_down":  shift_col_down,
    "col_up":    shift_col_up
};

/**
 * Returns the new position of a piece after a shift.
 * Pieces on the shifted row/column move with the tiles, wrapping
 * around if they would be pushed off.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Shift} shift
 * @param {Labyrinth.Position} position
 * @returns {Labyrinth.Position}
 */
Labyrinth.position_after_shift = function (shift, position) {
    const [column, row] = position;
    const last = Labyrinth.board_size - 1;
    if (shift.direction === "row_right" && row === shift.index) {
        return [column === last ? 0 : column + 1, row];
    }
    if (shift.direction === "row_left" && row === shift.index) {
        return [column === 0 ? last : column - 1, row];
    }
    if (shift.direction === "col_down" && column === shift.index) {
        return [column, row === last ? 0 : row + 1];
    }
    if (shift.direction === "col_up" && column === shift.index) {
        return [column, row === 0 ? last : row - 1];
    }
    return position;
};

/**
 * Applies a shift, returning the new state, or undefined if illegal.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Shift} shift
 * @param {Labyrinth.GameState} state
 * @returns {(Labyrinth.GameState | undefined)}
 */
Labyrinth.apply_shift = function (shift, state) {
    if (state.phase !== "shift") {
        return undefined;
    }
    const legal = Labyrinth.valid_shifts(state).some(
        (s) => s.direction === shift.direction && s.index === shift.index
    );
    if (!legal) {
        return undefined;
    }

    const apply_shift = shift_implementations[shift.direction];
    const { board: new_board, spare_tile: new_spare } = apply_shift(
        shift.index, state.spare_tile, state.board
    );
    const new_positions = state.player_positions.map(
        (p) => Labyrinth.position_after_shift(shift, p)
    );

    return Object.freeze({
        board: new_board,
        spare_tile: new_spare,
        player_positions: new_positions,
        player_hearts: state.player_hearts,
        player_count: state.player_count,
        current_player: state.current_player,
        phase: "move",
        last_shift: Object.freeze(shift),
        winner: state.winner
    });
};

/**
 * Returns the player's current target treasure, or undefined
 * if all collected.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player
 * @param {Labyrinth.GameState} state
 * @returns {(string | undefined)}
 */
Labyrinth.current_target = function (player, state) {
    const remaining = state.player_hearts[player - 1];
    return remaining.length > 0 ? remaining[0] : undefined;
};

/**
 * Returns how many treasures a player has collected.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player
 * @param {Labyrinth.GameState} state
 * @returns {number}
 */
Labyrinth.hearts_collected = function (player, state) {
    return 3 - state.player_hearts[player - 1].length;
};

const next_player = (state) => (state.current_player % state.player_count) + 1;

/**
 * Applies a move to a destination, collecting any matching treasure.
 * Returns the new state, or undefined if illegal.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player
 * @param {Labyrinth.Position} destination
 * @param {Labyrinth.GameState} state
 * @returns {(Labyrinth.GameState | undefined)}
 */
Labyrinth.apply_move = function (player, destination, state) {
    if (state.phase !== "move" || state.current_player !== player) {
        return undefined;
    }
    const player_index = player - 1;
    const current_position = state.player_positions[player_index];
    const reachable = Labyrinth.reachable_positions(current_position, state.board);
    if (!reachable.some((p) => positions_equal(p, destination))) {
        return undefined;
    }

    const destination_tile = state.board[destination[0]][destination[1]];
    const target = Labyrinth.current_target(player, state);
    const collected = destination_tile.heart !== undefined &&
        destination_tile.heart === target;

    // Respawn the collected heart on a random empty tile
    let new_board = state.board;
    if (collected) {
        const eligible = [];
        R.range(0, Labyrinth.board_size).forEach(function (col) {
            R.range(0, Labyrinth.board_size).forEach(function (row) {
                if (
                    !state.board[col][row].heart &&
                    !(col === destination[0] && row === destination[1])
                ) {
                    eligible.push([col, row]);
                }
            });
        });
        const spawn = eligible.length > 0
            ? eligible[Math.floor(Math.random() * eligible.length)]
            : null;
        new_board = state.board.map(function (column, col) {
            return column.map(function (tile, row) {
                if (col === destination[0] && row === destination[1]) {
                    return make_tile(tile.shape, tile.rotation, undefined, tile.fixed);
                }
                if (spawn && col === spawn[0] && row === spawn[1]) {
                    return make_tile(tile.shape, tile.rotation, target, tile.fixed);
                }
                return tile;
            });
        });
    }

    const new_hearts = state.player_hearts.map(function (hearts, i) {
        if (i === player_index && collected) {
            return hearts.slice(1);
        } else {
            return hearts;
        }
    });
    const new_positions = state.player_positions.map(function (position, i) {
        if (i === player_index) {
            return destination;
        } else {
            return position;
        }
    });

    // TEMPORARY TEST: win after collecting just 1 heart, no home return needed
    const all_collected = new_hearts[player_index].length < 3;
    const has_won = all_collected;
    // Drain remaining hearts so all 3 panel slots fill and glow
    const final_hearts = has_won
        ? new_hearts.map(function (h, i) { return i === player_index ? [] : h; })
        : new_hearts;

    return Object.freeze({
        board: new_board,
        spare_tile: state.spare_tile,
        player_positions: new_positions,
        player_hearts: final_hearts,
        player_count: state.player_count,
        current_player: has_won ? state.current_player : next_player(state),
        phase: "shift",
        last_shift: state.last_shift,
        winner: has_won ? player : undefined
    });
};

/**
 * Ends the current player's turn without moving.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.GameState} state
 * @returns {(Labyrinth.GameState | undefined)}
 */
Labyrinth.pass_move = function (state) {
    if (state.phase !== "move") {
        return undefined;
    }
    return Object.freeze({
        ...state,
        current_player: next_player(state),
        phase: "shift"
    });
};

/**
 * Returns whether the game has ended.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.GameState} state
 * @returns {boolean}
 */
Labyrinth.is_ended = function (state) {
    return state.winner !== undefined;
};

export default Object.freeze(Labyrinth);
