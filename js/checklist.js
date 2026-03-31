const strHHMM = (minutosTotais) => {

    const minutosPorDia = 1440

    const total = Math.round(minutosTotais) // 👈 resolve aqui

    const dias = Math.floor(total / minutosPorDia)
    const restoMinutos = total % minutosPorDia

    const horas = Math.floor(restoMinutos / 60)
    const minutos = restoMinutos % 60

    const prefixoDias = dias > 0
        ? `${dias}d `
        : ''

    return `
        <span style="white-space: nowrap;">
            ${prefixoDias}${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min
        </span>
    `
}

const estT = (tempo) => {
    return !tempo
        ? 'off'
        : tempo == '00:00'
            ? 'zero'
            : 'on'
}

async function telaChecklist(id) {

    const existente = document.querySelector('.toolbar-checklist')
    if (existente)
        return

    const { dados_composicoes, checklist, snapshots } = await recuperarDado('dados_orcamentos', id) || {}
    const { avulso } = checklist || {}

    const colunas = {
        '': {},
        'Código': { chave: 'codigo' },
        'Itens do Orçamento': { chave: 'descricao' },
        'Quantidade': { chave: 'qtde' },
        'Tempo/Atividade': {},
        'Tempo/Total': {},
        'Serviço Executado': {},
        'Tempo/Realizado': {},
        '% Conclusão': {}
    }

    const btnExtras = `
        <div style="color: white; ${horizontal}; gap: 1rem;">
            <input style="width: 1.5rem; height: 1.5rem;" type="checkbox" onclick="marcarItensChecklist(this)">
            <span>Marcar todos</span>
        </div>`

    const mesclado = {
        ...dados_composicoes || {},
        ...avulso || {}
    }

    const tabela = await modTab({
        id,
        colunas,
        pag: 'checklist',
        btnExtras,
        funcaoAdicional: ['calcularTempos'],
        filtros: {
            'tipo': { op: '!=', value: 'VENDA' }
        },
        body: 'bodyChecklist',
        criarLinha: 'carregarLinhaChecklist',
        base: await baseChecklist(mesclado)
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div class="toolbar-checklist">

                <div style="${vertical}; align-items: center;">

                    <div style="${horizontal}; justify-content: space-evenly; width: 100%;">
                        <div id="porcentagem" style="padding: 0.5rem;"></div>
                        <span>Obra iniciada em: <b><span id="inicio"></span></b> </span>
                    </div>

                    <div class="opcoes-orcamento">
                        ${modeloBotoes('gerente', 'Técnicos na Obra', `tecnicosAtivos('${id}')`)}
                        ${modeloBotoes('cancel', 'Remover Itens Selecionados', `removerItensEmMassaChecklist()`)}
                        ${modeloBotoes('checklist', 'Ver Itens Removidos', `verItensRemovidos()`)}
                        ${modeloBotoes('baixar', 'Serviço Avulso', `adicionarServicoAvulso()`)}
                        ${modeloBotoes('relatorio', 'Relatório', `relatorioChecklist()`)}
                    </div>
                    
                </div>

                <div class="resultados"></div>

            </div>

            ${tabela}

        </div>`

    const campos = (snapshots?.contrato || [])
        .filter(c => c)
        .join(' - ')

    const titulo = `Checklist - ${campos}`

    popup({ elemento, titulo })

    await paginacao()

}

async function baseChecklist(mesclado) {

    // Modelagem dos dados;
    for (const [codigo, dados] of Object.entries(mesclado)) {

        const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'
        mesclado[codigo].tempo = tempo || '00:00'

        // Item removido;
        if (itens?.[codigo]?.removido) {
            delete mesclado[codigo]
            continue
        }

        if (!dados?.tipo)
            mesclado[codigo].descricao = `${mesclado[codigo].descricao} <b>[Avulso]</b>`

        // Itens avulso não tem;
        mesclado[codigo].codigo = codigo

        mesclado[codigo].itens = itens?.[codigo] || {}

        if (qReal?.[codigo])
            mesclado[codigo].qReal = qReal?.[codigo]?.qtde
    }

    return mesclado

}

async function carregarLinhaChecklist(produto) {

    const { codigo, tempo, descricao, unidade, qtde, qReal, itens } = produto || {}

    const qtdeRealizada = Object.values(itens || {})
        .reduce((acc, item) => acc + (item?.quantidade || 0), 0)

    const [h, m] = tempo.split(':').map(Number)
    const minUnit = h * 60 + m
    const total = minUnit * (qReal || qtde || 0)
    const tempoRealizado = minUnit * qtdeRealizada

    const tds = `
        <td>
            <input style="width: 1.5rem; height: 1.5rem;" name="itensChecklist" data-codigo="${codigo}" type="checkbox">
        </td>
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>
            <div style="${horizontal}; gap: 5px;">
                <span>${qReal || qtde || 0}</span>
                <img src="imagens/ajustar.png" onclick="painelAlterarQuantidade('${codigo}')">
            </div>
        </td>
        <td>
            <div style="${horizontal}; gap: 5px;">
                <span class="${estT(tempo)}">
                    ${tempo} por <b>${unidade || 'UND'}</b>
                </span>
                <img src="imagens/ajustar.png" onclick="painelAlterarTempo('${codigo}')">
            </div>
        </td>
        <td>
            ${strHHMM(total)}
        </td>
        <td>
            <div style="${horizontal}; gap: 10px;">
                <span>${qtdeRealizada.toLocaleString('pt-BR')}</span>
                <img onclick="registrarChecklist('${codigo}')" src="imagens/baixar.png">
            </div>
        </td>
        <td>
            ${strHHMM(tempoRealizado)}
        </td>
        <td>
            ${divPorcentagem(((tempoRealizado / total) * 100).toFixed(1))}
        </td>`

    return `<tr>${tds}</tr>`

}

async function painelAlterarTempo(codigo) {

    const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'

    const linhas = [
        {
            texto: 'Qual o tempo da atividade?',
            elemento: `<input type="time" id="tempoProduto" value="${tempo}">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTempo('${codigo}')` }
    ]

    popup({ linhas, botoes, titulo: 'Definir tempo' })

}

async function salvarTempo(codigo) {

    overlayAguarde()

    const produto = await recuperarDado('dados_composicoes', codigo)

    if (!produto)
        return removerPopup()

    const tempo = document?.querySelector('#tempoProduto')?.value || '00:00'

    await enviar(`dados_composicoes/${codigo}/tempo`, tempo)

    removerPopup()

}

async function painelAlterarQuantidade(codigo) {

    const linhas = [
        {
            texto: 'Editar quantidade',
            elemento: `<input type="number" id="qReal">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarQtdReal('${codigo}')` }
    ]

    popup({ linhas, botoes, titulo: 'Nova Quantidade' })

}

async function salvarQtdReal(codigo) {

    const qtde = Number(document?.getElementById('qReal')?.value || 0)
    if (qtde == 0)
        return removerPopup()

    overlayAguarde()

    const { id } = controles.checklist

    await enviar(`dados_orcamentos/${id}/checklist/qReal/${codigo}/qtde`, qtde)

    removerPopup()

}

async function tecnicosAtivos(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const listaTecs = orcamento?.checklist?.tecnicos || []
    let tecs = ''

    for (const codTec of listaTecs) {
        const dados = await recuperarDado('dados_clientes', codTec) || {}
        tecs += maisTecnico(codTec, dados?.nome || 'N/A', true)
    }

    const linhas = [
        {
            elemento: `<div id="blocoTecnicos" style="${vertical};">${tecs}</div>`
        }
    ]

    const botoes = [
        { texto: 'Adicionar', img: 'baixar', funcao: `maisTecnico()` },
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTecnicos('${id}')` },
    ]

    popup({ linhas, botoes, titulo: 'Técnicos na Obra' })

}

