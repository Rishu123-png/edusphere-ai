import jsPDF from 'jspdf'

// ---------- Design tokens ----------
const C = {
  bg:        [9,   11,  27 ] as [number,number,number], // #090b1b
  panel:     [17,  22,  46 ] as [number,number,number], // #11162e
  panel2:    [24,  30,  60 ] as [number,number,number], // #181e3c
  indigo:    [79,  70, 229 ] as [number,number,number], // #4F46E5
  violet:    [124, 58, 237 ] as [number,number,number], // #7C3AED
  fuchsia:   [168, 85, 247 ] as [number,number,number], // #A855F7
  cyan:      [34, 211, 238 ] as [number,number,number], // #22D3EE
  emerald:   [16, 185, 129 ] as [number,number,number], // #10b981
  amber:     [245,158,  11 ] as [number,number,number], // #F59E0B
  rose:      [244, 63,  94 ] as [number,number,number], // #F43F5E
  white:     [255,255,255] as [number,number,number],
  white70:   [255,255,255,0.7] as unknown as [number,number,number],
  white50:   [255,255,255,0.5] as unknown as [number,number,number],
  white20:   [255,255,255,0.2] as unknown as [number,number,number],
  gold:      [252,211, 77 ] as [number,number,number],
}


function fill(doc: jsPDF, rgb: number[], alpha?: number) {
  const g = doc as unknown as { _gstack?: { opacity: number }[] }
  if (alpha !== undefined) doc.setGState(new (doc as any).GState({ opacity: alpha }))
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
}
function stroke(doc: jsPDF, rgb: number[], lw = 0.3, alpha?: number) {
  if (alpha !== undefined) doc.setGState(new (doc as any).GState({ 'stroke-opacity': alpha }))
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  doc.setLineWidth(lw)
}
function opacity(doc: jsPDF, a: number) {
  doc.setGState(new (doc as any).GState({ opacity: a }))
}

