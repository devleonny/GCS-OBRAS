const filtroPda = {}
let pdas = {}
let guiaAtual = null
let tecPda = null
const coments = (comentario, campo, id) => {

    if (!comentario) comentario = ''
    return `
        <div style="${horizontal}; gap: 5px;">
            <div class="comentario-padrao" oninput="mostrarBtn(this)" contentEditable="true">${comentario.replace('\n', '<br>') || ''}</div>
            <img data-campo="${campo}" onclick="atualizarPda(this, '${id}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
        </div>
    `
}

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
    if (!data) return { data: '', estilo: '' }

    const [ano, mes, dia] = data.split('-')
    const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atrasado = hoje > dataPrazo

    return {
        data: `${dia}/${mes}/${ano}`,
        estilo: atrasado ? 'atrasado' : 'pendente'
    }
}

async function telaInicial() {

    document.querySelector('[name="titulo"]').textContent = 'GCS'
    dados_clientes = await recuperarDados('dados_clientes')
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    tagsTemporarias = await recuperarDados('tags_orcamentos')
    pdas = await recuperarDados('pda')

    const guias = ['Indicadores', 'PDA', 'CONCLUÍDO', 'Técnicos']

    const acumulado = `
        <div id="loading" style="${horizontal};">
            <img src="gifs/loading.gif" style="width: 5rem;">
            <span style="color: white;">Carregando tabelas...</span>
        </div>
        <div class="tela-gerenciamento">
            <div style="${horizontal}; gap: 5px; width: 100%;">
                ${guias.map(guia => `
                    <div style="opacity: 0.5;" class="aba-toolbar" id="toolbar-${guia}" onclick="mostrarGuia('${guia}')">
                        <label>${guia}</label>
                    </div>
                    `).join('')}
            </div>
            <div id="tabelas" style="width: 100%;">
                ${indicadores()}
                ${carregarPDA()}
                ${carregarTecnicos()}
            </div>
        </div>
    `

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento) {
        tela.innerHTML = acumulado
        criarMenus('inicial')
    }

    const ativos = []

    for (const [idOrcamento, dados] of Object.entries(pdas)) {
        ativos.push(idOrcamento)
        linPda(idOrcamento, dados)
    }

    const trs = document.querySelectorAll('#pda tr')
    for (const tr of trs) if (!ativos.includes(tr.id)) tr.remove()

    mostrarGuia()

    auxMapa('pda')

}

