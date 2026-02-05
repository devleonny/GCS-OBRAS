const controles = {}
let attPag = true

function modTab({ btnExtras = '', criarLinha, base, funcaoAdicional = null, filtros = {}, colunas = {}, body = null, pag = null }) {

    if (!body || !pag || !base || !criarLinha)
        return popup({ mensagem: 'body/pag/base/criarLinha Não podem ser null' })

    controles[pag] ??= {}
    controles[pag].funcaoAdicional = funcaoAdicional
    controles[pag].pagina = 1
    controles[pag].base = base
    controles[pag].criarLinha = criarLinha
    controles[pag].body = body
    controles[pag].filtros = filtros

    const ths = Object.keys(colunas)
        .map(th => `
            <th>
                <div style="${horizontal}; width: 100%; justify-content: space-between; gap: 1rem;">
                    <span>${inicialMaiuscula(th)}</span>    
                </div>
            </th>
            `
        )
        .join('')


    const pesquisa = Object.entries(colunas)
        .map(([th, query]) => {
            if (!query.chave)
                return `
            <th style="background-color: white;">
                <img src="imagens/alerta.png" style="width: 1.5rem;">
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
            <div class="topo-tabela" style="justify-content: space-between; width: 100%; background-color: #707070;">
                <div id="paginacao_${pag}"></div>
                ${pesquisa ? `<span style="color: white; margin-right: 1rem;">Use o <b>ENTER</b> para pesquisar</span>` : ''}
                ${btnExtras}
            </div>
            <div class="div-tabela" style="overflow-x: auto;">
                <table class="tabela">
                    <thead style="box-shadow: 0px 0px 2px #222;">
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
        ativarPaginacao(pag)

    async function ativarPaginacao(pag) {

        const { pagina, base, body, criarLinha, funcaoAdicional, filtros } = controles[pag] || {}

        const tbody = document.getElementById(body)

        if (!tbody)
            return

        if (!base || !criarLinha)
            return console.log('Base/CriarLinha não informado(s)')

        const tabela = tbody.parentElement
        const cols = tabela.querySelectorAll('thead th').length
        tbody.innerHTML = `
            <tr> 
                <td colspan="${cols}">
                    <div style="${horizontal}; width: 100%;">
                        <img src="gifs/loading.gif" style="width: 5rem;">
                    </div>
                </td>
            <tr>`

        const dados = await pesquisarDB({ base, pagina, filtros })
        const divPaginacao = document.getElementById(`paginacao_${pag}`)
        const paginaAtual = document.getElementById(`paginaAtual_${pag}`)
        const resultados = document.getElementById(`resultados_${pag}`)

        controles[pag].total = dados.paginas

        // Função adicionarl, se existir;
        if (funcaoAdicional) {
            window[funcaoAdicional]()
        }

        if (!paginaAtual) {
            divPaginacao.innerHTML = `
            <div style="display: flex; align-items:center; gap: 10px; padding: 0.2rem;">
                <img src="imagens/esq.png" style="width: 2rem;" onclick="mudarPagina(-1, '${pag}')">
                <span style="color: white;">
                    Página 

                    <span id="paginaAtual">${pagina}</span> 
                    
                    de 

                    <span id="totalPaginas">${dados.paginas}</span> 

                    •
                    
                    <span id="resultados">${dados.total}</span> ${dados.total !== 1 ? 'itens' : 'item'}
                </span>
                <img src="imagens/dir.png" style="width: 2rem;" onclick="mudarPagina(1, '${pag}')">
            </div>
        `
        } else {
            paginaAtual.textContent = pagina
            totalPaginas.textContent = dados.paginas
            resultados.textContent = dados.total
        }

        let linhas = ''
        for (const d of dados.resultados) {
            linhas += await window[criarLinha](d)
        }

        if (!linhas) linhas = `
            <tr> 
                <td colspan="${cols}">
                    <div style="${horizontal}; width: 100%; gap: 1rem;">
                        <img src="gifs/offline.gif" style="width: 5rem;">
                    </div>
                </td>
            <tr>`

        tbody.innerHTML = linhas
    }

}