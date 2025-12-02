console.log("[reactPolling] Carregado para Modal Personalizado");

const { useState, useEffect, useCallback, useRef } = React;

// ========================================
// CONFIGURAÇÕES
// ========================================
const POLLING_MS = 2000; // Atualiza a cada 2 segundos

// ========================================
// 1. COMPONENTE: LISTA DE NOTIFICAÇÕES
// ========================================
function NotificationList() {
  const [notifications, setNotifications] = useState([]);

  // Busca dados do servidor
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);

        // ATUALIZA O BADGE (BOLINHA VERMELHA) NO HEADER
        // O React procura pelo elemento fora dele para atualizar o número
        const badge = document.getElementById("notif-badge");
        if (badge) {
            if (data.unread > 0) {
                badge.innerText = data.unread > 99 ? "99+" : data.unread;
                badge.style.display = "flex"; // Ou 'block', dependendo do seu CSS
                badge.classList.add("show");
            } else {
                badge.innerText = "";
                badge.style.display = "none";
                badge.classList.remove("show");
            }
        }
      }
    } catch(e) { console.error(e); }
  }, []);

  // Polling automático
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, POLLING_MS);

    // Escuta evento customizado caso o botão "Marcar todas como lidas" seja clicado fora do React
    const handleRefresh = () => fetchNotifs();
    window.addEventListener("refresh-notifs", handleRefresh);

    return () => {
        clearInterval(interval);
        window.removeEventListener("refresh-notifs", handleRefresh);
    };
  }, [fetchNotifs]);

  // Lógica de Aceitar/Recusar
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
        // Feedback visual rápido
        alert(action === 'accept' ? "Agora vocês são amigos!" : "Solicitação removida.");
        fetchNotifs(); // Atualiza a lista na hora
        
        // Se aceitou, recarrega a página para o Chat funcionar com o novo amigo
        if(action === 'accept') window.location.reload(); 
      } else {
        alert("Erro: " + (json.error || "Tente novamente."));
      }
    } catch(e) { console.error(e); }
  };

  // Renderização da Lista
  if (notifications.length === 0) {
      return React.createElement("div", { style: { padding: '20px', textAlign: 'center', color: '#666' } }, "Nenhuma notificação.");
  }

  return notifications.map(n => 
    React.createElement("div", { 
        key: n.id, 
        className: `notification-item ${n.read === "0" ? "unread" : ""}`,
        style: {
            padding: '10px',
            borderBottom: '1px solid #eee',
            backgroundColor: n.read === "0" ? '#f0f8ff' : 'transparent' // Realça não lidas
        }
    },
      // Texto da notificação
      React.createElement("p", { style: { margin: '0 0 5px 0', fontWeight: n.read === "0" ? 'bold' : 'normal' } }, n.text),
      
      // Botões (SÓ PARA FRIEND REQUEST)
      n.type === 'friend_request' && React.createElement("div", { style: { display: 'flex', gap: '10px', marginBottom: '5px' } },
        React.createElement("button", { 
          onClick: () => handleFriend('accept', n.actor_id),
          style: { 
              background: '#28a745', color: '#fff', border: 'none', 
              padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' 
          }
        }, "Aceitar"),
        React.createElement("button", { 
          onClick: () => handleFriend('reject', n.actor_id),
          style: { 
              background: '#dc3545', color: '#fff', border: 'none', 
              padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' 
          }
        }, "Recusar")
      ),
      
      // Data/Hora
      React.createElement("small", { style: { color: '#888', fontSize: '11px' } }, n.timestamp_display)
    )
  );
}

// ========================================
// 2. CHAT DM (Mantido igual)
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
// 3. LIKE BUTTON (Mantido igual)
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
    // 1. MONTA LISTA DE NOTIFICAÇÕES (No seu Modal)
    const notifListContainer = document.getElementById("notifications-list");
    if (notifListContainer) {
        const root = ReactDOM.createRoot(notifListContainer);
        root.render(React.createElement(NotificationList));
        console.log("✅ React conectado ao #notifications-list");
    } else {
        console.warn("⚠️ #notifications-list não encontrado. Modal não funcionará.");
    }

    // 2. CONFIGURA BOTÃO 'MARCAR TODAS COMO LIDAS' (Do seu HTML)
    const btnMarkAll = document.getElementById("mark-all-read");
    if (btnMarkAll) {
        btnMarkAll.addEventListener("click", () => {
            fetch("/api/notifications/mark_all_read", { method: "POST" })
                .then(() => {
                    // Avisa o React para atualizar a lista
                    window.dispatchEvent(new Event("refresh-notifs"));
                    // Limpa o badge imediatamente
                    const badge = document.getElementById("notif-badge");
                    if(badge) { badge.style.display = 'none'; badge.innerText = ''; }
                });
        });
    }

    // 3. Chat
    const chatRoot = document.getElementById("dm-chat-root");
    if (chatRoot) ReactDOM.createRoot(chatRoot).render(React.createElement(ChatDM, { currentUserId: chatRoot.dataset.currentUserId }));

    // 4. Likes
    document.querySelectorAll(".like-widget-root").forEach(r => {
        ReactDOM.createRoot(r).render(React.createElement(LikeButton, {
            postId: r.dataset.postId, initialLikes: r.dataset.initialLikes, initialLiked: r.dataset.liked, currentUserId: window.CURRENT_USER_ID
        }));
    });

  } catch (e) { console.error("Erro React:", e); }
});