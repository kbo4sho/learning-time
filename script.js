// document.addEventListener('keydown', function (e) {
//     if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
//         e.preventDefault();
//     }
// });
// Move the game canvas into the stage area if it is created by the JS
window.addEventListener('DOMContentLoaded', function () {
    const stage = document.getElementById('game-of-the-day-stage');
    stage.tabIndex = 0;

    // Animate the stage on initial load
    stage.classList.add('game-loading-animation');
    setTimeout(() => {
        stage.classList.remove('game-loading-animation');
    }, 800);

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

    // Get today's date in local timezone
    const today = new Date();
    const todayString = formatDateString(today); // YYYY-MM-DD format in local timezone

    // Generate cards for the last 7 days and next 3 days
    const cards = [];
    
    // Past 7 days (from oldest to newest)
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = formatDateString(date);
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
        const dateString = formatDateString(date);
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
        cards.map(card => {
            // Format date as MM-DD-YY for the lower date
            // Parse the date string to avoid timezone issues
            const [year, month, day] = card.date.split('-').map(Number);
            const mm = String(month).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            const yy = String(year).slice(-2);
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

function formatDateString(date) {
    // Format date as YYYY-MM-DD in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const todayString = formatDateString(today);
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
    
    // Animate the stage
    gameStage.classList.add('game-loading-animation');
    setTimeout(() => {
        gameStage.classList.remove('game-loading-animation');
    }, 800);

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
    
    // Animate the stage
    gameStage.classList.add('game-loading-animation');
    setTimeout(() => {
        gameStage.classList.remove('game-loading-animation');
    }, 800);

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
    const todayString = formatDateString(today);
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

// Metadata modal functions
function showMetadata() {
    const modal = document.getElementById('metadata-modal');
    const content = document.getElementById('metadata-content');
    
    // Get the current game date
    const activeCard = document.querySelector('.daily-game-card.active');
    let gameDate = '';
    
    if (activeCard) {
        // Extract date from onclick attribute
        const onclickAttr = activeCard.getAttribute('onclick');
        console.log('Active card onclick:', onclickAttr);
        const match = onclickAttr.match(/loadDailyGame\('([^']+)'\)/);
        if (match) {
            gameDate = match[1];
            console.log('Extracted date from active card:', gameDate);
        }
    }
    
    // If no active card, use today's date
    if (!gameDate) {
        const today = new Date();
        gameDate = formatDateString(today);
        console.log('Using today\'s date:', gameDate);
    }
    
    console.log('Final game date for metadata:', gameDate);
    
    // Try to load metadata
    loadMetadata(gameDate);
    
    modal.style.display = 'flex';
}

function hideMetadata() {
    const modal = document.getElementById('metadata-modal');
    modal.style.display = 'none';
}

function loadMetadata(dateString) {
    const content = document.getElementById('metadata-content');
    
    console.log('Loading metadata for:', dateString);
    
    // Try to load the markdown metadata first
    fetch(`games/${dateString}.meta.md`)
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Markdown metadata not found');
        })
        .then(markdownContent => {
            console.log('Markdown metadata loaded successfully');
            // Simple markdown to HTML conversion for basic formatting
            let htmlContent = markdownContent
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
            
            content.innerHTML = htmlContent;
        })
        .catch(error => {
            console.log('Markdown not found, trying JSON metadata');
            // If markdown not found, try JSON metadata
            return fetch(`games/${dateString}.meta.json`)
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('JSON metadata not found');
                })
                .then(jsonData => {
                    console.log('JSON metadata loaded successfully');
                    // Format JSON data nicely
                    let htmlContent = '<h2>Game Metadata</h2>';
                    htmlContent += '<div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin: 1rem 0;">';
                    htmlContent += '<pre><code>' + JSON.stringify(jsonData, null, 2) + '</code></pre>';
                    htmlContent += '</div>';
                    content.innerHTML = htmlContent;
                });
        })
        .catch(error => {
            console.log('No metadata found:', error);
            content.innerHTML = `
                <h2>No Metadata Available</h2>
                <p>Metadata for ${dateString} is not available.</p>
                <p>This game may not have associated metadata files.</p>
                <p><strong>Debug info:</strong> Tried to load:</p>
                <ul>
                    <li><code>games/${dateString}.meta.md</code></li>
                    <li><code>games/${dateString}.meta.json</code></li>
                </ul>
            `;
        });
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('metadata-modal');
    if (event.target === modal) {
        hideMetadata();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideMetadata();
    }
});