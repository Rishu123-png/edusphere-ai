/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf'

// ===========================================================================
// EDUSPHERE AI  -  15-PAGE PREMIUM FEATURE BROCHURE
// Crafted by Rishu Jaswar. All diagrams drawn with vector primitives (no
// raster assets) so the PDF stays crisp and prints beautifully at any size.
// ===========================================================================

type RGB = [number,number,number]
const C = {
  bg:        [11,14,32]    as RGB,
  panel:     [22,28,56]    as RGB,
  panel2:    [30,37,70]    as RGB,
  panel3:    [38,46,84]    as RGB,
  indigo:    [99,102,241]  as RGB,
  violet:    [139,92,246]  as RGB,
  fuchsia:   [217,70,239]  as RGB,
  cyan:      [34,211,238]  as RGB,
  emerald:   [16,185,129]  as RGB,
  amber:     [245,158,11]  as RGB,
  rose:      [244,63,94]   as RGB,
  gold:      [250,204,21]   as RGB,
  white:     [255,255,255] as RGB,
  white90:   [240,244,255] as RGB,
  white70:   [215,223,245] as RGB,
  white50:   [165,176,210] as RGB,
  white20:   [255,255,255] as RGB,
}

const W = 210, H = 297

// ---------- low-level drawing helpers ----------
function fill(doc: jsPDF, rgb: RGB, a?: number) { if (a!==undefined) doc.setGState(new (doc as any).GState({opacity:a})); doc.setFillColor(rgb[0],rgb[1],rgb[2]) }
function stroke(doc: jsPDF, rgb: RGB, lw=0.3, a?: number) { if (a!==undefined) doc.setGState(new (doc as any).GState({'stroke-opacity':a})); doc.setDrawColor(rgb[0],rgb[1],rgb[2]); doc.setLineWidth(lw) }
function op(doc: jsPDF, a:number){ doc.setGState(new (doc as any).GState({opacity:a})) }
function rr(doc:jsPDF,x:number,y:number,w:number,h:number,r:number,s?:'F'|'D'|'FD'){ doc.roundedRect(x,y,w,h,r,r,s||'F') }
function el(doc:jsPDF,x:number,y:number,rx:number,ry:number,s?:'F'|'D'){ ;(doc as any).ellipse(x,y,rx,ry,s||'F') }
function rect(doc:jsPDF,x:number,y:number,w:number,h:number,s?:'F'|'D'){ doc.rect(x,y,w,h,s||'F') }
function line(doc:jsPDF,x1:number,y1:number,x2:number,y2:number){ doc.line(x1,y1,x2,y2) }
function txt(doc:jsPDF,t:string,x:number,y:number,size:number,color=C.white,bold=false,align?:{align:'center'|'right'|'left'}) {
  doc.setTextColor(color[0],color[1],color[2])
  doc.setFont('helvetica',bold?'bold':'normal')
  doc.setFontSize(size)
  if (align) doc.text(t,x,y,align); else doc.text(t,x,y)
}
function wrap(doc:jsPDF,t:string,x:number,y:number,maxW:number,size=9.5,lh=4.7,color=C.white70,bold=false):number {
  doc.setTextColor(color[0],color[1],color[2])
  doc.setFont('helvetica',bold?'bold':'normal')
  doc.setFontSize(size)
  const words = t.split(/\s+/)
  let ln = '', yy = y
  for (const w of words) {
    const test = ln?ln+' '+w:w
    if (doc.getTextWidth(test)>maxW && ln) { doc.text(ln,x,yy); yy+=lh; ln=w }
    else ln = test
  }
  if (ln) doc.text(ln,x,yy)
  return yy+lh
}
function bullet(doc:jsPDF,t:string,x:number,y:number,maxW:number,color=C.cyan,size=8.8,lh=4.6):number {
  fill(doc,color); doc.circle(x+1.5,y-1.2,1.0,'F')
  return wrap(doc,t,x+5,y,maxW-5,size,lh)
}
function pageBg(doc:jsPDF){
  fill(doc,C.bg); doc.rect(0,0,W,H,'F')
  op(doc,0.40); fill(doc,C.fuchsia); el(doc,175,25,60,30); fill(doc,C.cyan); el(doc,25,275,55,28); fill(doc,C.indigo); el(doc,105,148,75,45); op(doc,1)
  op(doc,0.035); doc.setDrawColor(255,255,255); doc.setLineWidth(0.1)
  for (let x=0;x<=W;x+=10) doc.line(x,0,x,H)
  for (let y=0;y<=H;y+=10) doc.line(0,y,W,y)
  op(doc,1)
}
function header(doc:jsPDF,n:string,eyebrow:string,title:string){
  op(doc,0.5); fill(doc,C.cyan); doc.rect(20,18,30,0.8,'F'); op(doc,1)
  txt(doc,eyebrow.toUpperCase(),20,26,8.5,C.cyan,true)
  txt(doc,title,20,39,20,C.white,true)
  txt(doc,`EduSphere AI  *  Feature Brochure  *  ${n}`,190,287,7.5,C.white50,false,{align:'right'})
  txt(doc,'Crafted by Rishu Jaswar',190,292,7,C.gold,true,{align:'right'})
}
function h2(doc:jsPDF,t:string,x:number,y:number,color=C.cyan){ txt(doc,t,x,y,12,color,true) }
function divider(doc:jsPDF,x:number,y:number,w:number){ op(doc,0.25); stroke(doc,C.cyan,0.4); line(doc,x,y,x+w,y); op(doc,1) }
function chip(doc:jsPDF,t:string,x:number,y:number,color:RGB=C.cyan){
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
  const tw = doc.getTextWidth(t)
  fill(doc,color,0.18); rr(doc,x,y-4,tw+7,5.5,2.7); stroke(doc,color,0.2,0.55); rr(doc,x,y-4,tw+7,5.5,2.7,'D')
  txt(doc,t,x+3.5,y-0.3,7.5,color,true)
  return x+tw+10
}
function card(doc:jsPDF,x:number,y:number,w:number,h:number,glow?:RGB){
  if (glow){ op(doc,0.15); fill(doc,glow); rr(doc,x,y,w,h,8); op(doc,1) }
  fill(doc,C.panel2,0.92); rr(doc,x+0.6,y+0.6,w-1.2,h-1.2,8)
}

