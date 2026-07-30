# QuelChampagne

Site statique généré avec Node.js.

## Parcours commercial

Les cartes de `/champagnes/` ouvrent une fiche d’analyse interne :

`sélection → fiche QuelChampagne → offre affiliée Bottle of Italy`

Les 48 produits sont consolidés dans un catalogue canonique :

- `data/bottle-of-italy-products.json` : instantané marchand (prix, stock, photo, lien) ;
- `data/product-evidence-overrides.json` : vérifications et corrections éditoriales ;
- `data/product-evidence.json` : niveau de preuve documenté pour chaque référence ;
- `build-partner-catalogue.mjs` : identité, classification, profil, accords et analyse ;
- `boutique.mjs` : composants d’affichage des cartes et des fiches.

Le quiz, le comparateur, la sélection et les 48 fiches utilisent tous ce même
catalogue. Une page SEO interne est générée avant chaque lien affilié.

Les offres de plus de 3 jours perdent automatiquement leur ancien prix barré.
Après 7 jours sans actualisation, l'offre et le lien d'achat sont suspendus.
Le workflow GitHub `Actualiser le catalogue` rafraîchit l'instantané chaque
matin, puis ne l'enregistre que si la construction et tous les tests réussissent.

## Construire et vérifier

```bash
# Facultatif avant une mise à jour éditoriale : rafraîchit l’instantané marchand.
node sync-bottle-of-italy.mjs

node build-product-evidence.mjs
node build-site.mjs
node validate-site.mjs
node test-recommendations.mjs
node test-merchant-import.mjs
node test-analytics.mjs
node validate-launch.mjs
```

## Déploiement Cloudflare Pages

- Commande de construction : `node build-site.mjs`
- Dossier de sortie : `dist`
- Version de Node recommandée : 20 ou plus récente

Le fichier `wrangler.toml` contient la configuration Cloudflare. Les anciennes
fiches éditoriales ne sont plus publiées : Cloudflare les redirige vers la
sélection actuelle grâce au fichier `dist/_redirects`.

Après le premier déploiement, activer également **Web Analytics** dans
Cloudflare : Workers & Pages → QuelChampagne → Metrics → Web Analytics.
Le suivi métier (`quiz_completed`, `recommendation_viewed`,
`product_analysis_viewed`, `merchant_click`) est envoyé sans cookie ni
identifiant utilisateur vers le binding Analytics Engine `QC_ANALYTICS`.
