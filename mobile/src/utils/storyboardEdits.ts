import { Storyboard } from '../services/api';

/** Matches backend normalizeStoryboard so typed words are not sliced later. */
export const CAPTION_MAX = 48;
export const NARRATION_MAX = 400;
export const FULL_NARRATION_MAX = 900;

export function withSceneCopy(
  board: Storyboard,
  sceneId: number,
  patch: { caption?: string; narrationText?: string }
): Storyboard {
  const scenes = (board.scenes || []).map((scene) => {
    if (scene.id !== sceneId) return scene;
    return {
      ...scene,
      caption: patch.caption !== undefined ? patch.caption.slice(0, CAPTION_MAX) : scene.caption,
      narrationText:
        patch.narrationText !== undefined
          ? patch.narrationText.slice(0, NARRATION_MAX)
          : scene.narrationText,
    };
  });

  const narrationTouched = patch.narrationText !== undefined;
  const joined = scenes
    .map((scene) => scene.narrationText.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, FULL_NARRATION_MAX);

  const first = scenes[0];
  return {
    ...board,
    scenes,
    fullNarration: narrationTouched ? joined || board.fullNarration : board.fullNarration,
    hook: first?.caption?.trim() || board.hook,
  };
}

export function scriptReadyMessage(board: Storyboard): string | null {
  const scenes = board.scenes || [];
  if (scenes.length !== 4) return 'We need all 4 scenes before generate.';
  for (const scene of scenes) {
    if (!scene.caption.trim()) return `Scene ${scene.id} needs an on-screen caption.`;
    if (!scene.narrationText.trim()) return `Scene ${scene.id} needs a voice line.`;
  }
  return null;
}
