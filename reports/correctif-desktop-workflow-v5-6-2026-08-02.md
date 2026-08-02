# Correctif desktop et workflow catalogue — V5.6

Date : 2 août 2026

## Défauts reproduits

1. Les trois packshots de la sélection d’accueil pouvaient être visuellement
   recadrés sur ordinateur malgré la présence d’une règle `object-fit`.
2. Le workflow « Actualiser le catalogue » échouait lorsque le partenaire
   signalait une cuvée indisponible.

## Cause du workflow

La synchronisation du flux a réussi sur les 48 produits. Perrier-Jouët Belle
Époque a ensuite été signalé hors stock. L’ancien validateur considérait toute
rupture de stock comme une erreur bloquante, au lieu d’adapter le catalogue
public.

## Corrections

- Les packshots de l’accueil sont centrés en flux normal avec une largeur et
  une hauteur maximales explicites.
- Le catalogue de données conserve les 48 analyses.
- Le catalogue public, le sélecteur et le comparateur utilisent uniquement les
  47 offres actuellement disponibles.
- La fiche d’une cuvée hors stock reste consultable sans lien d’achat et avec
  une information d’indisponibilité.
- Une autre cuvée disponible remplace automatiquement une bouteille hors stock
  dans les trois cartes de l’accueil.

## Validation finale

- 48 fiches d’analyse générées ;
- 47 offres disponibles publiées ;
- 72 pages HTML ;
- 64 URL dans le sitemap ;
- 2 400 profils du sélecteur testés ;
- aucun lien interne cassé ;
- contrôles marchand, analytics et lancement validés.