// ---------- Helpers ----------
function ellipse(doc: jsPDF, x: number, y: number, rx: number, ry: number, style: 'F'|'D'|'FD'|'DF' = 'F') {
  // jsPDF ellipse signature: (x, y, rx, ry, style)
  ;(doc as unknown as { ellipse: (x:number,y:number,rx:number,ry:number,style?:string)=>void }).ellipse(x, y, rx, ry, style)
}
function roundRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
  doc.roundedRect(x, y, w, h, r, r, 'F')
}
function roundRectStroke(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill?: number[], strokeColor?: number[]) {
  const prevF = doc.getFillColor()
  const prevD = doc.getDrawColor()
  if (fill) doc.setFillColor(fill[0], fill[1], fill[2])
  if (strokeColor) doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2])
  doc.roundedRect(x, y, w, h, r, r, fill ? (strokeColor ? 'FD' : 'F') : (strokeColor ? 'D' : ''))
  doc.setFillColor(prevF)
  doc.setDrawColor(prevD)
}
function textWrap(doc: jsPDF, text: string, x: number, y: number, maxW: number, fontSize = 10, lineH = 5, color = C.white) {
  doc.setTextColor(color[0], color[1], color[2])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)
  const words = text.split(/\s+/)
  let line = ''
  let yy = y
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (doc.getTextWidth(test) > maxW && line) {
      doc.text(line, x, yy)
      yy += lineH
      line = w
    } else {
      line = test
    }
  }
  if (line) doc.text(line, x, yy)
  return yy + lineH
}
function title(doc: jsPDF, text: string, x: number, y: number, size = 22, color = C.white) {
  doc.setTextColor(color[0], color[1], color[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  doc.text(text, x, y)
}
function h2(doc: jsPDF, text: string, x: number, y: number, color = C.cyan) {
  doc.setTextColor(color[0], color[1], color[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(text, x, y)
}
function pill(doc: jsPDF, text: string, x: number, y: number, color: number[]) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const tw = doc.getTextWidth(text)
  const w = tw + 8, h = 6
  fill(doc, color, 0.18)
  doc.roundedRect(x, y - 4.5, w, h, 3, 3, 'F')
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(0.2)
  opacity(doc, 0.55)
  doc.roundedRect(x, y - 4.5, w, h, 3, 3, 'D')
  opacity(doc, 1)
  doc.setTextColor(color[0], color[1], color[2])
  doc.text(text, x + 4, y - 0.5)
  return x + w + 3
}
function pageBg(doc: jsPDF, pageH: number) {
  // deep-space bg
  fill(doc, C.bg)
  doc.rect(0, 0, 210, pageH, 'F')
  // nebula orbs
  opacity(doc, 0.6)
  fill(doc, C.fuchsia)
  ellipse(doc,180, 20, 70, 35, 'F')
  fill(doc, C.cyan)
  ellipse(doc,20, pageH - 30, 60, 30, 'F')
  fill(doc, C.indigo)
  ellipse(doc,105, pageH / 2, 80, 50, 'F')
  opacity(doc, 1)
  // grid
  opacity(doc, 0.06)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.1)
  for (let x = 0; x <= 210; x += 10) { doc.line(x, 0, x, pageH) }
  for (let y = 0; y <= pageH; y += 10) { doc.line(0, y, 210, y) }
  opacity(doc, 1)
}

// ---------- Pages ----------
function coverPage(doc: jsPDF) {
  const W = 210, H = 297
  pageBg(doc, H)
  // Glow orbs
  opacity(doc, 0.6)
  fill(doc, C.cyan);  ellipse(doc,45,  70, 55, 55, 'F')
  fill(doc, C.fuchsia); ellipse(doc,175, 220, 60, 60, 'F')
  fill(doc, C.violet); ellipse(doc,110, 150, 90, 55, 'F')
  opacity(doc, 1)

  // Center glass card
  const cx = 20, cy = 55, cw = 170, ch = 187
  fill(doc, C.panel, 0.65)
  roundRect(doc, cx, cy, cw, ch, 14)
  opacity(doc, 0.5)
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3)
  doc.roundedRect(cx, cy, cw, ch, 14, 14, 'D')
  opacity(doc, 1)

  // Logo orbit
  const lx = 105, ly = 115
  opacity(doc, 0.5)
  doc.setDrawColor(C.cyan[0], C.cyan[1], C.cyan[2])
  doc.setLineWidth(0.6); doc.circle(lx, ly, 14, 'D')
  doc.setDrawColor(C.fuchsia[0], C.fuchsia[1], C.fuchsia[2])
  doc.setLineWidth(0.4); doc.circle(lx, ly, 20, 'D')
  opacity(doc, 1)
  fill(doc, C.indigo)
  doc.circle(lx, ly, 9, 'F')
  fill(doc, C.cyan, 0.85)
  doc.circle(lx - 2.5, ly - 2.5, 3, 'F')
  // orbiting satellite
  fill(doc, C.cyan)
  doc.circle(lx + 18, ly - 8, 1.3, 'F')

  // Brand
  title(doc, 'EduSphere', 105, 165, 34, C.white)
  const subW = doc.getTextWidth('EduSphere')
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.text(' AI', 105 + subW - 2, 165)

  doc.setTextColor(210, 215, 235)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text('Your school. Smarter every day.', 105, 180, { align: 'center' })

  // Divider
  opacity(doc, 0.5)
  doc.setDrawColor(C.cyan[0], C.cyan[1], C.cyan[2])
  doc.setLineWidth(0.4)
  doc.line(60, 192, 150, 192)
  opacity(doc, 1)

  // Subtitle
  doc.setTextColor(200, 210, 235)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'normal')
  doc.text('AI-Powered School Management Platform', 105, 205, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor(160, 170, 200)
  doc.text('Smart Attendance  •  Intelligent Marks & CGPA  •  AI Co-teacher', 105, 213, { align: 'center' })
  doc.text('Face Recognition  •  WhatsApp for Parents  •  Report Cards', 105, 219, { align: 'center' })

  // Footer tag
  doc.setFontSize(8)
  doc.setTextColor(120, 130, 160)
  doc.text('v2.1  •  Feature Brochure  •  Prepared for School Administration', 105, 285, { align: 'center' })
}

type Feature = { title: string; desc: string; color: number[]; icon: string }

function featureCard(doc: jsPDF, x: number, y: number, w: number, h: number, f: Feature) {
  // glow
  opacity(doc, 0.18)
  fill(doc, f.color); roundRect(doc, x, y, w, h, 8)
  opacity(doc, 1)
  // card
  fill(doc, C.panel2, 0.85); roundRect(doc, x+1, y+1, w-2, h-2, 8)
  // icon circle
  fill(doc, f.color, 0.2)
  doc.circle(x + 10, y + 12, 5.5, 'F')
  doc.setDrawColor(f.color[0],f.color[1],f.color[2]); doc.setLineWidth(0.25); opacity(doc,0.6)
  doc.circle(x + 10, y + 12, 5.5, 'D'); opacity(doc,1)
  doc.setTextColor(f.color[0], f.color[1], f.color[2])
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(f.icon, x + 10, y + 14.5, { align: 'center' })

  // title
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5)
  doc.text(f.title, x + 20, y + 14)
  // desc
  textWrap(doc, f.desc, x + 6, y + 22, w - 12, 8.2, 4.2, [205,215,235])
}

