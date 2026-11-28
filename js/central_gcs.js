const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>`

// Endereço do cadastro de clientes para exibir: "Logradouro, número - complemento". Desde 18/11/2026
// número e complemento têm campos próprios (clientes.numero/complemento; no endereco_entrega, as chaves).
function enderecoComNumero(c) {
    const endereco = String(c?.endereco || '').trim()
    const numero = String(c?.numero || '').trim()
    const complemento = String(c?.complemento || '').trim()
    return [[endereco, numero].filter(Boolean).join(', '), complemento].filter(Boolean).join(' - ')
}

// Endereço que vale num documento (orçamento, chamado, requisição): a foto do endereço escolhido
// (js/enderecos.js; id null = principal) ou, sem escolha, o principal do cadastro como sempre foi.
function enderecoDoDocumento(cliente, foto) {
    return foto && typeof foto === 'object' && (foto.endereco || foto.cep) ? foto : (cliente || {})
}

const modelo = (valor1, valor2) => `
    <div class="modelo">
        <label>${valor1}</label>
        <div style="width: 100%; text-align: left;">${valor2}</div>
    </div>`

const labelDestaque = (valor1, valor2) => {

    if (!valor2)
        return ''

    return `
    <div style="${vertical}">
        <div><strong>${valor1}:</strong></div>
        <div style="text-align: left; white-space: pre-wrap;">${valor2}</div>
    </div>`
}

const botao = (valor1, funcao, cor) => `
    <div class="contorno-botoes" style="background-color: ${cor}e3; border: solid 1px ${cor};" onclick="${funcao}">
        <label style="white-space: nowrap;">${valor1}</label>
    </div>
`

const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
`

const modeloBotoes = (imagem, nome, funcao) => {

    if (!imagem.includes('/'))
        imagem = `imagens/${imagem}.png`

    return `
    <div class="atalhos" style="width: 100%;" onclick="${funcao}">
        <img src="${imagem}">
        <label style="cursor: pointer;">${nome}</label>
    </div>
    `
}

const layoutBotao = (nome, funcao, img) => `
    <div onclick="${funcao}" class="botoesRodape">
        <img src="imagens/${img}.png" style="cursor: pointer; width: 2vw;">
        <label>${nome}</label>
    </div>
`

