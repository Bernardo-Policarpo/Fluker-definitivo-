console.log("[reactPolling] carregado");

// ========================================
// SISTEMA DE POLLING COM REACT
// ========================================
// Componentes React para chat, curtidas e notificações
// com atualização automática via polling

const { useState, useEffect, useCallback, useRef } = React;

// Intervalos de polling (em milissegundos)
const NOTIF_POLLING_MS = 2000;  // Notificações a cada 2s
const LIKES_POLLING_MS = 2000;  // Curtidas a cada 2s
const POLLING_MS = 2000;        // Mensagens a cada 2s

// ========================================
// COMPONENTE: CHAT DM COM POLLING
// ========================================
function ChatDM({ currentUserId }) {
  const currentUserNum = Number(currentUserId) || currentUserId;

  // Estados do chat
  const [users, setUsers] = useState([]);                    // Lista de amigos
  const [partnerId, setPartnerId] = useState(null);          // Amigo selecionado
  const [messages, setMessages] = useState([]);              // Mensagens da conversa
  const [messageInput, setMessageInput] = useState("");      // Input de texto
  const [lastMsgId, setLastMsgId] = useState(0);            // Último ID recebido
  const [isSending, setIsSending] = useState(false);        // Flag de envio

  // Refs para controle
  const messagesEndRef = useRef(null);
  const lastSendTime = useRef(0);
  const lastMsgIdRef = useRef(0);
  
  // Sincroniza ref com state
  useEffect(() => {
    lastMsgIdRef.current = lastMsgId;
  }, [lastMsgId]);

  const GAP_MS = POLLING_MS;

  // Carrega lista de amigos (apenas amigos mútuos podem conversar)
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/friends", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Falha ao buscar usuários");
      
      const data = await res.json();
      const list = data.users || [];

      setUsers((prev) => {
        // Verifica se o parceiro atual ainda é amigo
        const stillExists = list.some(
          (u) => String(u.id) === String(partnerId)
        );
        
        if (!stillExists) {
          if (list.length > 0) {
            // Seleciona o primeiro amigo
            setPartnerId(String(list[0].id));
          } else {
            // Sem amigos
            setPartnerId(null);
            setMessages([
              {
                id: "no-friends",
                content: "💬 Para usar o chat, você precisa ter amigos mútuos.",
                sender_id: 0,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        }
        return list;
      });
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    }
  }, [partnerId]);

  // Carrega mensagens da conversa (incremental ou completo)
  const loadMessages = useCallback(
    async (fullReload = false) => {
      if (!partnerId) return;
      
      try {
        const url = new URL("/api/messages", window.location.origin);
        url.searchParams.set("partner_id", String(partnerId));
        
        // Se não for reload completo, busca apenas novas mensagens
        const since = fullReload ? 0 : lastMsgIdRef.current;
        if (since > 0) url.searchParams.set("since_id", String(since));

        const res = await fetch(url.toString(), { credentials: "same-origin" });

        if (!res.ok) {
          if (res.status === 400) {
            // Não são mais amigos
            setMessages([
              {
                id: "error",
                content: "❌ Vocês não são mais amigos. Chat desativado.",
                sender_id: 0,
                timestamp: new Date().toISOString(),
              },
            ]);
            return;
          }
          console.error("loadMessages status:", res.status);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          console.error("Resposta não-JSON (possível redirect).");
          return;
        }

        const data = await res.json();
        const newMessages = Array.isArray(data.messages) ? data.messages : [];

        if (fullReload) {
          // Substitui todas as mensagens
          setMessages(newMessages);
        } else if (newMessages.length > 0) {
          // Adiciona novas mensagens
          setMessages((prev) => [...prev, ...newMessages]);
        }

        // Atualiza último ID recebido
        if (newMessages.length > 0) {
          const maxId = Math.max(...newMessages.map((m) => Number(m.id)));
          setLastMsgId(maxId);
          lastMsgIdRef.current = maxId;
        }
      } catch (e) {
        console.error("Erro ao carregar mensagens:", e);
      }
    },
    [partnerId]
  );

  // Envia uma mensagem
  const sendMessage = useCallback(async () => {
    const now = Date.now();
    
    // Previne spam (debounce)
    if (now - lastSendTime.current < GAP_MS) return;

    const text = messageInput.trim();
    if (!text || !partnerId || isSending) return;

    lastSendTime.current = now;
    setIsSending(true);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ partner_id: String(partnerId), content: text }),
      });

      if (!res.ok) throw new Error("Falha no envio");
      const data = await res.json();

      if (data?.ok) {
        setMessageInput("");
        // Busca novas mensagens (incremental)
        await loadMessages(false);
      }
    } catch (e) {
      console.error("Erro ao enviar:", e);
    } finally {
      setIsSending(false);
    }
  }, [messageInput, partnerId, isSending, loadMessages, GAP_MS]);

  // Carrega usuários na montagem
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Escuta evento de atualização de notificações (pode ter nova amizade)
  useEffect(() => {
    const handler = () => {
      loadUsers();
    };
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, [loadUsers]);

  // Polling de usuários a cada 10s
  useEffect(() => {
    const id = setInterval(() => {
      loadUsers();
    }, 10000);
    return () => clearInterval(id);
  }, [loadUsers]);

  // Quando troca de parceiro, recarrega mensagens
  useEffect(() => {
    if (!partnerId) return;
    
    setMessages([]);
    setLastMsgId(0);
    lastMsgIdRef.current = 0;
    
    // Carrega tudo e rola pro fim
    (async () => {
      await loadMessages(true);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    })();
  }, [partnerId, loadMessages]);

  // Polling de mensagens (incremental)
  useEffect(() => {
    if (!partnerId) return;
    
    const interval = setInterval(() => {
      loadMessages(false);
    }, POLLING_MS);
    
    return () => clearInterval(interval);
  }, [partnerId, loadMessages]);

  // Rola pro fim quando mensagens mudam
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Formata timestamp para exibir apenas hora
  const formatTime = (tsDisplay) => {
    if (!tsDisplay || typeof tsDisplay !== "string") return "";
    // tsDisplay = "DD/MM/YYYY HH:MM"
    const parts = tsDisplay.split(" ");
    if (parts.length < 2) return "";
    return parts[1]; // "HH:MM"
  };

  return React.createElement(
    "div",
    { className: "chat-container" },
    
    // Header com seletor de amigo
    React.createElement(
      "div",
      { className: "chat-header" },
      React.createElement(
        "select",
        {
          id: "chat-partner",
          value: partnerId || "",
          onChange: (e) => setPartnerId(e.target.value),
          className: "chat-select",
        },
        users.map((u) =>
          React.createElement(
            "option",
            { key: u.id, value: String(u.id) },
            u.username || u.email || `user_${u.id}`
          )
        )
      )
    ),
    
    // Área de mensagens
    React.createElement(
      "div",
      { id: "chat-messages", className: "chat-messages" },
      messages.map((m) =>
        React.createElement(
          "div",
          {
            key: m.id,
            className:
              "msg-line " +
              (Number(m.sender_id) === currentUserNum
                ? "msg-me"
                : "msg-partner"),
          },
          `[${formatTime(m.timestamp_display || "")}] <${
            Number(m.sender_id) === currentUserNum ? "me" : "partner"
          }>: ${m.content}`
        )
      ),
      React.createElement("div", { ref: messagesEndRef })
    ),
    
    // Área de input
    React.createElement(
      "div",
      { className: "chat-input-area" },
      React.createElement("input", {
        id: "chat-input",
        type: "text",
        value: messageInput,
        onChange: (e) => setMessageInput(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
          }
        },
        placeholder: "Digite sua mensagem...",
        disabled: isSending,
        autoComplete: "off",
        autoCorrect: "off",
        autoCapitalize: "off",
        spellCheck: false,
      }),
      React.createElement(
        "button",
        {
          id: "chat-send",
          onClick: sendMessage,
          disabled: isSending || !messageInput.trim(),
        },
        "Enviar"
      )
    )
  );
}

