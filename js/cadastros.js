const basesCadastro = {
    empresas: { titulo: 'Empresas', singular: 'Empresa' },
    tipos: { titulo: 'Tipos', singular: 'Tipo' },
    sistemas: { titulo: 'Sistemas', singular: 'Sistema' },
    prioridades: { titulo: 'Prioridades', singular: 'Prioridade' },
    correcoes: { titulo: 'Correções', singular: 'Correção' },
    transportadoras: { titulo: 'Transportadoras', singular: 'Transportadora' }
}

async function telaCadastros() {

    const bases = Object.keys(basesCadastro)

    const abas = bases
        .map(b => `
            <button type="button" class="cadastros-aba" data-base="${b}" onclick="abrirTabelaCadastrastro('${b}')">
                ${basesCadastro[b].titulo}
            </button>`)
        .join('')

    tela.innerHTML = `
        <div class="tela-cadastros">
            <div class="cadastros-cabecalho">
                <div class="cadastros-titulo">
                    <span>Categorias de Formulário</span>
                    <small>Listas de opções usadas nos formulários do sistema</small>
                </div>
                <button type="button" class="cadastros-novo" onclick="editarBaseAuxiliar(document.querySelector('.cadastros-aba.ativa')?.dataset.base)">
                    <b>+</b>
                    <span>Adicionar</span>
                </button>
            </div>
            <div class="cadastros-abas" role="tablist">
                ${abas}
            </div>
            <div class="cadastros-painel"></div>
        </div>
    `

    await abrirTabelaCadastrastro(bases[0])

}

async function abrirTabelaCadastrastro(base) {

    const local = document.querySelector('.cadastros-painel')
    if (!local)
        return

    for (const aba of document.querySelectorAll('.cadastros-aba')) {
        const ativa = aba.dataset.base === base
        aba.classList.toggle('ativa', ativa)
        aba.setAttribute('aria-selected', ativa)
    }

    const novo = document.querySelector('.cadastros-novo span')
    if (novo)
        novo.textContent = `Adicionar ${basesCadastro[base]?.singular || ''}`.trim()

    local.innerHTML = `<div class="cadastros-carregando"><img src="gifs/loading-gcs.gif"></div>`

    const pag = `cad_${base}`
    const tabela = await modTab({
        pag,
        base,
        ordenar: {
            path: 'nome',
            direcao: 'asc'
        },
        colunas: {
            'Nome': { chave: 'nome' },
            '': {}
        },
        body: `cad_${base}`,
        criarLinha: 'criarLinhaCadastro'
    })

    local.innerHTML = tabela

    await paginacao(pag)

}

async function criarLinhaCadastro(dados) {

    const { id, base, nome } = dados || {}

    const tds = `
        <td>${nome}</td>
        <td class="cadastros-acao">
            <img src="imagens/pesquisar.svg" title="Editar" onclick="editarBaseAuxiliar('${base}', '${id}')">
        </td>
    `

    return `<tr>${tds}</tr>`
}

async function editarBaseAuxiliar(nomeBase, id) {

    if (!nomeBase)
        return

    const dados = await recuperarDado(nomeBase, id)
    const funcao = id
        ? `salvarNomeAuxiliar('${nomeBase}', '${id}')`
        : `salvarNomeAuxiliar('${nomeBase}')`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirItemTabela('${nomeBase}', '${id}')` })

    const { singular = nomeBase } = basesCadastro[nomeBase] || {}

    const linhas = [
        {
            texto: 'Nome',
            elemento: `<textarea name="nome" style="text-transform: uppercase;" placeholder="${singular}">${dados?.nome || ''}</textarea>`
        }
    ]

    popup({ linhas, botoes, titulo: id ? `Editar ${singular}` : `Adicionar ${singular}` })

}

function confirmarExcluirItemTabela(nomeBase, id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirItemTabela('${nomeBase}', '${id}')` }
    ]

    popup({ mensagem: 'Confirmar a exclusão do item?', botoes, removerAnteriores: true })
}

async function excluirItemTabela(nomeBase, id) {

    await deletar(`${nomeBase}/${id}`)

}

async function salvarNomeAuxiliar(nomeBase, id = crypto.randomUUID()) {

    overlayAguarde()

    const nome = String(document.querySelector('[name="nome"]').value).toUpperCase()

    await enviar(`${nomeBase}/${id}/nome`, nome)

    removerPopup()

}