async function salvarTecnicos(id) {

    overlayAguarde()

    const tecnicos = []
    const spans = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spans) {

        // Em branco
        if (span.textContent == 'Selecione')
            continue

        if (tecnicos.includes(span.id))
            continue

        tecnicos.push(span.id)
    }

    // Caso seja com base no orçamento;
    await enviar(`dados_orcamentos/${id}/checklist/tecnicos`, tecnicos)

    removerPopup()

}

async function relatorioChecklist() {

    const colunas = {
        'Data': { chave: 'data' },
        'Descrição': { chave: 'descricao' },
        'Duração': {},
        'Quantidade': {},
        'Comentários': { chave: 'comentario' },
        'Técnicos': { chave: 'tecnicos' },
    }

    const tabela = await modTab({
        pag: 'relatChecklist',
        colunas,
        body: 'relatorioChecklist',
        base: () => baseRelatorioChecklist(),
        criarLinha: 'criarLinhaRelChecklist'
    })

    const elemento = `
    
        <div style="background-color: #d2d2d2; padding: 2rem;">

            <div class="toolbar-relatorio">
                <span data-toolbar="relatorio" onclick="mostrarPagina(this)">Relatório</span>
                <span data-toolbar="graficos" onclick="mostrarPagina(this)">Gráficos</span>
            </div>

            <div data-tabela="relatorio" style="${horizontal}; align-items: start; gap: 1rem;">

                ${tabela}

                <div class="calendarios"></div>

            </div>

            <div name="graficos" style="display: none;"></div>

        </div>
    `

    popup({ elemento, titulo: 'Relatório Diário' })

    await paginacao()

}

