const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>`

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

    cUsuario.style.display = 'none'
    toolbar.style.display = 'flex'
    titulo.textContent = 'GCS'

    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading-gcs.gif" style="width: 5rem;">
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

    localResposta.innerHTML = `<img src="gifs/loading-gcs.gif" style="width: 5rem;">`

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

    msg.innerHTML = `
        <img src="${escaparAtributo(imagem || 'imagens/comentario.png')}" alt="">
        <div class="popup-mensagem-conteudo">
            ${usuario !== undefined
                ? `<strong>${escaparAtributo(usuario)}</strong><span class="popup-mensagem-status">${escaparAtributo(status || 'offline')}</span>`
                : (texto || '')}
        </div>
        <button class="popup-mensagem-fechar" type="button" aria-label="Fechar notificação">×</button>
    `

    msg.querySelector('.popup-mensagem-fechar').addEventListener('click', () => msg.remove())

    container.appendChild(msg);

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
            <span class="rotulo-usuario-menu">${rotulo}</span>`
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

    overlayAguarde()

    try {
        painelUsuariosEstado.busca = ''
        await carregarUsuariosPainel()

        const elemento = `
            <div class="painel-usuarios">
                <div class="painel-usuarios-topo">
                    <div class="painel-usuarios-meu-status"></div>
                    <input type="search" class="painel-usuarios-busca" placeholder="Buscar usuário, setor ou permissão"
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
        .map(({ id, usuario, nome, status, setor, permissao, foto }) => ({ id, usuario, nome, status, setor, permissao, foto }))
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
        || [u.usuario, u.nome, u.setor, u.permissao].some(campo => normalizar(campo).includes(busca)))

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
        const detalhe = [u.setor, u.permissao].filter(Boolean).map(inicialMaiuscula).join(' · ')
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

        const tabela = await modTab({
            colunas: {
                'Contrato': { chave: 'contrato' },
                'Cliente': { chave: 'cliente' },
                'Total Original <br>[s/desc ou acres]': {},
                'Total Geral': { chave: 'total_geral' },
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

    const permissao = acesso.permissao
    const pessoasPermitidas = ['adm', 'diretoria']

    if (!pessoasPermitidas.includes(permissao))
        return popup({ mensagem: 'Você não tem acesso' })

    const {
        dados_composicoes,
        cliente,
        cidade,
        usuario,
        total_bruto,
        total_geral,
        lpu_ativa
    } = await recuperarDado('mvw_dados_orcamentos', idOrcamento) || {}

    const base = Object.values(dados_composicoes || {})
    const pag = 'orcAprovacao'
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
            <div class="pedido-aprovacao requisicao-formulario">
                
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

    popup({ elemento: linhas[0].elemento, botoes, titulo: 'Detalhes' })

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

        const diferenca = totalOriginal - total

        divDiferenca = `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/${diferenca > 0 ? 'acima' : 'abaixo'}.png">
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

    removerPopup()

    verificarPendencias()

}

