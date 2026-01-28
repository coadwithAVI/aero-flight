// ==========================================
// SKY PILOT - GLOBAL GAME MANAGER
// ==========================================
// Ye file automatically settings load karegi aur save karegi.
// Isko har HTML file ke <head> mein add karna hai.

const GameManager = {
    // Default Controls (Agar user ne kabhi change nahi kiya)
    defaultBindings: { 
        up: 'w', 
        down: 's', 
        left: 'a', 
        right: 'd', 
        boost: ' ', 
        fire: 'shift' 
    },

    // Current State (Ye poore game mein use honge)
    data: {
        music: true,
        sfx: true,
        bindings: {}
    },

    // 1. Initialize (Load from Storage)
    init: function() {
        console.log("GameManager: Loading settings...");

        // Load Music (Default ON)
        const savedMusic = localStorage.getItem('skyPilot_music');
        this.data.music = savedMusic !== 'OFF'; // Agar 'OFF' nahi hai, toh ON rahega

        // Load SFX (Default ON)
        const savedSfx = localStorage.getItem('skyPilot_sfx');
        this.data.sfx = savedSfx !== 'OFF';

        // Load Controls
        const savedBinds = localStorage.getItem('skyPilot_bindings');
        if (savedBinds) {
            try {
                this.data.bindings = JSON.parse(savedBinds);
            } catch (e) {
                console.error("GameManager: Corrupt bindings, resetting to default.");
                this.data.bindings = { ...this.defaultBindings };
            }
        } else {
            this.data.bindings = { ...this.defaultBindings };
        }
    },

    // 2. Save Functions (Settings page isko call karega)
    setMusic: function(isOn) {
        this.data.music = isOn;
        localStorage.setItem('skyPilot_music', isOn ? 'ON' : 'OFF');
    },

    setSfx: function(isOn) {
        this.data.sfx = isOn;
        localStorage.setItem('skyPilot_sfx', isOn ? 'ON' : 'OFF');
    },

    saveBinding: function(action, key) {
        this.data.bindings[action] = key.toLowerCase();
        localStorage.setItem('skyPilot_bindings', JSON.stringify(this.data.bindings));
    },

    // 3. Reset to Default
    resetSettings: function() {
        this.data.bindings = { ...this.defaultBindings };
        this.setMusic(true);
        this.setSfx(true);
        localStorage.setItem('skyPilot_bindings', JSON.stringify(this.data.bindings));
    }
};

// Run automatically when file loads
GameManager.init();