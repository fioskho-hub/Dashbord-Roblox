document.addEventListener("DOMContentLoaded", async () => {

    const gridContainer = document.getElementById('grid-container');
    
    if (gridContainer) {
        const rows = Math.ceil(window.innerHeight / 40);
        const cols = Math.ceil(window.innerWidth / 40);
        const totalBoxes = rows * cols;

        for (let i = 0; i < totalBoxes; i++) {
            const box = document.createElement('div');
            box.classList.add('grid-box');

            box.addEventListener('mouseenter', () => {
                box.style.transition = '0s';
                box.style.backgroundColor = '#5865F2';
                box.style.boxShadow = '0 0 10px #5865F2, 0 0 20px #5865F2';
            });

            box.addEventListener('mouseleave', () => {
                box.style.transition = '1.2s ease';
                box.style.backgroundColor = 'transparent';
                box.style.boxShadow = 'none';
            });

            gridContainer.appendChild(box);
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });

        const data = await response.json();

        if (data.error) {
            alert("Erreur d'authentification : " + data.error);
            window.location.href = "login.html";
            return;
        }

        // ==========================================
        // 🎯 L'AJOUT SÉCURITÉ ICI : ON ENREGISTRE LES INFOS DE SESSION
        // ==========================================
        sessionStorage.setItem('xero_user', JSON.stringify(data.user));
        sessionStorage.setItem('xero_guilds', JSON.stringify(data.guilds));

        // Affichage des informations de l'utilisateur connecté
        document.getElementById('username').innerText = data.user.username;
        if (data.user.avatar) {
            document.getElementById('user-avatar').src = `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png`;
        }

        const serversGrid = document.getElementById('servers-grid');
        serversGrid.innerHTML = ""; 

        const allGuilds = data.guilds.sort((a, b) => {
            const rank = guild => {
                const perms = BigInt(guild.permissions);
                const isOwner = guild.owner === true;
                const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
                if (isOwner) return 0;
                if (isAdmin) return 1;
                return 2;
            };
            return rank(a) - rank(b);
        });

        if (allGuilds.length === 0) {
            serversGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #99aab5;">Vous n'êtes inscrit sur aucun serveur Discord.</p>`;
        } else {
            allGuilds.forEach(guild => {
                const perms = BigInt(guild.permissions);
                const isOwner = guild.owner === true;
                const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);

                const card = document.createElement('div');
                card.classList.add('server-card');
                
                if (!isAdmin) {
                    card.style.opacity = "0.8";
                }

                let iconHTML = `<div class="server-icon-placeholder">${guild.name.slice(0, 2).toUpperCase()}</div>`;
                if (guild.icon) {
                    const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
                    iconHTML = `<div class="server-icon-wrapper"><img src="${iconUrl}" class="server-icon-placeholder" style="object-fit: cover; border-radius: 50%;" alt="${guild.name}"></div>`;
                }

                const badgeClass = isAdmin ? 'admin' : 'member';
                const badgeText = isAdmin ? 'Admin' : 'Membre';
                
                const buttonHTML = isAdmin 
                    ? `<button class="server-btn setup" onclick="manageServer('${guild.id}')">Configurer</button>` 
                    : `<button class="server-btn invite" style="opacity: 0.4; cursor: not-allowed; border-color: #4f545c; color: #72767d;" disabled>Accès restreint</button>`;

                card.innerHTML = `
                    ${iconHTML}
                    <div class="server-info">
                        <h3>${guild.name}</h3>
                        <p class="role-badge ${badgeClass}">${badgeText}</p>
                    </div>
                    ${buttonHTML}
                `;

                serversGrid.appendChild(card);
            });
        }

        // Nettoie l'URL pour cacher le code d'authentification Discord sensible
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (err) {
        console.error("Erreur de communication avec l'API :", err);
        alert("Impossible de joindre le serveur API. Vérifie que ton terminal 'api' (port 3000) tourne toujours !");
    }
});

function manageServer(guildId) {
    console.log("Accès au panel demandé pour le serveur ID :", guildId);
    window.location.href = `dashboard.html?id=${guildId}`;
}