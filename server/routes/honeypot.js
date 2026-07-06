/**
 * Honeypot Mellisec — version native Node/Express.
 *
 * L'hébergement Railway exécute l'app Node et NON du PHP : les fichiers
 * `wp-login.php` / `xmlrpc.php` du package Mellisec ne se déclencheraient jamais.
 * Ce routeur reproduit fidèlement le piège en JavaScript : il sert de fausses
 * pages WordPress sur les chemins que sondent les bots, journalise le hit
 * (IP, User-Agent, chemin) et le signale au tableau de bord Mellisec avec le
 * même format de payload (clé, signature HMAC, etc.).
 *
 * 100% observation : aucune exécution de code distant, aucune action sur le hit.
 */

const express = require('express');
const crypto = require('crypto');
const https = require('https');

const router = express.Router();

// Paramètres du package Mellisec.
// La clé et le secret HMAC ne sont PAS codés en dur : ils viennent de variables
// d'environnement (à définir dans Railway → Variables) :
//   MELLISEC_KEY  = <ta clé de site>
//   MELLISEC_HMAC = <ton secret HMAC>
// (valeurs présentes dans le README/les fichiers du package Mellisec).
const MELLISEC = {
  endpoint: process.env.MELLISEC_ENDPOINT || 'https://mellisec.fr/Pannel/honey-pot/ruche.php',
  key: process.env.MELLISEC_KEY || '',
  hmacSecret: process.env.MELLISEC_HMAC || '',
  category: 'wordpress',
};

// Le signalement n'est actif que si la clé et le secret sont configurés.
const REPORT_ENABLED = Boolean(MELLISEC.key && MELLISEC.hmacSecret);
if (!REPORT_ENABLED) {
  console.warn(
    '[honeypot] MELLISEC_KEY / MELLISEC_HMAC non définis : les fausses pages ' +
      'WordPress sont servies, mais les hits ne sont PAS signalés au dashboard. ' +
      'Ajoute ces variables (Railway → Variables) pour activer le reporting.'
  );
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Signale un hit au dashboard Mellisec (fire-and-forget, jamais bloquant).
 * Le honeypot ne doit en aucun cas casser le site : toute erreur est avalée.
 */
function report(req, trap) {
  if (!REPORT_ENABLED) return;
  try {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
    const site = String(req.headers.host || '');
    const path = String(req.originalUrl || '').slice(0, 255);
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);
    const sig = crypto
      .createHmac('sha256', MELLISEC.hmacSecret)
      .update([ip, site, MELLISEC.category, trap, path, ts, nonce].join('|'))
      .digest('hex');

    const data = new URLSearchParams({
      key: MELLISEC.key,
      site,
      ip,
      ua,
      path,
      cat: MELLISEC.category,
      trap,
      ts: String(ts),
      nonce,
      sig,
    }).toString();

    const request = https.request(
      MELLISEC.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 3000,
      },
      (res) => res.resume() // on ne lit pas la réponse
    );
    request.on('error', () => {});
    request.on('timeout', () => request.destroy());
    request.write(data);
    request.end();
  } catch {
    /* le honeypot ne doit jamais faire échouer une requête */
  }
}

