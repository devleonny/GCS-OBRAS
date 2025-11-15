let quantidadeGeral = 0
let quantidadeRealizadoGeral = 0
let previsao = 0
let diasUnicos = []
let tecnicos = {}
let quantidadeItem = 0
let quantidadeRealizadoItem = 0
let finalizados = 0
let filtroChecklist = {}
let filtroRelatorioChecklist = {}
let primeiroDia = null
let tagsPainel = null

const estT = (tempo) => {
    return !tempo ? 'off' : tempo == '00:00' ? 'zero' : 'on'
}

async function telaChecklist() {

    tecnicos = {}

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    let ths = ''
    let pesquisa = ''
    const colunas = ['', 'Código', 'Tags', 'Itens do Orçamento', 'Quantidade', 'Tempo/Atividade', 'Tempo/Total', 'Serviço Executado', 'Tempo/Realizado', '% Conclusão']

    let i = 0
    for (const op of colunas) {

        if (op == '') {
            ths += `<th><input type="checkbox" onclick="marcarItensChecklist(this)"></th>`
            pesquisa += `<th style="background-color: white;"></th>`

        } else {
            pesquisa += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, filtroChecklist, 'bodyChecklist'); calcularTempos()"></th>`
            ths += `
            <th>
                <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 10px;">
                    <span>${op}</span>
                    <img src="imagens/filtro.png" style="width: 1rem;" onclick="filtrarAAZ(${i}, 'bodyChecklist')"> 
                </div>
            </th>`
        }

        i++

    }

    const acumulado = `
        <div style="${vertical}; padding: 1rem; background-color: #d2d2d2;">

            <div class="toolbar-checklist">

                <div style="${vertical}; align-items: center; width: 50%;">

                    <div style="${horizontal}; justify-content: space-evenly; width: 100%;">
                        <div id="porcentagem" style="padding: 0.5rem;"></div>
                        <span>Obra iniciada em: <b><span id="inicio"></span></b> </span>
                    </div>

                    <div class="opcoes-orcamento">
                        ${modeloBotoes('gerente', 'Técnicos na Obra', `tecnicosAtivos()`)}
                        ${modeloBotoes('cancel', 'Remover Itens Selecionados', `removerItensEmMassaChecklist()`)}
                        ${modeloBotoes('checklist', 'Ver Itens Removidos', `verItensRemovidos()`)}
                        ${modeloBotoes('baixar', 'Serviço Avulso', `adicionarServicoAvulso()`)}
                        ${modeloBotoes('relatorio', 'Relatório', `relatorioChecklist()`)}
                        ${modeloBotoes('atualizar3', 'Atualizar', `atualizarChecklist()`)}
                    </div>
                </div>

                <div class="resultados"></div>

            </div>

            <div id="tabelaCheklist" class="borda-tabela">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${pesquisa}</tr>
                        </thead>
                        <tbody id="bodyChecklist"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `

    tagsTemporarias = await recuperarDados('tags')
    const dados_composicoes = await recuperarDados('dados_composicoes')
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || false
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const titulo = `Checklist - ${orcamento?.dados_orcam?.contrato || '--'} - ${cliente?.nome || '--'}`

    const tabelaCheklist = document.getElementById('tabelaCheklist')
    if (!tabelaCheklist) popup(acumulado, titulo, true)

    // Reset 
    quantidadeGeral = 0
    finalizados = 0
    diasUnicos = []
    primeiroDia = null

    const mesclado = {
        ...orcamento?.dados_composicoes || {},
        ...orcamento?.checklist?.avulso || {}
    }

    for (const [codigo, produto] of Object.entries(mesclado)) {

        const check = orcamento?.checklist?.itens?.[codigo] || {}
        const ref = dados_composicoes?.[codigo] || {}
        carregarLinhaChecklist({ codigo, produto, check, ref })

        for (const [id, dados] of Object.entries(check)) {

            if (id == 'removido') continue

            // Registro do primeiro dia;
            const [ano, mes, dia] = dados.data.split('-')
            const dt = new Date(ano, Number(mes) - 1, dia).getTime()
            if (primeiroDia == null || primeiroDia > dt) primeiroDia = dt
            // Fim

            for (const idTec of dados?.tecnicos || []) {
                const tecnico = dados_clientes?.[idTec] || {}
                tecnicos[idTec] = tecnico?.nome || 'Desatualizado...'
            }

        }
    }

    calcularTempos()

    const dataInicio = primeiroDia ? new Date(primeiroDia).toLocaleDateString() : 'Sem data'

    document.getElementById('inicio').textContent = dataInicio

    if (!orcamento) return

    orcamento.checklist ??= {}
    orcamento.checklist.inicio = dataInicio
    orcamento.checklist.andamento = porcetagemFinal

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaOrcamentos(true)
    enviar(`dados_orcamentos/${id_orcam}/checklist/inicio`, dataInicio)
    enviar(`dados_orcamentos/${id_orcam}/checklist/andamento`, porcetagemFinal)

}

