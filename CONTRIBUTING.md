# Contribuer à repo-motion

Merci de votre intérêt ! Ce document décrit l'organisation du code et les règles à respecter.

## Licence des contributions

repo-motion est publié sous la [PolyForm Shield 1.0.0](LICENSE.md). En proposant une contribution (pull request, patch), vous acceptez qu'elle soit distribuée sous cette même licence, et vous autorisez le mainteneur à la distribuer aussi sous d'autres conditions (par exemple une licence commerciale). Ne proposez que du code que vous avez le droit de céder ainsi.

## Démarrer

```bash
pnpm install
pnpm dev       # http://localhost:3000
pnpm check     # lint + typecheck + tests, à faire passer avant chaque pull request
```

## Architecture hexagonale

```
packages/
  core/             L'hexagone. Aucune dépendance (ni framework, ni librairie, ni I/O).
    domain/         Project (+ cycle de vie de l'analyse, des personas et des vidéos), ProjectFolder, ProductBrief, Personas, Storyboard, DirectedPiece, VideoStyle, VideoSetup
    application/
      ports/        Interfaces que l'infrastructure implémente
      use-cases/    AddProject, RequestAnalysis, RunAnalysis, RequestPersonas, WritePersonas, SuggestStyles, ChooseStyle, SetUpVideos, RequestVideo, ProduceVideo…
    testing/        Adaptateurs en mémoire et fixtures, pour les tests
  infrastructure/   Adaptateurs secondaires
    claude-code/    La CLI Claude Code : état (installée, connectée), analyse d'un dossier, écriture des personas et des storyboards, proposition des styles, choix des pages à filmer, réalisation d'une vidéo en agent cloisonné
    filesystem/     Résolution et suggestion de dossiers, recherche du fichier audio
    persistence/    Un fichier JSON par projet, dans ~/.repo-motion/projects
    video/          Lance la capture de l'application et le rendu d'une vidéo dans des process séparés
    queue/          Travaux d'arrière-plan dans le process (2 en parallèle)
    composition.ts  Câblage des adaptateurs dans les use cases
  video/            Les vidéos elles-mêmes : compositions Remotion (React) et script de rendu.
    src/scenes/     Un composant par plan : accroche, douleur, révélation, démo, fonctionnalité, bénéfice, appel à l'action
    src/theme.ts    Les directions artistiques du mode rapide, à partir des couleurs de la marque
    src/kit.ts      Ce dont une vidéo réalisée par Claude peut se servir
    studio/         Le studio du réalisateur : son guide, son point de départ, les scripts qui dessinent ses images
    src/timing.ts   Quand chaque chose arrive : lu par les plans, et par la bande-son
    audio/          Le synthétiseur et l'écriture de la bande-son
    render.mjs      Rend un travail décrit en JSON, et écrit sa progression ligne par ligne
    capture.mjs     Photographie les pages d'une application en marche
apps/
  web/              Adaptateur primaire : Nuxt 4 (UI + API HTTP locale, handlers fins)
bin/
  repo-motion.mjs   Lance le serveur construit et ouvre le navigateur
```

Règles, vérifiées par ESLint (`eslint.config.js`) :

- `core` n'importe ni framework, ni librairie, ni module Node ; le domaine n'importe pas la couche application.
- `infrastructure` dépend uniquement de `core` ; elle n'importe ni React ni Remotion.
- `video` ne connaît que son propre contrat (`src/types.ts`) : il dessine le travail qu'on lui donne.
- L'app compose `core` + `infrastructure`, et c'est le seul endroit qui connaît HTTP.

Autres conventions :

- **Les erreurs attendues sont des valeurs** (`Result`). Les exceptions sont réservées aux bugs. `apps/web/server/utils/http.ts` traduit chaque type d'erreur en code HTTP de façon exhaustive.
- **Le LLM propose, le domaine garantit** : la sortie de Claude n'est jamais crue sur parole.
- **Un travail interrompu** par l'arrêt de l'application est marqué en échec au démarrage suivant, et peut être relancé.
- **Plusieurs vidéos d'un projet se produisent en même temps** : chaque modification passe par `ProjectRepository.update`, qui les applique l'une après l'autre.

## Design

Une scène sombre, comme un fil de vidéos ou une salle de montage : l'interface reste discrète et ce sont les vidéos verticales qui portent la couleur.

- **Le lecteur de maquettes** (`MotionReelPlayer`) joue une mini-vidéo en CSS dans un cadre 9:16. Il sert d'exemple sur l'accueil et d'aperçu sur les personas ; sur l'écran Vidéos, il laisse la place au vrai MP4 dès qu'il existe.
- **Jaune sous-titre** `#FFE14A` pour l'action principale. **Rouge REC** `#FF5247` pour ce qui tourne en ce moment.
- **Une teinte par persona** dans l'interface : sa carte et celle de sa vidéo portent sa couleur. Chaque projet éclaire sa page avec la couleur de marque extraite du code.
- **La piste de production** (`MotionPipelineTrack`) sert de navigation et d'avancement : Brief → Personas → Vidéos.
- Bricolage Grotesque pour les titres, Instrument Sans pour l'interface, JetBrains Mono uniquement pour le vrai code.

Les jetons sont dans `apps/web/app/assets/main.css`. Les animations respectent `prefers-reduced-motion`.

### Les vidéos

Les vidéos ne portent pas les couleurs de repo-motion mais celles du produit. Dans la direction « Marque », c'est le fond et le texte de la marque, sa couleur principale qui envahit l'écran quand le produit apparaît, ses autres couleurs pour distinguer les fonctionnalités. Les autres directions redistribuent ces mêmes couleurs. Une direction n'est pas un jeu de plans à part : c'est une liste de traits (fond, police, façon dont un mot arrive, coupe, mise en valeur) que les plans lisent sans savoir dans quelle direction ils sont.

- **Tout se lit, rien ne s'écoute** : les mots arrivent un par un, dans le plus grand corps qui tient dans le cadre (`src/text.ts` mesure le texte avec la vraie police et équilibre les lignes). Les mots marqués par le storyboard sont surlignés.
- **Monté comme un showreel** dans les directions qui s'y prêtent : l'accroche est lancée mot par mot en plein cadre avant de s'assembler, des bandes de texte défilent derrière les douleurs, une grille de carrés se referme sur un plan et s'ouvre sur le produit, un curseur vient cliquer l'appel à l'action. Épuré, Magazine et Cinéma gardent leur calme.
- **Une interface en mouvement par fonctionnalité** (`src/scenes/Vignette.tsx`) : recherche qui se tape, liste qui se coche, compteur, globe et repère, messages, classement, minuteur, réglages, document dont les mots se dévoilent, lien partagé, cartes. Claude choisit celle qui montre la fonctionnalité et en écrit les libellés ; le domaine vérifie qu'elle a ce qu'il lui faut.
- **Rien ne reste immobile** : lumières qui dérivent, zoom lent, pictogrammes qui se dessinent, et une transition propre à chaque direction entre deux plans.
- **Zones sûres** : rien d'important en haut, en bas ni sous les boutons des plateformes (`SAFE` dans `src/types.ts`).
- `pnpm --filter @repo-motion/video studio` ouvre le studio Remotion pour travailler les animations.

## Tests

Les tests du core utilisent des adaptateurs en mémoire. Ceux de l'infrastructure utilisent le vrai système de fichiers dans un dossier temporaire, un Claude Code scripté et un script de rendu scripté. Le rendu lui-même se vérifie à l'œil et à l'oreille : `node packages/video/render.mjs <travail.json> --stills 0,60,120` sort des images de la vidéo.
