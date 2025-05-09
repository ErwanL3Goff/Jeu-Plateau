document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const optionsScreen = document.getElementById('options-screen');
    const gameScreen = document.getElementById('game-screen');
    const playerCountInput = document.getElementById('player-count');
    const startGameBtn = document.getElementById('start-game');
    const rollDiceBtn = document.getElementById('roll-dice');
    const currentPlayerDisplay = document.getElementById('current-player');
    const diceResultDisplay = document.getElementById('dice-result');
    const gameMessage = document.getElementById('game-message');
    const playersInfo = document.getElementById('players-info');
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const diceContainer = document.getElementById('dice-container');

    // Variables du jeu
    let players = [];
    let currentPlayerIndex = 0;
    let board = [];
    const BOARD_SIZE = 40;
    let diceValue = 0;
    let gameStarted = false;
    let animationFrameId = null;
    let playerPositions = [];
    let playerAnimations = [];
    let blockedPlayers = {};
    let diceAnimationInterval = null;
    let diceScene, diceCamera, diceRenderer, diceCube;
    let isDiceRolling = false;

    // Types de cases
    const CASE_TYPES = {
        NEUTRE: 'neutre',
        RELANCER: 'relancer',
        MONEY: 'money',
        SAUT: 'saut',
        PRISON: 'prison',
        MYSTERE: 'mystère'
    };

    // Initialisation du plateau
    function initBoard() {
        board = [];
        // Répartition des cases spéciales (environ 20% du plateau)
        const specialCasesCount = Math.floor(BOARD_SIZE * 0.2);
        const specialCasePositions = new Set();
        
        while (specialCasePositions.size < specialCasesCount) {
            const pos = Math.floor(Math.random() * (BOARD_SIZE - 10)) + 5; // Éviter les 5 premières cases
            specialCasePositions.add(pos);
        }
        
        const specialPositionsArray = Array.from(specialCasePositions);
        
        // Assigner des types aux cases spéciales
        for (let i = 0; i < BOARD_SIZE; i++) {
            if (specialPositionsArray.includes(i)) {
                const types = Object.values(CASE_TYPES).filter(t => t !== CASE_TYPES.NEUTRE);
                const randomType = types[Math.floor(Math.random() * types.length)];
                board.push({ type: randomType });
            } else {
                board.push({ type: CASE_TYPES.NEUTRE });
            }
        }
        
        // S'assurer que la dernière case est neutre (ligne d'arrivée)
        board[BOARD_SIZE - 1].type = CASE_TYPES.NEUTRE;
    }

    // Initialisation des joueurs
    function initPlayers(count) {
        players = [];
        playerPositions = [];
        playerAnimations = [];
        blockedPlayers = {};
        
        for (let i = 0; i < count; i++) {
            players.push({
                id: i,
                name: `Joueur ${i + 1}`,
                position: 0,
                money: 1000,
                color: getPlayerColor(i),
                blockedTurns: 0,
                laps: 0,
                wins: 0
            });
            playerPositions[i] = 0;
            playerAnimations[i] = { animating: false, targetPos: 0, currentPos: 0 };
        }
    }

    // Initialisation de ThreeJS pour les dés
    function initDiceAnimation() {
        diceScene = new THREE.Scene();
        diceCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        diceRenderer = new THREE.WebGLRenderer({ alpha: true });
        diceRenderer.setSize(200, 200);
        diceContainer.appendChild(diceRenderer.domElement);
        
        // Lumière
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        diceScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        diceScene.add(directionalLight);
        
        // Création du dé
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0xffffff }), // droite
            new THREE.MeshBasicMaterial({ color: 0xffffff }), // gauche
            new THREE.MeshBasicMaterial({ color: 0xffffff }), // haut
            new THREE.MeshBasicMaterial({ color: 0xffffff }), // bas
            new THREE.MeshBasicMaterial({ color: 0xffffff }), // avant
            new THREE.MeshBasicMaterial({ color: 0xffffff })   // arrière
        ];
        
        diceCube = new THREE.Mesh(geometry, materials);
        diceScene.add(diceCube);
        
        // Position de la caméra
        diceCamera.position.z = 3;
        
        // Ajouter les points sur le dé
        addDiceDots();
    }

    // Ajouter les points sur les faces du dé
    function addDiceDots() {
        const dotGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        // Positions des points pour chaque face (1-6)
        const dotPositions = [
            [], // face 1 (pas de points)
            [[0, 0, 0.76]], // face 2 (1 point)
            [[-0.5, 0.5, 0.76], [0.5, -0.5, 0.76]], // face 3 (2 points)
            [[-0.5, 0.5, 0.76], [0, 0, 0.76], [0.5, -0.5, 0.76]], // face 4 (3 points)
            [[-0.5, 0.5, 0.76], [-0.5, -0.5, 0.76], [0.5, 0.5, 0.76], [0.5, -0.5, 0.76]], // face 5 (4 points)
            [[-0.5, 0.5, 0.76], [-0.5, 0, 0.76], [-0.5, -0.5, 0.76], [0.5, 0.5, 0.76], [0.5, 0, 0.76], [0.5, -0.5, 0.76]] // face 6 (6 points)
        ];
        
        // Ajouter les points à chaque face
        for (let face = 1; face <= 6; face++) {
            const positions = dotPositions[face - 1];
            if (!positions) continue;
            
            positions.forEach(pos => {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.position.set(pos[0], pos[1], pos[2]);
                diceCube.add(dot);
            });
        }
    }

    // Animation du dé
    function animateDice() {
        requestAnimationFrame(animateDice);
        diceCube.rotation.x += 0.1;
        diceCube.rotation.y += 0.1;
        diceRenderer.render(diceScene, diceCamera);
    }

    // Afficher la face du dé correspondante
    function showDiceFace(value) {
        // Réinitialiser la rotation
        diceCube.rotation.set(0, 0, 0);
        
        // Rotation pour afficher la bonne face
        switch(value) {
            case 1:
                diceCube.rotation.set(Math.PI / 2, 0, 0);
                break;
            case 2:
                diceCube.rotation.set(0, Math.PI / 2, 0);
                break;
            case 3:
                diceCube.rotation.set(0, 0, 0);
                break;
            case 4:
                diceCube.rotation.set(Math.PI, 0, 0);
                break;
            case 5:
                diceCube.rotation.set(0, Math.PI, 0);
                break;
            case 6:
                diceCube.rotation.set(-Math.PI / 2, 0, 0);
                break;
        }
        
        diceRenderer.render(diceScene, diceCamera);
    }

    // Obtenir la couleur d'un joueur
    function getPlayerColor(index) {
        const colors = [
            '#EF4444', // rouge
            '#3B82F6', // bleu
            '#10B981', // vert
            '#F59E0B', // jaune
            '#8B5CF6', // violet
            '#EC4899', // rose
            '#14B8A6', // turquoise
            '#F97316'  // orange
        ];
        return colors[index % colors.length];
    }

    // Démarrer le jeu
    function startGame() {
        const playerCount = parseInt(playerCountInput.value);
        if (playerCount < 2 || playerCount > 8) {
            alert('Veuillez choisir entre 2 et 8 joueurs');
            return;
        }

        initBoard();
        initPlayers(playerCount);
        initDiceAnimation();
        
        optionsScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        updateCurrentPlayerDisplay();
        updatePlayersInfo();
        drawBoard();
        
        gameStarted = true;
    }

    // Mettre à jour l'affichage du joueur courant
    function updateCurrentPlayerDisplay() {
        const player = players[currentPlayerIndex];
        currentPlayerDisplay.innerHTML = `Tour de <span class="player-color-${player.id}">${player.name}</span>`;
        currentPlayerDisplay.className = `text-xl font-bold player-color-${player.id}`;
    }

    // Mettre à jour les informations des joueurs
    function updatePlayersInfo() {
        playersInfo.innerHTML = '';
        
        players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = `bg-white p-4 rounded-lg shadow ${player.id === currentPlayerIndex ? 'ring-2 ring-blue-500' : ''}`;
            
            playerEl.innerHTML = `
                <div class="flex items-center mb-2">
                    <div class="w-4 h-4 rounded-full mr-2 player-color-${player.id}"></div>
                    <h3 class="font-bold player-color-${player.id}">${player.name}</h3>
                </div>
                <p>Position: ${player.position + 1}/${BOARD_SIZE}</p>
                <p>Argent: $${player.money}</p>
                <p>Tours complets: ${player.laps}/4</p>
                ${player.blockedTurns > 0 ? `<p class="text-red-500">Prison (${player.blockedTurns} tours)</p>` : ''}
                <div class="progress-track">
                    <div class="progress-bar player-color-${player.id}" style="width: ${(player.laps / 4) * 100}%"></div>
                </div>
            `;
            
            playersInfo.appendChild(playerEl);
        });
    }

    // Dessiner le plateau avec des jetons plus visibles
    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fond du plateau
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const cellWidth = canvas.width / 10;
        const cellHeight = canvas.height / 6;
        const radius = Math.min(cellWidth, cellHeight) * 0.25;
        
        // Dessiner les cases
        for (let i = 0; i < BOARD_SIZE; i++) {
            let x, y;
            
            // Déterminer la position de la case sur le plateau en spirale
            if (i < 10) { // Première ligne (haut)
                x = i * cellWidth + cellWidth / 2;
                y = cellHeight / 2;
            } else if (i < 16) { // Colonne droite
                x = canvas.width - cellWidth / 2;
                y = (i - 9) * cellHeight + cellHeight / 2;
            } else if (i < 26) { // Ligne du bas (droite à gauche)
                x = canvas.width - ((i - 15) * cellWidth + cellWidth / 2);
                y = canvas.height - cellHeight / 2;
            } else if (i < 32) { // Colonne gauche
                x = cellWidth / 2;
                y = canvas.height - ((i - 25) * cellHeight + cellHeight / 2);
            } else { // Dernière ligne (gauche à droite)
                x = (i - 31) * cellWidth + cellWidth / 2;
                y = cellHeight / 2;
            }
            
            // Dessiner la case
            ctx.beginPath();
            ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
            
            // Couleur de la case selon son type
            switch(board[i].type) {
                case CASE_TYPES.RELANCER:
                    ctx.fillStyle = '#FBBF24'; // jaune
                    break;
                case CASE_TYPES.MONEY:
                    ctx.fillStyle = '#A3E635'; // vert clair
                    break;
                case CASE_TYPES.SAUT:
                    ctx.fillStyle = '#60A5FA'; // bleu clair
                    break;
                case CASE_TYPES.PRISON:
                    ctx.fillStyle = '#F87171'; // rouge clair
                    break;
                case CASE_TYPES.MYSTERE:
                    ctx.fillStyle = '#C084FC'; // violet clair
                    break;
                default:
                    ctx.fillStyle = '#E5E7EB'; // gris
            }
            
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Numéro de la case
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i + 1, x, y);
            
            // Dessiner les joueurs sur cette case
            const playersOnCell = players.filter(p => Math.floor(p.position) === i && !playerAnimations[p.id].animating);
            if (playersOnCell.length > 0) {
                const angleStep = (Math.PI * 2) / playersOnCell.length;
                
                playersOnCell.forEach((player, idx) => {
                    const angle = idx * angleStep;
                    const playerX = x + Math.cos(angle) * (radius * 0.8);
                    const playerY = y + Math.sin(angle) * (radius * 0.8);
                    
                    // Jeton avec ombre
                    ctx.beginPath();
                    ctx.arc(playerX, playerY, radius * 0.5, 0, Math.PI * 2);
                    
                    // Dégradé pour le jeton
                    const gradient = ctx.createRadialGradient(
                        playerX, playerY, radius * 0.2,
                        playerX, playerY, radius * 0.5
                    );
                    gradient.addColorStop(0, lightenColor(player.color, 30));
                    gradient.addColorStop(1, player.color);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();
                    
                    // Contour et effet 3D
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    
                    // Reflet
                    ctx.beginPath();
                    ctx.arc(
                        playerX - radius * 0.15, 
                        playerY - radius * 0.15, 
                        radius * 0.1, 
                        0, 
                        Math.PI * 2
                    );
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.fill();
                    
                    // Initiale du joueur
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${radius * 0.4}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(player.name.charAt(0), playerX, playerY);
                });
            }
        }
        
        // Dessiner les joueurs en animation
        players.forEach((player, idx) => {
            if (playerAnimations[idx].animating) {
                let x, y;
                const animPos = playerAnimations[idx].currentPos;
                
                // Calculer la position en fonction de animPos
                if (animPos < 10) {
                    x = animPos * cellWidth + cellWidth / 2;
                    y = cellHeight / 2;
                } else if (animPos < 16) {
                    x = canvas.width - cellWidth / 2;
                    y = (animPos - 9) * cellHeight + cellHeight / 2;
                } else if (animPos < 26) {
                    x = canvas.width - ((animPos - 15) * cellWidth + cellWidth / 2);
                    y = canvas.height - cellHeight / 2;
                } else if (animPos < 32) {
                    x = cellWidth / 2;
                    y = canvas.height - ((animPos - 25) * cellHeight + cellHeight / 2);
                } else {
                    x = (animPos - 31) * cellWidth + cellWidth / 2;
                    y = cellHeight / 2;
                }
                
                // Jeton animé avec effet de saut
                const jumpHeight = Math.sin((Date.now() - playerAnimations[idx].startTime) / 100) * 15;
                
                ctx.beginPath();
                ctx.arc(x, y - jumpHeight, radius * 0.5, 0, Math.PI * 2);
                
                // Dégradé pour le jeton
                const gradient = ctx.createRadialGradient(
                    x, y - jumpHeight, radius * 0.2,
                    x, y - jumpHeight, radius * 0.5
                );
                gradient.addColorStop(0, lightenColor(player.color, 30));
                gradient.addColorStop(1, player.color);
                
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Contour et effet 3D
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // Reflet
                ctx.beginPath();
                ctx.arc(
                    x - radius * 0.15, 
                    y - jumpHeight - radius * 0.15, 
                    radius * 0.1, 
                    0, 
                    Math.PI * 2
                );
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fill();
                
                // Initiale du joueur
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${radius * 0.4}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(player.name.charAt(0), x, y - jumpHeight);
            }
        });
    }

    // Éclaircir une couleur
    function lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return `#${(
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1)}`;
    }

    // Animation du déplacement
    function animatePlayerMovement(playerIndex, startPos, endPos) {
        playerAnimations[playerIndex] = {
            animating: true,
            targetPos: endPos,
            currentPos: startPos,
            startTime: Date.now(),
            duration: Math.min(1000 + Math.abs(endPos - startPos) * 100, 3000) // 1-3 sec selon distance
        };
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        function animate() {
            const now = Date.now();
            let allDone = true;
            
            playerAnimations.forEach((anim, idx) => {
                if (anim.animating) {
                    const elapsed = now - anim.startTime;
                    const progress = Math.min(elapsed / anim.duration, 1);
                    
                    // Animation en escalier pour simuler le déplacement case par case
                    const steps = Math.abs(anim.targetPos - anim.currentPos);
                    const currentStep = Math.floor(progress * steps);
                    
                    playerAnimations[idx].currentPos = anim.currentPos < anim.targetPos ? 
                        startPos + currentStep : 
                        startPos - currentStep;
                    
                    if (progress < 1) {
                        allDone = false;
                    } else {
                        playerAnimations[idx].animating = false;
                        playerAnimations[idx].currentPos = anim.targetPos;
                        players[idx].position = anim.targetPos;
                        
                        // Vérifier si le joueur a franchi la ligne d'arrivée
                        if (anim.targetPos >= BOARD_SIZE - 1) {
                            players[idx].position = 0;
                            players[idx].laps++;
                            players[idx].money += 1000; // Bonus pour chaque tour complet
                            
                            if (players[idx].laps >= 4) {
                                endGame(idx);
                                return;
                            } else {
                                showMessage(`${players[idx].name} a complété un tour ! +1000$ (${players[idx].laps}/4 tours)`);
                            }
                        }
                    }
                }
            });
            
            drawBoard();
            
            if (!allDone) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                animationFrameId = null;
                checkCellEffect();
            }
        }
        
        animate();
    }

    // Lancer le dé avec animation ThreeJS
    function rollDice() {
        if (!gameStarted || playerAnimations.some(a => a.animating) || isDiceRolling) return;
        
        const currentPlayer = players[currentPlayerIndex];
        
        // Vérifier si le joueur est bloqué
        if (currentPlayer.blockedTurns > 0) {
            currentPlayer.blockedTurns--;
            showMessage(`${currentPlayer.name} est en prison (reste ${currentPlayer.blockedTurns} tour(s))`);
            nextPlayer();
            return;
        }
        
        isDiceRolling = true;
        rollDiceBtn.disabled = true;
        diceContainer.style.display = 'block';
        
        // Animation du dé
        let rolls = 0;
        const maxRolls = 15;
        const rollInterval = setInterval(() => {
            diceValue = Math.floor(Math.random() * 6) + 1;
            diceResultDisplay.textContent = `Dé: ${diceValue}`;
            animateDice();
            rolls++;
            
            if (rolls >= maxRolls) {
                clearInterval(rollInterval);
                diceValue = Math.floor(Math.random() * 6) + 1;
                diceResultDisplay.textContent = `Dé: ${diceValue}`;
                showDiceFace(diceValue);
                
                setTimeout(() => {
                    diceContainer.style.display = 'none';
                    movePlayer(diceValue);
                    isDiceRolling = false;
                }, 1000);
            }
        }, 100);
    }

    // Déplacer le joueur
    function movePlayer(steps) {
        const currentPlayer = players[currentPlayerIndex];
        const startPos = currentPlayer.position;
        let newPos = startPos + steps;
        
        // Si le joueur dépasse la ligne d'arrivée, il recommence au début
        if (newPos >= BOARD_SIZE - 1) {
            newPos = BOARD_SIZE - 1;
        }
        
        animatePlayerMovement(currentPlayerIndex, startPos, newPos);
    }

    // Vérifier l'effet de la case
    function checkCellEffect() {
        const currentPlayer = players[currentPlayerIndex];
        const cell = board[currentPlayer.position];
        
        switch(cell.type) {
            case CASE_TYPES.RELANCER:
                showMessage(`${currentPlayer.name} peut relancer les dés !`);
                rollDiceBtn.disabled = false;
                break;
                
            case CASE_TYPES.MONEY:
                const money = Math.floor(Math.random() * 401) + 100; // 100-500
                currentPlayer.money += money;
                showMessage(`${currentPlayer.name} gagne $${money} !`);
                nextPlayer();
                break;
                
            case CASE_TYPES.SAUT:
                const jump = Math.floor(Math.random() * 6) + 1; // 1-6
                const newPos = Math.min(currentPlayer.position + jump, BOARD_SIZE - 1);
                showMessage(`${currentPlayer.name} saute ${jump} cases !`);
                animatePlayerMovement(currentPlayerIndex, currentPlayer.position, newPos);
                break;
                
            case CASE_TYPES.PRISON:
                currentPlayer.blockedTurns = 2;
                showMessage(`${currentPlayer.name} va en prison pour 2 tours !`);
                nextPlayer();
                break;
                
            case CASE_TYPES.MYSTERE:
                const randomEffect = Math.floor(Math.random() * 3);
                switch(randomEffect) {
                    case 0:
                        showMessage(`${currentPlayer.name} peut relancer les dés (Mystère) !`);
                        rollDiceBtn.disabled = false;
                        break;
                    case 1:
                        const money = Math.floor(Math.random() * 401) + 100;
                        currentPlayer.money += money;
                        showMessage(`${currentPlayer.name} gagne $${money} (Mystère) !`);
                        nextPlayer();
                        break;
                    case 2:
                        const jump = Math.floor(Math.random() * 6) + 1;
                        const newPos = Math.min(currentPlayer.position + jump, BOARD_SIZE - 1);
                        showMessage(`${currentPlayer.name} saute ${jump} cases (Mystère) !`);
                        animatePlayerMovement(currentPlayerIndex, currentPlayer.position, newPos);
                        break;
                }
                break;
                
            default:
                nextPlayer();
        }
        
        updatePlayersInfo();
    }

    // Passer au joueur suivant
    function nextPlayer() {
        rollDiceBtn.disabled = false;
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        updateCurrentPlayerDisplay();
        updatePlayersInfo();
    }

    // Afficher un message
    function showMessage(text) {
        gameMessage.textContent = text;
        gameMessage.classList.remove('hidden');
        
        setTimeout(() => {
            gameMessage.classList.add('hidden');
        }, 2500);
    }

    // Terminer le jeu
    function endGame(winnerIndex) {
        gameStarted = false;
        rollDiceBtn.disabled = true;
        
        setTimeout(() => {
            if (confirm(`${players[winnerIndex].name} a gagné en complétant 4 tours ! Voulez-vous rejouer ?`)) {
                resetGame();
            }
        }, 1000);
    }

    // Réinitialiser le jeu
    function resetGame() {
        initBoard();
        initPlayers(players.length);
        currentPlayerIndex = 0;
        gameStarted = true;
        
        updateCurrentPlayerDisplay();
        updatePlayersInfo();
        drawBoard();
        
        rollDiceBtn.disabled = false;
    }

    // Événements
    startGameBtn.addEventListener('click', startGame);
    rollDiceBtn.addEventListener('click', rollDice);
});