function auxMapa(base) {

    // Preencher o mapa de orçamentos x estado;
    const contadores = {}

    const mapaOverlay = document.getElementById('mapaOverlay')
    mapaOverlay.innerHTML = ''

    const tools = document.querySelectorAll('[name="toolbar-mapas"]')
    for (const tool of tools) {
        const tipo = tool.dataset.tipo
        tool.style.opacity = tipo == base ? 1 : 0.5
    }

    if (base == 'orcamento') {
        for (const [, orcamento] of Object.entries(dados_orcamentos)) {
            const codOmie = orcamento?.dados_orcam?.omie_cliente
            const cliente = dados_clientes[codOmie]

            if (!cliente) continue
            if (!cliente.estado) continue

            contadores[cliente.estado] ??= 0
            contadores[cliente.estado]++
        }

    } else {

        for (const [idPda, pda] of Object.entries(pdas)) {

            const codOmie = dados_orcamentos?.[idPda]?.dados_orcam?.omie_cliente
            const cliente = dados_clientes[codOmie]
            const estado = cliente?.estado || pda?.estado || null

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

    for (const [idPda, pda] of Object.entries(pdas)) {

        const orc = dados_orcamentos?.[idPda]
        const listaTecs = orc?.checklist?.tecnicos || pda?.tecnicos || []
        const historico = orc?.status?.historicoStatus || {}

        for (const [, dados] of Object.entries(historico)) {
            if (dados?.para == 'CONCLUÍDO') break
        }

        for (const codTec of listaTecs) {

            if (!tecnicosMap[codTec]) {
                const tec = dados_clientes?.[codTec] || {}
                tecnicosMap[codTec] = {
                    nome: tec.nome || 'Sem Nome',
                    projetos: []
                }
            }

            tecnicosMap[codTec].projetos.push(idPda)
        }
    }

    let linhas = ''

    for (const [codTec, dadosTec] of Object.entries(tecnicosMap)) {

        let projetosHtml = ''

        for (const idPda of dadosTec.projetos) {

            const pda = pdas[idPda]
            const orc = dados_orcamentos?.[idPda]
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
                <div style="${horizontal}; gap: 5px; margin-bottom:8px;">
                    <img src="imagens/projeto.png" onclick="criarOrcamentoPda('${idPda}')">
                    <textarea class="etiquetas" style="width:100%;" oninput="mostrarBtn(this)">${pda.nome || ''}</textarea>
                    <img data-campo="nome" onclick="atualizarPda(this, '${idPda}')" style="display:none; width:1.5rem;" src="imagens/concluido.png">
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
                    <img src="imagens/atualizar3.png" onclick="sincronizarPda()">
                </div>
            </div>

            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>

            <div class="rodape-tabela"></div>
        </div>
    `

    const chave = 'tabela-Técnicos'
    const t = document.querySelector(`.${chave}`)
    if (t) return t.innerHTML = acumulado

    return `<div class="${chave}" name="tabela">${acumulado}</div>`
}


function indicadores() {

    const permitidos = ['adm', 'gerente', 'diretoria']

    const totais = {
        pendente: 0,
        atrasado: 0,
        concluido: 0
    }

    const tUsuario = {}
    let acoes = ''

    for (const [idOrcamento, pda] of Object.entries(pdas || {})) {


        for (const [idAcao, dados] of Object.entries(pda?.acoes || {})) {
            const dt = dados?.status == 'concluído'
                ? 'concluido'
                : dtPrazo(dados?.prazo).estilo || 'pendente'

            totais[dt]++

            tUsuario[dados.responsavel] ??= {}
            tUsuario[dados.responsavel][dt] ??= 0
            tUsuario[dados.responsavel][dt]++

            if (dados?.responsavel == acesso.usuario || permitidos.includes(acesso.permissao)) {

                if (dados.status == 'concluído') continue

                const formato = dtPrazo(dados?.prazo)

                acoes += `
                <div style="${horizontal}; width: 100%; gap: 0.5rem;">
                    <div class="etiqueta-${formato.estilo}">
                        <span><b>Ação:</b> ${dados?.acao || ''}</span>
                        <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                        <span><b>Prazo:</b> ${formato.data}</span>
                        ${dados.registro
                        ? `<span><b>criado em: </b>${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                        : ''}
                    </div>
                    <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
                </div>`
            }

        }
    }

    const box = (titulo, valor, cor) => `
    <div class="ind" style="border-left: 6px solid ${cor};">
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
                    ${box("Concluído", totais?.concluido || 0, "#008000")}
                </div>
            </div>
        `
    }

    const acumulado = `
    <div style="${horizontal}; align-items: start; justify-content: start; width: 100%;">
        <div style="${vertical}; width: 50%;">

            ${indi(totais, 'Geral')}
            ${tUsuario[acesso?.usuario] ? indi(tUsuario[acesso?.usuario], acesso.usuario || '...') : ''}
            <div style="${vertical}; padding: 1rem; gap: 0.5rem; width: 100%;">
                <span>Ações pendentes do Usuário</span>
                <div class="acoes">
                    ${acoes}
                </div>
            </div>
            
        </div>
        
        <div style="${vertical}; align-items: center; padding: 0.5rem;">
            <div style="${horizontal}; gap: 0.5rem;">
                <img src="imagens/atualizar3.png" onclick="sincronizarPda()">
                <div class="aba-toolbar" name="toolbar-mapas" data-tipo="pda" onclick="auxMapa('pda')">Orçamentos em PDA</div>
                <div class="aba-toolbar" name="toolbar-mapas" data-tipo="orcamento" onclick="auxMapa('orcamento')">Orçamentos x Estado</div>
            </div>
            <div class="fundo-mapa">
                <img src="imagens/mapa.png" class="mapa">
                <svg id="mapaOverlay" width="600" height="600" style="position: absolute; top: 0; left: 0;"></svg>
            </div>
        </div>

    </div>
    `
    const tIndicadores = document.querySelector('.tabela-Indicadores')
    if (tIndicadores) return tIndicadores.innerHTML = acumulado

    return `<div class="tabela-Indicadores" name="tabela">${acumulado}</div>`
}

function mostrarGuia(nomeGuia = guiaAtual || 'Indicadores') {

    guiaAtual = nomeGuia

    // Todas as guias e abas ocultadas;
    const tabelas = document.querySelectorAll('[name="tabela"]')
    for (const t of tabelas) t.style.display = 'none'

    const guias = document.querySelectorAll('.aba-toolbar')
    for (const g of guias) g.style.opacity = 0.5

    // Exibir apenas a selecionada;
    const aba = document.getElementById(`toolbar-${nomeGuia}`)
    aba.style.opacity = 1

    const tabela = document.querySelector(`.tabela-${nomeGuia}`)
    if (tabela) tabela.style.display = 'flex'

    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'

    const tPda = document.querySelector('.tela-gerenciamento')
    if (tPda) tPda.style.display = 'flex'

}

async function sincronizarPda() {
    overlayAguarde()
    await sincronizarDados('pda')
    await sincronizarDados('dados_clientes')
    await sincronizarDados('dados_orcamentos')
    await telaInicial()
    removerOverlay()
}

function carregarPDA() {

    const colunas = ['Cliente', 'Tags', 'Técnicos', 'Início', 'Término', 'Comentários', 'Ação Necessário', 'Checklist', 'Detalhes', 'Excluir']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const pesquisas = colunas.map((op, i) => `<th style="background-color: white; text-align: left;" oninput="pesquisarGenerico('${i}', this.textContent, filtroPda, 'pda')" contentEditable="true"></th>`).join('')

    const acumulado = `
        <div class="tabela-PDA" name="tabela">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/baixar.png" onclick="adicionarLinPda()">
                    <img src="imagens/atualizar3.png" onclick="sincronizarPda()">
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisas}</tr>
                    </thead>
                    <tbody id="bodyPDA"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        <div class="tabela-CONCLUÍDO" name="tabela" style="flex-direction: column;">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/atualizar3.png" onclick="sincronizarPda()">
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                    </thead>
                    <tbody id="bodyCONCLUÍDO"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    return acumulado
}

function auxCliPda(codOmie) {

    const cliente = dados_clientes[codOmie] || {}

    if (!cliente) return

    return `
    ${cliente.nome}<br>
    ${cliente.cnpj}<br>
    ${cliente.cidade}<br>
    `
}

function linPda(idOrcamento, dados) {

    const orcamento = dados_orcamentos[idOrcamento]
    const codCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[codCliente] || {}
    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const pda = pdas[idOrcamento]
    const listaTecs = orcamento?.checklist?.tecnicos || pda?.tecnicos || []

    const tecs = listaTecs
        .map(codTec => {
            const cliente = dados_clientes?.[codTec] || {}
            return `<div class="etiquetas" style="min-width: 100px;">${cliente?.nome || '...'}</div>`
        }).join('')

    const acoes = Object.entries(dados.acoes || {})
        .map(([idAcao, dados]) => {

            const formato = dtPrazo(dados?.prazo)

            return `
            <div style="${horizontal}; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${dados?.status == 'concluído' ? 'ok' : formato.estilo}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                    <span><b>Prazo:</b> ${formato.data}</span>
                    ${dados.registro
                    ? `<span><b>criado em: </b>${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                    : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `}).join('')

    const existente = `
        <div style="${vertical}; gap: 2px; text-align: left;">
            <span><b>Número: </b>${orcamento?.dados_orcam?.contrato || ''}</span>
            <span><b>Cliente: </b>${cliente?.nome || '...'}</span>
            <span><b>Data: </b>${orcamento?.dados_orcam?.data || '...'}</span>
            <span><b>Cidade: </b>${cliente?.cidade || '...'}</span>
            <span><b>Valor: </b> ${dinheiro(orcamento?.total_geral)}</span>
            <select name="status" class="etiquetas" onchange="alterarStatus(this, '${idOrcamento}')">
                ${opcoes}
            </select>
        </div>
    `
    const novo = `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/projeto.png" onclick="criarOrcamentoPda('${idOrcamento}')">
            <div style="${vertical}; gap: 2px;">
                <span>Estado</span>
                <select class="etiquetas" onchange="atualizarEstado(this, '${idOrcamento}')">
                    <option></option>
                    ${Object.keys(posicoesEstados).map(estado => `<option ${dados.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select>
            </div>
            <div class="etiquetas" style="width: 100%; height: 50px;" oninput="mostrarBtn(this)" contentEditable="true">${dados.nome || ''}</div>
            <img data-campo="nome" onclick="atualizarPda(this, '${idOrcamento}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
        </div>
    `

    const tags = `
        <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
            <div name="tags" style="${vertical}; gap: 1px;">
                ${gerarLabelsAtivas(orcamento?.tags || {})}
            </div>
            <img 
                src="imagens/etiqueta.png" 
                style="width: 1.2rem;" 
                onclick="tagsOrcamento('${idOrcamento}')">
        </div>
    `

    const tds = `
        <td>
            ${orcamento ? existente : novo}
        </td>
        <td>
            ${orcamento ? tags : ''}
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="id_orcam = '${idOrcamento}'; tecPda = true; tecnicosAtivos()" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${tecs}
                </div>
            </div>
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${dados.inicio ? 'ok' : 'pendente'}"
            value="${dados?.inicio || ''}" 
            onchange="alterarDatas(this, 'inicio', '${idOrcamento}')">
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${dados.termino ? 'ok' : 'pendente'}"
            value="${dados?.termino || ''}" 
            onchange="alterarDatas(this, 'termino', '${idOrcamento}')">
        </td>

        <td>${coments(dados?.comentario, 'comentario', idOrcamento)}</td>

        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="formAcao('${idOrcamento}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div class="bloco-acoes">
                    ${acoes}
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

    const historico = orcamento?.status?.historicoStatus || {}
    let concluido = false

    for (const [, dados] of Object.entries(historico)) {
        if (dados?.para == 'CONCLUÍDO') {
            concluido = true
            break
        }
    }

    const aba = concluido ? 'CONCLUÍDO' : 'PDA'
    const destino = document.getElementById(`body${aba}`)
    const idTr = `PDA_${idOrcamento}`
    let tr = document.getElementById(idTr)

    if (tr) {
        const statusAtual = tr.dataset.status
        const deveriaSer = concluido ? 'S' : 'N'

        // linha está na aba errada → mover
        if (statusAtual !== deveriaSer) {
            tr.remove()
            tr = null
        }
    }

    if (!tr) {
        // criar nova na aba correta
        destino.insertAdjacentHTML(
            'beforeend',
            `<tr data-status="${concluido ? 'S' : 'N'}" id="PDA_${idOrcamento}">${tds}</tr>`
        )
    } else {
        // atualizar conteúdo se ela já estava na aba correta
        tr.dataset.status = concluido ? 'S' : 'N'
        tr.innerHTML = tds
    }

}

async function criarOrcamentoPda(id) {

    const orcamento = {
        id,
        checklist: { tecnicos: pdas?.[id].tecnicos || {} }
    }

    baseOrcamento(orcamento)
    await telaCriarOrcamento()

}

function confirmarExcluirPda(idOrcamento) {
    const acumulado = `
    <div style="background-color: #d2d2d2; gap: 1rem; padding: 1rem; ${horizontal};">
        <span>Tem certeza?</span>
        <button onclick="excluirPda('${idOrcamento}')">Confirmar</buttton>
    </div>
    `

    popup(acumulado, 'Pense bem...', true)
}

async function excluirPda(idOrcamento) {

    overlayAguarde()
    await deletarDB('pda', idOrcamento)
    deletar(`pda/${idOrcamento}`)
    await telaInicial()
    removerPopup()

}

async function atualizarEstado(select, idOrcamento) {

    const pda = await recuperarDado('pda', idOrcamento)
    const estado = select.value
    pda.estado = estado

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/estado`, estado)

}

async function atualizarPda(img, idOrcamento) {

    const div = img.previousElementSibling
    const info = div.textContent
    const campo = img.dataset.campo

    const pda = await recuperarDado('pda', idOrcamento)
    pda[campo] = info

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/${campo}`, info)

    img.style.display = 'none'

}

