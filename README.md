# Console NATAIS

Une seule application web pour piloter, depuis un seul écran, les cinq services d'une petite entreprise numérique :

| Service | Ce que la console fait | Ce qu'elle ne fait pas (volontairement) |
|---|---|---|
| **Vercel** | Liste des projets, derniers déploiements (état, branche, commit), domaines rattachés, **redéploiement** en un clic | Créer des projets, modifier les variables d'environnement |
| **GitHub** | Dépôts perso + organisations, **PR ouvertes** sur tous les dépôts, commits/PR/issues par dépôt | Écrire du code, fusionner des PR |
| **Porkbun** | Liste des domaines et expirations, **gestion DNS complète** (créer / modifier / supprimer), vérification de disponibilité | Acheter un domaine (se fait sur porkbun.com, pour éviter un achat accidentel) |
| **Resend** | Domaines expéditeurs et statut de vérification, historique des envois, **envoi d'un courriel** | Modèles, campagnes |
| **Stripe** | Solde, factures ouvertes, derniers paiements, clients, **création de liens de paiement** | Remboursements, abonnements récurrents |

C'est une « tour de contrôle » : elle pilote les services par leurs API officielles avec **vos** clés. Elle ne remplace aucun de ces services.

## Principes

- **Zéro dépendance d'exécution** : Node.js ≥ 20 et sa `fetch` intégrée. Rien à installer pour tourner.
- **Les clés ne quittent jamais le serveur** : elles sont lues dans les variables d'environnement, jamais rendues dans le HTML ni envoyées au navigateur. La page Configuration indique seulement si elles sont présentes.
- **Sécurité v1** : accès par mot de passe unique, session signée (HMAC, 12 h), cookies `HttpOnly`/`SameSite=Lax`, vérification d'origine + jeton CSRF sur toutes les actions, pas d'indexation.
- **Mode démo** : `DEMO_MODE=1` affiche des données fictives pour tester l'interface sans aucune clé.

## Démarrage local

```bash
npm install          # uniquement des outils de dev (typescript, tsx)
cp .env.example .env # puis remplir
npm run demo         # http://localhost:3000, mot de passe « demo »
# ou, avec vos vraies clés chargées dans l'environnement :
npm run dev
```

## Déploiement sur Vercel

1. Poussez ce dossier dans un dépôt GitHub et importez-le dans Vercel (préréglage : *Other*, aucune commande de build). `vercel.json` route tout vers la fonction `api/index.ts` ; le dossier `public/` (robots.txt) sert de répertoire de sortie.
2. Dans **Settings → Environment Variables**, ajoutez au minimum `CONSOLE_PASSWORD` et `SESSION_SECRET`, puis les clés des services que vous voulez brancher (liste dans `.env.example`).
3. Redéployez. Sans `CONSOLE_PASSWORD`, l'application affiche une page d'installation et refuse de servir quoi que ce soit.

## Obtenir les clés

- **Vercel** : Account Settings → Tokens → créer un jeton (variable `VC_API_TOKEN` — le préfixe `VERCEL_` est réservé par Vercel et refusé dans ses variables d’environnement). Si vos projets sont dans une équipe, `VC_TEAM_ID` = l'ID `team_…` (Team Settings → General).
- **GitHub** : Settings → Developer settings → Personal access tokens. Un jeton *fine-grained* avec lecture des dépôts (Contents, Metadata, Pull requests, Issues) suffit ; ajoutez l'organisation dans son périmètre.
- **Resend** : API Keys → clé avec *Full access* (la permission « sending only » ne permet pas de lister les envois).
- **Porkbun** : Account → API Access → créer une paire de clés, puis **activer « API Access » sur chaque domaine** (Domain Management → domaine → API Access), sinon Porkbun renvoie une erreur.
- **Stripe** : Developers → API keys. Recommandé : une **clé restreinte** (lecture sur Balance, PaymentIntents, Customers, Invoices, Payment Links ; écriture sur Products, Prices, Payment Links). Une clé `sk_test_` permet de tout essayer sans argent réel.

## Limites connues (v1)

- Un seul utilisateur, un seul jeu de clés (usage interne). La version commerciale multi-comptes demandera une base de données, un chiffrement des clés par client et une authentification par utilisateur — les clients de services (`src/services/*`) sont déjà indépendants de l'interface et réutilisables tels quels.
- Pas de cache : chaque page interroge les API en direct (quelques centaines de ms à quelques secondes selon le service). Le tableau de bord fait 5 groupes d'appels en parallèle.
- La vérification de disponibilité Porkbun est très limitée en cadence par Porkbun lui-même (environ une requête par 10 s).
- Les heures sont affichées dans le fuseau America/Toronto.
- Pas de journaux de build Vercel dans l'interface (lien vers le déploiement seulement).

## Structure

```
api/index.ts        point d'entrée Vercel (fonction serverless)
src/server.ts       serveur local (node:http)
src/app.ts          routeur, authentification, CSRF
src/config.ts       variables d'environnement, état de configuration
src/auth.ts         sessions signées
src/services/       clients API : vercel, github, resend, porkbun, stripe (+ fetch commun)
src/pages/          pages HTML (rendu serveur)
src/ui/             mise en page, CSS, composants
src/demo/           données fictives du mode démo
```