async function baseRelatorioChecklist() {

    const { id } = controles.checklist
    const { checklist, dados_composicoes } = await recuperarDado('dados_orcamentos', id)
    const dados = {}

    Object.entries(checklist?.itens || {})
        .forEach(([codigo, lancamentos]) => {

            const info = dados_composicoes?.[codigo] || checklist?.avulso?.[codigo] || {}

            Object.entries(lancamentos).forEach(([id, lancamento]) => {
                const item = { codigo, ...lancamento, codigo, ...info }
                item.data = new Date(toTimestamp(item?.data)).toLocaleDateString()
                return dados[id] = item
            })

        })

    return dados

}

async function criarLinhaRelChecklist(item) {

    const { codigo, descricao, data, qtde, quantidade, tecnicos, comentario } = item || {}

    const comp = await recuperarDado('dados_composicoes', codigo)
    const tempo = comp?.tempo

    const qtdeTotal = Number(qtde || 0)
    const qtdExec = Number(quantidade || 0)

    const nomes = []
    for (const c of (tecnicos || [])) {
        const { nome } = await recuperarDado('dados_clientes', c) || {}
        if (nome) nomes.push(nome)
    }

    const minUnit = tempoEmMinutos(tempo)
    const executado = minUnit * qtdExec
    const total = minUnit * qtdeTotal

    return `
        <tr>
            <td>${data || ''}</td>
            <td>${descricao || ''}</td>
            <td style="white-space: nowrap;">
                <input style="display:none;" name="executado" value="${executado}">
                <input style="display:none;" name="total" value="${total}">
                <input>
                ${strHHMM(executado)}
                /
                ${strHHMM(total)}
            </td>
            <td>${qtdExec} / ${qtdeTotal}</td>
            <td>${comentario || ''}</td>
            <td style="text-align:left;">
                ${nomes.map(n => `• ${n}`).join('<br>')}
            </td>
        </tr>
    `
}

function tempoEmMinutos(tempo) {
    if (tempo == null || tempo === '') return 0

    if (typeof tempo === 'number') return isNaN(tempo) ? 0 : Math.max(0, Math.floor(tempo))

    const s = String(tempo).trim()

    if (/^\d+$/.test(s)) return Number(s) // "90" -> 90 min

    const m = s.match(/^(\d{1,3})\s*:\s*(\d{1,2})$/) // "2:30"
    if (!m) return 0

    const h = Number(m[1])
    const min = Number(m[2])

    if (isNaN(h) || isNaN(min)) return 0

    return Math.max(0, h * 60 + Math.min(59, min))
}

function mostrarPagina(el) {

    const nome = el.dataset.toolbar
    if (!nome) return

    // Oculta todas as páginas
    document.querySelectorAll('[data-tabela]').forEach(div => {
        div.style.display = 'none'
    })

    // Desativa todas as toolbars
    document.querySelectorAll('[data-toolbar]').forEach(btn => {
        btn.style.opacity = 0.5
    })

    // Mostra a página correta
    const pagina = document.querySelector(`[data-tabela="${nome}"]`)
    if (pagina) {
        pagina.style.display = 'flex'
    }

    // Ativa toolbar clicada
    el.style.opacity = 1
}

