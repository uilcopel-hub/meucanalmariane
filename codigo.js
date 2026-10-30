const VERSAO_APP = "v1.2";
let listaGlobalCanais = [];
let categoriaAtual = '';
let secaoAtual = 'canais';
let hlsInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log(`Smart IPTV Player carregado na versão ${VERSAO_APP}`);
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

// Testar múltiplas listas ou links diretos
async function testarMultiplasListas() {
  const textoInput = document.getElementById('input-custom-urls').value.trim();
  const statusEl = document.getElementById('test-status');

  if (!textoInput) {
    statusEl.innerText = 'Por favor, insira pelo menos uma URL.';
    statusEl.style.color = '#ff6b6b';
    return;
  }

  const urls = textoInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  statusEl.innerText = `Testando ${urls.length} link(s)...`;
  statusEl.style.color = '#00adb5';

  let totalCanaisGeral = 0;
  let linksValidos = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' }).catch(() => fetch(url));
      if (response.ok) {
        const mapTemp = new Map();
        if (url.endsWith('.m3u') || url.endsWith('.m3u8')) {
          try {
            const resGet = await fetch(url);
            const texto = await resGet.text();
            parseM3U(texto, mapTemp, url);
          } catch (e) {
            adicionarLinkDireto(url, mapTemp);
          }
        } else {
          adicionarLinkDireto(url, mapTemp);
        }

        totalCanaisGeral += mapTemp.size;
        linksValidos++;
      }
    } catch (e) {
      const mapTemp = new Map();
      adicionarLinkDireto(url, mapTemp);
      totalCanaisGeral += mapTemp.size;
      linksValidos++;
    }
  }

  statusEl.innerText = `Teste concluído: ${linksValidos}/${urls.length} válidos (${totalCanaisGeral} canais/streams encontrados).`;
  statusEl.style.color = '#51cf66';
}

// Adicionar múltiplas listas ou links diretos
async function adicionarMultiplasListas() {
  const textoInput = document.getElementById('input-custom-urls').value.trim();
  const statusEl = document.getElementById('test-status');

  if (!textoInput) {
    alert('Insira pelo menos uma URL.');
    return;
  }

  const urls = textoInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  statusEl.innerText = `Processando ${urls.length} link(s)...`;

  try {
    const mapUnicos = new Map();
    listaGlobalCanais.forEach(item => {
      if (item.url) mapUnicos.set(item.url, item);
    });

    let linksAdicionados = 0;

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const texto = await response.text();
          if (texto.includes('#EXTM3U') || texto.includes('#EXTINF')) {
            parseM3U(texto, mapUnicos);
          } else {
            adicionarLinkDireto(url, mapUnicos);
          }
        } else {
          adicionarLinkDireto(url, mapUnicos);
        }
        linksAdicionados++;
      } catch (err) {
        adicionarLinkDireto(url, mapUnicos);
        linksAdicionados++;
      }
    }

    listaGlobalCanais = Array.from(mapUnicos.values());
    localStorage.setItem('iptv_cache_dados', JSON.stringify(listaGlobalCanais));

    statusEl.innerText = `Sucesso! ${linksAdicionados} link(s) processado(s). Total: ${listaGlobalCanais.length}`;
    statusEl.style.color = '#51cf66';
    
    alert(`Processo concluído! Total acumulado de ${listaGlobalCanais.length} itens.`);
    document.getElementById('input-custom-urls').value = '';

  } catch (err) {
    console.error(err);
    statusEl.innerText = 'Erro ao carregar os links.';
    statusEl.style.color = '#ff6b6b';
  }
}

// Cria um canal individual a partir de um link direto
function adicionarLinkDireto(url, mapDestino) {
  if (!url || mapDestino.has(url)) return;

  let nomeCanal = 'Canal Personalizado';
  try {
    const partes = url.split('/');
    const ultimaParte = partes[partes.length - 1] || partes[partes.length - 2];
    if (ultimaParte) {
      nomeCanal = decodeURIComponent(ultimaParte).replace(/\.(m3u8|mp4|m3u|ts)$/i, '');
      if (nomeCanal.length > 25) nomeCanal = nomeCanal.substring(0, 25);
    }
  } catch (e) {}

  mapDestino.set(url, {
    name: nomeCanal.toUpperCase(),
    logo: 'https://via.placeholder.com/150/00adb5/ffffff?text=STREAM',
    group: 'Personalizados',
    tipo: 'canais',
    url: url
  });
}

// Parser de M3U
function parseM3U(m3uText, mapDestino, sourceUrl = '') {
  const lines = m3uText.split('\n');
  let currentItem = {};
  let encontrouTags = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      encontrouTags = true;
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
      if (!currentItem.name) {
        currentItem.name = 'Canal Stream';
        currentItem.logo = 'https://via.placeholder.com/150';
        currentItem.group = 'Geral';
        currentItem.tipo = 'canais';
      }
      if (currentItem.url && !mapDestino.has(currentItem.url)) {
        mapDestino.set(currentItem.url, { ...currentItem });
      }
      currentItem = {};
    }
  }

  if (!encontrouTags && sourceUrl) {
    adicionarLinkDireto(sourceUrl, mapDestino);
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

// Reprodução de Mídia com tratamento de HTTPS/HTTP
function reproduzirMidia(item) {
  document.getElementById('current-title').innerText = item.name;
  document.getElementById('current-group').innerText = `Categoria: ${item.group}`;

  const video = document.getElementById('video-player');

  if (hlsInstance) {
    hlsInstance.destroy();
  }

  let streamUrl = item.url;
  
  if (window.location.protocol === 'https:' && streamUrl.startsWith('http://')) {
    console.warn('Aviso: O stream usa HTTP e a página usa HTTPS. O navegador poderá bloquear o vídeo por Mixed Content.');
  }

  if (Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('live'))) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.log("Autoplay bloqueado:", e));
    });
  } else {
    video.src = streamUrl;
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
