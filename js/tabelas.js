let controles = {}

function campoBloq() {
    popup({ mensagem: 'O campo não permite pesquisas' })
}

function modTab(configuracoes) {

    const { btnExtras = '', criarLinha, base, colunas = {}, body = null, pag = null } = configuracoes || {}

    if (!body || !pag || !base || !criarLinha)
        return popup({ mensagem: 'body/pag/base/criarLinha Não podem ser null' })

    controles[pag] ??= {}
    controles[pag] = {
        pagina: 1,
        ...controles[pag],
        ...configuracoes
    }

    const ths = Object.keys(colunas)
        .map(th => `
            <th>
                <div style="${horizontal}; width: 100%; justify-content: space-between; gap: 1rem;">
                    <span>${th}</span>    
                </div>
            </th>`
        )
        .join('')

    const pesquisa = Object.entries(colunas)
        .map(([th, query]) => {
            if (!query.chave)
                return `
            <th style="background-color: white;">
                <img src="imagens/alerta.png" onclick="campoBloq()" title="Campo não permite pesquisa!" style="width: 1.5rem;">
            </th>`

            return `
            <th 
                style="background-color: white; text-align: left;"
                name="${th}"
                onkeydown="confirmarPesquisa({ event, chave: '${query.chave}', op: '${query.op || 'includes'}', elemento: this, pag: '${pag}'})"
                contentEditable="true">
            </th>`

        })
        .join('')


    const modelo = `
        <div style="${vertical}; width: 100%;">
            <div class="topo-tabela">
                <div id="paginacao_${pag}"></div>
                ${pesquisa ? `<span style="color: white; margin-right: 1rem;">Use o <b>ENTER</b> para pesquisar</span>` : ''}
                ${btnExtras}
            </div>
            <div class="div-tabela" style="overflow-x: auto;">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="${body}"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `
    return modelo
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

    if (event) {
        if (event.type !== 'keydown') return
        if (event.key !== 'Enter') return
        event.preventDefault()
    }

    const termo = elemento.textContent
        .replace(/\n/g, '')
        .trim()
        .toLowerCase()

    controles[pag].pagina = 1
    controles[pag].filtros ??= {}

    if (!termo) {
        delete controles[pag].filtros[chave]

        if (Object.keys(controles[pag].filtros).length === 0) {
            delete controles[pag].filtros
        }

        await paginacao(pag)
        return
    }

    controles[pag].filtros[chave] = {
        op,
        value: termo
    }

    await paginacao(pag)
}

async function paginacao(pag) {

    if (pag)
        return ativarPaginacao(pag)

    for (const pag of Object.keys(controles))
        await ativarPaginacao(pag)

    async function ativarPaginacao(pag) {

        const { pagina, base, body, alinPag = horizontal, bloquearPaginacao = false, primEx = true, criarLinha, funcaoAdicional, filtros } = controles[pag] || {}

        // Bloquear paginações seguintes;
        if (bloquearPaginacao && !primEx) {
            await executarFuncoesAdicionais(funcaoAdicional)
            return
        }

        const tbody = document.getElementById(body)

        if (!tbody)
            return

        if (!base || !criarLinha)
            return console.log('Base/CriarLinha não informado(s)')

        const tabela = tbody.parentElement
        const cols = tabela.querySelectorAll('thead th').length
        const dados = await pesquisarDB({ base, pagina, filtros })
        const divPaginacao = document.getElementById(`paginacao_${pag}`)
        const paginaAtual = document.getElementById(`paginaAtual_${pag}`)
        const resultados = document.getElementById(`resultados_${pag}`)

        controles[pag].total = dados.paginas

        if (!divPaginacao)
            return

        if (!paginaAtual) {

            divPaginacao.innerHTML = `
                <div style="${alinPag}; align-items: center; padding: 2px; color: white;">
                    <div style="${horizontal}; gap: 5px;">

                        <img src="imagens/esq.png" style="width: 2rem;" onclick="mudarPagina(-1, '${pag}')">
                        <span id="paginaAtual">${pagina}</span> de
                        <span id="totalPaginas">${dados.paginas}</span> 
                        <img src="imagens/dir.png" style="width: 2rem;" onclick="mudarPagina(1, '${pag}')">
                        
                    </div>
                    <span><span style="font-size: 1rem;" id="resultados">${dados.total}</span> ${dados.total !== 1 ? 'Itens' : 'Item'}</span>
                </div>
                `

        } else {
            paginaAtual.textContent = pagina
            totalPaginas.textContent = dados.paginas
            resultados.textContent = dados.total
        }

        if (!dados.resultados.length) {
            tbody.innerHTML = ''
            tbody.appendChild(criarDino(cols))

        } else {
            const dinossauro = tbody.querySelector('#dinossauro')
            if (dinossauro) dinossauro.remove()

            await atualizarComTS(tbody, dados.resultados, criarLinha)
        }

        await executarFuncoesAdicionais(funcaoAdicional)

        // Primeira execução removida;
        if (primEx)
            controles[pag].primEx = false

    }

    async function executarFuncoesAdicionais(funcaoAdicional = []) {
        // Função adicional, se existir;
        if (funcaoAdicional.length) {
            for (const f of funcaoAdicional)
                await window[f]()
        }
    }

}

async function atualizarComTS(tbody, dados, criarLinha) {

    const dino = tbody.querySelector('#dinossauro')
    if (dino)
        dino.remove()

    const linhasAtuais = {}
    for (const tr of tbody.querySelectorAll('tr[data-id]')) {
        linhasAtuais[tr.dataset.id] = tr
    }

    const fragment = document.createDocumentFragment()
    let usarModoPadrao = false

    for (const d of dados) {

        const temp = document.createElement('tbody')
        temp.innerHTML = await window[criarLinha](d)
        const novaTr = temp.firstElementChild

        const id = novaTr?.dataset?.id
        const ts = novaTr?.dataset?.ts

        if (!id || ts == null) {
            usarModoPadrao = true
            break
        }

        const trAtual = linhasAtuais[id]

        if (trAtual && trAtual.dataset.ts === ts) {
            fragment.appendChild(trAtual)
        } else {
            fragment.appendChild(novaTr)
        }

        delete linhasAtuais[id]
    }

    if (usarModoPadrao) {
        let linhas = ''
        for (const d of dados) {
            linhas += await window[criarLinha](d)
        }
        tbody.innerHTML = linhas
        return
    }

    // substitui tudo de uma vez
    for (const tr of tbody.querySelectorAll('tr[data-id]')) {
        tr.remove()
    }

    tbody.appendChild(fragment)
}

function criarDino(cols) {
    const tr = document.createElement('tr')
    tr.id = 'dinossauro'

    const td = document.createElement('td')
    td.colSpan = cols
    td.innerHTML = `
        <div style="${horizontal}; width: 100%; gap: 1rem;">
            <img src="gifs/offline.gif" style="width: 5rem;">
        </div>
    `

    tr.appendChild(td)
    return tr
}