async function alterarDatas(input, campo, idOrcamento) {

    const pda = await recuperarDado('pda', idOrcamento)
    const data = input.value

    input.classList = data ? 'etiqueta-ok' : 'etiqueta-pendente'

    pda[campo] = data

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/${campo}`, data)

}

async function formAcao(idOrcamento, idAcao) {

    id_orcam = idOrcamento

    const pda = await recuperarDado('pda', idOrcamento)
    const dados = pda?.acoes?.[idAcao] || {}

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

    const pda = await recuperarDado('pda', id_orcam)

    delete pda.acoes[idAcao]

    await inserirDados({ [id_orcam]: pda }, 'pda')
    deletar(`pda/${id_orcam}/acoes/${idAcao}`)

    await telaInicial()

    removerPopup()
    removerPopup()

}

async function salvarAcao(idOrcamento, idAcao) {

    overlayAguarde()

    idAcao = idAcao || ID5digitos()

    const el = (nome) => {
        const elem = document.querySelector(`[name="${nome}"]`)
        return elem
    }

    const responsavel = el('responsavel').id
    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value

    const a = {
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    const pda = await recuperarDado('pda', idOrcamento)
    pda.acoes ??= {}
    pda.acoes[idAcao] = a

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/acoes/${idAcao}`, a)

    removerPopup()
    await telaInicial()
}

