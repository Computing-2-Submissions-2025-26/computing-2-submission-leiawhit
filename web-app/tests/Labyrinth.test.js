import Labyrinth from "../Labyrinth.js";
import R from "../ramda.js";

/*
    Tested API: The Shift mechanism of the maze.

    Tests for valid_shifts, apply_shift, and position_after_shift.

    They check that the shift options are right, tiles are not lost or copied,
    players move with the row or column they are on and the turn changes to
    the move phase after shifting.
*/

// Short state summary in error messages.
const describe_state = function (state) {
    const tile_line = function (tile) {
        return (
            tile.shape +
            "@" + tile.rotation +
            (tile.heart ? " (" + tile.heart + " heart)" : "") +
            (tile.fixed ? " [fixed]" : "")
        );
    };
    return (
        "\n  phase: " + state.phase +
        "\n  current_player: " + state.current_player +
        "\n  spare_tile: " + tile_line(state.spare_tile) +
        "\n  player_positions: " + JSON.stringify(state.player_positions) +
        "\n  last_shift: " + JSON.stringify(state.last_shift)
    );
};

// Key for comparing tiles.
const fingerprint = function (tile) {
    return [
        tile.shape,
        tile.rotation,
        tile.heart === undefined ? "none" : tile.heart,
        tile.fixed
    ].join("|");
};

// Counts every tile in play (49 on the board and 1 spare).
const tile_multiset = function (state) {
    const all_tiles = [...R.flatten(state.board), state.spare_tile];
    return R.countBy(fingerprint, all_tiles);
};

/**
 * Checks that a shift has kept the same set of tiles.
 * @memberof Labyrinth.test
 * @function
 * @param {Labyrinth.GameState} before The state before the shift.
 * @param {Labyrinth.GameState} after The state after the shift.
 * @throws if any tile is created, destroyed or duplicated.
 */
const throw_if_tiles_not_conserved = function (before, after) {
    const before_counts = tile_multiset(before);
    const after_counts = tile_multiset(after);
    if (!R.equals(before_counts, after_counts)) {
        throw new Error(
            "The tiles changed after the shift." +
            "\n  before: " + JSON.stringify(before_counts) +
            "\n  after:  " + JSON.stringify(after_counts)
        );
    }
};

// Checks whether [column, row] is inside the board.
const on_board = function ([column, row]) {
    const size = Labyrinth.board_size;
    return column >= 0 && column < size && row >= 0 && row < size;
};

// Allows a second shift straight away in tests.
const arm_shift = function (state) {
    return Object.freeze({...state, "phase": "shift"});
};

describe("Valid shifts", function () {
    it(
        `Given a new game,
When valid_shifts is called,
Then only the three moveable rows and columns are returned.`,
        function () {
            const shifts = Labyrinth.valid_shifts();

            const directions = R.uniq(R.pluck("direction", shifts)).sort();
            const expected_directions = [
                "column_down",
                "column_up",
                "row_left",
                "row_right"
            ];
            if (!R.equals(directions, expected_directions)) {
                throw new Error(
                    "Wrong shift directions: " + JSON.stringify(directions)
                );
            }

            // Only odd indexed lines should be shiftable.
            const offered_indices = R.uniq(R.pluck("index", shifts));
            const a_fixed_line_is_offered = offered_indices.some(
                (index) => index % 2 === 0
            );
            if (a_fixed_line_is_offered) {
                throw new Error(
                    "A fixed line was included: " +
                    JSON.stringify(offered_indices)
                );
            }

            const keys = shifts.map(
                (shift) => shift.direction + ":" + shift.index
            );
            if (R.uniq(keys).length !== keys.length) {
                throw new Error(
                    "Duplicate shifts found: " + JSON.stringify(keys)
                );
            }
        }
    );
});

