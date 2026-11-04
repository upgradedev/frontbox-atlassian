// Shared board rendering for the demo mirror and its static export.
// Self-contained inline CSS, system fonts, no external assets.

export function esc(text) {
  return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function chip(label, kind) {
  const cls = kind === 'blocked' ? 'chip chip-blocked' : 'chip chip-ready';
  return '<span class="' + cls + '">' + esc(label) + '</span>';
}

export function renderBoardPage({ note, columns, rows }) {
  const head = columns.map((c) => '<th>' + esc(c) + '</th>').join('');
  const body = rows.map((cells) => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>FrontBox demo mirror</title><style>'
    + 'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:24px auto;max-width:1100px;padding:0 16px;color:#172b4d;line-height:1.45}'
    + 'h1{font-size:22px;margin:0 0 8px} p{max-width:75ch}'
    + 'table{border-collapse:collapse;width:100%;margin-top:16px;font-size:14px}'
    + 'th,td{border:1px solid #dfe1e6;padding:8px;text-align:left;vertical-align:top}'
    + 'th{background:#f4f5f7}'
    + '.chip{display:inline-block;border-radius:3px;padding:1px 7px;font-size:12px;font-weight:600}'
    + '.chip-blocked{background:#ffebe6;color:#bf2600}.chip-ready{background:#e3fcef;color:#006644}'
    + 'a{color:#0052cc}</style></head><body>'
    + '<h1>FrontBox for JSM and Confluence: demo mirror</h1>'
    + '<p><strong>FrontBox checks JSM incidents against Confluence safety SOPs and spare parts via Teamwork Graph before dispatching field crews with automatic standby failover.</strong></p>'
    + '<p>' + note + '</p>'
    + '<table><tr>' + head + '</tr>' + body + '</table>'
    + '</body></html>';
}
