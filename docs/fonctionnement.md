# Comment fonctionne repo-motion

Ce document détaille ce qui se passe, étape par étape, quand repo-motion analyse un projet puis en tire des vidéos. Pour démarrer, voir le [README](../README.md).

## Ce qui se passe pendant une analyse

1. `AddProject` vérifie que le dossier existe et l'enregistre.
2. `RequestAnalysis` vérifie que Claude Code est installé et connecté, puis met l'analyse en file.
3. `RunAnalysis` lance `claude -p` **dans le dossier**, avec votre connexion :
   - outils limités à la lecture (`Read`, `Glob`, `Grep`) : Claude ne peut rien exécuter, écrire ni télécharger ;
   - aucune permission n'est demandée ni accordée (`--permission-mode dontAsk`) ;
   - les hooks, réglages et serveurs MCP du dossier analysé ne sont pas chargés ;
   - la conversation n'apparaît pas dans votre historique Claude Code.
4. L'interface affiche en direct ce que Claude lit.
5. La réponse est validée par un schéma JSON, puis par les règles du domaine (`ProductBrief.create`). Si elle est refusée, Claude a une chance de la corriger, sans relire le code.

Les personas suivent le même chemin (`RequestPersonas`, puis `WritePersonas` en arrière-plan), mais sans aucun outil : Claude les écrit à partir du brief seul, en une minute environ, en expliquant pour chacun de quelle audience et de quelles fonctionnalités du brief il découle, puis propose pour chacun le style de sa vidéo. Le domaine vérifie qu'ils sont distincts, que leur accroche tient en 80 caractères et que les fonctionnalités citées existent bien dans le brief. Un nouveau brief rend les personas caducs : ils sont à réécrire.

## Ce qui se passe pendant la production d'une vidéo

Il y a deux façons de fabriquer une vidéo, au choix dans les réglages communs.

**D'abord, les scripts.** Dans les deux modes, la vidéo part d'un script que vous choisissez. Un script, c'est ce qu'on lit à l'écran, temps par temps, et ce qu'on y voit. Il est écrit pour être compris et regardé jusqu'au bout (`ScriptWriter`, trois passages de Claude, sans aucun outil) :

1. **Écriture.** Claude formule en une phrase ce qu'est le produit, comme à un ami, et repère ce qui se montre le mieux. Il écrit une dizaine d'accroches, puis trois scripts complets dans des formats différents : jouez avec moi, démo d'abord, avant / après, idée reçue, POV, liste, problème / solution ou défi.
2. **Test à froid.** Chaque script est montré à un autre Claude, qui n'a ni le brief ni le nom du produit : il ne voit que l'écran, seconde par seconde. Il dit à quel moment il a compris de quoi il s'agit, où il aurait zappé et pourquoi, ce qu'il croit que c'est, et quels mots il n'a pas compris.
3. **Réécriture.** Claude compare ce que le spectateur a compris à ce qu'est vraiment le produit, réécrit là où il s'est perdu, puis recommande un script. Les scripts réécrits sont testés à nouveau.

Le domaine (`Script.create`) vérifie ce qui se vérifie :
- l'accroche dure moins de 3 s et ne cite pas le produit ;
- un temps dit clairement de quoi il s'agit avant la 6e seconde ;
- la question ouverte au début reçoit sa réponse ;
- chaque texte reste assez longtemps pour être lu ;
- la vidéo dure entre 12 et 40 s.

Comptez quelques minutes. La vidéo attend ensuite votre choix. Sur sa carte, les trois scripts s'affichent avec le verdict du spectateur, et vous pouvez en modifier les mots. Les scripts restent avec la vidéo : une fois celle-ci faite, ou si elle échoue, vous pouvez en réaliser un autre sans tout réécrire.

**Réalisée par Claude** (par défaut). Votre Claude Code travaille comme un motion designer : il lit le brief et le script choisi, dont il garde les mots et le rythme, trouve l'idée visuelle qui le sert, écrit le code de l'animation, tire des planches de ses propres images, les regarde, note ce qui ne va pas et corrige, plusieurs fois. Comptez 10 à 30 minutes par vidéo et nettement plus de quota Claude qu'en mode rapide.

