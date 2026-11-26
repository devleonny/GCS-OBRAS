let controles = {}

// Coluna de valor: tipoPesquisa 'valor' (ou só tipoOrdenacao 'numero'). Pesquisa pelo número e ordena pelo número.
const DICA_PESQUISA_VALOR = 'Valor: 123,52 (exato) · 123 (123,00 a 123,99) · >1000 · <=500 · 100 a 200'

function ehColunaValor(coluna) {
    return coluna?.tipoPesquisa === 'valor' || (!coluna?.tipoPesquisa && coluna?.tipoOrdenacao === 'numero')
}

function campoBloq() {
    popup({ mensagem: 'O campo não permite pesquisas' })
}

async function modTab(configuracoes) {

    const {
        btnExtras = null,
        ocultarPesquisa = false,
        detalhes = false,
        scroll = true,
        alturaMinima = '0px',
        cor = null,
        nude = null,
        // true: paginação e btnExtras na mesma linha do topo (os extras ocupam o resto e quebram por dentro).
        topoEmLinha = false,
        // true: a tabela cabe na largura da tela (filtros acompanham a coluna, células mais justas,
        // texto quebra). Ver .tabela.caber em css/tabelas.css.
        caber = false,
        // Celular (tela estreita): cada linha vira um cartão "rótulo: valor" e os filtros ficam
        // atrás do botão "Filtrar". false = mantém a tabela com rolagem lateral (ex.: células com campos).
        // Por coluna: { celular: false } esconde no cartão; { principal: true } vira o título do cartão.
        cartoesCelular = true,
        criarLinha,
        base,
        colunas = {},
        body = null,
        pag = null
    } = configuracoes || {}

    if (!body || !pag || !base || !criarLinha)
        return popup({ mensagem: 'body/pag/base/criarLinha Não podem ser null' })

    controles[pag] ??= {}
    controles[pag] = {
        pagina: 1,
        ...controles[pag],
        ...configuracoes
    }
    controles[pag].detalhes = detalhes === true
    controles[pag].estadoDetalhes ??= new Map()
    // Filtros fixos: sempre aplicados e nunca alterados pela pesquisa das colunas.
    controles[pag].filtrosFixos = configuracoes.filtrosFixos
        ? structuredClone(configuracoes.filtrosFixos)
        : null

    // Cartões só fazem sentido com colunas nomeadas (o rótulo de cada valor) e sem edição na linha.
    const usarCartoes = cartoesCelular && Object.keys(colunas).length > 0 && !configuracoes.editavel

    const ths = Object.entries(colunas)
        .map(([th, query]) => `
        <th onclick="ordenarColuna({ pag: '${pag}', path: '${query.chave || ''}' })" style="cursor: pointer;"${query.celular === false ? ' data-celular="nao"' : ''}${query.principal ? ' data-principal="S"' : ''}>
            <div style="${horizontal}; width: 100%; justify-content: space-between; gap: 1rem;">
                <span>${th}</span>
                <span data-ordem="${query.chave || ''}"></span>
            </div>
        </th>
    `)
        .join('')

    const pesquisa = (await Promise.all(
        Object.entries(colunas).map(async ([th, query]) => {
            if (!query.chave)
                return `
                    <th style="background-color: white;">
                        <img src="imagens/alerta.png" onclick="campoBloq()" title="Campo não permite pesquisa!" style="width: 1.5rem;">
                    </th>`

            if (query.tipoPesquisa == 'select') {
                // opcoes (opcional): lista fixa, sem contar a base inteira antes de abrir a tela.
                const dados = Array.isArray(query.opcoes)
                    ? Object.fromEntries(query.opcoes.map(op => [op, 0]))
                    : await contarPorCampo({
                        base,
                        path: query.chave
                    })

                const opcoes = Object.keys(dados)
                    .filter(r => r != 'todos' && r != 'EM BRANCO')
                    .sort((a, b) => a.localeCompare(b))
                    // rotulos (opcional): texto exibido no lugar do valor do banco (o filtro continua pelo valor).
                    .map(r => `<option value="${String(r).toLowerCase()}">${query.rotulos?.[r] ?? r}</option>`)
                    .join('')

                return `
                    <th style="background-color: white;">
                        <select
                        data-chave="${query.chave}"
                        data-op="${query.op || '='}"
                        onchange="confirmarPesquisa({ event, chave: '${query.chave}', op: '${query.op || '='}', elemento: this, pag: '${pag}'})">
                            <option></option>
                            ${opcoes}
                        </select>
                    </th>`
            }

            if (query.tipoPesquisa == 'data')
                return `
                    <th style="background-color: white;">
                        <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">

                            <input
                            data-chave="${query.chave}"
                            data-op=">=d"
                            type="date"
                            onchange="confirmarPesquisa({ event, chave: '${query.chave}', op: '>=d', elemento: this, pag: '${pag}'})"
                            style="width: 7rem; font-size: 0.75rem; padding: 0 1rem; height: 1.3rem;">

                            <input
                            data-chave="${query.chave}"
                            data-op="<=d"
                            type="date"
                            onchange="confirmarPesquisa({ event, chave: '${query.chave}', op: '<=d', elemento: this, pag: '${pag}'})"
                            style="width: 7rem; font-size: 0.75rem; padding: 0 1rem; height: 1.3rem;">
                            
                        </div>
                    </th>`

            // Valor (dinheiro/quantidade): o servidor entende "123,52", "123", ">1000", "100 a 200".
            const opTexto = query.op || (ehColunaValor(query) ? 'valor' : 'includes')

            return `
                <th style="background-color: white; text-align: left;"
                data-chave="${query.chave}"
                data-op="${opTexto}"
                ${opTexto === 'valor' ? `title="${DICA_PESQUISA_VALOR}"` : ''}
                onkeydown="confirmarPesquisa({ event, chave: '${query.chave}', op: '${opTexto}', elemento: this, pag: '${pag}'})"
                onpaste="colarTextoPuro(event)"
                contentEditable="true">
                </th>
            `
        })
    )).join('')

    const modelo = `
        <div class="modtab${nude ? ' nude' : ''}${usarCartoes ? ' cartoes-celular' : ''}" style="${vertical}; width: 100%;">

            <div class="topo-tabela${nude ? ' nude' : ''}${topoEmLinha ? ' em-linha' : ''}" ${cor ? `style="background: ${cor};"` : ''}>
                ${detalhes === true ? `<button type="button" class="tabela-expandir" data-expandir-todos data-body="${escaparAtributo(body)}" aria-expanded="false" aria-label="Expandir todos os detalhes" title="Expandir todos os detalhes" onclick="alternarTodosDetalhes(this)">+</button>` : ''}
                <div id="paginacao_${pag}"></div>
                ${usarCartoes && !ocultarPesquisa ? `<button type="button" class="tabela-botao-filtros" aria-expanded="false" onclick="alternarFiltrosCelular(this)">Filtrar<span data-contador-filtros></span></button>` : ''}
                <div class="topo-tabela-extras" style="padding: 0 1rem;">${btnExtras || ''}</div>
            </div>

            <div data-altura-adaptavel="${scroll && !nude}" style="--altura-minima-tabela: ${escaparAtributo(typeof alturaMinima === 'number' ? `${alturaMinima}px` : alturaMinima)}; ${!scroll ? `max-height: max-content` : ''};" class="div-tabela${nude ? ' nude' : ''}">

                <table class="tabela${nude ? ' nude' : ''}${caber ? ' caber' : ''}">
                    <thead>
                        <tr>${detalhes === true ? '<th class="tabela-coluna-detalhes" aria-label="Detalhes"></th>' : ''}${ths}</tr>
                        ${ocultarPesquisa ? '' : `<tr>${detalhes === true ? '<th class="tabela-coluna-detalhes"></th>' : ''}${pesquisa}</tr>`}
                    </thead>
                    <tbody id="${body}" data-detalhes="${detalhes === true}"></tbody>
                </table>
                
            </div>

            ${nude ? '' : '<div class="rodape-tabela"></div>'}
        </div>
    `
    return modelo
}

