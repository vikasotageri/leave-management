// ===== Auth =====
function getToken(){return sessionStorage.getItem('token')}
function getUser(){try{return JSON.parse(sessionStorage.getItem('user'))}catch{return null}}
function isAuthenticated(){return !!getToken()}

window.pickDate=function(displayId,pickerId){
  const picker=document.getElementById(pickerId)
  if(!picker) return
  picker.value=''
  picker.style.visibility='visible'
  picker.style.position='fixed'
  picker.style.left='0'
  picker.style.top='0'
  picker.style.opacity='0.01'
  picker.style.pointerEvents='none'
  const handler=function(){
    if(picker.value){
      document.getElementById(displayId).value=picker.value.split('-').reverse().join('-')
    }
    picker.style.visibility='hidden'
    picker.style.left='-9999px'
    picker.removeEventListener('change',handler)
    picker.removeEventListener('blur',handler)
  }
  picker.addEventListener('change',handler)
  picker.addEventListener('blur',handler)
  setTimeout(()=>{
    try{picker.showPicker()}catch(e){console.warn('showPicker failed',e)}
  },50)
}

function apiRequest(method, path, body){
  const opts={method,headers:{'Content-Type':'application/json'}}
  if(body) opts.body=JSON.stringify(body)
  const t=getToken()
  if(t) opts.headers['Authorization']='Bearer '+t
  return fetch('/api'+path, opts).then(async r=>{
    const d=await r.json()
    if(!r.ok) throw new Error(d.detail||'Request failed')
    return d
  })
}

function apiGet(path){return apiRequest('GET',path)}
function apiPost(path,body){return apiRequest('POST',path,body)}
function apiDelete(path){return apiRequest('DELETE',path)}
function apiPut(path,body){return apiRequest('PUT',path,body)}

// ===== Navigation =====
function loadPage(url){
  if(!isAuthenticated()&&url!=='/employee/login'){window.location.href='/employee/login';return}
  window.location.href=url
}

function logout(){
  const u=getUser()
  const role=(u&&u.role)||'employee'
  const loginPages={hr:'/hr/login',manager:'/manager/login',employee:'/employee/login'}
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
  window.location.href=loginPages[role]||'/employee/login'
}

// ===== Clock =====
function updateClock(){
  const now=new Date()
  const timeEl=document.getElementById('clockDisplay')
  const dateEl=document.getElementById('dateDisplay')
  if(timeEl) timeEl.textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
  if(dateEl) dateEl.textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})
}
setInterval(updateClock,1000)
updateClock()

// ===== Notifications =====
async function loadNotifications(){
  const u=getUser()
  if(!u) return
  try{
    const notifs=await apiGet('/notifications/'+u.id)
    const unread=notifs.filter(n=>!n.read)
    const badge=document.getElementById('notifBadge')
    if(badge){
      if(unread.length>0){badge.textContent=unread.length;badge.classList.remove('hidden')}
      else badge.classList.add('hidden')
    }
    const dd=document.getElementById('notifDropdown')
    if(dd){
      if(notifs.length===0) dd.innerHTML='<div class="p-4 text-sm text-gray-400 text-center">No notifications</div>'
      else dd.innerHTML=`
        <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 sticky top-0">
          <span class="text-sm font-semibold text-gray-700">Notifications</span>
          <button onclick="clearAllNotifs()" class="text-xs text-red-600 hover:text-red-800 font-medium">🗑️ Clear All</button>
        </div>
        ${notifs.slice(0,10).map(n=>`
          <div class="px-4 py-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer text-sm flex items-start gap-2 transition ${n.read?'':'bg-blue-50 font-medium'}" onclick="markNotifRead('${n.id}')">
            <span class="mt-0.5 ${n.read?'opacity-30':'opacity-100'}">${n.type==='employee_created'?'🎉':n.type==='account_created'?'👋':n.type==='leave_approved'||n.message?.includes('Approval')?'✅':'📌'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-gray-800 truncate">${n.title}</p>
              <p class="text-gray-500 text-xs mt-0.5 truncate">${n.message?.substring(0,80)||''}</p>
            </div>
            ${!n.read?'<span class="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>':''}
          </div>
        `).join('')}
      `
    }
  }catch(e){console.error('Notif error:',e)}
}

window.markNotifRead=async function(id){
  try{
    await apiPut('/notifications/'+id+'/read',{})
    loadNotifications()
  }catch(e){console.error('Error marking read:',e)}
}

window.clearAllNotifs=async function(){
  const u=getUser()
  if(!u) return
  if(!confirm('Clear all notifications?')) return
  try{
    await apiDelete('/notifications/'+u.id+'/clear-all')
    loadNotifications()
  }catch(e){console.error('Error clearing all:',e)}
}

// Poll notifications every 30 seconds
setInterval(() => {
  if(isAuthenticated()) loadNotifications()
}, 30000)

document.addEventListener('click',function(e){
  const bell=document.getElementById('notificationBell')
  const dd=document.getElementById('notifDropdown')
  if(!bell||!dd) return
  if(bell.contains(e.target)){
    dd.classList.toggle('hidden')
    if(!dd.classList.contains('hidden')) loadNotifications()
  } else if(!dd.contains(e.target)) dd.classList.add('hidden')
})

function initNavbar(){
  const u=getUser()
  const nav=document.getElementById('navbar')
  const navLinks=document.getElementById('navLinks')
  const userDisplay=document.getElementById('userDisplay')
  if(!u||!nav){document.title='Login - LeaveFlow';return}
  nav.classList.remove('hidden')
  const links={
    hr:[{href:'/hr',label:'👥 Employees'}],
    manager:[],
    employee:[{href:'/employee',label:'🏠 Dashboard'}]
  }
  if(navLinks){
    const roleLinks=links[u.role]||[]
    navLinks.innerHTML=roleLinks.map(l=>`<a href="${l.href}" class="hover:text-blue-600 ${window.location.pathname===l.href?'text-blue-600':''}">${l.label}</a>`).join('')
  }
  if(userDisplay) userDisplay.textContent=u.name+' ('+u.id+')'
  document.title=u.role.charAt(0).toUpperCase()+u.role.slice(1)+' - LeaveFlow'
  loadNotifications()
  if(u.role==='hr'&&window.location.pathname==='/hr') loadEmployeeList()
}

// ===== Auth guard (runs on every page load, including bfcache back-navigation) =====
(function guard(){
  const path=window.location.pathname
  const pub=['/employee/login','/manager/login','/hr/login']
  if(!isAuthenticated()&&!pub.includes(path)){
    if (path.startsWith('/employee')) window.location.href='/employee/login'
    else if (path.startsWith('/manager')) window.location.href='/manager/login'
    else if (path.startsWith('/hr')) window.location.href='/hr/login'
    return
  }
  if(isAuthenticated()&&pub.includes(path)){
    const u=getUser()
    if(u){
      const routes={hr:'/hr',manager:'/manager',employee:'/employee'}
      window.location.href=routes[u.role]||'/employee'
    }
  }
})()
// Also catch browser back-button bfcache restore
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    const path=window.location.pathname
    const pub=['/employee/login','/manager/login','/hr/login']
    if(!isAuthenticated()&&!pub.includes(path)){
      window.location.reload()
    }
  }
})

// ===== Chat helpers =====
function addChatMessage(containerId, text, isUser){
  const container=document.getElementById(containerId)
  if(!container) return
  const div=document.createElement('div')
  div.className='flex '+(isUser?'justify-end':'justify-start')
  div.innerHTML=`<div class="max-w-[80%] px-3 py-2 rounded-xl whitespace-pre-wrap ${isUser?'bg-blue-600 text-white rounded-br-sm':'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'}">${text}</div>`
  container.appendChild(div)
  container.scrollTop=container.scrollHeight
  // Save to localStorage for persistence
  saveChatHistory(containerId, text, isUser)
}

function saveChatHistory(containerId, text, isUser){
  try{
    const u=getUser()
    if(!u) return
    const key='chat_'+u.id+'_'+containerId
    let history=JSON.parse(localStorage.getItem(key)||'[]')
    history.push({text,isUser,ts:Date.now()})
    if(history.length>100) history=history.slice(-100)
    localStorage.setItem(key,JSON.stringify(history))
  }catch(e){}
}

function loadChatHistory(containerId){
  const container=document.getElementById(containerId)
  if(!container) return
  try{
    const u=getUser()
    if(!u) return
    const key='chat_'+u.id+'_'+containerId
    const history=JSON.parse(localStorage.getItem(key)||'[]')
    container.innerHTML=''
    history.forEach(h=>{
      const div=document.createElement('div')
      div.className='flex '+(h.isUser?'justify-end':'justify-start')
      div.innerHTML=`<div class="max-w-[80%] px-3 py-2 rounded-xl whitespace-pre-wrap ${h.isUser?'bg-blue-600 text-white rounded-br-sm':'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'}">${h.text}</div>`
      container.appendChild(div)
    })
    container.scrollTop=container.scrollHeight
  }catch(e){}
}

function clearChatHistory(containerId){
  try{
    const u=getUser()
    if(!u) return
    const key='chat_'+u.id+'_'+containerId
    localStorage.removeItem(key)
    const container=document.getElementById(containerId)
    if(container) container.innerHTML=''
  }catch(e){}
}

function addChatLoading(containerId){
  const container=document.getElementById(containerId)
  if(!container) return
  const div=document.createElement('div')
  div.id='chatLoading'
  div.className='flex justify-start'
  div.innerHTML='<div class="bg-white text-gray-500 border border-gray-200 px-3 py-2 rounded-xl rounded-bl-sm text-sm italic">Routing via LangGraph...</div>'
  container.appendChild(div)
  container.scrollTop=container.scrollHeight
}

function removeChatLoading(){
  const el=document.getElementById('chatLoading')
  if(el) el.remove()
}

