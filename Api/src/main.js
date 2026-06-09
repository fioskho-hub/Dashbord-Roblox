require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("ngrok-skip-browser-warning", "true");
    next();
});

app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

// Dashboard
app.post('/api/auth/discord', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Code d'autorisation manquant." });
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error("Erreur Discord Token:", tokenData);
            return res.status(400).json({ error: tokenData.error_description });
        }

        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userData = await userResponse.json();

        const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const guildsData = await guildsResponse.json();

        res.json({
            user: userData,
            guilds: guildsData
        });

    } catch (error) {
        console.error("Erreur serveur API:", error.message);
        res.status(500).json({ error: "Impossible de valider la connexion." });
    }
});

app.post('/api/server/token', (req, res) => {
    const { serverId, token } = req.body;

    if (!serverId || !token) {
        return res.status(400).json({ error: "Données manquantes (serverId ou token)." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const filePath = path.join(serverDir, `config.json`);

    try {
        if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir, { recursive: true });
        }

        let fileData = {};

        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            fileData = JSON.parse(rawData);
        }

        fileData.serverId = serverId;
        fileData.robloxToken = token;

        if (!fileData.config) fileData.config = {};
        if (!fileData.config.bans) fileData.config.bans = [];
        if (!fileData.config.staffRoles) fileData.config.staffRoles = [];
        if (!fileData.config.games) fileData.config.games = [];

        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 4), 'utf-8');

        console.log(`[XeroDash] Configuration enregistrée : data/${serverId}/config.json`);
        return res.json({ success: true, message: "Le token a bien été enregistré !" });
    } catch (error) {
        console.error("Erreur lors de la gestion du fichier JSON :", error.message);
        return res.status(500).json({ error: "Erreur interne du serveur lors de l'écriture." });
    }
});

app.get('/api/server/config/:serverId', (req, res) => {
    const { serverId } = req.params;

    if (!serverId) {
        return res.status(400).json({ error: "ID du serveur manquant." });
    }

    const filePath = path.join(DATA_DIR, `${serverId}`, `config.json`);

    if (!fs.existsSync(filePath)) {
        return res.json({
            success: true,
            exists: false,
            config: {
                serverId: serverId,
                robloxToken: "Aucun token généré",
                config: { bans: [], staffRoles: [], games: [] }
            }
        });
    }

    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const fileData = JSON.parse(rawData);

        if (!fileData.config || !fileData.config.bans) {
            fileData.config = {
                bans: fileData.bans || [],
                staffRoles: fileData.staffRoles || [],
                games: fileData.games || []
            };
            delete fileData.bans;
            delete fileData.staffRoles;
            delete fileData.games;
        }

        return res.json({
            success: true,
            exists: true,
            config: fileData
        });

    } catch (error) {
        console.error("Erreur lors de la lecture du fichier JSON :", error.message);
        return res.status(500).json({ error: "Erreur lors de la récupération de la configuration." });
    }
});

app.get('/api/server/bans/:serverId', (req, res) => {
    const { serverId } = req.params;
    const bansPath = path.join(DATA_DIR, `${serverId}`, `bans.json`);

    if (!fs.existsSync(bansPath)) {
        return res.json({ success: true, bans: {} });
    }

    try {
        const bansData = JSON.parse(fs.readFileSync(bansPath, 'utf-8'));
        return res.json({ success: true, bans: bansData });
    } catch (error) {
        return res.status(500).json({ error: "Erreur lors de la lecture des bans." });
    }
});

app.delete('/api/server/bans/unban', (req, res) => {
    const { serverId, userId } = req.body;

    if (!serverId || !userId) {
        return res.status(400).json({ error: "Données manquantes." });
    }

    const bansPath = path.join(DATA_DIR, `${serverId}`, `bans.json`);

    if (!fs.existsSync(bansPath)) return res.status(404).json({ error: "Aucun ban trouvé." });

    try {
        let bansData = JSON.parse(fs.readFileSync(bansPath, 'utf-8'));
        const targetKey = String(userId).trim();

        if (bansData[targetKey]) {
            delete bansData[targetKey]; 
            fs.writeFileSync(bansPath, JSON.stringify(bansData, null, 4), 'utf-8');
            return res.json({ success: true, message: "Joueur débanni avec succès !" });
        } else {
            return res.status(404).json({ error: "Ce joueur n'est pas banni." });
        }
    } catch (error) {
        return res.status(500).json({ error: "Erreur lors du débannissement." });
    }
});

