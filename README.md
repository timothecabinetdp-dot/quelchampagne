# QuelChampagne Engine

Service autonome de connaissance, comparaison et recommandation de Champagnes. Il ne dépend pas du code de `quelchampagne.fr` : le site pourra consommer son API lorsque la couverture éditoriale sera suffisante.

## Principes

1. Une cuvée, un millésime et un format forment une identité distincte.
2. Chaque affirmation importante renvoie à une source et à un niveau de preuve.
3. Les faits techniques, l’analyse sensorielle et le commerce restent séparés.
4. Une donnée ambiguë ou dupliquée entre en quarantaine au lieu d’être publiée.
5. Une note de tiers n’est importée que si son usage est public ou couvert par une licence.
6. Le moteur est déterministe, versionné et testable ; il n’invente pas une dégustation.

## Démarrage

```bash
npm run check
npm start
```

Le serveur écoute par défaut sur `http://localhost:8788`.
Cette adresse ouvre également le tableau de bord local de contrôle et de test.

## API

- `GET /health`
- `GET /v1/quality`
- `GET /v1/champagnes?q=&producer=&available=true&limit=25`
- `GET /v1/champagnes/:id`
- `POST /v1/recommendations`
- `POST /v1/personalized-recommendations`
- `POST /v1/compare`
- `GET /v1/similar/:id?limit=5&maxPrice=100`
- `POST /v1/tastings/aggregate`

Exemple :

```json
{
  "request": {
    "occasion": "occ_diner",
    "pairing": "accord_mer",
    "preset": "fresh",
    "budgetMax": 80,
    "producerType": "any",
    "signature": "low_dosage",
    "availableOnly": true
  },
  "limit": 3
}
```

## Pipeline d’enrichissement

Chaque connecteur futur produit d’abord un instantané brut horodaté. La normalisation recherche ensuite une identité canonique. Les correspondances certaines sont fusionnées, les cas ambigus sont placés en quarantaine, puis la validation bloque toute publication sans provenance suffisante.

Ordre d’acquisition prévu :

1. producteurs et Comité Champagne pour l’identité et la technique ;
2. résultats publics de concours pour les récompenses et scores autorisés ;
3. bases de critiques sous licence ;
4. partenaires marchands pour prix, disponibilité et visuels ;
5. panels de dégustation QuelChampagne pour créer une donnée propriétaire.

Un import externe passe par `scripts/prepare-import.mjs`. Le script refuse toute source dont le statut de réutilisation n’est pas `authorized` ou `facts_only`, puis sépare automatiquement les nouvelles identités, les mises à jour exactes et les rapprochements ambigus à contrôler.
