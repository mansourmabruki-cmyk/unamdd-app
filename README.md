Méthode 1 – Dans le cloud, SANS rien installer (recommandée)

Un workflow GitHub Actions est fourni (`.github/workflows/build-apk.yml`).
Il compile l'APK automatiquement sur les serveurs de GitHub.

1. Créez un compte gratuit sur https://github.com .
2. Créez un nouveau dépôt (ex. `unamdd-app`).
3. Téléversez **tout le contenu de ce dossier** dans le dépôt
   (bouton *Add file → Upload files*, glissez les fichiers y compris `www/`).
4. Onglet **Actions** → le workflow *Build Android APK* se lance tout seul
   (ou cliquez *Run workflow*).
5. À la fin (≈ 5 min), ouvrez l'exécution → section **Artifacts** →
   téléchargez **UNAMDD-debug-apk**. Vous avez votre `app-debug.apk`.
6. Copiez l'APK sur un téléphone Android et installez-le
   (autorisez « Sources inconnues »).
