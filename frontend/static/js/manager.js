// ===== Manager Dashboard Functions =====
// Dependencies: api.js, utils.js, auth.js, notifications.js, chat.js
let _mgrEmployees = []
let _mgrSelectedEmpId = null

let _mgrLastTeamHash = ''

async function loadManagerDashboard(isRefresh) {
  const u = getUser()
  if (!u || window.location.pathname !== '/manager') return
  try {
    const [emps, pendingReqs, cancels] = await Promise.all([
      apiGet('/employees'),
      apiGet('/leaves/pending/' + u.id).catch(() => []),
      apiGet('/leaves/cancellations/' + u.id).catch(() => []),
    ])
    _mgrEmployees = emps

    // Compute per-employee pending counts
    const pendingCounts = {}
    ;(pendingReqs || []).forEach(r => { pendingCounts[r.employee_id] = (pendingCounts[r.employee_id] || 0) + 1 })
    const cancelCounts = {}
    ;(cancels || []).forEach(r => { cancelCounts[r.employee_id] = (cancelCounts[r.employee_id] || 0) + 1 })
    window._mgrPendingCounts = pendingCounts

    const totalPending = (pendingReqs || []).length
    const totalCancellations = (cancels || []).length

    // Stats cards — incremental update during refresh to avoid flicker
    const stats = document.getElementById('mgrStatsCards')
    if (isRefresh) {
      const vals = [emps.length, totalPending, totalCancellations]
      stats.querySelectorAll('.stat-value').forEach((el, i) => { if (i < vals.length) el.textContent = String(vals[i]) })
    } else {
      stats.innerHTML = [
        { label: 'Total Team Members', value: emps.length, color: 'bg-blue-50 text-blue-700', icon: '👥' },
        { label: 'Pending Requests', value: totalPending, color: 'bg-yellow-50 text-yellow-700', icon: '⏳' },
        { label: 'Cancellation Req', value: totalCancellations, color: 'bg-blue-50 text-blue-700', icon: '🔶' },
      ].map(s => `<div class="${s.color} rounded-xl p-4 border"><p class="text-xs opacity-70">${s.icon} ${s.label}</p><p class="text-2xl font-bold mt-1 stat-value">${s.value}</p></div>`).join('')
    }

    // Team member cards - skip full re-render during auto-refresh to prevent flicker
    const container = document.getElementById('teamMemberList')
    if (!isRefresh) {
      const sortedEmps = [...emps].sort((a, b) => {
        const pa = (pendingCounts[a.id] || 0) + (cancelCounts[a.id] || 0)
        const pb = (pendingCounts[b.id] || 0) + (cancelCounts[b.id] || 0)
        return pb - pa || (a.name || '').localeCompare(b.name || '')
      })
      const top10 = sortedEmps.slice(0, 10)
      const desigColors = {
        'software engineer':'bg-blue-100 text-blue-700','senior software engineer':'bg-indigo-100 text-indigo-700',
        'tech lead':'bg-purple-100 text-purple-700','manager':'bg-orange-100 text-orange-700',
        'ai ml engineer':'bg-cyan-100 text-cyan-700','data scientist':'bg-teal-100 text-teal-700',
        'devops engineer':'bg-rose-100 text-rose-700','qa engineer':'bg-lime-100 text-lime-700',
        'product manager':'bg-amber-100 text-amber-700','ui/ux designer':'bg-pink-100 text-pink-700',
        'business analyst':'bg-violet-100 text-violet-700','intern':'bg-gray-100 text-gray-700',
      }
      const defaultColor = 'bg-gray-100 text-gray-700'
      container.innerHTML = top10.map(e => {
        const pCount = pendingCounts[e.id] || 0
        const cCount = cancelCounts[e.id] || 0
        const badges = []
        if (pCount > 0) badges.push(`<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">⏳ ${pCount} Pending</span>`)
        if (cCount > 0) badges.push(`<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">🔶 ${cCount} Cancellation</span>`)
        const badgeHtml = badges.length ? badges.join(' ') : ''
        const desig = (e.designation||'').toLowerCase()
        const dColor = Object.keys(desigColors).reduce((acc,key)=> desig.includes(key) ? desigColors[key] : acc, defaultColor)
        const docBtn = e.hasDocument ? `<button onclick="viewDocument('${e.id}')" class="text-xs text-blue-600 hover:text-blue-800 ml-auto">📄 View</button>` : ''
        return `<div class="p-4 bg-white rounded-xl border border-gray-200">
          <div class="flex items-center justify-between mb-1">
            <p class="font-semibold text-sm text-gray-800">${e.name}</p>
            <div class="flex items-center gap-2">${docBtn}${badgeHtml ? '<span class="flex items-center gap-1">'+badgeHtml+'</span>' : ''}</div>
          </div>
          <p class="text-xs text-gray-500">${e.email || '—'}</p>
          <p class="text-xs text-gray-500 mt-1">ID: ${e.id}</p>
          <p class="text-xs mt-0.5"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${dColor}">${e.designation||'—'}</span></p>
          <p class="text-xs text-gray-500 mt-1">DOJ: ${toDisplayDate(e.doj)}</p>
          <p class="text-xs text-gray-500">⚤ ${e.gender || '—'}</p>
          ${e.projectTag
            ? `<div class="mt-2 flex items-center gap-2"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🏷️ ${e.projectTag}</span><button onclick="untagEmployeeMgr('${e.id}')" class="text-xs text-red-500 hover:text-red-700" title="Remove tag">✕ Untag</button><button onclick="editTagMgr('${e.id}','${e.projectTag}')" class="text-xs text-blue-500 hover:text-blue-700" title="Edit tag">✏️</button></div>`
            : `<div class="mt-2"><button onclick="editTagMgr('${e.id}','')" class="text-xs text-blue-600 hover:text-blue-800">+ Add Project Tag</button></div>`
          }
          <div id="mgrTagInput${e.id}" class="hidden mt-2 flex gap-2"></div>
          <p class="text-xs text-gray-400 mt-1">📞 ${e.phone || '—'}</p>
        </div>`
      }).join('')
    }

    // Employee select for approvals tab
    const sel = document.getElementById('mgrEmployeeSelect')
    if (!isRefresh) {
      sel.innerHTML = '<option value="">Select team member...</option>' + emps.map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('')
    }

    // Refresh notification bell — only update badge count text during refresh
    if (window._mgrPendingCounts && window.initNavbar) {
      const totalP = Object.values(window._mgrPendingCounts).reduce((a, b) => a + b, 0)
      const bell = document.getElementById('notificationBell')
      if (bell) {
        if (isRefresh) {
          const badge = bell.querySelector('.notif-badge-count')
          if (badge) badge.textContent = String(totalP)
          bell.title = totalP + ' pending'
        } else {
          bell.innerHTML = '🔔' + (totalP > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold notif-badge-count">${totalP}</span>` : '')
          bell.title = totalP + ' pending'
        }
      }
    }
  } catch (e) { console.error('Mgr dash error:', e) }
}

window.openEmployeeView = async function (empId) {
  _mgrSelectedEmpId = empId
  // Hide all tab contents, show employee view
  document.getElementById('mgrDashboardContent').classList.add('hidden')
  document.getElementById('mgrApprovalsContent').classList.add('hidden')
  document.getElementById('mgrChatContent').classList.add('hidden')
  const ev = document.getElementById('mgrEmployeeView')
  ev.classList.remove('hidden')

  const emp = _mgrEmployees.find(e => e.id === empId)
  if (!emp) return

  const lb = emp.leaveBalance || {}
  const totalRemaining = Object.values(lb).reduce((s, v) => s + (v.remaining || 0), 0)
  const totalLimit = Object.values(lb).reduce((s, v) => s + (v.limit || 0), 0)

  const docBtnDetail = emp.hasDocument ? `<button onclick="viewDocument('${emp.id}')" class="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">📄 View</button>` : ''
  document.getElementById('empDetailHeader').innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div>
        <p class="text-lg font-bold text-gray-800">${emp.name}</p>
        <p class="text-xs text-gray-500">${emp.id} · ${emp.designation || '—'}${emp.gender ? ' · ⚤ ' + emp.gender : ''}${emp.projectTag ? ' · 🏷️ ' + emp.projectTag : ''}</p>
      </div>
      ${docBtnDetail}
    </div>`

  const balanceTypes = [
    { key: 'casual', label: 'Casual', color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    { key: 'sick', label: 'Sick', color: 'bg-green-50 border-green-200', text: 'text-green-700' },
    { key: 'business', label: 'Business', color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    { key: 'emergency', label: 'Emergency', color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
    { key: 'family', label: 'Family', color: 'bg-pink-50 border-pink-200', text: 'text-pink-700' },
  ]
  document.getElementById('empBalanceCards').innerHTML = balanceTypes.map(t => {
    const b = lb[t.key] || {}
    const rem = b.remaining || 0
    const lim = b.limit || 0
    return `<div class="${t.color} rounded-xl p-4 border"><p class="text-xs font-medium ${t.text}">${t.label}</p><p class="text-lg font-bold text-gray-800 mt-1">${rem}<span class="text-sm font-normal text-gray-400">/${lim}</span></p></div>`
  }).join('')

  await loadEmpApprovals(empId)
  sessionStorage.setItem('mgrViewState', JSON.stringify({ tab: 'approvals', empId, empApprovalTab: window._mgrEmpApprovalTab || 'pending' }))
}

// Re-fresh header + balance cards from _mgrEmployees data (called by auto-refresh)
window.refreshEmpDetailHeader = function () {
  if (!_mgrSelectedEmpId) return
  const emp = _mgrEmployees.find(e => e.id === _mgrSelectedEmpId)
  if (!emp) return
  const lb = emp.leaveBalance || {}
  const docBtnDetail = emp.hasDocument ? `<button onclick="viewDocument('${emp.id}')" class="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">📄 View</button>` : ''
  document.getElementById('empDetailHeader').innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div>
        <p class="text-lg font-bold text-gray-800">${emp.name}</p>
        <p class="text-xs text-gray-500">${emp.id} · ${emp.designation || '—'}${emp.gender ? ' · ⚤ ' + emp.gender : ''}${emp.projectTag ? ' · 🏷️ ' + emp.projectTag : ''}</p>
      </div>
      ${docBtnDetail}
    </div>`
  const balanceTypes = [
    { key: 'casual', label: 'Casual', color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    { key: 'sick', label: 'Sick', color: 'bg-green-50 border-green-200', text: 'text-green-700' },
    { key: 'business', label: 'Business', color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    { key: 'emergency', label: 'Emergency', color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
    { key: 'family', label: 'Family', color: 'bg-pink-50 border-pink-200', text: 'text-pink-700' },
  ]
  document.getElementById('empBalanceCards').innerHTML = balanceTypes.map(t => {
    const b = lb[t.key] || {}
    const rem = b.remaining || 0
    const lim = b.limit || 0
    return `<div class="${t.color} rounded-xl p-4 border"><p class="text-xs font-medium ${t.text}">${t.label}</p><p class="text-lg font-bold text-gray-800 mt-1">${rem}<span class="text-sm font-normal text-gray-400">/${lim}</span></p></div>`
  }).join('')
}

window.closeEmployeeView = function () {
  document.getElementById('mgrEmployeeView').classList.add('hidden')
  // Determine which tab was active before
  const dash = document.getElementById('mgrDashboardContent')
  const approvals = document.getElementById('mgrApprovalsContent')
  // Check which tab button is active
  const dashTab = document.getElementById('mgrTabDashboard')
  const isDashActive = dashTab && dashTab.className.includes('text-blue-600')
  if (isDashActive) {
    dash.classList.remove('hidden')
  } else {
    approvals.classList.remove('hidden')
  }
  _mgrSelectedEmpId = null
  sessionStorage.setItem('mgrViewState', JSON.stringify({ tab: isDashActive ? 'dashboard' : 'approvals', empId: null }))
}

async function loadEmpApprovals(empId, quiet) {
  const pastEl = document.getElementById('empPastLeaves')
  const upcomingEl = document.getElementById('empUpcomingLeaves')
  if (!quiet) {
    pastEl.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>'
    upcomingEl.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>'
  }
  try {
    const leaves = await apiGet('/leaves/employee/' + empId)
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // Past pending + cancellation_requested
    const past = leaves.filter(l => {
      const s = (l.status || '').toLowerCase()
      if (s !== 'pending' && s !== 'cancellation_requested') return false
      const ds = l.start_date || l.startDate || ''
      if (!ds) return false
      let d
      if (ds.includes('-')) { const p = ds.split('-'); d = p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0]) }
      else d = new Date(ds)
      return d < today
    })

    // Upcoming pending only
    const upcoming = leaves.filter(l => {
      const s = (l.status || '').toLowerCase()
      if (s !== 'pending') return false
      const ds = l.start_date || l.startDate || ''
      if (!ds) return false
      let d
      if (ds.includes('-')) { const p = ds.split('-'); d = p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0]) }
      else d = new Date(ds)
      return d >= today
    })

    renderEmpLeaveCards(pastEl, past, 'past', empId)
    renderEmpLeaveCards(upcomingEl, upcoming, 'upcoming', empId)
    const pastCountEl = document.getElementById('empPastCount')
    const upcomingCountEl = document.getElementById('empUpcomingCount')
    if (pastCountEl) pastCountEl.textContent = String(past.length)
    if (upcomingCountEl) upcomingCountEl.textContent = String(upcoming.length)

    const pending = leaves.filter(l => (l.status || '') === 'pending')
    const cancellations = leaves.filter(l => (l.status || '') === 'cancellation_requested')
    const history = leaves.filter(l => {
      const s = (l.status || '').toLowerCase()
      return s !== 'pending'
    })
    window._empApprovalData = { pending, cancellations, history, empId }

    const pendingTab = document.getElementById('empApprovalTabPending')
    const cancelTab = document.getElementById('empApprovalTabCancellations')
    if (pendingTab) pendingTab.textContent = 'Pending (' + pending.length + ')'
    if (cancelTab) cancelTab.textContent = 'Cancellations (' + cancellations.length + ')'
    const histTab = document.getElementById('empApprovalTabHistory')
    if (histTab) histTab.textContent = 'History'

    if (!quiet) switchEmpApprovalTab('pending')
    else switchEmpApprovalTab(window._mgrEmpApprovalTab)
  } catch (e) {
    pastEl.innerHTML = '<p class="text-red-500 text-sm">Error: ' + e.message + '</p>'
    upcomingEl.innerHTML = ''
  }
}