app.post('/api/server/control', (req, res) => {
    const { serverId, scope, jobId, action, message } = req.body;

    if (!serverId || !action || !scope) {
        return res.status(400).json({ error: "Données manquantes (serverId, action ou scope)." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    if (!fs.existsSync(serverDir)) {
        return res.status(404).json({ error: "Ce serveur n'a aucune donnée active." });
    }

    try {
        const orderPayload = {
            type: action, 
            message: message || "",
            timestamp: Date.now()
        };

        if (scope === "single" && jobId) {
            const actionsPath = path.join(serverDir, `${jobId}_actions.json`);
            let actionsData = { kick: [], ban: [], serverOrders: [] };

            if (fs.existsSync(actionsPath)) {
                actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
                if (!actionsData.serverOrders) actionsData.serverOrders = [];
            }

            actionsData.serverOrders.push(orderPayload);
            fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 4), 'utf-8');
            
            console.log(`[XeroDash] Ordre [${action.toUpperCase()}] enregistré pour le serveur ${jobId}`);
            return res.json({ success: true, message: `L'ordre de ${action} a été envoyé au serveur ciblé.` });
        }

        if (scope === "all") {
            const files = fs.readdirSync(serverDir);
            let targetServersCount = 0;

            files.forEach(file => {
                if (file !== 'config.json' && file !== 'bans.json' && file.endsWith('.json') && !file.includes('_actions')) {
                    const activeJobId = file.replace('.json', '');
                    const actionsPath = path.join(serverDir, `${activeJobId}_actions.json`);
                    
                    let actionsData = { kick: [], ban: [], serverOrders: [] };
                    if (fs.existsSync(actionsPath)) {
                        actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
                        if (!actionsData.serverOrders) actionsData.serverOrders = [];
                    }

                    actionsData.serverOrders.push(orderPayload);
                    fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 4), 'utf-8');
                    targetServersCount++;
                }
            });

            console.log(`[XeroDash] Ordre GLOBAL [${action.toUpperCase()}] envoyé à ${targetServersCount} serveurs.`);
            return res.json({ success: true, message: `L'ordre de ${action} a été envoyé sur l'ensemble des serveurs (${targetServersCount}).` });
        }

        return res.status(400).json({ error: "Scope invalide ou JobId manquant." });

    } catch (error) {
        console.error("Erreur Route Control:", error.message);
        return res.status(500).json({ error: "Erreur interne lors du traitement de l'ordre." });
    }
});

// Roblox & dasboard

