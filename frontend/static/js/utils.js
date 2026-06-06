// ===== Utility Functions =====
// Dependencies: api.js
function getAgentEmoji(agent){
  const map={employee:'👤',manager:'👔',hr:'👥',policy:'📋',scheduling:'📅',cancellation:'❌',analytics:'📊'}
  return map[agent?.toLowerCase()]||'🤖'
}

function getWeekRange(offset) {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function toDisplayDate(dateStr) {
  if (!dateStr) return '—'
  const p = dateStr.split(' ')[0].split('-')
  if (p.length !== 3) return dateStr
  if (p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  return dateStr
}

function formatDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isWithin70Days(dateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24))
  return diffDays >= -70 && diffDays <= 70
}

function updateWeekCalSummary() {
  const entries = Object.entries(weekCalSelections).filter(([_, v]) => v.type)
  const count = entries.length
  const btn = document.getElementById('weekCalApplyBtn')
  btn.disabled = count === 0
  const summary = document.getElementById('weekCalSummary')
  const options = document.getElementById('weekCalLeaveOptions')
  if (count === 0) { summary.classList.add('hidden'); options?.classList.add('hidden'); return }
  summary.classList.remove('hidden')
  options?.classList.remove('hidden')
  document.getElementById('weekCalTotalCount').textContent = count
  const list = document.getElementById('weekCalSummaryList')
  const sorted = entries.sort(([a], [b]) => a.localeCompare(b))
  list.innerHTML = sorted.map(([dateStr, sel]) => {
    const parts = dateStr.split('-')
    const label = `${parts[2]}-${parts[1]}-${parts[0]}`
    return `<div class="flex items-center justify-between"><span>${label}</span><span class="font-medium capitalize text-blue-600">${sel.type}</span></div>`
  }).join('')
}

function getLeaveDateParts(l) {
  const ds = l.start_date || l.startDate || ''
  let m, y
  if (ds.includes('-')) {
    const parts = ds.split('-')
    if (parts[0].length === 4) { y = parts[0]; m = parts[1] }
    else { y = parts[2]; m = parts[1] }
  }
  return { month: m ? parseInt(m) : null, year: y ? parseInt(y) : null }
}

window.filterLeaveHistory = function () {
  leavePage = 0
  const q = document.getElementById('leaveHistorySearch')?.value.toLowerCase() || ''
}
window.viewDocument=async function(id){
  try{
    const emp=await apiGet('/employees/'+id)
    if(!emp.document) { alert('No document available'); return }
    const b64=emp.document.split(',')[1]
    if(!b64) { window.open(emp.document,'_blank'); return }
    const byteChars=atob(b64)
    const byteNums=new Array(byteChars.length)
    for(let i=0;i<byteChars.length;i++) byteNums[i]=byteChars.charCodeAt(i)
    const byteArr=new Uint8Array(byteNums)
    const blob=new Blob([byteArr],{type:'application/pdf'})
    const url=URL.createObjectURL(blob)
    window.open(url,'_blank')
    setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(e){alert('Error loading document: '+e.message)}
}
window.viewLeaveDoc = function (leaveId) {
  try {
    const leaves = window._empLeaveHistory || (window._empApprovalData ? [...(window._empApprovalData.history||[]), ...(window._empApprovalData.pending||[]), ...(window._empApprovalData.cancellations||[])] : null) || (typeof _hrLeaveData !== 'undefined' ? _hrLeaveData : null) || []
    const lv = leaves.find(l => l.id === leaveId)
    if (!lv || !lv.document) { alert('No document attached'); return }
    const b64 = lv.document.split(',')[1]
    if (!b64) { window.open(lv.document, '_blank'); return }
    const byteChars = atob(b64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const byteArr = new Uint8Array(byteNums)
    const blob = new Blob([byteArr], { type: 'application/pdf' })
    window.open(URL.createObjectURL(blob), '_blank')
  } catch (e) { alert('Error loading document') }
}
