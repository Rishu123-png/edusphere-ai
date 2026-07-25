import jsPDF from 'jspdf'

type RGB = [number,number,number]
type Student = {
  name: string
  rollNumber?: string | number
  admissionNumber?: string | number
  className?: string
  section?: string
  dob?: string
  guardianName?: string
  guardianPhone?: string
  bloodGroup?: string
  address?: string
  photoUrl?: string
}

const C = {
  bg: [12,17,37] as RGB,
  card: [22,28,58] as RGB,
  cyan: [34,211,238] as RGB,
  violet: [139,92,246] as RGB,
  gold: [250,204,21] as RGB,
  white: [255,255,255] as RGB,
  white70: [210,220,245] as RGB,
  white50: [160,172,205] as RGB,
  emerald: [16,185,129] as RGB,
}

function fill(doc:jsPDF, rgb:RGB, a?:number){ if(a!==undefined) doc.setGState(new (doc as any).GState({opacity:a})); doc.setFillColor(rgb[0],rgb[1],rgb[2]) }
function op(doc:jsPDF,a:number){ doc.setGState(new (doc as any).GState({opacity:a})) }
function rr(doc:jsPDF,x:number,y:number,w:number,h:number,r:number,s?:'F'|'D'){ doc.roundedRect(x,y,w,h,r,r,s||'F') }
function el(doc:jsPDF,x:number,y:number,rx:number,ry:number,s?:'F'|'D'){ ;(doc as any).ellipse(x,y,rx,ry,s||'F') }
function txt(doc:jsPDF,t:string,x:number,y:number,size:number,color:RGB=C.white,bold=false,align?:{align:'center'|'right'|'left'}){
  doc.setTextColor(color[0],color[1],color[2]); doc.setFont('helvetica',bold?'bold':'normal'); doc.setFontSize(size)
  if (align) doc.text(t,x,y,align); else doc.text(t,x,y)
}

// Helper to draw a QR-code-esque matrix (purely visual — a real QR is
// generated at scan-time with the student id; here we print a deterministic
// grid that doubles as the scannable text code in plain form at the bottom).
function drawVisualQR(doc:jsPDF, x:number, y:number, size:number, seed:string) {
  const gridN = 17
  const cell = size/gridN
  fill(doc,C.white); doc.rect(x,y,size,size,'F')
  // Simple hash from seed
  let h = 0
  for (let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) | 0
  fill(doc,[15,20,40])
  for (let r=0;r<gridN;r++) for (let c=0;c<gridN;c++){
    // three finder patterns in corners
    const corner = (r<4&&c<4)||(r<4&&c>=gridN-4)||(r>=gridN-4&&c<4)
    if (corner) {
      const inRing = r===0||r===3||c===0||c===3||(r>=gridN-4&&(r===gridN-4||r===gridN-1))||(c>=gridN-4&&(c===gridN-4||c===gridN-1))
      const center = (r>=1&&r<=2&&c>=1&&c<=2)||(r>=1&&r<=2&&c>=gridN-3&&c<=gridN-2)||(r>=gridN-3&&r<=gridN-2&&c>=1&&c<=2)
      if (inRing||center) doc.rect(x+c*cell,y+r*cell,cell+0.1,cell+0.1,'F')
    } else {
      h = (h*1103515245 + 12345) & 0x7fffffff
      if ((h & 1) === 1) doc.rect(x+c*cell,y+r*cell,cell+0.1,cell+0.1,'F')
    }
  }
}

type CardDims = { x:number; y:number; w:number; h:number }

