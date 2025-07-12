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

    // Initialize daily games section
    initializeDailyGames();
    // Add the date message for today
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    setDateMessage(todayString);
});

// Daily Games functionality
function initializeDailyGames() {
    const container = document.getElementById('daily-games-container');
    if (!container) return;

    // Get today's date
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Generate cards for the last 7 days and next 3 days
    const cards = [];
    
    // Past 7 days (from oldest to newest)
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const formattedDate = formatDate(date);
        
        cards.push({
            date: dateString,
            formattedDate: formattedDate,
            status: i === 0 ? 'today' : 'available',
            isToday: i === 0
        });
    }

    // Next 3 days
    for (let i = 1; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const formattedDate = formatDate(date);
        
        cards.push({
            date: dateString,
            formattedDate: formattedDate,
            status: 'future',
            isToday: false
        });
    }

    // Render the cards with spacers at the start and end
    container.innerHTML =
        '<div class="daily-game-spacer"></div>' +
        cards.map(card => {
            // Format date as MM-DD-YY for the lower date
            const dateObj = new Date(card.date);
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            const mmddyy = `${mm}-${dd}-${yy}`;
            return `
                <div class="daily-game-card ${card.isToday ? 'today active' : ''} ${card.status === 'future' ? 'future' : ''}" 
                     onclick="${card.status === 'future' ? 'return false' : `loadDailyGame('${card.date}'); console.log('Clicked daily game: ${card.date}');`}">
                    <h4>${card.formattedDate}</h4>
                    <div class="date">${mmddyy}</div>
                    <div class="status ${card.status}">
                        ${card.status === 'today' ? 'TODAY' : 
                          card.status === 'available' ? 'PLAY' : 'COMING SOON'}
                    </div>
                </div>
            `;
        }).join('') +
        '<div class="daily-game-spacer"></div>';

    // Activate and center today's card on page load
    updateActiveCard(todayString);
}