function criarCalendario(datas) {

    const meses = {
        1: 'Janeiro',
        2: 'Fevereiro',
        3: 'Março',
        4: 'Abril',
        5: 'Maio',
        6: 'Junho',
        7: 'Julho',
        8: 'Agosto',
        9: 'Setembro',
        10: 'Outubro',
        11: 'Novembro',
        12: 'Dezembro'
    }

    const ths = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .map(sem => `<th>${sem}</th>`)
        .join('')

    const marcado = `style="background-color: green; color: white; cursor: pointer;"`

    // Transformar em objetos Date e agrupar por ano-mês;
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

        // Espaços antes do primeiro dia
        for (let v = 0; v < primeiroDia; v++) {
            tds += `<td></td>`
        }

        for (let i = 1; i <= diasMes; i++) {
            const dt = new Date(ano, mes - 1, i)
            const sem = dt.getDay()

            tds += `<td onclick="pesquisarDtChecklist('${dt.toLocaleDateString()}')" ${dias.has(i) ? marcado : ''}>${i}</td>`

            if (sem === 6) {
                trs += `<tr>${tds}</tr>`
                tds = ''
            }
        }

        // Completar última linha
        if (tds) {
            for (let v = new Date(ano, mes - 1, diasMes).getDay() + 1; v <= 6; v++) {
                tds += `<td></td>`
            }
            trs += `<tr>${tds}</tr>`
        }

        calendarios += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="padding: 5px; color: white; font-size: 1.1rem;">${meses[mes]} • ${ano}</span>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>
        `
    }

    document.querySelector('.calendarios').innerHTML = calendarios
}

async function adicionarServicoAvulso() {

    controlesCxOpcoes.codigo = {
        base: 'dados_composicoes',
        retornar: ['descricao'],
        filtros: {
            'tipo': { op: '=', value: 'SERVIÇO' }
        },
        colunas: {
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
        }
    }

    const elemento = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2rem;">
            ${modelo('Descrição', `<span name="codigo" onclick="cxOpcoes('codigo')" class="opcoes">Selecione</span>`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAvulso()">
        </div>
    `

    popup({ elemento, titulo: 'Incluir Serviço', audoDestruicao: ['codigo'] })
}

async function salvarAvulso() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const codigo = document.querySelector('[name="codigo"]').id

    if (!qtde)
        return popup({ mensagem: 'Não deixe a quantidade em Branco' })

    overlayAguarde()
    const { id } = controles.checklist
    const { descricao } = await recuperarDado('dados_composicoes', codigo)

    const dados = {
        qtde,
        descricao,
        usuario: acesso.usuario,
        data: new Date().toLocaleString()
    }

    await enviar(`dados_orcamentos/${id}/checklist/avulso/${codigo}`, dados)

    removerPopup()
}

async function verItensRemovidos() {

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)
    let itens = Object.entries(orcamento?.checklist?.itens || {})
        .filter(([, dados]) => dados.removido)
        .map(([codigo,]) => {

            const descricao = orcamento?.dados_composicoes?.[codigo]?.descricao || orcamento?.checklist?.avulso?.[codigo]?.descricao || '...'

            return `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItem('${codigo}', this)" src="imagens/atualizar.png">
                <span>${descricao}</span> 
            </div>`
        })
        .join('')

    const elemento = `
        <div style="${vertical}; gap: 5px; padding: 1rem;">

            ${itens || `<span>Sem itens removidos até o momento`}

        </div>`

    popup({ elemento, titulo: 'Itens Removidos' })

}

async function recuperarItem(codigo, img) {

    overlayAguarde()
    const { id } = controles.checklist

    await deletar(`dados_orcamentos/${id}/checklist/itens/${codigo}/removido`)

    img.closest('div').remove()
    removerOverlay()

}

