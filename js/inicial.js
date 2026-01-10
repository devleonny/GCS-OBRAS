let tags_orcamentos = {}
let guiaAtual = null
const abas = ['PDA', 'POC', 'INFRA', 'LOGÍSTICA', 'EM_ANDAMENTO', 'CONCLUÍDO']
const coments = (comentario, campo, id) => {

    if (!comentario) comentario = ''
    return `
        <div style="${horizontal}; gap: 5px;">
            <div class="comentario-padrao" oninput="mostrarBtn(this)" contentEditable="true">${comentario.replace('\n', '<br>') || ''}</div>
            <img data-campo="${campo}" onclick="atualizarPda(this, '${id}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
        </div>
    `
}

let ultimoTitulo = null

const posicoesEstados = {
    "AC": { x: 80, y: 230 },
    "AL": { x: 575, y: 225 },
    "AP": { x: 340, y: 60 },
    "AM": { x: 150, y: 150 },
    "BA": { x: 480, y: 270 },
    "CE": { x: 515, y: 150 },
    "DF": { x: 395, y: 322 },
    "ES": { x: 500, y: 380 },
    "GO": { x: 365, y: 325 },
    "MA": { x: 435, y: 155 },
    "MG": { x: 450, y: 360 },
    "MS": { x: 295, y: 390 },
    "MT": { x: 280, y: 280 },
    "PA": { x: 320, y: 165 },
    "PB": { x: 580, y: 190 },
    "PE": { x: 540, y: 210 },
    "PI": { x: 470, y: 200 },
    "PR": { x: 345, y: 455 },
    "RJ": { x: 470, y: 420 },
    "RN": { x: 570, y: 155 },
    "RO": { x: 175, y: 250 },
    "RR": { x: 200, y: 60 },
    "RS": { x: 320, y: 530 },
    "SC": { x: 365, y: 495 },
    "SE": { x: 565, y: 255 },
    "SP": { x: 385, y: 415 },
    "TO": { x: 390, y: 240 }
}

function preencherMapa(estado, numero) {
    const svg = document.getElementById("mapaOverlay")
    const pos = posicoesEstados[estado]
    if (!pos) return

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g")

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bg.setAttribute("x", pos.x - 18)
    bg.setAttribute("y", pos.y - 14)
    bg.setAttribute("width", "36")
    bg.setAttribute("height", "28")
    bg.setAttribute("rx", "8")
    bg.setAttribute("fill", "#ffffff")
    bg.setAttribute("stroke", "#333")
    bg.setAttribute("stroke-width", "1.2")

    const texto = document.createElementNS("http://www.w3.org/2000/svg", "text")
    texto.setAttribute("x", pos.x)
    texto.setAttribute("y", pos.y + 2)
    texto.setAttribute("font-size", "16")
    texto.setAttribute("font-weight", "bold")
    texto.setAttribute("fill", "#333")
    texto.setAttribute("text-anchor", "middle")
    texto.setAttribute("dominant-baseline", "middle")
    texto.textContent = numero

    group.appendChild(bg)
    group.appendChild(texto)
    svg.appendChild(group)
}

const dtPrazo = (data) => {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')
    const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atrasado = hoje > dataPrazo
    return atrasado
}

async function telaInicial() {

    atribuirVariaveis()

    mostrarMenus(false)

    document.querySelector('[name="titulo"]').textContent = 'GCS'

    const acumulado = `
        <div id="loading" style="${horizontal};">
            <img src="gifs/loading.gif" style="width: 5rem;">
            <span style="color: white;">Carregando tabelas...</span>
        </div>
        <div class="tela-gerenciamento">

            <div style="${horizontal}; width: 80vw;">
                <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
                <div id="toolbar">
                    ${['INDICADORES', 'TÉCNICOS', ...abas].map(aba => `
                        <div style="opacity: 0.5; height: 3rem;" class="aba-toolbar" id="toolbar-${aba}" onclick="mostrarGuia('${aba}')">
                            <label>${aba.replace('_', ' ')}</label>
                            ${aba !== 'INDICADORES' ? `<span id="contador-${aba}"></span>` : ''}
                        </div>
                        `).join('')}
                </div>
                <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
            </div>

            <div id="tabelas" style="width: 100%;"></div>
        </div>
    `

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento) {
        tela.innerHTML = acumulado
        criarMenus('inicial')
    }

    dados_clientes = await recuperarDados('dados_clientes')
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    tags_orcamentos = await recuperarDados('tags_orcamentos')

    // Carregar tabelas;
    indicadores()
    carregarPDA()
    carregarTecnicos()

    const ativos = []

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        if (!orcamento.aba) continue
        ativos.push(idOrcamento)
        linPda(idOrcamento, orcamento)
    }

    for (const aba of abas) {
        const trs = document.querySelectorAll(`#body${aba} tr`)
        for (const tr of trs) if (!ativos.includes(tr.id)) tr.remove()
    }

    mostrarGuia()
    contadores()
    auxMapa('EM_ANDAMENTO')

}