function painelEdicao(tela) {

    const listaORCS = Object.entries(JSON.parse(localStorage.getItem('temporario')) || {})
        .map(([idEdicao, orc]) => {

            const { lpu_ativa, origem } = orc || {}

            const vinculado = origem
                ? `<span class="tag-cliente">Vinculado • ${origem.idOcorrencia}</span>`
                : ''

            const div = `
                <tr>
                    <td>
                        <button onclick="editarOrcamentoTemporario('${idEdicao}', '${lpu_ativa}')">Editar</button>
                    </td>
                    <td>
                        <div style="${vertical}; gap: 2px;">
                            <span class="tag-cliente">${orc?.dados_orcam?.contrato || 'Novo Orçamento'}</span>
                            ${vinculado}
                        </div>
                    </td>
                    <td>${dinheiro(orc?.total_geral || 0)}</td>
                    <td>${lpu_ativa || 'LPU HOPE'}</td>
                    <td>${new Date(orc?.timestamp || agoraServidor()).toLocaleString()}</td>
                    <td><img src="imagens/fechar.png" onclick="removerOrcTemp(this, '${idEdicao}')"></td>
                </tr>
                `

            return div
        })

    const novo = crypto.randomUUID()

    // Se não existir orcs em edição, pode passar adiante;
    if (!listaORCS.length)
        return editarOrcamentoTemporario(novo, tela == 1 ? 'ALUGUEL' : null)

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <span style="text-align: left;">
                <b>SEUS ORÇAMENTOS EM EDIÇÃO TEMPORÁRIA</b><br>
                Escolha um orçamento para voltar a editar ou clique para começar um novo.

                <br>
                <br>

                <b>ATENÇÃO</b><br>
                Se você excluir algo aqui será removida apenas a versão temporária no seu computador,<br>
                a versão final do orçamento continuará salva no servidor.
            </span>

            <br>

            <button onclick="editarOrcamentoTemporario('${novo}')">Novo Orçamento</button>
            <button onclick="editarOrcamentoTemporario('${novo}', 'ALUGUEL')">Novo Orçamento de Aluguel</button>

            <br>

            <div class="borda-tabela">

                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            ${['', 'nº ORÇAMENTO', 'Total', 'LPU', 'Última alteração', 'Excluir'].map(op => `<th>${op}</th>`).join('')} 
                        </thead>
                        <tbody>${listaORCS.join('')}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `

    popup({ elemento, titulo: 'Orçamentos em Edição' })

}

async function removerOrcTemp(img, idEdicao) {

    img.closest('tr').remove()

    const temporario = JSON.parse(localStorage.getItem('temporario')) || {}

    delete temporario[idEdicao]

    localStorage.setItem('temporario', JSON.stringify(temporario))

}

async function editarOrcamentoTemporario(idEdicao, lpu) {

    removerPopup()

    sessionStorage.setItem('idEdicao', idEdicao)
    tela.innerHTML = ''

    if (lpu == 'ALUGUEL')
        await telaCriarOrcamentoAluguel()
    else
        await telaCriarOrcamento()

}

function baseOrcamento(orcamento, remover = false) {

    const temporario = JSON.parse(localStorage.getItem('temporario')) || {}
    const idEdicao = sessionStorage.getItem('idEdicao')

    // remover
    if (remover) {
        delete temporario[idEdicao]
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // salvar
    if (orcamento) {
        temporario[idEdicao] = orcamento
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // ler
    return temporario[idEdicao] || null
}

async function painelClientes(idOrcamento = null) {

    overlayAguarde()

    // Salvamento do id para uso na função 'Dados do cliente';
    const idOrcParaTag = idOrcamento || 'novo'
    controles.etiquetas ??= {}
    controles.etiquetas.idOrcamento = idOrcParaTag

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
        condicoes
    } = orcamento?.dados_orcam || {}

    const { ate: validadeAte } = validadeOrcamento(orcamento?.dados_orcam || {})
    const validadeAteFormulario = validadeAte ? brDataOrcamento(validadeAte) : ''

    const [cliente, clienteVendaDireta] = await Promise.all([
        recuperarDado('clientes', omie_cliente),
        recuperarDado('clientes', venda_direta)
    ])

    const botoes = [
        {
            texto: 'Salvar Dados',
            img: 'concluido',
            funcao: idOrcamento
                ? `salvarDadosCliente('${idOrcamento}')`
                : 'salvarDadosCliente()'
        }
    ]

    // cxOpcoes -> Cliente
    controlesCxOpcoes.cliente = {
        retornar: ['nome'],
        base: 'clientes',
        filtros: {
            'app': { op: '=', value: 'AC' }
        },
        funcaoAdicional: ['buscarDadosCliente'],
        colunas: {
            'Nome Fantasia': { chave: 'nome' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' },
            'CNPJ/CPF': { chave: 'cnpj' }
        }
    }

    // cxOpcoes -> Venda Direta
    controlesCxOpcoes.venda_direta = {
        retornar: ['nome'],
        base: 'clientes',
        filtros: {
            'app': { op: '=', value: 'AC' }
        },
        colunas: {
            'Nome Fantasia': { chave: 'nome' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' },
            'CNPJ/CPF': { chave: 'cnpj' }
        }
    }

    const {
        nome,
        ddd,
        celular,
        email
    } = acesso || {}

    const linhas = [
        {
            texto: 'Contrato',
            elemento: `<input value="${contrato || 'ORC ...'}" readOnly>`
        },
        {
            texto: 'Cliente',
            elemento: `
            <div style="${horizontal}; gap: 3px">
                <span ${omie_cliente
                    ? `id="${omie_cliente}"`
                    : ''} 
                    class="opcoes" 
                    name="cliente" 
                    onclick="cxOpcoes('cliente')">
                        ${cliente?.nome || 'Selecione'}
                </span>
                <img onclick="formularioCliente()" src="imagens/baixar.png">
            </div>
            ` },
        {
            texto: 'CNPJ/CPF',
            elemento: `<span id="cnpj">${cliente?.cnpj || ''}</span>`
        },
        {
            texto: 'Endereço',
            elemento: `<span id="endereco">${cliente?.endereco || ''}</span>`
        },
        {
            texto: 'Bairro',
            elemento: `<span id="bairro">${cliente?.bairro || ''}</span>`
        },
        {
            texto: 'CEP', elemento: `<span id="cep">${cliente?.cep || ''}</span>`
        },
        {
            texto: 'Cidade',
            elemento: `<span id="cidade">${cliente?.cidade || ''}</span>`
        },
        {
            texto: 'Estado',
            elemento: `<span id="estado">${cliente?.estado || ''}</span>`
        },
        {
            texto: `
                <div style="${horizontal}; gap: 1rem;">
                    <input ${venda_direta ? 'checked' : ''} onclick="toggleVendaDireta()" type="checkbox" style="width: 2rem; height: 2rem;">
                    <span>Venda Direta</span>
                </div>
            `,
            elemento: `<span 
                data-ativo="${venda_direta ? 'S' : 'N'}"
                ${venda_direta ? `id="${venda_direta}"` : ''}
                style="display: ${venda_direta ? 'block' : 'none'}"
                class="opcoes"
                onclick="cxOpcoes('venda_direta')" 
                name="venda_direta">${clienteVendaDireta?.nome || 'Selecionar'}</span>`
        },
        {
            texto: 'Condições de Pagamento',
            elemento: `
            <select id="condicoes">
                ${parcelas.map(op => `<option ${condicoes == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            `
        },
        {
            texto: 'Tipo de Frete',
            elemento: `
            <select id="tipo_de_frete">
                ${['', 'CIF', 'FOB'].map(op => `<option ${tipo_de_frete == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            `
        },
        {
            texto: 'Escopo',
            elemento: `<textarea id="consideracoes" style="text-transform: uppercase;">${consideracoes || 'ESCOPO: '}</textarea>`
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'executores')">
                <span>Executores / Delegar</span>
            </div>
            `,
            elemento: '<div class="executores"></div>'
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'tecnicos')">
                <span>Técnicos</span>
            </div>
            `,
            elemento: '<div class="tecnicos"></div>'
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
            elemento: `<textarea id="garantia">${garantia || 'Conforme tratativa Comercial'}</textarea>`
        },
        {
            texto: 'Analista',
            elemento: `<input id="analista" value="${analista || nome || ''}">`
        },
        {
            texto: 'E-mail',
            elemento: `<textarea id="email_analista">${email_analista || email || ''}</textarea>`
        },
        {
            texto: 'Celular',
            elemento: `<input id="telefone_analista" value="${telefone_analista || `${ddd || ''} ${celular || ''}`}">`
        },
        {
            texto: 'Empresa',
            elemento: `
                <select id="emissor">
                    ${['AC SOLUÇÕES', 'IAC', 'HNW', 'HNK'].map(op => `<option ${emissor == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
        }
    ]

    const formExistente = document.querySelector('#emissor')
    if (formExistente)
        return removerOverlay()

    popup({ linhas, botoes, titulo: 'Dados do Cliente', autoDestruicao: ['cliente', 'tecnico'] })

    await maisUsuario(executor, 'executores')
    await maisUsuario(tecnico, 'tecnicos')
    carregarTags()

}

function toggleVendaDireta() {

    const checkVD = document.querySelector('[name="venda_direta"]')

    const statusAtivo = checkVD?.dataset?.ativo == 'S'

    checkVD.style.display = statusAtivo
        ? 'none'
        : 'block'

    checkVD.dataset.ativo = statusAtivo
        ? 'N'
        : 'S'

}

async function buscarDadosCliente() {
    const clienteName = document.querySelector('[name="cliente"]')
    if (!clienteName) return

    const omie_cliente = Number(clienteName.id)
    const cliente = await recuperarDado('clientes', omie_cliente) || {}

    const campos = ['cnpj', 'endereco', 'bairro', 'cidade', 'estado', 'cep']
    for (const campo of campos) {
        const el = document.getElementById(campo)
        if (el) el.textContent = cliente?.[campo] || ''
    }

    const idOrcamento = controles.etiquetas.idOrcamento
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

    overlayAguarde()

    try {

        const orcamentoBase = idOrcamento
            ? await recuperarDado('dados_orcamentos', idOrcamento)
            : baseOrcamento() || {}

        const el = (id) => {
            const elemento = document.getElementById(id)
            return elemento || null
        }

        orcamentoBase.dados_orcam ??= {}

        const omie_cliente = Number(document.querySelector('[name="cliente"]').id)

        // Venda Direta;
        const spanVendaDireta = document.querySelector('[name="venda_direta"]')
        const venda_direta = spanVendaDireta.dataset.ativo == 'S'
            ? Number(obVal('venda_direta'))
            : null

        // Executores;
        const executor = [...document.querySelectorAll('.executores span')]
            .filter(span => span.id)
            .map(span => span.textContent)

        // Técnicos;
        const tecnico = [...document.querySelectorAll('.tecnicos span')]
            .filter(span => span.id)
            .map(span => span.textContent)

        if (tecnico.length == 0 && ['LPU PEÇAS', 'LPU FERRAMENTAS'].includes(orcamentoBase.lpu_ativa))
            return popup({ mensagem: 'LPU PEÇAS & FERRAMENTAS > O campo técnico não fica em branco!' })

        // Antes de "data" ser sobrescrita: orçamento antigo usa a última data gravada como registro.
        garantirValidadeOrcamento(orcamentoBase.dados_orcam ??= {})

        orcamentoBase.dados_orcam = {
            ...orcamentoBase.dados_orcam,
            omie_cliente,
            venda_direta,
            condicoes: el('condicoes').value,
            consideracoes: String(el('consideracoes').value).toUpperCase(),
            data: dataServidor().toLocaleString('pt-BR'),
            garantia: el('garantia').value,
            tipo_de_frete: el('tipo_de_frete').value,
            emissor: el('emissor').value,
            email_analista: el('email_analista').value,
            analista: el('analista').value,
            telefone_analista: el('telefone_analista').value,
            executor,
            tecnico
        }

        // Se não existir a chave contrato; sequencial fará que o servidor crie;
        orcamentoBase.dados_orcam.contrato ??= 'sequencial'

        if (idOrcamento) {

            // Tags são salvar em tempo real;

            await enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamentoBase.dados_orcam)
            await abrirAtalhos(idOrcamento)

        } else {

            // Tags estão dentro do objeto, serão salvas junto do orçamento;

            baseOrcamento(orcamentoBase)
        }

        removerPopup()

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
