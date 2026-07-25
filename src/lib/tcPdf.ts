import jsPDF from 'jspdf'

type TCInput = {
  schoolName: string
  schoolAddress?: string
  schoolLogo?: string // ignored — pure vector
  tcNumber: string | number
  studentName: string
  fatherName?: string
  motherName?: string
  admissionNumber: string | number
  dob: string
  nationality?: string
  religion?: string
  caste?: string
  className: string
  section?: string
  dateOfAdmission?: string
  dateOfLeaving?: string
  leavingClass?: string
  reason?: string
  remarks?: string
  qualifiedForPromotion?: boolean
  feesPaid?: boolean
  conduct?: string
  principalName?: string
}

export function generateTransferCertificate(data: TCInput, filename?: string){
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  doc.setProperties({ title:`TC ${data.tcNumber} - ${data.studentName}`, author:data.schoolName, creator:'EduSphere AI' })

  // Cream paper look
  doc.setFillColor(252,250,240); doc.rect(0,0,210,297,'F')

  // Double border
  doc.setDrawColor(30,40,80); doc.setLineWidth(1.2); doc.rect(10,10,190,277)
  doc.setLineWidth(0.4); doc.rect(12,12,186,273)

  // Header
  doc.setTextColor(30,40,80); doc.setFont('helvetica','bold'); doc.setFontSize(18)
  doc.text(data.schoolName.toUpperCase(), 105, 26, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(10)
  if (data.schoolAddress) doc.text(data.schoolAddress, 105, 32, { align:'center' })
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(180,40,40)
  doc.text('TRANSFER CERTIFICATE', 105, 44, { align:'center' })
  doc.setDrawColor(180,40,40); doc.setLineWidth(0.6); doc.line(60,46,150,46)

  // TC number / date
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(30,40,80)
  doc.text(`TC No.: ${data.tcNumber}`, 16, 54)
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 194, 54, { align:'right' })

  const y0 = 66
  const lineGap = 10
  const labelW = 62

  function field(y:number, label:string, value:string) {
    doc.setFont('helvetica','bold'); doc.text(label+':', 20, y)
    doc.setFont('helvetica','normal')
    const val = value || 'N/A'
    doc.line(20+labelW, y+1, 190, y+1)
    doc.text(val.substring(0,75), 22+labelW, y)
  }

  let y = y0
  field(y,'Name of Student', data.studentName); y+=lineGap
  field(y,"Father's Name", data.fatherName||''); y+=lineGap
  field(y,"Mother's Name", data.motherName||''); y+=lineGap
  field(y,'Admission Number', String(data.admissionNumber)); y+=lineGap
  field(y,'Date of Birth', data.dob); y+=lineGap
  field(y,'Nationality', data.nationality||'Indian'); y+=lineGap
  field(y,'Religion', data.religion||''); y+=lineGap
  field(y,'Caste/Category', data.caste||''); y+=lineGap
  field(y,'Class in which studying', `${data.className}${data.section?'-'+data.section:''}`); y+=lineGap
  field(y,'Date of Admission', data.dateOfAdmission||''); y+=lineGap
  field(y,'Date of Leaving', data.dateOfLeaving||new Date().toLocaleDateString('en-IN')); y+=lineGap
  field(y,'Class from which leaving', data.leavingClass||`${data.className}${data.section?'-'+data.section:''}`); y+=lineGap
  field(y,'Reason for Leaving', data.reason||'On parents\' request'); y+=lineGap
  field(y,'Conduct', data.conduct||'Good'); y+=lineGap
  field(y,'Remarks', data.remarks||'All dues cleared.'); y+=lineGap

  // Checkboxes
  y += 4
  doc.setFont('helvetica','normal'); doc.setFontSize(10)
  doc.text(`Fees Paid: ${data.feesPaid !== false ? '[X] Yes' : '[ ] Yes'}   ${data.feesPaid === false ? '[X]' : '[ ]'} No`, 20, y); y+=lineGap
  doc.text(`Qualified for promotion to next class: ${data.qualifiedForPromotion !== false ? '[X] Yes' : '[ ] Yes'}   ${data.qualifiedForPromotion === false ? '[X]' : '[ ]'} No`, 20, y); y+=lineGap+6

  // Signatures
  doc.line(25, y+20, 75, y+20); doc.line(125, y+20, 185, y+20)
  doc.setFont('helvetica','normal'); doc.setFontSize(9)
  doc.text('Class Teacher', 50, y+25, { align:'center' })
  doc.text('Principal', 155, y+25, { align:'center' })
  if (data.principalName) doc.text(data.principalName, 155, y+30, { align:'center' })

  doc.save(filename || `TC-${data.tcNumber}-${data.studentName.replace(/\s+/g,'_')}.pdf`)
}
