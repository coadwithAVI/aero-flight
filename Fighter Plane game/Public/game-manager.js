const GameManager = {
    state: {
        musicVolume: 0.5,
        sfxVolume: 0.8,
        isMusicOn: true,
        isSfxOn: true,
        bindings: { up:'w', down:'s', left:'a', right:'d', boost:' ', fire:'shift' }
    },

    init: function() {
        this.load();
    },

    load: function() {
        const saved = localStorage.getItem('sky_pilot_settings');
        if (saved) {
            try { this.state = { ...this.state, ...JSON.parse(saved) }; } 
            catch (e) { console.warn("Settings reset"); }
        }
    },

    save: function() {
        localStorage.setItem('sky_pilot_settings', JSON.stringify(this.state));
        // Real-time sync triggers
        if(window.MusicManager) MusicManager.updateState(this.state.isMusicOn);
    },

    setMusic: function(isOn) {
        this.state.isMusicOn = isOn;
        this.save();
    },

    setSfx: function(isOn) {
        this.state.isSfxOn = isOn;
        this.save();
    },
    
    setBinding: function(action, key) {
        this.state.bindings[action] = key.toLowerCase();
        this.save();
    }
};
GameManager.init();
