import { execFileSync } from 'node:child_process';
const ref = process.argv[2] ?? '8a1bfa8';
const show = path => execFileSync('git', ['show', `${ref}:${path}`], {encoding:'utf8'});
// Match the existing publisher's line-based metadata reader. This is not a YAML audit.
const front = path => Object.fromEntries(show(path).match(/^---\n([\s\S]*?)\n---/)[1].split('\n').map(line => {
  const match=line.match(/^(\w+):\s*(.*)$/);
  return match ? [match[1], match[2].replace(/^["']|["']$/g,'')] : ['', ''];
}));
const schedule = JSON.parse(show('schedule/publishing-schedule.json'));
const rows = schedule.map(x => {
  const ja=front(x.source), en=front(x.devto);
  const sourceRecorded=x.platform==='zenn' ? ja.published==='true' : ja.ignorePublish==='false' && !!ja.id && ja.id!=='null';
  const canonical=x.platform==='zenn' ? `https://zenn.dev/hirodeath/articles/${x.source.split('/').pop().replace('.md','')}` : `https://qiita.com/hiro123/items/${ja.id}`;
  return {date:x.date,platform:x.platform,source:x.source,english:x.devto,sourceRecorded,englishRecorded:en.published==='true'&&!!en.devto_id,canonicalMatches:en.canonical_url===canonical};
});
const dates=rows.map(x=>x.date).sort();
const result={ref,environment:process.version,first:dates[0],last:dates.at(-1),entries:rows.length,uniqueDates:new Set(dates).size,inclusiveDays:(Date.parse(dates.at(-1))-Date.parse(dates[0]))/86400000+1,zenn:rows.filter(x=>x.platform==='zenn').length,qiita:rows.filter(x=>x.platform==='qiita').length,sourceRecorded:rows.filter(x=>x.sourceRecorded).length,englishRecorded:rows.filter(x=>x.englishRecorded).length,canonicalMatches:rows.filter(x=>x.canonicalMatches).length,rows};
console.log(JSON.stringify(result,null,2));