function colarTextoPuro(event) {
    event.preventDefault()

    const texto = event.clipboardData?.getData('text/plain') || ''

    if (document.queryCommandSupported?.('insertText')) {
        document.execCommand('insertText', false, texto)
        return
    }

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    sel.deleteFromDocument()
    sel.getRangeAt(0).insertNode(document.createTextNode(texto))
    sel.collapseToEnd()
}

function restaurarPesquisa(pag) {
    const ctrl = controles[pag]
    const filtros = ctrl?.filtros
    if (!filtros) return

    const tabela = document.querySelector(`#paginacao_${pag}`)?.closest('.topo-tabela')?.nextElementSibling?.querySelector('table')
        || document.querySelector(`#${ctrl.body}`)?.closest('table')

    if (!tabela) return

    const thead = tabela.querySelector('thead')
    if (!thead) return

    const ativo = document.activeElement

    for (const [chave, filtro] of Object.entries(filtros)) {
        const lista = Array.isArray(filtro) ? filtro : [filtro]

        for (const f of lista) {
            const op = f?.op
            const value = String(f?.original ?? f?.value ?? '')

            const el = thead.querySelector(`[data-chave="${CSS.escape(chave)}"][data-op="${CSS.escape(op)}"]`)
            if (!el) continue

            const tag = el.tagName.toLowerCase()

            if (tag === 'input' || tag === 'select') {
                el.value = value
                continue
            }

            if (el.textContent !== value)
                el.textContent = value

            if (ativo === el)
                colocarCursorNoFim(el)
        }
    }
}

async function mudarPagina(valor, pag) {
    const { pagina, total } = controles[pag]

    if ((valor == -1 && pagina == 1) || (valor == 1 && pagina == total))
        return

    if (valor < 0) controles[pag].pagina--
    else controles[pag].pagina++

    await paginacao(pag)
}

async function confirmarPesquisa({ event, chave, op, elemento, pag }) {
    if (event?.type === 'keydown') {
        if (event.key !== 'Enter') return
        event.preventDefault()
    }

    const bruto = (elemento?.value ?? elemento?.textContent ?? '')
        .replace(/\n/g, '')
        .trim()

    const termo = bruto.toLowerCase()

    controles[pag].pagina = 1
    controles[pag].filtros ??= {}

    const isInput = elemento?.tagName?.toLowerCase() === 'input'
    const isSelect = elemento?.tagName?.toLowerCase() === 'select'

    if (isInput) {
        const atual = controles[pag].filtros[chave]
        const arr = Array.isArray(atual) ? atual : (atual ? [atual] : [])

        if (!termo) {
            const novo = arr.filter(f => f?.op !== op)

            if (!novo.length) {
                delete controles[pag].filtros[chave]
                if (Object.keys(controles[pag].filtros).length === 0)
                    delete controles[pag].filtros
            } else {
                controles[pag].filtros[chave] = novo
            }

            await paginacao(pag)
            return
        }

        const idx = arr.findIndex(f => f?.op === op)

        const registro = {
            op,
            value: termo,
            original: bruto
        }

        if (idx >= 0) arr[idx] = registro
        else arr.push(registro)

        controles[pag].filtros[chave] = arr
        await paginacao(pag)
        return
    }

    if (isSelect) {
        if (!termo) {
            delete controles[pag].filtros[chave]
            if (Object.keys(controles[pag].filtros).length === 0)
                delete controles[pag].filtros

            await paginacao(pag)
            return
        }

        controles[pag].filtros[chave] = {
            op,
            value: termo,
            original: bruto
        }

        await paginacao(pag)
        return
    }

    if (!termo) {
        delete controles[pag].filtros[chave]
        if (Object.keys(controles[pag].filtros).length === 0)
            delete controles[pag].filtros

        await paginacao(pag)
        return
    }

    controles[pag].filtros[chave] = {
        op,
        value: termo,
        original: bruto
    }

    await paginacao(pag)
}

