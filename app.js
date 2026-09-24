const STORAGE_KEY = "tsb-roster-shifts-v2";
const palette = [
  {from:6,to:10,color:"#F7EFE2"},
  {from:12,to:14,color:"#DDCDBD"},
  {from:16,to:17,color:"#E5EDF0"},
  {from:18,to:19,color:"#9FADB6"},
  {from:20,to:22,color:"#A49284"},
];

let shifts = loadShifts();
let weekOffset = 0;

const $ = id => document.getElementById(id);
const fileInput = $("fileInput");

$("uploadButton").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  try { await processFiles(files); }
  catch (err) { showError(err.message || "I couldn't read that roster screenshot."); }
  finally { fileInput.value = ""; }
});

$("prevWeek").addEventListener("click",()=>{weekOffset--; render();});
$("nextWeek").addEventListener("click",()=>{weekOffset++; render();});
$("clearAll").addEventListener("click",()=>{
  if(confirm("Clear all TSB shifts from this app?")){
    shifts=[]; save(); weekOffset=0; render();
  }
});
$("exportIcs").addEventListener("click", exportICS);

function loadShifts(){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(normalizeShift).filter(Boolean) : [];
  } catch { return []; }
}
function normalizeShift(s){
  if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !/^\d{2}:\d{2}$/.test(s.start)) return null;
  return {...s, hours: clamp(Number(s.hours ?? 8), 1, 24)};
}
function clamp(n,min,max){ return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : min; }
function save(){localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));}
function showError(msg){$("error").textContent=msg;$("error").classList.remove("hidden");}
function hideError(){$("error").classList.add("hidden");}

async function processFiles(files){
  hideError();
  $("progress").classList.remove("hidden");
  const found=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    setProgress(Math.round((i/files.length)*100),`Reading screenshot ${i+1} of ${files.length}…`);
    const result=await Tesseract.recognize(file,"eng",{
      logger:m=>{
        if(m.status==="recognizing text"){
          const pct=Math.round((m.progress||0)*100);
          const overall=Math.round(((i+(m.progress||0))/files.length)*100);
          setProgress(overall,`Reading screenshot ${i+1} of ${files.length}…`);
        }
      }
    });
    found.push(...parseRosterText(result.data.text));
  }
  const unique=dedupe(found);
  if(!unique.length) throw new Error("I couldn't find any roster dates and start times. Try a clearer screenshot of the mobile roster list.");
  shifts=dedupe([...shifts,...unique]).sort(sortShifts);
  save();
  setProgress(100,`${unique.length} shift${unique.length===1?"":"s"} added — check the dates/times below`);
  setTimeout(()=>$("progress").classList.add("hidden"),1300);
  render();
}

function setProgress(percent,label){
  $("progressBar").style.width=percent+"%";
  $("progressPercent").textContent=percent+"%";
  $("progressLabel").textContent=label;
}

function parseRosterText(text){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const year=findYear(text)||new Date().getFullYear();
  const out=[];
  for(let i=0;i<lines.length;i++){
    const d=parseDateLine(lines[i],year);
    if(!d) continue;
    for(let j=i+1;j<Math.min(i+7,lines.length);j++){
      if(parseDateLine(lines[j],year)) break;
      const t=parseTime(lines[j]);
      if(t){ out.push({date:d,start:t,hours:8}); break; }
    }
  }
  return out;
}
function findYear(text){ const m=text.match(/\b(20\d{2})\b/); return m?Number(m[1]):null; }
function parseDateLine(line,year){
  let m=line.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  if(m){
    const month=monthNumber(m[2]);
    if(!month) return null;
    return makeDateString(year,month,Number(m[1]));
  }
  m=line.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](20\d{2}))?\b/);
  if(m) return makeDateString(Number(m[3]||year),Number(m[2]),Number(m[1]));
  return null;
}
function makeDateString(year,month,day){
  const max=new Date(Date.UTC(year,month,0)).getUTCDate();
  if(month<1||month>12||day<1||day>max) return null;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function monthNumber(m){
  const s=m.slice(0,3).toLowerCase();
  return {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}[s];
}
function parseTime(line){
  let m=line.match(/\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\b/);
  if(m) return `${String(Number(m[1])).padStart(2,"0")}:${m[2]}`;
  m=line.match(/\b(1[0-2]|0?[1-9])\s*([ap])\.?m\.?\b/i);
  if(m){ let h=Number(m[1]); if(m[2].toLowerCase()==="p"&&h!==12)h+=12; if(m[2].toLowerCase()==="a"&&h===12)h=0; return `${String(h).padStart(2,"0")}:00`; }
  return null;
}
function dedupe(arr){
  const map=new Map();
  arr.map(normalizeShift).filter(Boolean).forEach(s=>map.set(`${s.date}_${s.start}`,s));
  return [...map.values()];
}
function sortShifts(a,b){return a.date.localeCompare(b.date)||a.start.localeCompare(b.start);}
function colorFor(start){
  const h=Number(start.slice(0,2));
  const p=palette.find(x=>h>=x.from&&h<=x.to);
  return p?p.color:"#EEE9E3";
}
function textColor(bg){ return ["#A49284","#9FADB6"].includes(bg)?"#fff":"#3f3a35"; }

// Pure date/time arithmetic — deliberately avoids Date('YYYY-MM-DD'), which can shift
// calendar dates because that form is interpreted as UTC on many browsers.
function endDateTime(dateStr,start,hours){
  const [y,m,d]=dateStr.split("-").map(Number);
  const [hh,mm]=start.split(":").map(Number);
  let total=hh*60+mm+Math.round(hours*60);
  let dayCarry=Math.floor(total/1440);
  total=((total%1440)+1440)%1440;
  const dt=new Date(Date.UTC(y,m-1,d+dayCarry));
  const date=`${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`;
  const time=`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  return {date,time};
}
function formatTime(t){let[h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${String(m).padStart(2,"0")} ${ap}`;}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay();x.setDate(x.getDate()-((day+6)%7));return x;}
function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function prettyRange(start,end){const opts={day:"numeric",month:"short"};return `${start.toLocaleDateString("en-AU",opts)} – ${end.toLocaleDateString("en-AU",opts)}`;}

