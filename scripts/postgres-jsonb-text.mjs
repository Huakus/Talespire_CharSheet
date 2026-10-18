/** PostgreSQL jsonb's text layout, used only to verify offline archive hashes. */
export function postgresJsonbText(value){
 if(Array.isArray(value))return '['+value.map(postgresJsonbText).join(', ')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort((a,b)=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b))).map(k=>JSON.stringify(k)+': '+postgresJsonbText(value[k])).join(', ')+'}';
 if(typeof value==='number'&&/[eE]/.test(String(value))){const [mantissa,power]=String(value).split(/[eE]/),sign=mantissa.startsWith('-')?'-':'',digits=mantissa.replace('-','').replace('.',''),decimal=(mantissa.replace('-','').split('.')[0].length)+Number(power);return sign+(decimal<=0?'0.'+'0'.repeat(-decimal)+digits:decimal>=digits.length?digits+'0'.repeat(decimal-digits.length):digits.slice(0,decimal)+'.'+digits.slice(decimal));}
 return JSON.stringify(value);
}
