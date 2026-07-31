# Contrôle mobile du sélecteur — V5.4

Date : 31 juillet 2026

## Périmètre

- Résultat principal du sélecteur
- Trois alternatives
- En-tête et navigation mobile
- Largeurs : 320, 360, 390 et 430 px

## Résultat

- Aucun débordement horizontal.
- Un seul symbole de marque dans l’en-tête.
- Menu principal masqué derrière le bouton mobile tant qu’il n’est pas ouvert.
- Bouteille principale entièrement contenue dans son cadre.
- Bouteilles des alternatives entièrement contenues dans leur emplacement.
- Aucun chevauchement entre image, nom, conseil, prix et lien d’analyse.

## Protection contre les régressions

`validate-site.mjs` vérifie la présence du cadre contraint des packshots, de la
composition mobile des alternatives et l’absence du pictogramme dupliqué dans
le bouton du sélecteur.
