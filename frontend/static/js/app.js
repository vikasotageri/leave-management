// ===== Page Initialization (entry point) =====
// Dependencies: all above files
document.addEventListener('DOMContentLoaded',async function(){
  const path=window.location.pathname
  if(!isAuthenticated()) return
  initNavbar()
  if(path==='/hr'){
    loadEmployeeList()
    try {
      const savedEmpId = sessionStorage.getItem('hrSelectedEmpId')
      if (savedEmpId) {
        selectEmployee(savedEmpId)
      }
    } catch(e) { console.error('Restore hr state:', e) }
  }
  if(path==='/employee') loadEmployeeDashboard()
  if(path==='/manager'){
    await loadManagerDashboard()
    // Auto-refresh every 6s — updates whichever view is currently visible
    let _mgrRefreshing = false
    setInterval(async () => {
      if (_mgrRefreshing || window._aiProcessing) return
      _mgrRefreshing = true
      try {
        await loadManagerDashboard()
        if (_mgrSelectedEmpId) {
          refreshEmpDetailHeader()
          loadEmpApprovals(_mgrSelectedEmpId, true).catch(() => {})
        }
        const approvalsContent = document.getElementById('mgrApprovalsContent')
        if (approvalsContent && !approvalsContent.classList.contains('hidden')) {
          loadTeamApprovalsList().catch(() => {})
        }
      } catch (e) { console.error('Auto-refresh error:', e) }
      _mgrRefreshing = false
    }, 6000)
    try {
      const raw = sessionStorage.getItem('mgrViewState')
      if (raw) {
        const state = JSON.parse(raw)
        if (state.empId && state.tab === 'approvals') {
          // Re-open employee detail view
          const empSel = document.getElementById('mgrEmployeeSelect')
          if (empSel) empSel.value = state.empId
          // Need to ensure _mgrEmployees is populated before openEmployeeView
          if (_mgrEmployees && _mgrEmployees.find(e => e.id === state.empId)) {
            switchMgrTab('approvals')
            await openEmployeeView(state.empId)
            if (state.empApprovalTab && state.empApprovalTab !== 'pending') {
              switchEmpApprovalTab(state.empApprovalTab)
            }
          } else {
            switchMgrTab('approvals')
          }
        } else if (state.tab === 'approvals') {
          switchMgrTab('approvals')
        }
      }
    } catch(e) { console.error('Restore mgr state:', e) }
  }
})

// ===== Set project tag =====
window.setProjectTag=async function(empId){
  const tag=prompt('Enter project tag:')
  if(tag) try{await apiPost('/employees',{employee_id:empId,project_tag:tag});alert('Project tag updated')}catch(e){alert(e.message)}
}
