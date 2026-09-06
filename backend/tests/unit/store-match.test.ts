import { parseJsonObject, repairLooseJson } from '../../src/services/json-parse';

describe('Vision JSON parse', () => {
  it('reads JSON wrapped in prose', () => {
    const parsed = parseJsonObject('Here is the mapping:\n{"picks":[{"sceneId":1,"imageIndex":2}]}') as {
      picks: Array<{ sceneId: number; imageIndex: number }>;
    };
    expect(parsed.picks[0]).toEqual({ sceneId: 1, imageIndex: 2 });
  });

  it('rejects empty model output', () => {
    expect(() => parseJsonObject('Here is the')).toThrow(/MODEL_JSON/);
  });

  it('repairs trailing commas and unquoted keys', () => {
    const repaired = repairLooseJson('{picks:[{sceneId:1,imageIndex:2,},],}');
    expect(JSON.parse(repaired)).toEqual({ picks: [{ sceneId: 1, imageIndex: 2 }] });
  });

  it('reads JSON from a markdown fence', () => {
    const parsed = parseJsonObject('```json\n{"picks":[{"sceneId":3,"imageIndex":1}]}\n```') as {
      picks: Array<{ sceneId: number }>;
    };
    expect(parsed.picks[0].sceneId).toBe(3);
  });
});