function contadores() {

    for (const aba of [...abas, 'TÉCNICOS']) {
        const trs = document.querySelectorAll(`#body${aba} tr`)
        let contador = 0

        for (const tr of trs) {
            const display = tr.style.display
            if (display !== 'none') contador++
        }

        const spanContador = document.getElementById(`contador-${aba}`)
        if (spanContador) spanContador.textContent = contador

    }
}

function auxMapa(aba) {

    const tMapas = document.querySelector('.toolbar-mapas')
    tMapas.innerHTML = ''

    for (const aba of [...abas]) {

        const toolbar = `
            <div class="aba-toolbar" name="toolbar-mapas" data-tipo="${aba}" onclick="auxMapa('${aba}')">${aba.replace('_', ' ')}</div>
        `
        tMapas.insertAdjacentHTML('beforeend', toolbar)
    }

    // Preencher o mapa de orçamentos x estado;
    const contadores = {}

    const mapaOverlay = document.getElementById('mapaOverlay')
    mapaOverlay.innerHTML = ''

    const tools = document.querySelectorAll('[name="toolbar-mapas"]')
    for (const tool of tools) {
        const tipo = tool.dataset.tipo
        tool.style.opacity = tipo == aba ? 1 : 0.5
    }

    if (aba == 'ORÇAMENTOS') {
        for (const [, orcamento] of Object.entries(dados_orcamentos)) {
            const codOmie = orcamento?.dados_orcam?.omie_cliente
            const cliente = dados_clientes[codOmie]

            if (!cliente) continue
            if (!cliente.estado) continue

            contadores[cliente.estado] ??= 0
            contadores[cliente.estado]++
        }

    } else {

        for (const [idOrcamento, orc] of Object.entries(dados_orcamentos)) {

            if (!orc.aba) continue
            if (orc.aba == 'CONCLUÍDO') continue
            if (orc.aba !== aba) continue

            const codOmie = dados_orcamentos?.[idOrcamento]?.dados_orcam?.omie_cliente
            const cliente = dados_clientes[codOmie]
            const estado = cliente?.estado || orc?.pda?.estado || ''

            if (!estado) continue

            contadores[estado] ??= 0
            contadores[estado]++
        }

    }

    for (const [estado, total] of Object.entries(contadores)) {
        preencherMapa(estado, total)
    }
}

