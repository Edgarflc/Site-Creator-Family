# Creator Family 🎭

Questionnaire interactif lié à Discord. Les visiteurs se connectent avec Discord,
répondent à des questions (une par page, avec animations), et reçoivent
automatiquement des rôles sur le serveur en fonction de leurs réponses.

## ✨ Fonctionnalités

- Connexion via **Discord OAuth2**
- Questionnaire **une question par page** avec transitions fluides
- Design **sombre, moderne et animé**
- Attribution **automatique des rôles** Discord selon les réponses
- Questions **configurables** dans un seul fichier (`server/data/questions.js`)

## 🧱 Stack

- **Backend** : Node.js + Express (pas de build, léger)
- **Frontend** : HTML / CSS / JS vanilla (servi en statique)
- **API Discord** : OAuth2 + bot pour l'attribution des rôles

---

## 🚀 Installation locale

### 1. Prérequis
- [Node.js](https://nodejs.org/) **18 ou plus**

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer Discord

Sur le [Discord Developer Portal](https://discord.com/developers/applications) :

**a) Application / OAuth2**
- Récupère le **Client ID** et le **Client Secret** (onglet *OAuth2*).
- Dans *OAuth2 > Redirects*, ajoute l'URL de callback :
  - En local : `http://localhost:3000/auth/callback`
  - En prod : `https://ton-domaine.com/auth/callback`

**b) Bot**
- Onglet *Bot* : crée le bot et copie son **Token**.
- Active la permission **Manage Roles** (Gérer les rôles).
- Invite le bot sur ton serveur avec l'URL OAuth2 (scope `bot`, permission *Manage Roles*) :
  ```
  https://discord.com/oauth2/authorize?client_id=TON_CLIENT_ID&scope=bot&permissions=268435456
  ```
- ⚠️ **Important** : dans *Paramètres du serveur > Rôles*, place le rôle du **bot AU-DESSUS**
  des rôles qu'il doit attribuer. Sinon Discord refusera (erreur 403).

### 4. Variables d'environnement
```bash
cp .env.example .env
```
Puis remplis `.env` :

| Variable | Description |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID de l'application |
| `DISCORD_CLIENT_SECRET` | Client Secret (onglet OAuth2) |
| `DISCORD_BOT_TOKEN` | Token du bot |
| `DISCORD_GUILD_ID` | ID de ton serveur Discord |
| `BASE_URL` | `http://localhost:3000` en local, ton domaine en prod |
| `PORT` | Port d'écoute (par défaut 3000) |
| `SESSION_SECRET` | Longue chaîne aléatoire (signe les cookies) |

> 🔐 Le fichier `.env` ne doit **jamais** être commit (il est dans `.gitignore`).
> Si un token a été exposé, régénère-le (Reset Token / Reset Secret) dans le portail.

### 5. Lancer
```bash
npm start        # production
npm run dev      # avec rechargement auto (Node --watch)
```
Ouvre http://localhost:3000

---

## ⚙️ Ajouter / modifier des questions

Tout se passe dans **`server/data/questions.js`**. Exemple :

```js
{
  id: 'niveau',                          // identifiant unique
  question: 'Quel est ton niveau ?',
  description: 'Optionnel',
  answers: [
    { value: 'debutant', label: 'Débutant', emoji: '🌱', roleIds: ['ID_DU_ROLE'] },
    { value: 'expert',   label: 'Expert',   emoji: '🚀', roleIds: ['ID_DU_ROLE'] },
  ],
}
```
- `roleIds` accepte plusieurs rôles : `['id1', 'id2']`.
- Pour obtenir l'ID d'un rôle : *Paramètres Discord > Avancés > Mode développeur*,
  puis clic droit sur le rôle > **Copier l'identifiant**.

---

## 🚄 Déploiement sur Railway

Railway build et lance l'app automatiquement (Nixpacks détecte Node + `npm start`).
Le `PORT` et le domaine public sont injectés par la plateforme : **ne définis ni `PORT`
ni `BASE_URL`**, l'URL publique est résolue automatiquement via `RAILWAY_PUBLIC_DOMAIN`.