// ---------- Reusable diagrams ----------
function phoneFrame(doc:jsPDF, x:number,y:number,w:number,h:number, accent=C.cyan) {
  // outer body
  fill(doc,[25,30,55]); rr(doc,x,y,w,h,7)
  op(doc,0.5); stroke(doc,accent,0.5); rr(doc,x,y,w,h,7,'D'); op(doc,1)
  // screen
  fill(doc,[5,8,22]); rr(doc,x+2.5,y+7,w-5,h-14,3)
  // notch
  fill(doc,[10,12,28]); doc.roundedRect(x+w/2-7,y+2,14,3,1.5,1.5,'F')
  // status bar dots
  fill(doc,C.white50); doc.circle(x+w-6,y+4,0.7,'F'); doc.circle(x+w-8.5,y+4,0.5,'F')
}
function mascotFace(doc:jsPDF,cx:number,cy:number,r:number){
  // aura
  op(doc,0.35); fill(doc,C.fuchsia); doc.circle(cx,cy,r+7,'F'); fill(doc,C.cyan,); doc.circle(cx,cy,r+4,'F'); op(doc,1)
  // rings
  op(doc,0.6); stroke(doc,C.white,0.3); doc.circle(cx,cy,r+3,'D'); stroke(doc,C.cyan,0.4); doc.circle(cx,cy,r+6,'D'); op(doc,1)
  // body
  fill(doc,C.indigo); doc.circle(cx,cy,r,'F')
  op(doc,0.6); fill(doc,C.cyan); doc.circle(cx-r*0.35,cy-r*0.35,r*0.35,'F'); op(doc,1)
  // ears
  fill(doc,C.gold); doc.roundedRect(cx-r-2,cy-3,3,6,1,1,'F'); doc.roundedRect(cx+r-1,cy-3,3,6,1,1,'F')
  // eyes
  fill(doc,C.white); doc.circle(cx-r*0.3,cy-1,r*0.22,'F'); doc.circle(cx+r*0.3,cy-1,r*0.22,'F')
  fill(doc,C.cyan); doc.circle(cx-r*0.3,cy-1,r*0.13,'F'); doc.circle(cx+r*0.3,cy-1,r*0.13,'F')
  fill(doc,[5,8,22]); doc.circle(cx-r*0.3,cy-1,r*0.07,'F'); doc.circle(cx+r*0.3,cy-1,r*0.07,'F')
  // smile
  stroke(doc,[10,12,28],0.8); doc.setLineWidth(0.8)
  const smileR = r*0.35
  ;(doc as any).path([{op:'m',c:[cx-smileR,cy+r*0.15]},{op:'c',c:[cx-smileR*0.5,cy+smileR,cx+smileR*0.5,cy+smileR,cx+smileR,cy+r*0.15]}]).stroke()
  // orbiting satellite
  fill(doc,C.cyan); doc.circle(cx+r+6,cy-3,1.2,'F')
}
function cameraViewfinder(doc:jsPDF,x:number,y:number,w:number,h:number){
  fill(doc,[5,8,22]); rr(doc,x,y,w,h,4)
  op(doc,0.3); stroke(doc,C.cyan,0.4); rr(doc,x,y,w,h,4,'D'); op(doc,1)
  // corner brackets
  const L=10
  stroke(doc,C.cyan,1.2)
  doc.setLineWidth(1.2); doc.setDrawColor(C.cyan[0],C.cyan[1],C.cyan[2])
  line(doc,x+4,y+4,x+4+L,y+4); line(doc,x+4,y+4,x+4,y+4+L)
  line(doc,x+w-4,y+4,x+w-4-L,y+4); line(doc,x+w-4,y+4,x+w-4,y+4+L)
  line(doc,x+4,y+h-4,x+4+L,y+h-4); line(doc,x+4,y+h-4,x+4,y+h-4-L)
  line(doc,x+w-4,y+h-4,x+w-4-L,y+h-4); line(doc,x+w-4,y+h-4,x+w-4,y+h-4-L)
  // face oval
  op(doc,0.4); stroke(doc,C.emerald,0.8); el(doc,x+w/2,y+h/2-2,w*0.22,h*0.32,'D'); op(doc,1)
  // scan line
  op(doc,0.6); fill(doc,C.emerald); doc.rect(x+6,y+h/2,w-12,0.4,'F'); op(doc,1)
}
function qrBlock(doc:jsPDF, x:number,y:number,size:number){
  fill(doc,C.white); rect(doc,x,y,size,size)
  // pseudo QR pattern
  fill(doc,[5,8,22])
  const cells = 15, cs = size/cells
  const seed = (i:number,j:number)=>((i*j+i*7+j*3)%5<2)||(i<3&&j<3)||(i<3&&j>cells-4)||(i>cells-4&&j<3)
  for (let i=0;i<cells;i++) for (let j=0;j<cells;j++) if (seed(i,j)) rect(doc,x+i*cs,y+j*cs,cs+0.1,cs+0.1)
}
function barChart(doc:jsPDF,x:number,y:number,w:number,h:number,bars:{label:string,value:number,color:RGB}[]){
  // axes area
  fill(doc,C.panel); rr(doc,x,y,w,h,4)
  op(doc,0.15); stroke(doc,C.white,0.2); line(doc,x+8,y+8,x+8,y+h-10); line(doc,x+8,y+h-10,x+w-6,y+h-10); op(doc,1)
  const bw = (w-20)/bars.length - 3
  const maxV = Math.max(...bars.map(b=>b.value))*1.15
  bars.forEach((b,i)=>{
    const bx = x+14+i*(bw+3), bh = ((h-24)*b.value/maxV), by = y+h-10-bh
    op(doc,0.85); fill(doc,b.color); rr(doc,bx,by,bw,bh,1.5); op(doc,1)
    txt(doc,String(b.value),bx+bw/2,by-2,7,b.color,true,{align:'center'})
    txt(doc,b.label,bx+bw/2,y+h-4,6.5,C.white70,false,{align:'center'})
  })
}
function whatsappBubble(doc:jsPDF,x:number,y:number,w:number,text:string){
  fill(doc,[18,48,32]); rr(doc,x,y,w,14,4)
  // jsPDF has no triangle() — the bubble "tail" is a small filled rect.
  fill(doc,[36,90,60]); doc.rect(x+8,y+14,4,4,'F')
  txt(doc,text,x+6,y+8,8,[220,245,230])
}
function sectionLabel(doc:jsPDF,text:string,x:number,y:number,color:RGB=C.cyan){
  fill(doc,color,0.15); rr(doc,x-3,y-4,doc.getTextWidth(text)+10,8,4)
  txt(doc,text,x+2,y+2,8,color,true)
}

// =========================================================================== PAGES

function p1_cover(doc:jsPDF){
  pageBg(doc)
  op(doc,0.55); fill(doc,C.cyan); el(doc,45,72,50,50); fill(doc,C.fuchsia); el(doc,170,222,55,55); fill(doc,C.violet); el(doc,105,150,85,50); op(doc,1)
  // glass card
  fill(doc,C.panel,0.72); rr(doc,20,45,170,210,14)
  op(doc,0.25); stroke(doc,C.white,0.3); rr(doc,20,45,170,210,14,'D'); op(doc,1)
  // mascot
  mascotFace(doc,105,115,22)
  txt(doc,'EDUSPHERE',105,160,32,C.white,true,{align:'center'})
  const w = doc.getTextWidth('EDUSPHERE')
  txt(doc,' AI',105+w/2-2,160,32,C.cyan,true)
  txt(doc,'Your school. Smarter every day.',105,173,12,C.white90,false,{align:'center'})
  op(doc,0.5); stroke(doc,C.cyan,0.4); line(doc,55,184,155,184); op(doc,1)
  txt(doc,'A complete AI-powered school management platform',105,196,11,C.white70,false,{align:'center'})
  const feats=['Smart Attendance','Intelligent Marks','AI Co-Teacher','WhatsApp for Parents','Face Recognition','Report Cards']
  feats.forEach((f,i)=>{
    const col=i%3,row=Math.floor(i/3)
    const fx=45+col*42, fy=210+row*12
    fill(doc,C.cyan); doc.circle(fx,fy-1.2,1.1,'F')
    txt(doc,f,fx+5,fy+1.2,8,C.white70)
  })
  txt(doc,'Crafted & designed by',105,242,8,C.white50,false,{align:'center'})
  txt(doc,'Rishu Jaswar',105,252,15,C.gold,true,{align:'center'})
  txt(doc,'Feature Brochure  |  v2.2',105,282,8,C.white50,false,{align:'center'})
}

function p2_welcome(doc:jsPDF){
  pageBg(doc); header(doc,'02','Welcome','The Vision')
  wrap(doc,'EduSphere AI is a modern school management platform designed and built by Rishu Jaswar to bring every part of a school - attendance, marks, reports, parents, students and teachers - into one beautiful, easy-to-use, mobile-first experience powered by artificial intelligence.',20,52,170,11.5,6)
  h2(doc,'Built for every person in your school',20,78)
  const roles=[
    {name:'Principal',color:C.violet,desc:'See the whole school at a glance, approve marks, view reports and push announcements to every classroom.',icon:'P'},
    {name:'Teachers',color:C.cyan,desc:'Mark attendance, enter marks, send WhatsApp to parents, and get AI teaching tips - all from a phone.',icon:'T'},
    {name:'Students',color:C.emerald,desc:'View personal marks and attendance, ask the AI tutor for help with topics, and see upcoming exams.',icon:'S'},
    {name:'Parents',color:C.amber,desc:'Get marks and absences on WhatsApp, open a dedicated parent portal, and follow their child\'s progress easily.',icon:'F'},
  ]
  roles.forEach((r,i)=>{
    const col=i%2,row=Math.floor(i/2),x=20+col*85,y=88+row*38,w=80,h=34
    card(doc,x,y,w,h,r.color)
    fill(doc,r.color,0.28); doc.circle(x+10,y+10,5,'F'); txt(doc,r.icon,x+10,y+13,10,r.color,true,{align:'center'})
    txt(doc,r.name,x+19,y+10.5,11,C.white,true); chip(doc,'Role',x+19,y+18,r.color)
    wrap(doc,r.desc,x+6,y+26,w-12,8.2,4)
  })
  // design philosophy card
  card(doc,20,170,170,70,C.violet)
  h2(doc,'Design philosophy',28,182,C.violet)
  const phil=[
    'Mobile-first - works beautifully on Android Chrome; installable like a native app.',
    'Deep-space glass theme - easy on the eyes during long staff hours and evening grading.',
    'AI that helps, never confuses - the mascot is friendly, context-aware and explains everything.',
    'Role-locked security - every user sees only what they are allowed to see.',
    'Works on weak internet - attendance queues offline and syncs automatically.',
    'Beautiful print-ready PDF report cards in one tap.',
  ]
  phil.forEach((t,i)=>{ const col=i%2,row=Math.floor(i/2); bullet(doc,t,28+col*82,192+row*11,78,col?C.fuchsia:C.cyan,8.8,5) })
}