function colocarCursorNoFim(el) {
    if (!el || el.tagName?.toLowerCase() === 'input' || el.tagName?.toLowerCase() === 'select')
        return

    const range = document.createRange()
    const sel = window.getSelection()

    range.selectNodeContents(el)
    range.collapse(false)

    sel.removeAllRanges()
    sel.addRange(range)
}

function stableStringify(valor) {
    if (valor === null || typeof valor !== 'object')
        return JSON.stringify(valor)

    if (Array.isArray(valor))
        return `[${valor.map(stableStringify).join(',')}]`

    const chaves = Object.keys(valor).sort()

    return `{${chaves.map(chave => `${JSON.stringify(chave)}:${stableStringify(valor[chave])}`).join(',')}}`
}

function obterChaveLinha(dado, indice = 0) {
    if (dado?.id !== undefined && dado?.id !== null && dado?.id !== '')
        return String(dado.id)

    if (dado?.codigo !== undefined && dado?.codigo !== null && dado?.codigo !== '')
        return String(dado.codigo)

    if (dado?.usuario !== undefined && dado?.usuario !== null && dado?.usuario !== '')
        return String(dado.usuario)

    if (dado?.chave !== undefined && dado?.chave !== null && dado?.chave !== '')
        return String(dado.chave)

    if (dado?._id !== undefined && dado?._id !== null && dado?._id !== '')
        return String(dado._id)

    return `linha_${indice}_${btoa(unescape(encodeURIComponent(stableStringify(dado)))).slice(0, 24)}`
}

function obterTimestampLinha(dado) {
    const candidatos = [
        dado?.timestamp,
        dado?.snapshots?.timestamp,
        dado?.updatedAt,
        dado?.dataAtualizacao
    ]

    for (const valor of candidatos) {
        if (valor === 0) return '0'
        if (valor) return String(valor)
    }

    return ''
}

function obterHashLinha(dado) {
    return stableStringify(dado)
}