function carregarLinhaChecklist({ codigo, produto, check, ref }) {

    if (check.removido) {
        const linha = document.getElementById(`check_${codigo}`)
        if (linha) linha.remove()
        return
    }

    let quantidade = 0
    let diasUnicosLinha = []
    for (const [, dados] of Object.entries(check)) {

        quantidade += isNaN(dados.quantidade) ? 0 : dados.quantidade
        if (!diasUnicos.includes(dados.data)) diasUnicos.push(dados.data)
        if (!diasUnicosLinha.includes(dados.data)) diasUnicosLinha.push(dados.data)

    }

    const avulso = produto.tipo ? '' : '<span><b>[Avulso]</b></span>'

    // Relatório
    finalizados += quantidade / produto.qtde
    quantidadeRealizadoGeral += quantidade
    quantidadeGeral++

    const fontMaior = 'class="fonte-maior"'

    const tds = `
        <td><input name="itensChecklist" type="checkbox"></td>
        <td>${codigo}</td>
        <td>
            <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${gerarLabelsAtivas(produto?.tags || {})}
                </div>
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="tagsChecklist('${codigo}')">
            </div>
        </td>
        <td style="text-align: right;">${produto.descricao} ${avulso}</td>
        <td ${fontMaior} name="quantidade">${produto.qtde}</td>
        <td>
            <div style="${vertical};">
                <input 
                    name="tempoUnitario" 
                    oninput="atualizarTempo(this, '${codigo}', ${produto.tipo ? false : true})" 
                    type="time" 
                    class="${estT(ref?.tempo || produto?.tempo)}"
                    value="${ref?.tempo || produto?.tempo || ''}">
                <span>por <b>${produto?.unidade || 'UND'}</b></span>
            </div>
        </td>
        <td ${fontMaior} name="totalLinha"></td>
        <td>
            <div style="${horizontal}; gap: 10px;">
                <span ${fontMaior} name="quantidadeExecutada">${quantidade}</span>
                <img onclick="registrarChecklist('${codigo}')" src="imagens/baixar.png" style="width: 1.2rem;">
            </div>
        </td>
        <td ${fontMaior} name="totalLinhaExecutado"></td>
        <td>${divPorcentagem(((quantidade / produto.qtde) * 100).toFixed(1))}</td>

    `

    const trExistente = document.getElementById(`check_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('bodyChecklist').insertAdjacentHTML('beforeend', `<tr data-codigo="${codigo}" id="check_${codigo}">${tds}</tr>`)

}

async function tagsChecklist(codigo) {
    tagsPainel = await new TagsPainel({
        funcao: 'telaChecklist',
        baseTags: 'tags',
        idRef: codigo,
        baseRef: 'dados_composicoes'
    }).init()

    tagsPainel.painelTags()
}

async function tecnicosAtivos() {

    const acumulado = `
        <div style="${vertical}; padding: 1rem; background-color: #d2d2d2;">
            <span>Gerencie abaixo os envolvidos na Obra</span>
            <hr>
            <div class="painel-clientes">
                <div id="blocoTecnicos" style="${vertical};"></div>
            </div>
        </div>

        <div class="rodape-painel-clientes">
            ${botaoRodape('maisTecnico()', 'Adicionar', 'baixar')}
            ${botaoRodape('salvarTecnicos()', 'Salvar', 'concluido')}
        </div>
    `
    popup(acumulado, 'Técnicos na Obra', true)

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const dados = await recuperarDado('dados_clientes', codTec)
        maisTecnico(codTec, dados?.nome || 'N/A')
    }
}

async function salvarTecnicos() {

    overlayAguarde()

    const tecnicos = []
    const spans = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spans) {
        if (!span.id) continue
        if (tecnicos.includes[span.id]) continue
        tecnicos.push(span.id)
    }

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    orcamento.checklist ??= {}
    orcamento.checklist.tecnicos = tecnicos

    enviar(`dados_orcamentos/${id_orcam}/checklist/tecnicos`, tecnicos)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerPopup()

}

async function relatorioChecklist() {

    let ths = ''
    let pesquisa = ''

    const colunas = ['Data', 'Descrição', 'Quantidade', 'Técnicos']
        .map((op, i) => {

            ths += `<th>${op}</th>`
            pesquisa += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, filtroRelatorioChecklist, 'relatorioChecklist')"></th>`

        })

    const modelo = (valor1, valor2) => `
        <div class="modelo-relatorio" style="${vertical}; gap: 3px;">
            <label>${valor1}</label>
            <div>${valor2}</div>
        </div>
    `
    const ano = new Date().getFullYear()

    const acumulado = `
    
        <div style="background-color: #d2d2d2; padding: 2rem;">

            <div style="${horizontal}; gap: 1rem;">
                ${modelo('De', `<input name="de" onchange="gerarRelatorioChecklist()" type="date" value="${ano}-01-01">`)}
                ${modelo('Até', `<input name="ate" onchange="gerarRelatorioChecklist()" type="date" value="${ano}-12-31">`)}
            </div>

            <hr style="width: 100%;">

            <div class="toolbar-relatorio">
                <span id="toolbar-relatorio" onclick="mostrarPagina('relatorio')">Relatório</span>
                <span id="toolbar-graficos" onclick="mostrarPagina('graficos')">Gráficos</span>
            </div>

            <div class="relatorio">
                <div id="tabelaCheklist" class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${ths}</tr>
                                <tr>${pesquisa}</tr>
                            </thead>
                            <tbody id="relatorioChecklist"></tbody>
                        </table>
                    </div>
                    <div class="rodapeTabela"></div>
                </div>

                <div class="calendarios"></div>

            </div>

            <div class="graficos"></div>

        </div>

    `

    popup(acumulado, 'Relatório Diário', true)

    mostrarPagina('relatorio')
    gerarRelatorioChecklist()

}

