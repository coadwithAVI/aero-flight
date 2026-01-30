const GameManager = {
    _initialized: false,
    data: {
        music: true,
        sfx: true,
        musicVolume: 0.5,
        sfxVolume: 0.8,
        bindings: { 
            up: 'w', down: 's', left: 'a', right: 'd', boost: 'space', fire: 'shift' 
        }
    },

    init: function() {
        if (this._initialized) return;
        this.load();
        this.apply();
        this._initialized = true;
    },

    load: function() {
        const saved = localStorage.getItem('sky_pilot_settings');
        if (!saved) return;

        try { 
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                // 1) Hardened Volume Check: Handles empty strings and non-finite values
                const vMusic = Number(parsed.musicVolume);
                const vSfx = Number(parsed.sfxVolume);
                
                if (typeof parsed.music === 'boolean') this.data.music = parsed.music;
                if (typeof parsed.sfx === 'boolean') this.data.sfx = parsed.sfx;
                
                if (Number.isFinite(vMusic)) this.data.musicVolume = Math.max(0, Math.min(1, vMusic));
                if (Number.isFinite(vSfx)) this.data.sfxVolume = Math.max(0, Math.min(1, vSfx));

                if (parsed.bindings && typeof parsed.bindings === 'object') {
                    Object.keys(this.data.bindings).forEach(key => {
                        // 2) Null/Undefined check to ensure we don't skip valid keys
                        if (parsed.bindings[key] != null) {
                            this.data.bindings[key] = String(parsed.bindings[key]);
                        }
                    });
                }
            }
        } 
        catch (e) { 
            console.warn("Settings corrupted, resetting..."); 
            localStorage.removeItem('sky_pilot_settings');
        }
    },

    save: function() {
        localStorage.setItem('sky_pilot_settings', JSON.stringify(this.data));
        this.apply();
    },

    apply: function() {
        // MUSIC SYNC
        if (window.MusicManager && typeof MusicManager.updateState === 'function') {
            MusicManager.updateState(this.data.music, this.data.musicVolume);
        }
        
        // 4) SFX SYNC: Avoids injection. If Manager isn't ready, we don't force it.
        // We update the Manager's internal state if it exists.
        if (window.SFXManager) {
            if (typeof SFXManager.updateState === 'function') {
                SFXManager.updateState(this.data.sfx, this.data.sfxVolume);
            } else {
                // Fallback for older SFXManager versions
                SFXManager.enabled = this.data.sfx;
                SFXManager.volume = this.data.sfxVolume;
            }
        }
    },

    setVolume: function(type, value) {
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) return; // 1) Strict check

        const clamped = Math.max(0, Math.min(1, numValue));
        if (type === 'music') this.data.musicVolume = clamped;
        if (type === 'sfx') this.data.sfxVolume = clamped;
        this.save();
    },

    saveBinding: function(action, key) {
        if (!(action in this.data.bindings) || typeof key !== 'string' || key.trim() === '') return;

        let normalizedKey = key.toLowerCase();
        
        // 3) Normalization: Handled simply. If e.code 'Space' comes in, it becomes 'space'
        if (normalizedKey === ' ' || normalizedKey === 'space') normalizedKey = 'space';

        const existingActions = Object.keys(this.data.bindings);
        const duplicateAction = existingActions.find(a => this.data.bindings[a] === normalizedKey);

        if (duplicateAction && duplicateAction !== action) {
            console.warn(`Key "${normalizedKey}" is already bound to "${duplicateAction}"`);
            return;
        }

        this.data.bindings[action] = normalizedKey;
        this.save();
    }
};

GameManager.init();
