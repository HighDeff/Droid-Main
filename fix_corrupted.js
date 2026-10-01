const fs = require('fs');  
let c = fs.readFileSync('client/pages/MobileRemote.tsx', 'utf8');  
const BAD = '‹¨«';  
const patterns = [  
[BAD + '\u0014' + BAD, '??'],  
[BAD + '\u001F' + BAD, '??'],  
[BAD + 'a' + BAD, '??'],  
[BAD + '\u001F', '??'],  
[BAD + '\u001D', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD + '\u001D', '??'],  
[BAD + '\u001F', '??'],  
[BAD + 'a', '??'],  
[BAD, '??'],  
let c = fs.readFileSync('client/pages/MobileRemote.tsx', 'utf8');  
let replaced = 0;  
for (const [p, r] of patterns) {  
const before = c.length;  
c = c.split(p).join(r);  
if (c.length !== before) replaced++;  
}  
console.log('Replacements:', replaced);  
fs.writeFileSync('client/pages/MobileRemote.tsx', c, 'utf8');  
console.log('Fixed'); 
