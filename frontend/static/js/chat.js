// ===== Chat Functions =====
// Dependencies: api.js, utils.js, auth.js
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

window._aiProcessing = false

function addChatLoading(containerId){
  window._aiProcessing = true
  const panel=document.getElementById(containerId)?.closest('[id$=ChatPanel]') || document.getElementById(containerId)?.parentElement
  if(!panel) return
  if(!document.getElementById('chatProcessingMsg')){
    const msg=document.createElement('div')
    msg.id='chatProcessingMsg'
    msg.className='flex justify-start'
    msg.innerHTML='<div class="px-3 py-2 rounded-xl bg-white text-gray-500 border border-gray-200 rounded-bl-sm text-sm italic flex items-center gap-2"><span class="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>Thinking...</div>'
    const container=document.getElementById(containerId)
    if(container){container.appendChild(msg); container.scrollTop=container.scrollHeight}
  }
  const btn=panel.querySelector('button[onclick*="sendMgrChat"],button[onclick*="sendEmpChat"],button[onclick*="sendStandaloneChat"]')
  if(btn){btn._disabled=btn.disabled; btn.disabled=true; btn.style.opacity='0.5'; btn.style.cursor='not-allowed'}
}

function removeChatLoading(){
  window._aiProcessing = false
  const el=document.getElementById('chatProcessingMsg')
  if(el) el.remove()
  document.querySelectorAll('button[onclick*="sendMgrChat"],button[onclick*="sendEmpChat"],button[onclick*="sendStandaloneChat"],button[onclick*="sendChat"]').forEach(b=>{
    if(b._disabled !== undefined){b.disabled=b._disabled; delete b._disabled}
    b.style.opacity=''; b.style.cursor=''
  })
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
    }
  }catch(e){
    removeChatLoading()
    addChatMessage(containerId, 'Error: '+e.message, false)
  }
}

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
