document.addEventListener("DOMContentLoaded", () => {
    // 1. RÉCUPÉRATION DE L'ID DU SERVEUR
    const urlParams = new URLSearchParams(window.location.search);
    const serverId = urlParams.get('id');

    if (!serverId) {
        window.location.href = "serverlist.html";
        return;
    }

    // Affichage des infos de base de la page
    document.getElementById('server-id-display').innerText = serverId;
    document.getElementById('server-title').innerText = `Configuration du serveur`;

    // VARIABLES D'ÉTAT (Gérées dynamiquement via l'API)
    let currentServerToken = "Aucun token généré"; 
    let activePlayers = []; // Liste des vrais joueurs connectés (vide par défaut)

    // 💡 Pour tester l'affichage et les modales, tu peux décommenter la ligne ci-dessous :
    // activePlayers = [{ name: "fioskho", userId: 1234567, jobId: "Job_7a8b" }, { name: "RobloxDev", userId: 99999, jobId: "Job_3c2d" }];

    // Fonction utilitaire pour générer le tableau HTML des joueurs (réutilisée dans plusieurs onglets)
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

        let rows = activePlayers.map(player => `
            <tr class="player-row" data-username="${player.name}" data-userid="${player.userId}" style="cursor: pointer;">
                <td style="padding: 12px; font-weight: 600; color: #fff;">${player.name} <span style="color: #72767d; font-size: 12px;">(${player.userId})</span></td>
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
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 2. DÉFINITION DES TEMPLATES DE CONTENU DYNAMIQUES
    const tabs = {
        overview: () => `
            <div class="dashboard-cards-preview">
                <div class="stat-card">
                    <h3>Joueurs en jeu</h3>
                    <p class="stat-number" id="overview-player-count">${activePlayers.length} <span style="font-size: 14px; color: ${activePlayers.length > 0 ? '#43b581' : '#72767d'};">● ${activePlayers.length > 0 ? 'En ligne' : 'Vide'}</span></p>
                </div>
                <div class="stat-card">
                    <h3>Bans Actifs</h3>
                    <p class="stat-number" style="color: #72767d;" id="overview-ban-count">0</p>
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
                    <button id="btn-regenerate-token" style="background: transparent; border: 1px solid #f04747; color: #f04747; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s;">
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
                    <input type="text" id="manual-target" placeholder="Pseudo du joueur ou UserId Roblox" style="flex: 1; padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white;">
                    <select id="manual-action" style="padding: 12px; background: #1a1c1e; border: 1px solid #4f545c; border-radius: 6px; color: white;">
                        <option value="ban">Ban Définitif</option>
                        <option value="kick">Kick du serveur</option>
                    </select>
                    <button class="server-btn setup" id="btn-manual-execute" style="width: auto; padding: 0 25px;">Exécuter</button>
                </div>
            </div>
            
            ${generatePlayersTableHTML("Joueurs connectés (Modération rapide)", "Cliquez sur un joueur actif pour ouvrir instantanément ses options de sanction.")}
        `,
        players: () => generatePlayersTableHTML("Liste des Joueurs en Serveur", "Gestion complète des utilisateurs actuellement connectés à vos serveurs Roblox."),
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

    // 3. LOGIQUE DES ONGLETS DYNAMIQUES
    const contentDiv = document.getElementById('tab-content');
    
    function switchTab(tabName) {
        if (tabs[tabName]) {
            contentDiv.innerHTML = tabs[tabName]();
            
            // Initialisation des scripts spécifiques aux éléments injectés
            if (tabName === 'overview') {
                initTokenEvents();
            } else if (tabName === 'players' || tabName === 'moderation') {
                initPlayerListEvents();
                if (tabName === 'moderation') initManualModEvents();
            }
        }
    }

    // CHARGEMENT INITIAL DU CONFIG JSON DEPUIS L'API
    async function loadServerConfig() {
        try {
            console.log("Recherche de la configuration pour le serveur :", serverId);
            
            const response = await fetch(`http://localhost:3000/api/server/config/${serverId}`);
            const data = await response.json();

            if (data.success) {
                currentServerToken = data.config.robloxToken;
                console.log("Configuration chargée avec succès ! Token trouvé :", currentServerToken);
            }
        } catch (err) {
            console.error("Impossible de se connecter à l'API pour charger la config :", err);
        }
    }

    // Générateur automatique de Token
    function generateRandomToken() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'xero_live_';
        for (let i = 0; i < 32; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    // 4. ÉVÉNEMENTS DU TOKEN (VUE D'ENSEMBLE)
    function initTokenEvents() {
        const tokenInput = document.getElementById('roblox-token-input');
        const btnToggle = document.getElementById('btn-toggle-token');
        const btnCopy = document.getElementById('btn-copy-token');
        const btnRegen = document.getElementById('btn-regenerate-token');

        if (!tokenInput) return;
        tokenInput.value = currentServerToken;

        btnToggle.addEventListener('click', () => {
            if (tokenInput.type === 'password') {
                tokenInput.type = 'text';
                btnToggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                tokenInput.type = 'password';
                btnToggle.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });

        btnCopy.addEventListener('click', () => {
            if (currentServerToken === "Aucun token généré") return alert("Générez un token d'abord !");
            navigator.clipboard.writeText(currentServerToken).then(() => {
                const originalText = btnCopy.innerHTML;
                btnCopy.style.backgroundColor = '#43b581';
                btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
                setTimeout(() => {
                    btnCopy.style.backgroundColor = '#5865F2';
                    btnCopy.innerHTML = originalText;
                }, 2000);
            });
        });

        btnRegen.addEventListener('click', async () => {
            if (confirm("Régénérer le token écrasera l'ancien. Vos scripts Roblox devront être mis à jour. Continuer ?")) {
                const newToken = generateRandomToken();

                try {
                    const response = await fetch('http://localhost:3000/api/server/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serverId: serverId, token: newToken })
                    });

                    const data = await response.json();

                    if (data.success) {
                        currentServerToken = newToken;
                        tokenInput.value = currentServerToken;
                        tokenInput.type = 'text';
                        btnToggle.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                        alert("Nouveau token enregistré avec succès !");
                    } else {
                        alert("Erreur API : " + data.error);
                    }
                } catch (error) {
                    console.error(error);
                    alert("Impossible de joindre l'API.");
                }
            }
        });
    }

    // 5. LISTE DES JOUEURS ET ACTIONS DE SANCTION
    function initPlayerListEvents() {
        const rows = document.querySelectorAll('.player-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const username = row.getAttribute('data-username');
                const userId = row.getAttribute('data-userid');
                openSanctionModal(username, userId);
            });
        });
    }

    // Événement pour la modération manuelle (par formulaire d'input text)
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

    // Fenêtre contextuelle (Modal) de sanction universelle
    function openSanctionModal(username, userId) {
        const existingModal = document.getElementById('sanction-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="sanction-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;">
                <div style="background: #23272a; padding: 30px; border-radius: 12px; width: 450px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                    <h3 style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px; color: #fff;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: #f04747;"></i> Sanctionner ${username}
                    </h3>
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
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('btn-modal-close').addEventListener('click', () => {
            document.getElementById('sanction-modal').remove();
        });

        document.getElementById('btn-modal-kick').addEventListener('click', () => {
            const reason = document.getElementById('modal-reason').value || "Aucune raison fournie";
            alert(`Requête envoyée : Kick de ${username} pour : ${reason}`);
            document.getElementById('sanction-modal').remove();
        });

        document.getElementById('btn-modal-ban').addEventListener('click', () => {
            const reason = document.getElementById('modal-reason').value || "Aucune raison fournie";
            alert(`Requête envoyée : Ban de ${username} pour : ${reason}`);
            document.getElementById('sanction-modal').remove();
        });
    }

    // Lancement de l'application : Charger la config puis afficher le premier onglet
    loadServerConfig().then(() => {
        switchTab('overview');
    });

    // 6. ÉCOUTEURS DE LA BARRE LATÉRALE (SIDEBAR)
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            switchTab(item.getAttribute('data-tab'));
        });
    });
});