// ========================================
// COMPONENTE: BOTÃO DE CURTIDA COM POLLING
// ========================================
function LikeButton({ postId, initialLikes, initialLiked, currentUserId }) {
  // Estados do botão
  const [likes, setLikes] = React.useState(parseInt(initialLikes) || 0);
  const [isLiked, setIsLiked] = React.useState(initialLiked === "true");
  const [isLoading, setIsLoading] = React.useState(false);

  // Polling: sincroniza estado com servidor
  React.useEffect(() => {
    const syncWithServer = async () => {
      try {
        const res = await fetch("/api/post_likes", {
          credentials: "same-origin",
        });
        if (!res.ok) return;

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          console.warn(
            "Resposta não-JSON (possível redirect). Status:",
            res.status
          );
          return;
        }

        const data = await res.json();
        const serverInfo = data[postId];
        
        if (serverInfo) {
          // Verifica se eu curti
          const likesBy = String(serverInfo.likes_by || "")
            .split(";")
            .filter(Boolean);
          const amILiked = likesBy.includes(String(currentUserId));
          const serverLikes = parseInt(serverInfo.likes || 0) || 0;

          setIsLiked(amILiked);
          setLikes(serverLikes);
        }
      } catch {
        // Silencioso
      }
    };

    // Executa imediatamente e depois no intervalo
    syncWithServer();
    const interval = setInterval(syncWithServer, LIKES_POLLING_MS);
    return () => clearInterval(interval);
  }, [postId, currentUserId]);

  // Toggle de curtida (otimista)
  const handleToggle = async () => {
    if (isLoading) return;
    
    const previousLikes = likes;
    const previousLiked = isLiked;

    // Atualização otimista (UI responde imediatamente)
    setIsLiked(!isLiked);
    setLikes(isLiked ? Math.max(0, likes - 1) : likes + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/toggle_like/${postId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-Requested-With": "fetch",
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // Reverte em caso de erro
        setIsLiked(previousLiked);
        setLikes(previousLikes);
        return;
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setIsLiked(previousLiked);
        setLikes(previousLikes);
        return;
      }

      const data = await res.json();
      
      if (!data.success) {
        // Reverte se servidor retornou erro
        setIsLiked(previousLiked);
        setLikes(previousLikes);
      } else {
        // Confirma com dados do servidor
        setLikes(parseInt(data.likes || 0));
        setIsLiked(data.liked === true);
      }
    } catch (err) {
      console.error("Erro ao curtir:", err);
      setIsLiked(previousLiked);
      setLikes(previousLikes);
    } finally {
      setIsLoading(false);
    }
  };

  // Ícone muda conforme estado
  const heartIcon = isLiked ? "redheart.png" : "coracao.png";
  const iconPath = `/static/images/${heartIcon}`;

  return React.createElement(
    "form",
    { className: "like-form", onSubmit: (e) => e.preventDefault() },
    React.createElement(
      "button",
      {
        type: "button",
        className: "heart-btn",
        onClick: handleToggle,
        disabled: isLoading,
        "aria-label": isLiked ? "Descurtir" : "Curtir",
      },
      React.createElement("img", {
        src: iconPath,
        alt: isLiked ? "Curtido" : "Curtir",
        className: "heart-icon",
      }),
      React.createElement("span", { className: "like-count" }, likes)
    )
  );
}