function escaparAtributo(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function injetarMetaTr(html, dado, indice = 0) {
    if (typeof html !== 'string')
        return ''

    const id = escaparAtributo(obterChaveLinha(dado, indice))
    const ts = escaparAtributo(obterTimestampLinha(dado))
    const hash = escaparAtributo(obterHashLinha(dado))

    return html.replace(
        /^\s*<tr\b([^>]*)>/i,
        (match, attrs = '') => `<tr${attrs} data-id="${id}" data-ts="${ts}" data-hash="${hash}">`
    )
}

// Na mesma chave, as condições do usuário e as fixas viram uma lista (o servidor aplica todas com AND).
function combinarFiltros(filtros, filtrosFixos) {
    if (!filtrosFixos)
        return filtros

    const combinados = { ...(filtros || {}) }
    for (const [chave, fixo] of Object.entries(filtrosFixos)) {
        const doUsuario = combinados[chave]
        combinados[chave] = doUsuario
            ? [...[doUsuario].flat(), ...[fixo].flat()]
            : fixo
    }
    return combinados
}

function assinaturaConsulta({ base, substituicoes, ordenar, pagina, filtros }) {
    return stableStringify({
        base,
        substituicoes: substituicoes || null,
        ordenar: ordenar || null,
        pagina,
        filtros: filtros || null
    })
}

function assinaturaPagina(resultados = []) {
    return stableStringify(
        resultados.map((d, indice) => ({
            id: obterChaveLinha(d, indice),
            ts: obterTimestampLinha(d),
            hash: obterHashLinha(d)
        }))
    )
}

async function paginacao(pag) {
    if (pag) {
        const retorno = await ativarPaginacao(pag)
        atualizarContadorFiltros(pag)
        return retorno
    }

    for (const pag of Object.keys(controles)) {
        await ativarPaginacao(pag)
        atualizarContadorFiltros(pag)
    }

    async function ativarPaginacao(pag) {
        const {
            pagina,
            base,
            body,
            limite,
            ocultarPaginacao,
            ocultarLegenda,
            substituicoes,
            relacionados,
            ordenar,
            alinPag = horizontal,
            criarLinha,
            consultarDados,
            funcaoAdicional,
            filtrosFixos
        } = controles[pag] || {}

        const filtros = combinarFiltros(controles[pag]?.filtros, filtrosFixos)

        const tbody = document.getElementById(body)

        if (!tbody)
            return

        prepararCartoesCelular(tbody)

        const baseResolvida = typeof base === 'function'
            ? await base()
            : base

        const assinaturaAtualConsulta = assinaturaConsulta({
            base: baseResolvida,
            substituicoes,
            relacionados,
            ordenar,
            pagina,
            filtros
        })

        const mesmaConsulta = controles[pag].ultimaAssinaturaConsulta === assinaturaAtualConsulta
        const tabela = tbody.parentElement
        const cols = tabela.querySelector('thead tr')?.children.length || 1

        // Bases locais são renderizadas diretamente. Apagar antes cria um colapso
        // temporário da página e altera a rolagem do catálogo abaixo do orçamento.
        if (!consultarDados && (!mesmaConsulta || !tbody.children.length)) {
            tbody.innerHTML = ''
            tbody.appendChild(criarLoading(cols))
        }

        // Falha ou tempo esgotado na consulta: mostra o erro na tabela em vez de deixar o
        // carregando para sempre (o erro também segue para o console).
        let dados
        try {
            dados = await (consultarDados || pesquisarDB)({
                limite,
                base: baseResolvida,
                substituicoes,
                relacionados,
                ordenar,
                pagina,
                filtros
            })
        } catch (erro) {
            console.error(`[paginacao ${pag}]`, erro)
            tbody.innerHTML = `
                <tr><td colspan="${cols}" style="padding: 1rem; text-align: center; color: #b12425;">
                    Não foi possível carregar os dados: ${escaparAtributo(erro?.message || 'erro desconhecido')}
                </td></tr>`
            return
        }

        // Para casos de base objeto;
        if (!consultarDados && typeof base === 'object' && controles[pag]?.priBase !== 'S') {
            controles[pag].priBase = 'S'
            controles[pag].base = dados.resultados
        }

        const assinaturaAtualPagina = assinaturaPagina(dados.resultados)
        const mesmaPagina = mesmaConsulta && controles[pag].ultimaAssinaturaPagina === assinaturaAtualPagina

        controles[pag].total = dados.paginas
        controles[pag].ultimaAssinaturaConsulta = assinaturaAtualConsulta

        const divPaginacao = document.getElementById(`paginacao_${pag}`)
        const paginaAtual = document.getElementById(`paginaAtual_${pag}`)
        const resultados = document.getElementById(`resultados_${pag}`)

        if (!divPaginacao)
            return

        if (!paginaAtual) {
            divPaginacao.innerHTML = `
                <div style="${alinPag}; align-items: center; padding: 2px; color: white; gap: 5px;">

                    <div style="display: ${ocultarPaginacao ? 'none' : 'flex'}; align-items: center; justify-content: center; gap: 5px;">
                        <img src="imagens/esq.png" style="width: 2rem;" onclick="mudarPagina(-1, '${pag}')">
                        <span id="paginaAtual_${pag}">${pagina}</span> de
                        <span id="totalPaginas_${pag}">${dados.paginas}</span> 
                        <img src="imagens/dir.png" style="width: 2rem;" onclick="mudarPagina(1, '${pag}')">
                    </div>
                    <span style="display: ${ocultarLegenda ? 'none' : 'flex'}; align-items: center; justify-content: center; white-space: nowrap; gap: 5px;">
                        <span style="font-size: 1rem;" id="resultados_${pag}">${dados.total}</span>
                        <span>${dados.total !== 1 ? 'Itens' : 'Item'}</span>
                    </span>

                </div>
            `
        } else {
            paginaAtual.textContent = pagina
            document.getElementById(`totalPaginas_${pag}`).textContent = dados.paginas
            resultados.textContent = dados.total
        }

        if (!dados.resultados.length) {
            controles[pag].ultimaAssinaturaPagina = assinaturaAtualPagina
            tbody.innerHTML = ''
            tbody.appendChild(criarDino(cols))
            await executarFuncoesAdicionais(funcaoAdicional)
            restaurarPesquisa(pag)
            aplicarColunasOcultas(pag)
            return
        }

        const temLoading = !!tbody.querySelector('#loading-tabela')
        const temDino = !!tbody.querySelector('#dinossauro')
        // Corpo vazio com resultados = tabela recém-montada (modTab de novo, mesma consulta de antes):
        // sem isso a "mesma página" saía cedo e a tela abria sem as linhas (ex.: reabrir o orçamento).
        const corpoVazio = !tbody.querySelector('tr')
        const tabelaNaoPronta = temLoading || temDino || corpoVazio

        if (mesmaPagina && !tabelaNaoPronta) {
            restaurarPesquisa(pag)
            return
        }

        const reconstruirTudo = !mesmaConsulta
        await atualizarTabela(tbody, dados.resultados, criarLinha, baseResolvida, reconstruirTudo, controles[pag].estadoDetalhes)

        controles[pag].ultimaAssinaturaPagina = assinaturaAtualPagina

        await executarFuncoesAdicionais(funcaoAdicional)
        restaurarPesquisa(pag)
        atualizarIndicadorOrdenacao(pag)
        aplicarColunasOcultas(pag)
    }

    async function executarFuncoesAdicionais(funcaoAdicional = []) {
        if (funcaoAdicional.length) {
            for (const f of funcaoAdicional)
                await window[f]()
        }
    }
}

function criarLoading(cols) {
    const tr = document.createElement('tr')
    tr.id = 'loading-tabela'

    const td = document.createElement('td')
    td.colSpan = cols
    // Estilo em tabelas.css (.tabela-carregando): sem estourar a largura da célula.
    td.innerHTML = `
        <div class="tabela-carregando">
            <img src="gifs/loading-gcs.png" alt="Carregando">
        </div>
    `

    tr.appendChild(td)
    return tr
}

async function criarElementoLinha(dado, criarLinha, base, indice = 0, habilitarDetalhes = false, estadoDetalhes = new Map()) {
    const htmlBruto = await window[criarLinha]({ ...dado, base })
    // Retorno tradicional: '<tr>...</tr>'. Com detalhes: { linha, detalhes }.
    // detalhes recebe HTML de conteúdo, sem <tr>/<td> externos.
    const html = injetarMetaTr(typeof htmlBruto === 'string' ? htmlBruto : htmlBruto?.linha, dado, indice)

    const temp = document.createElement('tbody')
    temp.innerHTML = html.trim()

    const linha = temp.firstElementChild
    if (!linha || !habilitarDetalhes)
        return linha

    const celula = document.createElement('td')
    celula.className = 'tabela-coluna-detalhes'
    linha.prepend(celula)
    if (!htmlBruto?.detalhes || typeof htmlBruto === 'string') return linha

    const detalhes = document.createElement('tr')
    detalhes.className = 'tabela-linha-detalhes'
    detalhes.hidden = true
    const conteudo = document.createElement('td')
    conteudo.colSpan = [...linha.children].reduce((total, td) => total + td.colSpan, 0)
    conteudo.innerHTML = `<div class="tabela-detalhes-conteudo">${htmlBruto.detalhes}</div>`
    detalhes.appendChild(conteudo)

    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'tabela-expandir'
    botao.textContent = '+'
    botao.setAttribute('aria-expanded', 'false')
    botao.setAttribute('aria-label', 'Expandir detalhes')
    botao.addEventListener('click', event => {
        event.stopPropagation()
        definirDetalhesExpandidos(linha, detalhes.hidden)
        atualizarBotaoTodosDetalhes(linha.parentElement)
    })
    celula.prepend(botao)
    linha.detalhesTabela = detalhes
    linha.botaoDetalhesTabela = botao
    linha.estadoDetalhesTabela = estadoDetalhes
    definirDetalhesExpandidos(linha, estadoDetalhes.get(linha.dataset.id) === true)

    return linha
}

function definirDetalhesExpandidos(linha, expandir) {
    if (!linha?.detalhesTabela) return
    linha.estadoDetalhesTabela?.set(linha.dataset.id, !!expandir)
    linha.detalhesTabela.hidden = !expandir
    linha.botaoDetalhesTabela.textContent = expandir ? '−' : '+'
    linha.botaoDetalhesTabela.setAttribute('aria-expanded', String(expandir))
    linha.botaoDetalhesTabela.setAttribute('aria-label', expandir ? 'Recolher detalhes' : 'Expandir detalhes')

    // Depois do frame: a linha pode ainda não estar no documento (montagem da página).
    if (expandir)
        requestAnimationFrame(() => ajustarLarguraDetalhe(linha.detalhesTabela.querySelector('.tabela-detalhes-conteudo')))
}

// O detalhe aberto ocupa a largura VISÍVEL da tabela (não a soma das colunas) e fica
// preso à esquerda ao rolar a tabela na horizontal; conteúdo mais largo rola dentro dele.
function ajustarLarguraDetalhe(conteudo) {
    const caixa = conteudo?.closest('.div-tabela')
    if (!caixa || !conteudo.isConnected) return
    const celula = conteudo.parentElement
    const borda = celula ? parseFloat(getComputedStyle(celula).borderLeftWidth) || 0 : 0
    conteudo.style.width = `${Math.max(0, caixa.clientWidth - borda)}px`
}

window.addEventListener('resize', () => {
    for (const conteudo of document.querySelectorAll('.tabela-linha-detalhes:not([hidden]) .tabela-detalhes-conteudo'))
        ajustarLarguraDetalhe(conteudo)
})

function adicionarLinhaTabela(fragment, linha) {
    if (!linha) return
    fragment.appendChild(linha)
    if (linha.detalhesTabela)
        fragment.appendChild(linha.detalhesTabela)
}

function atualizarBotaoTodosDetalhes(tbody) {
    if (!tbody) return
    // No topo do modTab ou, nas telas no layout do Financeiro (.fin-tela), no título da coluna do "+".
    const botao = tbody.closest('.div-tabela')?.previousElementSibling?.querySelector('[data-expandir-todos]')
        || tbody.closest('table')?.querySelector(':scope > thead [data-expandir-todos]')
    if (!botao) return
    const linhas = [...tbody.children].filter(linha => linha.detalhesTabela)
    const todosAbertos = linhas.length > 0 && linhas.every(linha => !linha.detalhesTabela.hidden)
    botao.textContent = todosAbertos ? '−' : '+'
    const descricao = todosAbertos ? 'Recolher todos os detalhes' : 'Expandir todos os detalhes'
    botao.title = descricao
    botao.setAttribute('aria-label', descricao)
    botao.setAttribute('aria-expanded', String(todosAbertos))
    botao.disabled = linhas.length === 0
}

function alternarTodosDetalhes(botao) {
    const tbody = document.getElementById(botao.dataset.body)
    if (!tbody) return
    const linhas = [...tbody.children].filter(linha => linha.detalhesTabela)
    const expandir = linhas.some(linha => linha.detalhesTabela.hidden)
    linhas.forEach(linha => definirDetalhesExpandidos(linha, expandir))
    atualizarBotaoTodosDetalhes(tbody)
}

async function atualizarTabela(tbody, dados, criarLinha, base, reconstruirTudo = false, estadoDetalhes = new Map()) {
    const habilitarDetalhes = tbody.dataset.detalhes === 'true'
    const loading = tbody.querySelector('#loading-tabela')
    if (loading)
        loading.remove()

    const dino = tbody.querySelector('#dinossauro')
    if (dino)
        dino.remove()

    if (reconstruirTudo || !tbody.querySelector('tr[data-id]')) {
        const linhas = await Promise.all(
            dados.map((d, indice) => criarElementoLinha(d, criarLinha, base, indice, habilitarDetalhes, estadoDetalhes))
        )

        const fragment = document.createDocumentFragment()
        linhas.forEach(linha => adicionarLinhaTabela(fragment, linha))
        tbody.replaceChildren(fragment)
        return
    }

    const atuais = new Map(
        [...tbody.children].filter(tr => tr.hasAttribute('data-id'))
            .map(tr => [String(tr.dataset.id), tr])
    )

    const fragment = document.createDocumentFragment()

    for (let indice = 0; indice < dados.length; indice++) {
        const dado = dados[indice]
        const id = obterChaveLinha(dado, indice)
        const ts = obterTimestampLinha(dado)
        const hash = obterHashLinha(dado)

        const atual = atuais.get(id)

        if (atual && atual.dataset.ts === ts && atual.dataset.hash === hash) {
            adicionarLinhaTabela(fragment, atual)
            continue
        }

        const novaLinha = await criarElementoLinha(dado, criarLinha, base, indice, habilitarDetalhes, estadoDetalhes)

        adicionarLinhaTabela(fragment, novaLinha)
    }

    tbody.innerHTML = ''
    tbody.appendChild(fragment)

}

function criarDino(cols) {
    const tr = document.createElement('tr')
    tr.id = 'dinossauro'

    const td = document.createElement('td')
    td.colSpan = cols
    td.innerHTML = `
        <div class="tabela-sem-resultados">
            ${achou() ? `<img src="gifs/offline.gif" style="width: 5rem;">` : '<span>Sem resultados</span>'}
        </div>
    `

    tr.appendChild(td)
    return tr
}

// ---------------------------------------------------------------- Celular: linhas em cartões
// O CSS (tabelas.css, .modtab.cartoes-celular em tela estreita) desmonta a tabela: cada <tr> vira um
// cartão e cada <td> mostra o nome da coluna antes do valor (data-rotulo, tirado do cabeçalho). Os
// rótulos são postos aqui, para nenhuma criarLinha precisar mudar; o observador cobre as linhas
// trocadas depois (atualização em tempo real, edição de uma linha só).
function prepararCartoesCelular(tbody) {
    if (!tbody || tbody.observadorCartoes || !tbody.closest('.modtab.cartoes-celular')) return
    tbody.observadorCartoes = new MutationObserver(mutacoes => {
        if (mutacoes.some(m => m.target === tbody || m.target.parentElement === tbody))
            rotularCelulasCartao(tbody)
    })
    tbody.observadorCartoes.observe(tbody, { childList: true, subtree: true })
    rotularCelulasCartao(tbody)
}

const ROTULOS_ACOES = /^(a[çc][õo]es|a[çc][aã]o|editar|excluir|op[çc][õo]es)$/i

function rotularCelulasCartao(tbody) {
    const [linhaTitulo, linhaPesquisa] = tbody.closest('table')?.tHead?.rows || []
    if (!linhaTitulo) return

    const colunas = [...linhaTitulo.cells].map(th => ({
        detalhes: th.classList.contains('tabela-coluna-detalhes'),
        rotulo: th.classList.contains('tabela-coluna-detalhes') ? '' : textoTituloColuna(th),
        ocultar: th.dataset.celular === 'nao',
        principal: th.dataset.principal === 'S'
    }))
    const totalColunas = colunas.length

    // Rótulo também nos filtros (painel "Filtrar" do celular).
    if (linhaPesquisa)
        [...linhaPesquisa.cells].forEach((th, i) => {
            if (colunas[i]?.rotulo && th.dataset.rotulo !== colunas[i].rotulo) th.dataset.rotulo = colunas[i].rotulo
        })

    for (const tr of tbody.rows) {
        if (tr.classList.contains('tabela-linha-detalhes')) continue
        let posicao = 0
        for (const td of tr.cells) {
            const coluna = colunas[posicao] || {}
            const largura = td.colSpan || 1
            posicao += largura

            // Linha de uma célula só (carregando, sem resultados, erro): ocupa o cartão inteiro.
            if (largura >= totalColunas && totalColunas > 1) {
                td.classList.add('celula-cartao-inteira')
                continue
            }

            if (coluna.rotulo) td.dataset.rotulo = coluna.rotulo
            else delete td.dataset.rotulo

            const texto = td.textContent.trim()
            const interativo = !!td.querySelector('img, button, input, select, a, [onclick]')
            td.classList.toggle('celula-cartao-detalhes', !!coluna.detalhes)
            td.classList.toggle('celula-cartao-acoes', !coluna.detalhes && (ROTULOS_ACOES.test(coluna.rotulo || '') || (!texto && interativo)))
            td.classList.toggle('celula-cartao-principal', !!coluna.principal)
            td.classList.toggle('celula-cartao-oculta', !!coluna.ocultar)
            td.classList.toggle('celula-cartao-vazia', !texto && !interativo && !coluna.detalhes)
        }
    }

    // Rodapé de totais (Financeiro): no celular vira um cartão no fim, com o nome de cada coluna.
    for (const tr of tbody.closest('table')?.tFoot?.rows || []) {
        let posicao = 0
        for (const td of tr.cells) {
            const coluna = colunas[posicao] || {}
            posicao += td.colSpan || 1
            if (coluna.rotulo) td.dataset.rotulo = coluna.rotulo
            else delete td.dataset.rotulo
        }
    }
}

// Nome da coluna sem o texto dos botões do título ("«" de recolher, ordenar...).
function textoTituloColuna(th) {
    const copia = th.cloneNode(true)
    copia.querySelectorAll('button, .cab-recolher, .cab-alca-largura').forEach(el => el.remove())
    return copia.textContent.replace(/\s+/g, ' ').trim()
}

// Botão "Filtrar" do topo (só aparece no celular): abre/fecha a linha de filtros como um painel.
function alternarFiltrosCelular(botao) {
    const modtab = botao.closest('.modtab')
    if (!modtab) return
    const abrir = !modtab.classList.contains('filtros-abertos')
    modtab.classList.toggle('filtros-abertos', abrir)
    botao.setAttribute('aria-expanded', String(abrir))
    if (abrir) modtab.querySelector('.div-tabela')?.scrollTo({ top: 0 })
}

// Botão "⋮" do topo (só no celular, hoje só em Ocorrências): mostra/esconde o que fica atrás dele.
function alternarExtrasCelular(botao) {
    const modtab = botao.closest('.modtab')
    if (!modtab) return
    const abrir = !modtab.classList.contains('extras-abertos')
    modtab.classList.toggle('extras-abertos', abrir)
    botao.setAttribute('aria-expanded', String(abrir))
}

function atualizarContadorFiltros(pag) {
    const contador = document.getElementById(`paginacao_${pag}`)?.closest('.topo-tabela')?.querySelector('[data-contador-filtros]')
    if (!contador) return
    const total = Object.keys(controles[pag]?.filtros || {}).length
    contador.textContent = total ? ` (${total})` : ''
}

function achou() {
    return Math.random() < 0.1
}

function ordenarColuna({ pag, path }) {
    const ctrl = controles[pag]

    if (!ctrl) return

    const atual = ctrl.ordenar || {}

    if (atual.path === path) {
        ctrl.ordenar.direcao = atual.direcao === 'asc' ? 'desc' : 'asc'
    } else {
        // Sem tipo o servidor ordena como texto ("100" antes de "20"); a coluna pode informar o seu.
        const coluna = Object.values(ctrl.colunas || {}).find(c => c.chave === path) || {}
        const tipoOrdenacao = coluna.tipoPesquisa === 'valor' ? 'valor' : coluna.tipoOrdenacao
        ctrl.ordenar = {
            path,
            direcao: 'asc',
            ...(tipoOrdenacao && { tipoOrdenacao })
        }
    }

    ctrl.pagina = 1
    paginacao(pag)
}

function atualizarIndicadorOrdenacao(pag) {
    const ctrl = controles[pag]
    if (!ctrl) return

    const { ordenar } = ctrl || {}

    const tabela = document.querySelector(`#${ctrl.body}`)?.closest('table')
    if (!tabela) return

    tabela.querySelectorAll('[data-ordem]').forEach(el => {
        el.textContent = ''
    })

    if (!ordenar?.path) return

    const alvo = tabela.querySelector(`[data-ordem="${CSS.escape(ordenar.path)}"]`)
    if (!alvo) return

    alvo.textContent = ordenar.direcao === 'asc' ? '▲' : '▼'
}

function aplicarColunasOcultas(pag) {
    const ctrl = controles[pag]
    if (!ctrl || !ctrl.body) return

    const tabela = document.getElementById(ctrl.body)?.closest('table')
    if (!tabela) return

    const colunasOcultar = ctrl.ocultar || []

    const linhasHeader = tabela.querySelectorAll('thead tr')
    const thsTitulo = linhasHeader[0]?.querySelectorAll('th') || []
    const thsPesquisa = linhasHeader[1]?.querySelectorAll('th') || []

    thsTitulo.forEach((th, index) => {
        const nomeColuna = th.querySelector('span')?.textContent?.trim()
        const deveOcultar = !th.classList.contains('tabela-coluna-detalhes') && colunasOcultar.includes(nomeColuna)

        th.style.display = deveOcultar ? 'none' : ''

        if (thsPesquisa[index]) {
            thsPesquisa[index].style.display = deveOcultar ? 'none' : ''
        }

        const linhas = [...document.getElementById(ctrl.body).children]
        linhas.forEach(linha => {
            if (linha.id === 'dinossauro' || linha.id === 'loading-tabela') return
            if (linha.classList.contains('tabela-linha-detalhes')) return

            const td = linha.children[index]
            if (td) td.style.display = deveOcultar ? 'none' : ''
        })
    })

    const colunasVisiveis = [...thsTitulo].filter(th => th.style.display !== 'none').length
    for (const linha of document.getElementById(ctrl.body).children) {
        if (linha.classList.contains('tabela-linha-detalhes')) {
            linha.firstElementChild.colSpan = Math.max(1, colunasVisiveis)
            continue
        }
    }
    atualizarBotaoTodosDetalhes(document.getElementById(ctrl.body))
}

function moverPag(direcao) {

    const pag = document.querySelector('.div-tabela')

    pag.scrollLeft += direcao == 'esquerda'
        ? (-100) 
        : 100

}

// O limite depende da posição da tabela, e não de uma fração fixa da tela.
function calcularAlturaDisponivelTabela(div) {
    let limite = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight
    let reserva = 0
    let limiteInterno = Infinity
    let topo = div.getBoundingClientRect().top

    for (let elemento = div; elemento.parentElement; elemento = elemento.parentElement) {
        const pai = elemento.parentElement
        const estilo = getComputedStyle(pai)
        reserva += parseFloat(estilo.paddingBottom) || 0

        const layoutHorizontal = ['flex', 'inline-flex'].includes(estilo.display)
            && ['row', 'row-reverse'].includes(estilo.flexDirection)
        for (let irmao = layoutHorizontal ? null : elemento.nextElementSibling; irmao; irmao = irmao.nextElementSibling) {
            const css = getComputedStyle(irmao)
            if (css.display === 'none' || ['absolute', 'fixed'].includes(css.position)) continue
            reserva += irmao.getBoundingClientRect().height
                + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0)
            reserva += parseFloat(estilo.rowGap) || 0
        }

        const janelaPopup = pai.classList.contains('janela') && pai.closest('.popup-janela-fora')
        if (janelaPopup) {
            // Usa o limite da janela, não sua altura atual, que depende da tabela.
            const maximo = parseFloat(getComputedStyle(janelaPopup).maxHeight)
            const popup = janelaPopup.closest('.popup')
            const cssPopup = getComputedStyle(popup)
            const alturaViewport = window.visualViewport?.height || window.innerHeight
            limite = Math.min(Number.isFinite(maximo) ? maximo : alturaViewport,
                alturaViewport - (parseFloat(cssPopup.paddingTop) || 0) - (parseFloat(cssPopup.paddingBottom) || 0))
            topo = div.getBoundingClientRect().top - pai.getBoundingClientRect().top + pai.scrollTop
            for (const parte of janelaPopup.children) {
                if (parte === pai) continue
                reserva += parte.getBoundingClientRect().height
            }
            break
        }

        if (/(auto|scroll|hidden|clip)/.test(estilo.overflowY)) {
            if (pai.closest('.popup-janela-fora')) {
                // Contêineres internos de pop-ups também têm altura definida pelo conteúdo.
                // Respeita seu max-height, mas não usa a altura atual como limite.
                const maximo = parseFloat(estilo.maxHeight)
                if (Number.isFinite(maximo)) {
                    const deslocamento = div.getBoundingClientRect().top - pai.getBoundingClientRect().top + pai.scrollTop
                    limiteInterno = Math.min(limiteInterno, maximo - deslocamento - reserva)
                }
                continue
            }
            const rect = pai.getBoundingClientRect()
            limite = Math.min(limite, rect.top + pai.clientTop + pai.clientHeight)
            // Rolar o contêiner externo não deve aumentar a altura da tabela.
            topo += pai.scrollTop
            break
        }
    }

    return Math.max(0, Math.floor(Math.min(limite - topo - reserva, limiteInterno)))
}

