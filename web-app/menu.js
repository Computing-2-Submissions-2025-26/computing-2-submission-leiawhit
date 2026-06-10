/* jshint esversion: 6, browser: true */
"use strict";

const player_buttons = document.querySelectorAll(".player_button");
const start_button = document.getElementById("start_button");
const menu_screen = document.getElementById("menu_screen");
const characters = document.querySelectorAll(".character");

let selected_count = null;

// Force a clean slate on every page load — the browser can restore the
// enabled state of buttons after a reload, so we reset it explicitly here.
start_button.disabled = true;

function select_count(count) {
    selected_count = count;

    // Highlight the chosen button, clear the rest
    player_buttons.forEach(function (button) {
        button.classList.toggle("selected", Number(button.dataset.count) === count);
    });

    // Swap to the open-portal background
    menu_screen.classList.add("portal_open");

    // Show only as many characters as there are players
    characters.forEach(function (character) {
        const player_number = Number(character.dataset.count);
        character.classList.toggle("visible", player_number <= count);
    });

    start_button.disabled = false;
}

player_buttons.forEach(function (button) {
    button.addEventListener("click", function () {
        select_count(Number(button.dataset.count));
    });
});

start_button.addEventListener("click", function () {
    sessionStorage.setItem("player_count", selected_count);

    // Blur menu content out and flash covers the screen simultaneously
    menu_screen.classList.add("portal-entering");
    document.getElementById("portal_flash").classList.add("active"); /*jshint ignore:line*/
    setTimeout(function () {
        window.location.href = "game.html";
    }, 400);
});

// Reset flash and blur if the browser restores this page via the back button
window.addEventListener("pageshow", function () { /*jshint ignore:line*/
    let flash = document.getElementById("portal_flash"); /*jshint ignore:line*/
    flash.classList.remove("active");
    flash.style.animation = "none";
    flash.style.opacity = "0";
    menu_screen.classList.remove("portal-entering");
    menu_screen.style.animation = "none";
    menu_screen.style.filter = "none";
});