async function sendChat(containerId, inputId, message){
  const u=getUser()
  if(!u) return
  const container=document.getElementById(containerId)
  const input=document.getElementById(inputId)
  if(!message){
    if(!input) return
    message=input.value.trim()
    if(!message) return
    input.value=''
  }
  addChatMessage(containerId, message, true)
  addChatLoading(containerId)
  try{
    // Send recent history from localStorage so AI has context even after page refresh
    const key='chat_'+u.id+'_'+containerId
    let history=[]
    try{ history=JSON.parse(localStorage.getItem(key)||'[]') }catch(e){}
    const recentMessages = history.slice(-10).map(h => ({role: h.isUser ? 'user' : 'assistant', content: h.text}))
    const res=await apiPost('/chat',{message,user_id:u.id,user_name:u.name,user_role:u.role,history:recentMessages})
    removeChatLoading()
    addChatMessage(containerId, res.response||'No response.', false)
    // Auto-refresh dashboards after AI action
    if (containerId === 'empChatMessages') {
      refreshEmployeeData(u.id)
    } else if (containerId === 'hrChatMessages' && selectedEmployeeId) {
      selectEmployee(selectedEmployeeId)
    } else if (containerId === 'mgrChatMessages' && _mgrSelectedEmpId) {
      loadEmpApprovals(_mgrSelectedEmpId)
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
      loadManagerDashboard()
    }
  }catch(e){
    removeChatLoading()
    addChatMessage(containerId, 'Error: '+e.message, false)
  }
}

// ===== Agent Indicator =====
function getAgentEmoji(agent){
  const map={employee:'👤',manager:'👔',hr:'👥',policy:'📋',scheduling:'📅',cancellation:'❌',analytics:'📊'}
  return map[agent?.toLowerCase()]||'🤖'
}

// ===== Login =====
document.addEventListener('DOMContentLoaded',function(){
  const form=document.getElementById('loginForm')
  if(!form) return initNavbar()
  form.addEventListener('submit',async function(e){
    e.preventDefault()
    const error=document.getElementById('loginError')
    error.classList.add('hidden')
    try{
      const res=await apiPost('/auth/login',{email:document.getElementById('email').value,password:document.getElementById('password').value})
      if(res.success&&res.token){
        sessionStorage.setItem('token',res.token)
        sessionStorage.setItem('user',JSON.stringify(res.user))
        const routes={hr:'/hr',manager:'/manager',employee:'/employee'}
        window.location.href=routes[res.user.role]||'/employee'
      }
    }catch(e){
      error.textContent=e.message
      error.classList.remove('hidden')
    }
  })

window.fillLogin = function(email, pass) {
  document.getElementById('email').value = email
  document.getElementById('password').value = pass
}
})

// ===== HR Dashboard =====
let selectedEmployeeId=null

async function loadEmployeeList(){
  const list=document.getElementById('employeeList')
  if(!list) return
  try{
    const emps=await apiGet('/employees')
    list.innerHTML=emps.map(e=>{
      const initial=(e.name||'?')[0].toUpperCase()
      const colors=['bg-blue-500','bg-emerald-500','bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-rose-500']
      const color=colors[e.name?e.name.charCodeAt(0)%colors.length:0]
      const searchData = (e.name||'').toLowerCase()+'|'+(e.id||'').toLowerCase()+'|'+(e.email||'').toLowerCase()
      return `<div data-search="${searchData}" onclick="selectEmployee('${e.id}')" class="p-3 rounded-xl cursor-pointer border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition ${selectedEmployeeId===e.id?'bg-blue-50 border-blue-300 ring-2 ring-blue-200':''}"><div class="flex items-center gap-3"><div class="w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">${initial}</div><div class="flex-1 min-w-0"><p class="font-semibold text-sm text-gray-800 truncate">${e.name}</p><p class="text-xs text-gray-500">${e.id} · ⚤ ${e.gender||'—'}</p><p class="text-xs text-gray-500">Designation: ${e.designation||'—'}${e.projectTag?' · 🏷️ '+e.projectTag:''}</p></div>${e.hasDocument?`<button onclick="event.stopPropagation();viewDocument('${e.id}')" class="text-xs shrink-0 hover:scale-110 transition" title="View document">📄</button>`:''}</div></div>`
    }).join('')
  }catch(e){list.innerHTML='<p class="text-sm text-red-500">Error loading employees</p>'}
}

window.filterEmployeeList=function(){
  const q=document.getElementById('empSearch')?.value.toLowerCase()||''
  document.querySelectorAll('#employeeList > div').forEach(el=>{
    el.style.display=el.getAttribute('data-search')&&el.getAttribute('data-search').includes(q)?'':'none'
  })
}

window.editProjectTagUi=async function(id){
  const tagInputDiv=document.getElementById('tagInput'+id)
  if(!tagInputDiv.classList.contains('hidden')){tagInputDiv.classList.add('hidden');return}
  tagInputDiv.classList.remove('hidden')
  const emp=tagInputDiv.getAttribute('data-current-tag')||''
  tagInputDiv.innerHTML='<input type="text" id="projectTagField'+id+'" placeholder="Enter project name..." class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" value="'+emp+'"> <button onclick="saveTag(\''+id+'\')" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">✓ Tag</button>'
  document.getElementById('projectTagField'+id).focus()
  document.getElementById('projectTagField'+id).setSelectionRange(emp.length,emp.length)
}

window.saveTag=async function(id){
  const input=document.getElementById('projectTagField'+id)
  const tag=input.value.trim()
  try{
    const res=await apiPut('/employees/'+id+'/project-tag',{projectTag:tag||null})
    if(res.success) selectEmployee(id)
  }catch(e){alert('Error: '+e.message)}
}

window.untagEmployee=async function(id){
  try{
    const res=await apiPut('/employees/'+id+'/project-tag',{projectTag:null})
    if(res.success) selectEmployee(id)
  }catch(e){alert('Error: '+e.message)}
}

window.tagEmployeeInline=function(id){
  editProjectTagUi(id)
}

