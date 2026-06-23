/*jslint browser */

// This file contains the code for the menu screen of the game. 
// It allows the player to select the number of players and start the game.

const player_buttons = document.querySelectorAll(".player_button");
const start_button = document.getElementById("start_button");
const menu_screen = document.getElementById("menu_screen");
const portal_flash = document.getElementById("portal_flash");
const characters = document.querySelectorAll(".character");

let selected_count = null;

// Reset the menu when the page loads.
start_button.disabled = true;

// Select the number of players, enables start  button
// and update the background to show portal is open.
const select_count = function (count) {
    selected_count = count;

    player_buttons.forEach(function (button) {
        button.classList.toggle(
            "selected",
            Number(button.dataset.count) === count
        );
    });

    menu_screen.classList.add("portal_open");

    characters.forEach(function (character) {
        const player_number = Number(character.dataset.count);

        character.classList.toggle("visible", player_number <= count);
    });

    start_button.disabled = false;
};

// Add event listeners to the player buttons and start button.
player_buttons.forEach(function (button) {
    button.addEventListener("click", function () {
        select_count(Number(button.dataset.count));
    });
});

start_button.addEventListener("click", function () {
    sessionStorage.setItem("player_count", selected_count);

    // Add a transition effect when starting the game.
    menu_screen.classList.add("portal-entering");

    if (portal_flash) {
        portal_flash.classList.add("active");
    }

    setTimeout(function () {
        window.location.href = "game.html";
    }, 400);
});

// Reset the transition if the page is restored with the back button.
window.addEventListener("pageshow", function () {
    if (portal_flash) {
        portal_flash.classList.remove("active");
        portal_flash.style.animation = "none";
        portal_flash.style.opacity = "0";
    }

    menu_screen.classList.remove("portal-entering");
    menu_screen.style.animation = "none";
    menu_screen.style.filter = "none";
});