app.post('/api/server-roblox/kick', (req, res) => {
    const { serverId, playersId, jobId, reason } = req.body; 

    if (!serverId || !playersId || !jobId) {
        return res.status(400).json({ error: "Données manquantes." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const actionsPath = path.join(serverDir, `${jobId}_actions.json`);

    try {
        let actionsData = { kick: [], ban: [] };

        if (fs.existsSync(actionsPath)) {
            const fileContent = fs.readFileSync(actionsPath, 'utf-8');
            actionsData = JSON.parse(fileContent);
            if (!actionsData.kick) actionsData.kick = [];
            if (!actionsData.ban) actionsData.ban = [];
        }

        const targetUserId = parseInt(playersId, 10);
        const kickReason = reason || "Aucune raison fournie";

        const alreadyExists = actionsData.kick.some(k => k.userId === targetUserId);
        if (!alreadyExists) {
            actionsData.kick.push({ userId: targetUserId, reason: kickReason });
        }

        fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 4), 'utf-8');
        console.log(`[XeroDash] Kick enregistré pour ${targetUserId} (Raison: ${kickReason})`);
        return res.json({ success: true, message: "Ordre d'expulsion enregistré !" });
    } catch (error) {
        return res.status(500).json({ error: "Erreur lors du kick." });
    }
});

app.post('/api/server-roblox/ban', (req, res) => {
    const { serverId, playersId, jobId, reason } = req.body; 

    if (!serverId || !playersId || !jobId) {
        return res.status(400).json({ error: "Données manquantes pour effectuer le ban." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const bansPath = path.join(serverDir, `bans.json`);
    const actionsPath = path.join(serverDir, `${jobId}_actions.json`);

    try {
        const targetUserId = String(playersId).trim(); 
        const banReason = reason || "Aucune raison fournie";

        if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir, { recursive: true });
        }

        let bansData = {};
        if (fs.existsSync(bansPath)) {
            bansData = JSON.parse(fs.readFileSync(bansPath, 'utf-8'));
        }

        bansData[targetUserId] = {
            reason: banReason,
            date: Date.now()
        };

        fs.writeFileSync(bansPath, JSON.stringify(bansData, null, 4), 'utf-8');
        console.log(`[XeroDash] ${targetUserId} ajouté au dictionnaire bans.json`);

        let actionsData = { kick: [], ban: [] };
        if (fs.existsSync(actionsPath)) {
            actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
            if (!actionsData.kick) actionsData.kick = [];
            if (!actionsData.ban) actionsData.ban = [];
        }

        const alreadyInActions = actionsData.ban.some(b => String(b.userId) === targetUserId);
        if (!alreadyInActions) {
            actionsData.ban.push({ userId: parseInt(targetUserId, 10), reason: banReason });
            fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 4), 'utf-8');
        }

        return res.json({ success: true, message: "Le joueur a été banni définitivement !" });

    } catch (error) {
        console.error("Erreur Route Ban:", error.message);
        return res.status(500).json({ error: "Erreur interne lors de l'application du ban." });
    }
});

app.post('/api/roblox/actions', (req, res) => {
    const { serverId, token, jobId } = req.body;

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const configPath = path.join(serverDir, `config.json`);
    const actionsPath = path.join(serverDir, `${jobId}_actions.json`);

    if (!fs.existsSync(configPath)) return res.status(404).json({ error: "Configuration introuvable." });

    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configData.robloxToken !== token) return res.status(401).json({ error: "Token invalide." });

        let playersToKick = [];
        let playersToBan = [];

        if (fs.existsSync(actionsPath)) {
            const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
            playersToKick = actionsData.kick || [];
            playersToBan = actionsData.ban || [];
            
            fs.unlinkSync(actionsPath); 
            console.log(`[XeroDash] Actions (Kick: ${playersToKick.length} | Ban: ${playersToBan.length}) envoyées à Roblox.`);
        }

        return res.json({ 
            success: true, 
            kick: playersToKick,
            ban: playersToBan 
        });
    } catch (error) {
        return res.status(500).json({ error: "Erreur lors de la récupération des actions." });
    }
});