window.selectEmployee=async function(id){
  selectedEmployeeId=id
  sessionStorage.setItem('hrSelectedEmpId', id)
  // Auto-refresh employee data every 15s to pick up changes (e.g. password reset)
  if (window._hrRefreshInterval) clearInterval(window._hrRefreshInterval)
  window._hrRefreshInterval = setInterval(() => {
    if (selectedEmployeeId) {
      apiGet('/employees/' + selectedEmployeeId).then(emp => {
        if (!emp) return
        // Update credentials section only
        const credSection = document.getElementById('empCredSection')
        if (credSection) {
          credSection.innerHTML = `
            <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Employee ID</p><p class="font-bold text-blue-600 mt-0.5">${emp.id}</p></div>
            <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Email</p><p class="font-semibold text-gray-800 mt-0.5 break-all">${emp.email}</p></div>
            <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Password</p><p class="font-mono font-bold text-yellow-700 mt-0.5">${emp.password||'—'}</p></div>
          `
        }
      }).catch(() => {})
    }
  }, 15000)
  loadEmployeeList()
  const profile=document.getElementById('employeeProfile')
  profile.innerHTML='<div class="text-center py-8"><p class="text-gray-400">Loading...</p></div>'
  try{
    const emp=await apiGet('/employees/'+id)
    const lb=emp.leaveBalance||{}
    profile.innerHTML=`
      <div class="flex items-start justify-between mb-8">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">${(emp.name||'?')[0].toUpperCase()}</div>
          <div>
            <h2 class="text-2xl font-bold text-gray-800">${emp.name}</h2>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-sm text-gray-500">${emp.id}</span>
              <span class="w-1 h-1 rounded-full bg-gray-300"></span>
              <span class="text-sm px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">${emp.designation||'—'}</span>
            </div>
          </div>
        </div>
        <button onclick="openDeleteModal('${emp.id}')" class="px-4 py-2 text-red-500 text-sm hover:bg-red-50 rounded-xl font-medium transition flex items-center gap-1.5">🗑 Delete</button>
      </div>
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">📧 Email</p><p class="text-sm font-semibold text-gray-800">${emp.email}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">📞 Phone</p><p class="text-sm font-semibold text-gray-800">${emp.phone||'—'}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">🎂 Date of Birth</p><p class="text-sm font-semibold text-gray-800">${toDisplayDate(emp.dob)}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">📅 Date of Joining</p><p class="text-sm font-semibold text-gray-800">${toDisplayDate(emp.doj)}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">🌍 Nationality</p><p class="text-sm font-semibold text-gray-800">${emp.nationality||'—'}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200"><p class="text-xs text-gray-500 mb-1">⚤ Gender</p><p class="text-sm font-semibold text-gray-800">${emp.gender||'—'}</p></div>
        ${emp.projectTag
          ? `<div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200" id="projectTagSection${emp.id}"><p class="text-xs text-gray-500 mb-1">🏷️ Project Tag</p><p class="text-sm font-semibold text-gray-800 flex items-center gap-2">🏷️ ${emp.projectTag} <button onclick="editProjectTagUi('${emp.id}')" class="text-blue-500 hover:text-blue-700 text-xs" title="Edit">✏️</button> <button onclick="untagEmployee('${emp.id}')" class="text-red-500 hover:text-red-700 text-xs" title="Remove tag">✕ Untag</button></p><div id="tagInput${emp.id}" class="hidden mt-2 flex gap-2" data-current-tag="${emp.projectTag}"></div></div>`
          : `<div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center"><button onclick="editProjectTagUi('${emp.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 transition">+ Add Project Tag</button><div id="tagInput${emp.id}" class="hidden mt-2 flex gap-2 w-full"></div></div>`}
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 col-span-2"><p class="text-xs text-gray-500 mb-1">📍 Address</p><p class="text-sm font-semibold text-gray-800">${emp.address||'—'}</p></div>
        <div class="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <p class="text-xs text-gray-500 mb-1">📄 Document</p>
          <div class="flex items-center gap-2 mt-1">
            ${emp.document?`<button onclick="viewDocument('${emp.id}')" class="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">📄 View</button><button onclick="replaceDocument('${emp.id}')" class="text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">🔄 Replace</button>`:`<button onclick="replaceDocument('${emp.id}')" class="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">📄 Upload</button>`}
          </div>
        </div>
      </div>
      <div class="mb-6 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-700">🔑 Credentials</h3>
          <button onclick="copyProfileCredentials('${emp.id}')" class="text-xs px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium transition" id="copyCredBtn${emp.id}">📋 Copy Credentials</button>
        </div>
        <div class="grid grid-cols-3 gap-3" id="empCredSection">
          <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Employee ID</p><p class="font-bold text-blue-600 mt-0.5">${emp.id}</p></div>
          <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Email</p><p class="font-semibold text-gray-800 mt-0.5 break-all">${emp.email}</p></div>
          <div class="p-3 bg-white rounded-xl border border-gray-200"><p class="text-xs text-gray-500">Password</p><p class="font-mono font-bold text-yellow-700 mt-0.5">${emp.password||'—'}</p></div>
        </div>
      </div>
      <div class="mb-6">
        <h3 class="font-semibold text-gray-700 mb-3">📊 Leave Balance</h3>
        <div class="grid grid-cols-5 gap-3">
          ${[['sick','Sick'],['casual','Casual'],['business','Business'],['emergency','Emergency/Personal'],['family','Family/Vacation']].map(([t,label])=>{
            const lt=lb[t]||{}
            const remaining=lt.remaining||0
            const limit=lt.limit||0
            const pct=limit>0?Math.round(((limit-remaining)/limit)*100):0
            return `<div class="p-3 bg-white rounded-xl border border-gray-200 text-center"><p class="text-xs text-gray-500 mb-2">${label}</p><div class="text-2xl font-bold ${remaining>0?'text-green-600':'text-red-500'}">${remaining}</div></div>`
          }).join('')}
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-700">📋 Leave History</h3>
        </div>
        <div class="flex gap-2 mb-2">
          <input id="hrLeaveSearch" oninput="renderHrLeaveHistory()" placeholder="🔍 Search by Request ID or Leave date..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400">
          <select id="hrLeaveTypeFilter" onchange="renderHrLeaveHistory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">All Types</option>
            <option value="casual">Casual</option>
            <option value="sick">Sick</option>
            <option value="emergency">Emergency</option>
            <option value="business">Business</option>
            <option value="family">Family</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select id="hrLeaveStatusFilter" onchange="renderHrLeaveHistory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="auto-approved">Auto-Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancellation_requested">Cancellation Pending</option>
          </select>
          <select id="hrLeaveMonthFilter" onchange="renderHrLeaveHistory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">All Months</option>
            <option value="1">Jan</option><option value="2">Feb</option><option value="3">Mar</option>
            <option value="4">Apr</option><option value="5">May</option><option value="6">Jun</option>
            <option value="7">Jul</option><option value="8">Aug</option><option value="9">Sep</option>
            <option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>
          </select>
          <select id="hrLeaveYearFilter" onchange="renderHrLeaveHistory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">All Years</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-xs text-gray-500 uppercase">
                <th class="px-3 py-2 text-left">Request ID</th>
                <th class="px-3 py-2 text-left">Applied On</th>
                <th class="px-3 py-2 text-left">Type</th>
                <th class="px-3 py-2 text-left">Leave on</th>
                <th class="px-3 py-2 text-left">Reason</th>
                <th class="px-3 py-2 text-left">Status</th>
                <th class="px-3 py-2 text-left">View</th>
              </tr>
            </thead>
            <tbody id="empLeaveHistoryBody"></tbody>
          </table>
          <div id="empLeaveHistoryEmpty" class="text-gray-400 text-sm text-center py-4 hidden">No leave records yet</div>
          <div id="hrLeavePagination" class="flex items-center justify-between mt-3 hidden">
            <button onclick="hrLeavePrevPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">◀ Back 10</button>
            <span id="hrLeavePageInfo" class="text-sm text-gray-500"></span>
            <button onclick="hrLeaveNextPage()" class="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Next 10 ▶</button>
          </div>
        </div>
      </div>
    `
    window._hrLeaveAll = await apiGet('/employees/'+id+'/leaves?limit=200')
    window._hrLeavePage = 0
    const HR_LEAVE_PAGE_SIZE = 10
    window.renderHrLeaveHistory = function() {
      window._hrLeavePage = 0
      const leaves = window._hrLeaveAll || []
      const q = (document.getElementById('hrLeaveSearch')?.value || '').toLowerCase()
      const typeFilter = (document.getElementById('hrLeaveTypeFilter')?.value || '').toLowerCase()
      const statusFilter = (document.getElementById('hrLeaveStatusFilter')?.value || '').toLowerCase()
      const monthF = document.getElementById('hrLeaveMonthFilter')?.value || ''
      const yearF = document.getElementById('hrLeaveYearFilter')?.value || ''
      const filtered = leaves.filter(l => {
        if (!q && !typeFilter && !statusFilter && !monthF && !yearF) return true
        const leaveDate = (l.startDate || l.start_date || '').toLowerCase()
        const id = (l.id || '').toLowerCase()
        const type = (l.type || '').toLowerCase()
        const status = (l.status || '').toLowerCase()
        const matchQ = !q || id.includes(q) || leaveDate.includes(q)
        const matchType = !typeFilter || type === typeFilter
        const matchStatus = !statusFilter || status === statusFilter
        const p = getLeaveDateParts(l)
        const matchMonth = !monthF || p.month === parseInt(monthF)
        const matchYear = !yearF || p.year === parseInt(yearF)
        return matchQ && matchType && matchStatus && matchMonth && matchYear
      })
      const sorted = [...filtered].sort((a, b) => ((b.applied_on || '') > (a.applied_on || '') ? 1 : -1))
      const totalPages = Math.ceil(sorted.length / HR_LEAVE_PAGE_SIZE)
      if (window._hrLeavePage >= totalPages) window._hrLeavePage = Math.max(0, totalPages - 1)
      if (window._hrLeavePage < 0) window._hrLeavePage = 0
      const start = window._hrLeavePage * HR_LEAVE_PAGE_SIZE
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
            document.getElementById('hrLeavePageInfo').textContent = `Page ${window._hrLeavePage + 1} of ${totalPages} (${sorted.length} total)`
          } else {
            pagination.classList.add('hidden')
          }
        }
      }
    }
    window.hrLeavePrevPage = function() {
      if (window._hrLeavePage > 0) { window._hrLeavePage--; window.renderHrLeaveHistory() }
    }
    window.hrLeaveNextPage = function() {
      const total = (window._hrLeaveAll || []).length
      if ((window._hrLeavePage + 1) * HR_LEAVE_PAGE_SIZE < total) { window._hrLeavePage++; window.renderHrLeaveHistory() }
    }
    window.renderHrLeaveHistory()
  } catch (e) { profile.innerHTML = '<p class="text-red-500">Error: ' + e.message + '</p>' }
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

window.replaceDocument=function(id){
  const input=document.createElement('input')
  input.type='file'
  input.accept='.pdf,.doc,.docx,.png,.jpg,.jpeg'
  input.onchange=async function(){
    const file=input.files[0]
    if(!file) return
    const reader=new FileReader()
    reader.readAsDataURL(file)
    const b64data=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result);reader.onerror=rej})
    try{
      await apiPut('/employees/'+id+'/document',{document:b64data})
      selectEmployee(id)
    }catch(e){alert('Error: '+e.message)}
  }
  input.click()
}

window.copyProfileCredentials=async function(id){
  try{
    const emp=await apiGet('/employees/'+id)
    const text='Employee ID: '+emp.id+'\nEmail: '+emp.email+'\nPassword: '+emp.password
    const ta=document.createElement('textarea')
    ta.value=text
    ta.style.position='fixed'
    ta.style.left='-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    const btn=document.getElementById('copyCredBtn'+id)
    if(btn){btn.textContent='✅ Copied!';setTimeout(()=>btn.textContent='📋 Copy Credentials',2000)}
  }catch(e){alert('Error copying')}
}

window.openDeleteModal=function(id){
  selectedEmployeeId=id
  document.getElementById('deleteModal').classList.remove('hidden')
  document.getElementById('deleteModal').classList.add('flex')
}
window.closeDeleteModal=function(){
  document.getElementById('deleteModal').classList.add('hidden')
  document.getElementById('deleteModal').classList.remove('flex')
}
window.confirmDeleteEmployee=async function(){
  if(!selectedEmployeeId) return
  try{
    await apiDelete('/employees/'+selectedEmployeeId)
    closeDeleteModal()
    sessionStorage.removeItem('hrSelectedEmpId')
    selectedEmployeeId=null
    document.getElementById('employeeProfile').innerHTML='<div class="flex flex-col items-center justify-center py-16 text-gray-400"><div class="text-7xl mb-4 opacity-50">👤</div><p class="text-xl font-medium text-gray-300">Select an employee</p><p class="text-sm text-gray-300 mt-1">Click on any employee from the list to view their profile</p></div>'
    loadEmployeeList()
  }catch(e){alert('Error: '+e.message)}
}

window.openCreateEmployee=function(){
  document.getElementById('createModal').classList.remove('hidden')
  document.getElementById('createModal').classList.add('flex')
  document.getElementById('createFormContainer').classList.remove('hidden')
  document.getElementById('createSuccess').classList.add('hidden')
  document.getElementById('createEmployeeForm').reset()
  document.getElementById('formError').classList.add('hidden')
}

window.closeCreateEmployee=function(){
  document.getElementById('createModal').classList.add('hidden')
  document.getElementById('createModal').classList.remove('flex')
}

// Create employee form
document.addEventListener('DOMContentLoaded',function(){
  const form=document.getElementById('createEmployeeForm')
  if(!form) return
  form.addEventListener('submit',async function(e){
    e.preventDefault()
    const fd=new FormData(form)
    const fileInput=document.querySelector('input[name="document"]')
    const file=fileInput?.files?.[0]
    const data={
      firstName: fd.get('firstName'),
      middleName: fd.get('middleName') || '',
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      countryCode: fd.get('countryCode') || '+1',
      phone: fd.get('phone'),
      dob: fd.get('dob') ? fd.get('dob').split('-').reverse().join('-') : '',
      doj: fd.get('doj') ? fd.get('doj').split('-').reverse().join('-') : '',
      nationality: fd.get('nationality'),
      designation: fd.get('designation'),
      gender: fd.get('gender') || '',
      projectTag: fd.get('projectTag') || '',
      address: fd.get('address'),
    }
    if (!data.dob) { alert('Please select Date of Birth'); return }
    if (!data.doj) { alert('Please select Date of Joining'); return }

    // Age validation: must be 18+ at today and at DOJ
    const dobParts = data.dob.split('-')
    const dojParts = data.doj.split('-')
    const dobDate = new Date(+dobParts[2], +dobParts[1] - 1, +dobParts[0])
    const dojDate = new Date(+dojParts[2], +dojParts[1] - 1, +dojParts[0])
    const today = new Date()
    const ageToday = today.getFullYear() - dobDate.getFullYear() - ((today.getMonth() < dobDate.getMonth() || (today.getMonth() === dobDate.getMonth() && today.getDate() < dobDate.getDate())) ? 1 : 0)
    const ageAtDoj = dojDate.getFullYear() - dobDate.getFullYear() - ((dojDate.getMonth() < dobDate.getMonth() || (dojDate.getMonth() === dobDate.getMonth() && dojDate.getDate() < dobDate.getDate())) ? 1 : 0)
    if (ageToday < 18) { alert('Employee must be at least 18 years old.'); return }
    if (ageAtDoj < 18) { alert('Employee must be at least 18 years old at the date of joining.'); return }
    if(file){
      const reader=new FileReader()
      reader.readAsDataURL(file)
      data.document=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject})
    }
    const errEl=document.getElementById('formError')
    errEl.classList.add('hidden')
    const btn=form.querySelector('button[type="submit"]')
    btn.disabled=true
    btn.textContent='Creating...'
    try{
      const res=await apiPost('/employees',data)
      document.getElementById('createFormContainer').classList.add('hidden')
      const success=document.getElementById('createSuccess')
      const emp=res.employee
      const lb=emp.leaveBalance||{}
      success.classList.remove('hidden')
      success.innerHTML=`
        <div class="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-center text-white shadow-lg shadow-green-200">
          <div class="text-6xl mb-4">🎉</div>
          <h3 class="text-2xl font-bold">Employee Profile Created</h3>
          <p class="text-green-100 mt-2 text-lg">${emp.name} has been onboarded successfully.</p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h4 class="font-semibold text-gray-700 text-lg mb-4">📋 Employee Credentials</h4>
          <div class="grid grid-cols-2 gap-3 text-sm">
            ${[
              ['Employee ID',emp.id,'text-blue-600 font-bold'],
              ['Name',emp.name,'font-medium'],
              ['Email',emp.email,'font-medium'],
              ['Phone',emp.phone||'—',''],
              ['Nationality',emp.nationality||'—',''],
              ['Designation',emp.designation||'—',''],
              ['Gender',emp.gender||'—',''],
              ['Project Tag',emp.projectTag?'🏷️ '+emp.projectTag:'',''],
              ['Password',emp.password,'font-mono font-bold text-yellow-700'],
            ].map(([k,v,s])=>`<div class="p-3 bg-gray-50 rounded-xl"><p class="text-xs text-gray-500 mb-0.5">${k}</p><p class="${s}">${v}</p></div>`).join('')}
          </div>
          <div class="mt-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 text-sm text-blue-700 flex items-center gap-2"><span>📧</span> Real email sent to <strong>${emp.email}</strong> with ID, email & password. Check inbox/spam.</div>
        </div>
        <div class="flex gap-3">
          <button onclick="copyCredentials()" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition" id="copyBtn">📋 Copy Credentials</button>
          <button onclick="closeCreateEmployee();loadEmployeeList()" class="flex-[2] px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 shadow-md shadow-blue-200 transition">✅ Done</button>
        </div>
      `
      loadEmployeeList()
      loadNotifications()
    }catch(e){
      errEl.textContent=e.message
      errEl.classList.remove('hidden')
    }finally{
      btn.disabled=false
      btn.textContent='Create Employee'
    }
  })
})

window.copyCredentials=function(){
  const items=document.querySelectorAll('#createSuccess .grid.grid-cols-2 > div')
  if(!items.length) return
  let id='',email='',pass=''
  items.forEach(el=>{
    const label=el.querySelector('p:first-child')?.textContent?.trim()||''
    const val=el.querySelector('p:last-child')?.textContent?.trim()||''
    if(label==='Employee ID') id=val
    else if(label==='Email') email=val
    else if(label==='Password') pass=val
  })
  const text='Employee ID: '+id+'\nEmail: '+email+'\nPassword: '+pass
  const ta=document.createElement('textarea')
  ta.value=text
  ta.style.position='fixed'
  ta.style.left='-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  const btn=document.getElementById('copyBtn')
  if(btn){btn.textContent='✅ Copied!';setTimeout(()=>btn.textContent='📋 Copy Credentials',2000)}
}

// HR Chat
let hrChatOpen=false
window.toggleHrChat=function(){
  hrChatOpen=!hrChatOpen
  document.getElementById('hrChatPanel').classList.toggle('hidden',!hrChatOpen)
  if(hrChatOpen){
    loadChatHistory('hrChatMessages')
    document.getElementById('hrChatInput')?.focus()
  }
}

window.sendHrChat=function(){
  sendChat('hrChatMessages','hrChatInput')
}

window.clearHrChat=function(){
  if(confirm('Clear all chat history?')) clearChatHistory('hrChatMessages')
}

// ===== Employee Dashboard =====
// Weekly calendar state
let weekCalOffset = 0
let weekCalSelections = {}

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

async function renderWeekCal() {
  const { monday, sunday } = getWeekRange(weekCalOffset)
  document.getElementById('weekCalRange').textContent =
    `${formatDateShort(monday)} - ${formatDateShort(sunday)}, ${monday.getFullYear()}`

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d)
  }

  let holidays = []
  try { holidays = await apiGet('/holidays') } catch (e) {}
  const holidayDates = {}
  ;(holidays || []).forEach(h => { holidayDates[h.date] = h.name })

  let existingLeaves = []
  try {
    const u = getUser()
    if (u) existingLeaves = await apiGet('/leaves/employee/' + u.id)
  } catch (e) {}
  const leaveByDate = {}
  ;(existingLeaves || []).forEach(l => {
    const date = l.start_date || l.startDate || ''
    if (date) {
      if (!leaveByDate[date]) leaveByDate[date] = []
      leaveByDate[date].push(l)
    }
  })

  const grid = document.getElementById('weekCalGrid')
  const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  grid.innerHTML = headerDays.map(d => `<div class="text-center text-xs font-semibold text-gray-500 py-1">${d}</div>`).join('')

  days.forEach((d, idx) => {
    const dateStr = formatDate(d)
    const isWeekend = idx >= 5
    const holidayName = holidayDates[dateStr]
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24))
    const outOfRange = Math.abs(diffDays) > 70
    const isDisabled = isWeekend || outOfRange
    const sel = weekCalSelections[dateStr]
    const isChecked = sel && sel.checked

    // Check for existing leaves on this date
    const dayLeaves = leaveByDate[dateStr] || []
    let leaveBadge = ''
    if (dayLeaves.length > 0) {
      const lv = dayLeaves[0]
      const s = (lv.status || '').toLowerCase()
      if (s === 'approved' || s === 'auto-approved') leaveBadge = '<span class="block text-[10px] text-green-700 font-medium mt-0.5">✅ Approved</span>'
      else if (s === 'pending') leaveBadge = '<span class="block text-[10px] text-red-600 font-medium mt-0.5">⏳ Pending</span>'
      else if (s === 'cancellation_requested') leaveBadge = '<span class="block text-[10px] text-blue-700 font-medium mt-0.5">🔶 Cancellation Pending</span>'
      else if (s === 'rejected') leaveBadge = ''
    }

    let bg = 'bg-white'
    if (holidayName) bg = 'bg-orange-50 border-orange-200'
    else if (isWeekend) bg = 'bg-gray-100'
    else if (leaveBadge && leaveBadge.includes('Cancellation Pending')) bg = 'bg-blue-50 border-blue-200'
    else if (leaveBadge && leaveBadge.includes('Approved')) bg = 'bg-green-50 border-green-200'
    else if (leaveBadge && leaveBadge.includes('Pending')) bg = 'bg-red-50 border-red-200'

    const extra = holidayName ? `<span class="text-[10px] text-orange-600 block truncate" title="${holidayName}">${holidayName}</span>` : ''
    // Rejected leaves should not block checkbox
    const hasBlockingLeave = dayLeaves.some(lv => {
      const s = (lv.status || '').toLowerCase()
      return s !== 'rejected'
    })
    const cbDis = isDisabled ? 'disabled' : ''
    const cbVis = isDisabled || hasBlockingLeave ? 'invisible' : ''

    const dateLabel = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`

    const typeSelect = isChecked
      ? `<div class="mt-1">        <select onchange="weekCalTypeChange('${dateStr}',this.value)" class="w-full text-[11px] px-1 py-0.5 border border-blue-300 rounded-lg bg-blue-50 outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">Select type...</option>
          <option value="casual" ${sel.type==='casual'?'selected':''}>Casual</option>
          <option value="sick" ${sel.type==='sick'?'selected':''}>Sick</option>
          <option value="business" ${sel.type==='business'?'selected':''}>Business</option>
          <option value="emergency" ${sel.type==='emergency'?'selected':''}>Personal/Emergency</option>
          <option value="family" ${sel.type==='family'?'selected':''}>Family/Vacation</option>
          <option value="unpaid" ${sel.type==='unpaid'?'selected':''}>Unpaid</option>
        </select></div>`
      : ''

    grid.innerHTML += `<div class="p-1.5 border ${isWeekend?'border-gray-100':'border-gray-200'} rounded-xl text-center transition ${bg} min-h-[72px]">
      <div class="flex items-center justify-center gap-1">
        <input type="checkbox" onchange="weekCalToggleCheck('${dateStr}',this.checked)" ${cbDis} ${isChecked?'checked':''} class="w-3.5 h-3.5 accent-blue-600 ${cbVis}">
        <p class="text-xs font-medium ${holidayName?'text-orange-700':isWeekend?'text-gray-400':'text-gray-700'}">${dateLabel}</p>
      </div>
      ${leaveBadge}
      ${extra}
      ${typeSelect}
    </div>`
  })

  updateWeekCalSummary()
}

