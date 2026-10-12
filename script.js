const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const menuScreen = document.getElementById('menu-screen');
const setupScreen = document.getElementById('setup-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const initialStartBtn = document.getElementById('initial-start-btn');
const beginGameBtn = document.getElementById('begin-game-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');

const scoreVal = document.getElementById('score-val');
const timerVal = document.getElementById('timer-val');
const finalScore = document.getElementById('final-score');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverReason = document.getElementById('game-over-reason');
const topHud = document.getElementById('hud');
const bottomHud = document.getElementById('hud-bottom-bar');
const scoreHistoryList = document.getElementById('score-history-list');

// Options Selectors
const difficultyButtons = document.querySelectorAll('#difficulty-select .opt-btn');
const modeButtons = document.querySelectorAll('#mode-select .opt-btn');

let selectedDifficulty = 'easy';
let selectedMode = 'timed';

difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.getAttribute('data-val');
    });
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-val');
    });
});

// Game States
let gameRunning = false;
let isPaused = false;
let score = 0;
let timeLeft = 60;
let timerInterval;
let spawnTimer = 0;
let gameElapsedTime = 0;

let scoreHistory = [];
let bladeTrail = [];
let isMouseDown = false;

// Pag-load ng mga totoong image asset para sa mga aromatics
const images = {};
const imageSources = {
    'Onion': 'Onion.png',
    'Garlic': 'Garlic.png',
    'Ginger': 'Ginger.png',
    'Chili': 'Chili Pepper.png'
};

let imagesLoaded = false;
let loadedCount = 0;
const totalImages = Object.keys(imageSources).length;

for (let key in imageSources) {
    images[key] = new Image();
    images[key].src = imageSources[key];
    images[key].onload = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
            imagesLoaded = true;
        }
    };
}

// Aromatics definitions gamit ang kanilang kaukulang larawan at sukat
const itemTypes = [
    { name: 'Onion', width: 75, height: 75, points: 10, isBomb: false },
    { name: 'Garlic', width: 70, height: 70, points: 15, isBomb: false },
    { name: 'Ginger', width: 85, height: 65, points: 20, isBomb: false },
    { name: 'Chili', width: 80, height: 65, points: 0, isBomb: true }
];

let items = [];
let slicedParticles = [];

initialStartBtn.addEventListener('click', () => {
    menuScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
});

beginGameBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
});

pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);

function togglePause() {
    if (!gameRunning && !isPaused) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }
}

// Mouse & Touch Inputs for Slicing Blade
canvas.addEventListener('mousedown', (e) => {
    if (isPaused) return;
    isMouseDown = true;
    bladeTrail = [];
});

canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !gameRunning || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    bladeTrail.push({ x, y, time: Date.now() });
    checkSliceIntersection(x, y);
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('touchstart', (e) => {
    if (isPaused) return;
    isMouseDown = true;
    bladeTrail = [];
    e.preventDefault();
});

canvas.addEventListener('touchmove', (e) => {
    if (!isMouseDown || !gameRunning || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    bladeTrail.push({ x, y, time: Date.now() });
    checkSliceIntersection(x, y);
    e.preventDefault();
});

window.addEventListener('touchend', () => {
    isMouseDown = false;
});

function startGame() {
    setupScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    topHud.classList.remove('hidden');
    bottomHud.classList.remove('hidden');
    
    score = 0;
    isPaused = false;
    gameElapsedTime = 0;
    items = [];
    slicedParticles = [];
    scoreVal.textContent = score;

    if (selectedMode === 'timed') {
        timeLeft = 60;
        timerVal.textContent = `1:00`;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!isPaused && gameRunning) {
                timeLeft--;
                gameElapsedTime++;
                let mins = Math.floor(timeLeft / 60);
                let secs = timeLeft % 60;
                timerVal.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                if (timeLeft <= 0) {
                    endGame(false);
                }
            }
        }, 1000);
    } else {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!isPaused && gameRunning) {
                gameElapsedTime++;
            }
        }, 1000);
        timerVal.textContent = `∞`;
    }

    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