function carregarTecnicos() {

    const tecnicosMap = {}   // { codTec: { nome, projetos: [] } }

    for (const [idOrcamento, orc] of Object.entries(dados_orcamentos)) {

        if (!orc.pda) continue

        const listaTecs = orc?.checklist?.tecnicos || []
        const historico = orc?.status?.historicoStatus || {}
        let concluido = false

        for (const [, dados] of Object.entries(historico)) {
            if (dados?.para == 'CONCLUÍDO') {
                concluido = true
                break
            }
        }

        // se não quiser contar projetos concluídos:
        if (concluido) continue

        for (const codTec of listaTecs) {

            if (!tecnicosMap[codTec]) {
                const tec = dados_clientes?.[codTec] || {}
                tecnicosMap[codTec] = {
                    nome: tec.nome || 'Sem Nome',
                    projetos: []
                }
            }

            tecnicosMap[codTec].projetos.push(idOrcamento)
        }
    }

    let linhas = ''

    for (const [codTec, dadosTec] of Object.entries(tecnicosMap)) {

        let projetosHtml = ''

        for (const idOrcamento of dadosTec.projetos) {

            const orc = dados_orcamentos?.[idOrcamento]
            const codCliente = orc?.dados_orcam?.omie_cliente || ''
            const cliente = dados_clientes?.[codCliente] || {}

            const blocoProjeto = orc
                ? `
                <div class="etiquetas">
                    <span><b>Número: </b>${orc?.dados_orcam?.contrato || ''}</span>
                    <span><b>Cliente: </b>${cliente?.nome || '...'}</span>
                    <span><b>Data: </b>${orc?.dados_orcam?.data || '...'}</span>
                    <span><b>Cidade: </b>${cliente?.cidade || '...'}</span>
                    <span><b>Valor: </b>${dinheiro(orc?.total_geral)}</span>
                </div>`
                : `
                <div class="etiquetas">
                    <span>${orc.projeto || 'Projeto sem nome'}</span>
                </div>
            `

            projetosHtml += blocoProjeto
        }

        linhas += `
        <tr data-tecnico="${codTec}">
            <td>${dadosTec.nome}</td>
            <td><div style="${vertical}; gap: 2px;">${projetosHtml}</div></td>
        </tr>
        `
    }

    const colunas = ['Técnico', 'Projetos']

    const acumulado = `
        <div style="${vertical}; width: 100%;">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/atualizar.png" onclick="sincronizarPda()">
                </div>
            </div>

            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr>
                    </thead>
                    <tbody id="bodyTÉCNICOS">${linhas}</tbody>
                </table>
            </div>

            <div class="rodape-tabela"></div>
        </div>
    `

    const tabelas = document.getElementById('tabelas')
    const tabTec = document.querySelector('[name="tabela-TÉCNICOS"]')

    if (tabTec) return tabTec.innerHTML = acumulado
    tabelas.insertAdjacentHTML('beforeend', `<div class="tabelas-pda" name="tabela-TÉCNICOS">${acumulado}</div>`)

}