function p3_dashboard(doc:jsPDF){
  pageBg(doc); header(doc,'03','Home Screen','Dashboard')
  wrap(doc,'After login, every user lands on a Dashboard designed for their role. Teachers see their classes and today\'s attendance pulse; principals see the whole school; students see their personal progress; parents see their child.',20,50,170,10,5.2)
  // phone diagram left
  phoneFrame(doc,22,65,62,150,C.cyan)
  // screen content
  fill(doc,[10,15,35]); rr(doc,26,75,54,12,3)
  txt(doc,'Good morning,',30,81,7,C.white50); txt(doc,'Mr. Sharma',30,88,9,C.white,true)
  // KPI tiles
  const kpi=[['87%','Attendance',C.emerald],['12','Present',C.cyan],['2','Absent',C.rose],['4','Classes',C.violet]]
  kpi.forEach((k,i)=>{
    const col=i%2,row=Math.floor(i/2)
    fill(doc,k[2] as RGB,0.18); rr(doc,28+col*26,92+row*17,24,14,2)
    txt(doc,k[0] as string,40+col*26,99+row*17,8,k[2] as RGB,true,{align:'center'})
    txt(doc,k[1] as string,40+col*26,105+row*17,5.5,C.white50,false,{align:'center'})
  })
  // mini chart
  fill(doc,C.panel); rr(doc,28,130,50,30,2)
  txt(doc,'Today',30,137,6,C.white50)
  const bars=[{v:70,c:C.emerald},{v:85,c:C.cyan},{v:60,c:C.amber},{v:92,c:C.emerald},{v:75,c:C.cyan},{v:50,c:C.rose}]
  bars.forEach((b,i)=>{fill(doc,b.c); rect(doc,30+i*7.5,155-b.v*0.2,5,b.v*0.2)})
  // ai tip
  fill(doc,C.fuchsia,0.2); rr(doc,28,165,50,24,3)
  txt(doc,'[AI] AI tip',31,172,6,C.fuchsia,true)
  txt(doc,'3 students below 75% - send WhatsApp?',31,179,6,C.white70)
  fill(doc,C.fuchsia); rr(doc,31,183,22,5,2); txt(doc,'Send now',42,186.5,5.5,C.white,true,{align:'center'})
  // home indicator
  fill(doc,C.white50,0.4); rr(doc,45,208,14,1.5,0.7)
  // right side explanation
  h2(doc,'What you see',92,70)
  const items=[
    {t:'Welcome banner',d:'Your name, school and a friendly greeting that changes during the day.',c:C.cyan},
    {t:'Live KPI tiles',d:'Attendance percentage, present count, absentees and number of classes today.',c:C.emerald},
    {t:'Today\'s schedule',d:'A chronological list of periods with subject, time, class and room.',c:C.violet},
    {t:'Attendance sparkline',d:'A miniature week-trend so you can spot patterns at a glance.',c:C.amber},
    {t:'AI whisper card',d:'The AI assistant proactively suggests actions (e.g. "nudge absentees").',c:C.fuchsia},
    {t:'Quick shortcuts',d:'One-tap buttons for Take Attendance, Enter Marks, Open AI, Reports.',c:C.cyan},
    {t:'Unread notifications',d:'A red dot on the bell shows items needing your attention.',c:C.rose},
  ]
  items.forEach((it,i)=>bullet(doc,it.t+' - '+it.d,92,82+i*16,88,it.c,8.6,7))
  // bottom strip
  fill(doc,C.panel2,0.8); rr(doc,20,230,170,30,8)
  txt(doc,'[i] Designed so a teacher can see everything they need within 5 seconds of opening the app.',26,243,9,C.white70,false)
  txt(doc,'Every tile reacts to your role. Principals see school-wide numbers; students see only their own.',26,252,8.2,C.white50,false)
}

function p4_students(doc:jsPDF){
  pageBg(doc); header(doc,'04','Student Records','Students Directory')
  wrap(doc,'The Students page is the complete digital register for every student in your school: photos, admission details, class, roll, guardians, medical notes and more.',20,50,170,10,5.2)
  // student card diagram
  card(doc,22,65,75,115,C.violet)
  // avatar
  fill(doc,C.violet); doc.circle(45,83,11,'F'); txt(doc,'A',45,87,14,C.white,true,{align:'center'})
  txt(doc,'Aarav Sharma',45,102,11,C.white,true,{align:'center'})
  txt(doc,'Roll 12  *  Class 10-A2',45,110,7.5,C.white50,false,{align:'center'})
  chip(doc,'Active',38,117,C.emerald)
  const info=[['Admission','DS-2041'],['Guardian','Mr. R. Sharma'],['Phone','+91 98****123'],['Blood','O+'],['House','Blue']]
  info.forEach(([k,v],i)=>{
    txt(doc,k,28,130+i*9,7,C.white50); txt(doc,v,55,130+i*9,8,C.white)
  })
  fill(doc,C.cyan,0.2); rr(doc,28,168,28,7,2); txt(doc,'QR',42,173,6,C.cyan,true,{align:'center'})
  fill(doc,C.emerald,0.2); rr(doc,58,168,32,7,2); txt(doc,'Marks',74,173,6,C.emerald,true,{align:'center'})
  // right side
  h2(doc,'Everything you need to know',105,68)
  const items=[
    {t:'Photo roster',d:'Each student shows a 40px gradient avatar or uploaded photo, with a crown badge for the class topper.',c:C.violet},
    {t:'Search & filters',d:'Find a student instantly by name, roll, admission number or class.',c:C.cyan},
    {t:'Add new student',d:'Clean form with class, section, roll, guardian details, emergency contact and medical info.',c:C.emerald},
    {t:'Student QR ID',d:'Every student gets a unique QR code that can be scanned for instant attendance.',c:C.amber},
    {t:'Face photo',d:'Upload or capture a photo on the spot; AI extracts a face descriptor for the AI camera.',c:C.fuchsia},
    {t:'Edit / Delete',d:'Update details or deactivate students who leave the school (TC tracking).',c:C.rose},
    {t:'Class colour bands',d:'Students are grouped by class-section and colour-coded for quick scanning.',c:C.cyan},
    {t:'CSV export',d:'Pull a class list for the office anytime.',c:C.violet},
  ]
  items.forEach((it,i)=>bullet(doc,it.t+' - '+it.d,105,78+i*12,85,it.c,8.4,5.3))
  // feature ribbon
  fill(doc,C.emerald,0.15); rr(doc,20,200,170,40,10)
  fill(doc,C.emerald); doc.circle(32,218,4,'F'); txt(doc,'[!]',32,220,8,C.white,true,{align:'center'})
  txt(doc,'Bulk face capture mode',42,214,10,C.emerald,true)
  wrap(doc,'Capture every student\'s photo in minutes using the phone camera. The AI auto-crops faces, stores them, and links them to attendance - perfect for onboarding a new class at the start of the year.',42,222,140,8.5,4.2)
  txt(doc,'Crafted by Rishu Jaswar',175,254,7.5,C.gold,true,{align:'right'})
}

