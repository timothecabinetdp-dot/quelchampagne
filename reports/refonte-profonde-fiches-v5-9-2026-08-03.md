# Refonte profonde des fiches QuelChampagne — v5.9

## Résultat

La refonte porte sur l’ensemble des 48 fiches marchandes, le comparateur, le
sélecteur, les métadonnées SEO et le workflow d’actualisation. Elle remplace les
libellés techniques visibles et les formulations défensives par des réponses
directes, structurées et exploitables.

## Profondeur éditoriale obligatoire

Chaque fiche contient désormais :

- une synthèse du type, du caractère, de l’assemblage et des arômes ;
- un verdict d’usage avec un choix positif et une alternative à envisager ;
- quatre temps de dégustation : œil, nez, bouche et finale ;
- quatre axes visuels : fraîcheur, rondeur, puissance et accessibilité ;
- les accords, la température et le verre conseillé ;
- au moins 15 caractéristiques techniques ;
- 8 réponses pratiques immédiatement consultables ;
- trois alternatives classées par proximité de style, cépages et prix ;
- deux accès explicites à l’offre partenaire lorsque celle-ci est disponible.

## Couverture de la base

- 48 fiches enrichies et indexables ;
- 48 profils complets ;
- 30 assemblages avec pourcentages documentés ;
- 18 dosages exacts ;
- 47 offres actuellement disponibles ;
- 72 URL dans le sitemap.

Lorsqu’une valeur propre à la cuvée est documentée, elle est publiée telle
quelle. Pour les autres références, le site affiche la catégorie réglementaire
applicable — par exemple « moins de 12 g/L » pour un brut — au lieu d’inventer
une mesure exacte.

## Comparateur et sélecteur

Le comparateur affiche maintenant le prix, la catégorie, le style en bouche,
le dosage, l’assemblage, le profil aromatique, les accords, le service, la
maturation et le type de producteur. Aucun code interne de type `profil_*` ou
`occ_*` ne peut apparaître dans le contenu visible.

La première question du sélecteur porte sur le mode de service et non sur une
liste générique d’occasions. Les choix visibles sont : servi seul, à table, pour
plusieurs convives, à offrir ou pour deux personnes. Les codes historiques sont
conservés uniquement dans le calcul afin de ne pas casser le moteur.

## Actualisation des données Bottle of Italy

La synchronisation quotidienne récupère désormais, en plus du prix, du stock et
de la photo, les informations techniques présentes sur chaque page produit :
producteur, cépages, degré, format, profil aromatique, méthode de vinification,
sucres résiduels, vieillissement, contenant, couleur, température et accords.

La collecte possède trois tentatives automatiques et tolère l’indisponibilité
temporaire de la page descriptive sans perdre le prix ou le stock. Les nouvelles
données sont réinjectées dans les fiches au prochain build GitHub.

## Prévention des régressions

Le contrôle `audit-product-depth.mjs` bloque le déploiement si :

- une fiche contient moins de 15 caractéristiques ou 8 réponses ;
- un profil aromatique, un accord, une donnée de service ou d’élaboration manque ;
- une ancienne formulation faible réapparaît ;
- un code interne devient visible ;
- une fiche enrichie repasse en `noindex` ;
- les données structurées Produit ou FAQ disparaissent.

Le contrôle est exécuté par le workflow GitHub après chaque actualisation du
catalogue.