function indicadores() {

    const permitidos = ['adm', 'gerente', 'diretoria']

    const totais = {
        pendente: 0,
        atrasado: 0,
        concluído: 0
    }

    const tUsuario = {}
    let strgAcoes = ''

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        if (!orcamento.pda) continue
        const acoes = orcamento?.pda?.acoes || {}

        const chamado = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato || orcamento?.projeto || '-'

        for (const [idAcao, dados] of Object.entries(acoes)) {

            const estilo = dados?.status === 'concluído'
                ? 'concluído'
                : dtPrazo(dados?.prazo)
                    ? 'atrasado'
                    : 'pendente'

            totais[estilo]++

            tUsuario[dados.responsavel] ??= {}
            tUsuario[dados.responsavel][estilo] ??= 0
            tUsuario[dados.responsavel][estilo]++

            // Filtragem por acesso

            if (dados.responsavel == acesso.usuario || permitidos.includes(acesso.permissao)) {

                const [ano, mes, dia] = dados.prazo.split('-')
                const prazo = `${dia}/${mes}/${ano}`

                strgAcoes += `
                    <div name="acao" data-estilo="${estilo}" class="bloco-acao">
                        <div class="etiqueta-${estilo}">
                            <span><b>ID:</b> ${chamado}</span>
                            <span><b>Aba:</b> ${orcamento.aba || ''}</span>
                            <div style="white-space: pre-wrap;"><b>Ação:</b> ${dados?.acao || ''}</div>
                            <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                            <span><b>Prazo:</b> ${prazo}</span>
                            ${dados.registro
                        ? `<span><b>criado em: </b>${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                        : ''}
                        </div>
                        <img src="imagens/pesquisar2.png" style="width: 2rem;" onclick="irORC('${idOrcamento}')">
                    </div>`
            }

        }
    }

    const box = (titulo, valor, cor) => `
    <div class="ind" style="border-left: 6px solid ${cor};" onclick="filtrarAcoes('${titulo}')">
        <span style="font-size: 14px; color:#444;">${titulo}</span>
        <strong style="font-size: 22px; margin-top:5px;">${valor}</strong>
    </div>`

    const indi = (totais, texto) => {

        return `
            <div style="${vertical}; gap: 5px; padding: 0.5rem;">
                <span>Contador de ações <b>${texto}</b></span>
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    ${box("Pendente", totais?.pendente || 0, "#41a6ff")}
                    ${box("Atrasado", totais?.atrasado || 0, "#ff0000")}
                    ${box("Concluído", totais?.concluído || 0, "#008000")}
                </div>
            </div>
        `
    }

    const indiGeral = permitidos.includes(acesso.permissao) ? indi(totais, 'Geral') : ''

    const acumulado = `
    <div class="painel-indicadores">

        <div style="${vertical}; align-items: center; padding: 0.5rem;">
            <div class="toolbar-mapas"></div>
            <div class="fundo-mapa">
                <img src="imagens/mapa.png" class="mapa">
                <svg id="mapaOverlay" width="600" height="600" style="position: absolute; top: 0; left: 0;"></svg>
            </div>
        </div>
        <div style="${vertical};">

            ${indiGeral}
            ${tUsuario[acesso?.usuario] ? indi(tUsuario[acesso?.usuario], acesso.usuario || '...') : ''}
            <div style="${vertical}; padding: 1rem; gap: 0.5rem; width: 100%;">
                <div style="${horizontal}; gap: 2rem;">
                    <span>Ações pendentes do Usuário</span>
                    <img src="imagens/atualizar.png" onclick="sincronizarPda()">
                </div>
                <div class="acoes">
                    ${strgAcoes}
                </div>
            </div>
            
        </div>

    </div>
    `
    const tabelas = document.getElementById('tabelas')
    const tIndicadores = document.querySelector('.tabela-indicadores')
    if (tIndicadores) return tIndicadores.innerHTML = acumulado
    tabelas.insertAdjacentHTML('beforeend', `<div class="tabela-indicadores" name="tabela-INDICADORES">${acumulado}</div>`)

    filtrarAcoes('pendente')

}

function filtrarAcoes(titulo = ultimoTitulo) {

    ultimoTitulo = titulo

    titulo = String(titulo).toLowerCase()

    const divs = document.querySelectorAll(`[name="acao"]`)

    for (const div of divs) {
        div.style.display = div.dataset.estilo !== titulo ? 'none' : ''
    }

}

function mostrarGuia(nomeGuia = guiaAtual || 'INDICADORES') {

    guiaAtual = nomeGuia

    // Todas as guias e abas ocultadas;
    const tabelas = document.querySelectorAll('[name^="tabela-"]')
    for (const t of tabelas) t.style.display = 'none'

    const guias = document.querySelectorAll('.aba-toolbar')
    for (const g of guias) g.style.opacity = 0.5

    // Exibir apenas a selecionada;
    const aba = document.getElementById(`toolbar-${nomeGuia}`)
    aba.style.opacity = 1

    const tabela = document.querySelector(`[name=tabela-${nomeGuia}]`)
    if (tabela) tabela.style.display = 'flex'

    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'

    const tPda = document.querySelector('.tela-gerenciamento')
    if (tPda) tPda.style.display = 'flex'

}

async function sincronizarPda() {
    overlayAguarde()
    await sincronizarDados('dados_clientes')
    await sincronizarDados('dados_orcamentos')
    await telaInicial()
    await sincronizarTags()
    removerOverlay()
}

function carregarPDA() {

    const colunas = ['Cliente', 'Tags', 'Técnicos', 'Início', 'Término', 'Comentários', 'Ação Necessário', 'Checklist', 'Detalhes', 'Remover']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const mod = (aba) => {
        const pesquisas = colunas.map((op, i) => `
            <th style="background-color: white; text-align: left;" 
            oninput="pesquisarGenerico('${i}', this.textContent, 'body${aba}'); contadores()" 
            contentEditable="true"></th>`).join('')

        return `
        <div name="tabela-${aba}" class="tabelas-pda">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/baixar.png" onclick="editarLinPda({aba: '${aba}'})">
                    <img src="imagens/atualizar.png" onclick="sincronizarPda()">
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisas}</tr>
                    </thead>
                    <tbody id="body${aba}"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `}

    const tabelas = document.getElementById('tabelas')

    for (const aba of abas) {
        const tab = mod(aba)
        const existente = document.getElementById(`body${aba}`)
        if (!existente) tabelas.insertAdjacentHTML('beforeend', tab)
    }

}

function linPda(idOrcamento, orcamento) {

    const codCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[codCliente]
    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const pda = orcamento.pda || {}
    const listaTecs = orcamento?.checklist?.tecnicos || pda?.tecnicos || []

    const tecs = listaTecs
        .map(codTec => {
            const cliente = dados_clientes?.[codTec] || {}
            return `<div class="etiquetas" style="min-width: 100px;">${cliente?.nome || '...'}</div>`
        }).join('')

    const mod = (texto, elemento) => `
        <div style="${vertical}; gap: 2px;">
            <span><b>${texto}:</b></span>
            ${elemento}
        </div>
    `

    const strAcoes = Object.entries(pda.acoes || {})
        .map(([idAcao, dados]) => {

            const [ano, mes, dia] = dados.prazo.split('-')
            const prazo = `${dia}/${mes}/${ano}`

            const estilo = dados?.status === 'concluído'
                ? 'concluído'
                : dtPrazo(dados?.prazo)
                    ? 'atrasado'
                    : 'pendente'

            return `
            <div style="${horizontal}; text-align: left; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${estilo}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                    <span><b>Prazo:</b> ${prazo}</span>
                    ${dados.registro
                    ? `<span><b>criado em:</b> ${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                    : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `}).join('')

    const selectAbas = `
        <select class="etiquetas" onchange="atualizarAba(this, '${idOrcamento}')">
            <option></option>
            ${abas.map(aba => `<option ${orcamento?.aba == aba ? 'selected' : ''}>${aba}</option>`).join('')}
        </select>
    `

    const existente = `
        <div style="${vertical}; gap: 2px; text-align: left;">
            <span><b>Número: </b>${orcamento?.dados_orcam?.contrato || ''}</span>
            <span><b>Cliente: </b>${cliente?.nome || '...'}</span>
            <span><b>Data: </b>${orcamento?.dados_orcam?.data || '...'}</span>
            <span><b>Cidade: </b>${cliente?.cidade || '...'}</span>
            <span><b>Valor: </b> ${dinheiro(orcamento?.total_geral)}</span>

            ${mod('Status', `
                <select name="status" class="etiquetas" onchange="id_orcam = '${idOrcamento}'; alterarStatus(this)">
                    ${opcoes}
                </select>
                `)}

        </div>
    `
    const novo = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span><b>Projeto:</b> ${orcamento?.projeto || 'Projeto sem nome'}</span>
            <div style="${horizontal}; justify-content: end; align-items: end; gap: 5px;">

                ${mod('Estado', `
                    <select class="etiquetas" data-campo="estado" onchange="atualizarCampo(this, '${idOrcamento}')">
                        <option></option>
                        ${Object.keys(posicoesEstados).map(estado => `<option ${pda.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
                    </select>
                    `)}
                
                <img src="imagens/editar.png" onclick="editarLinPda({idOrcamento:'${idOrcamento}'})">
                <img src="imagens/projeto.png" onclick="confirmarCriarOrcamento('${idOrcamento}')">
            </div>
        </div>
    `

    const strTags = `
        <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
            <div name="tags" style="${vertical}; gap: 1px;">
                ${renderAtivas({ idOrcamento, recarregarPainel: false })}
            </div>
            <img 
                src="imagens/etiqueta.png" 
                style="width: 1.2rem;" 
                onclick="renderPainel('${idOrcamento}')">
        </div>
    `

    const tds = `
        <td>
            ${cliente ? existente : novo}
            ${mod('Aba', selectAbas)}
        </td>
        <td>
            ${orcamento ? strTags : ''}
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="id_orcam = '${idOrcamento}'; tecnicosAtivos()" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${tecs}
                </div>
            </div>
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${orcamento.inicio ? 'concluído' : 'pendente'}"
            value="${orcamento?.inicio || ''}" 
            onchange="alterarDatas(this, 'inicio', '${idOrcamento}')">
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${orcamento.termino ? 'concluído' : 'pendente'}"
            value="${orcamento?.termino || ''}" 
            onchange="alterarDatas(this, 'termino', '${idOrcamento}')">
        </td>

        <td>${coments(pda?.comentario, 'comentario', idOrcamento)}</td>

        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="formAcao('${idOrcamento}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div class="bloco-acoes">
                    ${strAcoes}
                </div>
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%; gap: 2px;">
                ${orcamento?.checklist?.andamento
            ? divPorcentagem(orcamento.checklist.andamento)
            : ''
        }
            </div>
        </td>
        <td>
            ${orcamento ? `<img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;">` : ''}
        </td>
        <td>
            <img onclick="confirmarExcluirPda('${idOrcamento}')" src="imagens/cancel.png" style="width: 1.5rem;">
        </td>
    `

    const aba = orcamento.aba
    const tbody = document.getElementById(`body${aba}`)
    const trExistente = document.getElementById(idOrcamento)
    const timestamp = trExistente?.dataset?.timestamp
    const trAba = trExistente?.dataset?.aba || 'PDA'

    if (trExistente && trAba !== aba) {
        trExistente.remove()
        trExistente = null
    }

    if (trExistente) {
        if (!orcamento.timestamp || orcamento.timestamp !== timestamp) {
            trExistente.innerHTML = tds
            trExistente.dataset.timestamp = orcamento.timestamp || ''
        }
    } else {
        tbody.insertAdjacentHTML(
            'beforeend',
            `<tr id="${idOrcamento}"
            data-timestamp="${orcamento.timestamp || ''}"
            data-aba="${aba}">
            ${tds}
        </tr>`
        )
    }

}

function confirmarCriarOrcamento(idOrcamento) {
    const acumulado = `
        <div style="${horizontal}; gap: 1rem; background-color: #d2d2d2; padding: 1rem;">
            <span>Deseja transformar esse item em orçamento?</span>
            <button onclick="criarOrcamentoPda('${idOrcamento}')">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Transformar em Orçamento', true)
}

async function criarOrcamentoPda(id) {

    removerPopup()

    const orcamento = dados_orcamentos[id]
    orcamento.id = id

    baseOrcamento(orcamento)
    await telaCriarOrcamento()

}

function confirmarExcluirPda(idOrcamento) {
    const acumulado = `
    <div style="background-color: #d2d2d2; gap: 1rem; padding: 1rem; ${horizontal};">
        <span>Este item será apenas removido das tabelas, <br>Ele não será excluído dos orçamentos</span>
        <button onclick="excluirPda('${idOrcamento}')">Confirmar</buttton>
    </div>
    `

    popup(acumulado, 'Remover dos PDAs', true)
}

async function excluirPda(idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]

    const trExistente = document.getElementById(idOrcamento)
    enviar(`dados_orcamentos/${idOrcamento}/aba`, '')
    removerPopup()

    if (trExistente) trExistente.remove()
    contadores()

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

}

async function atualizarAba(select, idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const valor = select.value
    orcamento.aba = valor

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/aba`, valor)

    if (telaAtiva == 'inicial') await telaInicial()
    if (telaAtiva == 'orcamentos') await telaOrcamentos(true)
}

async function atualizarCampo(select, idOrcamento) {

    const campo = select.dataset.campo
    const orcamento = dados_orcamentos[idOrcamento]
    const valor = select.value
    orcamento.pda ??= {}
    orcamento.pda[campo] = valor

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/${campo}`, valor)

    await telaInicial()
}

async function atualizarPda(img, idOrcamento) {

    const div = img.previousElementSibling
    const info = div.textContent
    const campo = img.dataset.campo

    const orcamento = dados_orcamentos[idOrcamento]
    orcamento.pda ??= {}
    orcamento.pda[campo] = info

    img.style.display = 'none'

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/${campo}`, info)

}

async function alterarDatas(input, campo, idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const data = input.value

    input.classList = data ? 'etiqueta-concluído' : 'etiqueta-pendente'

    orcamento[campo] = data

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/${campo}`, data)

}