function p5_teachers(doc:jsPDF){
  pageBg(doc); header(doc,'05','Staff Management','Teachers')
  wrap(doc,'The Teachers page lets principals add, invite and manage every staff member from one place, with full control over subjects and assigned classes.',20,50,170,10,5.2)
  // teacher invite card
  card(doc,22,65,80,80,C.fuchsia)
  txt(doc,'Invite a teacher',30,78,11,C.fuchsia,true)
  fill(doc,C.panel); rr(doc,30,85,64,8,2); txt(doc,'t@school.edu',34,90.5,7.5,C.white50)
  fill(doc,C.panel); rr(doc,30,96,64,8,2); txt(doc,'Rahul Verma',34,101.5,7.5,C.white50)
  // chips
  fill(doc,C.cyan,0.2); rr(doc,30,108,28,7,2); txt(doc,'Math',44,112.5,6,C.cyan,true,{align:'center'})
  fill(doc,C.violet,0.2); rr(doc,60,108,34,7,2); txt(doc,'10-A2,10-B1',77,112.5,6,C.violet,true,{align:'center'})
  fill(doc,C.emerald,0.2); rr(doc,30,118,64,7,2); txt(doc,'Class teacher: 10-A2',62,122.5,6,C.emerald,true,{align:'center'})
  fill(doc,C.fuchsia); rr(doc,42,130,40,8,3); txt(doc,'Send invite',62,135,7,C.white,true,{align:'center'})
  // right side
  h2(doc,'Teacher controls',110,68)
  const items=[
    {t:'Add teacher',d:'Fill name, email, phone and subjects; a password reset email is sent automatically.',c:C.cyan},
    {t:'Assign subjects',d:'Pick one or many subjects from the school\'s subject list.',c:C.violet},
    {t:'Assign classes',d:'Choose which class-sections this teacher can enter marks/attendance for.',c:C.fuchsia},
    {t:'Class-teacher flag',d:'Mark a teacher as class teacher of one section; they get extra oversight.',c:C.emerald},
    {t:'Online status',d:'A green dot shows which teachers are actively using the app right now.',c:C.emerald},
    {t:'Email invite link',d:'Generate a one-click invite that pre-fills school code; works with Gmail app.',c:C.amber},
    {t:'Remove / promote',d:'Revoke access or promote a teacher to school admin.',c:C.rose},
  ]
  items.forEach((it,i)=>bullet(doc,it.t+' - '+it.d,110,78+i*12,80,it.c,8.3,5.2))
  // security strip
  fill(doc,C.cyan,0.15); rr(doc,20,155,80,55,10)
  txt(doc,'[Lock] Role-locked by design',28,170,10,C.cyan,true)
  wrap(doc,'A teacher can only enter marks and attendance for the classes and subjects assigned to them. Even if they try to access another class, the app blocks it before sending anything to the server.',28,178,68,8.3,4.2)
  fill(doc,C.gold,0.15); rr(doc,105,155,85,55,10)
  txt(doc,'[*] Smart defaults',113,170,10,C.gold,true)
  wrap(doc,'First-time teachers get CBSE exam weightings pre-filled, a friendly onboarding coach, and the AI greets them on every screen with context-aware tips.',113,178,70,8.3,4.2)
  // lower row of feature cards
  const fcs=[
    {t:'Subjects',d:'Per-teacher subject list drives which subjects appear in Marks.',c:C.violet},
    {t:'Classes',d:'Assigned classes control attendance, marks, visibility everywhere.',c:C.cyan},
    {t:'Invite',d:'One-click email invite with school code for quick onboarding.',c:C.emerald},
  ]
  fcs.forEach((f,i)=>{
    const x=20+i*58,y=220; card(doc,x,y,54,32,f.c)
    txt(doc,f.t,x+27,y+12,10,f.c,true,{align:'center'})
    wrap(doc,f.d,x+5,y+20,44,7.5,3.5)
  })
}

function p6_attendance(doc:jsPDF){
  pageBg(doc); header(doc,'06','Smart Attendance','Marking Attendance')
  wrap(doc,'Attendance is the most-used screen in any school app, so EduSphere gives teachers three fast ways to mark it, plus live statistics, a heat-map and full history.',20,50,170,10,5.2)
  // three mode diagram
  const modes=[
    {label:'Manual',x:22,color:C.cyan,draw:(xx:number,yy:number)=>{
      phoneFrame(doc,xx,yy,42,80,C.cyan)
      fill(doc,[10,15,35]); rr(doc,xx+3,yy+10,36,8,2); txt(doc,'10-A2',xx+21,yy+15.5,7,C.white,true,{align:'center'})
      // rows
      for(let i=0;i<4;i++){
        fill(doc,C.panel2); rr(doc,xx+4,yy+20+i*12,34,10,2)
        fill(doc,C.violet); doc.circle(xx+9,yy+25+i*12,3,'F')
        fill(doc,i%3===2?C.rose:C.emerald,0.7); rr(doc,xx+29,yy+22+i*12,7,5,1.5)
      }
    }},
    {label:'QR Scan',x:70,color:C.amber,draw:(xx:number,yy:number)=>{
      phoneFrame(doc,xx,yy,42,80,C.amber)
      cameraViewfinder(doc,xx+4,yy+10,34,68)
      qrBlock(doc,xx+13,yy+30,16)
      fill(doc,C.amber,0.85); rr(doc,xx+6,yy+70,30,6,2); txt(doc,'Scanning...',xx+21,yy+74,6,C.white,true,{align:'center'})
    }},
    {label:'AI Face Camera',x:118,color:C.emerald,draw:(xx:number,yy:number)=>{
      phoneFrame(doc,xx,yy,42,80,C.emerald)
      cameraViewfinder(doc,xx+4,yy+10,34,68)
      // face dots
      fill(doc,C.emerald,0.8); doc.circle(xx+21,yy+35,5,'D')
      doc.setDrawColor(C.emerald[0],C.emerald[1],C.emerald[2]); doc.setLineWidth(0.6)
      const pts=[[18,30],[24,30],[17,36],[25,36],[21,40]]
      pts.forEach(p=>doc.circle(xx+p[0],yy+p[1],0.6,'F'))
      fill(doc,C.emerald,0.85); rr(doc,xx+6,yy+70,30,6,2); txt(doc,'OK Aarav S.',xx+21,yy+74,6,C.white,true,{align:'center'})
    }},
    {label:'Offline mode',x:166,color:C.violet,draw:(xx:number,yy:number)=>{
      phoneFrame(doc,xx,yy,42,80,C.violet)
      fill(doc,[10,15,35]); rr(doc,xx+3,yy+10,36,28,2)
      txt(doc,'Saved offline',xx+21,yy+20,7,C.amber,true,{align:'center'})
      txt(doc,'Will sync when internet returns.',xx+21,yy+28,5.8,C.white50,false,{align:'center'})
      fill(doc,C.violet,0.3); rr(doc,xx+8,yy+42,26,20,2)
      txt(doc,'12 marked',xx+21,yy+50,7,C.cyan,true,{align:'center'})
      txt(doc,'[R] Sync later',xx+21,yy+57,6,C.white50,false,{align:'center'})
    }},
  ]
modes.forEach(m=>{
    m.draw(m.x,65)
    txt(doc,m.label,m.x+21,150,9,m.color,true,{align:'center'})
  })
  // features under the phones
  h2(doc,'Every attendance feature you expect',20,165)
  const f=[
    'One-tap Present / Absent / Late / Half-day / Leave status',
    'Live percentage for each student while you mark',
    'Today\'s roster shows present count, absentees and pending in green/red/amber',
    'Heat-map calendar view that reveals attendance patterns per student',
    'Full history with day-by-day records and the ability to correct mistakes',
    'Sticky "Save" bar that never hides behind the bottom navigation',
    'Offline queue: attendance marked without internet auto-syncs the moment you are back online',
    'Haptic feedback on Android so you can feel each tap',
  ]
  f.forEach((t,i)=>{ const col=i%2,row=Math.floor(i/2); bullet(doc,t,20+col*85,176+row*11,80,col?C.fuchsia:C.cyan,8.6,4.8) })
  fill(doc,C.rose,0.15); rr(doc,20,240,170,22,8)
  txt(doc,'[!] Absentee parent alerts',28,249,9,C.rose,true)
  wrap(doc,'After saving attendance, send a polite pre-filled WhatsApp message to every absentee\'s guardian with one tap - no typing required.',28,255,160,8,3.5)
}

