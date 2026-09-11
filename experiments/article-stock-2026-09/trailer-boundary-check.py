from pathlib import Path
import json, re, subprocess, tempfile

root = Path(__file__).resolve().parents[2]
out = root / 'production/2026-09/batch-05'
media = json.loads((out / 'game-media.json').read_text())
source = subprocess.check_output(['git', '-C', str(root.parent / 'game-jam-lab'), 'show',
    media['commit'] + ':events/2026-ai-browser-game-jam-4/godot/tools/trailer_capture.gd'], text=True)
function = re.search(r'^func beat_index_at\([^\n]*\n(?:(?!^func )[^\n]*\n)*', source, re.M).group().strip()
with tempfile.TemporaryDirectory(prefix='article-trailer-boundary-') as tmp:
    p = Path(tmp)
    p.joinpath('project.godot').write_text('config_version=5\n[application]\nconfig/name="Article Trailer Lab"\n')
    # The function only consumes end times; preserve their values from the inspected source.
    code = 'extends SceneTree\nvar beats := ' + json.dumps(media['trailer']['beats']) + '\n' + function + '\n'
    code += '''
func _init() -> void:
    var checks := 0
    assert(beat_index_at(0.0) == 0)
    checks += 1
    for index in range(beats.size() - 1):
        var boundary := float(beats[index].end)
        assert(beat_index_at(boundary - 0.001) == index)
        assert(beat_index_at(boundary) == index + 1)
        checks += 2
    assert(beat_index_at(60.0) == beats.size() - 1)
    checks += 1
    print("ARTICLE_RESULT=" + JSON.stringify({"assertions": checks, "boundaries": beats.size() - 1, "passed": true}))
    quit(0)
'''
    code = re.sub(r'^( +)', lambda m: '\t' * (len(m.group(1)) // 4), code, flags=re.M)
    p.joinpath('verify.gd').write_text(code)
    result = subprocess.run(['godot', '--headless', '--path', str(p), '--script', 'res://verify.gd'], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0 and 'SCRIPT ERROR' not in result.stderr, result.stderr
    payload = json.loads(next(s.removeprefix('ARTICLE_RESULT=') for s in result.stdout.splitlines() if s.startswith('ARTICLE_RESULT=')))
    report = {'commit': media['commit'], 'godot': subprocess.check_output(['godot','--version'],text=True).strip(),
        'sourceFunction': function, 'result': payload, 'scope': 'Unchanged extracted function, actual boundary values, headless Godot. No video rendering.'}
    out.joinpath('trailer-boundaries.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(payload))