function mostrarPagina(pagina) {

    const paginas = ['relatorio', 'graficos', 'pagamentos', 'orcamento']
    for (const pg of paginas) {
        const el = document.querySelector(`.${pg}`)
        if (el) {
            el.style.display = 'none'
            document.getElementById(`toolbar-${pg}`).style.opacity = 0.5
        }
    }

    document.querySelector(`.${pagina}`).style.display = ''
    document.getElementById(`toolbar-${pagina}`).style.opacity = 1

}

function criarCalendario(datas) {
    const ths = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .map(sem => `<th>${sem}</th>`)
        .join('')

    const marcado = `style="background-color: green; color: white;"`

    // transformar em objetos Date e agrupar por ano-mês
    const grupos = {}
    datas.forEach(ts => {
        const d = new Date(ts)
        const ano = d.getFullYear()
        const mes = d.getMonth() + 1 // 1–12
        const chave = `${ano}-${mes}`
        if (!grupos[chave]) grupos[chave] = { ano, mes, dias: new Set() }
        grupos[chave].dias.add(d.getDate())
    })

    let calendarios = ''

    for (const chave in grupos) {
        const { ano, mes, dias } = grupos[chave]
        const diasMes = new Date(ano, mes, 0).getDate()

        let trs = ''
        let tds = ''
        let primeiroDia = new Date(ano, mes - 1, 1).getDay()

        // espaços antes do primeiro dia
        for (let v = 0; v < primeiroDia; v++) {
            tds += `<td></td>`
        }

        for (let i = 1; i <= diasMes; i++) {
            const dt = new Date(ano, mes - 1, i)
            const sem = dt.getDay()

            tds += `<td ${dias.has(i) ? marcado : ''}>${i}</td>`

            if (sem === 6) {
                trs += `<tr>${tds}</tr>`
                tds = ''
            }
        }

        // completar última linha
        if (tds) {
            for (let v = new Date(ano, mes - 1, diasMes).getDay() + 1; v <= 6; v++) {
                tds += `<td></td>`
            }
            trs += `<tr>${tds}</tr>`
        }

        calendarios += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="padding: 5px;">${mes}/${ano}</span>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
        `
    }

    document.querySelector('.calendarios').innerHTML = calendarios
}

async function gerarRelatorioChecklist() {
    const tbody = document.getElementById('relatorioChecklist')
    const graficos = document.querySelector('.graficos')
    let de = document.querySelector('[name="de"]').value
    let ate = document.querySelector('[name="ate"]').value
    let datas = []

    if (!de || !ate) return

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens || {}
    const dados_clientes = await recuperarDados('dados_clientes')

    const dt = (data) => {
        const [ano, mes, dia] = data.split('-')
        return new Date(ano, mes - 1, dia)
    }

    de = dt(de)
    ate = dt(ate)

    tbody.innerHTML = ''
    graficos.innerHTML = ''

    // total de atividades
    const atividades = {
        ...orcamento?.dados_composicoes,
        ...orcamento?.checklist?.avulso
    }
    const totalAtividades = Object.keys(atividades).length || 1
    const pesoAtividade = 100 / totalAtividades

    // estrutura: { equipe: { data: somaPercentual } }
    let desempenhoEquipes = {}

    for (const [codigo, lancamentos] of Object.entries(itens)) {
        const comp = atividades[codigo]
        const descricao = comp?.descricao || '...'
        const qtdeTotal = comp?.qtde || 0

        for (const [idLancamento, dados] of Object.entries(lancamentos)) {
            const dataLancamento = dt(dados.data)
            if (dataLancamento >= de && dataLancamento <= ate) {
                datas.push(dataLancamento.getTime())

                // padroniza equipe
                const nomes = (dados.tecnicos || [])
                    .map(codTec => dados_clientes?.[codTec]?.nome || '...')
                    .sort((a, b) => a.localeCompare(b))

                const equipeKey = nomes.join(', ') || 'Sem equipe'
                const dataStr = dataLancamento.toISOString().slice(0, 10)

                // percentual proporcional ao peso da atividade
                const percentualAtividade = qtdeTotal > 0
                    ? (dados.quantidade / qtdeTotal) * pesoAtividade
                    : 0

                if (!desempenhoEquipes[equipeKey]) desempenhoEquipes[equipeKey] = {}
                if (!desempenhoEquipes[equipeKey][dataStr]) desempenhoEquipes[equipeKey][dataStr] = 0
                desempenhoEquipes[equipeKey][dataStr] += percentualAtividade

                tbody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td>${dataLancamento.toLocaleDateString('pt-BR')}</td>
                        <td>${descricao}</td>
                        <td>${dados.quantidade} / ${qtdeTotal}</td>
                        <td>
                            <div>${nomes.map(n => `<span>${n}</span>`).join('')}</div>
                        </td>
                    </tr>
                `)
            }
        }
    }

    criarCalendario(datas)

    // container flex (gráfico + indicadores)
    const container = document.createElement('div')
    container.style.display = 'flex'
    container.style.gap = '20px'
    graficos.appendChild(container)

    // canvas
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400
    container.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    // indicadores
    const indicadoresDiv = document.createElement('div')
    indicadoresDiv.style.display = 'flex'
    indicadoresDiv.style.flexDirection = 'column'
    indicadoresDiv.style.gap = '5px'
    container.appendChild(indicadoresDiv)

    // datas únicas e ordenadas
    const todasDatas = [...new Set(datas.map(ts => {
        const d = new Date(ts)
        return d.toISOString().slice(0, 10)
    }))].sort()

    // datasets
    const datasets = Object.entries(desempenhoEquipes).map(([equipe, registros]) => {
        const soma = todasDatas.reduce((acc, d) => acc + (registros[d] || 0), 0)

        // só dias com valores > 0
        const diasComRegistro = todasDatas.filter(d => (registros[d] || 0) > 0).length || 1
        const mediaDiaria = soma / diasComRegistro

        // semanal simples (média a cada 7 dias, só pelos dias com valores)
        const semanas = Math.ceil(diasComRegistro / 7) || 1
        const mediaSemanal = soma / semanas

        indicadoresDiv.insertAdjacentHTML('beforeend', `
        <span style="text-align: left;">
            <b>${equipe}</b> <br>
            Diário: ${mediaDiaria.toFixed(2)}% <br>
            Semanal: ${mediaSemanal.toFixed(2)}% <br>
        </span>
        <br>`)

        return {
            label: equipe,
            data: todasDatas.map(d => registros[d] || 0),
            borderWidth: 2,
            fill: false,
            tension: 0.2,
            borderColor: getRandomColor()
        }
    })

    // escala dinâmica (teto baseado no maior valor observado)
    const maxPercent = Math.max(
        ...Object.values(desempenhoEquipes).flatMap(registros => Object.values(registros))
    ) || 0
    const escalaMax = Math.ceil(maxPercent * 1.1)

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: todasDatas.map(d => {
                const [ano, mes, dia] = d.split('-')
                return `${dia}/${mes}`
            }),
            datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Desempenho por equipe (ponderado por atividade)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: escalaMax,
                    ticks: { callback: v => v + "%" }
                }
            }
        }
    })

    function getRandomColor() {
        return `hsl(${Math.floor(Math.random() * 360)},70%,50%)`
    }
}

