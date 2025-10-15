function showSection(id) {
  const sections = document.querySelectorAll('.content');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

const posts = [
  {
    usuario: "Fluker",
    imagem: "img/perfil.jpg",
    descricao: "FLUKER logo post",
    comentarios: []
  },
  {
    usuario: "Bernardo.Policarpo",
    imagem: "img/perfil.jpg",
    descricao: "Post sobre o projeto Fluker",
    comentarios: []
  },
  {
    usuario: "Lucas.Gabriel",
    imagem: "img/perfil.jpg",
    descricao: "Comentário sobre a plataforma",
    comentarios: []
  }
];

function carregarFeed() {
  const container = document.querySelector("#inicio .posts");
  if (!container) return;

  container.innerHTML = "";

  posts.forEach((post, index) => {
    const div = document.createElement("div");
    div.className = "post";

    div.innerHTML = `
      <div class="post-content">
        <div class="post-main">
          <div class="post-header">
            <img src="${post.imagem}" alt="${post.usuario}" class="post-avatar" />
            <h3>${post.usuario}</h3>
          </div>
          <p>${post.descricao}</p>
          <div class="post-actions">
            <button onclick="curtir(${index})">❤️ Curtir</button>
            <button onclick="comentar(${index})">💬 Comentar</button>
            <button onclick="compartilhar(${index})">🔄 Compartilhar</button>
          </div>
        </div>

        <div class="post-side">
          <div class="comentarios-laterais" id="comentarios-${index}">
            <h4>Comentários</h4>
            ${post.comentarios.map((c, ci) => `
              <div class="comentario">
                <p><strong>${c.autor}:</strong> ${c.texto}</p>
                <div class="comentario-actions">
                  <button onclick="responder(${index}, ${ci})">↩️</button>
                  <button onclick="curtirComentario(${index}, ${ci})">❤️ ${c.likes || 0}</button>
                </div>
                ${c.respostas?.map(r => `<p class="resposta"><strong>${r.autor}:</strong> ${r.texto}</p>`).join("") || ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function curtir(index) {
  alert(`Você curtiu o post de ${posts[index].usuario}`);
}

function comentar(index) {
  const comentario = prompt(`Digite seu comentário para ${posts[index].usuario}:`);
  if (comentario) {
    posts[index].comentarios.push({ autor: "Você", texto: comentario, likes: 0, respostas: [] });
    carregarFeed();
  }
}

function compartilhar(index) {
  alert(`Você compartilhou o post de ${posts[index].usuario}`);
}

function responder(postIndex, comentarioIndex) {
  const resposta = prompt("Digite sua resposta:");
  if (resposta) {
    const comentario = posts[postIndex].comentarios[comentarioIndex];
    if (!comentario.respostas) comentario.respostas = [];
    comentario.respostas.push({ autor: "Você", texto: resposta });
    carregarFeed();
  }
}

function curtirComentario(postIndex, comentarioIndex) {
  posts[postIndex].comentarios[comentarioIndex].likes =
    (posts[postIndex].comentarios[comentarioIndex].likes || 0) + 1;
  carregarFeed();
}

document.addEventListener("DOMContentLoaded", () => {
  showSection("inicio"); // mostra a seção "inicio" ao carregar
  carregarFeed();        // carrega os posts na seção "inicio"
});

function toggleUserMenu() {
  const menu = document.getElementById("user-dropdown");
  menu.classList.toggle("hidden");
}

function logout() {
  alert("Você saiu da conta.");
  // Aqui você pode redirecionar ou limpar dados de sessão
}

document.addEventListener("DOMContentLoaded", () => {
  showSection("inicio");
  carregarFeed();
});

function toggleChat() {
  const modal = document.getElementById('modal-chat');
  modal.classList.toggle('hidden');
}

function closeModal() {
  const modal = document.getElementById('modal-chat');
  modal.classList.add('hidden');
}
