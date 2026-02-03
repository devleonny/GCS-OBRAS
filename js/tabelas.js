const controles = {}

function modTab({ btnExtras = '', criarLinha, base, funcaoAdicional = null, filtros = {}, colunas = {}, body = null, pag = null }) {

    if (!body || !pag) 
        return popup({ mensagem: 'body/pag Não podem ser null' })

    controles[pag] ??= {}
    controles[pag].funcaoAdicional = funcaoAdicional
    controles[pag].pagina = 1
    controles[pag].base = base
    controles[pag].criarLinha = criarLinha
    controles[pag].body = body
    controles[pag].filtros = filtros

    const ths = Object.keys(colunas)
        .map((th, i) => `
            <th>
                <div style="${horizontal}; width: 100%; justify-content: space-between; gap: 1rem;">
                    <span>${inicialMaiuscula(th)}</span>    
                    <!--<img onclick="ordenarOrcamentos(${i})" src="imagens/filtro.png" style="width: 1rem;">-->
                </div>
            </th>
            `
        )
        .join('')


    const pesquisa = Object.entries(colunas)
        .map(([th, chave]) => `
            <th 
                style="background-color: white; text-align: left;"
                name="${th}"
                onkeydown="confirmarPesquisa(event, '${chave}', this, '${pag}')"
                contentEditable="true">
            </th>`)
        .join('')


    const modelo = `
        <div style="${vertical}; width: 100%;">
            <div class="topo-tabela" style="justify-content: space-between; width: 100%; background-color: #707070;">
                <div id="paginacao_${pag}"></div>
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

async function confirmarPesquisa(e, chave, el, p) {

    if (e) {
        if (e.type !== 'keydown') return
        if (e.key !== 'Enter') return
        e.preventDefault()
    }

    const termo = el.textContent.replace(/\n/g, '').trim().toLowerCase()

    controles[p].pagina = 1
    controles[p].filtros ??= {}

    if (!termo) {
        delete controles[p].filtros[chave]

        if (Object.keys(controles[p].filtros).length === 0) {
            delete controles[p].filtros
        }

        await paginacao(p)
        return
    }

    controles[p].filtros[chave] = {
        op: 'includes',
        value: termo
    }

    await paginacao(p)
}


async function paginacao(pag) {

    const { pagina, base, body, criarLinha, funcaoAdicional, filtros } = controles[pag] || {}

    if (!base || !criarLinha)
        return console.log('Base/CriarLinha não informado(s)')

    const tbody = document.getElementById(body)
    const tabela = tbody.parentElement
    const cols = tabela.querySelectorAll('thead th').length
    tbody.innerHTML = `
    <tr> 
        <td colspan="${cols}">
            <div style="${horizontal};">
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
                <span style="color: white;">Dê um <b>ENTER</b> para pesquisar</span>
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

    tbody.innerHTML = linhas

}