function formatDate(date) {
    const options = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

function setDateMessage(dateString) {
    const gameSubtitle = document.querySelector('.game-of-the-day-stage p');
    // Remove any existing date message
    const existingDateMsg = document.querySelector('.date-message');
    if (existingDateMsg) existingDateMsg.remove();
    // Determine if dateString is today
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const dateMsg = document.createElement('div');
    dateMsg.className = 'date-message';
    dateMsg.style.cssText = 'color: var(--text-secondary); font-size: 0.7rem; font-weight: 300; opacity: 0.6; font-style: italic; text-align: center; margin-bottom: 1.2rem; margin-top: 0.5rem;';
    if (dateString === todayString) {
        dateMsg.textContent = `Playing today's challenge`;
    } else {
        dateMsg.textContent = `Playing the challenge for ${dateString}`;
    }
    gameSubtitle.insertAdjacentElement('afterend', dateMsg);
}

function loadDailyGame(dateString) {
    console.log('loadDailyGame called with:', dateString);
    
    // Replace the game of the day with the selected daily game
    const gameStage = document.getElementById('game-of-the-day-stage');
    const gameTitle = document.querySelector('.game-of-the-day-stage h2');
    const gameSubtitle = document.querySelector('.game-of-the-day-stage p');
    
    // Always keep the header and subtitle
    gameTitle.textContent = 'Game of the Day';
    gameSubtitle.textContent = 'a new AI-generated game each day.';

    // Remove any existing date message
    const existingDateMsg = document.querySelector('.date-message');
    if (existingDateMsg) existingDateMsg.remove();

    // Add a date message below the subtitle
    setDateMessage(dateString);

    // Clear the current game stage
    gameStage.innerHTML = '<div class="loading">Loading game...</div>';
    
    // Remove any existing game scripts
    const existingScripts = document.querySelectorAll('script[src^="games/"]');
    existingScripts.forEach(script => script.remove());
    
    // Update the active card in the timeline
    updateActiveCard(dateString);
    
    // Delay game loading by 500ms to allow card animation to complete
    setTimeout(() => {
        // Add purple class to active card after 500ms
        const activeCard = document.querySelector('.daily-game-card.active');
        if (activeCard) {
            activeCard.classList.add('purple');
        }

        // Load the selected daily game using fetch and wrap in function scope
        fetch(`games/${dateString}.js`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(scriptContent => {
                console.log(`Successfully loaded daily game: ${dateString}`);
                
                // Wrap the script content in a function to isolate variables
                const wrappedScript = `
                    (function() {
                        ${scriptContent}
                    })();
                `;
                
                // Create a new script element with the wrapped content
                const script = document.createElement('script');
                script.textContent = wrappedScript;
                
                // Execute the script
                document.head.appendChild(script);
            })
            .catch(error => {
                console.error(`Failed to load daily game: ${dateString}`, error);
                gameStage.innerHTML = `
                    <div class="error-message">
                        <p>This daily challenge is not available yet.</p>
                        <p>Check back later or try a different date!</p>
                    </div>
                `;
            });
    }, 500);
}

function loadTodaysGame() {
    // Reset to today's game
    const gameStage = document.getElementById('game-of-the-day-stage');
    const gameTitle = document.querySelector('.game-of-the-day-stage h2');
    const gameSubtitle = document.querySelector('.game-of-the-day-stage p');
    
    // Always keep the header and subtitle
    gameTitle.textContent = 'Game of the Day';
    gameSubtitle.textContent = 'a new AI-generated game each day.';

    // Remove any existing date message
    const existingDateMsg = document.querySelector('.date-message');
    if (existingDateMsg) existingDateMsg.remove();

    // Clear the current game stage
    gameStage.innerHTML = '';
    
    // Remove any existing game scripts
    const existingScripts = document.querySelectorAll('script[src^="games/"]');
    existingScripts.forEach(script => script.remove());
    
    // Update the active card to today's card
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    updateActiveCard(todayString);
    
    // Load the latest game (today's game) using fetch and wrap in function scope
    fetch('games/latest.js')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(scriptContent => {
            console.log('Successfully loaded today\'s game');
            
            // Wrap the script content in a function to isolate variables
            const wrappedScript = `
                (function() {
                    ${scriptContent}
                })();
            `;
            
            // Create a new script element with the wrapped content
            const script = document.createElement('script');
            script.textContent = wrappedScript;
            
            // Execute the script
            document.head.appendChild(script);
        })
        .catch(error => {
            console.error('Failed to load today\'s game', error);
            gameStage.innerHTML = `
                <div class="error-message">
                    <p>Failed to load today's game.</p>
                </div>
            `;
        });
}

function updateActiveCard(dateString) {
    // Remove active and plugged-in classes from all cards and reset button text
    const allCards = document.querySelectorAll('.daily-game-card');
    allCards.forEach(card => {
        card.classList.remove('active', 'plugged-in'); // removed 'purple'
        // Reset button text to original state
        const statusElement = card.querySelector('.status');
        if (statusElement) {
            if (statusElement.classList.contains('available')) {
                statusElement.textContent = 'PLAY';
            } else if (statusElement.classList.contains('today')) {
                statusElement.textContent = 'TODAY';
            }
        }
    });

    // Find the card that matches the current game
    const targetCard = document.querySelector(`[onclick*="${dateString}"]`);
    if (targetCard) {
        targetCard.classList.add('active');
        // No more button text or color change

        // Center the card under the plug (center of game area)
        const container = document.getElementById('daily-games-container');
        const gameStage = document.querySelector('.game-of-the-day-stage');
        if (container && gameStage) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = targetCard.getBoundingClientRect();
            const gameRect = gameStage.getBoundingClientRect();

            // Center of the game area relative to the container
            const gameCenter = gameRect.left + gameRect.width / 2;
            const cardOffset = targetCard.offsetLeft + targetCard.offsetWidth / 2;
            const containerLeft = containerRect.left;

            // The scroll position needed to center the card under the plug
            const scrollTo = cardOffset - (gameCenter - containerLeft);

            container.scrollTo({
                left: scrollTo,
                behavior: 'smooth'
            });
        }

        // Animate: after a brief pause, add the plugged-in class
        setTimeout(() => {
            allCards.forEach(card => card.classList.remove('plugged-in'));
            targetCard.classList.add('plugged-in');
        }, 180);
    }
}

// Remove connector position JS and window resize handler, as the connector is now always fixed at center.