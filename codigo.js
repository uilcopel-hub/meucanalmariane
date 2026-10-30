let listaGlobalCanais = [];
let categoriaAtual = '';
let secaoAtual = 'canais';
let hlsInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const dadosSalvos = localStorage.getItem('iptv_cache_dados');
  if (dadosSalvos) {
    listaGlobalCanais = JSON.parse(dadosSalvos);
    document.getElementById('status-carregamento').innerText = `${listaGlobalCanais.length} itens carregados do cache local.`;
  } else {
    document.getElementById('status-carregamento').innerText = 'Nenhuma lista encontrada. Atualize ou adicione abaixo.';
  }
});

function entrarNaSecao(secao) {
  if (listaGlobalCanais.length === 0) {
    alert('Por favor, carregue ou adicione listas primeiro!');
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

// Baixa as listas do GitHub automaticamente
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

    listaGlobalCanais.forEach(item => {
      if (item.url) mapUnicos.set(item.url, item);
    });

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

    statusEl.innerText = `Sucesso! Total de ${listaGlobalCanais.length} itens.`;
    alert(`Listas atualizadas! Total de ${listaGlobalCanais.length} itens.`);

  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Erro ao atualizar do GitHub.';
    alert('Erro ao carregar do GitHub.');
  }
}

// Testar múltiplas listas personalizadas
async function testarMultiplasListas() {
  const textoInput = document.getElementById('input-custom-urls').value.trim();
  const statusEl = document.getElementById('test-status');

  if (!textoInput) {
    statusEl.innerText = 'Por favor, insira pelo menos uma URL.';
    statusEl.style.color = '#ff6b6b';
    return;
  }

  const urls = textoInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  statusEl.innerText = `Testando ${urls.length} lista(s)...`;
  statusEl.style.color = '#00adb5';

  let totalCanaisGeral = 0;
  let linksValidos = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const texto = await response.text();
        if (texto.includes('#EXTM3U') || texto.includes('#EXTINF')) {
          const mapTemp = new Map();
          parseM3U(texto, mapTemp);
          totalCanaisGeral += mapTemp.size;
          linksValidos++;
        }
      }
    } catch (e) {
      console.warn(`Erro ao testar a URL: ${url}`, e);
    }
  }

  statusEl.innerText = `Teste concluído: ${linksValidos}/${urls.length} válidas (${totalCanaisGeral} canais).`;
  statusEl.style.color = '#51cf66';
}

// Adicionar múltiplas listas personalizadas
async function adicionarMultiplasListas() {
  const textoInput = document.getElementById('input-custom-urls').value.trim();
  const statusEl = document.getElementById('test-status');

  if (!textoInput) {
    alert('Insira pelo menos uma URL de lista M3U.');
    return;
  }

  const urls = textoInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  statusEl.innerText = `Baixando ${urls.length} lista(s)...`;

  try {
    const mapUnicos = new Map();
    listaGlobalCanais.forEach(item => {
      if (item.url) mapUnicos.set(item.url, item);
    });

    let listasBaixadas = 0;

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const texto = await response.text();
          parseM3U(texto, mapUnicos);
          listasBaixadas++;
        }
      } catch (err) {
        console.warn(`Falha ao carregar a lista: ${url}`, err);
      }
    }

    listaGlobalCanais = Array.from(mapUnicos.values());
    localStorage.setItem('iptv_cache_dados', JSON.stringify(listaGlobalCanais));

    statusEl.innerText = `Sucesso! ${listasBaixadas} lista(s) adicionada(s). Total: ${listaGlobalCanais.length}`;
    statusEl.style.color = '#51cf66';
    
    alert(`Processo concluído! Total acumulado de ${listaGlobalCanais.length} itens.`);
    document.getElementById('input-custom-urls').value = '';

  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Erro ao carregar as listas.';
    statusEl.style.color = '#ff6b6b';
  }
}

// Parser de M3U
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

// Carregar Categorias
function carregarCategorias() {
  const categoriesListEl = document.getElementById('categories-list');
  categoriesListEl.innerHTML = '';

  const itensDaSecao = listaGlobalCanais.filter(item => {
    if (secaoAtual === 'canais') return item.tipo === 'canais';
    return item.tipo === 'filmes';
  });

  const gruposSet = new Set(itensDaSecao.map(i => i.group));
  const gruposArray = Array.from(gruposSet).sort();

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

// Renderizar Grid
function renderizarGrid(itens) {
  const grid = document.getElementById('content-grid');
  grid.innerHTML = '';

  if (itens.length === 0) {
    grid.innerHTML = '<p style="color:#a0aab5; padding: 20px;">Nenhum item encontrado.</p>';
    return;
  }

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

// Reprodução de Mídia
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
      video.play().catch(e => console.log("Autoplay bloqueado:", e));
    });
  } else {
    video.src = item.url;
    video.play().catch(e => console.log("Erro ao reproduzir:", e));
  }
}

// Filtrar Canais por Pesquisa
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
