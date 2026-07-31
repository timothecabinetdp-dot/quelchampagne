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

Le sélecteur, le comparateur, la sélection et les 48 fiches utilisent tous ce
même catalogue. Le sélecteur croise cinq critères : moment, accord, style,
budget et signature recherchée. Une page d’analyse interne précède toujours le
lien marchand.

Les anciens prix du flux ne sont jamais affichés, car leur période de référence
n’est pas documentée. Après 7 jours sans actualisation, l'offre et le lien
d'achat sont suspendus.
Le workflow GitHub `Actualiser le catalogue` rafraîchit l’instantané chaque
matin, puis ne l'enregistre que si la construction et tous les tests réussissent.

Les fiches qui ne disposent encore que de la source marchande restent
consultables depuis le catalogue, mais portent `noindex`. Elles ne rejoignent le
sitemap qu’après ajout d’une source producteur.

État de la base au 31 juillet 2026 :

- 41 fiches confirmées ou corrigées avec une source primaire ;
- 5 fiches dont le producteur est confirmé mais dont la fiche technique exacte
  reste à obtenir ;
- 2 fiches documentées par une source professionnelle secondaire ;
- 7 fiches maintenues hors du sitemap et en `noindex`, sans donnée inventée.

Les détails contrôlés sont centralisés dans
`data/product-evidence-overrides.json`. Le rapport des références qui restent à
documenter est généré dans `reports/product-evidence-review.json`.

## Construire et vérifier

```bash
# Facultatif avant une mise à jour éditoriale : rafraîchit l’instantané marchand.
node sync-bottle-of-italy.mjs

node build-product-evidence.mjs
node build-site.mjs
node test-recommendations.mjs
node validate-site.mjs
node test-merchant-import.mjs
node test-analytics.mjs
node validate-launch.mjs
```

## Déploiement Cloudflare Pages

- Commande de construction : `node build-site.mjs`
- Dossier de sortie : `dist`
- Version de Node recommandée : 20 ou plus récente

Le dépôt ne contient aucun réglage Netlify. Cloudflare Pages lit directement
`wrangler.toml` et publie le dossier `dist`.

Le fichier `wrangler.toml` contient la configuration Cloudflare. Les anciennes
fiches éditoriales ne sont plus publiées : Cloudflare les redirige vers la
sélection actuelle grâce au fichier `dist/_redirects`.

Après le premier déploiement, activer également **Web Analytics** dans
Cloudflare : Workers & Pages → QuelChampagne → Metrics → Web Analytics.
Le point d’entrée du suivi métier fonctionne sans cookie ni identifiant
utilisateur. Un binding Analytics Engine `QC_ANALYTICS` pourra être ajouté
ultérieurement pour enregistrer les événements détaillés, sans bloquer le
déploiement actuel.
