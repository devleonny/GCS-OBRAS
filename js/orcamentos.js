let filtro
let arquivado = 'N'
let auxiliarFaturamento = {}
let pAtual = 1
const itensPorPagina = 100
let tPaginas = 1
const baloes = document.querySelector('.baloes-top')
let orcsFiltrados = {}
let orcsHierarquia = {}

const meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
}

async function atualizarOrcamentos() {

    const tabelas = [
        'dados_orcamentos',
        'dados_composicoes',
        'dados_clientes',
        'dados_ocorrencias',
        'departamentos_AC',
        'hierarquia'
    ]

    for (const tabela of tabelas) await sincronizarDados(tabela)

    await auxDepartamentos()
    await telaOrcamentos()
    await sincronizarTags()

}

function ordenarOrcamentos(colunaIndex) {
    const body = document.getElementById('linhas')
    if (!body) return

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    const ordem = tabelaOrcamento.dataset.ordem
    tabelaOrcamento.dataset.ordem = ordem === 'asc' ? 'des' : 'asc'

    // pega as linhas base
    const linhas = Array.from(body.querySelectorAll('.linha-orcamento-tabela'))

    // cria um mapeamento linha → container
    const pares = linhas.map(linha => ({
        linha,
        container: linha.closest('.linha-master')
    }))

    pares.sort((a, b) => {
        const celA = a.linha.querySelectorAll('.celula')[colunaIndex]
        const celB = b.linha.querySelectorAll('.celula')[colunaIndex]

        const valA = celA?.querySelector('input, select')?.value?.trim() || celA?.textContent?.trim() || ''
        const valB = celB?.querySelector('input, select')?.value?.trim() || celB?.textContent?.trim() || ''

        const numA = parseFloat(valA.replace(',', '.'))
        const numB = parseFloat(valB.replace(',', '.'))

        if (!isNaN(numA) && !isNaN(numB))
            return ordem === 'asc' ? numA - numB : numB - numA

        return ordem === 'asc'
            ? valA.localeCompare(valB, 'pt-BR', { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, 'pt-BR', { numeric: true, sensitivity: 'base' })
    })

    // limpa e reinsere os containers ordenados (evita duplicar o mesmo container)
    const vistos = new Set()
    body.innerHTML = ''
    for (const { container } of pares) {
        if (container && !vistos.has(container)) {
            body.appendChild(container)
            vistos.add(container)
        }
    }
}

async function rstTelaOrcamentos() {
    tela.innerHTML = ''
    await telaOrcamentos()
}

async function telaOrcamentos() {

    // Ocultar a barra de rolagem
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.body.style.overflow = 'hidden'


    // Inicializar filtros com base na origem;
    const f = JSON.parse(sessionStorage.getItem('filtros')) || {}
    filtrosPesquisa.orcamentos ??= {}
    filtrosPesquisa.orcamentos.origem = f?.origem || ''
    filtrosPesquisa.orcamentos.arquivado = f?.arquivado || ''
    filtrosPesquisa.orcamentos.meus_orcamentos = f?.meus_orcamentos || ''


    const pda = document.querySelector('.tela-gerenciamento')
    if (pda) return await telaInicial()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    hierarquia = await recuperarDados('hierarquia')

    const colunasCFiltro = ['status', 'tags', 'chamado', 'cidade', 'valor']
    const cabecs = ['data', 'status', 'pedido', 'notas', 'tags', 'contrato', 'cidade', 'responsaveis', 'indicadores', 'valor', 'ações']
    const filtrosOff = ['status', 'ações', 'indicadores']
    let ths = ''
    let pesquisa = ''
    cabecs.forEach((cab, i) => {

        ths += `
            <div class="ths-orcamento">
                <span>${inicialMaiuscula(cab)}</span>
                ${colunasCFiltro.includes(cab)
                ? `<img onclick="ordenarOrcamentos('${i}')" src="imagens/filtro.png">`
                : ''}
            </div>`
        pesquisa += `
            <div class="ths-orcamento">
                ${!filtrosOff.includes(cab)
                ? `<input placeholder="Pesquisar" name="col_${i}" onkeydown="if(event.key === 'Enter') renderizar('${cab}', this.value)">`
                : ''}
            </div>`

    })

    const acumulado = `
        <div style="${horizontal}; width: 95vw;">
            <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
            <div id="toolbar"></div>
            <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
        </div>

        <div id="tabelaOrcamento" data-ordem="asc" style="${vertical}; width: 95vw;">
            <div class="topo-tabela" style="justify-content: space-between; width: 100%; background-color: #707070;">
                <div id="paginacao"></div>
                <span style="color: white; cursor: pointer;" onclick="filtroOrcamentos()">Filtros ☰</span>
            </div>
            <div class="div-tabela" style="overflow-x: hidden;">
                <div class="cabecalho">
                    <div class="linha-orcamento-tabela" style="width: 100%; padding: 0px; background-color: #d2d2d2;">${ths}</div>
                    <div class="linha-orcamento-tabela" style="padding: 0px;">${pesquisa}</div>
                </div>
                <div id="linhas"></div>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento) tela.innerHTML = acumulado

    await auxDepartamentos()
    tags_orcamentos = await recuperarDados('tags_orcamentos')

    orcsFiltrados = {}
    orcsHierarquia = {}

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {
        criarLinhaOrcamento(idOrcamento, orcamento)
    }

    criarMenus('orcamentos')

    pAtual = 1
    aplicarFiltrosEPaginacao()
    renderizar('status', 'todos')

}

function filtroOrcamentos() {

    const salvo = JSON.parse(sessionStorage.getItem('filtros')) || {}

    const filtros = {
        arquivado: salvo.arquivado || '',
        origem: salvo.origem || '',
        meus_orcamentos: salvo.meus_orcamentos || ''
    }

    const linhas = []

    const interruptor = (chave, ativo) => `
        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
            <input 
                type="checkbox"
                ${ativo ? 'checked' : ''}
                name="filtros"
                onchange="mudarInterruptor(this)"
                data-chave="${chave}"
                style="opacity:0; width:0; height:0;">
            <span class="track" style="background-color:${ativo ? '#4caf50' : '#ccc'}"></span>
            <span class="thumb" style="transform:translateX(${ativo ? '26px' : '0'})"></span>
        </label>
        `

    for (const [chave, valor] of Object.entries(filtros)) {
        linhas.push({
            texto: inicialMaiuscula(chave),
            elemento: interruptor(chave, valor == 'S')
        })
    }

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarFiltrosApp()' }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Filtro' })
    form.abrirFormulario()

}

function salvarFiltrosApp() {

    const filtros = document.querySelectorAll('[name="filtros"]')

    const salvo = {}

    for (const f of filtros) {
        const chave = f.dataset.chave
        const st = f.checked ? 'S' : 'N'
        salvo[chave] = st
        renderizar(chave, st)
    }

    sessionStorage.setItem('filtros', JSON.stringify(salvo))

    removerPopup()

}

function mudarInterruptor(toggle) {

    const label = toggle.closest('label')
    const track = label.querySelector('.track')
    const thumb = label.querySelector('.thumb')

    if (!track || !thumb) return

    if (toggle.checked) {
        track.style.backgroundColor = "#4caf50"
        thumb.style.transform = "translateX(26px)"
    } else {
        track.style.backgroundColor = "#ccc"
        thumb.style.transform = "translateX(0)"
    }
}

function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

function criarLinhaOrcamento(idOrcamento, orcamento) {

    const dados_orcam = orcamento.dados_orcam
    if (!dados_orcam) return

    const cliente = dados_clientes?.[dados_orcam.omie_cliente] || {}
    let labels = {
        PEDIDO: '',
        FATURADO: ''
    }

    for (const historico of Object.values(orcamento?.status?.historico || {})) {

        if (labels[historico.status] == undefined) continue
        if (historico.tipo == 'Remessa') continue

        const valor1 = historico.tipo
        const valor2 = historico.status == 'FATURADO' ? historico.nf : historico.pedido
        const valor3 = conversor(historico.valor)

        labels[historico.status] += `
            <div class="etiquetas"> 
                <label>${valor1}</label>
                <label>${valor2}</label>
                ${historico.valor ? `<label>${dinheiro(valor3)}</label>` : ''}
            </div>
            `
    }

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const totalCustos = Object.values(orcamento?.dados_custos || {}).reduce((acc, val) => acc + val, 0)
    const lucratividade = orcamento.total_geral - totalCustos
    const lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const cel = (elementos) => `<div class="celula">${elementos}</div>`

    const numOficial = dados_orcam?.chamado || dados_orcam?.contrato || '-'
    const idMaster = hierarquia?.[idOrcamento]?.idMaster
    const orcamentoMaster = dados_orcamentos[idMaster]
    const numOficialMaster = orcamentoMaster?.dados_orcam?.chamado || orcamentoMaster?.dados_orcam?.contrato || '-'
    const orcamentosVinculados = idMaster
        ? `
        <div style="${horizontal}; gap: 3px;">
            ${numOficial}
            <img src="imagens/link2.png" onclick="confirmarRemoverVinculo('${idOrcamento}')" style="width: 1.5rem;">
            <span><b>${numOficialMaster}</b></span>
            <span style="display: none;">vinculado</span>
        </div>
        `
        : numOficial

    const data = new Date(orcamento.timestamp).toLocaleDateString()

    // De orçamentos Pendentes;
    const info = Object.values(orcamento?.status?.historicoStatus || {}).filter(s => s.info)

    const opcoesPda = abas.map(aba => `<option ${orcamento.aba == aba ? 'selected' : ''}>${aba}</option>`).join('')

    const tags = renderAtivas({ idOrcamento, recarregarPainel: false })

    const celulas = `
        ${cel(`
            <div style="${vertical}; gap: 2px;">
                <label><b>${orcamento.lpu_ativa}</b></label>
                <span>${data}</span>
                <select name="aba" class="opcoesSelect" onchange="atualizarAba(this, '${idOrcamento}')">
                    <option></option>
                    ${opcoesPda}
                </select>
            </div>
        `)}
        ${cel(`
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 2px;">
                    <select name="status" class="opcoesSelect" onchange="id_orcam = '${idOrcamento}'; alterarStatus(this)">
                        ${opcoes}
                    </select>
                    ${(info.length > 0 && st == 'ORC PENDENTE') ? `<img onclick="mostrarInfo('${idOrcamento}')" src="gifs/interrogacao.gif">` : ''}
                </div>
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Dep</span>
                    <img src="imagens/${depPorDesc[numOficial] ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        `)}
        ${cel(`<div class="bloco-etiquetas">${labels.PEDIDO}</div>`)}
        ${cel(`<div class="bloco-etiquetas">${labels.FATURADO}</div>`)}
        ${cel(`
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${idOrcamento}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${tags}
                </div>
            </div>
            `)}
        ${cel(`
        <div style="${vertical};">
            ${orcamentosVinculados}
            <span>${cliente?.nome || ''}</span>
        </div>`)}
        ${cel(`${cliente?.cidade || ''}`)}
        ${cel(`
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        `)}
        ${cel(`
            <div style="${vertical}; width: 100%; gap: 2px;">
                ${orcamento?.checklist?.andamento
            ? `
                    <span>Checklist</span>
                    ${divPorcentagem(orcamento.checklist.andamento)}`
            : ''}
                ${orcamento.dados_custos
            ? `
                    <span>LC %</span>
                    ${divPorcentagem(lucratividadePorcentagem)}`
            : ''}
            </div>
            `)}
        ${cel(`
            <div style="${vertical}; width: 100%;">
                <input style="display: none;" type="number" value="${orcamento.total_geral}">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(orcamento.total_geral)}</span>
            </div>
            `)}
        ${cel(`<img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;">`)}
        `

    const linha = `
        <div class="linha-master"
            data-chamado="${orcamento?.chamado ? 'S' : 'N'}"
            data-timestamp="${orcamento?.timestamp}" 
            id="${idOrcamento}">
                <div class="linha-orcamento-tabela">
                    ${celulas}
                </div>
                <div class="linha-slaves"></div>
        </div>`

    const status = orcamento?.status?.atual || 'SEM STATUS'
    const chamados = (orcamento?.chamado == 'S' && (status == 'SEM STATUS' || status == 'ORC ENVIADO'))
        ? 'S'
        : 'N'

    if (idMaster) {
        orcsHierarquia[idMaster] ??= []
        orcsHierarquia[idMaster].push(idOrcamento)
    }

    const participantes = `${orcamento.usuario} ${responsaveis}`

    orcsFiltrados[idOrcamento] = {
        meus_orcamentos: participantes.includes(acesso.usuario) ? 'S' : 'N',
        idMaster,
        timestamp: orcamento.timestamp,
        linha,
        arquivado: orcamento?.arquivado || 'N',
        status,
        chamados,
        origem: orcamento?.origem == 'novos' ? 'S' : 'N',
        responsaveis: participantes,
        cidade: cliente?.cidade,
        contrato: `${cliente?.nome} ${orcamentosVinculados}`,
        pedido: labels.PEDIDO,
        notas: labels.FATURADO,
        data,
        valor: orcamento?.total_geral || 0,
        tags
    }

}

function aplicarFiltrosEPaginacao(resetar = false) {

    mostrarMenus(false)

    const body = document.getElementById('linhas')
    body.innerHTML = ''

    const f = JSON.parse(sessionStorage.getItem('filtros')) || {}

    const filtrados = Object.values(orcsFiltrados).filter(dados => {
        return Object.entries(filtrosPesquisa.orcamentos || {})
            .every(([campoFiltro, valorFiltro]) => {

                // Filtro binário (S / N)
                if (valorFiltro === 'S' || valorFiltro === 'N') {
                    return dados[campoFiltro] === valorFiltro
                }

                const valor = dados?.[campoFiltro]
                if (valor == null) return false

                return String(valor)
                    .toLowerCase()
                    .includes(String(valorFiltro).toLowerCase())
            })
    })

    carregarToolbar(filtrados, resetar)

    tPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina))

    const inicio = (pAtual - 1) * itensPorPagina
    const fim = inicio + itensPorPagina

    filtrados
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(inicio, fim)
        .forEach(d => body.insertAdjacentHTML('beforeend', d.linha))

    renderizarControlesPagina()

    organizarHierarquia()
}

function renderizarControlesPagina() {
    const topo = document.getElementById('paginacao')
    if (!topo) return

    topo.innerHTML = `
        <div style="display: flex; align-items:center; gap:10px; padding: 0.2rem;">
            <img src="imagens/seta.png" style="width: 1.5rem;" onclick="pgAnterior()" ${pAtual === 1 ? 'disabled' : ''}>
            <span style="color: white;">Página ${pAtual} de ${tPaginas}</span>
            <img src="imagens/seta.png" style="transform: rotate(180deg); width: 1.5rem;" onclick="pgSeguinte()" ${pAtual === tPaginas ? 'disabled' : ''}>
            <span style="color: white;">Dê um <b>ENTER</b> para pesquisar</span>
        </div>
    `
}

function pgAnterior() {
    if (pAtual > 1) {
        pAtual--
        aplicarFiltrosEPaginacao()
    }
}

function pgSeguinte() {
    if (pAtual < tPaginas) {
        pAtual++
        aplicarFiltrosEPaginacao()
    }
}

function carregarToolbar(dados, resetar) {

    if (!dados) return

    contToolbar = {
        chamados: 0,
        todos: 0
    }

    for (const orcamento of dados) {

        const status = orcamento?.status || 'SEM STATUS'

        contToolbar[status] ??= 0
        contToolbar[status]++
        contToolbar.todos++

        if (orcamento?.chamados == 'S') contToolbar.chamados++
    }

    const toolbar = document.getElementById('toolbar')
    if (resetar) toolbar.innerHTML = ''

    for (const [campo, contagem] of Object.entries(contToolbar)) {
        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        const funcao = campo == 'chamados'
            ? `delete filtrosPesquisa.orcamentos.status; renderizar('chamados', 'S')`
            : `delete filtrosPesquisa.orcamentos.chamados; renderizar('status', '${campo}')`

        const novaTool = `
            <div 
            style="opacity: 0.5; height: 3rem;" 
                class="aba-toolbar"
                data-status="${campo}"
                name="${campo}" 
                onclick="${funcao}">
                <label>${campo.toUpperCase()}</label>
                <span>${contagem}</span>
            </div>
        `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}

function renderizar(campo, texto) {

    if (texto !== '' && (campo == 'chamados' || campo == 'status')) {
        const tools = document.querySelectorAll('.aba-toolbar')
        tools.forEach(t => t.style.opacity = 0.5)
        const tool = document.querySelector(`[name="${campo == 'chamados' ? 'chamados' : texto}"]`)
        tool.style.opacity = 1
    }

    if (texto == 'todos') texto = ''

    const f = JSON.parse(sessionStorage.getItem('filtros')) || {}

    if (campo) {
        if (texto === '' || texto == null) {
            delete filtrosPesquisa.orcamentos[campo]
        } else {
            filtrosPesquisa.orcamentos[campo] =
                f[campo]
                    ? texto
                    : String(texto).toLowerCase()
        }
    }

    pAtual = 1
    aplicarFiltrosEPaginacao()
}

async function organizarHierarquia() {

    const divLinhas = document.getElementById('linhas')

    const divsCompl = divLinhas.querySelectorAll('.linha-master')

    for (const div of divsCompl) {

        const idOrcamento = div.id

        if (!orcsHierarquia[idOrcamento]) continue
        const linha = div.querySelector('.linha-orcamento-tabela')
        linha.style.backgroundColor = '#ffdea4'

        const divSlaves = div.querySelector('.linha-slaves')
        const slaves = orcsHierarquia[idOrcamento]

        for (const idSlave of slaves) {
            // Remove o existe, ele só aparecerá com seu Master;
            const existente = document.getElementById(idSlave)
            if (existente) existente.remove()

            const dados = orcsFiltrados[idSlave]
            divSlaves.insertAdjacentHTML('beforeend', dados.linha)
        }

    }

    /*
    for (const [idSlave, dados] of Object.entries(hierarquia)) {

        const linhaSlave = document.getElementById(idSlave)

        if (!linhaSlave) continue
        const idMaster = dados.idMaster
        const linhaMaster = document.getElementById(idMaster)

        if (!linhaMaster) continue
        if (linhaSlave.contains(linhaMaster)) continue

        const divSlaves = linhaMaster.querySelector('.linha-slaves')
        divSlaves.append(linhaSlave)

        // Master;
        const linha1 = linhaMaster.querySelector('.linha-orcamento-tabela')
        linha1.style.backgroundColor = '#ffdea4'
        // Slave
        const linha2 = linhaSlave.querySelector('.linha-orcamento-tabela')
        linha2.style.backgroundColor = '#fbe9caff'
    }
    */
}

function mostrarInfo(idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const info = Object.values(orcamento?.status?.historicoStatus || {}).filter(s => s.info)

    const infoElementos = info.map(i => `
        <div class="etiquetas">
            <span><b>Data:</b> ${i.data}</span>
            <span><b>Usuário:</b> ${i.usuario}</span>
            <span>${i.info}</span>
        </div>
        `).join('')

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            ${infoElementos}
        </div>
    `

    popup(acumulado, 'Informações', true)

}

async function painelAlteracaoCliente(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const dados_clientes = await recuperarDados('dados_clientes')
    const opcoes = Object.entries(dados_clientes)
        .map(([codOmie, cliente]) => `<option value="${codOmie}">${cliente.cnpj} - ${cliente.nome}</option>`)
        .join('')

    const acumulado = `
    <div style="display: flex; align-items: start; flex-direction: column; justify-content: center; padding: 2vw; background-color: #d2d2d2;">

        ${modelo('Cliente', orcamento.dados_orcam.cliente_selecionado)}
        ${modelo('Cliente', orcamento.dados_orcam.cnpj)}
        ${modelo('Cliente', orcamento.dados_orcam.cidade)}

        <hr style="width: 100%;">

        <label for="clientes">Clientes Omie</label>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <input style="padding: 5px; width: 100%; border-radius: 3px;" list="clientes" id="cliente">
            <datalist id="clientes">${opcoes}</datalist>
            ${botao('Salvar', `associarClienteOrcamento('${idOrcamento}')`, 'green')}
        </div>

    </div>
    `

    popup(acumulado, 'ATUALIZAR CLIENTE')
}

async function associarClienteOrcamento(idOrcamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const codOmie = document.getElementById('cliente').value

    orcamento.dados_orcam.omie_cliente = Number(codOmie)
    delete orcamento.dados_orcam.cliente_selecionado
    delete orcamento.dados_orcam.cidade
    delete orcamento.dados_orcam.cnpj
    delete orcamento.dados_orcam.estado
    delete orcamento.dados_orcam.cep
    delete orcamento.dados_orcam.bairro
    delete orcamento.dados_orcam.cliente_selecionado

    enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamento.dados_orcam)

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    removerPopup()

}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

    precosAntigos = null

    orcamentoBase.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    let novoOrcamento = {}

    novoOrcamento.dados_orcam = orcamentoBase.dados_orcam
    novoOrcamento.esquema_composicoes = orcamentoBase.esquema_composicoes
    novoOrcamento.dados_composicoes = orcamentoBase.dados_composicoes
    novoOrcamento.lpu_ativa = orcamentoBase.lpu_ativa
    novoOrcamento.dados_orcam.contrato = ''
    novoOrcamento.dados_orcam.analista = acesso.nome_completo
    novoOrcamento.dados_orcam.email_analista = acesso.email
    novoOrcamento.dados_orcam.telefone_analista = acesso.telefone

    baseOrcamento(novoOrcamento)

    removerPopup()

    precosAntigos = null

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function excelOrcamentos() {

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orçamentos')

    // Cabeçalho;
    worksheet.addRow([
        'Data',
        'Hora',
        'Status',
        'Tags',
        'Cliente',
        'Cidade',
        'Estado',
        'Usuário',
        'Origem',
        'Valor'
    ])

    for (const orcamento of Object.values(dados_orcamentos)) {

        const codCliente = orcamento?.dados_orcam?.omie_cliente
        const cliente = dados_clientes[codCliente] || {}

        const dt = orcamento?.dados_orcam?.data
        const [data, hora] = dt ? dt.split(', ') : ['', '']

        const nomesTag = Object.keys(orcamento?.tags || {})
            .map(cod => {
                return tags_orcamentos[cod] ? tags_orcamentos[cod].nome : ''
            }).join(', ')

        const row = [
            data,
            hora,
            orcamento?.status?.atual || 'SEM STATUS',
            nomesTag,
            cliente?.nome || '',
            cliente?.cidade || '',
            cliente?.estado || '',
            orcamento?.usuario || '',
            orcamento?.origem || '',
            orcamento?.total_geral || 0,
        ]

        worksheet.addRow(row)
    }

    // ====== ESTILOS ======
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }

            // Cabeçalho (primeira linha)
            if (rowNumber === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9D9D9' }
                }
                cell.font = { bold: true }
            }

            // Formatação para colunas numéricas
            if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00'
                if (rowNumber !== 1) {
                    cell.alignment.horizontal = 'right'
                }
            }
        })
    })

    // Filtro no cabeçalho
    worksheet.autoFilter = {
        from: 'A1',
        to: 'J1'
    }

    // Ajuste automático de largura das colunas
    worksheet.columns.forEach(col => {
        let maxLength = 10
        col.eachCell(cell => {
            const cellLength = String(cell.value || '').length
            if (cellLength > maxLength) {
                maxLength = cellLength
            }
        })
        col.width = Math.min(maxLength + 2, 50) // Limite máximo de 50
    })

    // Ajusta altura das linhas para conteúdo com quebra
    worksheet.eachRow(row => {
        row.height = 20
    })

    // ====== GERAR ARQUIVO ======
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `orcamentos-${new Date().getTime()}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}