window.weekCalPrev = function () { weekCalOffset--; renderWeekCal() }
window.weekCalNext = function () { weekCalOffset++; renderWeekCal() }

window.weekCalToggleCheck = function (dateStr, checked) {
  if (checked) weekCalSelections[dateStr] = { type: '', checked: true }
  else delete weekCalSelections[dateStr]
  renderWeekCal()
}

window.weekCalTypeChange = function (dateStr, type) {
  if (!weekCalSelections[dateStr]) weekCalSelections[dateStr] = {}
  weekCalSelections[dateStr].type = type
  updateWeekCalSummary()
}

window.weekCalClear = function () {
  weekCalSelections = {}
  renderWeekCal()
  document.getElementById('weekCalResult').classList.add('hidden')
}

window.weekCalSubmit = async function () {
  const entries = Object.entries(weekCalSelections).filter(([_, v]) => v.type)
  if (entries.length === 0) return

  const u = getUser()
  const reason = document.getElementById('weekCalReason').value
  const fileInput = document.getElementById('weekCalDocument')
  const file = fileInput?.files?.[0]

  let fileData = null
  if (file) {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    fileData = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject })
  }

  const result = document.getElementById('weekCalResult')
  result.classList.remove('hidden')
  result.className = 'mt-3 text-sm p-3 rounded-xl bg-blue-50 text-blue-700'
  result.textContent = 'Applying ' + entries.length + ' leave(s)...'

  // Group entries by leave type
  const byType = {}
  for (const [dateStr, sel] of entries) {
    if (!byType[sel.type]) byType[sel.type] = []
    byType[sel.type].push(dateStr)
  }

  let successCount = 0; let failCount = 0; let lastMsg = ''

  for (const [type, dates] of Object.entries(byType)) {
    try {
      const data = { employeeId: u.id, leaveType: type, dates, reason }
      if (fileData) data.document = fileData
      const res = await apiPost('/leaves/bulk', data)
      successCount += dates.length
    } catch (e) { failCount += dates.length; lastMsg = e.message }
  }

  if (failCount === 0) {
    result.className = 'mt-3 text-sm p-3 rounded-xl bg-green-50 text-green-700'
    result.textContent = successCount + ' leave(s) applied successfully!'
  } else {
    result.className = 'mt-3 text-sm p-3 rounded-xl bg-yellow-50 text-yellow-700'
    result.textContent = successCount + ' applied, ' + failCount + ' failed' + (lastMsg ? '. Last error: ' + lastMsg : '')
  }

  weekCalSelections = {}
  document.getElementById('weekCalReason').value = ''
  if (fileInput) fileInput.value = ''
  const savedOffset = weekCalOffset
  await loadEmployeeDashboard()
  weekCalOffset = savedOffset
  renderWeekCal()
}

