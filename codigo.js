let listaGlobalCanais = [];
let categoriaAtual = '';
let secaoAtual = 'canais'; // 'canais' ou 'filmes'
let hlsInstance = null;

// Ao carregar a página, verifica se já existem dados salvos no navegador
document.addEventListener('DOMContentLoaded', () => {
  const dadosSalvos = localStorage.getItem('iptv_cache_dados');
  if (dadosSalvos) {
    listaGlobalCanais = JSON.parse(dadosSalvos);
    document.getElementById('status-carregamento').innerText = `${listaGlobalCanais.length} itens carregados do cache local.`;
  } else {
    document.getElementById('status-carregamento').innerText = 'Nenhuma lista encontrada. Clique em "Atualizar Listas".';
  }
});

// Função para alternar telas
function entrarNaSecao(secao) {
  if (listaGlobalCanais.length === 0) {
    alert('Por favor, clique em "Atualizar e Baixar Listas" primeiro!');
    return;
  }
  secaoAtual = secao;
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('player-screen').style.display = 'flex';
  document.getElementById('titulo-secao-atual').innerText = secao === 'canais' ? 'Canais de TV' : 'Filmes e Séries';

  carregarCategorias();
}

function voltarParaHome() {
  document.getElementById('player-screen').style.display = 'none';
  document.getElementById('home-screen').style.display = 'flex';
}

// Baixa os arquivos M3U do repositório iptv-com/iptv via API do GitHub
async function atualizarListasDoGithub() {
  const statusEl = document.getElementById('status-carregamento');
  statusEl.innerText = 'Conectando ao GitHub e baixando listas...';

  const repoOwner = 'iptv-com';
  const repoName = 'iptv';
  const folderPath = 'lists';

  try {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}`);
    const files = await res.json();

    const m3uFiles = files.filter(f => f.name.endsWith('.m3u') || f.name.endsWith('.m3u8'));
    const mapUnicos = new Map();

    for (const file of m3uFiles) {
      try {
        const fileRes = await fetch(file.download_url);
        const text = await fileRes.text();
        parseM3U(text, mapUnicos);
      } catch (e) {
        console.warn(`Erro ao baixar ${file.name}:`, e);
      }
    }

    listaGlobalCanais = Array.from(mapUnicos.values());
    localStorage.setItem('iptv_cache_dados', JSON.stringify(listaGlobalCanais));

    statusEl.innerText = `Sucesso! ${listaGlobalCanais.length} canais/filmes carregados.`;
    alert(`Listas atualizadas com sucesso! Total de ${listaGlobalCanais.length} itens únicos.`);

  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Erro ao atualizar listas. Verifique sua conexão.';
    alert('Erro ao carregar do GitHub. Verifique o console.');
  }
}

// Parser inteligente de M3U
function parseM3U(m3uText, mapDestino) {
  const lines = m3uText.split('\n');
  let currentItem = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.split(',');
      const name = nameMatch.length > 1 ? nameMatch.slice(1).join(',').trim() : 'Sem Nome';
      
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/150';

      const groupMatch = line.match(/group-title="([^"]+)"/);
      const group = groupMatch ? groupMatch[1] : 'Geral';

      // Inferir se é filme/série ou canal com base no nome ou grupo
      const isFilmeOuSerie = group.toLowerCase().includes('filme') || 
                             group.toLowerCase().includes('vod') || 
                             group.toLowerCase().includes('série') || 
                             name.toLowerCase().includes('filme');

      currentItem = { name, logo, group, tipo: isFilmeOuSerie ? 'filmes' : 'canais' };

    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      currentItem.url = line;
      if (currentItem.url && !mapDestino.has(currentItem.url)) {
        mapDestino.set(currentItem.url, { ...currentItem });
      }
      currentItem = {};
    }
  }
}

// Carregar categorias na barra lateral com base na seção escolhida
function carregarCategorias() {
  const categoriesListEl = document.getElementById('categories-list');
  categoriesListEl.innerHTML = '';

  // Filtra itens da seção atual (canais ou filmes)
  const itensDaSecao = listaGlobalCanais.filter(item => {
    if (secaoAtual === 'canais') return item.tipo === 'canais';
    return item.tipo === 'filmes';
  });

  // Extrai grupos únicos
  const gruposSet = new Set(itensDaSecao.map(i => i.group));
  const gruposArray = Array.from(gruposSet).sort();

  // Adiciona opção "Todos"
  const liTodos = document.createElement('li');
  liTodos.innerText = '📂 Todos os Itens';
  liTodos.className = 'active';
  liTodos.onclick = () => {
    document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
    liTodos.classList.add('active');
    categoriaAtual = '';
    renderizarGrid(itensDaSecao);
  };
  categoriesListEl.appendChild(liTodos);

  gruposArray.forEach(grupo => {
    const li = document.createElement('li');
    li.innerText = grupo;
    li.onclick = () => {
      document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      categoriaAtual = grupo;
      const filtrados = itensDaSecao.filter(i => i.group === grupo);
      renderizarGrid(filtrados);
    };
    categoriesListEl.appendChild(li);
  });

  renderizarGrid(itensDaSecao);
}

// Renderizar os cards na grade central
function renderizarGrid(itens) {
  const grid = document.getElementById('content-grid');
  grid.innerHTML = '';

  if (itens.length === 0) {
    grid.innerHTML = '<p style="color:#a0aab5; padding: 20px;">Nenhum item encontrado nesta categoria.</p>';
    return;
  }

  // Limita a exibição inicial para evitar travamentos de DOM se houver milhares de itens
  const itensLimitados = itens.slice(0, 150);

  itensLimitados.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
      <img src="${item.logo}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150'">
      <p title="${item.name}">${item.name}</p>
    `;
    card.onclick = () => reproduzirMidia(item);
    grid.appendChild(card);
  });
}

// Reproduzir vídeo com HLS.js
function reproduzirMidia(item) {
  document.getElementById('current-title').innerText = item.name;
  document.getElementById('current-group').innerText = `Categoria: ${item.group}`;

  const video = document.getElementById('video-player');

  if (hlsInstance) {
    hlsInstance.destroy();
  }

  if (Hls.isSupported() && item.url.includes('.m3u8')) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(item.url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.log("Autoplay bloqueado pelo browser:", e));
    });
  } else {
    video.src = item.url;
    video.play().catch(e => console.log("Erro ao reproduzir:", e));
  }
}

// Barra de busca em tempo real
function filtrarCanais() {
  const termo = document.getElementById('input-busca').value.toLowerCase();
  
  const itensDaSecao = listaGlobalCanais.filter(item => {
    const matchSecao = (secaoAtual === 'canais' && item.tipo === 'canais') || (secaoAtual === 'filmes' && item.tipo === 'filmes');
    const matchCategoria = categoriaAtual === '' || item.group === categoriaAtual;
    const matchBusca = item.name.toLowerCase().includes(termo);
    return matchSecao && matchCategoria && matchBusca;
  });

  renderizarGrid(itensDaSecao);
}