function renderEmpLeaveCards(container, items, type, empId) {
  if (items.length === 0) {
    const label = type === 'past' ? 'past pending' : 'upcoming pending'
    container.innerHTML = '<div class="text-center py-8 text-gray-400"><p class="text-sm">No ' + label + ' requests</p></div>'
    return
  }

  const showKey = '_showAllEmp' + (type === 'past' ? 'Past' : 'Upcoming')
  const showAll = window[showKey] || false
  const display = showAll ? items : items.slice(0, 5)
  let html = ''
  if (items.length > 5 && !showAll) html += '<p class="text-xs text-gray-500 mb-2">Showing top 5 of ' + items.length + ' ' + (type === 'past' ? 'past pending' : 'upcoming pending') + ' requests</p>'

  html += display.map(l => {
    const id = l.id
    const status = (l.status || '').toLowerCase()
    const isCR = status === 'cancellation_requested'
    const leaveDate = l.start_date || l.startDate || ''
    const appliedDate = l.applied_on ? l.applied_on.split(' ')[0] : ''
    const hasDoc = l.document || l.attachment

    if (type === 'past' && isCR) {
      return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
        + '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>'
        + '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 capitalize">' + l.type + ' Leave</p>'
        + '<p class="text-xs text-gray-500 mt-0.5">' + toDisplayDate(leaveDate) + '</p>'
        + '<p class="text-xs text-gray-400">Applied: ' + toDisplayDate(appliedDate) + '</p>'
        + (l.cancellation_reason || l.cancellationReason ? '<p class="text-xs text-red-400 mt-0.5">Cancel reason: ' + (l.cancellation_reason || l.cancellationReason) + '</p>' : '')
        + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700 flex-shrink-0">🔶 Cancellation Pending</span></div>'
        + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
        + (hasDoc ? '<button onclick="viewLeaveDoc(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium">📄 Document</button>' : '')
        + '<button onclick="approveCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium">Approve Cancellation</button>'
        + '<button onclick="rejectCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium">Reject</button>'
        + '</div></div>'
    }

    return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
      + '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>'
      + '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 capitalize">' + l.type + ' Leave</p>'
      + '<p class="text-xs text-gray-500 mt-0.5">' + toDisplayDate(leaveDate) + '</p>'
      + '<p class="text-xs text-gray-400">Applied: ' + toDisplayDate(appliedDate) + '</p>'
      + (l.reason ? '<p class="text-xs text-blue-600 mt-0.5">Reason: ' + l.reason + '</p>' : '')
      + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700 flex-shrink-0">⏳ Pending</span></div>'
      + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
      + (hasDoc ? '<button onclick="viewLeaveDoc(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium">📄 Document</button>' : '')
      + '<button onclick="approveLeave(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium">Approve</button>'
      + '<button onclick="rejectLeave(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium">Reject</button>'
      + '</div></div>'
  }).join('')

  if (items.length > 5) {
    const toggle = 'window[\'' + showKey + '\']=!' + (showAll ? 'true' : 'false') + ';loadEmpApprovals(\'' + empId + '\')'
    html += '<button onclick="' + toggle + '" class="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">'
      + (showAll ? '▲ Show less' : '▼ Show all ' + items.length + ' leaves') + '</button>'
  }
  container.innerHTML = html
}