async function atualizarChecklist() {
    await sincronizarDados('dados_orcamentos')
    await telaChecklist()
}

async function adicionarServicoAvulso() {

    const acumulado = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2vw;">
            ${modelo('Descrição', `<input name="descricao" style="padding: 5px; border-radius: 3px;">`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAvulso()">
        </div>
    `

    popup(acumulado, 'Incluir Serviço', true)
}

async function salvarAvulso() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const descricao = document.querySelector('[name="descricao"]').value

    if (!qtde || !descricao) return popup(mensagem('Não deixe campos em Branco'), 'Alerta', true)

    overlayAguarde()
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.avulso) orcamento.checklist.avulso = {}

    const codigo = ID5digitos()
    const dados = { qtde, descricao, usuario: acesso.usuario, data: new Date().toLocaleString() }
    orcamento.checklist.avulso[codigo] = dados

    enviar(`dados_orcamentos/${id_orcam}/checklist/avulso/${codigo}`, dados)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaChecklist()
    removerPopup()
}

async function verItensRemovidos() {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let itens = ''

    for (const [codigo, dados] of Object.entries(orcamento?.checklist?.itens || {})) {

        if (!dados.removido) continue

        const descricao = orcamento?.dados_composicoes?.[codigo]?.descricao || orcamento?.checklist?.avulso?.[codigo]?.descricao || '...'

        itens += `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItem('${codigo}', this)" src="imagens/atualizar3.png" style="width: 1.2rem;">
                <span>${descricao}</span> 
            </div>
        `
    }

    const acumulado = `
        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; min-width: 30vw;">

            ${itens}

        </div>
    
    `

    popup(acumulado, 'Itens Removidos', true)

}

async function recuperarItem(codigo, img) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    delete orcamento.checklist.itens[codigo].removido

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    img.closest('div').remove()

}

async function removerItensEmMassaChecklist() {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]:checked')

    if (itensChecklist.length == 0) return

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.itens) orcamento.checklist.itens = {}

    for (const check of itensChecklist) {

        const tr = check.closest('tr')
        const codigo = tr.dataset.codigo

        if (!orcamento.checklist.itens[codigo]) orcamento.checklist.itens[codigo] = {}
        const dados = { usuario: acesso.usuario, data: new Date().toLocaleString() }
        orcamento.checklist.itens[codigo].removido = dados

        enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`, dados)

    }

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerOverlay()
    await telaChecklist()
}

