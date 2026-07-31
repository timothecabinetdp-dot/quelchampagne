# QuelChampagne V5 — sélecteur et catalogue professionnel

## Ce qui change

- Le sélecteur utilise désormais cinq critères qui modifient réellement le
  classement : moment, accord, style, budget et signature recherchée.
- Le calcul est déterministe et teste uniquement les 48 bouteilles disponibles
  dans le catalogue partenaire.
- Le résultat principal explique les raisons de la recommandation. Les trois
  alternatives précisent le compromis par rapport au premier choix.
- Les pourcentages de correspondance ont disparu.
- Tous les résultats du sélecteur ouvrent une analyse QuelChampagne avant
  l’offre du vendeur.
- Les prix sont exacts et datés. Aucun ancien prix barré n’est publié sans
  période de référence documentée.
- Les photographies produit utilisent `object-fit: contain` dans un cadre
  neutre : aucune bouteille ne doit être agrandie ou recadrée pour remplir une
  carte.
- Le contenu statique du sélecteur est présent dans le HTML initial et dispose
  de données structurées `WebApplication` et `FAQPage`.
- Les fiches appuyées uniquement sur la source marchande sont conservées pour
  la navigation, mais portent `noindex` et restent hors du sitemap.
- Le premier clic d’affiliation propose un choix clair entre le lien suivi
  Webgains et l’accès direct au vendeur.
- Une page `/partenaires/` présente les conditions d’intégration d’un nouveau
  catalogue marchand.
- L’ancien script de déploiement Netlify a été supprimé. Le projet cible
  exclusivement Cloudflare Pages.

## Contrôles effectués

- 48 offres publiables et disponibles.
- 48 fiches d’analyse générées.
- 2 400 combinaisons du sélecteur testées.
- 26 bouteilles différentes peuvent arriver en première position.
- 72 pages HTML contrôlées.
- 59 URL présentes dans le sitemap.
- Aucun lien interne cassé.
- Aucun pourcentage de correspondance, prix en fourchette ou ancien prix barré
  sur les parcours commerciaux.
- Liens affiliés et liens directs contrôlés sur toutes les fiches.

## Déploiement

1. Remplacer le contenu du dépôt GitHub par le contenu de cette archive, sans
   supprimer le dossier `.git` local.
2. Dans GitHub Desktop, vérifier que les changements apparaissent.
3. Utiliser le message de commit `V5 — nouveau sélecteur et catalogue propre`.
4. Cliquer sur **Commit to main**, puis **Push origin**.
5. Cloudflare Pages doit utiliser :
   - commande de build : `node build-site.mjs`
   - dossier de sortie : `dist`

Le fichier `wrangler.toml` ne contient plus de liaison Analytics Engine
obligatoire. Le déploiement ne doit donc plus échouer sur l’erreur
« You need to enable Analytics Engine ».