- Claude travaille dans un dossier fait pour cette vidéo (`~/.repo-motion/studio/<projet>/<persona>/`), avec le brief, un guide du studio (`packages/video/studio/GUIDE.md`) et les éléments du produit : logo, typographie, captures de l'application.
- Il y est **cloisonné** : il peut lire et écrire dans ce dossier, et lancer deux commandes, celles qui dessinent ses images (`studio/sheet.mjs`, `studio/still.mjs`). Toute autre commande, tout fichier hors du dossier et tout accès réseau lui sont refusés. Le code qu'il écrit n'est jamais exécuté par Node : il est empaqueté, puis joué dans le navigateur sans interface qui dessine la vidéo.
- Rien n'est téléchargé ni généré ailleurs : tout ce qu'on voit est dessiné par son code ou vient du produit, et le son est synthétisé à partir de la partition qu'il écrit (`sound.json`).
- repo-motion ne le croit pas sur parole : son compte rendu est validé par le domaine (`DirectedPiece.create`) et la vidéo est redessinée pour vérifier qu'elle se rend. Sinon, Claude est renvoyé au travail une fois, avec ce qui ne va pas.

**Rapide.** Claude place seulement le script choisi dans un storyboard, et la vidéo est assemblée à partir de plans tout faits. Une à deux minutes par vidéo, une fois le script choisi. Les étapes ci-dessous décrivent ce mode ; les étapes 1, 2 et 6 valent pour les deux.