function sectionHeader(doc: jsPDF, label: string, heading: string, pageNum: number) {
  // top accent line
  opacity(doc, 0.4)
  fill(doc, C.cyan); doc.rect(20, 18, 30, 0.8, 'F')
  opacity(doc, 1)
  // label
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2])
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text(label.toUpperCase(), 20, 26)
  // title
  title(doc, heading, 20, 38, 22)
  // page number
  doc.setTextColor(130,140,170)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(`EduSphere AI  •  Feature Brochure  •  ${pageNum}`, 190, 287, { align: 'right' })
}

function featuresPage1(doc: jsPDF) {
  pageBg(doc, 297)
  sectionHeader(doc, '01  •  Core Modules', 'All-in-one School OS', 2)

  const features: Feature[] = [
    { title: 'Dashboard Live',      desc: 'Real-time KPIs, attendance pulse, at-risk alerts, AI tips and today\'s schedule at a glance.',                     color: C.cyan,     icon: '◉' },
    { title: 'Student Records',     desc: 'Full student directory with photos, QR IDs, admission numbers, guardians, houses, medical info & history.',         color: C.violet,   icon: '◈' },
    { title: 'Teacher Management',  desc: 'Role-based teacher accounts, assigned classes & subjects, class-teacher mapping, invite emails.',                 color: C.fuchsia,  icon: '◆' },
    { title: 'Smart Attendance',    desc: 'Manual, QR code and AI Face Recognition attendance; heatmaps; history; bulk actions; offline-first sync.',       color: C.emerald,  icon: '✓' },
    { title: 'Marks & Report Cards',desc: 'CBSE 9-band grading, weighted CGPA, AI-powered final predictions, PDF report cards & parent WhatsApp.',             color: C.amber,    icon: '★' },
    { title: 'Timetable / Schedule',desc: 'Class schedules with day-wise periods, teacher allocation and room assignments.',                                  color: C.indigo,   icon: '▤' },
  ]
  const w = 82, h = 34, gap = 6
  const startY = 52
  features.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    featureCard(doc, 20 + col*(w+gap), startY + row*(h+gap), w, h, f)
  })

  // bottom stat strip
  const sy = startY + 3*(h+gap) + 4
  fill(doc, C.panel2, 0.75); roundRect(doc, 20, sy, 170, 28, 10)
  const stats = [
    { v: '50+',  l: 'Feature modules' },
    { v: '<20s', l: 'Build target' },
    { v: 'PWA',  l: 'Install on Android' },
    { v: '9-band', l: 'CBSE grading' },
  ]
  stats.forEach((s, i) => {
    const x = 30 + i*42
    doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2])
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(s.v, x, sy+13)
    doc.setTextColor(180,190,215)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(s.l, x, sy+20)
  })
}

