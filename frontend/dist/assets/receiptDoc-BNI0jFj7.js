import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{R as t,n,v as r,y as i,z as a}from"./loader-circle-UjFkhPan.js";import{t as o}from"./check-BUnOAAxA.js";import{n as s}from"./id-card-D6B-J4nj.js";import{o as c}from"./hr-B_2Riu4D.js";import{r as l}from"./x-BAyak-58.js";import{a as u,g as d}from"./bnb-BRNXQOrD.js";import{r as f,t as p}from"./PhoneInput-BKRzN7Ls.js";import{i as m,o as h,r as g,t as _}from"./reportDoc-DQRig3LR.js";import{B as v}from"./RolePage-DDEfwb_b.js";var y={name:`at-sign`,size:24,node:[[`circle`,{cx:`12`,cy:`12`,r:`4`,key:`4exip2`}],[`path`,{d:`M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8`,key:`7n84p3`}]]};y.node;var b=n(y),x={name:`cloud`,size:24,node:[[`path`,{d:`M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z`,key:`p7xjir`}]]};x.node;var S=n(x),C=e(a(),1),w=t(),T=[{domain:`gmail.com`,name:`Gmail`,letter:`M`,cls:`bg-[#ea4335]`},{domain:`yahoo.com`,name:`Yahoo`,letter:`Y!`,cls:`bg-[#6001d2]`},{domain:`outlook.com`,name:`Outlook`,letter:`O`,cls:`bg-[#0078d4]`},{domain:`icloud.com`,name:`iCloud`,icon:S,cls:`bg-sky-500`}],E=T[0].domain,D=e=>T.find(t=>t.domain===e.toLowerCase());function O({p:e}){return(0,w.jsx)(`span`,{className:`grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold leading-none text-white ${e.cls}`,children:e.icon?(0,w.jsx)(e.icon,{className:`size-3.5`}):e.letter})}var k=e=>{let t=e.indexOf(`@`);return t<0?{local:e,domain:``}:{local:e.slice(0,t),domain:e.slice(t+1)}};function A({t:e,label:t,error:n,value:a,onChange:s,placeholder:c=`username`,required:u}){let[d,f]=(0,C.useState)(!1),[p,m]=(0,C.useState)(!1),[h,g]=(0,C.useState)(``),{local:_,domain:y}=k(a),x=y.toLowerCase()||h||E,S=D(x),A=S??{domain:x,name:x,icon:l,cls:`bg-slate-500 dark:bg-slate-600`},j=p?a:_,M=!p,N=(e,t)=>{let n=e.trim();s(n?t?`${n}@${t}`:n:``)},P=e=>{let t=k(e),n=t.domain?D(t.domain.trim().toLowerCase()):void 0;n?(g(``),N(t.local,n.domain)):s(e)},F=e=>{g(e.domain),N(_,e.domain),f(!1)};return(0,w.jsxs)(`div`,{className:`flex min-w-0 flex-col gap-1`,children:[t&&(0,w.jsx)(`span`,{className:`text-[11px] font-medium ${e.muted}`,children:t}),(0,w.jsxs)(`div`,{className:`relative flex h-10 w-full min-w-0 items-stretch transition focus-within:ring-2 ${e.radius} ${e.chip} ${e.ring} ${n?`ring-1 ring-rose-500/60`:``}`,children:[(0,w.jsx)(`span`,{className:`grid w-8 shrink-0 place-items-center ${e.muted}`,children:(0,w.jsx)(b,{className:`size-4`})}),(0,w.jsxs)(`div`,{className:`relative min-w-0 flex-1`,children:[(0,w.jsx)(`input`,{type:`text`,inputMode:`email`,autoComplete:`off`,required:u,value:j,placeholder:c,onFocus:()=>m(!0),onBlur:()=>{m(!1);let e=k(a),t=e.domain.trim().toLowerCase();N(e.local,t||x)},onChange:e=>P(e.target.value),className:`h-full w-full bg-transparent text-sm outline-none [color-scheme:light] dark:[color-scheme:dark] ${M?`pr-24`:`pr-3`}`}),M&&(0,w.jsxs)(`span`,{"aria-hidden":!0,className:`pointer-events-none absolute right-3 top-1/2 max-w-24 -translate-y-1/2 truncate text-sm ${e.muted} opacity-70`,children:[`@`,x]})]}),(0,w.jsxs)(`button`,{type:`button`,onClick:()=>f(e=>!e),"aria-haspopup":`listbox`,"aria-expanded":d,"aria-label":`Select email provider`,className:`flex shrink-0 items-center gap-1 border-l border-inherit px-2 text-sm ${e.muted}`,children:[(0,w.jsx)(O,{p:A}),(0,w.jsx)(v,{className:`size-3.5 opacity-60 transition ${d?`rotate-180`:``}`})]}),(0,w.jsx)(i,{children:d&&(0,w.jsxs)(w.Fragment,{children:[(0,w.jsx)(`button`,{type:`button`,tabIndex:-1,"aria-label":`Close provider list`,onClick:()=>f(!1),className:`fixed inset-0 z-20 cursor-default`}),(0,w.jsxs)(r.div,{role:`listbox`,"aria-label":`Email provider`,initial:{opacity:0,y:-4},animate:{opacity:1,y:0},exit:{opacity:0,y:-4},transition:{duration:.15},className:`absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-3rem)] overflow-hidden shadow-xl ${e.radius} ${e.card}`,children:[(0,w.jsxs)(`ul`,{className:`max-h-60 overflow-y-auto py-1`,children:[!S&&y.trim()&&(0,w.jsx)(`li`,{children:(0,w.jsxs)(`button`,{type:`button`,role:`option`,"aria-selected":!0,className:`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5`,children:[(0,w.jsx)(O,{p:A}),(0,w.jsxs)(`span`,{className:`min-w-0 flex-1 truncate`,children:[`@`,y.trim()]}),(0,w.jsx)(o,{className:`size-3.5 shrink-0`})]})}),T.map(t=>(0,w.jsx)(`li`,{children:(0,w.jsxs)(`button`,{type:`button`,role:`option`,"aria-selected":t.domain===x,onClick:()=>F(t),className:`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5`,children:[(0,w.jsx)(O,{p:t}),(0,w.jsx)(`span`,{className:`min-w-0 flex-1 truncate`,children:t.name}),(0,w.jsxs)(`span`,{className:`text-xs ${e.muted}`,children:[`@`,t.domain]}),t.domain===x&&(0,w.jsx)(o,{className:`size-3.5 shrink-0`})]})},t.domain))]}),(0,w.jsx)(`p`,{className:`border-t border-slate-900/10 px-3 py-2 text-[10px] dark:border-white/10 ${e.muted}`,children:`Another provider? Type it as name@domain.com`})]})]})})]}),n&&(0,w.jsx)(`span`,{className:`text-[11px] text-rose-500`,children:n})]})}function j(e){let t=e.trim().toLowerCase(),n=f.find(e=>e.name.toLowerCase()===t);return{matched:n,filtered:(0,C.useMemo)(()=>!t||n?f:f.filter(e=>e.name.toLowerCase().includes(t)||e.iso.toLowerCase()===t),[t,n])}}function M({t:e,open:t,filtered:n,matched:a,typed:s,onChoose:c,onClose:l}){return(0,w.jsx)(i,{children:t&&(0,w.jsxs)(w.Fragment,{children:[(0,w.jsx)(`button`,{type:`button`,tabIndex:-1,"aria-label":`Close nationality list`,onClick:l,className:`fixed inset-0 z-20 cursor-default`}),(0,w.jsx)(r.div,{role:`listbox`,"aria-label":`Nationality`,initial:{opacity:0,y:-4},animate:{opacity:1,y:0},exit:{opacity:0,y:-4},transition:{duration:.15},className:`absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-56 overflow-y-auto shadow-xl ${e.radius} ${e.card}`,children:(0,w.jsxs)(`ul`,{className:`py-1`,children:[n.map(e=>(0,w.jsx)(`li`,{children:(0,w.jsxs)(`button`,{type:`button`,role:`option`,"aria-selected":e===a,onClick:()=>c(e.name),className:`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5`,children:[(0,w.jsx)(p,{c:e}),(0,w.jsx)(`span`,{className:`min-w-0 flex-1 truncate`,children:e.name}),e===a&&(0,w.jsx)(o,{className:`size-3.5 shrink-0`})]})},e.iso)),!n.length&&(0,w.jsxs)(`li`,{className:`px-3 py-4 text-center text-xs ${e.muted}`,children:[`No country matches “`,s,`”.`]})]})})]})})}function N({t:e,label:t=`Nationality & ID`,error:n,nationality:r,onNationality:i,idType:a,onIdType:o,idNumber:c,onIdNumber:l,emptyTypeLabel:d}){let[f,m]=(0,C.useState)(!1),{matched:h,filtered:g}=j(r);return(0,w.jsxs)(`div`,{className:`flex min-w-0 flex-col gap-1`,children:[t&&(0,w.jsx)(`span`,{className:`text-[11px] font-medium ${e.muted}`,children:t}),(0,w.jsxs)(`div`,{className:`relative flex w-full min-w-0 flex-col transition focus-within:ring-2 sm:h-10 sm:flex-row sm:items-stretch ${e.radius} ${e.chip} ${e.ring} ${n?`ring-1 ring-rose-500/60`:``}`,children:[(0,w.jsxs)(`div`,{className:`flex h-10 min-w-0 flex-1 items-stretch`,children:[(0,w.jsxs)(`button`,{type:`button`,onClick:()=>m(e=>!e),"aria-haspopup":`listbox`,"aria-expanded":f,"aria-label":`Pick nationality from list`,className:`flex shrink-0 items-center gap-1.5 border-r border-inherit px-2.5 text-sm ${e.muted}`,children:[h?(0,w.jsx)(p,{c:h}):(0,w.jsx)(s,{className:`size-4 opacity-70`}),(0,w.jsx)(v,{className:`size-3.5 opacity-60 transition ${f?`rotate-180`:``}`})]}),(0,w.jsx)(`input`,{type:`text`,autoComplete:`off`,value:r,placeholder:`Nationality`,"aria-label":`Nationality`,onFocus:()=>m(!0),onChange:e=>i(e.target.value),className:`min-w-0 flex-1 bg-transparent px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]`})]}),(0,w.jsxs)(`div`,{className:`flex h-10 min-w-0 items-stretch border-t border-inherit max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] sm:border-l sm:border-t-0`,children:[(0,w.jsxs)(`select`,{value:a,onChange:e=>o(e.target.value),"aria-label":`ID document type`,className:`shrink-0 bg-transparent px-2 text-sm outline-none [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100`,children:[d!==void 0&&(0,w.jsx)(`option`,{value:``,children:d}),u.map(e=>(0,w.jsx)(`option`,{value:e.value,children:e.label},e.value))]}),(0,w.jsx)(`input`,{type:`text`,autoComplete:`off`,value:c,placeholder:`Number`,"aria-label":`ID document number`,onChange:e=>l(e.target.value),className:`min-w-0 flex-1 border-l border-inherit bg-transparent px-3 text-sm outline-none sm:w-32 sm:flex-none`})]}),(0,w.jsx)(M,{t:e,open:f,filtered:g,matched:h,typed:r.trim(),onChoose:e=>{i(e),m(!1)},onClose:()=>m(!1)})]}),n&&(0,w.jsx)(`span`,{className:`text-[11px] text-rose-500`,children:n})]})}var P=e=>({payer:e.payer,method:e.method_label,receipt:e.receipt_number||`—`,ref:e.reference,when:e.paid_at??e.created_at,amount:Number(e.amount)}),F=e=>({payer:e.guest_name,method:`Deposit`,receipt:`—`,ref:``,when:e.created_at,amount:Number(e.deposit??0)}),I=e=>new Date(e).toLocaleString([],{day:`numeric`,month:`short`,year:`numeric`,hour:`2-digit`,minute:`2-digit`}),L=e=>{let t=new Date(e.start),n=new Date(e.end),r=e=>e.toLocaleDateString([],{day:`numeric`,month:`short`,year:`numeric`}),i=e=>e.toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`});if(e.kind===`day_rest`){let a=d(e);return`${r(t)} · ${i(t)} → ${i(n)} (${a} ${a===1?`hour`:`hours`})`}return`${r(t)} → ${r(n)} · ${e.nights} ${e.nights===1?`night`:`nights`}`},R=()=>{let e=document.getElementById(`report-print`);return e||(e=document.createElement(`div`),e.id=`report-print`,document.body.appendChild(e)),e},z=`<div class="rc-dash"></div>`,B=e=>`
  <div class="rc-brand">
    ${e.photo?`<img class="rc-logo" src="${g(e.photo)}" alt="" />`:`<span class="rc-logo rc-mono">${g(m(e.name)||`HS`)}</span>`}
    <p class="rc-company">${g(e.name)}</p>
    ${e.contact?`<p class="rc-contact">${g(e.contact)}</p>`:``}
    ${e.code?`<p class="rc-contact">Branch ${g(e.code)}</p>`:``}
  </div>`,V=(e,t)=>`
  <p class="rc-title">${g(e)}</p>
  ${t.map(e=>`<p class="rc-meta">${e}</p>`).join(``)}`,H=(e,t,n=``)=>`<div class="rc-row${n}"><span>${g(e)}</span><b>${g(t)}</b></div>`,U=(e,t,n)=>`
  <div class="rc-line">
    <div class="rc-left">
      <p class="rc-what">${g(e)}</p>
      ${t?`<p class="rc-det">${g(t)}</p>`:``}
    </div>
    <b class="rc-amt">${g(c(n))}</b>
  </div>`,W=e=>{let t=Number(e.balance);return[H(`Bill`,c(e.bill)),H(`Paid`,c(e.paid)),H(t>0?`Balance due`:t<0?`Credit to guest`:`Settled`,c(Math.abs(t)),` rc-total`)].join(``)},G=e=>[e.room_name,...(e.companions??[]).map(e=>e.room_name)].filter(Boolean).join(`, `);async function K(e,t){let n=await _(),r=h(),i=[];for(let e of t){let t=i[i.length-1];t&&t[0]===e.guest?t[1].push(e):i.push([e.guest,[e]])}let a=i.length>1,o=i.map(([e,t])=>`
    ${a?`<p class="rc-who">${g(e)}</p>`:``}
    ${t.map(e=>U(e.label,e.detail,e.amount)).join(``)}`).join(``),s=[...Number(e.deposit)>0?[F(e)]:[],...(e.payments??[]).filter(e=>Number(e.amount)>0).map(P)],l=new Set(s.map(e=>e.payer)).size>1,u=s.map(e=>U(`${e.method}${e.receipt===`—`?``:` · ${e.receipt}`}`,[I(e.when),e.ref,l?`Paid by ${e.payer}`:``].filter(Boolean).join(` · `),e.amount)).join(``),d=G(e),f=(e.payments??[]).some(e=>e.method===`later`);R().innerHTML=`
    <div class="rc-doc">
      ${B(n)}
      ${z}
      ${V(`Guest receipt`,[`Booking #${e.id} · ${g(e.kind_label)} · ${g(e.status_label)}`,`Printed ${g(r)}`])}
      ${z}
      ${H(`Client`,e.guest_name)}
      ${e.guest_phone?H(`Phone`,e.guest_phone):``}
      ${d?H(d.includes(`,`)?`Rooms`:`Room`,d):``}
      ${H(`Period`,L(e))}
      ${e.created_by_name?H(`Served by`,e.created_by_name):``}
      ${z}

      <p class="rc-sec">Charges</p>
      ${o}
      ${z}
      ${H(`Total bill`,c(e.bill),` rc-total`)}
      ${s.length?`
      ${z}
      <p class="rc-sec">Payments received</p>
      ${u}
      ${z}
      ${H(`Total received`,c(e.paid),` rc-total`)}`:``}
      ${z}
      ${W(e)}
      ${z}

      ${e.tax_reference?`<p class="rc-note">Tax reference: ${g(e.tax_reference)}</p>`:``}
      ${f?`<p class="rc-note">Marked pay-later — the balance is settled progressively before checkout.</p>`:``}
      <p class="rc-thanks">Thank you for staying with us</p>
      <p class="rc-meta">${g(n.name)}${n.code?` · Branch ${g(n.code)}`:``}</p>
    </div>`,window.print()}async function q(e,t,n={}){let r=await _(),i=h();R().innerHTML=`
    <div class="rc-doc">
      ${B(r)}
      ${z}
      ${V(`Payment receipt`,[`${t.receipt===`—`?``:`Receipt ${g(t.receipt)} · `}Booking #${e.id} · ${g(e.kind_label)} · ${g(e.status_label)}`,`${n.reprint?`Reprinted`:`Printed`} ${g(i)}`])}
      ${z}
      <div class="rc-amount"><span>Amount received</span><strong>${g(c(t.amount))}</strong></div>
      ${z}
      ${H(`Received from`,t.payer)}
      ${H(`Method`,t.method)}
      ${H(`Receipt no.`,t.receipt)}
      ${H(`Reference`,t.ref||`—`)}
      ${H(`Time paid`,I(t.when))}
      ${z}
      ${H(`Client`,e.guest_name)}
      ${e.guest_phone?H(`Phone`,e.guest_phone):``}
      ${e.room_name?H(`Room`,e.room_name):``}
      ${H(`Period`,L(e))}
      ${e.created_by_name?H(`Served by`,e.created_by_name):``}
      ${z}
      ${W(e)}
      ${z}

      ${e.tax_reference?`<p class="rc-note">Tax reference: ${g(e.tax_reference)}</p>`:``}
      <p class="rc-thanks">Thank you for staying with us</p>
      <p class="rc-meta">${g(r.name)}${r.code?` · Branch ${g(r.code)}`:``}</p>
    </div>`,window.print()}export{N as a,P as i,q as n,A as o,K as r,F as t};