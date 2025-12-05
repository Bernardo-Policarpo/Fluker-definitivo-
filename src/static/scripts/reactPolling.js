console.log("[reactPolling] Carregado");

const { useState, useEffect, useCallback, useRef } = React;
const POLLING_MS = 2000;

// ========================================
// 1. COMPONENTE: LISTA DE NOTIFICAÇÕES
// ========================================
function NotificationList() {
  const [notifications, setNotifications] = useState([]);

  // Busca notificações e atualiza Badge
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);

        // Atualiza a bolinha vermelha no header
        const badge = document.getElementById("notif-badge");
        if (badge) {
            if (data.unread > 0) {
                badge.innerText = data.unread > 99 ? "99+" : data.unread;
                badge.style.display = "flex";
                badge.classList.add("show");
            } else {
                badge.innerText = "";
                badge.style.display = "none";
                badge.classList.remove("show");
            }
        }
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, POLLING_MS);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // --- AÇÃO: MARCAR TODAS COMO LIDAS ---
  const markAllRead = async () => {
    try {
        await fetch("/api/notifications/mark_all_read", { method: "POST" });
        // Atualiza visualmente na hora
        setNotifications(prev => prev.map(n => ({...n, read: "1"})));
        const badge = document.getElementById("notif-badge");
        if(badge) { badge.style.display = "none"; badge.innerText = ""; }
    } catch(e) { console.error(e); }
  };

  // --- AÇÃO: LIMPAR TUDO (DIRETO, SEM AVISO) ---
  const clearAll = async () => {
    // REMOVI O ALERT DAQUI. CLICOU, LIMPOU.
    try {
        await fetch("/api/notifications/clear_all", { method: "POST" });
        setNotifications([]); // Limpa a lista na hora
        const badge = document.getElementById("notif-badge");
        if(badge) { badge.style.display = "none"; badge.innerText = ""; }
    } catch(e) { console.error(e); }
  };

  // --- AÇÃO: AMIZADE (SEM ALERTAS) ---
  const handleFriend = async (action, reqId) => {
    const url = action === 'accept' ? "/api/friend_request/accept" : "/api/friend_request/reject";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: reqId })
      });
      
      const json = await res.json();
      
      if (res.ok && json.ok) {
        fetchNotifs();
        if(action === 'accept') window.location.reload(); 
      } else {
        console.error("Erro na ação:", json.error);
      }
    } catch(e) { console.error(e); }
  };

  // --- RENDERIZAÇÃO ---
  return React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    
    // 1. BARRA DE FERRAMENTAS
    React.createElement("div", { 
        style: { 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '10px', 
            borderBottom: '1px solid #ddd',
            background: '#f9f9f9',
            position: 'sticky',
            top: 0,
            zIndex: 10
        } 
    },
        React.createElement("button", { 
            onClick: markAllRead,
            style: { 
                background: 'none', border: 'none', color: '#8b4dff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }
        }, "Marcar como lidas"),
        
        React.createElement("button", { 
            onClick: clearAll,
            style: { 
                background: 'none', border: 'none', color: '#ff3b30', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }
        }, "Limpar as notificações")
    ),

    // 2. A LISTA
    notifications.length === 0 
    ? React.createElement("div", { style: { padding: '20px', textAlign: 'center', color: '#999' } }, "Nenhuma notificação.")
    : React.createElement("div", { style: { overflowY: 'auto' } }, 
        notifications.map(n => 
            React.createElement("div", { 
                key: n.id, 
                style: {
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: n.read === "0" ? '#f0f8ff' : '#fff'
                }
            },
            React.createElement("p", { style: { margin: '0 0 5px 0', fontWeight: n.read === "0" ? 'bold' : 'normal', fontSize: '14px' } }, n.text),
            
            // Botões de Amizade
            n.type === 'friend_request' && React.createElement("div", { style: { display: 'flex', gap: '10px', marginTop: '5px' } },
                React.createElement("button", { 
                onClick: () => handleFriend('accept', n.actor_id),
                style: { background: '#28a745', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }
                }, "Aceitar"),
                React.createElement("button", { 
                onClick: () => handleFriend('reject', n.actor_id),
                style: { background: '#dc3545', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }
                }, "Recusar")
            ),
            
            React.createElement("small", { style: { color: '#888', fontSize: '11px' } }, n.timestamp_display)
            )
        )
    )
  );
}