function marcarItensChecklist(input) {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

async function atualizarTempo(input, codigo, avulso) {

    if (avulso) {
        const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
        orcamento.checklist.avulso[codigo].tempo = input.value
        await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    } else {
        const produto = await recuperarDado('dados_composicoes', codigo)
        produto.tempo = input.value
        enviar(`dados_composicoes/${codigo}/tempo`, input.value)
        await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    }

    input.classList = input.value !== '' ? 'on' : 'off'
    calcularTempos()

}

function calcularTempos() {
    const linhas = document.querySelectorAll('#bodyChecklist tr')

    const strHHMM = (minutosTotais, str) => {

        const horas = Math.floor(minutosTotais / 60)
        const minutos = minutosTotais % 60
        const calculado = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`

        return str ? `${calculado}${str}` : calculado
    }

    let minutosObra = 0
    let minutosExecutado = 0
    for (const linha of linhas) {

        if (linha.style.display == 'none') continue

        const qtde = Number(linha.querySelector('[name="quantidade"]').textContent)
        const qtdeExecutada = Number(linha.querySelector('[name="quantidadeExecutada"]').textContent)

        const tdTotal = linha.querySelector('[name="totalLinha"]')
        const totalExecutado = linha.querySelector('[name="totalLinhaExecutado"]')

        const inputTempoUnitario = linha.querySelector('[name="tempoUnitario"]')
        const tempoUnitario = inputTempoUnitario.value

        if (!tempoUnitario) {
            tdTotal.textContent = ''
            totalExecutado.textContent = ''
            continue
        }

        const [h, m] = tempoUnitario.split(':').map(Number)
        const minutosUnit = h * 60 + m

        // total da linha
        const minutosTotais = minutosUnit * qtde
        minutosObra += minutosTotais

        const calculado = strHHMM(minutosTotais)
        tdTotal.textContent = calculado
        inputTempoUnitario.classList = estT(calculado)

        // total executado da linha
        const minutosExecutados = minutosUnit * qtdeExecutada
        totalExecutado.textContent = strHHMM(minutosExecutados)
        minutosExecutado += minutosExecutados
    }

    const modelo = (texto, valor) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            <span>${valor}</span>
        </div>
    `

    const divResultados = document.querySelector('.resultados')

    let resultados = ''
    const minutosPendentes = minutosObra - minutosExecutado
    const totalDiasPrevisto = Math.ceil(minutosObra / 480)
    const diasCorridos = diasUnicos.length
    const previsao = Math.ceil(minutosPendentes / 480) // 480min -- 8h -- 1dia
    const analise = (diasCorridos + previsao) <= totalDiasPrevisto
    const strAnalise = analise
        ? 'Entrega no Prazo'
        : 'Possível Atraso'

    resultados += modelo('Total de Atividades', linhas?.length || 0)
    resultados += modelo('Dias Corridos', diasCorridos)
    resultados += modelo('Conclusão <br>em Dias', previsao)
    resultados += modelo('Análise', strAnalise)

    resultados += modelo('Horas Totais', `${strHHMM(minutosObra, 'h')} <br> ${totalDiasPrevisto} dias`)
    resultados += modelo('Horas Realizadas', strHHMM(minutosExecutado, 'h'))
    resultados += modelo('Horas Pendentes', strHHMM(minutosPendentes, 'h'))
    resultados += `<div style="${horizontal}"><img src="imagens/${analise ? 'joinha' : 'atrasado'}.png" style="width: 4rem;"></div>`


    divResultados.innerHTML = resultados

    porcetagemFinal = ((minutosExecutado / minutosObra) * 100).toFixed(1)

    document.getElementById('porcentagem').innerHTML = `
        <div style="${vertical}">
            <span>Porcentagem de conclusão</span>
            ${divPorcentagem(porcetagemFinal)}
        </div>
    `
}

async function registrarChecklist(codigo) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens?.[codigo] || {}
    const dadosClientes = await recuperarDados('dados_clientes')

    const data = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    let linhas = ''

    // Bloqueio por excesso de quantidade;
    quantidadeRealizadoItem = 0
    quantidadeItem = orcamento?.dados_composicoes?.[codigo]?.qtde || orcamento?.checklist?.avulso?.[codigo].qtde || 0

    for (const [idLancamento, dados] of Object.entries(itens)) {

        quantidadeRealizadoItem += dados.quantidade

        const nomesTecnicos = (dados?.tecnicos || [])
            .map(idTec => `<span>${dadosClientes?.[idTec]?.nome || '--'}</span>`)
            .join('')

        linhas += `
        <tr>
            <td>${data(dados.data)}</td>
            <td>${dados.quantidade}</td>
            <td>
                <div style="${vertical}">
                    ${nomesTecnicos}
                </div>
            </td>
            <td><img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerChecklist('${codigo}', '${idLancamento}')"></td>
        </tr>`
    }


    const acumulado = `
        <div id="blocoTecnicos"></div>

        <hr style="width: 100%;">

        <span>Quantidade Orçada: ${quantidadeItem}</span>

        <div class="form-checklist">
            <input name="quantidadeForm" type="number">
            <input name="data" type="date">
            <img src="imagens/concluido.png" style="width: 1.5rem;" onclick="salvarQuantidade('${codigo}')">
        </div>
        
        <hr style="width: 100%;">

        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${['Data', 'Quantidade', 'Técnico(s)', 'Excluir'].map(op => `<th>${op}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const formChecklist = document.querySelector('.painel-registro-checklist')
    if (!formChecklist) popup(`<div class="painel-registro-checklist">${acumulado}</div>`, 'Registrar', true)
    else formChecklist.innerHTML = acumulado

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const dados = await recuperarDado('dados_clientes', codTec)
        maisTecnico(codTec, dados?.nome || 'N/A')
    }
}