// ========================================
// COMPONENTE: NOTIFICAÇÕES COM POLLING
// ========================================
function NotificationSystem() {
  const { useCallback, useEffect, useState } = React;
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // Busca notificações do servidor
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        credentials: "same-origin",
      });
      if (!res.ok) return;

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        console.warn(
          "Resposta não-JSON (possível redirect). Status:",
          res.status
        );
        return;
      }

      const data = await res.json();
      setUnreadCount(data.unread || 0);
      setNotifications(data.items || []);

      // Dispara evento para outros componentes
      window.dispatchEvent(new Event("notifications-updated"));
    } catch {
      // Silencioso
    }
  }, []);

  // Polling de notificações
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIF_POLLING_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Atualiza badge de não lidas
  useEffect(() => {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      badge.classList.add("show");
    } else {
      badge.textContent = "";
      badge.classList.remove("show");
    }
  }, [unreadCount]);

  // Renderiza lista de notificações no DOM
  useEffect(() => {
    const list = document.getElementById("notifications-list");
    if (!list) return;
    
    list.innerHTML = "";
    
    if (notifications.length === 0) {
      list.innerHTML = '<p class="empty">Não há notificações.</p>';
      return;
    }

    // Helper para criar botões de ação
    const createActionButton = (label, className) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.className = className;
      btn.style.padding = "4px 8px";
      btn.style.fontSize = "12px";
      btn.style.borderRadius = "4px";
      btn.style.border = "1px solid #ddd";
      btn.style.cursor = "pointer";
      return btn;
    };

    // Renderiza até 5 notificações
    notifications.slice(0, 5).forEach((n) => {
      const div = document.createElement("div");
      div.className = "notificacao";
      div.style.fontWeight = n.read === "0" ? "600" : "400";

      // Escapa HTML para segurança
      const text = String(n.text || "Nova mensagem")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

      div.innerHTML = `<p style="margin:0;">${text}</p>`;

      // Adiciona botões de aceitar/rejeitar para solicitações de amizade
      if (n.type === "friend_request" && n.actor_id) {
        const requesterId = String(n.actor_id);

        const actions = document.createElement("div");
        actions.style.marginTop = "6px";
        actions.style.display = "flex";
        actions.style.gap = "6px";

        const acceptBtn = createActionButton("Aceitar", "btn btn-accept");
        acceptBtn.style.background = "#e8f5e9";
        acceptBtn.style.borderColor = "#c8e6c9";

        const rejectBtn = createActionButton("Negar", "btn btn-reject");
        rejectBtn.style.background = "#ffebee";
        rejectBtn.style.borderColor = "#ffcdd2";

        // Helper para desabilitar ambos os botões
        const disableBoth = (v) => {
          acceptBtn.disabled = v;
          rejectBtn.disabled = v;
          acceptBtn.style.opacity = v ? ".6" : "1";
          rejectBtn.style.opacity = v ? ".6" : "1";
          acceptBtn.style.cursor = v ? "default" : "pointer";
          rejectBtn.style.cursor = v ? "default" : "pointer";
        };

        // Handler de aceitar
        acceptBtn.onclick = async (e) => {
          e.preventDefault();
          disableBoth(true);
          
          try {
            const res = await fetch("/api/friend_request/accept", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requester_id: requesterId }),
            });
            
            if (res.ok) {
              // Atualiza notificações
              window.dispatchEvent(new Event("notifications-updated"));
            } else {
              disableBoth(false);
            }
          } catch {
            disableBoth(false);
          }
        };

        // Handler de rejeitar
        rejectBtn.onclick = async (e) => {
          e.preventDefault();
          disableBoth(true);
          
          try {
            const res = await fetch("/api/friend_request/reject", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requester_id: requesterId }),
            });
            
            if (res.ok) {
              window.dispatchEvent(new Event("notifications-updated"));
            } else {
              disableBoth(false);
            }
          } catch {
            disableBoth(false);
          }
        };

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
        div.appendChild(actions);
      }

      list.appendChild(div);
    });
  }, [notifications]);

  return null; // Componente sem UI própria
}

