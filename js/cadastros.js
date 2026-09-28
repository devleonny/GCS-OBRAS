async function telaCadastros() {

    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes', 'transportadoras']

    const abas = bases
        .map(b => `<span onclick="toggleAbas(this); abrirTabelaCadastrastro('${b}')">${inicialMaiuscula(b)}</span>`)
        .join('')

    tela.innerHTML = `
        <div style="${vertical}; max-width: max-content;">
            <div class="toolbar-padrao">
                ${abas}
            </div>
            <div class="painel-atras-padrao"></div>
        </div>
    `

    await abrirTabelaCadastrastro(bases[0])

}

async function abrirTabelaCadastrastro(base) {

    const local = document.querySelector('.painel-atras-padrao')

    local.innerHTML = `<img src="gifs/loading.gif">`

    const pag = `cad_${base}`
    const tabela = await modTab({
        pag,
        base,
        btnExtras: `<img  src="imagens/baixar.png" onclick="editarBaseAuxiliar('${base}')">`,
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
        <td style="width: 2rem;">
            <img src="imagens/pesquisar2.png" onclick="editarBaseAuxiliar('${base}', '${id}')">
        </td>
    `

    return `<tr>${tds}</tr>`
}

async function editarBaseAuxiliar(nomeBase, id) {

    const dados = await recuperarDado(nomeBase, id)
    const funcao = id
        ? `salvarNomeAuxiliar('${nomeBase}', '${id}')`
        : `salvarNomeAuxiliar('${nomeBase}')`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirItemTabela('${nomeBase}', '${id}')` })

    const linhas = [
        {
            texto: 'Nome',
            elemento: `<textarea name="nome" style="text-transform: uppercase;" placeholder="${inicialMaiuscula(nomeBase)}">${dados?.nome || ''}</textarea>`
        }
    ]

    popup({ linhas, botoes, titulo: `Gerenciar ${inicialMaiuscula(nomeBase)}` })

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