function render(){
  const base=startOfWeek(new Date());base.setDate(base.getDate()+weekOffset*7);
  const end=new Date(base);end.setDate(end.getDate()+6);
  $("weekLabel").textContent=prettyRange(base,end);
  const cal=$("calendar");cal.className="calendar-grid";cal.innerHTML="";
  const today=localISO(new Date());
  for(let i=0;i<7;i++){
    const d=new Date(base);d.setDate(d.getDate()+i);const ds=localISO(d);
    const dayShifts=shifts.filter(s=>s.date===ds);
    const day=document.createElement("div");day.className="day"+(ds===today?" today":"")+(dayShifts.length?" has-shift":"");
    day.innerHTML=`<div class="day-head">${d.toLocaleDateString("en-AU",{weekday:"short"})}</div><div class="day-num">${d.getDate()}</div>`;
    dayShifts.forEach(s=>{
      const bg=colorFor(s.start), endDT=endDateTime(s.date,s.start,s.hours||8);
      const item=document.createElement("div");item.className="shift";item.style.background=bg;item.style.color=textColor(bg);
      item.innerHTML=`<div class="shift-time">${formatTime(s.start)}</div><div class="shift-end">until ${formatTime(endDT.time)} · ${s.hours||8} hrs</div><button class="edit-shift" type="button" data-key="${s.date}_${s.start}">Edit</button>`;
      day.appendChild(item);
    });
    cal.appendChild(day);
  }
  if(!shifts.length){cal.className="calendar-grid empty-state";cal.innerHTML=`<div class="empty-inner"><div class="empty-star">⭐️</div><h3>No shifts yet</h3><p>Upload your TSB roster screenshots above and they’ll appear here.</p></div>`;}
  renderEditList();
}

function renderEditList(){
  const list=$("shiftList");
  if(!shifts.length){list.innerHTML=`<div class="edit-empty">Your uploaded shifts will appear here so you can correct anything OCR gets wrong.</div>`;return;}
  list.innerHTML="";
  shifts.forEach((s,index)=>{
    const row=document.createElement("div");row.className="edit-row";
    row.innerHTML=`<div class="edit-index">${index+1}</div>
      <label>Date<input type="date" value="${s.date}" data-field="date"></label>
      <label>Start<input type="time" value="${s.start}" data-field="start"></label>
      <label>Hours<input type="number" min="1" max="24" step="0.5" value="${s.hours||8}" data-field="hours"></label>
      <button class="delete-shift" type="button">Delete</button>`;
    row.querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{
      const field=input.dataset.field;
      let value=input.value;
      if(field==="hours") value=clamp(Number(value),1,24);
      if(field==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      if(field==="start"&&!/^\d{2}:\d{2}$/.test(value)) return;
      s[field]=value;
      s.hours=clamp(Number(s.hours||8),1,24);
      shifts=dedupe(shifts).sort(sortShifts);save();render();
    }));
    row.querySelector(".delete-shift").addEventListener("click",()=>{shifts.splice(index,1);save();render();});
    list.appendChild(row);
  });
}

$("calendar").addEventListener("click",e=>{
  const btn=e.target.closest(".edit-shift");
  if(!btn)return;
  const key=btn.dataset.key;
  const target=shifts.find(s=>`${s.date}_${s.start}`===key);
  if(target){
    const row=[...$("shiftList").children].find((_,i)=>shifts[i]===target);
    row?.scrollIntoView({behavior:"smooth",block:"center"});
    row?.querySelector("input")?.focus();
  }
});

function exportICS(){
  if(!shifts.length){alert("Add some shifts first.");return;}
  const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TSB Roster//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:TSB Roster⭐️","X-WR-TIMEZONE:Australia/Brisbane"];
  shifts.forEach(s=>{
    const endDT=endDateTime(s.date,s.start,s.hours||8);
    const uid=`tsb-${s.date}-${s.start.replace(":","")}@tsbroster`;
    lines.push("BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${stamp}Z`,`DTSTART;TZID=Australia/Brisbane:${icsLocal(s.date,s.start)}`,`DTEND;TZID=Australia/Brisbane:${icsLocal(endDT.date,endDT.time)}`,`SUMMARY:TSB Roster⭐️`,`DESCRIPTION:${s.hours||8}-hour shift`,"END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="TSB-Roster.ics";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function icsLocal(date,time){return date.replaceAll("-","")+"T"+time.replace(":","")+"00";}

render();
