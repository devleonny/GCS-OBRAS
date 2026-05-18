async function telaCadastros() {

    tela.innerHTML = `
    <div class="tabela-cadastro">
        <div class="tabela-cadastro-recorte"></div>
    </div>
    `

    const divTabelas = document.querySelector('.tabela-cadastro-recorte')

    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes']

    const emMassa = bases.map(async (base) => {

        const btnExtras = `<img  src="imagens/baixar.png" onclick="editarBaseAuxiliar('${base}')">`

        const pag = `cad_${base}`
        const tabela = await modTab({
            base,
            btnExtras,
            ordenar: {
                path: 'nome',
                direcao: 'asc'
            },
            colunas: {
                'Nome': { chave: 'nome' },
                '': {}
            },
            body: `cad_${base}`,
            pag,
            criarLinha: 'criarLinhaCadastro'
        })

        const final = `
            <div style="${vertical}">
                <span style="font-size: 1.1rem; color: white;">${inicialMaiuscula(base)}</span>
                ${tabela}
            </div>`

        divTabelas.insertAdjacentHTML('beforeend', final)

        await paginacao(pag)

    })

    await Promise.all(emMassa)

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