/** Fausse page de connexion WordPress (rendu proche de l'originale). */
function loginPage(host, errorHtml) {
  const h = escapeHtml(host);
  return `<!DOCTYPE html>
<html lang="fr-FR">
<head>
<meta charset="UTF-8">
<title>Log In &lsaquo; ${h} &#8212; WordPress</title>
<style>
html{background:#f0f0f1}
body{background:#f0f0f1;color:#3c434a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;min-height:100%}
#login{width:320px;padding:8% 0 0;margin:0 auto}
#login h1{text-align:center;margin:0 0 25px}
#login h1 a{display:flex;align-items:center;justify-content:center;width:84px;height:84px;margin:0 auto;border-radius:50%;background:#3c434a;color:#fff;font:700 40px Georgia,serif;text-decoration:none}
.login form{margin-top:20px;padding:26px 24px 46px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04);border:1px solid #c3c4c7;border-radius:4px}
.login label{color:#3c434a;font-size:14px;margin-bottom:6px;display:block}
.login input[type=text],.login input[type=password]{font-size:24px;width:100%;padding:5px 10px;margin:2px 0 16px;border:1px solid #8c8f94;border-radius:4px;box-sizing:border-box;background:#fff;color:#2c3338}
.login input[type=text]:focus,.login input[type=password]:focus{border-color:#2271b1;box-shadow:0 0 0 1px #2271b1;outline:2px solid transparent}
.login .forgetmenot{font-size:14px;margin-bottom:16px}
.login .forgetmenot input{margin-right:6px}
.login .submit{margin:0}
.login #wp-submit{background:#2271b1;border:1px solid #2271b1;color:#fff;border-radius:3px;font-size:14px;padding:0 12px;line-height:2.15384615;min-height:32px;cursor:pointer}
.login #wp-submit:hover{background:#135e96;border-color:#135e96}
.login #nav,.login #backtoblog{text-align:center;font-size:13px;margin:16px 0 0}
.login #nav a,.login #backtoblog a{color:#2271b1;text-decoration:none}
.login #nav a:hover,.login #backtoblog a:hover{color:#135e96;text-decoration:underline}
</style>
</head>
<body class="login">
<div id="login">
<h1><a href="https://wordpress.org/" tabindex="-1">W</a></h1>
${errorHtml || ''}
<form name="loginform" id="loginform" action="wp-login.php" method="post">
  <p><label for="user_login">Nom d'utilisateur ou adresse e-mail</label>
  <input type="text" name="log" id="user_login" autocapitalize="off" autocomplete="username"></p>
  <p><label for="user_pass">Mot de passe</label>
  <input type="password" name="pwd" id="user_pass" autocomplete="current-password"></p>
  <p class="forgetmenot"><label><input name="rememberme" type="checkbox" id="rememberme" value="forever"> Se souvenir de moi</label></p>
  <input type="hidden" name="redirect_to" value="wp-admin/">
  <input type="hidden" name="testcookie" value="1">
  <p class="submit"><input type="submit" name="wp-submit" id="wp-submit" value="Se connecter"></p>
</form>
<p id="nav"><a href="wp-login.php?action=lostpassword">Mot de passe perdu ?</a></p>
<p id="backtoblog"><a href="/">&larr; Retour vers ${h}</a></p>
</div>
</body></html>`;
}

// Petite latence aléatoire pour imiter un vrai serveur (comme le package PHP).
function jitter(min, max) {
  return new Promise((r) => setTimeout(r, Math.floor(min + Math.random() * (max - min))));
}

/* ------------------------------ Pièges ------------------------------ */

// wp-login.php : fausse page de connexion. En POST, faux message d'erreur.
router.all(['/wp-login.php'], async (req, res) => {
  report(req, 'wp-login');
  res.setHeader('Set-Cookie', 'wordpress_test_cookie=WP+Cookie+check; Path=/');
  let errorHtml = '';
  if (req.method === 'POST') {
    await jitter(150, 500);
    const user = String((req.body && req.body.log) || '').trim();
    const msg =
      user.toLowerCase() === 'admin'
        ? `Erreur : le mot de passe saisi pour l'utilisateur « ${escapeHtml(user)} » est incorrect.`
        : `Erreur : le nom d'utilisateur « ${escapeHtml(user)} » n'existe pas sur ce site.`;
    errorHtml = `<div style="margin:0 0 14px;padding:11px 15px;border:1px solid #d33;background:#fdecec;color:#a11;font:14px -apple-system,Segoe UI,sans-serif;border-radius:4px">${msg}</div>`;
  }
  res.status(200).type('html').send(loginPage(req.headers.host, errorHtml));
});

// xmlrpc.php : fausse réponse XML-RPC.
router.all(['/xmlrpc.php'], async (req, res) => {
  report(req, 'xmlrpc');
  await jitter(60, 220);
  res
    .status(200)
    .type('text/xml')
    .send(
      '<?xml version="1.0"?><methodResponse><params><param><value>' +
        '<string>XML-RPC server accepts POST requests only.</string>' +
        '</value></param></params></methodResponse>'
    );
});

// wp-admin : redirige vers la fausse page de connexion.
router.all(['/wp-admin', '/wp-admin/', '/wp-admin/index.php'], async (req, res) => {
  report(req, 'wp-admin');
  await jitter(60, 220);
  res.redirect('/wp-login.php?redirect_to=wp-admin');
});

// Signatures (rendent le faux WordPress crédible aux yeux des scanners).
router.get('/readme.html', (req, res) => {
  res.type('html').send('<h1>WordPress</h1><p>Version 6.5.2</p>');
});
router.get('/wp-includes/version.php', (req, res) => {
  // Servi en texte : un scanner y lit la « version » ; aucune exécution.
  res.type('text/plain').send("<?php\n$wp_version = '6.5.2';\n");
});
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /wp-admin/\nDisallow: /wp-login.php\n');
});

module.exports = router;
