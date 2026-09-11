"""Inspect fixed Git media and run extracted, unchanged input code in local Godot."""
from pathlib import Path
import hashlib, json, re, subprocess, tempfile

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent / 'game-jam-lab'
COMMIT = 'f074703848586828b6a5acc0e465ccdd2c0d5244'
BASE = 'events/2026-ai-browser-game-jam-4/'
OUT = ROOT / 'production/2026-09/batch-05'
def git(path, ref=COMMIT):
    return subprocess.check_output(['git', '-C', str(REPO), 'show', f'{ref}:{BASE}{path}'])
def function(source, name):
    return re.search(r'^func ' + name + r'\([^\n]*\n(?:(?!^func )[^\n]*\n)*', source, re.M).group().rstrip() + '\n'

game = git('godot/games/charge_clicker/charge_clicker.gd').decode()
bindings = git('godot/shared/controller_bindings.gd').decode()
motion = function(game, 'controller_motion_direction')
with tempfile.TemporaryDirectory(prefix='article-game-input-') as tmp:
    p = Path(tmp)
    p.joinpath('project.godot').write_text('config_version=5\n[application]\nconfig/name="Article Input Lab"\n')
    p.joinpath('bindings.gd').write_text(bindings)
    p.joinpath('motion.gd').write_text('extends RefCounted\nvar controller_axis_latch := Vector2i.ZERO\n' + motion)
    p.joinpath('verify.gd').write_text('''extends SceneTree
func _init() -> void:
    for action in ["jump", "dash", "attack"]:
        InputMap.add_action(action)
    var keyboard := InputEventKey.new()
    keyboard.keycode = KEY_SPACE
    InputMap.action_add_event("attack", keyboard)
    var config = load("res://bindings.gd").new()
    config.apply_input_map()
    var original: Dictionary = config.bindings.duplicate()
    assert(config.rebind("primary", JOY_BUTTON_X, false))
    assert(config.get_button("primary") == JOY_BUTTON_X)
    assert(config.get_button("secondary") == JOY_BUTTON_A)
    var swapped: Dictionary = config.bindings.duplicate()
    assert(not config.rebind("primary", JOY_BUTTON_DPAD_LEFT, false))
    assert(not config.rebind("unknown", JOY_BUTTON_A, false))
    assert(config.bindings == swapped)
    assert(config.rebind("combat_action", JOY_BUTTON_RIGHT_STICK, false))
    var key_count := 0
    var joy_count := 0
    for event in InputMap.action_get_events("attack"):
        if event is InputEventKey:
            key_count += 1
            assert(event.keycode == KEY_SPACE)
        if event is InputEventJoypadButton:
            joy_count += 1
            assert(event.button_index == JOY_BUTTON_RIGHT_STICK)
    assert(key_count == 1 and joy_count == 1)
    var subject = load("res://motion.gd").new()
    var inputs := [
        [JOY_AXIS_LEFT_X, 0.2, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, 0.7, Vector2i.RIGHT],
        [JOY_AXIS_LEFT_X, 0.8, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, -0.8, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, 0.1, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, -0.8, Vector2i.LEFT],
        [JOY_AXIS_LEFT_Y, 0.8, Vector2i.DOWN],
        [JOY_AXIS_LEFT_Y, 0.9, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, 0.0, Vector2i.ZERO],
        [JOY_AXIS_LEFT_X, 0.8, Vector2i.RIGHT],
    ]
    var records := []
    for item in inputs:
        var event := InputEventJoypadMotion.new()
        event.axis = item[0]
        event.axis_value = item[1]
        var result: Vector2i = subject.controller_motion_direction(event)
        assert(result == item[2])
        records.append({"axis": "x" if item[0] == JOY_AXIS_LEFT_X else "y", "value": item[1], "direction": [result.x, result.y]})
    print("ARTICLE_RESULT=" + JSON.stringify({"motionEvents": records, "rebindChecks": ["conflicting buttons swap", "unsupported button and unknown action rejected without change", "keyboard mapping survives joypad replacement"], "settingsWritten": false}))
    quit(0)
''')
    proc = subprocess.run(['godot', '--headless', '--path', str(p), '--script', 'res://verify.gd'], capture_output=True, text=True, timeout=45)
    OUT.joinpath('game-input.log').write_text((proc.stdout + proc.stderr).rstrip() + '\n')
    assert proc.returncode == 0 and 'SCRIPT ERROR' not in proc.stderr, proc.stderr
    payload = json.loads(next(line.removeprefix('ARTICLE_RESULT=') for line in proc.stdout.splitlines() if line.startswith('ARTICLE_RESULT=')))
    result = {'commit': COMMIT, 'godot': subprocess.check_output(['godot', '--version'], text=True).strip(),
        'scope': 'Headless Godot with the unchanged controller class and extracted motion function. Synthetic events; no browser or physical-device test.',
        'sourceFunction': motion, 'result': payload}
    OUT.joinpath('game-input.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')