function adicionarLinPda() {

    const linhas = [
        {
            texto: 'Orçamento',
            elemento: `
            <div style="${horizontal}; gap: 5px;">
                <div id="caixaSelecaoOrcamento" data-existente="S">
                    <span 
                    class="opcoes" name="orcamento" 
                    onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/omie_cliente[auxCliPda]', 'total_geral[dinheiro]'])">
                        Selecione
                    </span>
                </div>
                <img onclick="alterarModo()" src="imagens/ajustar.png">
            </div>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarCartao()` }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Adicionar linha' })
    form.abrirFormulario()

}

function alterarModo() {

    const cxSel = document.getElementById('caixaSelecaoOrcamento')
    const existente = cxSel.dataset.existente

    if (existente == 'S') {
        const id = unicoID()
        cxSel.innerHTML = `<textarea name="orcamento" id="${id}"></textarea>`
        cxSel.dataset.existente = 'N'

    } else {
        cxSel.innerHTML = `
            <span 
            class="opcoes" name="orcamento" 
            onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/omie_cliente[auxCliPda]', 'total_geral[dinheiro]'])">
                Selecione
            </span>
        `
        cxSel.dataset.existente = 'S'
    }

}

async function salvarCartao() {

    overlayAguarde()

    const elemento = document.querySelector('[name="orcamento"]')
    if (!elemento.id) {
        removerPopup()
        return
    }

    const idOrcamento = elemento.id
    const dados = {
        usuario: acesso.usuario
    }

    if (elemento.tagName === 'TEXTAREA') dados.nome = elemento.value

    await inserirDados({ [idOrcamento]: dados }, 'pda')
    await telaInicial()

    enviar(`pda/${idOrcamento}`, dados)

    removerPopup()

}

async function origemDados(toggle, inicial) {

    overlayAguarde()
    origem = toggle.checked ? 'novos' : 'antigos'
    const track = document.querySelector('.track')
    const thumb = document.querySelector('.thumb')

    sessionStorage.setItem('origem', origem)

    if (!track) return

    if (origem == 'novos') {
        toggle.checked = true
        document.body.style.background = 'linear-gradient(45deg, #249f41, #151749)'
        track.style.backgroundColor = "#4caf50"
        thumb.style.transform = "translateX(0)"
    } else {
        toggle.checked = false
        document.body.style.background = 'linear-gradient(45deg, #B12425, #151749)'
        track.style.backgroundColor = "#B12425"
        thumb.style.transform = "translateX(26px)"
    }

    if (!inicial) await executar(funcaoTela)

    removerOverlay()
    precosDesatualizados(true)
}

function interruptorCliente(mostrar, inicial) {

    origem = sessionStorage.getItem('origem') || 'novos'
    const interruptor = document.querySelector('.interruptor')

    if (!mostrar) return interruptor.innerHTML = ''

    const acumulado = `
        <div id="interruptorOrigem" class="gatilhos-interruptor">
            <span>Clientes novos</span>

            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">

                <input onchange="origemDados(this);" type="checkbox" id="toggle" style="opacity:0; width:0; height:0;" ${origem == 'novos' ? 'checked' : ''}>
                
                <span class="track"></span>
                <span class="thumb"></span>

            </label>

            <span>Antigos</span>
        </div>
    `
    const gatilhos = document.getElementById('interruptorOrigem')
    if (!gatilhos) interruptor.innerHTML = acumulado

    origemDados({ checked: origem == 'novos' }, inicial)

}

async function filtrarArquivados(remover) {
    const tagArquivado = document.querySelector('[name="tagArquivado"]')
    if (remover) {
        naoArquivados = true
    } else {
        naoArquivados = naoArquivados ? false : true
    }

    if (!naoArquivados) {
        const balao = `
        <div name="tagArquivado" class="tag">
            <img style="width: 1.5rem;" src="imagens/desarquivar.png">
            <span>Arquivados</span>
            <img style="width: 1.2rem;" src="imagens/cancel.png" onclick="filtrarArquivados(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagArquivado.remove()
    }

    await telaOrcamentos()
}

async function filtrarMeus(remover) {
    const tagMeus = document.querySelector('[name="tagMeus"]')
    if (remover) {
        meusOrcamentos = true
    } else {
        meusOrcamentos = meusOrcamentos ? false : true
    }

    if (!meusOrcamentos) {
        const balao = `
        <div name="tagMeus" class="tag">
            <img style="width: 1.5rem;" src="imagens/painelcustos.png">
            <span>Meus orcaçamentos</span>
            <img style="width: 1.2rem;" src="imagens/cancel.png" onclick="filtrarMeus(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagMeus.remove()
    }

    await telaOrcamentos()
}