function p7_attendance_more(doc:jsPDF){
  pageBg(doc); header(doc,'07','Attendance Deep-dive','Heatmap * History * QR')
  // heatmap diagram
  h2(doc,'Attendance Heatmap',20,52)
  wrap(doc,'A colour-coded calendar shows every student\'s attendance history at a glance. Dark green means present, red means absent, amber late, grey not marked.',20,60,110,9,4.5)
  const hx=20,hy=80,cellW=5,cellH=5
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat']
  labels.forEach((l,i)=>txt(doc,l,hx,hy+i*(cellH+1.5)+4,6,C.white50))
  const days=20
  for(let d=0;d<days;d++){
    txt(doc,String(d+1),hx+30+d*(cellW+0.8),hy-2,5,C.white50,false,{align:'center'})
    for(let r=0;r<6;r++){
      const seed = ((d+1)*(r+3))%7
      const col = seed<4?C.emerald:seed<5?C.amber:seed<6?C.rose:C.panel3
      fill(doc,col); rr(doc,hx+30+d*(cellW+0.8),hy+r*(cellH+1.5),cellW,cellH,0.6)
    }
  }
  // legend
  const lg=[{c:C.emerald,l:'Present'},{c:C.amber,l:'Late'},{c:C.rose,l:'Absent'},{c:C.panel3,l:'-'}]
  lg.forEach((l,i)=>{fill(doc,l.c); rect(doc,hx+40+i*22,158,4,3); txt(doc,l.l,hx+46+i*22,162,6,C.white50)})
  // QR section right
  card(doc,120,52,70,80,C.amber)
  qrBlock(doc,130,60,50)
  txt(doc,'Student QR',155,117,9,C.amber,true,{align:'center'})
  wrap(doc,'Print the QR card or project it on the student\'s ID. Point the scanner and attendance is marked instantly.',128,123,55,7.5,3.8)
  // History
  card(doc,20,165,170,90,C.violet)
  h2(doc,'Attendance History',28,177,C.violet)
  const headers=['Date','Student','Class','Status','Method']
  headers.forEach((h,i)=>txt(doc,h,32+i*32,186,7,C.cyan,true))
  for(let r=0;r<5;r++){
    const col = r%2===0?C.emerald:C.rose
    const yy=192+r*10
    fill(doc,C.panel3,0.5); rr(doc,28,yy-3,155,8,1.5)
    txt(doc,`2${r} Jul`,32,yy+2,6.5,C.white70)
    txt(doc,['Aarav S.','Priya M.','Rohan K.','Isha T.','Kabir R.'][r],64,yy+2,6.5,C.white)
    txt(doc,'10-A2',96,yy+2,6.5,C.white70)
    fill(doc,col,0.8); rr(doc,124,yy-1.5,18,5,1.2); txt(doc,r%2===0?'Present':'Absent',133,yy+2,5.5,C.white,true,{align:'center'})
    txt(doc,['Manual','QR','AI Cam','Manual','QR'][r],160,yy+2,6.5,C.white70)
  }
fill(doc,C.amber,0.2); rr(doc,28,245,60,7,2); txt(doc,'[v] Export CSV',58,250,6,C.amber,true,{align:'center'})
  fill(doc,C.rose,0.2); rr(doc,92,245,45,7,2); txt(doc,'WhatsApp all',114.5,250,6,C.rose,true,{align:'center'})
  wrap(doc,'Every record shows the method used (Manual / QR / AI Camera) so principals can trust the data.',145,252,45,7,3)
}

function p8_marks(doc:jsPDF){
  pageBg(doc); header(doc,'08','Exams & Grading','Marks & Analytics')
  wrap(doc,'The Marks page is an intelligent grade book. Choose class, subject and exam type, enter marks in seconds, and watch live statistics update as you type.',20,50,170,10,5.2)
  // UI phone left
  phoneFrame(doc,22,65,65,130,C.amber)
  // class/subject
  fill(doc,C.amber,0.2); rr(doc,26,74,57,9,3); txt(doc,'10-A2  *  Math  *  Mid-term',55,80,6.5,C.amber,true,{align:'center'})
  // KPI row
  const k2=[['32/36','Entered',C.cyan],['68%','Avg',C.emerald],['92','High',C.violet],['4','At risk',C.rose]]
  k2.forEach((k,i)=>{const col=i%2,row=Math.floor(i/2); fill(doc,k[2] as RGB,0.18); rr(doc,27+col*28,85+row*14,26,12,2); txt(doc,k[0] as string,40+col*28,92+row*14,7,k[2] as RGB,true,{align:'center'})})
  // bar chart
  barChart(doc,26,115,57,35,[
    {label:'A+',value:4,color:C.emerald},{label:'A',value:7,color:C.cyan},{label:'B',value:11,color:C.violet},
    {label:'C',value:6,color:C.amber},{label:'D',value:3,color:C.rose},
  ])
  // student row
  for(let i=0;i<2;i++){
    fill(doc,C.panel2); rr(doc,27,153+i*12,55,10,2)
    fill(doc,C.violet); doc.circle(32,158+i*12,3.5,'F')
    txt(doc,['Aarav S.','Priya M.'][i],37,157+i*12,6.5,C.white)
    fill(doc,i===0?C.emerald:C.rose,0.7); rr(doc,58,155+i*12,10,5,1); txt(doc,i===0?'87':'29',63,158.5+i*12,5,C.white,true,{align:'center'})
    fill(doc,i===0?C.emerald:C.rose,0.2); rr(doc,69,155+i*12,11,5,1); txt(doc,i===0?'A2':'E1',74.5,158.5+i*12,4.5,i===0?C.emerald:C.rose,true,{align:'center'})
  }
  // save bar
  fill(doc,C.amber); rr(doc,30,180,49,8,2); txt(doc,'Publish to parents',55,185.5,7,C.white,true,{align:'center'})
  fill(doc,C.white50,0.4); rr(doc,45,192,16,1.5,0.7)
  // right side explanation
  h2(doc,'Smart grade book',95,68)
  const items=[
    {t:'Pick class, subject, exam',d:'Unit Test, Assignment, Project, Practical, Mid-Term, Final, Internal.',c:C.cyan},
    {t:'Max-marks field',d:'Editable out-of (default 80), with bounds validation (5-300).',c:C.amber},
    {t:'Live KPIs',d:'Entered count, class average, pass %, median, highest and lowest.',c:C.emerald},
    {t:'Grade distribution chart',d:'Recharts bar chart coloured by CBSE grade bands, updates as you type.',c:C.violet},
    {t:'Toppers & At-risk cards',d:'Top 5 performers with gold/silver/bronze medals; students below 41% listed with WhatsApp.',c:C.gold},
    {t:'Absent (AB) toggle',d:'One tap marks a student absent; excluded from averages, noted as AB in reports.',c:C.rose},
    {t:'Grace marks & bulk-absent',d:'Add grace points across the class; mark remaining unmarked students absent in one tap.',c:C.amber},
    {t:'Weighted CGPA',d:'CBSE weightings (UT 10%, Mid 30%, Final 40%...) combine into a live weighted percent.',c:C.cyan},
    {t:'AI final prediction',d:'Linear regression on past marks + attendance predicts the final exam score with a confidence bar.',c:C.fuchsia},
    {t:'Publish workflow',d:'Save draft -> Submit to admin -> Publish to parents, each step sends a notification.',c:C.emerald},
  ]
  items.forEach((it,i)=>bullet(doc,it.t+' - '+it.d,95,78+i*12,95,it.c,8.4,5))
}