async function executar(nomeFuncao) {
    if (!nomeFuncao) return

    let nome = nomeFuncao
    let params = []

    if (nomeFuncao.includes('(')) {
        const match = nomeFuncao.match(/^([^(]+)\((.*)\)$/)

        if (match) {
            nome = match[1].trim()

            const conteudo = match[2].trim()
            if (conteudo) {
                params = Function(`return [${conteudo}]`)()
            }
        }
    }

    if (typeof window[nome] === 'function') {
        return await window[nome](...params)
    } else {
        popup({ mensagem: `<b>Função não encontrada:</b> ${nomeFuncao}` })
    }
}

async function telaInicialGCS() {

    priExeGCS = false

    atribuirVariaveis()

    criarMenus('inicial')

    iniciarTecnicosLivres()

    if (typeof iniciarLembreteCombustivel === 'function')
        iniciarLembreteCombustivel()

    cUsuario.style.display = 'none'
    toolbar.style.display = 'flex'
    titulo.textContent = 'GCS'

    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading-gcs.png" style="width: 5rem;">
        </div>`

    const tInterna = `
        <div class="telaInterna">
            ${planoFundo}
        </div>`

    tela.innerHTML = tInterna

    criarElementosIniciais()
    auxPendencias()
    await carregarControles()
    await carregarComunicadoGCS()

}

async function salvarDepartamento({ img, nome }) {

    overlayAguarde()

    const input = img ? img.previousElementSibling : null
    nome = nome || input.value || null

    if (!nome)
        return popup({ mensagem: 'Nome em branco' })

    const resposta = await criarDepartamento(nome)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    if (input) {
        input.value = ''
        img.style.display = 'none'
    }

    popup({ imagem: 'imagens/concluido.png', mensagem: 'Salvo com successo' })
}

async function respostaSincronizacao(script) {

    let localResposta = document.getElementById('localResposta')

    localResposta.innerHTML = `<img src="gifs/loading-gcs.png" style="width: 5rem;">`

    const resposta = await sincronizar(script)

    localResposta.innerHTML = resposta.mensagem || 'Sem resposta'

}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function mudarStatus(id, select) {

    const st = select.value

    await enviar(`clientes/${id}/status`, st)

    if (st == 'Invisível')
        enviar(`clientes/${id}/status_arquivado`, st)

}

// Foto de cada usuário para os balões de status, buscada uma vez por sessão.
const fotosUsuariosBalao = new Map()
function fotoUsuarioBalao(usuario) {
    if (!usuario) return Promise.resolve(null)
    const daLista = painelUsuariosEstado?.usuarios?.find(u => u.usuario === usuario)
    if (daLista?.foto) return Promise.resolve(daLista.foto)
    if (!fotosUsuariosBalao.has(usuario))
        fotosUsuariosBalao.set(usuario, pesquisarDB({
            base: 'clientes',
            filtros: { usuario: { op: '=', value: usuario } },
            limite: 1
        }).then(r => r?.resultados?.[0]?.foto || null).catch(() => {
            fotosUsuariosBalao.delete(usuario)
            return null
        }))
    return fotosUsuariosBalao.get(usuario)
}

function balaoNotificacao({ imagem, texto, usuario, status, tempo = 5 }) {

    if (document.title == 'PDF')
        return

    let container = document.querySelector('.popup-mensagens')
    if (!container) {
        container = document.createElement('div')
        container.className = 'popup-mensagens'
        container.style.cssText = `
            position: fixed;
            right: 16px;
            bottom: 16px;
            z-index: 999999;
            display: flex;
            flex-direction: column-reverse;
            align-items: flex-end;
            gap: 10px;
            max-width: min(420px, calc(100vw - 32px));
        `;
        document.body.appendChild(container)
    }

    const msg = document.createElement('div')
    msg.className = 'popup-mensagem'
    msg.setAttribute('role', 'status')
    msg.style.opacity = '0'
    msg.style.transform = 'translateY(20px)'
    msg.style.transition = 'opacity .4s ease, transform .4s ease'

    // Balão de status: foto da pessoa com o ícone do status no canto. Até a foto chegar
    // (ou se não houver), fica só o ícone do status, como antes.
    const icone = escaparAtributo(imagem || 'imagens/comentario.png')
    const visual = usuario !== undefined
        ? `<span class="popup-mensagem-avatar"><img class="popup-mensagem-icone" src="${icone}" alt=""></span>`
        : `<img src="${icone}" alt="">`

    msg.innerHTML = `
        ${visual}
        <div class="popup-mensagem-conteudo">
            ${usuario !== undefined
                ? `<strong>${escaparAtributo(usuario)}</strong><span class="popup-mensagem-status">${escaparAtributo(status || 'offline')}</span>`
                : (texto || '')}
        </div>
        <button class="popup-mensagem-fechar" type="button" aria-label="Fechar notificação">×</button>
    `

    msg.querySelector('.popup-mensagem-fechar').addEventListener('click', () => msg.remove())

    container.appendChild(msg);

    if (usuario !== undefined)
        fotoUsuarioBalao(usuario).then(foto => {
            const avatar = msg.querySelector('.popup-mensagem-avatar')
            if (!foto || !avatar) return
            const img = new Image()
            img.className = 'popup-mensagem-foto'
            img.alt = ''
            img.onload = () => { avatar.prepend(img); avatar.classList.add('com-foto') }
            img.src = urlFotoCliente(foto)
        })

    requestAnimationFrame(() => {
        msg.style.opacity = '1';
        msg.style.transform = 'translateY(0)'
    })

    if (tempo == 0)
        return

    setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transform = 'translateY(20px)'
        setTimeout(() => msg.remove(), 400)
    }, tempo * 1000)
}

function atualizarFotoUsuario(dados) {
    const atual = JSON.parse(localStorage.getItem('acesso') || 'null')
    if (!atual || String(atual.id) !== String(dados.id) || !Object.hasOwn(dados, 'foto')) return
    const foto = dados.foto || null
    if ((atual.foto || null) === foto) return
    atual.foto = foto
    localStorage.setItem('acesso', JSON.stringify(atual))
    if (acesso) acesso.foto = foto
    const imagem = document.querySelector('.nomeUsuario .foto-usuario-menu')
    if (imagem) trocarFotoSemPiscar(imagem, urlFotoCliente(foto))
}

// Carrega a foto nova antes de trocar: a <img> nunca fica vazia no meio do caminho.
// data-foto guarda a foto pedida (não a exibida), para uma foto com erro não ser
// recarregada a cada atualização.
function trocarFotoSemPiscar(imagem, url) {
    if (imagem.dataset.foto === url) return
    imagem.dataset.foto = url
    const previa = new Image()
    previa.onload = () => { if (imagem.dataset.foto === url) imagem.src = url }
    previa.onerror = () => { if (imagem.dataset.foto === url) imagem.src = logo }
    previa.src = url
}

async function usuariosToolbar() {

    if (!acesso)
        return

    const { permissao, usuario, foto } = JSON.parse(localStorage.getItem('acesso')) || {}

    // Esta função roda a cada aviso do websocket que mexe na toolbar. Recriar a <img>
    // toda vez fazia a foto piscar; por isso, se o perfil já está na tela, atualiza no lugar.
    const mostrarPerfil = fotoAtual => {
        if (!nomeUsuario) return
        const url = urlFotoCliente(fotoAtual)
        const rotulo = `<b>${escaparAtributo(inicialMaiuscula(permissao || ''))}</b> ${escaparAtributo(usuario || '')}`

        const imagem = nomeUsuario.querySelector('.foto-usuario-menu')
        const textoAtual = nomeUsuario.querySelector('.rotulo-usuario-menu')
        if (imagem && textoAtual) {
            trocarFotoSemPiscar(imagem, url)
            if (textoAtual.innerHTML !== rotulo) textoAtual.innerHTML = rotulo
            return
        }

        nomeUsuario.innerHTML = `
            <button type="button" class="trocar-foto-menu" onclick="auxiliarFotoUsuario()" aria-label="Trocar minha foto" title="Trocar minha foto">
                <img class="foto-usuario-menu moldura-foto" src="${escaparAtributo(url)}" data-foto="${escaparAtributo(url)}"
                    alt="Foto do usuário" onerror="this.onerror = null; this.src = logo">
            </button>
            <div class="info-usuario-menu">
                <span class="rotulo-usuario-menu">${rotulo}</span>
                <a href="#" class="trocar-senha-menu" onclick="event.preventDefault(); formularioTrocarSenha()">Alterar senha</a>
            </div>`
    }
    mostrarPerfil(foto)

    const [contagem, cadastro] = await Promise.allSettled([
        contarPorCampo({ base: 'clientes', path: 'status' }),
        recuperarDado('clientes', acesso.id)
    ])
    const uOnline = contagem.status === 'fulfilled' ? contagem.value : null
    const user = cadastro.status === 'fulfilled' ? cadastro.value : null

    const usuariosToolbarString = `
        <div class="botao-usuarios">
            <img name="imgStatus" onclick="painelUsuarios()" src="imagens/${user?.status || 'offline'}.png">
            <label style="font-size: 1.2rem;">${uOnline?.online || 0}</label>
        </div>`

    if (user && Object.hasOwn(user, 'foto'))
        mostrarPerfil(user.foto)

    const divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios)
        divUsuarios.innerHTML = usuariosToolbarString

    // Painel de usuários aberto acompanha a mudança de status que disparou esta atualização.
    await atualizarPainelUsuarios()

}

async function carregarXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.async = true;

        script.onload = () => {
            const checkInitialization = () => {
                if (typeof XLSX !== 'undefined' && typeof XLSX.utils !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        };

        script.onerror = () => {
            reject(new Error("Falha ao carregar a biblioteca XLSX"));
        }

        document.head.appendChild(script);
    });
}

// Gera e baixa o PDF direto daqui (pdf_orcamento.js), sem abrir a página de prévia.
async function irPdf(id) {

    await baixarPdfOrcamento(id)

}

function filtrarAAZ(coluna, id) {

    let el = document.getElementById(id)
    let tbody = el.tagName === "TBODY" ? el : el.tBodies[0]
    if (!tbody) return

    let linhas = Array.from(tbody.rows)
    let ascendente = (el.dataset.order ?? "desc") !== "asc"

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna] || '')
        let valorB = capturarValorCelula(b.cells[coluna] || '')

        // Normaliza números com "R$", vírgula etc.
        const parseValor = v => {
            if (typeof v !== 'string') return v
            return parseFloat(
                v.replace(/[^\d,-]/g, '')
                    .replace(',', '.')
            )
        }

        const numA = parseValor(valorA)
        const numB = parseValor(valorB)

        if (!isNaN(numA) && !isNaN(numB)) {
            return ascendente ? numA - numB : numB - numA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    })

    linhas.forEach(linha => tbody.appendChild(linha))
    el.dataset.order = ascendente ? "asc" : "desc"
}

function capturarValorCelula(celula) {
    if (!celula) return ''

    let entrada =
        celula.querySelector('input') ||
        celula.querySelector('textarea') ||
        celula.querySelector('select')

    if (entrada) return entrada.value.toLowerCase()

    return celula.textContent.toLowerCase()
}

// Painel de Usuários: agrupado por disponibilidade (online primeiro, offline por último), com busca
// local e atualização ao vivo (usuariosToolbar chama atualizarPainelUsuarios a cada aviso de status).
const painelUsuariosEstado = { usuarios: [], busca: '', offlineAberto: false }

// Ausente também é posto sozinho após inatividade (js/websocket.js) e sai na próxima interação.
const STATUS_USUARIO_OPCOES = ['online', 'Ausente', 'Em almoço', 'Não perturbe', 'Em reunião', 'Apenas Whatsapp']

const GRUPOS_PAINEL_USUARIOS = [
    { chave: 'disponivel', titulo: 'Disponíveis', status: ['online'] },
    { chave: 'ocupado', titulo: 'Ocupados', status: ['Em reunião', 'Em almoço', 'Não perturbe', 'Apenas Whatsapp'] },
    { chave: 'ausente', titulo: 'Ausentes', status: ['Ausente'] },
    { chave: 'offline', titulo: 'Offline', status: ['offline', 'Invisível'] }
]

// Invisível é offline para os outros; só a própria pessoa vê o status real.
function statusVisivelUsuario({ usuario, status }) {
    if (status === 'Invisível' && usuario !== acesso?.usuario) return 'offline'
    return status || 'offline'
}

function grupoStatusUsuario(status) {
    return GRUPOS_PAINEL_USUARIOS.find(g => g.status.includes(status))?.chave || 'disponivel'
}

async function painelUsuarios() {

    // Já aberto (mesmo minimizado na barra do rodapé): traz de volta e atualiza, sem abrir outro.
    const existente = document.querySelector('.popup .painel-usuarios')?.closest('.popup')
    if (existente) {
        existente.classList.remove('janela-minimizada')
        // O clique é o que leva a janela para a frente e marca o foco (js/janelas.js escuta em captura).
        existente.querySelector('.popup-janela-fora')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        try { await carregarUsuariosPainel() } catch (err) { console.error(err) }
        renderizarPainelUsuarios()
        return
    }

    overlayAguarde()

    try {
        painelUsuariosEstado.busca = ''
        await carregarUsuariosPainel()

        const elemento = `
            <div class="painel-usuarios">
                <div class="painel-usuarios-topo">
                    <div class="painel-usuarios-meu-status"></div>
                    <input type="search" class="painel-usuarios-busca" placeholder="Buscar usuário ou permissão"
                        aria-label="Buscar usuário" oninput="painelUsuariosEstado.busca = this.value; renderizarPainelUsuarios()">
                </div>
                <div class="painel-usuarios-resumo"></div>
                <div class="painel-usuarios-lista"></div>
            </div>`

        popup({ elemento, titulo: 'Usuários' })
        renderizarPainelUsuarios()
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o painel de usuários.' })
    }
}

async function carregarUsuariosPainel() {
    const { resultados } = await pesquisarDB({
        base: 'clientes',
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        limite: 5000
    }) || {}
    painelUsuariosEstado.usuarios = (resultados || [])
        .map(({ id, usuario, nome, status, permissao, foto }) => ({ id, usuario, nome, status, permissao, foto }))
}

// Chamado a cada aviso de status do websocket: só recarrega se o painel estiver aberto.
async function atualizarPainelUsuarios() {
    if (!document.querySelector('.painel-usuarios')) return
    await carregarUsuariosPainel()
    renderizarPainelUsuarios()
}

function renderizarPainelUsuarios() {

    const painel = document.querySelector('.painel-usuarios')
    if (!painel) return

    const normalizar = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const busca = normalizar(painelUsuariosEstado.busca).trim()

    const usuarios = painelUsuariosEstado.usuarios
        .map(u => ({ ...u, statusVisivel: statusVisivelUsuario(u) }))
    const eu = usuarios.find(u => u.usuario === acesso?.usuario)
    const filtrados = usuarios.filter(u => !busca
        || [u.usuario, u.nome, u.permissao].some(campo => normalizar(campo).includes(busca)))

    // Meu status fica no topo, fora da lista: é a única informação que a pessoa edita.
    const opcoes = [...STATUS_USUARIO_OPCOES, ...(acesso?.permissao === 'adm' ? ['Invisível'] : [])]
    painel.querySelector('.painel-usuarios-meu-status').innerHTML = eu ? `
        <img src="imagens/${escaparAtributo(eu.statusVisivel)}.png" alt="">
        <label>Meu status
            <select onchange="mudarStatus(${Number(eu.id)}, this)">
                ${opcoes.map(op => `<option ${eu.status === op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
        </label>` : ''

    const porGrupo = Object.fromEntries(GRUPOS_PAINEL_USUARIOS.map(g => [g.chave, []]))
    for (const u of filtrados)
        porGrupo[grupoStatusUsuario(u.statusVisivel)].push(u)
    for (const lista of Object.values(porGrupo))
        lista.sort((a, b) => String(a.usuario).localeCompare(String(b.usuario), 'pt-BR'))

    painel.querySelector('.painel-usuarios-resumo').innerHTML = GRUPOS_PAINEL_USUARIOS
        .map(g => `<span class="painel-usuarios-chip painel-usuarios-chip--${g.chave}"><b>${porGrupo[g.chave].length}</b> ${g.titulo.toLowerCase()}</span>`)
        .join('')

    const cartao = u => {
        const iniciais = String(u.nome || u.usuario || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
        const detalhe = [u.permissao].filter(Boolean).map(inicialMaiuscula).join(' · ')
        return `
            <div class="painel-usuarios-item${u.usuario === acesso?.usuario ? ' painel-usuarios-item--eu' : ''}">
                <span class="painel-usuarios-avatar" data-iniciais="${escaparAtributo(iniciais)}">
                    ${u.foto ? `<img src="${escaparAtributo(urlFotoCliente(u.foto))}" alt="" onerror="this.remove()">` : ''}
                    <img class="painel-usuarios-status-icone" src="imagens/${escaparAtributo(u.statusVisivel)}.png" alt="${escaparAtributo(u.statusVisivel)}" title="${escaparAtributo(u.statusVisivel)}">
                </span>
                <span class="painel-usuarios-texto">
                    <b>${escaparAtributo(u.usuario)}</b>
                    ${detalhe ? `<small>${escaparAtributo(detalhe)}</small>` : ''}
                </span>
                ${grupoStatusUsuario(u.statusVisivel) === 'ocupado'
                    ? `<span class="painel-usuarios-status">${escaparAtributo(u.statusVisivel)}</span>` : ''}
            </div>`
    }

    // Offline começa recolhido (costuma ser a maior lista); com busca, abre.
    const lista = GRUPOS_PAINEL_USUARIOS
        .filter(g => porGrupo[g.chave].length)
        .map(g => {
            const itens = porGrupo[g.chave].map(cartao).join('')
            const cabecalho = `<span>${g.titulo}</span><b>${porGrupo[g.chave].length}</b>`
            if (g.chave !== 'offline')
                return `<section class="painel-usuarios-grupo painel-usuarios-grupo--${g.chave}"><h4>${cabecalho}</h4><div class="painel-usuarios-grade">${itens}</div></section>`
            return `
                <details class="painel-usuarios-grupo painel-usuarios-grupo--offline" ${painelUsuariosEstado.offlineAberto || busca ? 'open' : ''}
                    ontoggle="if (!painelUsuariosEstado.busca) painelUsuariosEstado.offlineAberto = this.open">
                    <summary><h4>${cabecalho}</h4></summary>
                    <div class="painel-usuarios-grade">${itens}</div>
                </details>`
        })
        .join('')

    painel.querySelector('.painel-usuarios-lista').innerHTML = lista
        || '<p class="painel-usuarios-vazio">Nenhum usuário encontrado.</p>'
}

async function reprocessarAnexos(idPagamento) {
    overlayAguarde()
    return new Promise((resolve, reject) => {

        fetch(`${api}/reprocessar_anexos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idPagamento })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)
                }
                return response.text()
            })
            .then(data => {
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                resolve(data)
            })
            .catch(err => {
                console.log(err)
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                reject(err)
            })
    })
}

function sincronizar(script) {
    return new Promise((resolve, reject) => {

        fetch(`${api}/sincronizar`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script })
        })
            .then(response => response.text())
            .then(data => {
                resolve(JSON.parse(data))
            })
            .catch(error => {
                reject(error)
            });

    })
}

async function verAprovacoes() {

    try {

        const pag = 'aprovacao'

        // Uma lista só (tabela com id fixo): pedir de novo traz a aberta para frente e recarrega.
        const listaAberta = document.getElementById('tAprovacao')
        if (listaAberta) {
            trazerJanelaParaFrente(listaAberta)
            return await paginacao(pag)
        }

        const tabela = await modTab({
            colunas: {
                'Contrato': { chave: 'contrato' },
                'Cliente': { chave: 'cliente' },
                'Total Original <br>[s/desc ou acres]': {},
                'Total Geral': { chave: 'total_geral', tipoPesquisa: 'valor' },
                '%': '',
                'Localização': { chave: 'cidade' },
                'Usuário': { chave: 'responsaveis' },
                'Aprovação': { chave: 'aprovacao.status', tipoPesquisa: 'select' },
                'Comentário': { chave: 'aprovacao.justificativa' },
                'Detalhes': {}
            },
            pag,
            base: 'mvw_dados_orcamentos',
            pag: 'aprovacao',
            criarLinha: 'criarLinhaAprovacao',
            body: 'tAprovacao',
            filtros: {
                'aprovacao': { op: 'NOT_EMPTY' },
                'aprovacao.status': { op: '=', value: 'pendente' },
            }
        })

        const elemento = `
            <div style="${vertical}; padding: 1rem;">
                ${tabela}
            </div>
        `

        popup({ elemento, titulo: 'Aprovações de Orçamento' })

        await paginacao(pag)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir aprovações de orçamento: Fale com o suporte.' })
    }

}

async function criarLinhaAprovacao(orcamento) {

    const {
        timestamp,
        id,
        contrato,
        aprovacao,
        cliente,
        usuario,
        cidade,
        total_bruto,
        total_geral
    } = orcamento || {}

    const status = aprovacao?.status || 'desconhecido'
    const porcentagemDiferenca = (((total_geral - total_bruto) / total_bruto) * 100).toFixed(2)
    const campos = (contrato || [])
        .filter(c => c)
        .join('<br>')

    return `
        <tr>
            <td style="text-align: left;">
                ${campos}
            </td>
            <td style="text-align: left;">
                ${cliente || ''} <br>
                ${new Date(timestamp).toLocaleString()}
            </td>
            <td>${dinheiro(total_bruto)}</td>
            <td>${dinheiro(total_geral)}</td>
            <td>
                <label class="label-aprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label>
            </td>
            <td>${cidade || ''}</td>
            <td>${usuario || '--'}</td>
            <td>
                <div style="display: flex; align-items: center; justify-content: start; gap: 1vw;">
                    <img src="imagens/${status}.png">
                    <label>${status}</label>
                </div>
            </td>
            <td>${aprovacao?.justificativa || '--'}</td>
            <td>
                <img src="imagens/pesquisar.svg" onclick="verPedidoAprovacao('${id}')">
            </td>
        </tr>
        `

}

async function verificarPendencias() {

    const contadorPendencias = document.getElementById('contadorPendencias')
    if (!navigator.onLine || !contadorPendencias)
        return

    try {
        const contador = await contarPorCampo({
            base: 'dados_orcamentos',
            path: 'aprovacao.status'
        })
        contadorPendencias.style.display = contador?.pendente > 0 ? 'flex' : 'none'
        contadorPendencias.textContent = contador?.pendente || 0
    } catch {
        contadorPendencias.style.display = 'none'
        contadorPendencias.textContent = ''
    }

}

async function verPedidoAprovacao(idOrcamento) {

    overlayAguarde()

    if (!pode('orcamentos.aprovacoes'))
        return popup({ mensagem: 'Você não tem acesso' })

    // Um painel por orçamento, cada um com a sua tabela de itens (antes o id era fixo: o segundo
    // painel desenhava os itens dentro do primeiro).
    const painelAberto = document.querySelector(`.pedido-aprovacao[data-orcamento="${CSS.escape(idOrcamento)}"]`)
    if (painelAberto) {
        removerOverlay()
        return trazerJanelaParaFrente(painelAberto)
    }

    const {
        dados_composicoes,
        cliente,
        cidade,
        usuario,
        total_bruto,
        total_geral,
        lpu_ativa,
        contrato
    } = await recuperarDado('mvw_dados_orcamentos', idOrcamento) || {}

    const base = Object.values(dados_composicoes || {})
    const pag = `orcAprovacao_${String(idOrcamento).replace(/[^\w-]/g, '_')}`
    const tabela = await modTab({
        base,
        pag,
        alturaMinima: '60dvh',
        body: pag,
        funcaoAdicional: ['formatarLinhasOrcamento', 'calcularSubtotais'],
        criarLinha: 'linhasOrcAprovacao',
        colunas: {
            'Código': {},
            'Descrição': {},
            'Medida': {},
            'Tipo': {},
            'Quantidade': {},
            'Unit Original': {},
            'Total Original': {},
            'Unitário': {},
            'Total': {},
            'Diferença': {},
            'Imagem': {}
        }
    })

    const divOrganizada = (valor, termo) => {
        return `
            <div class="pedido-aprovacao-campo campo-requisicao">
                <span class="pedido-aprovacao-rotulo">${termo}</span>
                <div class="pedido-aprovacao-valor">${valor}</div>
            </div>
            `
    }

    const totalBruto = total_bruto
    const totalGeral = conversor(total_geral)
    const diferencaDinheiro = totalGeral - totalBruto
    const diferencaPorcentagem = `${(diferencaDinheiro / totalBruto * 100).toFixed(2)}%`

    const linhas = [
        {
            elemento: `
            <div class="pedido-aprovacao requisicao-formulario" data-orcamento="${escaparAtributo(idOrcamento)}">
                
                <div class="pedido-aprovacao-resumo">
                    <section class="pedido-aprovacao-cartao requisicao-contorno">
                        <h3 class="requisicao-titulo">Dados do orçamento</h3>
                        <div class="pedido-aprovacao-campos requisicao-dados">
                        ${divOrganizada(lpu_ativa, 'LPU')}
                        ${divOrganizada(usuario, 'Solicitante')}
                        ${divOrganizada(cliente || '?', 'Cliente')}
                        ${divOrganizada(cidade || '?', 'Localidade')}
                        </div>
                    </section>
                    <section class="pedido-aprovacao-cartao requisicao-contorno">
                        <h3 class="requisicao-titulo">Resumo de valores</h3>
                        <div class="pedido-aprovacao-campos requisicao-dados">
                        ${divOrganizada(dinheiro(totalGeral), 'Total Geral')}
                        ${divOrganizada(dinheiro(totalBruto), 'Total Original (sem Acréscimo e/ou Desconto)')}
                        ${divOrganizada(`<label class="label-aprovacao" style="background-color: ${diferencaDinheiro > 0 ? 'green' : '#B12425'}">${dinheiro(diferencaDinheiro)}</label>`, 'Diferença em Dinheiro')}
                        ${divOrganizada(diferencaPorcentagem, 'Percentual')}
                        </div>
                    </section>
                </div>

                <div style="${horizontal} gap: 5px;" onclick="visibilidadeOrcamento(this)">
                    <img src="imagens/olhoFechado.png">
                    <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                </div>

                <div class="pedido-aprovacao-itens" style="display: none;">
                    ${tabela}
                </div>

            </div>`
        }
    ]

    const botoes = [
        { texto: 'Aprovar', img: 'concluido', funcao: `respostaAprovacao('${idOrcamento}', 'aprovado')` },
        { texto: 'Reprovar', img: 'cancel', funcao: `respostaAprovacao('${idOrcamento}', 'reprovado')` },
    ]

    const identificacao = [contrato].flat().filter(Boolean)[0]
    popup({ elemento: linhas[0].elemento, botoes, titulo: `Detalhes${identificacao ? ` · ${identificacao}` : ''}`, autoDestruicao: [pag] })

    await paginacao(pag)

}

function visibilidadeOrcamento(div) {
    let img = div.querySelector('img')
    let label = div.querySelector('label')
    let divTabelas = div.nextElementSibling
    let display = divTabelas.style.display

    if (display == 'none') {
        divTabelas.style.display = 'flex'
        img.src = 'imagens/olhoAberto.png'
        label.textContent = 'Ocultar itens'
    } else {
        divTabelas.style.display = 'none'
        img.src = 'imagens/olhoFechado.png'
        label.textContent = 'Ver itens do Orçamento'
    }
}

function linhasOrcAprovacao(orcamento) {

    const {
        codigo,
        descricao,
        qtde,
        custo,
        custo_original,
        medida,
        tipo
    } = orcamento || {}

    const total = custo * qtde
    const totalOriginal = custo_original
        ? custo_original * qtde
        : 0

    let divDiferenca = ''

    if (custo_original) {

        // Novo menos original, como no resumo do topo: positivo = acréscimo, negativo = desconto.
        const diferenca = total - totalOriginal
        const seta = diferenca > 0 ? 'acima' : diferenca < 0 ? 'abaixo' : null

        divDiferenca = `
            <div style="${horizontal}; gap: 1rem;" title="${diferenca > 0 ? 'Acréscimo' : diferenca < 0 ? 'Desconto' : 'Sem diferença'}">
                ${seta ? `<img src="imagens/${seta}.png">` : ''}
                <span>${dinheiro(diferenca)}</span>
            </div>
        `
    }


    return `
        <tr>
            <td>${codigo}</td>
            <td>${descricao || ''}</td>
            <td>${medida || 'UN'}</td>
            <td>${tipo}</td>
            <td>${qtde}</td>

            <td>${dinheiro(custo_original)}</td>
            <td>${dinheiro(totalOriginal)}</td>

            <td>${dinheiro(custo)}</td>
            <td>${dinheiro(total)}</td>

            <td>
                ${divDiferenca}
            </td>

            <td>
                <img data-composicao="${escaparAtributo(codigo)}" src="${logo}" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo">
            </td>

        </tr>
    `

}

async function respostaAprovacao(idOrcamento, status) {

    // Fecha o painel DESTE orçamento (com vários abertos, "o último" pode ser outro).
    const janelaPainel = document.querySelector(`.pedido-aprovacao[data-orcamento="${CSS.escape(idOrcamento)}"]`)
        ?.closest('.popup')?.id || null

    overlayAguarde()

    const dados = {
        usuario: acesso.usuario,
        data: dataServidor().toLocaleString(),
        status
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    orcamento.aprovacao = {
        ...orcamento.aprovacao,
        ...dados
    }

    await enviar(`dados_orcamentos/${idOrcamento}/aprovacao`, orcamento.aprovacao)

    removerPopup(janelaPainel)

    verificarPendencias()

}

// ---------------------------------------------------------------- Rascunhos do Criar Orçamento
// A tela lê e grava o rascunho na cópia local (localStorage "temporario", por idEdicao) sem esperar a
// rede; cada alteração vai para o banco (orcamentos_rascunhos, rotas /rascunhos/*) segundos depois.
// Assim o rascunho abre em outro computador, não some ao limpar o navegador e o adm acompanha/recupera.
// "temporario_meta" guarda, por rascunho, quando mudou e quando foi enviado (fora do orçamento: campo
// novo no objeto iria para dados_orcamentos no salvar).
const RASCUNHO_ESPERA_MS = 2000
const rascunhosAgendados = new Map()
const rascunhosEmMemoria = {} // reserva quando o localStorage enche (a cópia do banco continua valendo)
let rascunhosLocaisConferidos = false

function lerTemporarioLocal() {
    try { return JSON.parse(localStorage.getItem('temporario')) || {} } catch { return {} }
}

function lerMetaRascunhos() {
    try { return JSON.parse(localStorage.getItem('temporario_meta')) || {} } catch { return {} }
}

function gravarMetaRascunho(id, campos) {
    const meta = lerMetaRascunhos()
    if (campos === null) delete meta[id]
    else meta[id] = { ...meta[id], ...campos }
    try { localStorage.setItem('temporario_meta', JSON.stringify(meta)) } catch { }
}

function gravarTemporarioLocal(temporario) {
    try {
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return true
    } catch (erro) {
        // Cota do navegador cheia: segue em memória e no banco (envio imediato logo abaixo).
        console.warn('[rascunhos] localStorage cheio', erro)
        return false
    }
}

async function rotaRascunhos(caminho, corpo = {}, opcoes = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/rascunhos/${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
        ...opcoes
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || `Falha nos rascunhos (${resposta.status})`)
    return dados
}

function agendarEnvioRascunho(id, imediato = false) {
    clearTimeout(rascunhosAgendados.get(id))
    rascunhosAgendados.set(id, setTimeout(() => enviarRascunho(id), imediato ? 0 : RASCUNHO_ESPERA_MS))
}

async function enviarRascunho(id, opcoes = {}) {
    rascunhosAgendados.delete(id)
    const dados = rascunhosEmMemoria[id] || lerTemporarioLocal()[id]
    if (!dados) return
    // Tela aberta e abandonada sem item nem cliente não vira rascunho no banco (só depois do 1º envio).
    const vazio = !Object.keys(dados.esquema_composicoes || dados.dados_composicoes || {}).length && !dados.dados_orcam
    if (vazio && !lerMetaRascunhos()[id]?.enviado_em) return
    const enviadoEm = Date.now()
    try {
        const resposta = await rotaRascunhos('salvar', { id, dados }, opcoes)
        if (resposta.encerrado) return rascunhoEncerradoNoBanco(id, dados)
        gravarMetaRascunho(id, { enviado_em: enviadoEm })
    } catch (erro) {
        // Sem rede/servidor: a cópia local fica marcada como não enviada e vai na próxima vez.
        console.warn('[rascunhos] envio adiado', id, erro)
    }
}

// O banco diz que o rascunho já foi salvo/descartado (ex.: em outra aba). Se é o que está aberto
// aqui, o que foi feito nesta aba vira um rascunho novo (nada se perde); senão sai a cópia local.
function rascunhoEncerradoNoBanco(id, dados) {
    const temporario = lerTemporarioLocal()
    delete temporario[id]
    delete rascunhosEmMemoria[id]
    gravarMetaRascunho(id, null)
    if (sessionStorage.getItem('idEdicao') === id) {
        const novo = crypto.randomUUID()
        sessionStorage.setItem('idEdicao', novo)
        temporario[novo] = dados
        gravarMetaRascunho(novo, { alterado_em: Date.now() })
        if (!gravarTemporarioLocal(temporario)) rascunhosEmMemoria[novo] = dados
        agendarEnvioRascunho(novo, true)
        return
    }
    gravarTemporarioLocal(temporario)
}

// Rascunhos que só existem neste navegador (de antes do banco, ou alterados sem rede) sobem uma vez
// por página. Os já enviados e sem alteração depois disso ficam como estão.
async function enviarRascunhosLocaisPendentes() {
    // Versão antiga gravava o rascunho de aba sem edição aberta na chave "null": ganha id próprio e sobe.
    const temporario = lerTemporarioLocal()
    if (temporario.null && typeof temporario.null === 'object') {
        temporario[crypto.randomUUID()] = temporario.null
        delete temporario.null
        if (sessionStorage.getItem('idEdicao') === 'null') sessionStorage.removeItem('idEdicao')
        gravarTemporarioLocal(temporario)
    }
    const meta = lerMetaRascunhos()
    const pendentes = Object.keys(lerTemporarioLocal())
        .filter(id => id && id !== 'null' && !(meta[id]?.enviado_em >= (meta[id]?.alterado_em || 0)))
    for (const id of pendentes) await enviarRascunho(id)
    rascunhosLocaisConferidos = true
}

// Logo depois de abrir a página: sobe o que ficou só neste navegador (de antes do banco ou sem rede).
setTimeout(() => {
    if (JSON.parse(localStorage.getItem('acesso') || '{}')?.token && !rascunhosLocaisConferidos)
        enviarRascunhosLocaisPendentes().catch(() => { })
}, 15000)

// Última tentativa ao fechar/recarregar a página (keepalive: o navegador termina o envio sozinho).
window.addEventListener('pagehide', () => {
    for (const [id, timer] of rascunhosAgendados) {
        clearTimeout(timer)
        enviarRascunho(id, { keepalive: true })
    }
})

function encerrarRascunho(id, motivo) {
    clearTimeout(rascunhosAgendados.get(id))
    rascunhosAgendados.delete(id)
    delete rascunhosEmMemoria[id]
    gravarMetaRascunho(id, null)
    if (!id || id === 'null') return
    rotaRascunhos('encerrar', { id, motivo }).catch(erro => console.warn('[rascunhos] encerrar', id, erro))
}

// remover: true / 'limpo' (Apagar Orçamento, limpa a tela), 'salvo' (virou orçamento), 'descartado'.
function baseOrcamento(orcamento, remover = false) {

    const temporario = lerTemporarioLocal()
    let idEdicao = sessionStorage.getItem('idEdicao')

    // remover
    if (remover) {
        delete temporario[idEdicao]
        gravarTemporarioLocal(temporario)
        encerrarRascunho(idEdicao, typeof remover === 'string' ? remover : 'limpo')
        // O que vier depois nesta aba (tela limpa, próximo orçamento) é outro rascunho.
        sessionStorage.setItem('idEdicao', crypto.randomUUID())
        return
    }

    // salvar
    if (orcamento) {
        // Aba sem edição aberta: o rascunho ganha id próprio (antes ia para a chave "null").
        if (!idEdicao || idEdicao === 'null') {
            idEdicao = crypto.randomUUID()
            sessionStorage.setItem('idEdicao', idEdicao)
        }
        temporario[idEdicao] = orcamento
        gravarMetaRascunho(idEdicao, { alterado_em: Date.now() })
        const cabeLocal = gravarTemporarioLocal(temporario)
        if (cabeLocal) delete rascunhosEmMemoria[idEdicao]
        else rascunhosEmMemoria[idEdicao] = orcamento
        agendarEnvioRascunho(idEdicao, !cabeLocal)
        if (!rascunhosLocaisConferidos) {
            rascunhosLocaisConferidos = true
            enviarRascunhosLocaisPendentes()
        }
        return
    }

    // ler
    // A da memória só existe quando a local não coube: é a mais nova.
    return rascunhosEmMemoria[idEdicao] || temporario[idEdicao] || null
}

// ---------------------------------------------------------------- Painel "Orçamentos em edição"
const painelRascunhos = { encerrados: false, todos: false, lista: [] }

async function painelEdicao(tela) {

    overlayAguarde()
    let doBanco = null
    try {
        await enviarRascunhosLocaisPendentes()
        doBanco = (await rotaRascunhos('listar', {})).rascunhos || []
    } catch (erro) {
        console.warn('[rascunhos] listar', erro)
    } finally {
        removerOverlay()
    }

    const locais = Object.entries(lerTemporarioLocal()).filter(([id]) => id && id !== 'null')
    const novo = crypto.randomUUID()

    // Se não existir orcs em edição, pode passar adiante;
    if (!locais.length && !doBanco?.length)
        return editarOrcamentoTemporario(novo, tela == 1 ? MODO_LOCACAO : null)

    painelRascunhos.encerrados = false
    painelRascunhos.todos = false
    painelRascunhos.lista = montarListaRascunhos(doBanco, locais)
    painelRascunhos.semBanco = doBanco === null

    popup({
        titulo: 'Orçamentos em edição',
        elemento: `<div class="fis-painel popup-consulta rascunhos-orc" id="painel-rascunhos">${htmlPainelRascunhos()}</div>`
    })
}

// Banco + cópia local: o que está nos dois aparece uma vez; o que só está no banco veio de outro computador.
function montarListaRascunhos(doBanco, locais = []) {
    const porId = new Map((doBanco || []).map(r => [r.id, { ...r, local: false }]))
    const meta = lerMetaRascunhos()
    for (const [id, orc] of locais) {
        const doServidor = porId.get(id)
        const alterado = meta[id]?.alterado_em ? new Date(meta[id].alterado_em).toISOString() : null
        porId.set(id, {
            ...(doServidor || {}),
            id,
            usuario: doServidor?.usuario || acesso?.usuario,
            contrato: orc?.dados_orcam?.contrato && orc.dados_orcam.contrato !== 'sequencial' ? orc.dados_orcam.contrato : null,
            lpu: orc?.lpu_ativa || doServidor?.lpu,
            total: orc?.total_geral ?? doServidor?.total,
            itens: Object.keys(orc?.esquema_composicoes || orc?.dados_composicoes || {}).length,
            ocorrencia: orc?.origem?.idOcorrencia || null,
            atualizado_em: alterado || doServidor?.atualizado_em || null,
            local: true,
            pendente: !(meta[id]?.enviado_em >= (meta[id]?.alterado_em || 0))
        })
    }
    return [...porId.values()].sort((a, b) => String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || '')))
}

async function filtrarPainelRascunhos({ encerrados = painelRascunhos.encerrados, todos = painelRascunhos.todos } = {}) {
    overlayAguarde()
    try {
        const { rascunhos = [] } = await rotaRascunhos('listar', { encerrados, todos })
        painelRascunhos.encerrados = encerrados
        painelRascunhos.todos = todos
        // Em edição e só os meus: soma a cópia local (pode ter algo ainda não enviado).
        painelRascunhos.lista = !encerrados && !todos
            ? montarListaRascunhos(rascunhos, Object.entries(lerTemporarioLocal()).filter(([id]) => id && id !== 'null'))
            : rascunhos.map(r => ({ ...r, local: Object.hasOwn(lerTemporarioLocal(), r.id) }))
        painelRascunhos.semBanco = false
    } catch (erro) {
        return popup({ mensagem: erro.message })
    } finally {
        removerOverlay()
    }
    const painel = document.getElementById('painel-rascunhos')
    if (painel) painel.innerHTML = htmlPainelRascunhos()
}

function htmlPainelRascunhos() {
    const { lista, encerrados, todos, semBanco } = painelRascunhos
    const esc = v => escaparAtributo(v ?? '')
    const quando = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
    const meus = r => r.usuario === acesso?.usuario
    const nomesEncerramento = { salvo: 'Salvo', descartado: 'Descartado', limpo: 'Tela limpa' }
    const veTodos = pode('orcamentos.rascunhos_todos')
    const novo = crypto.randomUUID()

    const linhas = lista.map(r => {
        const numero = r.contrato || 'Novo orçamento'
        const vinculo = r.ocorrencia ? `<small>Vinculado • ${esc(r.ocorrencia)}</small>` : ''
        const ondeEsta = r.local
            ? (r.pendente ? '<small class="rascunho-pendente">neste computador, ainda não enviado</small>' : '')
            : (!encerrados && meus(r) ? '<small>de outro computador</small>' : '')
        const situacao = encerrados
            ? `<small>${esc(nomesEncerramento[r.encerramento] || r.encerramento)} em ${quando(r.encerrado_em)}${r.encerrado_por && r.encerrado_por !== r.usuario ? ` por ${esc(r.encerrado_por)}` : ''}</small>`
            : ''
        const acoes = encerrados || !meus(r)
            ? `<button type="button" class="fis-mini" onclick="recuperarRascunho('${esc(r.id)}')">Recuperar</button>`
            : `<button type="button" class="fis-mini" onclick="editarOrcamentoTemporario('${esc(r.id)}', '${esc(r.lpu || '')}')">Editar</button>
               <img src="imagens/fechar.png" title="Descartar rascunho" style="width: 1.4rem; cursor: pointer;" onclick="removerOrcTemp(this, '${esc(r.id)}')">`
        const busca = [numero, r.ocorrencia, r.usuario, r.lpu].join(' ').toLowerCase()
        return `
            <tr data-tipo="" data-busca="${esc(busca)}">
                <td class="fin-extrato-quem"><span>${esc(numero)}</span>${vinculo}${ondeEsta}${situacao}</td>
                ${todos ? `<td>${esc(r.usuario)}</td>` : ''}
                <td class="fis-num">${Number(r.itens) || 0}</td>
                <td class="fis-num"><b>${dinheiro(Number(r.total) || 0)}</b></td>
                <td>${esc(r.lpu || 'LPU HOPE')}</td>
                <td>${quando(r.atualizado_em)}</td>
                <td class="rascunho-acoes">${acoes}</td>
            </tr>`
    }).join('')

    const total = lista.reduce((s, r) => s + (Number(r.total) || 0), 0)
    const ultima = lista[0]?.atualizado_em
    const chip = (rotulo, ativo, funcao) => `<button type="button" class="${ativo ? 'ativo' : ''}" onclick="${funcao}">${rotulo}</button>`

    return `
        ${resumoDocumentoFis({}, [
            [encerrados ? 'Encerrados (30 dias)' : 'Em edição', String(lista.length)],
            ['Valor somado', dinheiro(total)],
            ['Pessoas', String(new Set(lista.map(r => r.usuario)).size)],
            ['Última alteração', quando(ultima)]
        ])}
        ${semBanco ? '<div class="fis-vazio">Servidor indisponível: mostrando só os rascunhos deste computador.</div>' : ''}
        <div class="fin-extrato-barra">
            <input type="search" class="fis-input fin-extrato-busca" placeholder="Buscar nº do orçamento, chamado, usuário..." oninput="filtrarExtratoFin(this)">
            <div class="fin-extrato-chips" data-tipo="">
                ${chip('Em edição', !encerrados, 'filtrarPainelRascunhos({ encerrados: false })')}
                ${chip('Encerrados', encerrados, 'filtrarPainelRascunhos({ encerrados: true })')}
            </div>
            ${veTodos ? `<div class="fin-extrato-chips" data-tipo="">
                ${chip('Meus', !todos, 'filtrarPainelRascunhos({ todos: false })')}
                ${chip('Todos os usuários', todos, 'filtrarPainelRascunhos({ todos: true })')}
            </div>` : ''}
            <button type="button" class="fis-mini fin-extrato-editar" onclick="editarOrcamentoTemporario('${novo}')">Novo orçamento</button>
            ${podeUsarLocacao() ? `<button type="button" class="fis-mini" onclick="editarOrcamentoTemporario('${novo}', MODO_LOCACAO)">Novo de locação</button>` : ''}
        </div>
        ${lista.length ? `
        <div class="fis-tabela-rolagem fin-extrato-rolagem">
            <table class="fis-tabela fin-extrato">
                <thead><tr><th>Orçamento</th>${todos ? '<th>Usuário</th>' : ''}<th class="fis-num">Itens</th><th class="fis-num">Total</th><th>LPU</th><th>Última alteração</th><th></th></tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>` : `<div class="fis-vazio">${encerrados ? 'Nenhum rascunho encerrado nos últimos 30 dias.' : 'Nenhum rascunho em edição.'}</div>`}
        <small style="color: #6b7a71;">Descartar aqui não apaga o orçamento salvo: só o rascunho. Rascunhos encerrados ficam guardados e podem ser recuperados.</small>`
}

async function removerOrcTemp(img, idEdicao) {

    const ok = await confirmarPopup({ titulo: 'Descartar rascunho', mensagem: 'Descartar este rascunho? O orçamento salvo (se houver) não muda, e o rascunho ainda pode ser recuperado em Encerrados.', textoConfirmar: 'Descartar' })
    if (!ok) return

    img.closest('tr')?.remove()

    const temporario = lerTemporarioLocal()
    delete temporario[idEdicao]
    gravarTemporarioLocal(temporario)
    encerrarRascunho(idEdicao, 'descartado')

}

// Rascunho encerrado ou de outra pessoa: vira um rascunho NOVO meu, com o mesmo conteúdo.
async function recuperarRascunho(id) {
    overlayAguarde()
    let rascunho
    try {
        rascunho = (await rotaRascunhos('ler', { id })).rascunho
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }
    removerOverlay()
    const dados = rascunho?.dados
    if (!dados) return popup({ mensagem: 'Rascunho sem conteúdo.' })

    const ok = await confirmarPopup({
        titulo: 'Recuperar rascunho',
        textoConfirmar: 'Recuperar',
        mensagem: `Abrir uma cópia deste rascunho${rascunho.usuario !== acesso?.usuario ? ` de <b>${escaparAtributo(rascunho.usuario)}</b>` : ''} para editar?${dados.id ? '<br>Ao salvar, ele atualiza o orçamento já salvo com este número.' : ''}`
    })
    if (!ok) return

    removerTodosPopups()
    sessionStorage.setItem('idEdicao', crypto.randomUUID())
    baseOrcamento(structuredClone(dados))
    tela.innerHTML = ''
    if (ehOrcamentoLocacao(dados.lpu_ativa)) await telaCriarOrcamentoLocacao()
    else await telaCriarOrcamento()
}

async function editarOrcamentoTemporario(idEdicao, lpu) {

    if (ehOrcamentoLocacao(lpu) && bloquearLocacao())
        return

    // Rascunho que só está no banco (feito em outro computador): traz para a cópia local antes de abrir.
    if (!lerTemporarioLocal()[idEdicao] && !rascunhosEmMemoria[idEdicao] && painelRascunhos.lista.some(r => r.id === idEdicao)) {
        overlayAguarde()
        try {
            const { rascunho } = await rotaRascunhos('ler', { id: idEdicao })
            const temporario = lerTemporarioLocal()
            temporario[idEdicao] = rascunho.dados
            if (!gravarTemporarioLocal(temporario)) rascunhosEmMemoria[idEdicao] = rascunho.dados
            gravarMetaRascunho(idEdicao, { alterado_em: Date.parse(rascunho.atualizado_em) || Date.now(), enviado_em: Date.now() })
        } catch (erro) {
            return popup({ mensagem: erro.message })
        } finally {
            removerOverlay()
        }
    }

    removerPopup()

    sessionStorage.setItem('idEdicao', idEdicao)
    tela.innerHTML = ''

    if (ehOrcamentoLocacao(lpu))
        await telaCriarOrcamentoLocacao()
    else
        await telaCriarOrcamento()

}

async function painelClientes(idOrcamento = null) {

    overlayAguarde()

    // Id para as tags ('Dados do cliente'): só vai para controles.etiquetas depois da trava de
    // "um formulário por vez" lá embaixo — senão a tentativa barrada troca o orçamento do aberto.
    const idOrcParaTag = idOrcamento || 'novo'

    const orcamento = idOrcamento
        ? await recuperarDado('dados_orcamentos', idOrcamento) || {}
        : baseOrcamento()

    const {
        venda_direta,
        contrato,
        executor,
        tecnico,
        tipo_de_frete,
        consideracoes,
        garantia,
        emissor,
        analista,
        email_analista,
        telefone_analista,
        omie_cliente,
        condicoes,
        condicao_pagamento,
        chamado: chamadoOrcamento
    } = orcamento?.dados_orcam || {}

    // Endereço escolhido (js/enderecos.js). Sem escolha no orçamento, vale o do chamado dele (mesmo cliente).
    let enderecoOrcamento = orcamento?.dados_orcam?.endereco || null
    if (!enderecoOrcamento && omie_cliente) {
        const ocorrencia = await recuperarDado('dados_ocorrencias', chamadoOrcamento || contrato)
        if (ocorrencia?.endereco && String(ocorrencia.unidade) === String(omie_cliente)) enderecoOrcamento = ocorrencia.endereco
    }

    const { ate: validadeAte } = validadeOrcamento(orcamento?.dados_orcam || {})
    const validadeAteFormulario = validadeAte ? brDataOrcamento(validadeAte) : ''

    const [cliente, clienteVendaDireta] = await Promise.all([
        recuperarDado('clientes', omie_cliente),
        recuperarDado('clientes', venda_direta)
    ])

    // Ponte com o cadastro da empresa do cliente (Categorias de Formulário > Empresas): o que o orçamento
    // ainda não tem vem de lá — empresa de faturamento e condição de pagamento (a mesma peça do pedido,
    // js/condicao_pagamento.js). Orçamento antigo: "AC SOLUÇÕES" abre como AC e o texto da lista antiga
    // ("3x", "30 dias") vira a condição. O limite de faturamento aparece abaixo.
    const empresaCliente = cliente?.empresa ? await recuperarDado('empresas', cliente.empresa) || {} : {}
    // Empresa de faturamento: abre sem nenhuma marcada (obrigatória ao salvar); escolher o cliente
    // marca a do cadastro da empresa dele.
    const emissorAtual = codigoEmpresaFat(emissor)
    // Condição de pagamento: escondida até o usuário ligar; já vem ligada se o orçamento tem uma.
    const condicaoPropria = normalizarCondicaoPag(condicao_pagamento) || normalizarCondicaoPag(condicoes)
    const condicaoOrcamento = condicaoPropria || normalizarCondicaoPag(empresaCliente.condicao_pagamento)
    const temNumero = contrato && contrato !== 'sequencial'

    const botoes = [
        {
            texto: 'Salvar Dados',
            img: 'concluido',
            funcao: idOrcamento
                ? `salvarDadosCliente('${idOrcamento}')`
                : 'salvarDadosCliente()'
        }
    ]

    // Campos no padrão da Correção (js/campos_gcs.js): cliente e venda direta pesquisáveis de lista
    // fechada (clientes do app AC), analista entre os usuários do GCS.
    fontesEscolha.clientesOrcamento ??= {
        ...fontesEscolha.unidades,
        filtros: { app: { op: '=', value: 'AC' } }
    }
    fontesEscolha.analistasOrcamento ??= {
        base: 'clientes',
        filtros: { usuario: { op: 'NOT_EMPTY' }, nome: { op: 'NOT_EMPTY' } },
        campos: ['nome', 'usuario', 'email'],
        valor: 'nome',
        rotulo: d => d.nome || d.usuario,
        detalhe: d => [d.usuario, d.email, telefoneUsuarioOrc(d)].filter(Boolean).join(' · '),
        local: true,
        ordenar: { path: 'nome', direcao: 'ASC' }
    }

    // Analista: o que o orçamento não tem vem do cadastro atual de quem está lançando
    // (o "acesso" é a foto do login e pode estar desatualizado).
    const usuarioAtual = { ...(acesso || {}), ...(acesso?.id ? await recuperarDado('clientes', acesso.id) || {} : {}) }
    const analistaInicial = analista || usuarioAtual.nome || usuarioAtual.usuario || ''
    const emailInicial = email_analista || usuarioAtual.email || ''
    const telefoneInicial = telefone_analista || telefoneUsuarioOrc(usuarioAtual)

    const linhas = [
        {
            texto: 'Contrato',
            elemento: temNumero
                ? `<input id="dadosClienteOrc" value="${escaparAtributo(contrato)}" readOnly style="flex: 1 1 260px; max-width: 520px;">`
                : `<div id="dadosClienteOrc" class="orc-sem-numero">
                    <img src="imagens/alerta.png" alt="">
                    <span><b>Ainda sem número.</b> O ORC é gerado quando o orçamento for salvo.</span>
                </div>`
        },
        {
            texto: 'Cliente',
            elemento: `
            <div class="ce-bloco">
                ${campoEscolhaHtml({ fonte: 'clientesOrcamento', name: 'cliente', valor: omie_cliente || '', rotulo: cliente?.nome || (omie_cliente ? String(omie_cliente) : ''), placeholder: 'Nome, CNPJ, endereço, cidade…', aoMudar: 'buscarDadosCliente' })}
                <div class="ce-bloco-rodape">
                    <small data-orc-cnpj style="color: #6b7a71;">${cliente?.cnpj ? `CNPJ/CPF ${escaparAtributo(formatarCnpjEscolha(cliente.cnpj))}` : ''}</small>
                    <button type="button" class="ce-mais" onclick="formularioCliente()">+ Novo cliente</button>
                </div>
            </div>`
        },
        {
            // Vários endereços por cliente (js/enderecos.js): troca ou cadastra um novo aqui mesmo.
            texto: 'Endereço',
            elemento: seletorEnderecoHtml({ clienteId: omie_cliente, foto: enderecoOrcamento, contexto: 'orcamento', ref: contrato && contrato !== 'sequencial' ? contrato : '' })
        },
        {
            texto: 'Venda Direta',
            elemento: `
            <div class="ce-bloco" onchange="toggleVendaDireta(this)">
                ${toggleOpcoesHtml({ name: 'vendaDiretaAtiva', opcoes: [{ valor: 'N', texto: 'Não' }, { valor: 'S', texto: 'Sim' }], valor: venda_direta ? 'S' : 'N', desmarcavel: false, compacto: true })}
                <div data-venda-direta style="display: ${venda_direta ? 'block' : 'none'};">
                    ${campoEscolhaHtml({ fonte: 'clientesOrcamento', name: 'venda_direta', valor: venda_direta || '', rotulo: clienteVendaDireta?.nome || (venda_direta ? String(venda_direta) : ''), placeholder: 'Cliente da venda direta…' })}
                </div>
            </div>`
        },
        {
            texto: 'Tipo de Frete',
            elemento: toggleOpcoesHtml({ name: 'tipo_de_frete', opcoes: ['CIF', 'FOB'], valor: tipo_de_frete || '', compacto: true })
        },
        {
            texto: 'Escopo',
            editor: escopoParaEditor(consideracoes)
        },
        {
            texto: 'Executores / Delegar',
            elemento: campoUsuariosHtml('executores', executor)
        },
        {
            texto: 'Técnicos',
            elemento: campoUsuariosHtml('tecnicos', tecnico)
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/etiqueta.png" onclick="renderPainel('${idOrcParaTag}')">
                <span>Tags</span>
            </div>
            `,
            elemento: `<div id="tags" style="${vertical}; gap: 2px;"></div>`
        },
        {
            texto: 'Validade da Proposta',
            // Fixa (validade_orcamento.js): conta da data de registro; ao vencer, oferece estender ao abrir.
            elemento: `<span>${VALIDADE_ORCAMENTO_DIAS} dias corridos${validadeAteFormulario ? ` · válido até <b>${validadeAteFormulario}</b>` : ''}</span>`
        },
        {
            texto: 'Garantia',
            elemento: `<textarea id="garantia" style="flex: 1 1 260px; max-width: 520px;">${garantia || 'Conforme tratativa Comercial'}</textarea>`
        },
        {
            texto: 'Analista',
            // Escolher outro usuário traz o e-mail e o celular dele (analistaEscolhidoOrc).
            elemento: campoEscolhaHtml({ fonte: 'analistasOrcamento', name: 'analista', valor: analistaInicial, rotulo: analistaInicial, placeholder: 'Pesquisar usuário…', aoMudar: 'analistaEscolhidoOrc' })
        },
        {
            texto: 'E-mail',
            elemento: `<input id="email_analista" type="email" value="${escaparAtributo(emailInicial)}" placeholder="E-mail do analista" style="flex: 1 1 260px; max-width: 520px;">`
        },
        {
            texto: 'Celular',
            elemento: `<input id="telefone_analista" value="${escaparAtributo(telefoneInicial)}" placeholder="(DDD) número" style="flex: 1 1 260px; max-width: 520px;">`
        },
        {
            texto: 'Empresa de faturamento <b style="color: #d9534f;">*</b>',
            elemento: `<div data-orc-emissor onchange="this.classList.remove('ce-invalido')">${toggleOpcoesHtml({ name: 'emissor', opcoes: EMPRESAS_FATURAMENTO.map(([valor, texto]) => ({ valor, texto })), valor: emissorAtual, desmarcavel: false, compacto: true })}</div>`
        },
        {
            texto: 'Condição de pagamento',
            elemento: `
            <div class="ce-bloco orc-condicao" onchange="toggleCondicaoOrc(event, this)">
                ${toggleOpcoesHtml({ name: 'condicaoAtiva', opcoes: [{ valor: 'N', texto: 'Não informar' }, { valor: 'S', texto: 'Informar' }], valor: condicaoPropria ? 'S' : 'N', desmarcavel: false, compacto: true })}
                <div id="condicao_orcamento" style="display: ${condicaoPropria ? 'block' : 'none'}; width: 100%;">${htmlCondicaoPag(condicaoOrcamento)}</div>
            </div>`
        },
        {
            texto: 'Limite de faturamento',
            elemento: `<span id="limite_faturamento_info">${infoFaturamentoEmpresa(empresaCliente)}</span>`
        }
    ]

    // Um "Dados do Cliente" por vez: os campos têm id fixo (salvarDadosCliente, tags e cxOpcoes leem
    // pelo id/nome) e dois abertos misturariam os dados entre orçamentos.
    const formExistente = document.querySelector('#dadosClienteOrc')
    if (formExistente) {
        removerOverlay()
        trazerJanelaParaFrente(formExistente)
        if (formExistente.closest('.painel-padrao')?.dataset.orcamento !== idOrcParaTag)
            popup({ mensagem: 'Já existe um formulário <b>Dados do Cliente</b> aberto para outro orçamento.<br>Salve ou feche esse antes de abrir outro.' })
        return
    }

    controles.etiquetas ??= {}
    controles.etiquetas.idOrcamento = idOrcParaTag

    const identificacao = contrato && contrato !== 'sequencial' ? ` · ${contrato}` : ''
    popup({ linhas, botoes, titulo: `Dados do Cliente${identificacao}`, autoDestruicao: ['cliente', 'tecnico'] })
    iniciarCondicoesPag(document.getElementById('condicao_orcamento'))
    const painelDados = painelDadosClienteOrc()
    if (painelDados) painelDados.dataset.orcamento = idOrcParaTag

    carregarTags()

}

// Painel do formulário Dados do Cliente do orçamento (um por vez).
const painelDadosClienteOrc = () => document.getElementById('dadosClienteOrc')?.closest('.painel-padrao') || null

// "(17) 98100-2178" a partir do ddd/celular do cadastro do usuário.
function telefoneUsuarioOrc(usuario) {
    const ddd = String(usuario?.ddd ?? '').replace(/\D/g, '')
    const celular = String(usuario?.celular ?? '').trim()
    return [ddd ? `(${ddd})` : '', celular].filter(Boolean).join(' ')
}

// Escopo antigo é texto puro (textarea, com quebras de linha); o novo é o HTML do editor.
function escopoParaEditor(valor) {
    const texto = String(valor ?? '')
    if (!texto.trim() || texto.trim().toUpperCase() === 'ESCOPO:') return ''
    if (/<[a-z][\s\S]*>/i.test(texto)) return texto
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')
}

// Escopo (HTML do editor ou texto antigo) como texto com quebras de linha: Excel e afins.
function escopoComoTexto(valor) {
    const texto = String(valor ?? '')
    if (!/<[a-z][\s\S]*>/i.test(texto)) return texto
    const div = document.createElement('div')
    div.innerHTML = texto
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    return div.textContent.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function analistaEscolhidoOrc(campo) {
    const dado = dadoEscolhido(campo)
    if (!dado) return
    const painel = campo.closest('.painel-padrao')
    const email = painel?.querySelector('#email_analista')
    const telefone = painel?.querySelector('#telefone_analista')
    if (email) email.value = dado.email || ''
    if (telefone) telefone.value = telefoneUsuarioOrc(dado)
}

// Liga/desliga a condição de pagamento (as mudanças dos selects dela também sobem até aqui).
function toggleCondicaoOrc(evento, caixa) {
    if (evento?.target?.name !== 'condicaoAtiva') return
    const area = caixa.querySelector('#condicao_orcamento')
    if (area) area.style.display = lerToggle(caixa, 'condicaoAtiva') === 'S' ? 'block' : 'none'
}

function toggleVendaDireta(caixa) {
    const ativa = lerToggle(caixa, 'vendaDiretaAtiva') === 'S'
    const area = caixa.querySelector('[data-venda-direta]')
    if (area) area.style.display = ativa ? 'block' : 'none'
}

// Texto do limite de faturamento do cadastro da empresa do cliente (vazio: "sem limite").
function infoFaturamentoEmpresa(empresa) {
    const limite = textoLimiteFaturamento(empresa?.limite_faturamento_dia)
    if (!empresa?.nome) return '<small style="color: #6b7a71;">Cliente sem empresa vinculada</small>'
    return `${limite ? escaparAtributo(limite) : 'Sem limite'} <small style="color: #6b7a71;">(${escaparAtributo(empresa.nome)})</small>`
}

// Cliente escolhido no campo pesquisável (aoMudar do campo "cliente").
async function buscarDadosCliente(campo) {
    const painel = campo?.closest?.('.painel-padrao') || painelDadosClienteOrc()
    if (!painel) return

    const omie_cliente = Number(lerEscolha(painel.querySelector('.ce-campo[name="cliente"]'))) || null
    const cliente = omie_cliente ? await recuperarDado('clientes', omie_cliente) || {} : {}

    const elCnpj = painel.querySelector('[data-orc-cnpj]')
    if (elCnpj) elCnpj.textContent = cliente?.cnpj ? `CNPJ/CPF ${formatarCnpjEscolha(cliente.cnpj)}` : ''
    // Cliente novo: o endereço volta para o principal dele (js/enderecos.js).
    clienteSeletorEndereco(painel, omie_cliente || '')

    // Campo limpo: nada de empresa nem de tags para trocar.
    if (!omie_cliente) return

    // Cliente escolhido: empresa de faturamento, condição de pagamento e limite vêm do cadastro da empresa dele.
    const empresaCliente = cliente?.empresa ? await recuperarDado('empresas', cliente.empresa) || {} : {}
    const emissorEmpresa = codigoEmpresaFat(empresaCliente.empresa_faturamento)
    const radioEmissor = emissorEmpresa
        ? painel.querySelector(`input[type="radio"][name="emissor"][value="${emissorEmpresa}"]`)
        : null
    if (radioEmissor) {
        radioEmissor.checked = true
        painel.querySelector('[data-orc-emissor]')?.classList.remove('ce-invalido')
    }
    const condicaoEmpresa = normalizarCondicaoPag(empresaCliente.condicao_pagamento)
    const caixaCondicao = painel.querySelector('#condicao_orcamento')
    if (caixaCondicao && condicaoEmpresa) {
        caixaCondicao.innerHTML = htmlCondicaoPag(condicaoEmpresa)
        iniciarCondicoesPag(caixaCondicao)
    }
    const infoLimite = painel.querySelector('#limite_faturamento_info')
    if (infoLimite) infoLimite.innerHTML = infoFaturamentoEmpresa(empresaCliente)

    // O orçamento é o do formulário aberto (data-orcamento), não o último que alguém tentou abrir.
    const idOrcamento = painel.dataset.orcamento
        || controles.etiquetas?.idOrcamento
    const isNovo = idOrcamento === 'novo'
    const orcamento = isNovo
        ? baseOrcamento()
        : await recuperarDado('dados_orcamentos', idOrcamento) || {}

    orcamento.tags ||= {}

    if (isNovo) {
        orcamento.snapshots ||= {}
        orcamento.snapshots.tags ||= {}
    }

    for (const idTag in orcamento.tags) {
        if (orcamento.tags[idTag]?.auto === 'S') {
            delete orcamento.tags[idTag]
        }
    }

    if (isNovo) {
        for (const idTag in orcamento.snapshots.tags) {
            if (orcamento.snapshots.tags[idTag]?.auto === 'S') {
                delete orcamento.snapshots.tags[idTag]
            }
        }
    }

    const empresa = cliente?.snapshots?.empresa

    if (empresa) {
        const pesquisa = await pesquisarDB({
            base: 'tags_orcamentos',
            filtros: {
                nome: { op: '=', value: empresa }
            }
        })

        const tagEmpresa = pesquisa.resultados[0] || null

        if (tagEmpresa) {
            orcamento.tags[tagEmpresa.id] = {
                data: dataServidor().toLocaleDateString(),
                usuario: acesso.usuario,
                auto: 'S'
            }

            if (isNovo) {
                orcamento.snapshots.tags[tagEmpresa.id] = {
                    auto: 'S',
                    ...tagEmpresa
                }
            }
        }
    }

    if (isNovo) {
        baseOrcamento(orcamento)
    } else {
        await enviar(`dados_orcamentos/${idOrcamento}/tags`, orcamento.tags)
    }

    carregarTags()
}

async function salvarDadosCliente(idOrcamento) {

    // A janela deste formulário: no fim fecha ela (e não "a última"/"a em foco", que depois do
    // abrirAtalhos pode ser o atalho do orçamento).
    const painel = painelDadosClienteOrc()
    const janelaFormulario = painel?.closest('.popup')?.id || null

    if (!painel)
        return popup({ mensagem: 'Formulário Dados do Cliente não encontrado. Feche e abra novamente.' })

    // Empresa de faturamento é obrigatória (abre sem nenhuma marcada).
    const emissor = lerToggle(painel, 'emissor')
    if (!emissor) {
        const caixaEmissor = painel.querySelector('[data-orc-emissor]')
        caixaEmissor?.classList.remove('ce-invalido')
        void caixaEmissor?.offsetWidth
        caixaEmissor?.classList.add('ce-invalido')
        caixaEmissor?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return popup({ mensagem: 'Escolha a <b>Empresa de faturamento</b> antes de salvar.' })
    }

    // Condição de pagamento só entra se o usuário ligou.
    const informarCondicao = lerToggle(painel, 'condicaoAtiva') === 'S'

    overlayAguarde()

    try {

        const orcamentoBase = idOrcamento
            ? await recuperarDado('dados_orcamentos', idOrcamento)
            : baseOrcamento() || {}

        const el = (id) => painel.querySelector(`#${id}`)
        const campo = (name) => painel.querySelector(`.ce-campo[name="${name}"]`)

        orcamentoBase.dados_orcam ??= {}

        const omie_cliente = Number(lerEscolha(campo('cliente'))) || null

        // Venda Direta;
        const venda_direta = lerToggle(painel, 'vendaDiretaAtiva') === 'S'
            ? Number(lerEscolha(campo('venda_direta'))) || null
            : null

        // Executores / Técnicos (chips);
        const executor = usuariosDoCampo('executores', painel)
        const tecnico = usuariosDoCampo('tecnicos', painel)

        // Escopo: HTML do editor (vazio quando só tem espaços).
        const editorEscopo = painel.querySelector('.editor-conteudo')
        const consideracoes = editorEscopo && editorEscopo.innerText.trim() ? editorEscopo.innerHTML.trim() : ''

        // Condição de pagamento (mesma peça do pedido): "condicoes" guarda o texto (PDF e telas antigas).
        const { condicao: condicao_pagamento, erros: errosCondicao } = informarCondicao
            ? lerCondicaoPag(painel.querySelector('#condicao_orcamento [data-condicao-pag]'))
            : { condicao: null, erros: [] }
        if (errosCondicao.length)
            return popup({ mensagem: `Condição de pagamento: ${errosCondicao[0]}` })

        // Antes de "data" ser sobrescrita: orçamento antigo usa a última data gravada como registro.
        garantirValidadeOrcamento(orcamentoBase.dados_orcam ??= {})

        orcamentoBase.dados_orcam = {
            ...orcamentoBase.dados_orcam,
            omie_cliente,
            venda_direta,
            condicoes: resumoCondicaoPag(condicao_pagamento),
            condicao_pagamento,
            consideracoes,
            data: dataServidor().toLocaleString('pt-BR'),
            garantia: el('garantia').value,
            tipo_de_frete: lerToggle(painel, 'tipo_de_frete'),
            emissor,
            email_analista: el('email_analista').value.trim(),
            analista: lerEscolhaRotulo(campo('analista')) || '',
            telefone_analista: el('telefone_analista').value.trim(),
            executor,
            tecnico,
            // Endereço escolhido (js/enderecos.js): foto do endereço; null = principal do cadastro.
            endereco: lerSeletorEndereco(painel) || null
        }

        // Se não existir a chave contrato; sequencial fará que o servidor crie;
        orcamentoBase.dados_orcam.contrato ??= 'sequencial'

        if (idOrcamento) {

            // Tags são salvar em tempo real;

            const salvo = await enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamentoBase.dados_orcam)
            if (!salvo || salvo.mensagem)
                return popup({ mensagem: salvo?.mensagem || 'Falha ao salvar os dados' })
            await abrirAtalhos(idOrcamento)

        } else {

            // Tags estão dentro do objeto, serão salvas junto do orçamento;

            baseOrcamento(orcamentoBase)
        }

        removerPopup(janelaFormulario)

    } catch (erro) {

        popup({ mensagem: erro.mensage || 'Falha ao salvar os dados' })

    }

}

async function abrirDANFE(codOmieNF) {

    overlayAguarde()

    const { link, mensagem } = await buscarDANFE(codOmieNF)

    if (mensagem)
        return popup({ mensagem })

    removerOverlay()

    try {
        shell.openExternal(link)
    } catch {
        window.open(link, '_blank')
    }
}

async function buscarDANFE(codOmieNF) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/danfe`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
        },

        body: JSON.stringify({ codOmieNF })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()

}

async function criarDepartamento(nome) {
    try {

        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

        const response = await fetch(`${api}/criar-departamento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ numOrc: nome })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (err) {
        return { mensagem: err.mensage || 'Falha na criação do departamento' }
    }
}

async function numORC(idOrcamento) {
    try {
        const response = await fetch(`${api}/prox-num-orc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idOrcamento })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}
