require('dotenv').config();
const express = require('express');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API XeroDash (Natif) en ligne sur http://localhost:${PORT}`);
});