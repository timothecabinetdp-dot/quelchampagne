# Audit complet responsive — V5.5

Date : 31 juillet 2026

## Point de départ

Les captures réelles ont révélé deux défauts qui n’étaient pas couverts par
les contrôles précédents :

1. le visuel principal d’une fiche pouvait conserver sa hauteur naturelle et
   sortir de son cadre sur mobile ;
2. les catégories d’une cuvée pouvaient apparaître sans espace, par exemple
   `BrutMillésimé`.

Le balayage initial a mesuré :

- 56 pages comportant au moins un visuel susceptible de sortir de son cadre ;
- 24 fiches avec des catégories sans espacement visible.

## Corrections appliquées

- Confinement absolu des packshots dans les fiches produit.
- Même règle appliquée au catalogue, aux cartes associées, aux pages
  thématiques, au résultat du sélecteur et à la sélection de l’accueil.
- Suppression de tout `overflow: visible` sur les cadres produit.
- Ajout d’un espacement et d’une présentation cohérente pour les catégories.
- Réduction du titre produit sur les écrans les plus étroits.
- Conservation du ratio de chaque bouteille avec `object-fit: contain`.

## Matrice de contrôle

### Pages statiques

- 72 pages
- 7 largeurs : 320, 360, 390, 430, 768, 1024 et 1440 px
- 504 contrôles de page

Vérifications :

- absence de débordement horizontal ;
- images entièrement contenues ;
- en-tête mobile et bureau cohérent ;
- un seul H1 par page ;
- aucun visuel publié sans texte alternatif.

Résultat : **aucune anomalie détectée après correction**.

### Parcours interactifs

- 18 combinaisons du sélecteur sur mobile et tablette ;
- filtres par style et tri par prix du catalogue ;
- recherche, sélection, limite de quatre cuvées et remise à zéro du
  comparateur ;
- ouverture et fermeture du menu mobile ;
- affichage du contrôle d’âge à 320 × 568 px.

Résultat : **aucune anomalie détectée après correction**.

## Contrôles techniques

- 48 fiches publiées ;
- 72 pages HTML ;
- 64 URL dans le sitemap ;
- 2 400 profils de recommandation ;
- aucun lien interne cassé.

## Conclusion

La V5.5 remplace les correctifs ponctuels par une règle commune à tous les
visuels de bouteille et par des validations empêchant la réapparition du même
défaut dans une prochaine génération du site.
