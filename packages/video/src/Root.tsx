import { Composition } from 'remotion'
import { PersonaVideo } from './PersonaVideo'
import { sceneFrames } from './timing.ts'
import { FPS, HEIGHT, WIDTH, type VideoProps } from './types'

/** What the studio shows when no real project is given: enough to work on the motion. */
const sample: VideoProps = {
  look: 'brand',
  screens: [],
  audio: { effects: null, music: null },
  product: { name: 'Exemple' },
  colors: { primary: '#ffe14a', secondary: '#ff5247', accent: '#8f9bff', background: '#09090e', text: '#f5f4ef' },
  logo: null,
  // No font files here: the studio falls back to the system's typefaces.
  fonts: { display: { family: 'Bricolage Grotesque', faces: [] }, body: { family: 'Instrument Sans', faces: [] } },
  scenes: [
    { kind: 'hook', text: 'Tu passes tes dimanches à *refaire* le même tableau ?', seconds: 3 },
    { kind: 'pain', lines: ['Copier. *Coller*.', 'Vérifier. *Recommencer*.'], seconds: 2.6 },
    { kind: 'reveal', line: 'Le tableau qui se remplit *tout seul*.', seconds: 2.9 },
    { kind: 'feature', feature: 'Import', icon: 'bolt', title: 'Importé en *un clic*', caption: 'Dépose ton fichier, les colonnes se rangent seules.', seconds: 3.9 },
    { kind: 'feature', feature: 'Partage', icon: 'share', title: 'Partagé *sans export*', caption: 'Un lien, et toute l’équipe voit la même chose.', seconds: 3.9 },
    { kind: 'benefit', text: 'Ton dimanche *t’appartient* de nouveau.', seconds: 2.5 },
    { kind: 'cta', text: 'Essaie gratuitement', seconds: 3 },
  ],
}

export const Root = () => (
  <Composition
    id="PersonaVideo"
    component={PersonaVideo}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS * 20}
    defaultProps={sample}
    calculateMetadata={({ props }) => ({ durationInFrames: props.scenes.reduce((total, scene) => total + sceneFrames(scene, FPS), 0) })}
  />
)