async function loadEmployeeDashboard() {
  const u = getUser()
  if (!u || window.location.pathname !== '/employee') return
  try {
    // Header
    const emp = await apiGet('/employees/' + u.id)
    document.getElementById('empHeaderId').textContent = emp.id
    document.getElementById('empHeaderName').textContent = emp.name
    document.getElementById('empHeaderDoj').textContent = toDisplayDate(emp.doj)
    document.getElementById('empHeaderEmail').textContent = emp.email
    document.getElementById('empHeaderPhone').textContent = emp.phone || '—'
    document.getElementById('empHeaderGender').textContent = emp.gender || '—'
    const desigColorsEmp = {
      'software engineer':'bg-blue-100 text-blue-700','senior software engineer':'bg-indigo-100 text-indigo-700',
      'tech lead':'bg-purple-100 text-purple-700','manager':'bg-orange-100 text-orange-700',
      'ai ml engineer':'bg-cyan-100 text-cyan-700','data scientist':'bg-teal-100 text-teal-700',
      'devops engineer':'bg-rose-100 text-rose-700','qa engineer':'bg-lime-100 text-lime-700',
      'product manager':'bg-amber-100 text-amber-700','ui/ux designer':'bg-pink-100 text-pink-700',
      'business analyst':'bg-violet-100 text-violet-700','intern':'bg-gray-100 text-gray-700',
    }
    const defaultColorEmp = 'bg-gray-100 text-gray-700'
    const desig = (emp.designation||'').toLowerCase()
    const dColorEmp = Object.keys(desigColorsEmp).reduce((acc,key)=> desig.includes(key) ? desigColorsEmp[key] : acc, defaultColorEmp)
    document.getElementById('empHeaderDesig').innerHTML = emp.designation ? `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${dColorEmp}">${emp.designation}</span>` : '—'
    document.getElementById('empHeaderProject').textContent = emp.projectTag ? '🏷️ ' + emp.projectTag : '—'

    // Balance
    const lbRes = await apiGet('/employees/' + u.id + '/balance')
    const lb = lbRes || {}
    const cards = document.getElementById('leaveBalanceCards')
    const types = ['sick', 'casual', 'business', 'emergency', 'family']
    const colors = { sick: 'green', casual: 'blue', business: 'purple', emergency: 'orange', family: 'pink' }
    const icons = { sick: '🤒', casual: '😎', business: '💼', emergency: '🚨', family: '👨‍👩‍👧‍👦' }
    const labels = { sick: 'Sick', casual: 'Casual', business: 'Business', emergency: 'Emergency/Personal', family: 'Family/Vacation' }
    cards.innerHTML = types.map(t => {
      const lt = lb[t] || {}
      const remaining = lt.remaining || 0
      return `<div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition text-center"><div class="text-3xl mb-1">${icons[t]}</div><p class="text-xs text-gray-500 mb-3">${labels[t]}</p><div class="text-3xl font-bold text-${colors[t]}-600">${remaining}</div></div>`
    }).join('')

    // Upcoming leaves - top 6
    try {
      const upcoming = await apiGet('/employees/' + u.id + '/upcoming')
      const ul = document.getElementById('upcomingLeaves')
      if (!upcoming || upcoming.length === 0) ul.innerHTML = '<div class="text-center py-8 text-gray-400"><span class="text-4xl block mb-2">🏖️</span><p class="text-sm">No upcoming leaves</p></div>'
      else {
        const showAll = window._showAllUpcoming || false
        const items = showAll ? upcoming : upcoming.slice(0, 5)
        ul.innerHTML = items.map(l => {
          const status = (l.status || l.Status || '').toLowerCase()
          const isApproved = status === 'approved' || status === 'auto-approved'
          const isCancellationReq = status === 'cancellation_requested'
          const isPending = status === 'pending'
          const isRejected = status === 'rejected'
          let statColor, statIcon, statLabel, actionHtml
          if (isPending) {
            statColor = 'bg-yellow-100 text-yellow-700'; statIcon = '⏳'; statLabel = 'Pending'
            actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
          } else if (isApproved) {
            statColor = 'bg-green-100 text-green-700'; statIcon = '✅'; statLabel = 'Approved'
            actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
          } else if (isCancellationReq) {
            statColor = 'bg-blue-100 text-blue-700'; statIcon = '🔶'; statLabel = 'Cancellation Pending'
            actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
          } else if (isRejected) {
            statColor = 'bg-red-100 text-red-700'; statIcon = '❌'; statLabel = 'Rejected'
            actionHtml = '<span class="text-xs text-gray-400">--</span>'
          } else {
            statColor = 'bg-gray-100 text-gray-600'; statIcon = '📋'; statLabel = status
            actionHtml = '<span class="text-xs text-gray-400">--</span>'
          }
          const leaveDate = l.startDate || l.start_date || ''
          const cancelTitle = isCancellationReq ? (l.cancellation_reason||'').replace(/"/g,'&quot;') : ''
          return `<div class="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-lg">📅</div><div><p class="text-sm font-semibold text-gray-800">${l.type} Leave</p><p class="text-xs text-gray-500 mt-0.5">${toDisplayDate(leaveDate)}</p></div></div><div class="flex items-center gap-2"><span class="text-xs px-3 py-1 rounded-full font-medium ${statColor}"${cancelTitle ? ` title="${cancelTitle}"` : ''}>${statIcon} ${statLabel}</span>${actionHtml}</div></div>`
        }).join('')
        if (upcoming.length > 5) {
          ul.innerHTML += '<button onclick="window._showAllUpcoming=!' + (showAll ? 'true' : 'false') + ';loadEmployeeDashboard()" class="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">' + (showAll ? '▲ Show less' : '▼ Show all ' + upcoming.length + ' leaves') + '</button>'
        }
      }
    } catch (e) { }

    // Past leaves - only pending & cancellation_requested
    try {
      const allLeaves = await apiGet('/employees/' + u.id + '/leaves?limit=200')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const past = allLeaves.filter(l => {
        const s = (l.status || '').toLowerCase()
        if (s !== 'pending' && s !== 'cancellation_requested') return false
        const ds = l.start_date || l.startDate || ''
        if (!ds) return false
        let d
        if (ds.includes('-')) {
          const parts = ds.split('-')
          if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2])
          else d = new Date(parts[2], parts[1] - 1, parts[0])
        } else { d = new Date(ds) }
        return d < today
      })
      const pl = document.getElementById('pastLeaves')
      if (!past || past.length === 0) pl.innerHTML = '<div class="text-center py-8 text-gray-400"><span class="text-4xl block mb-2">📋</span><p class="text-sm">No past leaves requests pending</p></div>'
      else {
        const showAllPast = window._showAllPast || false
        const items = showAllPast ? past : past.slice(0, 5)
        let html = ''
        if (past.length > 5 && !showAllPast) html += '<p class="text-xs text-gray-500 mb-2">Showing top 5 of ' + past.length + ' past pending requests</p>'
        html += items.map(l => {
          const status = (l.status || l.Status || '').toLowerCase()
          const isCancellationReq = status === 'cancellation_requested'
          let statColor, statIcon, statLabel
          if (isCancellationReq) { statColor = 'bg-blue-100 text-blue-700'; statIcon = '🔶'; statLabel = 'Cancellation Pending' }
          else { statColor = 'bg-yellow-100 text-yellow-700'; statIcon = '⏳'; statLabel = 'Pending' }
          const leaveDate = l.start_date || l.startDate || ''
          return `<div class="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg">📅</div><div><p class="text-sm font-semibold text-gray-800">${l.type} Leave</p><p class="text-xs text-gray-500 mt-0.5">${toDisplayDate(leaveDate)}</p></div></div><div class="flex items-center gap-2"><span class="text-xs px-3 py-1 rounded-full font-medium ${statColor}">${statIcon} ${statLabel}</span><button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button></div></div>`
        }).join('')
        if (past.length > 5) {
          html += '<button onclick="window._showAllPast=!' + (showAllPast ? 'true' : 'false') + ';loadEmployeeDashboard()" class="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">' + (showAllPast ? '▲ Show less' : '▼ Show all ' + past.length + ' leaves') + '</button>'
        }
        pl.innerHTML = html
      }
    } catch (e) { }

    // Leave history table for Apply Leave tab
    try {
      const leaves = await apiGet('/employees/' + u.id + '/leaves?limit=200')
      window._empLeaveHistory = leaves || []
      renderLeaveHistory(leaves || [])
    } catch (e) { window._empLeaveHistory = []; renderLeaveHistory([]) }

    // Weekly calendar
    weekCalOffset = 0
    weekCalSelections = {}
    renderWeekCal()

    // Auto-refresh every 10s to pick up manager actions
    if (window._empRefreshInterval) clearInterval(window._empRefreshInterval)
    window._empRefreshInterval = setInterval(() => {
      // Silently refresh upcoming leaves and calendar only (not entire page)
      refreshEmployeeData(u.id)
    }, 10000)
  } catch (e) { console.error('Emp dash error:', e) }
}