async function formAcao(idOrcamento, idAcao) {

    id_orcam = idOrcamento

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const dados = orcamento?.pda?.acoes?.[idAcao] || {}

    const linhas = [
        { texto: 'Ação', elemento: `<textarea name="acao">${dados?.acao || ''}</textarea>` },
        {
            texto: 'Responsável',
            elemento: `<span 
            class="opcoes" 
            name="responsavel" 
            ${dados.responsavel ? `id="${dados.responsavel}"` : ''}
            onclick="cxOpcoes('responsavel', 'dados_setores', ['usuario', 'setor'])">
                ${dados.responsavel || 'Selecione'}
            </span>`
        },
        { texto: 'Prazo da ação', elemento: `<input name="prazo" type="date" value="${dados?.prazo || ''}">` },
        {
            texto: 'Status', elemento: `
            <select name="statusAcao">
                ${['pendente', 'concluído'].map(op => `<option ${dados?.status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            ` }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAcao('${idOrcamento}' ${idAcao ? `, '${idAcao}'` : ''})` }
    ]

    if (idAcao) botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirAcao('${idAcao}')` })

    const form = new formulario({ linhas, botoes, titulo: 'Ações' })
    form.abrirFormulario()

}

async function confirmarExcluirAcao(idAcao) {

    const acumulado = `
        <div style="${horizontal}; background-color: #d2d2d2; gap: 2rem; padding: 1rem;">
            <span>Tem certeza?</span>
            <button onclick="excluirAcao('${idAcao}')">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Pense bem...', true)

}

async function excluirAcao(idAcao) {

    overlayAguarde()

    const orcamento = dados_orcamentos[id_orcam]

    delete orcamento.pda.acoes[idAcao]

    dados_orcamentos[id_orcam] = orcamento

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${id_orcam}/pda/acoes/${idAcao}`)

    await telaInicial()

    removerPopup()
    removerPopup()

}

async function salvarAcao(idOrcamento, idAcao) {

    overlayAguarde()

    idAcao = idAcao || ID5digitos()

    const painel = document.querySelector('.painel-padrao')
    const el = (nome) => {
        const elem = painel.querySelector(`[name="${nome}"]`)
        return elem
    }

    const responsavel = el('responsavel').id
    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value

    if (!prazo || !responsavel) return popup(mensagem('Preencha o prazo e/ou responsável da ação'), 'Alerta', true)

    const a = {
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    const orcamento = dados_orcamentos[idOrcamento]
    orcamento.pda ??= {}
    orcamento.pda.acoes ??= {}
    orcamento.pda.acoes[idAcao] = a

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/acoes/${idAcao}`, a)

    removerPopup()
    await telaInicial()
}