function p9_marks_entry(doc:jsPDF){
  pageBg(doc); header(doc,'09','Deep Grade Book','Entry * History * AI Insights')
  // left: AI insight card + remark chips
  card(doc,22,52,80,115,C.fuchsia)
  txt(doc,'[AI] AI Class Insight',30,65,11,C.fuchsia,true)
  const lines=['* Class avg 68% - steady this week.','* Weak band: B2/C1 (35% of class).','* Review algebra fundamentals.','* Toppers: Priya, Aarav, Isha.','* 4 at-risk students - nudge parents.','* Add 10 MCQ revision in next class.']
  lines.forEach((l,i)=>wrap(doc,l,30,76+i*11,68,8.2,4,C.white70))
  // remark chips
  txt(doc,'Remark presets',30,148,8,C.cyan,true)
  const chips=['Excellent','Good','Needs Practice','Outstanding','Careless']
  chips.forEach((c,i)=>{
    const col=i%3,row=Math.floor(i/3)
    fill(doc,C.cyan,0.15); rr(doc,30+col*24,152+row*9,22,6,2); txt(doc,c,41+col*24,156+row*9,5.5,C.cyan,true,{align:'center'})
  })
  // history table diagram
  card(doc,108,52,82,115,C.cyan)
  txt(doc,'Marks History',116,65,11,C.cyan,true)
  const cols=['Date','Name','Sub','Marks','Gr']
  cols.forEach((c,i)=>txt(doc,c,[112,128,150,162,180][i],74,6.5,C.white50,true))
  for(let i=0;i<6;i++){
    const yy=80+i*10, grd=['A+','A1','B1','C2','A2','AB'][i], gc=[C.emerald,C.emerald,C.violet,C.amber,C.cyan,C.rose][i]
    fill(doc,C.panel3,0.5); rr(doc,112,yy-3,75,8,1.5)
    txt(doc,`2${i} Jul`,115,yy+2,5.8,C.white70)
    txt(doc,['Aarav','Priya','Rohan','Isha','Kabir','Meera'][i],131,yy+2,5.8,C.white)
    txt(doc,'Math',153,yy+2,5.8,C.cyan)
    txt(doc,['92/100','85/100','67/80','44/80','88/100','AB'][i],165,yy+2,5.8,C.white)
    fill(doc,gc,0.8); rr(doc,180,yy-1.5,6,5,1); txt(doc,grd,183,yy+2,4.5,C.white,true,{align:'center'})
  }
  fill(doc,C.cyan,0.2); rr(doc,115,150,28,7,2); txt(doc,'[E] Edit',129,155,6,C.cyan,true,{align:'center'})
  fill(doc,C.rose,0.2); rr(doc,145,150,28,7,2); txt(doc,'[X] Delete',159,155,6,C.rose,true,{align:'center'})
  fill(doc,C.emerald,0.2); rr(doc,165,145,22,12,2); txt(doc,'[v] CSV',176,153,6,C.emerald,true,{align:'center'})
  // bottom row
  fill(doc,C.emerald,0.15); rr(doc,22,175,80,45,10)
  txt(doc,'[Top] Top Performers',30,187,10,C.gold,true)
  const medalColors:RGB[]=[C.gold,[200,205,220],C.amber]
  for(let i=0;i<3;i++){
    fill(doc,medalColors[i] as RGB); doc.circle(38+i*20,203,5,'F')
    txt(doc,['1','2','3'][i],38+i*20,205,7,[30,30,50] as RGB,true,{align:'center'})
    txt(doc,['Priya','Aarav','Isha'][i],38+i*20,213,6,C.white,true,{align:'center'})
  }
  fill(doc,C.rose,0.15); rr(doc,108,175,82,45,10)
  txt(doc,'[!] At-risk students',116,187,10,C.rose,true)
  wrap(doc,'Four students are below the passing threshold. Tap the WhatsApp icon beside any name to instantly open a pre-written message to their guardian. The AI can even draft a personalised message.',116,197,70,8,4)
}

function p10_pdf_whatsapp(doc:jsPDF){
  pageBg(doc); header(doc,'10','Sharing Results','Report Cards & WhatsApp')
  wrap(doc,'Once marks are entered, EduSphere can print a full report card or send a WhatsApp to parents in one tap - no separate software needed.',20,50,170,10,5.2)
  // PDF doc diagram
  card(doc,22,63,85,150,C.violet)
  // PDF sheet
  fill(doc,C.white); rr(doc,28,68,73,140,2)
  fill(doc,C.indigo); rect(doc,28,68,73,13,'F')
  txt(doc,'REPORT CARD',64.5,76,10,C.white,true,{align:'center'})
  txt(doc,'Delhi Public School',64.5,82,6,C.white,false,{align:'center'})
  txt(doc,'Mid-term Examination 2025',64.5,87,6,C.white,false,{align:'center'})
  // student info
  fill(doc,[40,45,70]); txt(doc,'Student:',32,96,6,[20,25,50],true); txt(doc,'Aarav Sharma',50,96,6,[20,25,50])
  fill(doc,[40,45,70]); txt(doc,'Roll:',32,102,6,[20,25,50],true); txt(doc,'12',42,102,6,[20,25,50])
  fill(doc,[40,45,70]); txt(doc,'Class:',32,108,6,[20,25,50],true); txt(doc,'10-A2',45,108,6,[20,25,50])
  // marks table
  fill(doc,[230,235,250]); rect(doc,32,113,65,42,'F')
  const th=['Subject','Max','Marks','Gr']
  th.forEach((h,i)=>txt(doc,h,[33,56,66,78][i],117,5.5,[20,25,50],true))
  const rows=[['English',80,72,'A1'],['Math',80,85,'A+'],['Science',80,67,'B1'],['Hindi',80,78,'A2'],['SST',80,71,'A2']]
  rows.forEach((r,i)=>{
    const yy=122+i*6
    stroke(doc,[180,185,210],0.15); line(doc,32,yy-2,97,yy-2)
    txt(doc,r[0] as string,33,yy,5.3,[20,25,50]); txt(doc,String(r[1]),56,yy,5.3,[20,25,50],false,{align:'center'}); txt(doc,String(r[2]),66,yy,5.3,[20,25,50],false,{align:'center'})
    txt(doc,r[3] as string,78,yy,5.3,C.cyan,true,{align:'center'})
  })
  // totals
  fill(doc,[220,225,245]); rect(doc,32,155,65,7,'F')
  txt(doc,'TOTAL:  400 / 373  (93.2%)   Grade A+   GPA 10',64.5,160,6,[20,25,50],true,{align:'center'})
  // signatures
  line(doc,33,190,55,190); line(doc,60,190,80,190); line(doc,75,183,97,183)
  txt(doc,'Class Teacher',44,195,5,[80,85,110],false,{align:'center'})
  txt(doc,'Principal',70,195,5,[80,85,110],false,{align:'center'})
  txt(doc,'Parent',86,188,5,[80,85,110],false,{align:'center'})
  txt(doc,'Generated by EduSphere AI',64.5,204,5.5,C.violet,true,{align:'center'})
  // right: WhatsApp
  card(doc,113,63,77,150,C.emerald)
  txt(doc,'WhatsApp to Parents',121,76,11,C.emerald,true)
  wrap(doc,'Every parent receives a properly formatted, teacher-friendly message with marks, grade and optional remarks.',119,86,65,8.5,4.2)
  whatsappBubble(doc,120,100,65,'Dear Parent,')
  whatsappBubble(doc,120,118,65,'Aarav scored 87/100 (A2) in Math Mid-term. Great work!')
  whatsappBubble(doc,120,140,65,'Teacher remark: Excellent performance.')
  whatsappBubble(doc,120,162,65,'- EduSphere AI')
  // bulk whatsapp card
  fill(doc,C.emerald,0.15); rr(doc,118,182,65,28,6)
  txt(doc,'[>] Bulk to at-risk parents',124,193,8.5,C.emerald,true)
  wrap(doc,'Opens a pre-written message to every at-risk student\'s guardian - rate-limited for mobile browsers.',124,200,55,7.2,3.5)
  // lower explanations
  fill(doc,C.amber,0.15); rr(doc,22,220,85,42,10)
  txt(doc,'[i] What\'s in the PDF?',30,232,10,C.amber,true)
  wrap(doc,'School header, student info, subject table, totals, grading scale, teacher remarks and three signature lines (Class Teacher / Principal / Parent).',30,240,72,8,4)
  fill(doc,C.cyan,0.15); rr(doc,113,220,77,42,10)
  txt(doc,'[>] Deep-link safety',121,232,10,C.cyan,true)
  wrap(doc,'Links open with noopener/noreferrer; phone numbers are validated (at least 7 digits) before opening WhatsApp.',121,240,65,8,4)
}

function p11_ai(doc:jsPDF){
  pageBg(doc); header(doc,'11','AI Co-teacher','The Mascot & AI Features')
  wrap(doc,'The heart of EduSphere AI is a friendly floating mascot that follows you across the app. It understands which screen you are on and offers help, answers and even a little joke to brighten the day.',20,50,170,10,5.2)
  // big mascot diagram
  mascotFace(doc,70,120,32)
  // label lines
  const labels=[
    {t:'Breathing aura glow',x:25,y:90,c:C.fuchsia},
    {t:'Counter-rotating rings',x:20,y:105,c:C.cyan},
    {t:'Orbiting satellite dot',x:15,y:120,c:C.cyan},
    {t:'Gold ear panels',x:15,y:135,c:C.gold},
    {t:'Lens-flare sparkles',x:18,y:150,c:C.gold},
    {t:'Tracking eyes (follow pointer)',x:108,y:100,c:C.cyan},
    {t:'Expressive brows (emotions)',x:112,y:115,c:C.gold},
    {t:'Pink cheek blush',x:115,y:130,c:C.rose},
    {t:'Mouth that animates when speaking',x:110,y:145,c:C.violet},
    {t:'Online status dot',x:105,y:165,c:C.emerald},
  ]
  labels.forEach(l=>{
    stroke(doc,l.c,0.4);
    const tx=l.x<70?l.x+40:l.x, ty=l.y, ex=l.x<70?38:92, ey=120 + (labels.indexOf(l)-4.5)*5
    line(doc,tx,ty,ex,ey)
    fill(doc,l.c); doc.circle(tx,ty,1.2,'F')
    txt(doc,l.t,l.x<70?l.x:l.x,l.y+3,7,l.c,true)
  })
  // capabilities grid below
  h2(doc,'Eight things the AI can do for you',20,180)
  const caps=[
    {t:'Chat',d:'Ask anything - "summarize today\'s attendance" or "draft a PTM notice".',c:C.cyan},
    {t:'Voice',d:'Tap the mic, speak your question, hear the answer out loud.',c:C.emerald},
    {t:'Discover',d:'Quick cards for live snapshot, tutor mode, and smart suggestions.',c:C.violet},
    {t:'AI Tutor',d:'Explains any school topic in simple language for students.',c:C.fuchsia},
    {t:'Class Insight',d:'5-bullet AI summary after entering marks: weak areas, toppers, advice.',c:C.amber},
    {t:'Predictions',d:'Forecasts final-exam scores using past marks + attendance.',c:C.rose},
    {t:'Whispers',d:'Proactive tips in a floating bubble as you move between pages.',c:C.cyan},
    {t:'Jokes',d:'School-friendly jokes on demand to lighten long grading days.',c:C.gold},
  ]
  caps.forEach((c,i)=>{
    const col=i%4,row=Math.floor(i/4), x=20+col*43,y=190+row*32
    card(doc,x,y,40,28,c.c)
    fill(doc,c.c,0.3); doc.circle(x+10,y+10,4,'F')
    txt(doc,c.t,x+18,y+11,9,C.white,true)
    wrap(doc,c.d,x+6,y+20,30,7,3.2)
  })
  txt(doc,'Designed by Rishu Jaswar to feel warm, never robotic.',105,262,8,C.gold,true,{align:'center'})
}