async function removerItensEmMassaChecklist() {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]:checked')

    if (itensChecklist.length == 0)
        return

    overlayAguarde()

    const { id } = controles.checklist

    for (const check of itensChecklist) {

        const codigo = check.dataset.codigo

        const dados = {
            usuario: acesso.usuario,
            data: new Date().toLocaleString()
        }

        await enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/removido`, dados)

    }

    removerOverlay()

}

function marcarItensChecklist(input) {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

async function atualizarTempo(input, codigo) {

    await enviar(`dados_composicoes/${codigo}/tempo`, input.value)

    input.classList = input.value !== ''
        ? 'on'
        : 'off'

}

async function calcularTemposChecklist() {

    const dados = await baseChecklist()

    let minutosObra = 0
    let minutosExecutado = 0
    let totalAtividades = 0
    let diasTrabalhados = new Set()

    const lista = Object.values(dados)

    for (const item of lista) {

        totalAtividades++

        const qtde = item.qtde || 0
        const qReal = item.qReal || 0
        const tempoUnitario = item.tempo

        const [h, m] = tempoUnitario.split(':').map(Number)
        const minutosUnit = (h * 60) + m

        const baseQuantidade = qReal || qtde

        const minutosTotais = minutosUnit * baseQuantidade
        minutosObra += minutosTotais

        let executadoItem = 0

        if (item.itens) {
            for (const chave in item.itens) {
                const exec = item.itens[chave]
                executadoItem += Number(exec.quantidade || 0)
                diasTrabalhados.add(exec.data)
            }
        }

        const minutosExecLinha = minutosUnit * executadoItem
        minutosExecutado += minutosExecLinha
    }

    const minutosPendentes = minutosObra - minutosExecutado
    const totalDiasPrevisto = Math.ceil(minutosObra / 480)
    const previsao = Math.ceil(minutosPendentes / 480)

    const calculo = calcularDiasCorridos([...diasTrabalhados])
    const diasCorridos = calculo.dias
    const inicio = calculo.inicio

    return {
        inicio,
        diasCorridos,
        diasTrabalhados: diasTrabalhados.size,
        totalAtividades,
        minutosObra,
        minutosExecutado,
        minutosPendentes,
        totalDiasPrevisto,
        previsao,
        porcentagem: minutosObra
            ? ((minutosExecutado / minutosObra) * 100).toFixed(1)
            : 0
    }
}

function calcularDiasCorridos(listaDatas) {

    if (!listaDatas || listaDatas.length === 0) return 0

    function parseDataLocal(dataStr) {
        const [ano, mes, dia] = dataStr.split('-').map(Number)
        return new Date(ano, mes - 1, dia)
    }

    const maisAntiga = listaDatas
        .map(d => parseDataLocal(d))
        .sort((a, b) => a - b)[0]

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const dif = hoje - maisAntiga

    return {
        dias: Math.floor(dif / 86400000),
        inicio: maisAntiga
    }
}

async function calcularTempos() {

    const {
        inicio,
        minutosObra,
        diasCorridos,
        diasTrabalhados,
        minutosExecutado,
        totalAtividades,
        minutosPendentes,
        totalDiasPrevisto,
        previsao,
        porcentagem
    } = await calcularTemposChecklist()

    const modelo = (texto, valor) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            <span>${valor}</span>
        </div>`

    const divInicio = document.getElementById('inicio')
    if (divInicio)
        divInicio.textContent = inicio?.toLocaleDateString() || ''

    const divResultados = document.querySelector('.resultados')

    let resultados = ''

    resultados += modelo('Total de Atividades', totalAtividades)
    resultados += modelo('Dias Até Hoje', diasCorridos)
    resultados += modelo('Dias Trabalhados', diasTrabalhados)
    resultados += modelo('Conclusão <br>em Dias', previsao)
    resultados += modelo('Tempo Total', strHHMM(minutosObra))
    resultados += modelo('Tempo Realizado', strHHMM(minutosExecutado))
    resultados += modelo('Tempo Pendente', strHHMM(minutosPendentes))

    const analise = (diasTrabalhados + previsao) <= totalDiasPrevisto
    const strAnalise = analise
        ? 'Entrega no Prazo'
        : diasTrabalhados > totalDiasPrevisto
            ? 'Atrasado'
            : 'Possível Atraso'

    resultados += modelo('Status', `
    <div style="${horizontal}; gap: 5px;">
        ${strAnalise}
        <img src="imagens/${analise ? 'joinha' : 'atrasado'}.png" style="width: 2rem;">
    </div>`)

    divResultados.innerHTML = resultados

    document.getElementById('porcentagem').innerHTML = `
        <div style="${vertical}">
            <span>Porcentagem de conclusão</span>
            ${divPorcentagem(porcentagem)}
        </div>`

    // Atualizar globalmente;
    const id = controles?.checklist?.id
    const nPorcentagem = Number(porcentagem)
    if (!id || nPorcentagem == 0)
        return

    const { checklist } = await recuperarDado('dados_orcamentos', id)
    const andamento = checklist?.andamento

    if (andamento != nPorcentagem) {
        enviar(`dados_orcamentos/${id}/checklist/andamento`, nPorcentagem)
    }

}