### 1. Pousser le code
Crée un dépôt Git et pousse-le (GitHub recommandé pour le déploiement auto).
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin TON_REPO
git push -u origin main
```

### 2. Créer le projet Railway
- Sur [railway.app](https://railway.app) : **New Project > Deploy from GitHub repo**
  (ou `railway init` puis `railway up` avec la CLI).
- Railway détecte Node automatiquement et exécute `npm install` puis `npm start`.

### 3. Variables d'environnement
Dans l'onglet **Variables** du service, ajoute :

| Variable | Valeur |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID de l'application |
| `DISCORD_CLIENT_SECRET` | Client Secret (onglet OAuth2) |
| `DISCORD_BOT_TOKEN` | Token du bot |
| `DISCORD_GUILD_ID` | ID de ton serveur Discord |
| `SESSION_SECRET` | Longue chaîne aléatoire |

> ⚠️ Ne mets **pas** `PORT` ni `BASE_URL` : Railway s'en charge.
> Pour un domaine personnalisé, ajoute alors `BASE_URL=https://ton-domaine.com`.

### 4. Activer le domaine public
Onglet **Settings > Networking > Generate Domain** (ou ajoute ton domaine perso).

### 5. Redirect OAuth2 Discord
Dans le [Developer Portal](https://discord.com/developers/applications) >
*OAuth2 > Redirects*, ajoute exactement :
```
https://TON-DOMAINE.up.railway.app/auth/callback
```
(remplace par ton domaine Railway, sans slash final). C'est l'unique étape manuelle :
elle est nécessaire car Discord exige une URL de callback explicite.

---

## ☁️ Déploiement sur un VPS OVH

### 1. Préparer le serveur (Ubuntu/Debian)
```bash
# Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2 (gestionnaire de process) et nginx
sudo npm install -g pm2
sudo apt-get install -y nginx
```

### 2. Déployer le code
```bash
git clone TON_REPO creator-family   # ou transfert via scp/rsync
cd creator-family
npm install --omit=dev
cp .env.example .env && nano .env    # renseigne les valeurs (BASE_URL = https://ton-domaine.com)
```

### 3. Lancer avec PM2
```bash
pm2 start server/index.js --name creator-family
pm2 save
pm2 startup        # suit l'instruction affichée pour démarrer au boot
```

### 4. Reverse proxy nginx
Crée `/etc/nginx/sites-available/creator-family` :
```nginx
server {
    listen 80;
    server_name ton-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Active le site et recharge nginx :
```bash
sudo ln -s /etc/nginx/sites-available/creator-family /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. HTTPS (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ton-domaine.com
```
Certbot configure le HTTPS automatiquement. Vérifie ensuite que :
- `BASE_URL=https://ton-domaine.com` dans `.env`
- L'URL de redirect `https://ton-domaine.com/auth/callback` est bien ajoutée dans le portail Discord.

Puis redémarre l'app : `pm2 restart creator-family`.

---

## 🛠️ Dépannage

| Problème | Cause probable |
|---|---|
| **403** à l'attribution du rôle | Le rôle du bot est sous le rôle à attribuer, ou permission *Manage Roles* manquante |
| **404** Membre introuvable | L'utilisateur n'a pas rejoint le serveur Discord |
| Redirection en boucle / `auth=invalid` | L'URL de redirect ne correspond pas exactement à celle du portail Discord |
| Cookies non conservés en prod | Vérifie que `BASE_URL` commence par `https://` et que nginx transmet `X-Forwarded-Proto` |

---

## 📁 Structure du projet

```
creator-family/
├── server/
│   ├── index.js              # Entrée Express
│   ├── config.js             # Config / env
│   ├── data/questions.js     # Questions + mapping rôles
│   ├── services/discord.js   # API Discord
│   └── routes/
│       ├── auth.js           # OAuth2
│       └── api.js            # Questions + réponses
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```