function spawnItem() {
    let availableItems = itemTypes;
    let rand = Math.random();
    if (selectedDifficulty === 'easy' && rand < 0.7) {
        availableItems = itemTypes.filter(i => !i.isBomb);
    } else if (selectedDifficulty === 'hard' && rand < 0.4) {
        availableItems = [itemTypes[3], itemTypes[3], itemTypes[0], itemTypes[1], itemTypes[2]];
    }

    const template = availableItems[Math.floor(Math.random() * availableItems.length)];
    const x = Math.random() * (canvas.width - 250) + 125;
    const y = canvas.height + 40;
    
    const vx = (canvas.width / 2 - x) * 0.004 + (Math.random() * 0.8 - 0.4);
    const vy = -(Math.random() * 1.5 + 8.5);

    items.push({
        x: x, y: y, vx: vx, vy: vy,
        width: template.width,
        height: template.height,
        name: template.name,
        points: template.points,
        isBomb: template.isBomb,
        sliced: false,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04
    });
}

function checkSliceIntersection(x, y) {
    items.forEach(item => {
        if (!item.sliced) {
            // Collision radius batay sa sukat ng imahe
            const hitRadius = Math.max(item.width, item.height) / 2;
            const distX = x - item.x;
            const distY = y - item.y;
            const distance = Math.sqrt(distX * distX + distY * distY);

            if (distance < hitRadius) {
                item.sliced = true;
                if (item.isBomb) {
                    endGame(true);
                } else {
                    score += item.points;
                    scoreVal.textContent = score;
                    createSplashParticles(item.x, item.y, item.name);
                }
            }
        }
    });
}

function createSplashParticles(x, y, itemName) {
    for (let i = 0; i < 8; i++) {
        slicedParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 5 + 3,
            name: itemName,
            alpha: 1.0
        });
    }
}

function gameLoop() {
    if (!gameRunning || isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnTimer++;
    
    let currentSpawnInterval = Math.max(45, 150 - Math.floor(gameElapsedTime * 3));
    let multiSpawnChance = Math.min(0.45, gameElapsedTime * 0.008);

    if (spawnTimer > currentSpawnInterval) {
        spawnItem();
        if (Math.random() < multiSpawnChance) {
            spawnItem();
        }
        spawnTimer = 0;
    }

    // Update & Draw Items
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        
        item.vy += 0.08;
        item.x += item.vx;
        item.y += item.vy;
        item.rotation += item.rotSpeed;

        if (!item.sliced && imagesLoaded) {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation);
            
            const img = images[item.name];
            if (img) {
                ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
            }
            
            ctx.restore();
        }

        if (item.y > canvas.height + 80) {
            items.splice(i, 1);
        }
    }

    // Update & Draw Particles (Slice effects)
    for (let i = slicedParticles.length - 1; i >= 0; i--) {
        let p = slicedParticles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.025;

        if (p.alpha <= 0) {
            slicedParticles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.name === 'Chili' ? '#e76f51' : '#f4a261';
            ctx.fill();
            ctx.restore();
        }
    }

    // Blade Trail
    const now = Date.now();
    bladeTrail = bladeTrail.filter(point => now - point.time < 120);

    if (bladeTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bladeTrail[0].x, bladeTrail[0].y);
        for (let i = 1; i < bladeTrail.length; i++) {
            ctx.lineTo(bladeTrail[i].x, bladeTrail[i].y);
        }
        ctx.strokeStyle = '#f4a261';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
    }

    requestAnimationFrame(gameLoop);
}

function endGame(hitBomb) {
    gameRunning = false;
    clearInterval(timerInterval);
    topHud.classList.add('hidden');
    bottomHud.classList.add('hidden');
    
    finalScore.textContent = score;
    
    scoreHistory.unshift({ score: score, mode: `${selectedMode} / ${selectedDifficulty}`, date: new Date().toLocaleTimeString() });
    if (scoreHistory.length > 5) scoreHistory.pop();

    scoreHistoryList.innerHTML = '';
    scoreHistory.forEach(entry => {
        let li = document.createElement('li');
        li.textContent = `${entry.score} pts (${entry.mode})`;
        scoreHistoryList.appendChild(li);
    });

    if (hitBomb) {
        gameOverTitle.textContent = "Too Spicy! 🔥";
        gameOverReason.textContent = "You sliced a chili pepper bomb!";
    } else {
        gameOverTitle.textContent = "Prep Time Over!";
        gameOverReason.textContent = "Fantastic job on the kitchen prep!";
    }
    
    gameOverScreen.classList.remove('hidden');
}