function p12_parent_student(doc:jsPDF){
  pageBg(doc); header(doc,'12','Family & Students','Parent Portal & Student View')
  wrap(doc,'EduSphere isn\'t only for teachers - parents and students have their own tailored portals that show exactly what matters to them, with no access to other children\'s data.',20,50,170,10,5.2)
  // Parent portal phone
  phoneFrame(doc,22,65,62,135,C.amber)
  fill(doc,C.amber,0.3); rr(doc,26,74,54,20,3)
  fill(doc,C.violet); doc.circle(35,84,7,'F'); txt(doc,'K',35,87,10,C.white,true,{align:'center'})
  txt(doc,'Kabir Mehra',46,83,8,C.white,true); txt(doc,'Class 8-B',46,89,6,C.white50)
  // stats
  const sk=[['84%','Att.',C.emerald],['A2','Grade',C.cyan],['2','Abs.',C.rose],['5','Notice',C.violet]]
  sk.forEach((k,i)=>{const col=i%2,row=Math.floor(i/2); fill(doc,k[2] as RGB,0.18); rr(doc,28+col*25,96+row*14,23,12,2); txt(doc,k[0] as string,39.5+col*25,103+row*14,7,k[2] as RGB,true,{align:'center'})})
  // recent marks
  fill(doc,C.panel2); rr(doc,28,126,50,30,2)
  txt(doc,'Recent marks',32,133,6,C.cyan,true)
  for(let i=0;i<2;i++){
    fill(doc,C.panel3,0.5); rr(doc,30,137+i*9,46,7,1.5)
    txt(doc,['English','Math'][i],33,142+i*9,5.5,C.white70)
    fill(doc,[C.emerald,C.cyan][i],0.8); rr(doc,58,139+i*9,15,5,1); txt(doc,['78/80','92/100'][i],65.5,142.5+i*9,5,C.white,true,{align:'center'})
  }
  // upcoming
  fill(doc,C.fuchsia,0.2); rr(doc,28,160,50,15,2)
  txt(doc,'PTM - Sat 2 Aug',32,168,6,C.fuchsia,true); txt(doc,'10:00 AM',32,174,6,C.white70)
  fill(doc,C.white50,0.4); rr(doc,45,192,16,1.5,0.7)
  // student portal phone
  phoneFrame(doc,108,65,62,135,C.emerald)
  fill(doc,C.emerald,0.3); rr(doc,112,74,54,15,3)
  txt(doc,'Hello, Isha!',139,81,8,C.white,true,{align:'center'})
  txt(doc,'Your predicted final: 86%  [*]',139,88,6,C.gold,false,{align:'center'})
  // strength bars
  txt(doc,'Subject strengths',115,98,6,C.cyan,true)
  const subj=['Math','Sci','Eng','Hin','SST']
  const vals=[86,72,91,68,78]
  subj.forEach((s,i)=>{
    txt(doc,s,114,107+i*10,5.5,C.white70)
    fill(doc,C.panel3); rr(doc,128,104+i*10,32,3,1.5)
    fill(doc,vals[i]>=75?C.emerald:vals[i]>=60?C.amber:C.rose); rr(doc,128,104+i*10,vals[i]*0.32,3,1.5)
    txt(doc,vals[i]+'%',162,107+i*10,5,C.white)
  })
  // ai tutor
  fill(doc,C.fuchsia,0.2); rr(doc,112,160,54,25,3)
  txt(doc,'[AI] Ask AI Tutor',139,168,7,C.fuchsia,true,{align:'center'})
  wrap(doc,'"Explain photosynthesis in simple words"',118,175,42,5.5,4.5,C.white70,false)
  fill(doc,C.fuchsia); rr(doc,122,179,30,5,1.5); txt(doc,'Ask',137,183,5.5,C.white,true,{align:'center'})
  fill(doc,C.white50,0.4); rr(doc,131,192,16,1.5,0.7)
  // notes
  fill(doc,C.violet,0.15); rr(doc,20,207,75,55,10)
  txt(doc,'[*] For Parents',28,219,10,C.amber,true)
  wrap(doc,'* One portal per child, switchable if you have multiple kids.\n* Marks, attendance and events visible instantly.\n* WhatsApp alerts land on your phone directly.\n* No access to other children\'s records.',28,228,65,8,4)
  fill(doc,C.emerald,0.15); rr(doc,105,207,85,55,10)
  txt(doc,'* For Students',113,219,10,C.emerald,true)
  wrap(doc,'* Personal dashboard showing their own marks and attendance.\n* Subject strength bars & AI-predicted final scores.\n* AI Tutor explains topics like a friendly senior.\n* Notifications for homework, exams and events.',113,228,72,8,4)
}
function p13_calendar(doc:jsPDF){
  pageBg(doc); header(doc,'13','Timetable & Events','Calendar * Notifications * Schedule')
  wrap(doc,'EduSphere keeps the whole school on the same page with a shared calendar, a day-wise timetable, automatic event colour-coding, and instant notifications.',20,50,170,10,5.2)
  // calendar diagram
  h2(doc,'School Calendar',20,64)
  fill(doc,C.panel2); rr(doc,22,72,100,80,6)
  const days=['M','T','W','T','F','S','S']
  txt(doc,'July 2025',72,80,10,C.white,true,{align:'center'})
  days.forEach((d,i)=>txt(doc,d,30+i*13,89,6,C.cyan,true,{align:'center'}))
  const events:Record<number,{c:RGB,l:string}>={1:{c:C.rose,l:'Exam'},5:{c:C.amber,l:'PTM'},12:{c:C.emerald,l:'Trip'},15:{c:C.violet,l:'Holi'},20:{c:C.cyan,l:'Sports'},25:{c:C.rose,l:'UT'}}
  for(let w=0;w<5;w++) for(let d=0;d<7;d++){
    const n=w*7+d+1; if(n>31) continue
    const x=26+d*13, y=93+w*12
    fill(doc,C.panel3,0.5); rr(doc,x,y,11,10,1.5)
    txt(doc,String(n),x+2,y+4,6,C.white70)
    if(events[n]){ fill(doc,events[n].c,0.8); rr(doc,x,y+7,11,3,0.8); txt(doc,events[n].l[0],x+5.5,y+9,3.5,C.white,true,{align:'center'}) }
  }
  // legend
  const lg=[{c:C.rose,l:'Exam'},{c:C.amber,l:'PTM'},{c:C.emerald,l:'Event'},{c:C.violet,l:'Holiday'},{c:C.cyan,l:'Activity'}]
  lg.forEach((l,i)=>{fill(doc,l.c); rect(doc,28+i*18,153,4,3); txt(doc,l.l,34+i*18,156.5,5.5,C.white50)})
  // Notifications
  card(doc,128,64,62,88,C.cyan)
  txt(doc,'[!] Notifications',134,76,9,C.cyan,true)
  const notifs=[
    {t:'Marks published: 10-A2 Math',c:C.emerald},
    {t:'3 absent today - see list',c:C.rose},
    {t:'New event: Sports Day 20 Jul',c:C.cyan},
    {t:'AI: Priya trending up [*]',c:C.gold},
    {t:'Parent message sent',c:C.violet},
  ]
  notifs.forEach((n,i)=>{
    fill(doc,n.c,0.2); rr(doc,132,83+i*13,55,10,2)
    fill(doc,n.c); doc.circle(138,88+i*13,2,'F')
    wrap(doc,n.t,143,86+i*13,40,6.5,3)
  })
  // Timetable diagram
  card(doc,22,158,168,95,C.violet)
  txt(doc,'[Cal] Today\'s Timetable',30,170,10,C.violet,true)
  const periods=[
    ['1','08:00','Math','R. Verma','10-A2',C.cyan],
    ['2','08:45','English','S. Kaur','10-A2',C.emerald],
    ['3','09:30','Science','A. Khan','Lab-2',C.fuchsia],
    ['4','10:15','Break','-','Canteen',C.amber],
    ['5','11:00','Hindi','M. Das','10-A2',C.violet],
    ['6','11:45','SST','P. Roy','10-A2',C.cyan],
    ['7','12:30','PE','Coach','Ground',C.emerald],
  ]
  periods.forEach((p,i)=>{
    const y=178+i*10, col=p[5] as RGB
    fill(doc,col,0.15); rr(doc,28,y-3,12,7,1.5); txt(doc,p[0] as string,34,y+2,6,col,true,{align:'center'})
    txt(doc,p[1] as string,43,y+2,6,C.white50)
    txt(doc,p[2] as string,62,y+2,7,C.white,true)
    txt(doc,p[3] as string,95,y+2,6,C.white70)
    txt(doc,p[4] as string,142,y+2,6,C.white50)
    fill(doc,col,0.4); rr(doc,165,y-2,20,5,1); txt(doc,'Start',175,y+1.5,5,C.white,true,{align:'center'})
  })
}