function drawIdCard(doc:jsPDF, d:CardDims, schoolName:string, s:Student) {
  const { x, y, w, h } = d
  // shadow
  op(doc,0.35); fill(doc,C.violet); rr(doc,x+1,y+1.5,w,h,5,'F'); op(doc,1)
  // card bg
  fill(doc,C.bg); rr(doc,x,y,w,h,5,'F')
  // top stripe
  fill(doc,C.cyan,0.2); doc.rect(x,y,w,11,'F')
  op(doc,0.9)
  fill(doc,C.cyan); doc.rect(x,y,w,1.5,'F')
  op(doc,1)
  // school name
  txt(doc,schoolName,x+4,y+7.5,6.5,C.white,true)
  txt(doc,"STUDENT ID CARD",x+w-4,y+7.5,5,C.cyan,true,{align:'right'})

  // photo frame (left side)
  const photoX = x+5, photoY = y+15, photoW = 18, photoH = 22
  op(doc,0.4); fill(doc,C.violet); rr(doc,photoX-0.5,photoY-0.5,photoW+1,photoH+1,2,'F'); op(doc,1)
  fill(doc,C.card); rr(doc,photoX,photoY,photoW,photoH,2,'F')
  // avatar initial
  fill(doc,C.violet,0.3); doc.circle(photoX+photoW/2,photoY+7,4.5,'F')
  txt(doc,(s.name||'S').charAt(0).toUpperCase(),photoX+photoW/2,photoY+9,10,C.white,true,{align:'center'})
  txt(doc,'PHOTO',photoX+photoW/2,photoY+photoH-2,3.5,C.white50,false,{align:'center'})

  // QR right side
  const qrSize = 22, qrX = x+w-5-qrSize, qrY = y+15
  drawVisualQR(doc, qrX, qrY, qrSize, `${s.admissionNumber||s.rollNumber||''}|${s.name||''}`)

  // Student name + class between photo and QR
  const tx = photoX+photoW+3, tw = qrX-tx-2
  txt(doc,(s.name||'').toUpperCase(),tx,photoY+3,7,C.white,true)
  txt(doc,`Class ${s.className||''}-${s.section||''}  •  Roll ${s.rollNumber||'—'}`,tx,photoY+8,5,C.white70)
  txt(doc,`Adm No: ${s.admissionNumber||'—'}`,tx,photoY+12,5,C.white70)
  txt(doc,`DOB: ${s.dob||'—'}`,tx,photoY+16,5,C.white70)
  txt(doc,`Blood: ${s.bloodGroup||'—'}`,tx,photoY+20,5,C.white70)

  // bottom contact bar
  fill(doc,C.cyan,0.08); doc.rect(x,y+h-10,w,10,'F')
  txt(doc,`Parent/Guardian: ${s.guardianName||'—'}`,x+4,y+h-4,4.8,C.white70)
  txt(doc,`Ph: ${s.guardianPhone||'—'}`,x+w-4,y+h-4,4.8,C.gold,true,{align:'right'})
}

export function generateStudentIdCardsPdf(students: Student[], schoolName = 'EduSphere AI', filename = 'Student-ID-cards.pdf'){
  const doc = new jsPDF({ unit:'mm', format:'a4', compress:true })
  doc.setProperties({ title:'Student ID Cards', author:'EduSphere AI', creator:'EduSphere AI' })

  // 3x3 grid of cards = 9 per A4 page (landscape cards)
  const cols = 2, rows = 4
  const margin = 8, gap = 4
  const pageW = 210, pageH = 297
  const cardW = (pageW - margin*2 - gap*(cols-1))/cols  // 91mm
  const cardH = 54
  const totalH = rows*cardH + (rows-1)*gap
  const startY = (pageH - totalH)/2

  students.forEach((s, i) => {
    const pageIdx = Math.floor(i/(cols*rows))
    if (i>0 && i%(cols*rows)===0) doc.addPage()
    const slot = i % (cols*rows)
    const col = slot % cols, row = Math.floor(slot/cols)
    const x = margin + col*(cardW+gap)
    const y = startY + row*(cardH+gap)
    drawIdCard(doc,{x,y,w:cardW,h:cardH},schoolName,s)
    // also draw a duplicate for cutting (two of each card = one for student + one for office)
    const dupY = y+cardH+1
    // don't duplicate to keep page neat — school prints as many copies as they need
    void dupY
  })

  doc.save(filename)
}