describe("Applying a shift", function () {
    it(
        "All shifts from valid_shifts can be used with apply_shift.",
        function () {
            const game = Labyrinth.new_game(4);
            Labyrinth.valid_shifts().forEach(function (shift) {
                const result = Labyrinth.apply_shift(shift, game);
                if (result === undefined) {
                    throw new Error(
                        "A valid shift was rejected: " +
                        JSON.stringify(shift) +
                        describe_state(game)
                    );
                }
            });
        }
    );

    it(
        `Given a new game,
When any legal shift is applied,
Then the same tiles are still in play.`,
        function () {
            const game = Labyrinth.new_game(4);
            // Check every legal shift, not just one example.
            Labyrinth.valid_shifts().forEach(function (shift) {
                const after = Labyrinth.apply_shift(shift, game);
                throw_if_tiles_not_conserved(game, after);
            });
        }
    );

    it(
        `Given a new game,
When a line is shifted and then shifted back,
Then the board and spare tile go back to the start.`,
        function () {
            const game = Labyrinth.new_game(4);
            const inverse = {
                "row_right": "row_left",
                "row_left": "row_right",
                "column_down": "column_up",
                "column_up": "column_down"
            };

            [1, 3, 5].forEach(function (index) {
                Object.keys(inverse).forEach(function (direction) {
                    const there = Labyrinth.apply_shift(
                        {"direction": direction, "index": index},
                        game
                    );
                    const back = Labyrinth.apply_shift(
                        {"direction": inverse[direction], "index": index},
                        arm_shift(there)
                    );

                    if (!R.equals(back.board, game.board)) {
                        throw new Error(
                            "The board did not return after shifting " +
                            direction + " at index " + index +
                            " and then back." +
                            "\n  spare before: " +
                            fingerprint(game.spare_tile) +
                            "\n  spare after:  " +
                            fingerprint(back.spare_tile)
                        );
                    }
                    if (!R.equals(back.spare_tile, game.spare_tile)) {
                        throw new Error(
                            "The spare tile did not return after shifting " +
                            direction + " at index " + index +
                            " and then back." +
                            describe_state(back)
                        );
                    }
                });
            });
        }
    );

    it(
        "After a legal shift, the game changes to the move phase.",
        function () {
            const game = Labyrinth.new_game(4);
            const after = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 1},
                game
            );
            if (after.phase !== "move") {
                throw new Error(
                    "Expected phase to be \"move\", but got \"" +
                    after.phase + "\"." + describe_state(after)
                );
            }
        }
    );

    it(
        "A player cannot shift twice in one turn.",
        function () {
            const game = Labyrinth.new_game(4);
            const after_first = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 1},
                game
            );
            const after_second = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 1},
                after_first
            );
            if (after_second !== undefined) {
                throw new Error(
                    "A second shift was accepted during the move phase." +
                    describe_state(after_second)
                );
            }
        }
    );

    it(
        "A fixed line cannot be shifted.",
        function () {
            const game = Labyrinth.new_game(4);
            // Index 2 is fixed, so it should not be accepted.
            const result = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 2},
                game
            );
            if (result !== undefined) {
                throw new Error(
                    "A fixed line was accepted as a shift." +
                    describe_state(result)
                );
            }
        }
    );

    it(
        "A shift only moves players on that row or column.",
        function () {
            const game = Labyrinth.new_game(4);
            // Players start in the corners, so row 3 should not move them.
            const after = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 3},
                game
            );
            if (!R.equals(after.player_positions, game.player_positions)) {
                throw new Error(
                    "A player moved even though they were not on row 3." +
                    "\n  before: " +
                    JSON.stringify(game.player_positions) +
                    "\n  after:  " +
                    JSON.stringify(after.player_positions)
                );
            }
        }
    );
});
    it(
        "A player on the shifted line is carried with it.",
        function () {
            const game = Labyrinth.new_game(4);
            const changed_game = Object.freeze({
                ...game,
                "player_positions": [[6, 1], [6, 0], [6, 6], [0, 6]]
            });

            const after = Labyrinth.apply_shift(
                {"direction": "row_right", "index": 1},
                changed_game
            );

            if (!R.equals(after.player_positions[0], [0, 1])) {
                throw new Error(
                    "A player on row 1 was not carried around the edge." +
                    "\n  before: " +
                    JSON.stringify(changed_game.player_positions) +
                    "\n  after:  " +
                    JSON.stringify(after.player_positions)
                );
            }
        }
    );
// Every board position as [column, row].
const every_position = R.xprod(
    R.range(0, Labyrinth.board_size),
    R.range(0, Labyrinth.board_size)
);

