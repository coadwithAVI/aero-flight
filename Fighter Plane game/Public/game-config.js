// ==========================================

// SKY PILOT - GAME CONFIGURATION

// ==========================================

// Change variables here to update BOTH Singleplayer and Multiplayer



// --- GRAPHICS ---

const TERRAIN_COLORS = { 

    WATER: 0x1E90FF, 

    SAND: 0xEEDD82, 

    GRASS: 0x556B2F, 

    ROCK: 0x808080, 

    SNOW: 0xFFFFFF 

};



// --- FLIGHT PHYSICS ---

const NORMAL_SPEED = 6.5;

const BOOST_SPEED  = 14.5;

const TURN_SPEED   = 0.05;

const LIFT_SPEED   = 3.5;



// --- GAMEPLAY RULES ---

const RINGS_PER_LAP = 4;

const TOTAL_LAPS = 2;

const TOTAL_RINGS_WIN = RINGS_PER_LAP * TOTAL_LAPS;



// --- STATS ---

const BOOST_DRAIN = 0.8;      // Kitna fast boost khatam hoga

const BOOST_REFILL = 0.3;     // Kitna fast wapis bharega

const COLLISION_DAMAGE = 0.6; // Zameen se takraane par damage

const FIRE_RATE = 100;        // Milliseconds between shots



game-manager.js->// ==========================================

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
