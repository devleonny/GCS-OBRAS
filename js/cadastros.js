async function telaCadastros() {

    mostrarMenus(false)

    tela.innerHTML = `
    <div class="tabela-cadastro">
        <div class="tabela-cadastro-recorte"></div>
    </div>
    `

    const divTabelas = document.querySelector('.tabela-cadastro-recorte')

    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes']

    for (const base of bases) {

        const btnExtras = `<img  src="imagens/baixar.png" onclick="editarBaseAuxiliar('${base}')">`

        const tabela = modTab({
            base,
            btnExtras,
            alinPag: vertical,
            colunas: {
                'Nome': { chave: 'nome' },
                '': {}
            },
            body: `cad_${base}`,
            pag: `cad_${base}`,
            criarLinha: 'criarLinhaCadastro'
        })

        const final = `
            <div style="${vertical}">
                <span style="font-size: 1.1rem; color: white;">${inicialMaiuscula(base)}</span>
                ${tabela}
            </div>`

        divTabelas.insertAdjacentHTML('beforeend', final)
    }

    await paginacao()

}

async function criarLinhaCadastro(dados) {

    const { id, base, nome } = dados || {}

    const tds = `
        <td>${nome}</td>
        <td style="width: 2rem;">
            <img src="imagens/pesquisar2.png" onclick="editarBaseAuxiliar('${base}', '${id}')">
        </td>`

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
            elemento: `<textarea name="nome" placeholder="${inicialMaiuscula(nomeBase)}">${dados?.nome || ''}</textarea>`
        }
    ]

    popup({ linhas, botoes, titulo: `Gerenciar ${inicialMaiuscula(nomeBase)}` })

}

function confirmarExcluirItemTabela(nomeBase, id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirItemTabela('${nomeBase}', '${id}')` }
    ]

    popup({ mensagem: 'Confirmar a exclusão do item?', botoes, nra: false })
}

async function excluirItemTabela(nomeBase, id) {

    await deletarDB(nomeBase, id)
    deletar(`${nomeBase}/${id}`)

}

async function salvarNomeAuxiliar(nomeBase, id = ID5digitos()) {

    overlayAguarde()

    const nome = document.querySelector('[name="nome"]')

    const dado = await recuperarDado(nomeBase, id) || {}
    dado.nome = nome.value

    await inserirDados({ [id]: dado }, nomeBase)
    enviar(`${nomeBase}/${id}/nome`, nome.value)

    removerPopup()

}
