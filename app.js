const $ = (id) => document.getElementById(id);
const state = { messages: [], busy: false, recognition: null, listening: false, voices: [], speak: true };
const messagesEl = $("messages");
function setStatus(text, mode="") {
  $("voice-status").textContent = text;
  $("orb-wrap").classList.toggle("listening", mode==="listening");
  $("orb-wrap").classList.toggle("thinking", mode==="thinking");
  $("orb-label").innerHTML = `JARVIS <span>${mode==="listening"?"ESCUCHANDO":mode==="thinking"?"PROCESANDO":"LISTO"}</span>`;
}
function addMessage(role, content) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role==="assistant"?"J":"T";
  const body = document.createElement("div");
  const meta = document.createElement("small"); meta.textContent = `${role==="assistant"?"JARVIS":"USTED"} · AHORA`;
  const p = document.createElement("p"); p.textContent = content;
  body.append(meta,p); item.append(avatar,body); messagesEl.append(item); messagesEl.scrollTop = messagesEl.scrollHeight;
}
function speak(text) {
  if (!state.speak || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "es-PE"; utter.rate = 0.96; utter.pitch = 0.88;
  const selected = $("voice-select").value;
  if (selected) { const voice = state.voices.find(v => v.name===selected); if (voice) utter.voice=voice; }
  utter.onstart = () => setStatus("JARVIS está respondiendo");
  utter.onend = () => setStatus("En espera de instrucciones");
  window.speechSynthesis.speak(utter);
}
async function sendMessage(text) {
  text = text.trim(); if (!text || state.busy) return;
  state.busy = true; state.messages.push({role:"user",content:text}); addMessage("user",text);
  $("chat-input").value=""; setStatus("Analizando su solicitud…","thinking");
  const pending = document.createElement("div"); pending.className="message assistant"; pending.id="pending";
  pending.innerHTML='<div class="avatar">J</div><div><small>JARVIS · PROCESANDO</small><p>Estoy analizando su solicitud…</p></div>'; messagesEl.append(pending); messagesEl.scrollTop=messagesEl.scrollHeight;
  try {
    const response = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:state.messages.slice(-20)})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "No se pudo contactar con el servicio.");
    const reply = data.reply;
    state.messages.push({role:"assistant",content:reply});
    $("pending")?.remove(); addMessage("assistant",reply); speak(reply); setStatus("Respuesta completada");
  } catch (err) {
    $("pending")?.remove();
    const msg = err.message || "Error de conexión.";
    addMessage("assistant",`No he podido completar la solicitud. ${msg}`);
    setStatus("Revisar configuración"); 
  } finally { state.busy=false; }
}
$("chat-form").addEventListener("submit", e=>{e.preventDefault();sendMessage($("chat-input").value);});
document.querySelectorAll(".quick-command").forEach(btn=>btn.addEventListener("click",()=>sendMessage(btn.dataset.prompt)));
$("stop-button").addEventListener("click",()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();if(state.recognition){try{state.recognition.stop()}catch{}}state.listening=false;setStatus("Voz detenida");});
$("mic-button").addEventListener("click",()=>{
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { addMessage("assistant","Este navegador no ofrece reconocimiento de voz compatible. Puede escribir su mensaje en el campo de conversación."); return; }
  if (state.listening && state.recognition) { state.recognition.stop(); return; }
  const recognition = new Recognition(); state.recognition=recognition; recognition.lang="es-PE"; recognition.interimResults=false; recognition.maxAlternatives=1;
  recognition.onstart=()=>{state.listening=true;setStatus("Le escucho…","listening");$("mic-button").classList.add("active");};
  recognition.onresult=e=>{const transcript=e.results[0][0].transcript; $("chat-input").value=transcript; sendMessage(transcript);};
  recognition.onerror=e=>{setStatus(e.error==="not-allowed"?"Permiso de micrófono denegado":"No se pudo reconocer la voz");};
  recognition.onend=()=>{state.listening=false;$("mic-button").classList.remove("active");if(!$("orb-wrap").classList.contains("thinking"))setStatus("En espera de instrucciones");};
  try{recognition.start()}catch{setStatus("No se pudo iniciar el micrófono");}
});
$("clear-button").addEventListener("click",()=>{state.messages=[];messagesEl.replaceChildren();addMessage("assistant","Conversación limpiada. Estoy listo para ayudarle.");});
$("settings-button").addEventListener("click",()=>$("settings-dialog").showModal());
$("close-settings").addEventListener("click",()=>$("settings-dialog").close());
$("close-settings-bottom").addEventListener("click",()=>$("settings-dialog").close());
$("speak-toggle").addEventListener("change",e=>state.speak=e.target.checked);
function loadVoices(){
  if(!("speechSynthesis" in window))return;
  state.voices=window.speechSynthesis.getVoices();
  const select=$("voice-select"); const previous=select.value; select.replaceChildren(new Option("Voz predeterminada",""));
  state.voices.filter(v=>v.lang.toLowerCase().startsWith("es")).forEach(v=>select.add(new Option(`${v.name} (${v.lang})`,v.name)));
  select.value=previous;
}
if("speechSynthesis" in window){loadVoices();window.speechSynthesis.onvoiceschanged=loadVoices;}
async function refreshHealth(){
 try{
  const r=await fetch("/api/health");const d=await r.json();
  $("system-status").textContent=d.status==="online"?"SISTEMA EN LÍNEA":"REVISAR SISTEMA";
  $("ai-state").textContent=d.ai_configured?"Proveedor configurado":"Falta configurar la API";
  $("settings-ai").textContent=d.ai_configured?"Configurado en el servidor":"Falta AI_API_KEY o AI_MODEL en .env";
  $("ai-pill").textContent=d.ai_configured?"LISTO":"CONFIGURAR";$("ai-pill").className="pill "+(d.ai_configured?"good":"warn");
  $("home-state").textContent=d.google_home.message;$("home-pill").textContent="PENDIENTE";
 }catch{$("system-status").textContent="SERVIDOR NO DISPONIBLE";setStatus("No se puede contactar con el servidor");}
}
$("settings-dialog").addEventListener("click",e=>{if(e.target===$("settings-dialog"))$("settings-dialog").close();});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("/static/sw.js").catch(()=>{});
refreshHealth();