function p14_mobile(doc:jsPDF){
  pageBg(doc); header(doc,'14','Mobile-first','Installable App * Security')
  wrap(doc,'EduSphere is a Progressive Web App (PWA). Parents and teachers can "Install" it from Chrome on Android in one tap - it appears on the home screen like a regular app, works offline and sends push notifications.',20,50,170,10,5.2)
  // Install flow diagram (three phones)
  phoneFrame(doc,22,65,45,100,C.cyan)
  fill(doc,C.panel); rr(doc,26,80,37,18,3); txt(doc,'Add EduSphere to Home screen',44.5,88,6,C.cyan,true,{align:'center'}); wrap(doc,'Tap the menu then "Install app"',30,96,30,6,3)
  fill(doc,C.cyan); rr(doc,31,130,27,7,2); txt(doc,'Install',44.5,135,6,C.white,true,{align:'center'})
  txt(doc,'Step 1',44.5,155,7,C.cyan,true,{align:'center'})
  stroke(doc,C.cyan,0.4); line(doc,67,115,85,115); fill(doc,C.cyan); doc.circle(85,115,1.5,'F')

  phoneFrame(doc,82,65,45,100,C.violet)
  fill(doc,C.panel); rr(doc,86,95,37,18,3)
  txt(doc,'Installing...',104.5,106,7,C.violet,true,{align:'center'})
  fill(doc,C.violet,0.2); rr(doc,90,115,28,4,2); fill(doc,C.violet); rr(doc,90,115,18,4,2)
  txt(doc,'Step 2',104.5,155,7,C.violet,true,{align:'center'})
  stroke(doc,C.violet,0.4); line(doc,127,115,145,115); fill(doc,C.violet); doc.circle(145,115,1.5,'F')

  phoneFrame(doc,142,65,45,100,C.emerald)
  fill(doc,C.emerald,0.3); rr(doc,146,78,37,20,3)
  fill(doc,C.indigo); doc.circle(164.5,88,6,'F'); txt(doc,'E',164.5,91,8,C.white,true,{align:'center'})
  txt(doc,'EduSphere',164.5,100,8,C.white,true,{align:'center'})
  fill(doc,C.emerald,0.2); rr(doc,150,130,30,22,2)
  txt(doc,'On home screen',165,140,6,C.emerald,true,{align:'center'})
  txt(doc,'Step 3',164.5,155,7,C.emerald,true,{align:'center'})

  // Security
  h2(doc,'Security by design',20,175)
  const sec=[
    {t:'Email verification',d:'Every account must verify its email before using the app.',c:C.cyan},
    {t:'5 roles locked server-side',d:'Super Admin / School Admin / Teacher / Student / Parent - permissions checked on every write.',c:C.violet},
    {t:'Firebase Realtime Database rules',d:'Marks require correct schoolId/studentId, numeric bounds and valid status before acceptance.',c:C.fuchsia},
    {t:'Teacher class-scope',d:'Teachers can only enter marks/attendance for classes assigned to them.',c:C.amber},
    {t:'Student/parent privacy',d:'Students and parents see only their own (or their child\'s) record - never classmates.',c:C.emerald},
    {t:'Offline-safe',d:'Queued writes are de-duplicated and idempotent; no duplicate records on bad networks.',c:C.rose},
    {t:'Audit trail',d:'Every mark stores who entered it, when, and its publish status (draft / submitted / published).',c:C.gold},
    {t:'Selfies & photos',d:'Uploaded photos are auto-resized client-side to keep storage fast and cheap.',c:C.cyan},
  ]
  sec.forEach((s,i)=>{const col=i%2,row=Math.floor(i/2); bullet(doc,s.t+' - '+s.d,20+col*85,185+row*11,80,s.c,8.4,4.8)})
  fill(doc,C.gold,0.15); rr(doc,20,240,170,28,8)
  txt(doc,'[Lock] Designed to respect student privacy',28,250,9,C.gold,true)
  wrap(doc,'Face embeddings never leave the school\'s Firebase project; parents are in control of their child\'s WhatsApp communication; and all data is scoped to the school.',28,257,160,8,4)
}

function p15_closing(doc:jsPDF){
  pageBg(doc)
  op(doc,0.6); fill(doc,C.violet); el(doc,105,130,100,65); op(doc,0.4); fill(doc,C.cyan); el(doc,105,130,75,40); op(doc,1)
  fill(doc,C.panel,0.8); rr(doc,20,45,170,210,14)
  mascotFace(doc,105,95,18)
  txt(doc,'Thank you',105,130,26,C.white,true,{align:'center'})
  txt(doc,'for considering EduSphere AI',105,143,12,C.cyan,true,{align:'center'})
  divider(doc,55,152,100)
  wrap(doc,'EduSphere AI is more than an app - it is a small, thoughtful assistant that walks into school with every teacher, student and parent every morning. It handles attendance in seconds, marks with intelligence, reports with beauty, and always with a warm smile.',28,165,155,10.5,6)
  const promises=[
    'Every screen designed for thumbs first',
    'Every chart coloured for quick reading',
    'Every message to parents written with respect',
    'Every error handled gracefully',
    'Every student\'s face remembered by name',
  ]
  promises.forEach((p,i)=>{ fill(doc,C.emerald); doc.circle(38,195+i*8,1.3,'F'); txt(doc,p,45,198+i*8,9,C.white70)})
  txt(doc,'Crafted & coded by',105,245,8,C.white50,false,{align:'center'})
  txt(doc,'Rishu Jaswar',105,256,18,C.gold,true,{align:'center'})
  txt(doc,'EduSphere AI  *  Your school. Smarter every day.',105,275,9,C.cyan,true,{align:'center'})
}
// ========================== ENTRY ==========================
export function generateFeatureBrochure(filename='EduSphere-AI-Features.pdf'){
  const doc = new jsPDF({unit:'mm',format:'a4',compress:true})
  doc.setProperties({
    title:'EduSphere AI - Complete Feature Brochure',
    author:'Rishu Jaswar',
    creator:'EduSphere AI',
    subject:'15-page feature overview for school principals',
  })
  const pages=[p1_cover,p2_welcome,p3_dashboard,p4_students,p5_teachers,p6_attendance,p7_attendance_more,p8_marks,p9_marks_entry,p10_pdf_whatsapp,p11_ai,p12_parent_student,p13_calendar,p14_mobile,p15_closing]
  pages.forEach((fn,i)=>{ if(i>0) doc.addPage(); fn(doc) })
  doc.save(filename)
}