1. `RequestVideo` met la vidéo d'un persona en file, avec le style de ce persona et les réglages communs à cet instant (voir plus bas). Deux vidéos sont produites en même temps, les autres attendent.
2. Si la vidéo montre l'application, `ProduceVideo` commence par la **photographier** : un navigateur sans interface ouvre ses pages, comme un téléphone, et en garde une image par page. Soit vous avez donné les liens des pages, soit Claude les choisit : il lit le code (en lecture seule) pour trouver les pages qui existent et s'ouvrent sans compte, et retient celles qui parlent le plus au persona. Dans ce cas l'accueil est photographié d'abord : si l'application ne répond pas, la vidéo s'arrête là, avant d'avoir sollicité Claude.
3. Il fait écrire et tester les **scripts** (voir plus haut), puis attend votre choix (`ChooseScript`). Il demande ensuite à Claude le **storyboard**, sans aucun outil : les mots du script placés dans les plans. Il y a l'accroche, la révélation du produit (le temps « ce que c'est »), la démo éventuelle, une à trois fonctionnalités (chacune avec l'interface animée qui la montre), la réponse et l'appel à l'action. S'y ajoutent le texte et les mots-dièse de la publication.
4. Le domaine (`Storyboard.create`) vérifie le rythme du format court : l'accroche ne cite pas le produit, chaque texte tient dans sa longueur, les fonctionnalités existent dans le brief, la vidéo dure entre 12 et 28 secondes (33 avec une démo). C'est aussi lui qui fixe la durée de chaque plan, d'après le temps qu'il faut pour le lire. Un storyboard refusé est renvoyé une fois à Claude pour correction.
5. Le **rendu** se fait avec [Remotion](https://www.remotion.dev), dans un process Node séparé (`packages/video/render.mjs`) : React, le bundler et le navigateur sans interface restent hors du serveur de l'application. Le script lit le logo du produit et sa typographie dans le dossier du projet (paquets Fontsource de `node_modules`) ; rien n'est téléchargé, et sans logo ni police trouvés la vidéo utilise l'initiale du produit et la police de repo-motion.
6. Le MP4 (1080 × 1920, H.264, 30 images/s) est écrit dans `~/.repo-motion/videos/<projet>/`. L'écran Vidéos le lit, le propose en téléchargement et donne le texte à publier.

De nouveaux personas ou un nouveau brief rendent les vidéos caduques.

### Le style de chaque vidéo, et les réglages communs

Une vidéo est écrite pour un persona : son **style** l'est aussi. Chaque persona a le sien, en trois choix.

| Choix | Possibilités | Ce que ça change |
| --- | --- | --- |
| Direction artistique | 11 styles | Le rendu : fond, typographie, mouvement des mots, transitions, mise en valeur |
| Ton | 17 tons | La consigne donnée à Claude. Le ton change la façon de le dire, jamais les faits : même « pushy », rien n'est inventé |
| Son | Sans son, Effets sonores, Rythme et effets, Votre musique | Une bande-son dans le MP4 |

**Claude propose un style par persona**, avec une phrase qui dit pourquoi (`StyleAdvisor`) : juste après avoir écrit les personas, et à la demande depuis l'écran Vidéos. Il les choisit différents là où les personas diffèrent, puisque les vidéos sortent en série. Tout reste modifiable sur la carte de chaque persona : votre choix l'emporte sur la proposition, un clic y revient, et un style peut être appliqué à tous les personas d'un coup. Sans proposition ni choix, la vidéo garde le style de la marque, sa voix, et pas de son.

Deux **réglages communs** valent pour toutes les vidéos du projet, parce qu'ils tiennent au produit et non au persona (`SetUpVideos`) : la façon de montrer l'application (non, « Claude choisit les pages », ou « je donne les liens »), et le fichier de « Votre musique ».

Style et réglages s'appliquent aux vidéos générées ensuite : une vidéo déjà faite garde ceux avec lesquels elle a été demandée, et la carte propose de la refaire s'ils ont changé.

**Les directions artistiques** : Marque (scène sombre aux couleurs du produit), Impact (aplats, capitales, coupes franches), Épuré (encre sur papier), Néon (tubes de lumière dans le noir), Dégradé (vos couleurs qui se fondent), Magazine (serif et italiques), Terminal (ligne de commande, texte tapé), Pop (pastels et autocollants), Cinéma (bandes noires, capitales espacées), Rétro (affiche, rayons de soleil), Collage (papiers découpés, traits à la main). Toutes partent des couleurs de la marque. Quand Claude réalise la vidéo, la direction est un brief qu'il interprète librement ; en mode rapide, c'est une fiche de quelques lignes dans `packages/video/src/theme.ts`.

**Les tons** : Voix de la marque, Complice, Expert, Drôle, Pushy, Récit, POV, Provocateur, Défi, Inspirant, Pédagogue, Rassurant, Sobre, Premium, Ironique, Gen Z, Bande-annonce.

**Pour montrer l'application, elle doit tourner sur votre ordinateur** pendant la génération : lancez-la comme pour développer (`npm run dev`, par exemple), donnez l'adresse qu'elle affiche (`http://localhost:5173`) et laissez-la ouverte. Elle est filmée à ce moment-là, vue comme par un visiteur qui vient d'arriver : sans compte connecté, sans données saisies. Quand Claude choisit les pages, comptez environ une minute de plus par vidéo ; une page qu'il a lue dans le code mais qui ne s'ouvre pas est simplement laissée de côté. Avant la photo, une fenêtre qui accueille chaque première visite (règles, cookies) est fermée par son propre bouton, comme le ferait un visiteur ; rien d'autre n'est cliqué. Quand Claude choisit les pages, l'application est ouverte dans la langue du brief ; sinon, dans celle de votre ordinateur.

Le son est **synthétisé** par repo-motion (`packages/video/audio`) : rien n'est téléchargé ni enregistré, donc rien n'a de licence. Chaque son tombe sur le mouvement qu'il accompagne, parce que le script de rendu et les plans lisent leurs instants dans le même fichier (`src/timing.ts`). Le rythme choisit son tempo pour que son « drop » tombe à l'image où le produit apparaît. « Votre musique » joue un fichier audio de votre ordinateur sous les effets : à vous de vérifier que vous avez le droit de l'utiliser.

repo-motion ne vous connecte jamais à Claude et ne voit aucun identifiant : il lance le Claude Code que vous avez installé.

Le serveur n'écoute que sur `localhost` et refuse les requêtes venant d'un autre site.

