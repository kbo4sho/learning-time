// document.addEventListener('keydown', function (e) {
//     if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
//         e.preventDefault();
//     }
// });
// Move the game canvas into the stage area if it is created by the JS
window.addEventListener('DOMContentLoaded', function () {
    const stage = document.getElementById('game-of-the-day-stage');
    stage.tabIndex = 0;

    // Track focus state
    let gameStageFocused = false;
    stage.addEventListener('focus', () => { gameStageFocused = true; });
    stage.addEventListener('blur', () => { gameStageFocused = false; });

    // Prevent scrolling only when focused
    document.addEventListener('keydown', function (e) {
        if (
            gameStageFocused &&
            ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
        ) {
            e.preventDefault();
        }
    });
    // Wait a tick for the game script to run
    setTimeout(() => {
        const gameCanvas = document.getElementById('game');
        if (gameCanvas && stage) {
            stage.appendChild(gameCanvas);
        }
    }, 100);
});