function featuresPage2(doc: jsPDF) {
  pageBg(doc, 297)
  sectionHeader(doc, '02  •  AI Superpowers', 'Built-in Artificial Intelligence', 3)

  // Big AI card
  fill(doc, C.panel2, 0.7); roundRect(doc, 20, 50, 170, 42, 12)
  opacity(doc, 0.25)
  fill(doc, C.fuchsia); ellipse(doc,180, 70, 40, 28, 'F')
  fill(doc, C.cyan); ellipse(doc,40, 90, 35, 22, 'F')
  opacity(doc, 1)
  doc.setTextColor(C.cyan[0], C.cyan[1], C.cyan[2])
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('AI CO-TEACHER', 28, 62)
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16)
  doc.text('Meet Your Neural Assistant', 28, 72)
  doc.setTextColor(200,210,235); doc.setFont('helvetica','normal'); doc.setFontSize(10)
  const blurb = 'A floating 3D mascot orb that sees your context, answers teacher questions, marks attendance risk, drafts parent messages, tells jokes, and whispers proactive nudges as you move through the app. Voice and chat included.'
  textWrap(doc, blurb, 28, 80, 155, 10, 5, [205,215,235])

  const aiFeatures: Feature[] = [
    { title: 'Class Insight',       desc: 'AI-generated 5-bullet performance analysis after every marks entry — weak areas, toppers and at-risk students.', color: C.violet,  icon: '✦' },
    { title: 'Final Predictions',   desc: 'Linear-regression predictions blended with attendance show each student\'s likely final score with confidence.',  color: C.cyan,    icon: '↗' },
    { title: 'At-Risk Alerts',      desc: 'Automatic flagging of students trending below passing; one-tap WhatsApp to guardians.',                          color: C.rose,    icon: '!' },
    { title: 'AI Tutor Mode',       desc: 'Student-facing friendly explainer for any CBSE/state-board topic with simple examples.',                       color: C.emerald, icon: '❝' },
    { title: 'Face Recognition',    desc: 'On-device face-api.js matching for fast, touchless attendance in class.',                                      color: C.fuchsia, icon: '☺' },
    { title: 'Smart Nudges',        desc: 'Proactive whispers when attendance is low, a student drops, or a paper needs review.',                         color: C.amber,   icon: '✧' },
  ]
  const w = 82, h = 34, gap = 6
  const startY = 100
  aiFeatures.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    featureCard(doc, 20 + col*(w+gap), startY + row*(h+gap), w, h, f)
  })
}

function featuresPage3(doc: jsPDF) {
  pageBg(doc, 297)
  sectionHeader(doc, '03  •  Communication & Reports', 'Parents • PDFs • Analytics', 4)

  const features: Feature[] = [
    { title: 'WhatsApp for Parents', desc: 'Pre-filled, one-tap WhatsApp messages to guardians for absentees, at-risk students, and marks reports.', color: C.emerald, icon: '✆' },
    { title: 'Bulk Messaging',       desc: 'Batch-notify all at-risk parents; rate-limited to avoid tab-bombing on phones.',                           color: C.cyan,    icon: '☰' },
    { title: 'Report Card PDFs',     desc: 'Branded A4 report cards with subject table, totals, grading scale, teacher remarks and signature lines.', color: C.indigo,  icon: '◫' },
    { title: 'CSV Export',           desc: 'One-click CSV export of current marks, attendance, and full history for office records.',                 color: C.violet,  icon: '↓' },
    { title: 'Grade Distribution',   desc: 'Live recharts bar charts coloured by CBSE grade band update as you type marks.',                           color: C.amber,   icon: '▥' },
    { title: 'Publish Workflow',     desc: 'Save draft → Submit to admin → Publish to parents. Status pills and notifications at every step.',         color: C.fuchsia, icon: '⇪' },
  ]
  const w = 82, h = 34, gap = 6
  const startY = 52
  features.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    featureCard(doc, 20 + col*(w+gap), startY + row*(h+gap), w, h, f)
  })

  // Premium / UX card
  const cy = startY + 3*(h+gap) + 6
  fill(doc, C.panel2, 0.7); roundRect(doc, 20, cy, 170, 56, 12)
  h2(doc, 'Premium Mobile Experience', 28, cy + 12, C.cyan)
  const ux = [
    'Deep-space glass theme with cyan/violet/fuchsia accents',
    'PWA installable on Android Chrome; works offline (attendance queues & auto-syncs)',
    'Notch-safe layout; floating AI mascot above the bottom navigation',
    'Role-based access: Super Admin → School Admin → Teacher → Student → Parent',
    'Email-verified accounts, strict Firebase RTDB security rules',
    'Haptic feedback, smooth page transitions, 60fps animations (framer-motion + anime.js)',
  ]
  ux.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i/2)
    const tx = 28 + col*80, ty = cy + 22 + row*8
    fill(doc, C.cyan); doc.circle(tx, ty-1.4, 1.2, 'F')
    doc.setTextColor(210,220,240); doc.setFont('helvetica','normal'); doc.setFontSize(8.8)
    doc.text(t, tx + 5, ty)
  })
}

