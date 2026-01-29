/**
 * SKY PILOT - GAME MANAGER
 * Handles Save Data, Settings, and Keybindings.
 * Acts as a Singleton (Globally accessible).
 */

const GameManager = {
    // Default Config
    state: {
        musicVolume: 0.5,
        sfxVolume: 0.8,
        isMusicOn: true,
        isSfxOn: true,
        // WASD + Space + Shift
        bindings: {
            up: 'w',
            down: 's',
            left: 'a',
            right: 'd',
            boost: ' ',
            fire: 'shift'
        }
    },

    // --- 1. INITIALIZATION ---
    init: function() {
        console.log("⚙️ GameManager: Initializing...");
        this.loadSettings();
    },

    // --- 2. STORAGE LOGIC ---
    loadSettings: function() {
        const saved = localStorage.getItem('skyPilot_v2_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved data with defaults (safety for updates)
                this.state = { ...this.state, ...parsed };
                console.log("✅ Settings Loaded");
            } catch (e) {
                console.warn("⚠️ Corrupt settings, resetting to default.");
                this.saveSettings();
            }
        } else {
            this.saveSettings();
        }
    },

    saveSettings: function() {
        localStorage.setItem('skyPilot_v2_settings', JSON.stringify(this.state));
    },

    // --- 3. CONTROLS API ---
    
    // Gets the key for a specific action (e.g., 'up' -> 'w')
    getKeyForAction: function(action) {
        return this.state.bindings[action];
    },

    // Rebind a key safely
    setBinding: function(action, key) {
        if (!this.state.bindings.hasOwnProperty(action)) return;
        
        const safeKey = key.toLowerCase();
        this.state.bindings[action] = safeKey;
        this.saveSettings();
        console.log(`Binding Updated: ${action} = ${safeKey}`);
    },

    // --- 4. AUDIO SETTINGS ---
    toggleMusic: function() {
        this.state.isMusicOn = !this.state.isMusicOn;
        this.saveSettings();
        // Notify MusicManager if it exists
        if (window.MusicManager) window.MusicManager.updateState(this.state.isMusicOn);
        return this.state.isMusicOn;
    },

    toggleSfx: function() {
        this.state.isSfxOn = !this.state.isSfxOn;
        this.saveSettings();
        return this.state.isSfxOn;
    }
};

// Auto-initialize when file loads
GameManager.init();

// Export to window
window.GameManager = GameManager;