async function registrarChecklist(codigo) {

    overlayAguarde()

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const itens = orcamento?.checklist?.itens?.[codigo] || {}

    const data = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    let linhas = ''

    // Bloqueio por excesso de quantidade;
    quantidadeRealizadoItem = 0
    quantidadeItem = orcamento?.checklist?.qReal?.[codigo]?.qtde || orcamento?.dados_composicoes?.[codigo]?.qtde || orcamento?.checklist?.avulso?.[codigo]?.qtde || 0

    for (const [idLancamento, dados] of Object.entries(itens)) {

        quantidadeRealizadoItem += dados.quantidade

        const nomesTecnicos = []

        for (const tcod of (dados?.tecnicos || [])) {
            const { nome } = await recuperarDado('dados_clientes', tcod)
            if (nome)
                nomesTecnicos.push(nome)
        }

        linhas += `
        <tr>
            <td>${data(dados.data)}</td>
            <td>
                <div style="${horizontal}; gap: 0.5rem;">
                    <input style="width: 5rem; text-align: center;" class="opcoes"  oninput="mostrarBtn(this)" type="number" value="${dados.quantidade}">
                    <img src="imagens/concluido.png" style="display: none; width: 1.5rem;" onclick="alterarQuantidadeChecklist(this, '${idLancamento}', '${codigo}', ${dados.quantidade})">
                </div>
            </td>
            <td style="white-space: pre-wrap;">${nomesTecnicos.join('\n')}</td>
            <td>
                <div style="${horizontal}; gap: 0.5rem;">
                    <textarea oninput="mostrarBtn(this)">${dados?.comentario || ''}</textarea>
                    <img src="imagens/concluido.png" style="display: none; width: 1.5rem;" onclick="alterarComentario(this, '${idLancamento}', '${codigo}')">
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
            <textarea name="comentario" placeholder="Comentário"></textarea>
            <img src="imagens/concluido.png" style="width: 1.5rem;" onclick="salvarQuantidade('${codigo}')">
        </div>
        
        <hr style="width: 100%;">

        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${['Data', 'Quantidade', 'Técnico(s)', 'Comentário', 'Excluir'].map(op => `<th>${op}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const formChecklist = document.querySelector('.painel-registro-checklist')
    if (!formChecklist)
        popup({ elemento: `<div class="painel-registro-checklist">${acumulado}</div>`, titulo: 'Registrar' })
    else
        formChecklist.innerHTML = acumulado

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const { nome } = await recuperarDado('dados_clientes', codTec) || '...'
        maisTecnico(codTec, nome)
    }
}

async function alterarComentario(img, idLancamento, codigo) {

    const { id } = controles.checklist

    const textarea = img.previousElementSibling
    const comentario = textarea.value

    await enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}/comentario`, comentario)

    img.style.display = 'none'

}

function mostrarBtn(input) {
    const img = input.nextElementSibling
    img.style.display = ''
}

async function alterarQuantidadeChecklist(img, idLancamento, codigo) {

    const input = img.previousElementSibling
    const quantidade = Number(input.value)

    img.style.display = 'none'

    const { id } = controles.checklist

    await enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}/quantidade`, quantidade)

}

function maisTecnico(cod, nome, devolver) {
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    cod = cod || ID5digitos()
    nome = nome || 'Selecione'

    if (document.getElementById(cod))
        return

    controlesCxOpcoes[cod] = {
        base: 'dados_clientes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const modelo = `
        <div style="${horizontal}; justify-content: start; gap: 5px;">
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
            <span class="opcoes" id="${cod}" name="${cod}" onclick="cxOpcoes('${cod}')">${nome}</span>
        </div>`

    if (devolver)
        return modelo

    if (blocoTecnicos)
        blocoTecnicos.insertAdjacentHTML('beforeend', modelo)
}

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnicos = []
    const spanTecnicos = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spanTecnicos)
        if (!tecnicos.includes(span.id))
            tecnicos.push(span.id)

    const form = document.querySelector('.form-checklist')

    const quantidade = Number(form.querySelector('[name="quantidadeForm"]').value)
    const data = form.querySelector('[name="data"]').value
    const comentario = form.querySelector('[name="comentario"]').value

    // Bloqueios;
    if ((quantidadeRealizadoItem + quantidade) > quantidadeItem)
        return popup({ mensagem: 'Não é possível exceder a quantidade orçada' })

    if (!tecnicos.length) {
        await registrarChecklist(codigo)
        return popup({ mensagem: 'É necessário ter pelo menos 1 técnico realizando a atividade...', titulo: 'Ninguém fez?' })
    }

    if (!quantidade || !data)
        return popup({ mensagem: 'Preencha todos os campos' })

    const { id } = controles.checklist

    const dados = { quantidade, tecnicos, data, comentario }
    const idLancamento = ID5digitos()

    await enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}`, dados)

    removerPopup()

}

async function removerChecklist(codigo, idLancamento) {

    overlayAguarde()

    const { id } = controles.checklist

    await deletar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}`)

    await registrarChecklist(codigo)

    removerPopup()()

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