function editarLinPda({ idOrcamento, aba = 'PDA' }) {

    const orcamento = dados_orcamentos[idOrcamento]

    const linhas = [
        {
            texto: 'Nome do Projeto',
            elemento: `<textarea name="projeto"></textarea>`
        },
        {
            texto: 'Estado',
            elemento: `
                <select name="estado">
                    ${Object.keys(posicoesEstados).map(estado => `<option ${orcamento?.pda?.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aba',
            elemento: `
                <select name="aba">
                    ${abas.map(a => `<option ${(aba || orcamento?.aba) == a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            `
        }
    ]

    const funcao = idOrcamento ? `salvarCartao('${idOrcamento}')` : 'salvarCartao()'

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    const titulo = idOrcamento ? 'Editar item' : 'Adicionar item'

    const form = new formulario({ linhas, botoes, titulo })
    form.abrirFormulario()

}

async function salvarCartao(idOrcamento) {

    overlayAguarde()

    const projeto = document.querySelector('[name="projeto"]').value
    const estado = document.querySelector('[name="estado"]').value
    const aba = document.querySelector('[name="aba"]').value
    const dados = {
        projeto,
        estado,
        aba,
        checklist: { tecnicos: [] },
        usuario: acesso.usuario
    }

    const orcamento = {
        ...dados_orcamentos[idOrcamento] || {},
        ...dados
    }

    if (idOrcamento) {
        enviar(`dados_orcamentos/${idOrcamento}/projeto`, projeto)
        enviar(`dados_orcamentos/${idOrcamento}/estado`, estado)
        enviar(`dados_orcamentos/${idOrcamento}/aba`, aba)
    } else {
        idOrcamento = `PDA_${unicoID()}`
        enviar(`dados_orcamentos/${idOrcamento}`, dados)
    }

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    await telaInicial()

    removerPopup()

}