describe("Position after a shift", function () {
    it(
        "A shifted piece stays on the board.",
        function () {
            Labyrinth.valid_shifts().forEach(function (shift) {
                every_position.forEach(function (position) {
                    const moved = Labyrinth.position_after_shift(
                        shift,
                        position
                    );
                    if (!on_board(moved)) {
                        throw new Error(
                            "A piece moved off the board." +
                            "\n  shift: " + JSON.stringify(shift) +
                            "\n  from:  " + JSON.stringify(position) +
                            "\n  to:    " + JSON.stringify(moved)
                        );
                    }
                });
            });
        }
    );

    it(
        "Pieces not on the shifted line stay where they are.",
        function () {
            Labyrinth.valid_shifts().forEach(function (shift) {
                every_position.forEach(function (position) {
                    const [column, row] = position;
                    const is_a_row_shift = shift.direction.startsWith("row");
                    // Check whether this position lies on the shifted line.
                    const on_slid_line = (
                        is_a_row_shift
                        ? row === shift.index
                        : column === shift.index
                    );
                    if (on_slid_line) {
                        return;
                    }
                    const moved = Labyrinth.position_after_shift(
                        shift,
                        position
                    );
                    if (!R.equals(moved, position)) {
                        throw new Error(
                            "A piece moved even though it was not on the " +
                            "shifted line." +
                            "\n  shift: " + JSON.stringify(shift) +
                            "\n  from:  " + JSON.stringify(position) +
                            "\n  to:    " + JSON.stringify(moved)
                        );
                    }
                });
            });
        }
    );

    it(
        "A shifted line keeps seven different positions on the same line.",
        function () {
            const last = Labyrinth.board_size - 1;
            [1, 3, 5].forEach(function (index) {
                const checks = [
                    {
                        "direction": "row_right",
                        "cells": R.range(0, Labyrinth.board_size).map(
                            (column) => [column, index]
                        ),
                        "stays_on_line": ([, row]) => row === index,
                        "axis": 0
                    },
                    {
                        "direction": "column_down",
                        "cells": R.range(0, Labyrinth.board_size).map(
                            (row) => [index, row]
                        ),
                        "stays_on_line": ([column]) => column === index,
                        "axis": 1
                    }
                ];

                checks.forEach(function (check) {
                    const shift = {
                        "direction": check.direction,
                        "index": index
                    };
                    const destinations = check.cells.map(
                        (cell) => Labyrinth.position_after_shift(shift, cell)
                    );

                    // All pieces stay on the shifted line.
                    if (!destinations.every(check.stays_on_line)) {
                        throw new Error(
                            "A piece moved off the shifted line." +
                            "\n  shift:        " + JSON.stringify(shift) +
                            "\n  destinations: " +
                            JSON.stringify(destinations)
                        );
                    }

                    // No two pieces land on the same position.
                    const keys = destinations.map(([c, r]) => c + "," + r);
                    if (R.uniq(keys).length !== keys.length) {
                        throw new Error(
                            "Two pieces landed on the same position." +
                            "\n  shift:        " + JSON.stringify(shift) +
                            "\n  destinations: " +
                            JSON.stringify(destinations)
                        );
                    }

                    // Six pieces move one step, and one wraps around the edge.
                    const displacements = destinations.map(
                        (destination, i) => (
                            destination[check.axis] -
                            check.cells[i][check.axis]
                        )
                    );
                    const steps = displacements.filter(
                        (delta) => Math.abs(delta) === 1
                    );
                    const wraps = displacements.filter(
                        (delta) => Math.abs(delta) === last
                    );
                    const steps_agree = R.uniq(steps).length === 1;
                    const wrap_is_opposite = (
                        wraps.length === 1 &&
                        Math.sign(wraps[0]) === -Math.sign(steps[0])
                    );
                    if (
                        steps.length !== Labyrinth.board_size - 1 ||
                        wraps.length !== 1 ||
                        !steps_agree ||
                        !wrap_is_opposite
                    ) {
                        throw new Error(
                            "The line did not shift by one position." +
                            "\n  shift:         " + JSON.stringify(shift) +
                            "\n  displacements: " +
                            JSON.stringify(displacements)
                        );
                    }
                });
            });
        }
    );

    it(
        "Shifting a position one way and then back returns it to the start.",
        function () {
            const pairs = [
                ["row_right", "row_left"],
                ["column_down", "column_up"]
            ];
            [1, 3, 5].forEach(function (index) {
                pairs.forEach(function ([forward, backward]) {
                    every_position.forEach(function (position) {
                        const there = Labyrinth.position_after_shift(
                            {"direction": forward, "index": index},
                            position
                        );
                        const back = Labyrinth.position_after_shift(
                            {"direction": backward, "index": index},
                            there
                        );
                        if (!R.equals(back, position)) {
                            throw new Error(
                                "The position did not return after shifting " +
                                "back." +
                                "\n  forward:  " + forward + " @ " + index +
                                "\n  start:    " + JSON.stringify(position) +
                                "\n  after:    " + JSON.stringify(there) +
                                "\n  returned: " + JSON.stringify(back)
                            );
                        }
                    });
                });
            });
        }
    );
});