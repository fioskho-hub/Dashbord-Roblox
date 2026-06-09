document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 0. SÉCURITÉ : VÉRIFICATION AUTH + USER INFO
    // ==========================================
    const storedUser   = sessionStorage.getItem('xero_user');
    const storedGuilds = sessionStorage.getItem('xero_guilds');

    if (!storedUser || !storedGuilds) {
        alert("Accès refusé : Veuillez vous connecter avec Discord.");
        window.location.href = "login.html";
        return;
    }

    const user   = JSON.parse(storedUser);
    const guilds = JSON.parse(storedGuilds);

    // Affiche le nom et l'avatar dans la navbar
    const usernameEl = document.getElementById('username');
    const avatarEl   = document.getElementById('user-avatar');
    if (usernameEl) usernameEl.innerText = user.username;
    if (avatarEl && user.avatar) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }

    // ==========================================
    // 1. RÉCUPÉRATION DE L'ID DU SERVEUR
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const serverId  = urlParams.get('id');

    if (!serverId) {
        window.location.href = "serverlist.html";
        return;
    }

    // Vérifie que l'utilisateur fait bien partie de ce serveur
    const targetGuild = guilds.find(g => g.id === serverId);
    if (!targetGuild) {
        alert("Accès refusé : Vous ne faites pas partie de ce serveur Discord.");
        window.location.href = "serverlist.html";
        return;
    }

    // Vérifie qu'il est bien admin/owner
    const perms    = BigInt(targetGuild.permissions || 0);
    const isOwner  = targetGuild.owner === true;
    const isAdmin  = (perms & BigInt(0x8)) === BigInt(0x8);
    if (!isOwner && !isAdmin) {
        alert("Accès refusé : Vous n'avez pas les permissions suffisantes.");
        window.location.href = "serverlist.html";
        return;
    }

    // Affichage de l'ID du serveur
    const serverIdDisplay = document.getElementById('server-id-display');
    const serverTitle     = document.getElementById('server-title');
    if (serverIdDisplay) serverIdDisplay.innerText = serverId;
    if (serverTitle)     serverTitle.innerText = `Configuration du serveur`;

    // ==========================================
    // VARIABLES D'ÉTAT
    // ==========================================
    let currentServerToken = "Aucun token généré";
    let activePlayers      = [];
    let bannedPlayers      = {};

    // ==========================================
    // GÉNÉRATEURS DE TABLEAUX (JOUEURS & BANS)
    // ==========================================
    function generatePlayersTableHTML(title, description) {
        if (activePlayers.length === 0) {
            return `
                <div class="panel-section">
                    <h3><i class="fa-solid fa-users"></i> ${title}</h3>
                    <p style="color: #99aab5; margin-bottom: 20px;">${description}</p>
                    <div style="text-align: center; padding: 40px; color: #72767d; background: #1a1c1e; border-radius: 8px; border: 1px dashed #4f545c;">
                        <i class="fa-solid fa-gamepad" style="font-size: 40px; margin-bottom: 15px;"></i>
                        <p>Aucun joueur n'est connecté pour le moment.</p>
                    </div>
                </div>
            `;
        }

        const rows = activePlayers.map(player => `
            <tr class="player-row" data-username="${player.name}" data-userid="${player.userId}" style="cursor: pointer;">
                <td style="padding: 12px; font-weight: 600; color: #fff;">
                    ${player.name} <span style="color: #72767d; font-size: 12px;">(${player.userId})</span>
                </td>
                <td style="padding: 12px; font-family: monospace; color: #5865F2;">${player.jobId}</td>
                <td style="padding: 12px; text-align: right;">
                    <button class="action-trigger-btn" style="background: #5865F2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        <i class="fa-solid fa-gavel"></i> Sanctionner
                    </button>
                </td>
            </tr>
        `).join('');

        return `
            <div class="panel-section">
                <h3><i class="fa-solid fa-users"></i> ${title}</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">${description}</p>
                <table style="width: 100%; border-collapse: collapse; background: #2f3136; border-radius: 8px; overflow: hidden;">
                    <thead style="background: #23272a;">
                        <tr>
                            <th style="padding: 12px; text-align: left;">Joueur (Roblox)</th>
                            <th style="padding: 12px; text-align: left;">Serveur ID (JobId)</th>
                            <th style="padding: 12px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    function generateBansTableHTML() {
        const banKeys = Object.keys(bannedPlayers);
        if (banKeys.length === 0) {
            return `
                <div class="panel-section">
                    <h3><i class="fa-solid fa-ban"></i> Liste des Joueurs Bannis</h3>
                    <p style="color: #99aab5; margin-bottom: 20px;">Historique global des bannissements définitifs enregistrés.</p>
                    <div style="text-align: center; padding: 40px; color: #72767d; background: #1a1c1e; border-radius: 8px; border: 1px dashed #4f545c;">
                        <i class="fa-solid fa-shield-halved" style="font-size: 40px; margin-bottom: 15px;"></i>
                        <p>Aucun joueur n'est banni de ce serveur.</p>
                    </div>
                </div>
            `;
        }

        const rows = banKeys.map(userId => {
            const info = bannedPlayers[userId];
            const readableDate = new Date(info.date).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            return `
                <tr>
                    <td style="padding: 12px; font-weight: 600; color: #f04747; font-family: monospace;">${userId}</td>
                    <td style="padding: 12px; color: #dcddde;">${info.reason}</td>
                    <td style="padding: 12px; color: #72767d; font-size: 13px;">${readableDate}</td>
                    <td style="padding: 12px; text-align: right;">
                        <button class="unban-btn" data-userid="${userId}" style="background: #43b581; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            <i class="fa-solid fa-heart-circle-check"></i> Unban
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="panel-section">
                <h3><i class="fa-solid fa-ban"></i> Liste des Joueurs Bannis</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">Gestion des utilisateurs inscrits dans le fichier de bannissement.</p>
                <table style="width: 100%; border-collapse: collapse; background: #2f3136; border-radius: 8px; overflow: hidden;">
                    <thead style="background: #23272a;">
                        <tr>
                            <th style="padding: 12px; text-align: left;">UserId (Roblox)</th>
                            <th style="padding: 12px; text-align: left;">Raison du Ban</th>
                            <th style="padding: 12px; text-align: left;">Date du Ban</th>
                            <th style="padding: 12px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    // ==========================================
    // GÉNÉRATEUR DE L'ONGLET SERVEURS (NOUVEAU)
    // ==========================================
    function generateServersManagementHTML() {
        // On extrait la liste des JobIds uniques actuellement actifs grâce aux joueurs connectés
        const activeJobIds = [...new Set(activePlayers.map(p => p.jobId).filter(id => id))];

        let singleServersHTML = '';
        if (activeJobIds.length === 0) {
            singleServersHTML = `
                <div style="text-align: center; padding: 25px; color: #72767d; background: #1a1c1e; border-radius: 6px; border: 1px dashed #4f545c;">
                    Aucun serveur actif à gérer individuellement.
                </div>
            `;
        } else {
            singleServersHTML = activeJobIds.map((jobId, index) => {
                // Compter combien de joueurs sont sur ce serveur spécifique
                const playerCount = activePlayers.filter(p => p.jobId === jobId).length;
                return `
                    <div class="server-card" style="background: #1a1c1e; border: 1px solid #4f545c; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-weight: bold; color: #fff;"><i class="fa-solid fa-gamepad" style="color: #43b581;"></i> Instance #${index + 1}</span>
                            <span style="font-size: 12px; background: #2f3136; padding: 4px 8px; border-radius: 4px; color: #b9bbbe;">
                                <i class="fa-solid fa-users"></i> ${playerCount} Joueur(s)
                            </span>
                        </div>
                        <div style="font-family: monospace; font-size: 11px; color: #72767d; margin-bottom: 15px; word-break: break-all;">
                            ID: ${jobId}
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <input type="text" id="announce-msg-${jobId}" placeholder="Message de l'annonce..." style="flex: 1; min-width: 150px; padding: 8px; background: #2f3136; border: 1px solid #4f545c; border-radius: 4px; color: white; font-size: 13px;">
                            <button class="server-action-btn" data-type="announce" data-jobid="${jobId}" style="background: #5865F2; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">Annoncer</button>
                            <button class="server-action-btn" data-type="restart" data-jobid="${jobId}" style="background: #faa61a; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;"><i class="fa-solid fa-rotate"></i> Restart</button>
                            <button class="server-action-btn" data-type="shutdown" data-jobid="${jobId}" style="background: #f04747; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;"><i class="fa-solid fa-power-off"></i> Shutdown</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="panel-section" style="margin-bottom: 25px;">
                <h3><i class="fa-solid fa-earth-americas" style="color: #5865F2;"></i> Actions Globales (Tous les serveurs)</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">Vos ordres seront appliqués instantanément sur l'ensemble de vos instances Roblox en cours.</p>
                
                <div style="background: #2f3136; padding: 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center;">
                        <input type="text" id="global-announce-input" placeholder="Écrivez votre annonce globale ici..." 
                               style="flex: 1; padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white;">
                        <button class="global-action-btn" data-type="announce" style="background: #5865F2; color: white; border: none; padding: 12px 25px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            <i class="fa-solid fa-bullhorn"></i> Diffuser l'Annonce
                        </button>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #4f545c; margin-bottom: 20px;">
                    <div style="display: flex; gap: 15px;">
                        <button class="global-action-btn" data-type="restart" style="flex: 1; background: #faa61a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-rotate"></i> Redémarrer TOUS les serveurs
                        </button>
                        <button class="global-action-btn" data-type="shutdown" style="flex: 1; background: #f04747; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-power-off"></i> Éteindre TOUS les serveurs (Shutdown)
                        </button>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h3><i class="fa-solid fa-server" style="color: #43b581;"></i> Serveurs Actifs Individuels</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">Gérez vos instances de jeu une par une de manière isolée.</p>
                <div id="single-servers-container">
                    ${singleServersHTML}
                </div>
            </div>
        `;
    }

    // ==========================================
    // ONGLETS
    // ==========================================
    const tabs = {
        overview: () => `
            <div class="dashboard-cards-preview">
                <div class="stat-card">
                    <h3>Joueurs en jeu</h3>
                    <p class="stat-number" id="overview-player-count">
                        ${activePlayers.length}
                        <span style="font-size: 14px; color: ${activePlayers.length > 0 ? '#43b581' : '#72767d'};">
                            ● ${activePlayers.length > 0 ? 'En ligne' : 'Vide'}
                        </span>
                    </p>
                </div>
                <div class="stat-card">
                    <h3>Bans Actifs</h3>
                    <p class="stat-number" style="color: #f04747;" id="overview-ban-count">
                        ${Object.keys(bannedPlayers).length}
                    </p>
                </div>
                <div class="stat-card">
                    <h3>Statut de l'API</h3>
                    <p class="stat-number" style="color: #43b581;">Opérationnel</p>
                </div>
            </div>

            <div class="panel-section" style="margin-top: 30px;">
                <h3><i class="fa-solid fa-key" style="color: #faa61a;"></i> Authentification de l'API Roblox</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">
                    Ce token secret permet à vos scripts Roblox de communiquer de manière sécurisée avec XeroDash.
                    <span style="color: #f04747; font-weight: bold;">Ne le partagez jamais !</span>
                </p>
                <div class="token-container" style="display: flex; gap: 10px; align-items: center; background: #1a1c1e; padding: 12px; border-radius: 6px; border: 1px solid #4f545c;">
                    <input type="password" id="roblox-token-input" value="${currentServerToken}" readonly
                           style="flex: 1; background: transparent; border: none; color: #43b581; font-family: monospace; font-size: 15px; outline: none;">
                    <button id="btn-toggle-token" title="Afficher/Masquer" style="background: transparent; border: none; color: #b9bbbe; cursor: pointer; padding: 5px 10px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button id="btn-copy-token" title="Copier" style="background: #5865F2; border: none; color: white; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        <i class="fa-solid fa-copy"></i> Copier
                    </button>
                </div>
                <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                    <button id="btn-regenerate-token" style="background: transparent; border: 1px solid #f04747; color: #f04747; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        <i class="fa-solid fa-rotate"></i> Régénérer le Token
                    </button>
                </div>
            </div>
        `,
        moderation: () => `
            <div class="panel-section">
                <h3><i class="fa-solid fa-gavel"></i> Actions de Modération Manuelle</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">Sanctionnez un joueur hors-ligne directement par son identifiant ou son pseudo.</p>
                <div class="mod-form" style="display: flex; gap: 15px; margin-bottom: 10px;">
                    <input type="text" id="manual-target" placeholder="Pseudo du joueur ou UserId Roblox"
                           style="flex: 1; padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white;">
                    <select id="manual-action" style="padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white;">
                        <option value="ban">Ban Définitif</option>
                        <option value="kick">Kick du serveur</option>
                    </select>
                    <button class="server-btn setup" id="btn-manual-execute" style="width: auto; padding: 0 25px;">Exécuter</button>
                </div>
            </div>
            ${generatePlayersTableHTML("Joueurs connectés (Modération rapide)", "Cliquez sur un joueur actif pour ouvrir instantanément ses options de sanction.")}
        `,
        players: () => generatePlayersTableHTML(
            "Liste des Joueurs en Serveur",
            "Gestion complète des utilisateurs actuellement connectés à vos serveurs Roblox."
        ),
        banslist: () => generateBansTableHTML(),
        servers: () => generateServersManagementHTML(), // Attachement de notre nouvel onglet
        staff: () => `
            <div class="panel-section">
                <h3><i class="fa-solid fa-user-shield"></i> Permissions de l'équipe</h3>
                <p style="color: #99aab5; margin-bottom: 20px;">Autorisez des rôles Discord spécifiques à accéder à ce dashboard de modération.</p>
                <div style="background: rgba(88, 101, 242, 0.1); border: 1px solid #5865F2; padding: 15px; border-radius: 6px; color: #dcddde;">
                    ℹ️ Les rôles ayant les permissions Administrateur sur Discord ont automatiquement un accès total.
                </div>
            </div>
        `
    };

    const contentDiv = document.getElementById('tab-content');

    function switchTab(tabName) {
        if (!tabs[tabName]) return;
        contentDiv.innerHTML = tabs[tabName]();
        if (tabName === 'overview')                            initTokenEvents();
        if (tabName === 'players' || tabName === 'moderation') initPlayerListEvents();
        if (tabName === 'moderation')                          initManualModEvents();
        if (tabName === 'banslist')                            initBansListEvents();
        if (tabName === 'servers')                             initServersManagementEvents(); // Initialisation des écouteurs Serveurs
    }

    // ==========================================
    // CHARGEMENT CONFIG + JOUEURS + BANS
    // ==========================================
    async function loadServerConfig() {
        try {
            const [configRes, playersRes, bansRes] = await Promise.all([
                fetch(`http://localhost:3000/api/server/config/${serverId}`),
                fetch(`http://localhost:3000/api/server/players/${serverId}`),
                fetch(`http://localhost:3000/api/server/bans/${serverId}`)
            ]);
            const configData  = await configRes.json();
            const playersData = await playersRes.json();
            const bansData    = await bansRes.json();

            if (configData.success)  currentServerToken = configData.config.robloxToken;
            if (playersData.success) activePlayers      = playersData.players;
            if (bansData.success)    bannedPlayers      = bansData.bans;

            setInterval(fetchLivePlayers, 5000);
        } catch (err) {
            console.error("Impossible de se connecter à l'API :", err);
        }
    }

    async function fetchLivePlayers() {
        try {
            const [playersRes, bansRes] = await Promise.all([
                fetch(`http://localhost:3000/api/server/players/${serverId}`),
                fetch(`http://localhost:3000/api/server/bans/${serverId}`)
            ]);
            
            const pData = await playersRes.json();
            const bData = await bansRes.json();

            if (pData.success) activePlayers = pData.players;
            if (bData.success) bannedPlayers = bData.bans;

            const activeTabEl = document.querySelector('.sidebar-item.active');
            if (!activeTabEl) return;
            const currentTab = activeTabEl.getAttribute('data-tab');

            // 1. Refresh Overview
            if (currentTab === 'overview') {
                const playerCountEl = document.getElementById('overview-player-count');
                const banCountEl = document.getElementById('overview-ban-count');
                if (playerCountEl) {
                    playerCountEl.innerHTML = `${activePlayers.length} <span style="font-size: 14px; color: ${activePlayers.length > 0 ? '#43b581' : '#72767d'};">● ${activePlayers.length > 0 ? 'En ligne' : 'Vide'}</span>`;
                }
                if (banCountEl) banCountEl.innerText = Object.keys(bannedPlayers).length;
            }

            // 2. Refresh Tables Joueurs / Modération
            if (currentTab === 'players' || currentTab === 'moderation') {
                const tbody = document.querySelector('#tab-content table tbody');
                if (tbody && activePlayers.length > 0) {
                    tbody.innerHTML = activePlayers.map(player => `
                        <tr class="player-row" data-username="${player.name}" data-userid="${player.userId}" style="cursor: pointer;">
                            <td style="padding: 12px; font-weight: 600; color: #fff;">${player.name} <span style="color: #72767d; font-size: 12px;">(${player.userId})</span></td>
                            <td style="padding: 12px; font-family: monospace; color: #5865F2;">${player.jobId}</td>
                            <td style="padding: 12px; text-align: right;"><button class="action-trigger-btn" style="background: #5865F2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-gavel"></i> Sanctionner</button></td>
                        </tr>
                    `).join('');
                    initPlayerListEvents();
                } else {
                    const isAlreadyEmpty = document.querySelector('.fa-gamepad');
                    if (!isAlreadyEmpty || (tbody && activePlayers.length > 0)) {
                        contentDiv.innerHTML = tabs[currentTab]();
                        initPlayerListEvents();
                        if (currentTab === 'moderation') initManualModEvents();
                    }
                }
            }

            // 3. Refresh Bans Table
            if (currentTab === 'banslist') {
                const tbody = document.querySelector('#tab-content table tbody');
                const banKeys = Object.keys(bannedPlayers);
                if (tbody && banKeys.length > 0) {
                    tbody.innerHTML = banKeys.map(userId => {
                        const info = bannedPlayers[userId];
                        const readableDate = new Date(info.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                        return `<tr><td style="padding: 12px; font-weight: 600; color: #f04747; font-family: monospace;">${userId}</td><td style="padding: 12px; color: #dcddde;">${info.reason}</td><td style="padding: 12px; color: #72767d; font-size: 13px;">${readableDate}</td><td style="padding: 12px; text-align: right;"><button class="unban-btn" data-userid="${userId}" style="background: #43b581; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;"><i class="fa-solid fa-heart-circle-check"></i> Unban</button></td></tr>`;
                    }).join('');
                    initBansListEvents();
                } else {
                    if (!document.querySelector('.fa-shield-halved')) { contentDiv.innerHTML = tabs.banslist(); initBansListEvents(); }
                }
            }

            // 4. Refresh Servers Management (Seulement si l'utilisateur n'est pas en train d'écrire dans un champ texte)
            if (currentTab === 'servers') {
                const activeInputs = document.querySelectorAll('#tab-content input');
                const isUserTyping = Array.from(activeInputs).some(input => input === document.activeElement);
                
                if (!isUserTyping) {
                    const container = document.getElementById('single-servers-container');
                    const activeJobIds = [...new Set(activePlayers.map(p => p.jobId).filter(id => id))];
                    
                    if (container && activeJobIds.length > 0) {
                        container.innerHTML = activeJobIds.map((jobId, index) => {
                            const playerCount = activePlayers.filter(p => p.jobId === jobId).length;
                            return `
                                <div class="server-card" style="background: #1a1c1e; border: 1px solid #4f545c; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <span style="font-weight: bold; color: #fff;"><i class="fa-solid fa-gamepad" style="color: #43b581;"></i> Instance #${index + 1}</span>
                                        <span style="font-size: 12px; background: #2f3136; padding: 4px 8px; border-radius: 4px; color: #b9bbbe;"><i class="fa-solid fa-users"></i> ${playerCount} Joueur(s)</span>
                                    </div>
                                    <div style="font-family: monospace; font-size: 11px; color: #72767d; margin-bottom: 15px; word-break: break-all;">ID: ${jobId}</div>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                        <input type="text" id="announce-msg-${jobId}" placeholder="Message de l'annonce..." style="flex: 1; min-width: 150px; padding: 8px; background: #2f3136; border: 1px solid #4f545c; border-radius: 4px; color: white; font-size: 13px;">
                                        <button class="server-action-btn" data-type="announce" data-jobid="${jobId}" style="background: #5865F2; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">Annoncer</button>
                                        <button class="server-action-btn" data-type="restart" data-jobid="${jobId}" style="background: #faa61a; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;"><i class="fa-solid fa-rotate"></i> Restart</button>
                                        <button class="server-action-btn" data-type="shutdown" data-jobid="${jobId}" style="background: #f04747; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;"><i class="fa-solid fa-power-off"></i> Shutdown</button>
                                    </div>
                                </div>
                            `;
                        }).join('');
                        initServersManagementEvents();
                    } else if (container) {
                        container.innerHTML = `<div style="text-align: center; padding: 25px; color: #72767d; background: #1a1c1e; border-radius: 6px; border: 1px dashed #4f545c;">Aucun serveur actif à gérer individuellement.</div>`;
                    }
                }
            }

        } catch (err) {
            console.error("Erreur lors du rafraîchissement des données :", err);
        }
    }

    // ==========================================
    // ÉVÉNEMENTS GESTION SERVEURS (NOUVEAU)
    // ==========================================
    function initServersManagementEvents() {
        // 1. Écouteurs pour les Actions Globales (Tous les serveurs)
        document.querySelectorAll('.global-action-btn').forEach(button => {
            // On clone le bouton ou on retire l'écouteur précédent pour éviter les déclenchements multiples
            const newBtn = button.cloneNode(true);
            button.parentNode.replaceChild(newBtn, button);

            newBtn.addEventListener('click', () => {
                const actionType = newBtn.getAttribute('data-type');
                let payload = { serverId: serverId, scope: "all", action: actionType };

                if (actionType === 'announce') {
                    const message = document.getElementById('global-announce-input').value.trim();
                    if (!message) return alert("Veuillez saisir un texte pour l'annonce globale.");
                    payload.message = message;
                    alert(`[DASHBOARD] Ordre d'annonce globale envoyé : "${message}"`);
                    document.getElementById('global-announce-input').value = '';
                } else {
                    if (!confirm(`Êtes-vous sûr de vouloir exécuter un ${actionType.toUpperCase()} sur TOUS les serveurs actifs ?`)) return;
                    alert(`[DASHBOARD] Ordre de ${actionType.toUpperCase()} global envoyé !`);
                }

                // NOTE: C'est ici que s'effectuera le fetch() vers ton API Node.js plus tard.
                fetch('http://localhost:3000/api/server/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(r => r.json()).then(data => {
                    if (!data.success) alert("Erreur API : " + data.error);
                }).catch(() => alert("Impossible de joindre l'API."));
            });
        });

        // 2. Écouteurs pour les Actions Individuelles (Par JobId)
        document.querySelectorAll('.server-action-btn').forEach(button => {
            const newBtn = button.cloneNode(true);
            button.parentNode.replaceChild(newBtn, button);

            newBtn.addEventListener('click', () => {
                const actionType = newBtn.getAttribute('data-type');
                const targetJobId = newBtn.getAttribute('data-jobid');
                let payload = { serverId: serverId, scope: "single", jobId: targetJobId, action: actionType };

                if (actionType === 'announce') {
                    const messageInput = document.getElementById(`announce-msg-${targetJobId}`);
                    const message = messageInput ? messageInput.value.trim() : "";
                    if (!message) return alert("Veuillez saisir un texte pour l'annonce de ce serveur.");
                    payload.message = message;
                    alert(`[DASHBOARD] Annonce envoyée au serveur spécifié : "${message}"`);
                    if (messageInput) messageInput.value = '';
                } else {
                    if (!confirm(`Confirmer le ${actionType.toUpperCase()} pour ce serveur unique (JobId: ${targetJobId.substring(0,8)}...) ?`)) return;
                    alert(`[DASHBOARD] Ordre de ${actionType.toUpperCase()} envoyé au serveur ciblé.`);
                }

                // NOTE: C'est ici que s'effectuera le fetch() vers ton API Node.js plus tard.
                fetch('http://localhost:3000/api/server/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(r => r.json()).then(data => {
                    if (!data.success) alert("Erreur API : " + data.error);
                }).catch(() => alert("Impossible de joindre l'API."));
            });
        });
    }

    // ==========================================
    // ANCIENS ÉVÉNEMENTS (TOKEN, JOUEURS, BANS)
    // ==========================================
    function generateRandomToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result  = 'xero_live_';
        for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    }

    function initTokenEvents() {
        const tokenInput = document.getElementById('roblox-token-input');
        const btnToggle  = document.getElementById('btn-toggle-token');
        const btnCopy    = document.getElementById('btn-copy-token');
        const btnRegen   = document.getElementById('btn-regenerate-token');
        if (!tokenInput) return;

        tokenInput.value = currentServerToken;

        btnToggle.addEventListener('click', () => {
            const isHidden = tokenInput.type === 'password';
            tokenInput.type             = isHidden ? 'text' : 'password';
            btnToggle.innerHTML         = isHidden ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        });

        btnCopy.addEventListener('click', () => {
            if (currentServerToken === "Aucun token généré") return alert("Générez un token d'abord !");
            navigator.clipboard.writeText(currentServerToken).then(() => {
                const orig = btnCopy.innerHTML;
                btnCopy.style.backgroundColor = '#43b581';
                btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
                setTimeout(() => { btnCopy.style.backgroundColor = '#5865F2'; btnCopy.innerHTML = orig; }, 2000);
            });
        });

        btnRegen.addEventListener('click', async () => {
            if (!confirm("Régénérer le token écrasera l'ancien. Vos scripts Roblox devront être mis à jour. Continuer ?")) return;
            const newToken = generateRandomToken();
            try {
                const response = await fetch('http://localhost:3000/api/server/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId, token: newToken })
                });
                const data = await response.json();
                if (data.success) {
                    currentServerToken  = newToken;
                    tokenInput.value    = newToken;
                    tokenInput.type     = 'text';
                    btnToggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                    alert("Nouveau token enregistré avec succès !");
                } else { alert("Erreur API : " + data.error); }
            } catch (error) { alert("Impossible de joindre l'API."); }
        });
    }

    function initPlayerListEvents() {
        document.querySelectorAll('.player-row').forEach(row => {
            row.addEventListener('click', () => {
                openSanctionModal(row.getAttribute('data-username'), row.getAttribute('data-userid'));
            });
        });
    }

    function initManualModEvents() {
        const btnExecute = document.getElementById('btn-manual-execute');
        if (!btnExecute) return;
        btnExecute.addEventListener('click', () => {
            const target = document.getElementById('manual-target').value.trim();
            const action = document.getElementById('manual-action').value;
            if (!target) return alert("Veuillez entrer un pseudo ou un UserId valide.");
            openSanctionModal(target, `Formulaire Hors-Ligne (${action.toUpperCase()})`);
        });
    }

    function initBansListEvents() {
        document.querySelectorAll('.unban-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const idToUnban = button.getAttribute('data-userid');
                if (!confirm(`Voulez-vous vraiment débannir le UserId : ${idToUnban} ?`)) return;
                try {
                    const response = await fetch('http://localhost:3000/api/server/bans/unban', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serverId: serverId, userId: idToUnban })
                    });
                    const data = await response.json();
                    if (data.success) {
                        alert("Le joueur a été débanni !");
                        delete bannedPlayers[idToUnban];
                        contentDiv.innerHTML = tabs.banslist();
                        initBansListEvents();
                    } else { alert("Erreur lors de l'unban : " + data.error); }
                } catch (err) { alert("L'API est injoignable pour effectuer l'unban."); }
            });
        });
    }

    function openSanctionModal(username, userId) {
        document.getElementById('sanction-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="sanction-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;">
                <div style="background: #23272a; padding: 30px; border-radius: 12px; width: 450px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                    <h3 style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px; color: #fff;"><i class="fa-solid fa-triangle-exclamation" style="color: #f04747;"></i> Sanctionner ${username}</h3>
                    <p style="color: #99aab5; font-size: 14px; margin-bottom: 20px;">Cible : <span style="font-family: monospace; color: #5865F2;">${userId}</span></p>
                    <label style="display: block; color: #b9bbbe; font-size: 13px; font-weight: 600; margin-bottom: 8px;">RAISON DE LA SANCTION :</label>
                    <input type="text" id="modal-reason" placeholder="Ex: Triche, No-RP, Insultes..." style="width: 100%; padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white; margin-bottom: 20px; outline: none;">
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="btn-modal-close" style="background: transparent; border: 1px solid #72767d; color: #dcddde; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">Annuler</button>
                        <button id="btn-modal-kick" style="background: #faa61a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-door-open"></i> Kick</button>
                        <button id="btn-modal-ban" style="background: #f04747; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;"><i class="fa-solid fa-ban"></i> Ban</button>
                    </div>
                </div>
            </div>
        `);

        const closeModal = () => document.getElementById('sanction-modal')?.remove();
        document.getElementById('btn-modal-close').addEventListener('click', closeModal);

        document.getElementById('btn-modal-kick').addEventListener('click', async () => {
            const reason = document.getElementById('modal-reason').value.trim() || "Aucune raison fournie";
            const playerObj = activePlayers.find(p => String(p.userId) === String(userId) || p.name === username);
            if (!playerObj) { alert("Erreur : Le joueur ne semble plus être en ligne."); closeModal(); return; }
            try {
                const response = await fetch('http://localhost:3000/api/server-roblox/kick', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId: serverId, playersId: playerObj.userId, jobId: playerObj.jobId, reason: reason })
                });
                const data = await response.json();
                if (data.success) { alert(`Ordre de kick envoyé pour ${username}`); } else { alert("Erreur API : " + data.error); }
            } catch (error) { alert("Impossible de joindre l'API."); }
            closeModal();
        });

        document.getElementById('btn-modal-ban').addEventListener('click', async () => {
            const reason = document.getElementById('modal-reason').value.trim() || "Aucune raison fournie";
            const playerObj = activePlayers.find(p => String(p.userId) === String(userId) || p.name === username);
            if (!playerObj) { alert("Erreur : Le joueur ne semble plus être en ligne."); closeModal(); return; }
            if (!confirm(`Êtes-vous sûr de vouloir bannir DÉFINITIVEMENT ${username} ?`)) return;
            try {
                const response = await fetch('http://localhost:3000/api/server-roblox/ban', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serverId: serverId, playersId: playerObj.userId, jobId: playerObj.jobId, reason: reason })
                });
                const data = await response.json();
                if (data.success) { alert(`Le joueur ${username} a été banni !`); } else { alert("Erreur API Ban : " + data.error); }
            } catch (error) { alert("Impossible de joindre l'API."); }
            closeModal();
        });
    }

    // ==========================================
    // LANCEMENT
    // ==========================================
    loadServerConfig().then(() => switchTab('overview'));

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            switchTab(item.getAttribute('data-tab'));
        });
    });
});