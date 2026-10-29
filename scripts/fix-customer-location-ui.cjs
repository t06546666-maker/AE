const fs=require('node:fs');
const path='src/components/CustomerLocationBar.tsx';let source=fs.readFileSync(path,'utf8');
source=source.replace('{open && <div className="modal-backdrop">','{open && createPortal(<div className="modal-backdrop ae-location-overlay" style={{top:viewport.top,height:viewport.height}} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>');
source=source.replace('</section></div>}','</section></div>,document.body)}');
fs.writeFileSync(path,source);
const home='src/pages/customer/Home.tsx';let text=fs.readFileSync(home,'utf8');
const block=text.match(/        <div className="ae-home-language">[\s\S]*?<\/label><\/div>/);
if(!block)throw new Error('Home language selector not found; preserve source.');
text=text.replace(block[0],'');text=text.replace('      </header>',block[0]+'\n      </header>');fs.writeFileSync(home,text);
