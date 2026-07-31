# QuelChampagne V5 — sélecteur et catalogue professionnel

## Contrôle éditorial V5.2 — 24 fiches

- Les 24 fiches qui restaient à consolider ont été relues une par une.
- 17 fiches sont désormais confirmées ou corrigées à partir d’une source
  producteur ou d’une fiche technique officielle.
- 5 fiches ont une identité producteur confirmée, mais restent hors du sitemap
  tant que la fiche technique primaire exacte de la cuvée n’est pas obtenue.
- 2 fiches reposent encore sur une documentation professionnelle secondaire et
  restent également en `noindex`.
- Les millésimes non confirmés ont été retirés des titres publics de Terre,
  Éclat d’Étoiles, L’Ineffable, Les Grandes Crayères et Soliste Meunier Rosé.
- Les intitulés de La Passionnée et Préface ont été corrigés selon les
  informations publiées par leurs producteurs.
- Chaque fiche contrôlée affiche désormais des faits précis : assemblage,
  dosage, élevage ou provenance selon les données réellement documentées.
- Les liens vers la fiche producteur et, lorsqu’elle existe, la documentation
  technique sont accessibles directement depuis l’analyse.
- Le site compte maintenant 41 fiches confirmées, 5 fiches partielles et
  2 fiches documentées uniquement par des sources secondaires.

## Correctif V5.1

- Les images du résultat principal, des alternatives, des fiches et des cartes
  ne sont plus forcées simultanément à `width: 100%` et `height: 100%`.
- Chaque packshot conserve désormais son ratio naturel avec des limites
  `max-width` et `max-height`, centrées dans le cadre.
- Le fichier EPC, qui est complet chez le marchand mais pouvait être agrandi
  sur la largeur puis coupé en bas, est maintenant affiché entièrement.
- Une validation automatique bloque toute réintroduction de l’ancienne règle.

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
- 64 URL présentes dans le sitemap.
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
