//HUD, Health, Speed
/**
 * UIManager
 * Handles the Heads-Up Display (HUD) overlaying the 3D Canvas.
 * Manages Speedometer, Health Bar, Crosshair, and Score.
 */
class UIManager {
    constructor() {
        // 1. Create the HUD Container
        this.container = document.createElement('div');
        this.container.id = 'game-ui';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // Click-through
        this.container.style.fontFamily = "'Courier New', monospace";
        this.container.style.userSelect = 'none';
        document.body.appendChild(this.container);

        // 2. Initialize Components
        this.setupCrosshair();
        this.setupInfoPanel();
        this.setupHealthBar();
        this.setupGameOverScreen();

        // State tracking to prevent unnecessary DOM updates
        this.lastSpeed = -1;
        this.lastScore = -1;
        this.lastHealth = -1;
    }

    setupCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.width = '20px';
        crosshair.style.height = '20px';
        crosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
        crosshair.style.borderRadius = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        
        // Center dot
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.top = '50%';
        dot.style.left = '50%';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.backgroundColor = 'red';
        dot.style.borderRadius = '50%';
        dot.style.transform = 'translate(-50%, -50%)';
        
        crosshair.appendChild(dot);
        this.container.appendChild(crosshair);
    }

    setupInfoPanel() {
        this.infoPanel = document.createElement('div');
        this.infoPanel.style.position = 'absolute';
        this.infoPanel.style.top = '20px';
        this.infoPanel.style.left = '20px';
        this.infoPanel.style.color = 'white';
        this.infoPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.infoPanel.style.padding = '15px';
        this.infoPanel.style.borderRadius = '8px';

        // Elements for text updates
        this.speedElement = document.createElement('div');
        this.scoreElement = document.createElement('div');
        
        this.infoPanel.appendChild(this.scoreElement);
        this.infoPanel.appendChild(this.speedElement);
        this.container.appendChild(this.infoPanel);
    }

    setupHealthBar() {
        const healthContainer = document.createElement('div');
        healthContainer.style.position = 'absolute';
        healthContainer.style.bottom = '30px';
        healthContainer.style.left = '50%';
        healthContainer.style.transform = 'translateX(-50%)';
        healthContainer.style.width = '300px';
        healthContainer.style.height = '20px';
        healthContainer.style.backgroundColor = '#333';
        healthContainer.style.border = '2px solid white';
        healthContainer.style.borderRadius = '10px';
        healthContainer.style.overflow = 'hidden';

        this.healthFill = document.createElement('div');
        this.healthFill.style.width = '100%';
        this.healthFill.style.height = '100%';
        this.healthFill.style.backgroundColor = '#2ecc71'; // Green
        this.healthFill.style.transition = 'width 0.2s, background-color 0.2s';

        healthContainer.appendChild(this.healthFill);
        this.container.appendChild(healthContainer);
    }

    setupGameOverScreen() {
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.style.position = 'absolute';
        this.gameOverScreen.style.top = '0';
        this.gameOverScreen.style.left = '0';
        this.gameOverScreen.style.width = '100%';
        this.gameOverScreen.style.height = '100%';
        this.gameOverScreen.style.backgroundColor = 'rgba(0,0,0,0.8)';
        this.gameOverScreen.style.display = 'none'; // Hidden by default
        this.gameOverScreen.style.flexDirection = 'column';
        this.gameOverScreen.style.justifyContent = 'center';
        this.gameOverScreen.style.alignItems = 'center';
        this.gameOverScreen.style.color = 'white';

        const title = document.createElement('h1');
        title.innerText = 'MISSION FAILED';
        title.style.fontSize = '48px';
        title.style.color = '#e74c3c';

        const restartHint = document.createElement('p');
        restartHint.innerText = 'Press R to Restart';
        restartHint.style.fontSize = '24px';

        this.gameOverScreen.appendChild(title);
        this.gameOverScreen.appendChild(restartHint);
        this.container.appendChild(this.gameOverScreen);
    }

    /**
     * Called every frame to update UI values
     * @param {Number} speed - Current player speed
     * @param {Number} health - Current player health (0-100)
     * @param {Number} score - Number of enemies destroyed
     */
    update(speed, health, score) {
        // Optimize: Only update DOM if values changed
        
        // 1. Update Speed
        const displaySpeed = Math.floor(speed * 100); // Convert internal unit to "knots"
        if (displaySpeed !== this.lastSpeed) {
            this.speedElement.innerText = `SPEED: ${displaySpeed} KM/H`;
            this.lastSpeed = displaySpeed;
        }

        // 2. Update Score
        if (score !== this.lastScore) {
            this.scoreElement.innerText = `TARGETS NEUTRALIZED: ${score}`;
            this.lastScore = score;
        }

        // 3. Update Health Bar
        if (health !== this.lastHealth) {
            this.healthFill.style.width = `${Math.max(0, health)}%`;
            
            // Change color based on health level
            if (health < 30) this.healthFill.style.backgroundColor = '#e74c3c'; // Red
            else if (health < 60) this.healthFill.style.backgroundColor = '#f1c40f'; // Yellow
            else this.healthFill.style.backgroundColor = '#2ecc71'; // Green
            
            this.lastHealth = health;
        }
    }

    showGameOver() {
        this.gameOverScreen.style.display = 'flex';
    }

    hideGameOver() {
        this.gameOverScreen.style.display = 'none';
    }
}