// Roblox
app.post('/api/roblox/heartbeat', (req, res) => {
    const { serverId, token, jobId, players } = req.body;

    if (!serverId || !token || !jobId) {
        return res.status(400).json({ error: "Données manquantes (serverId, token ou jobId)." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const configPath = path.join(serverDir, `config.json`);
    const jobPath = path.join(serverDir, `${jobId}.json`);

    if (!fs.existsSync(configPath)) {
        return res.status(404).json({ error: "Serveur non configuré sur le site web." });
    }

    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configData.robloxToken !== token) {
            return res.status(401).json({ error: "Token invalide." });
        }

        if (!players || players.length === 0) {
            if (fs.existsSync(jobPath)) {
                fs.unlinkSync(jobPath); 
                console.log(`[XeroDash] Serveur Roblox vide ou fermé. Fichier détruit : ${serverId}/${jobId}.json`);
            }
            return res.json({ success: true, message: "Instance nettoyée avec succès." });
        }

        const jobData = {
            jobId: jobId,
            lastUpdate: Date.now(),
            players: players
        };

        fs.writeFileSync(jobPath, JSON.stringify(jobData, null, 4), 'utf-8');
        return res.json({ success: true, message: `Fichier de session ${jobId}.json actualisé.` });

    } catch (error) {
        console.error("Erreur lors de l'exécution du Heartbeat :", error.message);
        return res.status(500).json({ error: "Erreur lors de la mise à jour du JSON d'instance." });
    }
});

app.get('/api/server/players/:serverId', (req, res) => {
    const { serverId } = req.params;
    const serverDir = path.join(DATA_DIR, `${serverId}`);

    if (!fs.existsSync(serverDir)) {
        return res.json({ success: true, players: [] });
    }

    try {
        let allPlayers = [];
        const files = fs.readdirSync(serverDir);

        files.forEach(file => {
            if (file !== 'config.json' && file.endsWith('.json')) {
                const filePath = path.join(serverDir, file);
                const fileRaw = fs.readFileSync(filePath, 'utf-8');
                const jobData = JSON.parse(fileRaw);

                if (jobData.players && Array.isArray(jobData.players)) {
                    jobData.players.forEach(player => {
                        allPlayers.push({
                            name: player.name,
                            userId: player.userId,
                            jobId: jobData.jobId
                        });
                    });
                }
            }
        });

        return res.json({ success: true, players: allPlayers });
    } catch (error) {
        console.error("Erreur lors du scan des joueurs :", error.message);
        return res.status(500).json({ error: "Erreur lors de la récupération globale des joueurs." });
    }
});

app.post('/api/roblox/check-ban', (req, res) => {
    const { serverId, token, userId } = req.body;

    if (!serverId || !token || !userId) {
        return res.status(400).json({ error: "Données manquantes pour la vérification." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const configPath = path.join(serverDir, `config.json`);
    const bansPath = path.join(serverDir, `bans.json`);

    if (!fs.existsSync(configPath)) return res.status(404).json({ error: "Serveur non configuré." });

    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configData.robloxToken !== token) {
            return res.status(401).json({ error: "Authentification Roblox échouée." });
        }

        if (!fs.existsSync(bansPath)) {
            return res.json({ success: true, banned: false });
        }

        const bansData = JSON.parse(fs.readFileSync(bansPath, 'utf-8'));
        const targetUserId = String(userId).trim();

        const banInfo = bansData[targetUserId];

        if (banInfo) {
            return res.json({
                success: true,
                banned: true,
                reason: banInfo.reason
            });
        }

        return res.json({ success: true, banned: false });

    } catch (error) {
        console.error("Erreur Route Check-Ban:", error.message);
        return res.status(500).json({ error: "Erreur lors de la vérification des listes de ban." });
    }
});

app.post('/api/roblox/actions', (req, res) => {
    const { serverId, token, jobId } = req.body;

    if (!serverId || !token || !jobId) {
        return res.status(400).json({ error: "Données manquantes." });
    }

    const serverDir = path.join(DATA_DIR, `${serverId}`);
    const configPath = path.join(serverDir, `config.json`);
    const actionsPath = path.join(serverDir, `${jobId}_actions.json`);

    if (!fs.existsSync(configPath)) return res.status(404).json({ error: "Configuration introuvable." });

    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configData.robloxToken !== token) return res.status(401).json({ error: "Token invalide." });

        let playersToKick = [];
        let playersToBan = [];
        let serverOrders = [];

        if (fs.existsSync(actionsPath)) {
            const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
            playersToKick = actionsData.kick || [];
            playersToBan = actionsData.ban || [];
            serverOrders = actionsData.serverOrders || []; 
            
            fs.unlinkSync(actionsPath); 
            console.log(`[XeroDash] Package d'actions envoyé à Roblox pour l'instance ${jobId} (Kicks: ${playersToKick.length} | Bans: ${playersToBan.length} | Ordres: ${serverOrders.length})`);
        }

        return res.json({ 
            success: true, 
            kick: playersToKick,
            ban: playersToBan,
            orders: serverOrders 
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des actions :", error.message);
        return res.status(500).json({ error: "Erreur lors de la récupération des actions." });
    }
});



/// RUN

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API XeroDash (Natif) en ligne sur http://localhost:${PORT}`);
});