// TELAS COM A PÁGINA ROLANDO (modTab com scroll: false; ex.: ocorrências e orçamentos)

// Botão flutuante "↑ Filtros" (CSS .botao-subir-filtros em tabelas.css).
function botaoSubirFiltrosHTML(texto = 'Filtros') {
    return `<button type="button" class="botao-subir-filtros" hidden><span aria-hidden="true">↑</span> ${texto}</button>`
}

// Mostra o botão quando `alvo` sai de vista na área que rola (.tela); o clique rola até `destino`.
// Um observador por tela (chave): reabrir a tela desliga o anterior.
const observadoresSubirFiltros = {}
function observarBotaoSubirFiltros(chave, alvo, botao, destino = alvo) {
    observadoresSubirFiltros[chave]?.disconnect()
    if (!alvo || !botao || typeof IntersectionObserver === 'undefined') return

    botao.onclick = () => destino.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const observador = new IntersectionObserver(([entrada]) => {
        // A tela foi trocada: o botão saiu do DOM junto e o observador não serve mais.
        if (!botao.isConnected) return observador.disconnect()
        botao.hidden = entrada.isIntersecting
    }, { root: alvo.closest('.tela'), threshold: 0 })
    observador.observe(alvo)
    observadoresSubirFiltros[chave] = observador
}

