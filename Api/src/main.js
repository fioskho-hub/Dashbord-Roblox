require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

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

    const filePath = path.join(DATA_DIR, `${serverId}.json`);

    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        let config = {};

        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            config = JSON.parse(rawData);
        }

        config.serverId = serverId;
        config.robloxToken = token;

        if (!config.bans) config.bans = [];
        if (!config.staffRoles) config.staffRoles = [];
        if (!config.games) config.games = [];

        fs.writeFileSync(filePath, JSON.stringify(config, null, 4), 'utf-8');

        console.log(`[XeroDash] Configuration sauvegardée : data/${serverId}.json`);
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

    const filePath = path.join(DATA_DIR, `${serverId}.json`);

    if (!fs.existsSync(filePath)) {
        return res.json({
            success: true,
            exists: false,
            config: {
                serverId: serverId,
                robloxToken: "Aucun token généré",
                bans: [],
                staffRoles: [],
                games: []
            }
        });
    }

    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(rawData);

        return res.json({
            success: true,
            exists: true,
            config: config
        });

    } catch (error) {
        console.error("Erreur lors de la lecture du fichier JSON :", error.message);
        return res.status(500).json({ error: "Erreur lors de la récupération de la configuration." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API XeroDash (Natif) en ligne sur http://localhost:${PORT}`);
});