window.switchEmpApprovalTab = function (tab) {
  window._mgrEmpApprovalTab = tab
  const tabs = ['pending', 'cancellations', 'history']
  tabs.forEach(t => {
    const el = document.getElementById('empApprovalTab' + t.charAt(0).toUpperCase() + t.slice(1))
    if (el) el.className = 'px-3 py-1.5 rounded-full font-medium text-sm ' + (t === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100')
  })

  const data = window._empApprovalData || { pending: [], cancellations: [], history: [], empId: null }
  const items = data[tab] || []
  const list = document.getElementById('empApprovalList')

  if (items.length === 0) {
    list.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No ' + tab + ' records</p>'
    return
  }

  if (tab === 'history') {
    renderEmpHistory(data.history)
    return
  }

  // Sort by leave date ascending (earliest first)
  const sorted = [...items].sort((a, b) => {
    const da = a.startDate || a.start_date || ''
    const db = b.startDate || b.start_date || ''
    return da.localeCompare(db)
  })

  let html = ''

  html += sorted.map(l => {
    const id = l.id
    const leaveDate = l.startDate || l.start_date || ''
    const appliedOn = l.applied_on || ''
    const appliedDate = appliedOn ? appliedOn.split(' ')[0] : appliedOn
    const hasDocAppr = l.document || l.attachment
    if (tab === 'pending') {
      return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
        + '<div class="flex items-start justify-between">'
        + '<div><p class="text-xs text-gray-400">Request ID: <span class="font-mono text-gray-600">' + id + '</span></p>'
        + '<p class="text-sm font-semibold text-gray-800 mt-2 capitalize">' + l.type + ' Leave</p>'
        + '<p class="text-xs text-gray-500 mt-1">Leave Date: <strong>' + toDisplayDate(leaveDate) + '</strong></p>'
        + '<p class="text-xs text-gray-500">Applied On: ' + toDisplayDate(appliedDate) + '</p>'
        + (l.reason ? '<p class="text-xs text-blue-600 mt-1">Reason: ' + l.reason + '</p>' : '')
        + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">⏳ Pending</span></div>'
        + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
        + (hasDocAppr ? '<button onclick="viewLeaveDoc(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium">📄 Document</button>' : '')
        + '<button onclick="approveLeave(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium">Approve</button>'
        + '<button onclick="rejectLeave(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium">Reject</button>'
        + '</div></div>'
    } else if (tab === 'cancellations') {
      return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
        + '<div class="flex items-start justify-between">'
        + '<div><p class="text-xs text-blue-600 font-medium">Cancel ' + l.type + ' Leave</p>'
        + '<p class="text-xs text-gray-400 mt-1">Request ID: <span class="font-mono text-gray-600">' + id + '</span></p>'
        + '<p class="text-xs text-gray-500 mt-1">Leave Date: <strong>' + toDisplayDate(leaveDate) + '</strong></p>'
        + '<p class="text-xs text-gray-500">Original Status: <span class="text-green-600 font-medium">Approved</span></p>'
        + (l.cancellation_reason || l.cancellationReason ? '<p class="text-xs text-red-400 mt-1">Cancellation Reason: ' + (l.cancellation_reason || l.cancellationReason) + '</p>' : '')
        + '</div></div>'
        + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
        + (hasDocAppr ? '<button onclick="viewLeaveDoc(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium">📄 Document</button>' : '')
        + '<button onclick="approveCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium">Approve Cancellation</button>'
        + '<button onclick="rejectCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium">Reject</button>'
        + '</div></div>'
    }
    return ''
  }).join('')

  list.innerHTML = html
  if (_mgrSelectedEmpId) {
    sessionStorage.setItem('mgrViewState', JSON.stringify({ tab: 'approvals', empId: _mgrSelectedEmpId, empApprovalTab: window._mgrEmpApprovalTab || 'pending' }))
  }
}

let _empHistPage = 0
const EMP_HIST_PAGE_SIZE = 10

function renderHistFilters() {
  const filters = window._empHistoryFilters || { search: '', type: '', status: '', month: '', year: '' }
  let html = '<div class="flex flex-wrap gap-2 mb-3">'
  html += '<input id="empHistSearch" placeholder="Search by ID or date..." value="' + (filters.search || '') + '" oninput="applyHistFilterDebounced()" class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none flex-1 min-w-[150px]">'
  html += '<select id="empHistTypeFilter" onchange="applyHistFilterNow()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Types</option>'
  ;['casual', 'sick', 'business', 'emergency', 'family', 'unpaid'].forEach(t => {
    html += '<option value="' + t + '" ' + (filters.type === t ? 'selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistStatusFilter" onchange="applyHistFilterNow()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Status</option>'
  ;['approved', 'rejected', 'pending', 'cancellation_requested'].forEach(s => {
    const label = s === 'approved' ? 'Approved' : s === 'cancellation_requested' ? 'Cancellation Pending' : s.charAt(0).toUpperCase() + s.slice(1)
    html += '<option value="' + s + '" ' + (filters.status === s ? 'selected' : '') + '>' + label + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistMonthFilter" onchange="applyHistFilterNow()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Months</option>'
  ;['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach((m,i)=>{
    html += '<option value="' + (i+1) + '" ' + (filters.month === String(i+1) ? 'selected' : '') + '>' + m + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistYearFilter" onchange="applyHistFilterNow()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Years</option>'
  ;['2024','2025','2026','2027'].forEach(y => {
    html += '<option value="' + y + '" ' + (filters.year === y ? 'selected' : '') + '>' + y + '</option>'
  })
  html += '</select>'
  html += '</div><div id="empHistTable"></div>'
  document.getElementById('empApprovalList').innerHTML = html
}

function renderHistTable() {
  const data = window._empApprovalData || {}
  const history = data.history || []
  const filters = window._empHistoryFilters || { search: '', type: '', status: '', month: '', year: '' }

  let filtered = [...history]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(l => (l.id || '').toLowerCase().includes(q) || (l.start_date || l.startDate || '').includes(q) || (l.applied_on || '').includes(q))
  }
  if (filters.type) filtered = filtered.filter(l => (l.type || '').toLowerCase() === filters.type)
  if (filters.status) {
    if (filters.status === 'approved') {
      filtered = filtered.filter(l => { const s = (l.status || '').toLowerCase(); return s === 'approved' || s === 'auto-approved' })
    } else {
      filtered = filtered.filter(l => (l.status || '').toLowerCase() === filters.status)
    }
  }
  if (filters.month) filtered = filtered.filter(l => { const p = getLeaveDateParts(l); return p.month === parseInt(filters.month) })
  if (filters.year) filtered = filtered.filter(l => { const p = getLeaveDateParts(l); return p.year === parseInt(filters.year) })

  const totalPages = Math.ceil(filtered.length / EMP_HIST_PAGE_SIZE)
  if (_empHistPage >= totalPages) _empHistPage = Math.max(0, totalPages - 1)
  if (_empHistPage < 0) _empHistPage = 0
  const start = _empHistPage * EMP_HIST_PAGE_SIZE
  const pageItems = filtered.slice(start, start + EMP_HIST_PAGE_SIZE)

  let html = ''
  if (pageItems.length === 0) {
    html = '<p class="text-gray-400 text-sm text-center py-6">No matching records</p>'
  } else {
    html += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="border-b border-gray-200 text-gray-500"><th class="text-left py-2 px-2">Request ID</th><th class="text-left py-2 px-2">Applied On</th><th class="text-left py-2 px-2">Type</th><th class="text-left py-2 px-2">Leave Date</th><th class="text-left py-2 px-2">Reason</th><th class="text-left py-2 px-2">Status</th><th class="text-left py-2 px-2">Document</th></tr></thead><tbody>'
    pageItems.forEach(l => {
      const s = (l.status || '').toLowerCase()
      let statLabel, statColor, statIcon
      if (s === 'approved' || s === 'auto-approved') { statLabel = 'Approved'; statColor = 'bg-green-100 text-green-700'; statIcon = '✅' }
      else if (s === 'rejected') { statLabel = 'Rejected'; statColor = 'bg-red-100 text-red-700'; statIcon = '❌' }
      else if (s === 'pending') { statLabel = 'Pending'; statColor = 'bg-yellow-100 text-yellow-700'; statIcon = '⏳' }
      else if (s === 'cancellation_requested') { statLabel = 'Cancellation Pending'; statColor = 'bg-blue-100 text-blue-700'; statIcon = '🔶' }
      else { statLabel = s; statColor = 'bg-gray-100 text-gray-600'; statIcon = '📋' }
      const ld = l.startDate || l.start_date || ''
      const ao = l.applied_on || ''
      const ad = ao ? ao.split(' ')[0] : ao
      const at = ao ? ao.split(' ')[1] || '' : ''
      const reason = l.reason || '—'
      const cancelTitle = s === 'cancellation_requested' ? (l.cancellation_reason||'').replace(/"/g,'&quot;') : ''
      const rejectTitle = s === 'rejected' ? (l.rejection_reason||'').replace(/"/g,'&quot;') : ''
      const hasDoc = l.document || l.attachment
      html += '<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="py-2 px-2 font-mono">' + l.id + '</td><td class="py-2 px-2 whitespace-nowrap">' + toDisplayDate(ad) + '<br><span class="text-gray-400">' + at + '</span></td><td class="py-2 px-2 capitalize">' + l.type + '</td><td class="py-2 px-2">' + toDisplayDate(ld) + '</td><td class="py-2 px-2 text-gray-500 max-w-[120px] truncate">' + reason + '</td><td class="py-2 px-2"><span class="text-xs px-2 py-0.5 rounded-full font-medium ' + statColor + '"' + (cancelTitle ? ' title="' + cancelTitle + '"' : '') + (rejectTitle ? ' title="' + rejectTitle + '"' : '') + '>' + statIcon + ' ' + statLabel + '</span></td><td class="py-2 px-2">' + (hasDoc ? '<button onclick="viewLeaveDoc(\'' + l.id + '\')" class="text-blue-600 hover:text-blue-800">📄 View</button>' : '—') + '</td></tr>'
    })
    html += '</tbody></table></div>'
    if (totalPages > 1) {
      html += '<div class="flex items-center justify-between mt-3">'
      html += '<button onclick="empHistPrevPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"' + (_empHistPage <= 0 ? ' disabled style="opacity:0.4;cursor:not-allowed"' : '') + '>◀ Back 10</button>'
      html += '<span class="text-sm text-gray-500">Page ' + (_empHistPage + 1) + ' / ' + totalPages + '</span>'
      html += '<button onclick="empHistNextPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"' + (_empHistPage >= totalPages - 1 ? ' disabled style="opacity:0.4;cursor:not-allowed"' : '') + '>Next 10 ▶</button>'
      html += '</div>'
    }
  }
  document.getElementById('empHistTable').innerHTML = html
}

function renderEmpHistory() {
  _empHistPage = 0
  renderHistFilters()
  renderHistTable()
}

let _histFilterTimer = null
window.applyHistFilterNow = function () {
  if (_histFilterTimer) { clearTimeout(_histFilterTimer); _histFilterTimer = null }
  _empHistPage = 0
  window._empHistoryFilters = {
    search: document.getElementById('empHistSearch')?.value || '',
    type: document.getElementById('empHistTypeFilter')?.value || '',
    status: document.getElementById('empHistStatusFilter')?.value || '',
    month: document.getElementById('empHistMonthFilter')?.value || '',
    year: document.getElementById('empHistYearFilter')?.value || '',
  }
  renderHistTable()
}
window.applyHistFilterDebounced = function () {
  if (_histFilterTimer) clearTimeout(_histFilterTimer)
  _histFilterTimer = setTimeout(function() { window.applyHistFilterNow() }, 300)
}

window.empHistPrevPage = function () {
  if (_empHistPage > 0) { _empHistPage--; renderHistTable() }
}
window.empHistNextPage = function () {
  const total = ((window._empApprovalData || {}).history || []).length
  if ((_empHistPage + 1) * EMP_HIST_PAGE_SIZE < total) { _empHistPage++; renderHistTable() }
}

// --- HR leave history pagination (module-level, matches employee pattern) ---
let _hrLeavePage = 0
const HR_LEAVE_PAGE_SIZE = 10
let _hrLeaveData = []

function renderHrLeaveHistory(data) {
  _hrLeaveData = data || []
  const leaves = _hrLeaveData
  const q = (document.getElementById('hrLeaveSearch')?.value || '').toLowerCase()
  const typeFilter = (document.getElementById('hrLeaveTypeFilter')?.value || '').toLowerCase()
  const statusFilter = (document.getElementById('hrLeaveStatusFilter')?.value || '').toLowerCase()
  const monthF = document.getElementById('hrLeaveMonthFilter')?.value || ''
  const yearF = document.getElementById('hrLeaveYearFilter')?.value || ''
  const filtered = leaves.filter(l => {
    if (!q && !typeFilter && !statusFilter && !monthF && !yearF) return true
    const leaveDate = (l.startDate || l.start_date || '').toLowerCase()
    const lid = (l.id || '').toLowerCase()
    const type = (l.type || '').toLowerCase()
    const status = (l.status || '').toLowerCase()
    const matchQ = !q || lid.includes(q) || leaveDate.includes(q)
    const matchType = !typeFilter || type === typeFilter
    const matchStatus = !statusFilter || status === statusFilter
    const p = getLeaveDateParts(l)
    const matchMonth = !monthF || p.month === parseInt(monthF)
    const matchYear = !yearF || p.year === parseInt(yearF)
    return matchQ && matchType && matchStatus && matchMonth && matchYear
  })
  const sorted = [...filtered].sort((a, b) => ((b.applied_on || '') > (a.applied_on || '') ? 1 : -1))
  const totalPages = Math.ceil(sorted.length / HR_LEAVE_PAGE_SIZE)
  if (_hrLeavePage >= totalPages) _hrLeavePage = Math.max(0, totalPages - 1)
  if (_hrLeavePage < 0) _hrLeavePage = 0
  const start = _hrLeavePage * HR_LEAVE_PAGE_SIZE
  const pageItems = sorted.slice(start, start + HR_LEAVE_PAGE_SIZE)
  const tb = document.getElementById('empLeaveHistoryBody')
  const empEmpty = document.getElementById('empLeaveHistoryEmpty')
  const pagination = document.getElementById('hrLeavePagination')
  if (pageItems.length === 0) {
    tb.innerHTML = ''
    if (empEmpty) empEmpty.classList.remove('hidden')
    if (pagination) pagination.classList.add('hidden')
  } else {
    if (empEmpty) empEmpty.classList.add('hidden')
    tb.innerHTML = pageItems.map(l => {
      const status = (l.status || l.Status || '').toLowerCase()
      const isApproved = status === 'approved' || status === 'auto-approved'
      const isCancellationReq = status === 'cancellation_requested'
      const isRejected = status === 'rejected'
      const isPending = status === 'pending'
      let statLabel, statColor, statIcon
      if (isPending) { statLabel = 'Pending'; statColor = 'bg-yellow-100 text-yellow-700'; statIcon = '⏳' }
      else if (isApproved) { statLabel = 'Approved'; statColor = 'bg-green-100 text-green-700'; statIcon = '✅' }
      else if (isCancellationReq) { statLabel = 'Cancellation Pending'; statColor = 'bg-blue-100 text-blue-700'; statIcon = '🔶' }
      else if (isRejected) { statLabel = 'Rejected'; statColor = 'bg-red-100 text-red-700'; statIcon = '❌' }
      else { statLabel = status; statColor = 'bg-gray-100 text-gray-600'; statIcon = '📋' }
      const hasDoc = l.document || l.attachment
      const appliedOn = l.applied_on || ''
      const appliedDate = appliedOn.split(' ')[0] || appliedOn
      const appliedTime = appliedOn.split(' ')[1] || ''
      const cancelTitle = isCancellationReq ? (l.cancellation_reason||'').replace(/"/g,'&quot;') : ''
      const rejectTitle = isRejected ? (l.rejection_reason||'').replace(/"/g,'&quot;') : ''
      return `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="px-3 py-2 font-mono text-xs text-gray-600">${l.id}</td><td class="px-3 py-2 text-sm whitespace-nowrap">${toDisplayDate(appliedDate)}<br><span class="text-xs text-gray-400">${appliedTime}</span></td><td class="px-3 py-2 text-sm capitalize">${l.type||'Leave'}</td><td class="px-3 py-2 text-sm">${toDisplayDate(l.startDate||l.start_date)}</td><td class="px-3 py-2 text-sm text-gray-500 max-w-[100px] truncate" title="${(l.reason||'').replace(/"/g,'&quot;')}">${l.reason||'—'}</td><td class="px-3 py-2"><span class="text-xs px-2 py-0.5 rounded-full font-medium ${statColor}"${cancelTitle ? ` title="${cancelTitle}"` : rejectTitle ? ` title="${rejectTitle}"` : ''}>${statIcon} ${statLabel}</span></td><td class="px-3 py-2 text-xs">${hasDoc ? `<button onclick="viewLeaveDoc('${l.id}')" class="text-blue-600 hover:text-blue-800">📄 View</button>` : '—'}</td></tr>`
    }).join('')
    if (pagination) {
      if (totalPages > 1) {
        pagination.classList.remove('hidden')
        pagination.innerHTML = '<button onclick="window.hrLeavePrevPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"' + (_hrLeavePage <= 0 ? ' disabled style="opacity:0.4;cursor:not-allowed"' : '') + '>◀ Back 10</button><span class="text-sm text-gray-500">Page ' + (_hrLeavePage + 1) + ' of ' + totalPages + ' (' + sorted.length + ' total)</span><button onclick="window.hrLeaveNextPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"' + (_hrLeavePage >= totalPages - 1 ? ' disabled style="opacity:0.4;cursor:not-allowed"' : '') + '>Next 10 ▶</button>'
      } else {
        pagination.classList.add('hidden')
      }
    }
  }
}

window.applyHrLeaveFilter = function () {
  _hrLeavePage = 0
  renderHrLeaveHistory(_hrLeaveData)
}

window.hrLeavePrevPage = function () {
  if (_hrLeavePage > 0) { _hrLeavePage--; renderHrLeaveHistory(_hrLeaveData) }
}
window.hrLeaveNextPage = function () {
  const total = (_hrLeaveData || []).length
  if ((_hrLeavePage + 1) * HR_LEAVE_PAGE_SIZE < total) { _hrLeavePage++; renderHrLeaveHistory(_hrLeaveData) }
}

window.switchMgrTab = function (tab) {
  const tabs = ['dashboard', 'approvals']
  tabs.forEach(t => {
    const el = document.getElementById('mgrTab' + t.charAt(0).toUpperCase() + t.slice(1))
    if (el) el.className = 'flex-1 px-4 py-3 text-sm font-medium ' + (t === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')
  })
  // Hide employee view if shown
  document.getElementById('mgrEmployeeView').classList.add('hidden')
  _mgrSelectedEmpId = null
  // Show/hide tab content
  document.getElementById('mgrDashboardContent').classList.toggle('hidden', tab !== 'dashboard')
  document.getElementById('mgrApprovalsContent').classList.toggle('hidden', tab !== 'approvals')
  if (tab === 'approvals') {
    loadTeamApprovalsList()
  }
  if (tab === 'dashboard') {
    loadManagerDashboard()
  }
  sessionStorage.setItem('mgrViewState', JSON.stringify({ tab, empId: null }))
}

window.loadTeamApprovalsList = async function () {
  const container = document.getElementById('mgrApprovalsList')
  container.innerHTML = '<div class="text-gray-400 text-sm text-center py-8">Loading...</div>'
  try {
    const u = getUser()
    if (!u) return
    if (!_mgrEmployees || _mgrEmployees.length === 0) {
      const res = await apiGet('/employees')
      _mgrEmployees = res || []
    }
    // Get pending and cancellation counts
    const pendingMap = {}, cancelMap = {}
    try {
      const pres = await apiGet('/leaves/pending/' + u.id)
      if (Array.isArray(pres)) {
        pres.forEach(l => { const eid = l.employeeId || l.employee_id || l.empId; if (eid) pendingMap[eid] = (pendingMap[eid] || 0) + 1 })
      }
    } catch (e) { /* ignore */ }
    try {
      const cres = await apiGet('/leaves/cancellations/' + u.id)
      if (Array.isArray(cres)) {
        cres.forEach(l => { const eid = l.employeeId || l.employee_id || l.empId; if (eid) cancelMap[eid] = (cancelMap[eid] || 0) + 1 })
      }
    } catch (e) { /* ignore */ }
    const sortedEmps = [..._mgrEmployees].sort((a, b) => {
      const pa = (pendingMap[a.id] || 0) + (cancelMap[a.id] || 0)
      const pb = (pendingMap[b.id] || 0) + (cancelMap[b.id] || 0)
      return pb - pa || (a.name || '').localeCompare(b.name || '')
    })
    const desigColors = {
      'software engineer':'bg-blue-100 text-blue-700','senior software engineer':'bg-indigo-100 text-indigo-700',
      'tech lead':'bg-purple-100 text-purple-700','manager':'bg-orange-100 text-orange-700',
      'ai ml engineer':'bg-cyan-100 text-cyan-700','data scientist':'bg-teal-100 text-teal-700',
      'devops engineer':'bg-rose-100 text-rose-700','qa engineer':'bg-lime-100 text-lime-700',
      'product manager':'bg-amber-100 text-amber-700','ui/ux designer':'bg-pink-100 text-pink-700',
      'business analyst':'bg-violet-100 text-violet-700','intern':'bg-gray-100 text-gray-700',
    }
    const defaultColor = 'bg-gray-100 text-gray-700'
    container.innerHTML = sortedEmps.map(e => {
      const pCount = pendingMap[e.id] || 0
      const cCount = cancelMap[e.id] || 0
      const total = pCount + cCount
      const badges = []
      if (pCount > 0) badges.push(`<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">⏳ ${pCount} Pending</span>`)
      if (cCount > 0) badges.push(`<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">🔶 ${cCount} Cancellation</span>`)
      const badgeHtml = badges.length ? `<span class="flex items-center gap-1">${badges.join(' ')}</span>` : ''
      const desig = (e.designation||'').toLowerCase()
      const dColor = Object.keys(desigColors).reduce((acc,key)=> desig.includes(key) ? desigColors[key] : acc, defaultColor)
      return `<div onclick="openEmployeeView('${e.id}')" class="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-blue-200 cursor-pointer">
        <div class="flex items-center justify-between mb-1">
          <p class="font-semibold text-sm text-gray-800">${e.name}</p>
          <div class="flex items-center gap-2">${badgeHtml}${total > 0 ? `<span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Total: ${total}</span>` : ''}</div>
        </div>
        <p class="text-xs text-gray-500">${e.email || '—'}${e.projectTag ? ` <span class="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">🏷️ ${e.projectTag}</span>` : ''}</p>
        <p class="text-xs text-gray-500 mt-1">ID: ${e.id}</p>
        <p class="text-xs mt-0.5"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${dColor}">${e.designation||'—'}</span></p>
        <p class="text-xs text-gray-500 mt-1">DOJ: ${toDisplayDate(e.doj)}</p>
        <p class="text-xs text-gray-500">⚤ ${e.gender || '—'}</p>
      </div>`
    }).join('')
  } catch (e) {
    container.innerHTML = '<div class="text-red-500 text-sm text-center">Error loading team</div>'
  }
}

// Keep old approval tab switching for the separate approvals tab
window.switchApprovalTab = function (tab) {
  const tabs = ['pending', 'cancellations', 'history']
  tabs.forEach(t => {
    const el = document.getElementById('approvalTab' + t.charAt(0).toUpperCase() + t.slice(1))
    if (el) el.className = 'px-3 py-1.5 rounded-full font-medium text-sm ' + (t === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100')
  })
  const data = window._approvalData || { pending: [], cancellations: [], history: [] }
  const items = data[tab] || []
  const list = document.getElementById('approvalList')
  if (items.length === 0) { list.innerHTML = '<p class="text-gray-400 text-sm">No records</p>'; return }
  list.innerHTML = items.map(l => {
    const id = l.id
    const status = l.status || l.Status
    const leaveDate = l.startDate || l.start_date || ''
    const reason = l.reason || ''
    return `<div class="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between"><div><p class="text-sm font-medium">${l.type} Leave</p><p class="text-xs text-gray-500">${toDisplayDate(leaveDate)}</p><p class="text-xs text-gray-400">${reason}</p>${l.cancellation_reason||l.cancellationReason?'<p class="text-xs text-red-400 mt-1">Cancel reason: '+(l.cancellation_reason||l.cancellationReason)+'</p>':''}</div><div class="flex gap-2">${tab==='pending'?`<button onclick="approveLeave('${id}')" class="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200">Approve</button><button onclick="rejectLeave('${id}')" class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200">Reject</button>`:tab==='cancellations'?`<button onclick="approveCancellation('${id}')" class="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200">Accept</button><button onclick="rejectCancellation('${id}')" class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200">Reject</button>`:`<span class="text-xs px-2 py-1 rounded-full font-medium ${status==='approved'||status==='auto-approved'?'bg-green-100 text-green-700':status==='rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}">${status}</span>`}</div></div>`
  }).join('')
}

window.approveLeave = async function (id) {
  try { await apiPost('/leaves/approve', { leaveId: id }); refreshAfterAction() } catch (e) { alert(e.message) }
}
window.rejectLeave = async function (id) {
  const reason = prompt('Rejection reason (required):')
  if (reason === null) return
  try { await apiPost('/leaves/reject', { leaveId: id, reason: reason || '' }); refreshAfterAction() } catch (e) { alert(e.message) }
}
window.approveCancellation = async function (id) {
  try { await apiPost('/leaves/approve-cancellation', { leaveId: id }); refreshAfterAction() } catch (e) { alert(e.message) }
}
window.rejectCancellation = async function (id) {
  const reason = prompt('Rejection reason (required):')
  if (reason === null) return
  try { await apiPost('/leaves/reject-cancellation', { leaveId: id, reason: reason || '' }); refreshAfterAction() } catch (e) { alert(e.message) }
}

function refreshAfterAction() {
  if (_mgrSelectedEmpId) {
    loadEmpApprovals(_mgrSelectedEmpId)
    // Refresh employee balance & header in detail view
    apiGet('/employees/' + _mgrSelectedEmpId).then(emp => {
      if (!emp) return
      const lb = emp.leaveBalance || {}
      const docBtnDetail = emp.hasDocument ? `<button onclick="viewDocument('${emp.id}')" class="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">📄 View</button>` : ''
      document.getElementById('empDetailHeader').innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-lg font-bold text-gray-800">${emp.name}</p>
            <p class="text-xs text-gray-500">${emp.id} · ${emp.designation || '—'}${emp.gender ? ' · ⚤ ' + emp.gender : ''}${emp.projectTag ? ' · 🏷️ ' + emp.projectTag : ''}</p>
          </div>
          ${docBtnDetail}
        </div>`
      const balanceTypes = [
        { key: 'casual', label: 'Casual', color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
        { key: 'sick', label: 'Sick', color: 'bg-green-50 border-green-200', text: 'text-green-700' },
        { key: 'business', label: 'Business', color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
        { key: 'emergency', label: 'Emergency', color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
        { key: 'family', label: 'Family', color: 'bg-pink-50 border-pink-200', text: 'text-pink-700' },
      ]
      document.getElementById('empBalanceCards').innerHTML = balanceTypes.map(t => {
        const b = lb[t.key] || {}
        const rem = b.remaining || 0
        const lim = b.limit || 0
        return `<div class="${t.color} rounded-xl p-4 border"><p class="text-xs font-medium ${t.text}">${t.label}</p><p class="text-lg font-bold text-gray-800 mt-1">${rem}<span class="text-sm font-normal text-gray-400">/${lim}</span></p></div>`
      }).join('')
    })
  }
  loadManagerDashboard()
}

// Manager tag management
window.editTagMgr = function (empId, currentTag) {
  const div = document.getElementById('mgrTagInput' + empId)
  if (!div.classList.contains('hidden')) { div.classList.add('hidden'); return }
  div.classList.remove('hidden')
  div.innerHTML = '<input type="text" id="mgrTagField' + empId + '" placeholder="Enter project name..." class="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" value="' + currentTag + '"><button onclick="saveTagMgr(\'' + empId + '\')" class="w-full mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Tag</button>'
  document.getElementById('mgrTagField' + empId).focus()
}

window.saveTagMgr = async function (empId) {
  const input = document.getElementById('mgrTagField' + empId)
  const tag = input.value.trim()
  try {
    await apiPut('/employees/' + empId + '/project-tag', { projectTag: tag || null })
    loadManagerDashboard()
  } catch (e) { alert('Error: ' + e.message) }
}

window.untagEmployeeMgr = async function (empId) {
  try {
    await apiPut('/employees/' + empId + '/project-tag', { projectTag: null })
    loadManagerDashboard()
  } catch (e) { alert('Error: ' + e.message) }
}