bgm_block = re.search(r'const BGMStreams := \{([\s\S]*?)\n\}', game).group(1)
streams = dict(re.findall(r'"([^"]+)": preload\("res://([^"]+)"\)', bgm_block))
jingle = re.search(r'const VictoryJingleStream[^\n]*preload\("res://([^"]+)"\)', game).group(1)
encounter_block = re.search(r'const EncounterBGMKeys := \{([\s\S]*?)\n\}', game).group(1)
encounters = dict(re.findall(r'"([^"]+)": "([^"]+)"', encounter_block))
for key in encounters.values(): assert key in streams
tracked = subprocess.check_output(['git', '-C', str(REPO), 'ls-tree', '-r', '--name-only', COMMIT, BASE + 'godot/assets/audio/project_charge'], text=True).splitlines()
audio_paths = [x.removeprefix(BASE) for x in tracked if x.endswith(('.mp3', '.ogg'))]
trailer_paths = ['submission/trailer/volt-nomad-official-trailer.mp4', 'submission/trailer/volt-nomad-official-trailer-v2.mp4']
probes = []
with tempfile.TemporaryDirectory(prefix='article-media-probe-') as tmp:
    for path in audio_paths + trailer_paths:
        data = git(path)
        local = Path(tmp) / Path(path).name
        local.write_bytes(data)
        raw = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
            'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
            '-of', 'json', str(local)], text=True))
        probes.append({'path': path, 'sha256': hashlib.sha256(data).hexdigest(), **raw})
trailer = git('godot/tools/trailer_capture.gd').decode()
beats = [{'start': float(a), 'end': float(b), 'id': c} for a,b,c in re.findall(r'\{"start": ([\d.]+), "end": ([\d.]+), "id": "([^"]+)"', trailer)]
assert beats[0]['start'] == 0 and beats[-1]['end'] == 60
for previous, current in zip(beats, beats[1:]): assert previous['end'] == current['start']
game_seconds = sum(b['end']-b['start'] for b in beats if b['id'] not in ['prime_art','final'])
assert game_seconds == 51.5
old_trailer = git('godot/tools/trailer_capture.gd', 'bf5c7e7').decode()
old_duration = float(re.search(r'const DURATION := ([\d.]+)', old_trailer).group(1))
assert old_duration == 63
runtime_audio = {f'godot/{p}' for p in streams.values()} | {f'godot/{jingle}'}
assert runtime_audio <= set(audio_paths)
result = {'commit': COMMIT, 'ffprobe': subprocess.check_output(['ffprobe','-version'],text=True).splitlines()[0],
    'bgmSlots':len(streams), 'uniqueBgmFiles':len(set(streams.values())), 'uniqueRuntimeFilesIncludingJingle':len(runtime_audio),
    'storedAudioFiles':len(audio_paths), 'unreferencedAudioFiles':sorted(set(audio_paths)-runtime_audio),
    'encounterMappings':encounters, 'streams':streams, 'media':probes,
    'trailer':{'oldSourceDuration':old_duration,'beats':beats,'totalSeconds':60,'gameNodeVisibleSeconds':game_seconds,
        'scope':'Sum of scripted intervals and ffprobe metadata. Not an unscripted playthrough or frame-by-frame visual review.'},
    'scope':'Read-only extraction from Git. No playback, loudness measurement, media conversion, generation, or upload.'}
OUT.joinpath('game-media.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['bgmSlots','uniqueBgmFiles','uniqueRuntimeFilesIncludingJingle','storedAudioFiles','unreferencedAudioFiles']},ensure_ascii=False))
