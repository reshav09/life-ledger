const PDFDocument=require('pdfkit');
const fs=require('node:fs');
const path=require('node:path');
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeLink(value){try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function inline(text){
 let out=escapeHtml(text);
 out=out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_m,label,url)=>{const decoded=url.replace(/&amp;/g,'&');const safe=safeLink(decoded);return safe?`<a href="${escapeHtml(safe)}" rel="noopener noreferrer">${label}</a>`:label;});
 return out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}
function markdownToSimpleHtml(md=''){
 let list=false;const out=[];
 for(const line of String(md).split('\n')){
  const bullet=/^\s*[*\-•]\s+(.+)/.exec(line);
  if(bullet){if(!list){out.push('<ul>');list=true;}out.push(`<li>${inline(bullet[1])}</li>`);continue;}
  if(list){out.push('</ul>');list=false;}
  const heading=/^(#{1,3})\s+(.+)/.exec(line);
  if(heading)out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
  else if(line.trim()==='---')out.push('<hr>');
  else if(line.trim())out.push(`<p>${inline(line)}</p>`);
 }
 if(list)out.push('</ul>');return out.join('\n');
}
function renderAtsHtml({title,contentMarkdown}){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
 @page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;line-height:1.45;color:#17202a;max-width:780px;margin:24px auto;padding:16px}h1{font-size:22pt}h2{font-size:13pt;border-bottom:1px solid #ccc}h3{font-size:12pt}h1,h2,h3{break-after:avoid}p,li{orphans:3;widows:3}a{color:#164b78}p{margin:6px 0}</style></head><body>${markdownToSimpleHtml(contentMarkdown)}</body></html>`;
}
function plainText(line){return line.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/\*\*/g,'').replace(/^#{1,3}\s+/,'').replace(/^\s*[*\-•]\s+/,'• ');}
function renderPdf({title,contentMarkdown}) {
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',margin:48,info:{Title:title,Creator:'Life Ledger Job Hunt',CreationDate:new Date('2000-01-01T00:00:00Z'),ModDate:new Date('2000-01-01T00:00:00Z')}}),chunks=[];
  doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  const fonts=[process.env.JOBHUNT_PDF_FONT,'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf','/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf'].filter(Boolean);
  const font=fonts.find(f=>fs.existsSync(f));if(font)doc.font(font);
  for(const line of String(contentMarkdown || '').split('\n')){
   if(line.trim()==='---')continue;
   const heading=/^(#{1,3}) /.exec(line);doc.fontSize(heading?(heading[1].length===1?19:12):10);
   if(heading&&doc.y>doc.page.height-110)doc.addPage();
   doc.text(plainText(line),{lineGap:3});if(heading||!line.trim())doc.moveDown(0.3);
  }
  doc.end();
 });
}
module.exports={renderAtsHtml,markdownToSimpleHtml,renderPdf,safeLink};