// Trocar de página ou filtro deixava a pessoa no meio da lista nova: volta ao topo da tabela
// se ela já saiu da tela. Só quando página/filtros mudam: recarga por aviso do servidor
// (mesmos página e filtros) não pode tirar a pessoa do lugar.
const assinaturasTopoTabela = {}
function voltarTopoTabelaSeMudou(pag, elemento) {
    const { pagina, filtros } = controles[pag] || {}
    const assinatura = JSON.stringify([pagina, filtros])
    const mudou = pag in assinaturasTopoTabela && assinatura !== assinaturasTopoTabela[pag]
    assinaturasTopoTabela[pag] = assinatura
    if (mudou && elemento && elemento.getBoundingClientRect().top < 0)
        elemento.scrollIntoView({ block: 'start' })
}

// Altura que alterna A → B → A depressa (a tabela muda, algo em volta quebra/desquebra de linha, a tabela
// muda de novo...): fica no menor dos dois. Sem isso a tabela piscava sem parar em certos níveis de zoom.
// Só trava se as três mudanças vierem em menos de 1,5 s (abrir e fechar um painel na mão não trava) e solta
// quando aparece uma altura que não é nenhuma das duas, ou quando a janela muda de tamanho.
const historicoAlturaTabela = new WeakMap()
function estabilizarAlturaTabela(div, altura, agora = performance.now()) {
    const h = historicoAlturaTabela.get(div) || { valores: [], travada: null }
    if (h.travada) {
        if (h.travada.par.includes(altura)) return h.travada.altura
        h.travada = null
        h.valores = []
    }
    const ultimo = h.valores.at(-1)
    if (ultimo && ultimo.altura === altura) return altura
    const penultimo = h.valores.at(-2)
    if (penultimo && penultimo.altura === altura && agora - penultimo.quando < 1500) {
        h.travada = { altura: Math.min(altura, ultimo.altura), par: [altura, ultimo.altura] }
        historicoAlturaTabela.set(div, h)
        return h.travada.altura
    }
    h.valores = [...h.valores.slice(-1), { altura, quando: agora }]
    historicoAlturaTabela.set(div, h)
    return altura
}
// Mudança real de tamanho (janela, zoom, teclado do celular): solta as travas e recalcula do zero.
function soltarAlturasTravadas() {
    for (const div of document.querySelectorAll('.div-tabela')) historicoAlturaTabela.delete(div)
    agendarAlturaTabelas()
}