async function refreshEmployeeData(empId) {
  try {
    // Refresh leave balance cards
    const lbRes = await apiGet('/employees/' + empId + '/balance')
    const lb = lbRes || {}
    const cards = document.getElementById('leaveBalanceCards')
    if (cards) {
      const types = ['sick', 'casual', 'business', 'emergency', 'family']
      const colors = { sick: 'green', casual: 'blue', business: 'purple', emergency: 'orange', family: 'pink' }
      const icons = { sick: '🤒', casual: '😎', business: '💼', emergency: '🚨', family: '👨‍👩‍👧‍👦' }
      const labels = { sick: 'Sick', casual: 'Casual', business: 'Business', emergency: 'Emergency/Personal', family: 'Family/Vacation' }
      cards.innerHTML = types.map(t => {
        const lt = lb[t] || {}
        const remaining = lt.remaining || 0
        return `<div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition text-center"><div class="text-3xl mb-1">${icons[t]}</div><p class="text-xs text-gray-500 mb-3">${labels[t]}</p><div class="text-3xl font-bold text-${colors[t]}-600">${remaining}</div></div>`
      }).join('')
    }
    // Refresh upcoming leaves
    const upcoming = await apiGet('/employees/' + empId + '/upcoming')
    const ul = document.getElementById('upcomingLeaves')
    if (upcoming && upcoming.length > 0) {
      const showAll = window._showAllUpcoming || false
      const items = showAll ? upcoming : upcoming.slice(0, 5)
      ul.innerHTML = items.map(l => {
        const status = (l.status || l.Status || '').toLowerCase()
        const isApproved = status === 'approved' || status === 'auto-approved'
        const isCancellationReq = status === 'cancellation_requested'
        const isPending = status === 'pending'
        const isRejected = status === 'rejected'
        let statColor, statIcon, statLabel, actionHtml
        if (isPending) {
          statColor = 'bg-yellow-100 text-yellow-700'; statIcon = '⏳'; statLabel = 'Pending'
          actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
        } else if (isApproved) {
          statColor = 'bg-green-100 text-green-700'; statIcon = '✅'; statLabel = 'Approved'
          actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
        } else if (isCancellationReq) {
          statColor = 'bg-blue-100 text-blue-700'; statIcon = '🔶'; statLabel = 'Cancellation Pending'
          actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button>`
        } else if (isRejected) {
          statColor = 'bg-red-100 text-red-700'; statIcon = '❌'; statLabel = 'Rejected'
          actionHtml = '<span class="text-xs text-gray-400">--</span>'
        } else {
          statColor = 'bg-gray-100 text-gray-600'; statIcon = '📋'; statLabel = status
          actionHtml = '<span class="text-xs text-gray-400">--</span>'
        }
        const leaveDate = l.startDate || l.start_date || ''
        const cancelTitle = isCancellationReq ? (l.cancellation_reason||'').replace(/"/g,'&quot;') : ''
        return `<div class="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-lg">📅</div><div><p class="text-sm font-semibold text-gray-800">${l.type} Leave</p><p class="text-xs text-gray-500 mt-0.5">${toDisplayDate(leaveDate)}</p></div></div><div class="flex items-center gap-2"><span class="text-xs px-3 py-1 rounded-full font-medium ${statColor}"${cancelTitle ? ` title="${cancelTitle}"` : ''}>${statIcon} ${statLabel}</span>${actionHtml}</div></div>`
      }).join('')
      if (upcoming.length > 5) {
        ul.innerHTML += '<button onclick="window._showAllUpcoming=!' + (showAll ? 'true' : 'false') + ';loadEmployeeDashboard()" class="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">' + (showAll ? '▲ Show less' : '▼ Show all ' + upcoming.length + ' leaves') + '</button>'
      }
    }
    // Refresh calendar (re-fetches existing leaves)
    renderWeekCal()
    // Refresh leave history and re-apply current filters
    const leaves = await apiGet('/employees/' + empId + '/leaves?limit=200')
    window._empLeaveHistory = leaves || []
    filterLeaveHistory()
    // Refresh past leaves (pending & cancellation only)
    const pl = document.getElementById('pastLeaves')
    if (pl && leaves) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const past = leaves.filter(l => {
        const s = (l.status || '').toLowerCase()
        if (s !== 'pending' && s !== 'cancellation_requested') return false
        const ds = l.start_date || l.startDate || ''
        if (!ds) return false
        let d
        if (ds.includes('-')) {
          const parts = ds.split('-')
          if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2])
          else d = new Date(parts[2], parts[1] - 1, parts[0])
        } else { d = new Date(ds) }
        return d < today
      })
      if (past.length === 0) pl.innerHTML = '<div class="text-center py-8 text-gray-400"><span class="text-4xl block mb-2">📋</span><p class="text-sm">No past leaves requests pending</p></div>'
      else {
        const showAllPast = window._showAllPast || false
        const items = showAllPast ? past : past.slice(0, 5)
        let html = ''
        if (past.length > 5 && !showAllPast) html += '<p class="text-xs text-gray-500 mb-2">Showing top 5 of ' + past.length + ' past pending requests</p>'
        html += items.map(l => {
          const status = (l.status || l.Status || '').toLowerCase()
          const isCR = status === 'cancellation_requested'
          const sc = isCR ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
          const si = isCR ? '🔶' : '⏳'
          const sl = isCR ? 'Cancellation Pending' : 'Pending'
          const ld = l.start_date || l.startDate || ''
          return '<div class="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg">📅</div><div><p class="text-sm font-semibold text-gray-800">' + l.type + ' Leave</p><p class="text-xs text-gray-500 mt-0.5">' + toDisplayDate(ld) + '</p></div></div><div class="flex items-center gap-2"><span class="text-xs px-3 py-1 rounded-full font-medium ' + sc + '">' + si + ' ' + sl + '</span><button onclick="cancelLeave(\'' + l.id + '\')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium">Cancel</button></div></div>'
        }).join('')
        if (past.length > 5) {
          html += '<button onclick="window._showAllPast=!' + (showAllPast ? 'true' : 'false') + ';loadEmployeeDashboard()" class="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">' + (showAllPast ? '▲ Show less' : '▼ Show all ' + past.length + ' leaves') + '</button>'
        }
        pl.innerHTML = html
      }
    }
  } catch (e) { /* silent refresh */ }
}

let leavePage = 0
const LEAVE_PAGE_SIZE = 10

function renderLeaveHistory(leaves) {
  const tbody = document.getElementById('leaveHistoryTable')
  const empty = document.getElementById('leaveHistoryEmpty')
  const pagination = document.getElementById('leavePagination')
  if (!tbody) return
  if (!leaves || leaves.length === 0) {
    tbody.innerHTML = ''
    if (empty) empty.classList.remove('hidden')
    if (pagination) pagination.classList.add('hidden')
    return
  }
  if (empty) empty.classList.add('hidden')

  const sorted = [...leaves].sort((a, b) => {
    const da = a.applied_on || ''
    const db = b.applied_on || ''
    return db.localeCompare(da)
  })
  const totalPages = Math.ceil(sorted.length / LEAVE_PAGE_SIZE)
  if (leavePage >= totalPages) leavePage = totalPages - 1
  if (leavePage < 0) leavePage = 0
  const start = leavePage * LEAVE_PAGE_SIZE
  const pageItems = sorted.slice(start, start + LEAVE_PAGE_SIZE)

  tbody.innerHTML = pageItems.map(l => {
    const status = (l.status || l.Status || '').toLowerCase()
    const isApproved = status === 'approved' || status === 'auto-approved'
    const isCancellationReq = status === 'cancellation_requested'
    const isRejected = status === 'rejected'
    const isPending = status === 'pending'

    let statLabel, statColor, statIcon, actionHtml
    if (isPending) {
      statLabel = 'Pending'
      statColor = 'bg-yellow-100 text-yellow-700'
      statIcon = '⏳'
      actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs text-orange-600 hover:bg-orange-50 px-2 py-0.5 rounded font-medium">Cancel</button>`
    } else if (isApproved) {
      statLabel = 'Approved'
      statColor = 'bg-green-100 text-green-700'
      statIcon = '✅'
      actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs text-orange-600 hover:bg-orange-50 px-2 py-0.5 rounded font-medium">Cancel</button>`
    } else if (isCancellationReq) {
      statLabel = 'Cancellation Pending'
      statColor = 'bg-blue-100 text-blue-700'
      statIcon = '🔶'
      actionHtml = `<button onclick="cancelLeave('${l.id}')" class="text-xs text-orange-600 hover:bg-orange-50 px-2 py-0.5 rounded font-medium">Cancel</button>`
    } else if (isRejected) {
      statLabel = 'Rejected'
      statColor = 'bg-red-100 text-red-700'
      statIcon = '❌'
      actionHtml = '<span class="text-xs text-gray-400">--</span>'
    } else {
      statLabel = status
      statColor = 'bg-gray-100 text-gray-600'
      statIcon = '📋'
      actionHtml = '<span class="text-xs text-gray-400">--</span>'
    }
    const appliedOn = l.applied_on || ''
    const appliedTime = appliedOn ? appliedOn.split(' ')[1] || '' : ''
    const appliedDate = appliedOn ? appliedOn.split(' ')[0] || appliedOn : ''
    const leaveDate = (l.start_date || l.startDate || '')
    const hasDoc = l.document || l.attachment
    const cancelTitle = isCancellationReq ? (l.cancellation_reason||'').replace(/"/g,'&quot;') : ''
    const rejectTitle = isRejected ? (l.rejection_reason||'').replace(/"/g,'&quot;') : ''
    return `<tr class="hover:bg-gray-50 transition border-b border-gray-100"><td class="px-4 py-3 font-mono text-xs text-gray-600">${l.id}</td><td class="px-4 py-3 text-sm whitespace-nowrap">${toDisplayDate(appliedDate)}<br><span class="text-xs text-gray-400">${appliedTime}</span></td><td class="px-4 py-3 text-sm capitalize">${l.type}</td><td class="px-4 py-3 text-sm">${toDisplayDate(leaveDate)}</td><td class="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate" title="${(l.reason||'').replace(/"/g,'&quot;')}">${l.reason||'—'}</td><td class="px-4 py-3">${hasDoc?`<button onclick="viewLeaveDoc('${l.id}')" class="text-blue-600 hover:text-blue-800 text-xs">📄 View</button>`:'—'}</td><td class="px-4 py-3"><span class="text-xs px-2.5 py-1 rounded-full font-medium ${statColor}"${cancelTitle ? ` title="${cancelTitle}"` : rejectTitle ? ` title="${rejectTitle}"` : ''}>${statIcon} ${statLabel}</span></td><td class="px-4 py-3 text-xs">${actionHtml}</td></tr>`
  }).join('')

  if (pagination) {
    if (totalPages > 1) {
      pagination.classList.remove('hidden')
      document.getElementById('leavePageInfo').textContent = `Page ${leavePage + 1} of ${totalPages} (${sorted.length} total)`
    } else {
      pagination.classList.add('hidden')
    }
  }
}

window.leavePrevPage = function () {
  if (leavePage > 0) { leavePage--; renderLeaveHistory(window._empLeaveHistory || []) }
}

window.leaveNextPage = function () {
  const total = (window._empLeaveHistory || []).length
  if ((leavePage + 1) * LEAVE_PAGE_SIZE < total) { leavePage++; renderLeaveHistory(window._empLeaveHistory || []) }
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
  const typeF = document.getElementById('leaveTypeFilter')?.value || ''
  const statusF = document.getElementById('leaveStatusFilter')?.value || ''
  const monthF = document.getElementById('leaveMonthFilter')?.value || ''
  const yearF = document.getElementById('leaveYearFilter')?.value || ''
  let all = window._empLeaveHistory || []
  if (typeF) all = all.filter(l => (l.type || '').toLowerCase() === typeF)
  if (statusF) {
    if (statusF === 'approved') {
      all = all.filter(l => {
        const s = (l.status || '').toLowerCase()
        return s === 'approved' || s === 'auto-approved'
      })
    } else {
      all = all.filter(l => (l.status || '').toLowerCase() === statusF)
    }
  }
  if (monthF) {
    all = all.filter(l => {
      const p = getLeaveDateParts(l)
      return p.month === parseInt(monthF)
    })
  }
  if (yearF) {
    all = all.filter(l => {
      const p = getLeaveDateParts(l)
      return p.year === parseInt(yearF)
    })
  }
  if (q) {
    all = all.filter(l =>
      (l.id || '').toLowerCase().includes(q) ||
      (l.applied_on || '').includes(q) ||
      (l.start_date || l.startDate || '').includes(q)
    )
  }
  renderLeaveHistory(all)
}

window.cancelLeave = async function (leaveId) {
  const leaves = window._empLeaveHistory || []
  const lv = leaves.find(l => l.id === leaveId)
  const st = lv && (lv.status || '').toLowerCase()
  const isPending = st === 'pending'
  const isCancellationReq = st === 'cancellation_requested'
  if (isPending) {
    if (!confirm('Cancel this pending leave? It will be removed from history.')) return
    try {
      await apiPost('/leaves/cancel', { leaveId, reason: 'Cancelled by employee' })
      loadEmployeeDashboard()
    } catch (e) { alert('Error: ' + e.message) }
  } else if (isCancellationReq) {
    // Withdraw cancellation request — revert to approved, no reason needed
    try {
      await apiPost('/leaves/cancel', { leaveId, reason: '' })
      loadEmployeeDashboard()
    } catch (e) { alert('Error: ' + e.message) }
  } else {
    const reason = prompt('Reason for cancellation request:')
    if (!reason) return
    try {
      await apiPost('/leaves/cancel', { leaveId, reason })
      loadEmployeeDashboard()
    } catch (e) { alert('Error: ' + e.message) }
  }
}

window.deleteLeave = async function (leaveId) {
  const reason = prompt('Reason for deletion:')
  if (!reason) return
  try {
    await apiPost('/leaves/cancel', { leaveId, reason })
    loadEmployeeDashboard()
  } catch (e) { alert('Error: ' + e.message) }
}

window.viewLeaveDoc = async function (leaveId) {
  try {
    const leaves = window._empLeaveHistory || window._empApprovalData?.history || window._hrLeaveAll || []
    const lv = leaves.find(l => l.id === leaveId)
    if (lv && lv.document) window.open(lv.document, '_blank')
    else alert('No document attached')
  } catch (e) { alert('Error loading document') }
}

window.switchEmpTab = function (tab) {
  document.getElementById('empTabDashboard').className = 'flex-1 px-6 py-3.5 text-sm font-semibold transition ' + (tab === 'dashboard' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-white')
  document.getElementById('empTabApply').className = 'flex-1 px-6 py-3.5 text-sm font-semibold transition ' + (tab === 'apply' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-white')
  document.getElementById('empDashboardContent').classList.toggle('hidden', tab !== 'dashboard')
  document.getElementById('empApplyContent').classList.toggle('hidden', tab !== 'apply')
}

// (weekly calendar form submit replaced by weekCalSubmit above)

// Employee Chat
let empChatOpen = false
window.toggleEmpChat = function () {
  empChatOpen = !empChatOpen
  document.getElementById('empChatPanel').classList.toggle('hidden', !empChatOpen)
  if (empChatOpen) {
    loadChatHistory('empChatMessages')
    document.getElementById('empChatInput')?.focus()
  }
}

window.sendEmpChat = function () {
  sendChat('empChatMessages', 'empChatInput')
}

window.clearEmpChat = function () {
  if (confirm('Clear all chat history?')) clearChatHistory('empChatMessages')
}

// Calendar Modal (holiday + leave calendar)
let calendarYear, calendarMonth, calendarHolidays = {}, calendarLeaves = [], calendarHolidaysList = []

window.openCalendarModal = async function () {
  const modal = document.getElementById('calendarModal')
  modal.classList.remove('hidden')
  modal.classList.add('flex')
  const now = new Date()
  calendarYear = now.getFullYear()
  calendarMonth = now.getMonth()
  try {
    const [holidays, leaves] = await Promise.all([
      apiGet('/holidays'),
      apiGet('/employees/' + (getUser()?.id) + '/leaves?limit=200')
    ])
    calendarHolidays = {}
    ;(holidays || []).forEach(h => { calendarHolidays[h.date] = h.name })
    calendarHolidaysList = holidays || []
    calendarLeaves = leaves || []
    renderCalendar()
  } catch (e) {
    document.getElementById('calendarContent').innerHTML = '<p class="text-red-500 text-center py-4">Error loading calendar</p>'
  }
}

function renderCalendar () {
  const firstDay = new Date(calendarYear, calendarMonth, 1)
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0)
  const startPad = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  document.getElementById('calendarMonthTitle').textContent = monthName

  let html = '<div class="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-500 mb-1">'
  html += ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="text-center py-1">${d}</div>`).join('')
  html += '</div><div class="grid grid-cols-7 gap-1">'

  for (let i = 0; i < startPad; i++) html += '<div></div>'

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dt = new Date(calendarYear, calendarMonth, d)
    const dayOfWeek = dt.getDay()
    const isSunday = dayOfWeek === 0
    const isSaturday = dayOfWeek === 6
    const holidayName = calendarHolidays[dateStr]

    let leaveStatus = ''
    ;(calendarLeaves || []).forEach(l => {
      const s = l.startDate || l.start_date || ''
      const e = l.endDate || l.end_date || ''
      if (dateStr >= s && dateStr <= e) {
        const st = (l.status || l.Status || '').toLowerCase()
        if (st === 'approved' || st === 'auto-approved') leaveStatus = 'approved'
        else if (st === 'pending') leaveStatus = 'pending'
        else if (st === 'cancellation_requested') leaveStatus = 'cancellation'
      }
    })

    let bg = 'bg-white'
    let dot = ''
    if (holidayName) { bg = 'bg-orange-50'; dot = '<span class="text-[10px] block text-orange-600 truncate leading-tight" title="' + holidayName + '">🏛️ ' + holidayName + '</span>' }
    else if (isSunday || isSaturday) { bg = 'bg-gray-50' }
    if (leaveStatus === 'approved') { bg = 'bg-green-50'; dot = '<span class="text-[10px] block text-green-600">✅</span>' }
    else if (leaveStatus === 'pending') { bg = 'bg-red-50'; dot = '<span class="text-[10px] block text-red-500">⏳</span>' }
    else if (leaveStatus === 'cancellation') { bg = 'bg-blue-50'; dot = '<span class="text-[10px] block text-blue-600">🔶</span>' }

    html += `<div class="p-2 rounded-lg text-center text-sm ${bg} border border-gray-100 min-h-[50px]"><p class="font-medium ${holidayName ? 'text-orange-700' : (isSunday || isSaturday) ? 'text-gray-400' : 'text-gray-700'}">${d}</p>${dot}</div>`
  }
  html += '</div>'

  // Holiday list for current year
  const yearHolidays = Object.entries(calendarHolidays)
    .filter(([date]) => date.startsWith(String(calendarYear)))
    .sort(([a], [b]) => a.localeCompare(b))
  const user = getUser()
  const isHr = user && user.role === 'hr'
  if (isHr) {
    html += '<div class="mt-6 border-t border-gray-200 pt-4"><h4 class="text-sm font-semibold text-gray-700 mb-3">📋 Manage Holidays</h4><div class="flex gap-2 items-end"><div><label class="text-xs text-gray-500 block mb-1">Date</label><input type="date" id="newHolidayDate" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"></div><div><label class="text-xs text-gray-500 block mb-1">Holiday Name</label><input type="text" id="newHolidayName" placeholder="Enter holiday name..." class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"></div><button onclick="addHoliday()" class="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Add</button></div></div>'
  }
  if (yearHolidays.length) {
    html += '<div class="mt-6 border-t border-gray-200 pt-4"><h4 class="text-sm font-semibold text-gray-700 mb-3">📋 Holidays – ' + calendarYear + '</h4><div class="grid grid-cols-2 gap-2 text-xs">'
    yearHolidays.forEach(([date, name]) => {
      const h = calendarHolidaysList.find(hh => hh.date === date)
      const d = new Date(date + 'T00:00:00')
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      html += '<div class="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100"><span class="text-orange-600">🏛️</span><span class="font-medium text-gray-700">' + name + '</span><span class="text-gray-400 ml-auto">' + formatted + '</span>' + (isHr && h ? '<button onclick="deleteHoliday(\'' + h.id + '\')" class="text-red-400 hover:text-red-600 ml-1" title="Delete">✕</button>' : '') + '</div>'
    })
    html += '</div></div>'
  }

  document.getElementById('calendarContent').innerHTML = html
}

window.calendarPrevMonth = function () {
  calendarMonth--
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear-- }
  renderCalendar()
}

window.calendarNextMonth = function () {
  calendarMonth++
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++ }
  renderCalendar()
}

window.closeCalendarModal = function () {
  document.getElementById('calendarModal').classList.add('hidden')
  document.getElementById('calendarModal').classList.remove('flex')
}

window.addHoliday = async function () {
  const date = document.getElementById('newHolidayDate')?.value
  const name = document.getElementById('newHolidayName')?.value?.trim()
  if (!date || !name) { alert('Please enter both date and name'); return }
  try {
    await apiPost('/holidays', { date, name })
    document.getElementById('newHolidayDate').value = ''
    document.getElementById('newHolidayName').value = ''
    const [holidays] = await Promise.all([apiGet('/holidays')])
    calendarHolidays = {}
    ;(holidays || []).forEach(h => { calendarHolidays[h.date] = h.name })
    calendarHolidaysList = holidays || []
    renderCalendar()
  } catch (e) { alert('Error: ' + e.message) }
}

window.deleteHoliday = async function (id) {
  if (!confirm('Delete this holiday?')) return
  try {
    await apiDelete('/holidays/' + id)
    const [holidays] = await Promise.all([apiGet('/holidays')])
    calendarHolidays = {}
    ;(holidays || []).forEach(h => { calendarHolidays[h.date] = h.name })
    calendarHolidaysList = holidays || []
    renderCalendar()
  } catch (e) { alert('Error: ' + e.message) }
}

// ===== Manager Dashboard =====
let _mgrEmployees = []
let _mgrSelectedEmpId = null

async function loadManagerDashboard() {
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

    // Stats cards
    const stats = document.getElementById('mgrStatsCards')
    stats.innerHTML = [
      { label: 'Total Team Members', value: emps.length, color: 'bg-blue-50 text-blue-700', icon: '👥' },
      { label: 'Pending Requests', value: totalPending, color: 'bg-yellow-50 text-yellow-700', icon: '⏳' },
      { label: 'Cancellation Req', value: totalCancellations, color: 'bg-blue-50 text-blue-700', icon: '🔶' },
    ].map(s => `<div class="${s.color} rounded-xl p-4 border"><p class="text-xs opacity-70">${s.icon} ${s.label}</p><p class="text-2xl font-bold mt-1">${s.value}</p></div>`).join('')

    // Team member cards - vertical, sorted by pending+cancel desc
    const container = document.getElementById('teamMemberList')
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
      return `<div class="p-4 bg-white rounded-xl border border-gray-200 transition">
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

    // Employee select for approvals tab
    const sel = document.getElementById('mgrEmployeeSelect')
    sel.innerHTML = '<option value="">Select team member...</option>' + emps.map(e => `<option value="${e.id}">${e.name} (${e.id})</option>`).join('')

    // Refresh notification bell
    if (window._mgrPendingCounts && window.initNavbar) {
      const totalP = Object.values(window._mgrPendingCounts).reduce((a, b) => a + b, 0)
      const bell = document.getElementById('notificationBell')
      if (bell) {
        bell.innerHTML = '🔔' + (totalP > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">${totalP}</span>` : '')
        bell.title = totalP + ' pending'
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

async function loadEmpApprovals(empId) {
  const pastEl = document.getElementById('empPastLeaves')
  const upcomingEl = document.getElementById('empUpcomingLeaves')
  pastEl.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>'
  upcomingEl.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>'
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

    switchEmpApprovalTab('pending')
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

    if (type === 'past' && isCR) {
      return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
        + '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>'
        + '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 capitalize">' + l.type + ' Leave</p>'
        + '<p class="text-xs text-gray-500 mt-0.5">' + toDisplayDate(leaveDate) + '</p>'
        + '<p class="text-xs text-gray-400">Applied: ' + toDisplayDate(appliedDate) + '</p>'
        + (l.cancellation_reason || l.cancellationReason ? '<p class="text-xs text-red-400 mt-0.5">Cancel reason: ' + (l.cancellation_reason || l.cancellationReason) + '</p>' : '')
        + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700 flex-shrink-0">🔶 Cancellation Pending</span></div>'
        + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
        + '<button onclick="approveCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium">Approve Cancellation</button>'
        + '<button onclick="rejectCancellation(\'' + id + '\')" class="text-xs px-4 py-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium">Reject</button>'
        + '</div></div>'
    }

    return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
      + '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>'
      + '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 capitalize">' + l.type + ' Leave</p>'
      + '<p class="text-xs text-gray-500 mt-0.5">' + toDisplayDate(leaveDate) + '</p>'
      + '<p class="text-xs text-gray-400">Applied: ' + toDisplayDate(appliedDate) + '</p>'
      + (l.reason ? '<p class="text-xs text-gray-400 mt-0.5">Reason: ' + l.reason + '</p>' : '')
      + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700 flex-shrink-0">⏳ Pending</span></div>'
      + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
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
    if (tab === 'pending') {
      return '<div class="p-4 bg-white rounded-xl border border-gray-200">'
        + '<div class="flex items-start justify-between">'
        + '<div><p class="text-xs text-gray-400">Request ID: <span class="font-mono text-gray-600">' + id + '</span></p>'
        + '<p class="text-sm font-semibold text-gray-800 mt-2 capitalize">' + l.type + ' Leave</p>'
        + '<p class="text-xs text-gray-500 mt-1">Leave Date: <strong>' + toDisplayDate(leaveDate) + '</strong></p>'
        + '<p class="text-xs text-gray-500">Applied On: ' + toDisplayDate(appliedDate) + '</p>'
        + (l.reason ? '<p class="text-xs text-gray-400 mt-1">Reason: ' + l.reason + '</p>' : '')
        + '</div><span class="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">⏳ Pending</span></div>'
        + '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">'
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

function renderEmpHistory(history) {
  const list = document.getElementById('empApprovalList')
  const filters = window._empHistoryFilters || { search: '', type: '', status: '', month: '', year: '' }

  let html = '<div class="flex flex-wrap gap-2 mb-3">'
  html += '<input id="empHistSearch" placeholder="Search by ID or date..." value="' + (filters.search || '') + '" oninput="applyEmpHistFilter()" class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none flex-1 min-w-[150px]">'
  html += '<select id="empHistTypeFilter" onchange="applyEmpHistFilter()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Types</option>'
  ;['casual', 'sick', 'business', 'emergency', 'family', 'unpaid'].forEach(t => {
    html += '<option value="' + t + '" ' + (filters.type === t ? 'selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistStatusFilter" onchange="applyEmpHistFilter()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Status</option>'
  ;['approved', 'rejected', 'pending', 'cancellation_requested'].forEach(s => {
    const label = s === 'approved' ? 'Approved' : s === 'cancellation_requested' ? 'Cancellation Pending' : s.charAt(0).toUpperCase() + s.slice(1)
    html += '<option value="' + s + '" ' + (filters.status === s ? 'selected' : '') + '>' + label + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistMonthFilter" onchange="applyEmpHistFilter()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Months</option>'
  ;['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach((m,i)=>{
    html += '<option value="' + (i+1) + '" ' + (filters.month === String(i+1) ? 'selected' : '') + '>' + m + '</option>'
  })
  html += '</select>'
  html += '<select id="empHistYearFilter" onchange="applyEmpHistFilter()" class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none">'
  html += '<option value="">All Years</option>'
  ;['2024','2025','2026','2027'].forEach(y => {
    html += '<option value="' + y + '" ' + (filters.year === y ? 'selected' : '') + '>' + y + '</option>'
  })
  html += '</select>'
  html += '</div>'

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

  if (pageItems.length === 0) {
    html += '<p class="text-gray-400 text-sm text-center py-6">No matching records</p>'
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
  list.innerHTML = html
}

window.applyEmpHistFilter = function () {
  _empHistPage = 0
  const data = window._empApprovalData || {}
  if (data.history) renderEmpHistory(data.history)
}

window.empHistPrevPage = function () {
  if (_empHistPage > 0) { _empHistPage--; renderEmpHistory(((window._empApprovalData || {}).history || [])) }
}
window.empHistNextPage = function () {
  const total = ((window._empApprovalData || {}).history || []).length
  if ((_empHistPage + 1) * EMP_HIST_PAGE_SIZE < total) { _empHistPage++; renderEmpHistory(((window._empApprovalData || {}).history || [])) }
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
      return `<div onclick="openEmployeeView('${e.id}')" class="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-blue-200 cursor-pointer transition">
        <div class="flex items-center justify-between mb-1">
          <p class="font-semibold text-sm text-gray-800">${e.name}</p>
          <div class="flex items-center gap-2">${badgeHtml}</div>
        </div>
        <p class="text-xs text-gray-500">${e.email || '—'}${e.projectTag ? ` <span class="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">🏷️ ${e.projectTag}</span>` : ''}</p>
        <p class="text-xs text-gray-500 mt-1">ID: ${e.id}</p>
        <p class="text-xs mt-0.5"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${dColor}">${e.designation||'—'}</span></p>
        <p class="text-xs text-gray-500 mt-1">DOJ: ${toDisplayDate(e.doj)}</p>
        <p class="text-xs text-gray-500">⚤ ${e.gender || '—'}</p>
        ${total > 0 ? `<p class="text-xs font-semibold text-gray-600 mt-1">Total: ${total} request${total > 1 ? 's' : ''}</p>` : ''}
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
  div.innerHTML = '<input type="text" id="mgrTagField' + empId + '" placeholder="Enter project name..." class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" value="' + currentTag + '"> <button onclick="saveTagMgr(\'' + empId + '\')" class="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Tag</button>'
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

// Manager Chat
let mgrChatOpen=false
window.toggleMgrChat=function(){
  mgrChatOpen=!mgrChatOpen
  document.getElementById('mgrChatPanel').classList.toggle('hidden',!mgrChatOpen)
  if(mgrChatOpen){
    loadChatHistory('mgrChatMessages')
    document.getElementById('mgrChatInput')?.focus()
  }
}
window.sendMgrChat=function(){
  sendChat('mgrChatMessages','mgrChatInput')
}
window.clearMgrChat=function(){
  if(confirm('Clear all chat history?')) clearChatHistory('mgrChatMessages')
}

window.setEmpChatPrompt=function(text){
  if(!empChatOpen) toggleEmpChat()
  document.getElementById('empChatInput').value=text
  sendEmpChat()
}

// ===== Standalone Chat =====
window.sendStandaloneChat=function(){
  sendChat('chatMessages','chatInput')
}
window.setChatPrompt=function(text){
  document.getElementById('chatInput').value=text
  sendStandaloneChat()
}

// ===== Page init =====
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
