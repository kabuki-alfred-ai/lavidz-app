import { Composition, registerRoot } from 'remotion'
import { LavidzComposition } from './LavidzComposition'
import { DEFAULT_SUBTITLE_SETTINGS } from './subtitleTypes'
import { DEFAULT_TRANSITION_THEME, DEFAULT_INTRO_SETTINGS } from './themeTypes'

export function RemotionRoot() {
  return (
    <Composition
      id="LavidzComposition"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={LavidzComposition as any}
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        segments: [],
        questionCardFrames: 120,
        subtitleSettings: DEFAULT_SUBTITLE_SETTINGS,
        theme: DEFAULT_TRANSITION_THEME,
        intro: DEFAULT_INTRO_SETTINGS,
        fps: 30,
      }}
    />
  )
}

registerRoot(RemotionRoot)