let ajusteAlturaTabelaPendente = false
const elementosAlturaTabela = new Set()
const observadorAlturaTabela = new ResizeObserver(agendarAlturaTabelas)

function agendarAlturaTabelas() {
    if (ajusteAlturaTabelaPendente) return
    ajusteAlturaTabelaPendente = true
    requestAnimationFrame(() => {
        ajusteAlturaTabelaPendente = false
        for (const elemento of elementosAlturaTabela) {
            if (elemento.isConnected) continue
            observadorAlturaTabela.unobserve(elemento)
            elementosAlturaTabela.delete(elemento)
        }
        const tabelas = [...document.querySelectorAll('.div-tabela:not(.nude)')]
            .filter(div => div.dataset.alturaAdaptavel !== 'false' && div.getClientRects().length)
        const alturas = tabelas.map(div => estabilizarAlturaTabela(div, calcularAlturaDisponivelTabela(div)))
        tabelas.forEach((div, indice) => {
            const altura = `${alturas[indice]}px`
            if (div.style.getPropertyValue('--altura-disponivel-tabela') !== altura)
                div.style.setProperty('--altura-disponivel-tabela', altura)
            // Observa também cabeçalhos e contêineres que mudam sem recriar o DOM.
            for (let elemento = div.parentElement; elemento; elemento = elemento.parentElement) {
                for (const alvo of [elemento, ...elemento.children]) {
                    if (alvo === div || elementosAlturaTabela.has(alvo)) continue
                    elementosAlturaTabela.add(alvo)
                    observadorAlturaTabela.observe(alvo)
                }
                if (elemento.classList.contains('tela')) break
            }
        })
    })
}

new MutationObserver(agendarAlturaTabelas).observe(document.documentElement, { childList: true, subtree: true })
window.addEventListener('resize', soltarAlturasTravadas)
window.visualViewport?.addEventListener('resize', soltarAlturasTravadas)
agendarAlturaTabelas()