function closingPage(doc: jsPDF) {
  const H = 297
  pageBg(doc, H)
  opacity(doc, 0.5)
  fill(doc, C.violet); ellipse(doc,105, 130, 110, 70, 'F')
  opacity(doc, 0.35)
  fill(doc, C.cyan); ellipse(doc,105, 130, 80, 45, 'F')
  opacity(doc, 1)

  fill(doc, C.panel, 0.75); roundRect(doc, 25, 70, 160, 160, 14)

  title(doc, 'Ready to deploy?', 105, 110, 24, C.white)
  doc.setTextColor(C.cyan[0],C.cyan[1],C.cyan[2])
  doc.setFont('helvetica','normal'); doc.setFontSize(11)
  doc.text('EduSphere AI is production-ready.', 105, 122, { align: 'center' })

  const bullets = [
    'Hosted on Vercel with zero-downtime deploys',
    'Firebase Realtime Database + Storage backend',
    'PWA with offline attendance queue',
    'Face-AI models self-hosted under /models',
    'Strict RBAC for all five user roles',
    'One-command build  •  One-command deploy',
  ]
  bullets.forEach((b, i) => {
    const y = 140 + i*10
    fill(doc, C.emerald); doc.circle(48, y-1.8, 1.6, 'F')
    doc.setTextColor(220,225,240); doc.setFont('helvetica','normal'); doc.setFontSize(10)
    doc.text(b, 55, y)
  })

  // Big quote
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold'); doc.setFontSize(12)
  doc.text('"Your school. Smarter every day."', 105, 215, { align: 'center' })
  doc.setTextColor(170,180,210)
  doc.setFont('helvetica','normal'); doc.setFontSize(9)
  doc.text('— EduSphere AI tagline', 105, 222, { align: 'center' })

  // Footer brand strip
  fill(doc, C.indigo, 0.45)
  doc.rect(0, 270, 210, 27, 'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold'); doc.setFontSize(12)
  doc.text('EduSphere AI', 20, 283)
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5)
  doc.setTextColor(200,210,235)
  doc.text('Smart School Management Platform  •  PWA  •  Firebase  •  AI-first', 20, 290)
  doc.setTextColor(C.cyan[0],C.cyan[1],C.cyan[2])
  doc.setFont('helvetica','bold'); doc.setFontSize(9)
  doc.text('edusphere.app', 190, 285, { align: 'right' })
}

// ---------- Public API ----------
export function generateFeatureBrochure(filename = 'EduSphere-AI-Features.pdf') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({
    title: 'EduSphere AI — Feature Brochure',
    subject: 'Feature overview for school administration',
    author: 'EduSphere AI',
    creator: 'EduSphere AI',
  })
  coverPage(doc)
  doc.addPage()
  featuresPage1(doc)
  doc.addPage()
  featuresPage2(doc)
  doc.addPage()
  featuresPage3(doc)
  doc.addPage()
  closingPage(doc)
  doc.save(filename)
}
