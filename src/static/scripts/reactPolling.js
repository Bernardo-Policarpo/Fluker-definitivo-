console.log("[reactPolling] carregado");

// react-polling.js - Sistema de polling com React e fetch
const { useState, useEffect, useCallback, useRef } = React;

const NOTIF_POLLING_MS = 5000;
const LIKES_POLLING_MS = 1500;
const POLLING_MS = 1500;

/* ====
   COMPONENTE: CHAT DM COM POLLING
   ==== */
function ChatDM({ currentUserId }) {
  const currentUserNum = Number(currentUserId) || currentUserId;

  const [users, setUsers] = useState([]);
  const [partnerId, setPartnerId] = useState(null); // mantenha como string
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [lastMsgId, setLastMsgId] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef(null);
  const lastSendTime = useRef(0);
  const lastMsgIdRef = useRef(0);
  useEffect(() => {
    lastMsgIdRef.current = lastMsgId;
  }, [lastMsgId]);

  const GAP_MS = POLLING_MS;

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Falha ao buscar usuários");
      const data = await res.json();
      const list = data.users || [];
      setUsers(list);

      if (list.length > 0 && !partnerId) {
        setPartnerId(String(list[0].id)); // string
      }
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    }
  }, [partnerId]);

  const loadMessages = useCallback(
    async (fullReload = false) => {
      if (!partnerId) return;
      try {
        const url = new URL("/api/messages", window.location.origin);
        url.searchParams.set("partner_id", String(partnerId));
        const since = fullReload ? 0 : lastMsgIdRef.current;
        if (since > 0) url.searchParams.set("since_id", String(since));

        const res = await fetch(url.toString(), { credentials: "same-origin" });
        if (!res.ok) {
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
          setMessages(newMessages);
        } else if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
        }

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

  const sendMessage = useCallback(async () => {
    const now = Date.now();
    if (now - lastSendTime.current < GAP_MS) return;

    const text = messageInput.trim();
    if (!text || !partnerId || isSending) return;

    lastSendTime.current = now;
    setIsSending(true);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin", // IMPORTANTE: sessão Flask
        body: JSON.stringify({ partner_id: String(partnerId), content: text }),
      });

      if (!res.ok) throw new Error("Falha no envio");
      const data = await res.json();

      if (data?.ok) {
        setMessageInput("");
        // Busca apenas o que é novo (since_id já mantido via lastMsgIdRef)
        await loadMessages(false);
      }
    } catch (e) {
      console.error("Erro ao enviar:", e);
    } finally {
      setIsSending(false);
    }
  }, [messageInput, partnerId, isSending, loadMessages, GAP_MS]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!partnerId) return;
    setMessages([]);
    setLastMsgId(0);
    lastMsgIdRef.current = 0;
    // carrega tudo e depois rola pro fim
    (async () => {
      await loadMessages(true);
      // rola no próximo tick para garantir DOM atualizado
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    })();
  }, [partnerId, loadMessages]);

  // Polling: busca novas mensagens a cada 3s, incremental (since_id)
  useEffect(() => {
    if (!partnerId) return;
    const interval = setInterval(() => {
      loadMessages(false);
    }, POLLING_MS);
    return () => clearInterval(interval);
  }, [partnerId, loadMessages]);

  useEffect(() => {
    // sempre que a lista muda (append ou reload), rola pro fim
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (timestamp) => {
    try {
      const d = new Date(timestamp);
      const h = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${min}`;
    } catch {
      return "";
    }
  };

  return React.createElement(
    "div",
    { className: "chat-container" },
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
          `[${formatTime(m.timestamp)}] <${
            Number(m.sender_id) === currentUserNum ? "me" : "partner"
          }>: ${m.content}`
        )
      ),
      React.createElement("div", { ref: messagesEndRef })
    ),
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

/* ====
   COMPONENTE: BOTÃO DE CURTIDA COM POLLING
   ==== */
function LikeButton({ postId, initialLikes, initialLiked, currentUserId }) {
  const [likes, setLikes] = useState(parseInt(initialLikes) || 0);
  const [isLiked, setIsLiked] = useState(initialLiked === "true");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const res = await fetch("/api/post_likes");
        if (!res.ok) return;
        const data = await res.json();
        const serverInfo = data[postId];
        if (serverInfo) {
          const likesBy = String(serverInfo.likes_by || "")
            .split(";")
            .filter(Boolean);
          const amILiked = likesBy.includes(String(currentUserId));
          const serverLikes = parseInt(serverInfo.likes || 0) || 0;
          setIsLiked(amILiked);
          setLikes(serverLikes);
        }
      } catch {
        /* noop */
      }
    };
    const interval = setInterval(syncWithServer, LIKES_POLLING_MS);
    return () => clearInterval(interval);
  }, [postId, currentUserId]);

  const handleToggle = async () => {
    if (isLoading) return;
    const previousLikes = likes;
    const previousLiked = isLiked;

    setIsLiked(!isLiked);
    setLikes(isLiked ? Math.max(0, likes - 1) : likes + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`/curtir/${postId}`, {
        method: "POST",
        headers: { "X-Requested-With": "fetch" },
      });
      if (!res.ok) {
        setIsLiked(previousLiked);
        setLikes(previousLikes);
      }
    } catch (err) {
      console.error("Erro ao curtir:", err);
      setIsLiked(previousLiked);
      setLikes(previousLikes);
    } finally {
      setIsLoading(false);
    }
  };

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

/* ====
   COMPONENTE: NOTIFICAÇÕES COM POLLING
   ==== */
function NotificationSystem() {
  const { useCallback, useEffect, useState } = React;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread || 0);
      setNotifications(data.items || []);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIF_POLLING_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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

  useEffect(() => {
    const list = document.getElementById("notifications-list");
    if (!list) return;
    list.innerHTML = "";
    if (notifications.length === 0) {
      list.innerHTML = '<p class="empty">Não há notificações.</p>';
      return;
    }
    notifications.slice(0, 3).forEach((n) => {
      const div = document.createElement("div");
      div.className = "notificacao";
      div.style.fontWeight = n.read === "0" ? "600" : "400";
      const text = String(n.text || "Nova mensagem")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      div.innerHTML = `<p>${text} <small style="opacity:.7">${
        n.timestamp || ""
      }</small></p>`;
      list.appendChild(div);
    });
  }, [notifications]);

  return null;
}

/* ====
   INICIALIZAÇÃO DOS COMPONENTES REACT (React 18)
   ==== */
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("[reactPolling] DOMContentLoaded");
    // NotificationSystem
    const notifRoot = document.createElement("div");
    document.body.appendChild(notifRoot);
    ReactDOM.createRoot(notifRoot).render(
      React.createElement(NotificationSystem)
    );
    console.log("[reactPolling] Notification montado");

    // Chat DM
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

    // Likes
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