// ========================================
// 2. CHAT DM
// ========================================
function ChatDM({ currentUserId }) {
  const currentUserNum = Number(currentUserId) || currentUserId;
  const [users, setUsers] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(0);

  const loadUsers = useCallback(async () => {
    try {
        const res = await fetch("/api/friends");
        if(res.ok) setUsers((await res.json()).users || []);
    } catch(e){}
  }, []);

  const loadMessages = useCallback(async (fullReload = false) => {
    if (!partnerId) return;
    try {
      const url = `/api/messages?partner_id=${partnerId}&since_id=${fullReload ? 0 : lastMsgIdRef.current}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if(data.error) return;
        const newMsgs = data.messages || [];
        if (fullReload) setMessages(newMsgs);
        else if (newMsgs.length > 0) setMessages(prev => [...prev, ...newMsgs]);
        if (newMsgs.length > 0) lastMsgIdRef.current = Math.max(...newMsgs.map(m => Number(m.id)));
      }
    } catch(e){}
  }, [partnerId]);

  const sendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !partnerId || isSending) return;
    setIsSending(true);
    try {
      await fetch("/api/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, content: text })
      });
      setMessageInput(""); loadMessages(false);
    } catch(e){} finally { setIsSending(false); }
  };

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if(partnerId) { const i = setInterval(() => loadMessages(false), POLLING_MS); return () => clearInterval(i); } }, [partnerId, loadMessages]);
  useEffect(() => { if(partnerId) { setMessages([]); lastMsgIdRef.current=0; loadMessages(true); } }, [partnerId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return React.createElement("div", { className: "chat-container" },
    React.createElement("div", { className: "chat-header" },
      React.createElement("select", { value: partnerId, onChange: (e) => setPartnerId(e.target.value), className: "chat-select" },
        React.createElement("option", { value: "" }, "Selecione um amigo..."),
        users.map(u => React.createElement("option", { key: u.id, value: String(u.id) }, u.username))
      )
    ),
    React.createElement("div", { className: "chat-messages" },
      messages.length===0 && partnerId && React.createElement("p", {style:{textAlign:'center', padding:'20px', color:'#999'}}, "Sem mensagens."),
      messages.map(m => React.createElement("div", { key: m.id, className: `msg-line ${Number(m.sender_id) === currentUserNum ? "msg-me" : "msg-partner"}` }, `[${m.timestamp_display ? m.timestamp_display.split(' ')[1] : ''}] ${m.content}`)),
      React.createElement("div", { ref: messagesEndRef })
    ),
    React.createElement("div", { className: "chat-input-area" },
      React.createElement("input", { type: "text", value: messageInput, onChange: (e)=>setMessageInput(e.target.value), onKeyDown:(e)=>e.key==='Enter'&&sendMessage(), placeholder: "Digite...", disabled: !partnerId }),
      React.createElement("button", { onClick: sendMessage, disabled: !partnerId }, "Enviar")
    )
  );
}

// ========================================
// 3. LIKE BUTTON
// ========================================
function LikeButton({ postId, initialLikes, initialLiked, currentUserId }) {
  const [likes, setLikes] = useState(parseInt(initialLikes) || 0);
  const [isLiked, setIsLiked] = useState(initialLiked === "true");

  useEffect(() => {
    const sync = async () => {
        try {
            const res = await fetch("/api/post_likes");
            if(res.ok) {
                const data = await res.json();
                if(data[postId]) {
                    setLikes(data[postId].likes);
                    setIsLiked((data[postId].likes_by||"").split(";").includes(String(currentUserId)));
                }
            }
        } catch(e){}
    };
    const i = setInterval(sync, POLLING_MS); return () => clearInterval(i);
  }, [postId, currentUserId]);

  const toggle = async () => {
    const prevLiked = isLiked; const prevLikes = likes;
    setIsLiked(!isLiked); setLikes(isLiked ? likes-1 : likes+1);
    try { await fetch(`/api/toggle_like/${postId}`, { method: "POST" }); } 
    catch { setIsLiked(prevLiked); setLikes(prevLikes); }
  };
  
  return React.createElement("button", { className: "heart-btn", onClick: toggle },
    React.createElement("img", { src: isLiked ? "/static/images/redheart.png" : "/static/images/coracao.png", className: "heart-icon" }),
    React.createElement("span", { className: "like-count" }, likes)
  );
}

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    const notifListContainer = document.getElementById("notifications-list");
    if (notifListContainer) ReactDOM.createRoot(notifListContainer).render(React.createElement(NotificationList));

    const chatRoot = document.getElementById("dm-chat-root");
    if (chatRoot) ReactDOM.createRoot(chatRoot).render(React.createElement(ChatDM, { currentUserId: chatRoot.dataset.currentUserId }));

    document.querySelectorAll(".like-widget-root").forEach(r => {
        ReactDOM.createRoot(r).render(React.createElement(LikeButton, {
            postId: r.dataset.postId, initialLikes: r.dataset.initialLikes, initialLiked: r.dataset.liked, currentUserId: window.CURRENT_USER_ID
        }));
    });
  } catch (e) { console.error("Erro React:", e); }
});