// ========================================
// INICIALIZAÇÃO DOS COMPONENTES REACT
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("[reactPolling] DOMContentLoaded");
    
    // Monta NotificationSystem
    const notifRoot = document.createElement("div");
    document.body.appendChild(notifRoot);
    ReactDOM.createRoot(notifRoot).render(
      React.createElement(NotificationSystem)
    );
    console.log("[reactPolling] Notification montado");

    // Monta Chat DM
    const chatRoot = document.getElementById("dm-chat-root");
    console.log("[reactPolling] chatRoot=", chatRoot);
    
    if (chatRoot) {
      const currentUserId =
        Number(chatRoot.dataset.currentUserId) ||
        chatRoot.dataset.currentUserId;
      
      ReactDOM.createRoot(chatRoot).render(
        React.createElement(ChatDM, { currentUserId })
      );
      console.log(
        "[reactPolling] Chat montado com currentUserId=",
        currentUserId
      );
    } else {
      console.warn("[reactPolling] #dm-chat-root não encontrado");
    }

    // Monta botões de curtida
    document.querySelectorAll(".like-widget-root").forEach((root) => {
      ReactDOM.createRoot(root).render(
        React.createElement(LikeButton, {
          postId: root.dataset.postId,
          initialLikes: root.dataset.initialLikes,
          initialLiked: root.dataset.liked,
          currentUserId: window.CURRENT_USER_ID,
        })
      );
    });
    console.log("[reactPolling] Likes montados");
    
  } catch (err) {
    console.error("[reactPolling] erro durante montagem:", err);
  }
});