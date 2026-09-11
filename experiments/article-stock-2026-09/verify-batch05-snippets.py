from pathlib import Path
import json, re, subprocess

root = Path(__file__).resolve().parents[2]
out = root / 'production/2026-09/batch-05'
game_ref = 'f074703848586828b6a5acc0e465ccdd2c0d5244'
game_base = 'events/2026-ai-browser-game-jam-4/'
def git(repo, ref, path):
    return subprocess.check_output(['git', '-C', str(root.parent/repo), 'show', f'{ref}:{path}'], text=True)
def norm(text): return re.sub(r'\s+', '', text)
targets = [
    ('game-input-support-sequence', 'game-jam-lab', game_ref, game_base+'godot/games/charge_clicker/charge_clicker.gd', 'Extracted function run in Godot with synthetic events'),
    ('game-bgm-selection-log', 'game-jam-lab', game_ref, game_base+'godot/games/charge_clicker/charge_clicker.gd', 'Static source match only; audio playback not run'),
    ('trailer-timeline-before-editing', 'game-jam-lab', game_ref, game_base+'godot/tools/trailer_capture.gd', 'Extracted function run in Godot at interval boundaries'),
    ('auth-incident-recovery-evidence', 'circle-hub-auth-recovery', 'd116e8a343e8d9e7ddd3d1985efe590fa1901868', 'apps/web/src/app/sign-in/submission-guard.ts', 'Actual module covered by rerun unit tests'),
    ('guest-identity-without-placeholder-user', 'circle-hub-growth-06-guest-identity', '9aec48963842dcaf16ce49c80317366509ab1b8f', 'apps/web/src/server/api/routers/attendance.ts', 'Method-chain fragment matches actual router; rerun tests mock DB'),
]
report = []
for slug, repo, ref, path, scope in targets:
    source = norm(git(repo, ref, path))
    for language in ['articles','devto']:
        raw = (root/language/f'{slug}.md').read_text()
        blocks = re.findall(r'^```(?:ts|gdscript)\n([\s\S]*?)^```', raw, re.M)
        assert blocks, slug
        for block in blocks: assert norm(block) in source, (slug,language)
    report.append({'slug':slug,'blocksPerLanguage':len(blocks),'sourceMatch':True,'executionScope':scope})
media = json.loads((out/'game-media.json').read_text())
assert (media['bgmSlots'],media['uniqueBgmFiles'],media['uniqueRuntimeFilesIncludingJingle'],media['storedAudioFiles']) == (18,17,18,19)
assert len(media['unreferencedAudioFiles']) == 1
assert len(media['trailer']['beats']) == 11 and media['trailer']['gameNodeVisibleSeconds'] == 51.5
assert json.loads((out/'trailer-boundaries.json').read_text())['result']['assertions'] == 22
for language in ['articles','devto']:
    raw = norm((root/language/'game-bgm-selection-log.md').read_text())
    for filename in ['blue_vault_pulse.ogg','cascade_trinity.ogg','critical_parallax.ogg','nomad_victory_signal.mp3']:
        entry = next(x for x in media['media'] if Path(x['path']).name == filename)
        assert f"|{filename}|{entry['format']['duration']}|" in raw
    for slug, filename in [('trailer-timeline-before-editing','volt-nomad-official-trailer.mp4'),('trailer-timeline-before-editing','volt-nomad-official-trailer-v2.mp4')]:
        entry = next(x for x in media['media'] if Path(x['path']).name == filename)
        assert entry['format']['duration'] in (root/language/f'{slug}.md').read_text()
summary = json.loads((out/'circle-tests-summary.json').read_text())
assert [(x['label'],x['passed'],x['failed']) for x in summary] == [('push',12,0),('auth',47,0),('guest',15,0)]
print(json.dumps({'articles':report,'mediaNumbersMatchStoredEvidence':True,'circleTestCountsVerified':True,'note':'Push article has a translated text diagram, no executable snippet; its four-way matrix is asserted in push-rollout.test.ts.'},ensure_ascii=False,indent=2))