function maisTecnico(cod, nome) {
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    cod = cod || ID5digitos()
    nome = nome || 'Selecione'

    if (document.getElementById(cod)) return

    const modelo = `
        <div style="${horizontal}; gap: 5px;">
            <span class="opcoes" id="${cod}" name="${cod}" onclick="cxOpcoes('${cod}', 'dados_clientes', ['nome', 'cnpj', 'cidade'])">${nome}</span>
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
        </div>
    `

    blocoTecnicos.insertAdjacentHTML('beforeend', modelo)
}

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnicos = []
    const spanTecnicos = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spanTecnicos) if (!tecnicos.includes(span.id)) tecnicos.push(span.id)

    const quantidade = Number(document.querySelector('[name="quantidadeForm"]').value)
    const data = document.querySelector('[name="data"]').value

    // Bloqueios;
    if ((quantidadeRealizadoItem + quantidade) > quantidadeItem) return popup(mensagem('Não é possível exceder a quantidade orçada'), 'Alerta', true)

    if (!tecnicos.length) {
        await registrarChecklist(codigo)
        return popup(mensagem('É necessário ter pelo menos 1 técnico realizando a atividade...'), 'Ninguém fez?', true)
    }

    if (!quantidade || !data) return popup(mensagem('Preencha todos os campos'), 'Alerta', true)

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    orcamento.checklist ??= {}
    orcamento.checklist.itens ??= {}
    orcamento.checklist.itens[codigo] ??= {}

    const dados = { quantidade, tecnicos, data }
    const idLancamento = ID5digitos()

    orcamento.checklist.itens[codigo][idLancamento] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    removerPopup()

    enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`, dados)

}

async function removerChecklist(codigo, idLancamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    delete orcamento.checklist.itens[codigo][idLancamento]

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()
    removerPopup()
    await registrarChecklist(codigo)

    removerOverlay()

}

function calculadoraChecklist() {

    const bodyChecklist = document.getElementById('bodyChecklist')
    const trs = bodyChecklist.querySelectorAll('tr')

    for (const tr of trs) {
        const tds = document.querySelectorAll('td')

        const qtdeOrcamento = conversor(tds[1].textContent)
        const qtdeRealizada = conversor(tds[2].textContent)

        tds[3].textContent = conversor(qtdeOrcamento - qtdeRealizada)

    }

}
