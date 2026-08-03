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
même catalogue. Le sélecteur croise cinq critères : service, accord, style,
budget et signature recherchée. Une page d’analyse interne précède toujours le
lien marchand.

Les anciens prix du flux ne sont jamais affichés, car leur période de référence
n’est pas documentée. Après 7 jours sans actualisation, l'offre et le lien
d'achat sont suspendus.
Le workflow GitHub `Actualiser le catalogue` rafraîchit l’instantané chaque
matin, puis ne l'enregistre que si la construction et tous les tests réussissent.

Chaque fiche publie au minimum 15 caractéristiques, 8 réponses pratiques, un
profil aromatique, des accords, une température de service et une explication
du style. Les 48 fiches atteignent ce seuil et figurent dans le sitemap. Les
valeurs précises sont reprises lorsqu'elles sont documentées ; à défaut, la
catégorie réglementaire est nommée explicitement, sans fabriquer de mesure.

État de la base au 3 août 2026 :

- 48 fiches enrichies et indexables ;
- 30 assemblages chiffrés ;
- 18 dosages exacts ;
- 48 profils complets et 72 URL dans le sitemap.

Les détails contrôlés sont centralisés dans
`data/product-evidence-overrides.json`. Le rapport de couverture documentaire
est généré dans `reports/product-evidence-review.json`.

## Construire et vérifier

```bash
# Facultatif avant une mise à jour éditoriale : rafraîchit l’instantané marchand.
node sync-bottle-of-italy.mjs

node build-product-evidence.mjs
node build-site.mjs
node audit-product-depth.mjs
node test-recommendations.mjs
node validate-site.mjs
node test-merchant-import.mjs
node validate-launch.mjs
```

Le responsive est contrôlé sur les parcours accueil, sélecteur, catalogue,
comparateur, fiche produit et article. Les largeurs de référence sont 320, 360,
390, 768, 1024 et 1440 px. La navigation passe en menu compact sous 701 px.

## Déploiement Cloudflare Pages

- Commande de construction : `node build-site.mjs`
- Dossier de sortie : `dist`
- Version de Node recommandée : 20 ou plus récente

Le dépôt ne contient aucun réglage Netlify. Cloudflare Pages lit directement
`wrangler.toml` et publie le dossier `dist`. Le dossier généré est également
versionné afin que le contenu contrôlé localement soit bien celui publié.

Le fichier `wrangler.toml` contient la configuration Cloudflare. Les anciennes
fiches éditoriales ne sont plus publiées : Cloudflare les redirige vers la
sélection actuelle grâce au fichier `dist/_redirects`.

Web Analytics peut être activé dans Cloudflare sans fonction Pages. Le suivi
métier par Analytics Engine reste désactivé tant que le service et son binding
ne sont pas configurés, afin qu'il ne puisse pas bloquer un déploiement.
