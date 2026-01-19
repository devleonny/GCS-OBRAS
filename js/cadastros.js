let unidades = []

async function telaCadastros() {

    filtrosPagina = {}

    mostrarMenus(false)

    const acumulado = `
    <div class="tabela-cadastro">
        <div class="tabela-cadastro-recorte"></div>
    </div>
    `

    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes']
    let tabs = document.querySelector('.tabela-cadastro-recorte')
    if (!tabs) telaInterna.innerHTML = acumulado
    tabs = document.querySelector('.tabela-cadastro-recorte')

    for (const b of bases) {
        const colunas = ['Nome', '']
        const btnExtras = `
        <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/baixar.png" onclick="editarBaseAuxiliar('${b}')">
            <span>${inicialMaiuscula(b)}</span>
        </div>
        `
        const htmlTab = modeloTabela({ colunas, btnExtras, body: `tabela_${b}` })

        const tab = document.getElementById(`tabela_${b}`)
        if (!tab) tabs.insertAdjacentHTML('beforeend', htmlTab)

        const dados = await recuperarDados(b)
        for (const [id, objeto] of Object.entries(dados)) criarLinhaCadastro(id, objeto, b)
    }

}

async function criarLinhaCadastro(id, dados, b) {

    const tds = `
        <td>${dados?.nome || '...'}</td>
        <td style="width: 2rem;">
            <img src="imagens/pesquisar2.png" onclick="editarBaseAuxiliar('${b}', '${id}')">
        </td>
    `

    const tbody = document.getElementById(`tabela_${b}`)
    if (!tbody) return

    const tr = document.getElementById(id)
    if (tr) {
        tr.innerHTML = tds
        return
    }

    tbody.insertAdjacentHTML('beforeend', `<tr id="${id}">${tds}</tr>`)
}

async function editarBaseAuxiliar(nomeBase, id) {

    const dados = await recuperarDado(nomeBase, id)
    const funcao = id ? `salvarNomeAuxiliar('${nomeBase}', '${id}')` : `salvarNomeAuxiliar('${nomeBase}')`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    const linhas = [
        {
            texto: 'Nome',
            elemento: `<textarea name="nome" placeholder="${inicialMaiuscula(nomeBase)}">${dados?.nome || ''}</textarea>`
        }
    ]

    const form = new formulario({ linhas, botoes, titulo: `Gerenciar ${inicialMaiuscula(nomeBase)}` })
    form.abrirFormulario()
}

async function salvarNomeAuxiliar(nomeBase, id = ID5digitos()) {

    overlayAguarde()

    const nome = document.querySelector('[name="nome"]')
    await enviar(`${nomeBase}/${id}/nome`, nome.value)

    let dado = await recuperarDado(nomeBase, id) || {}
    dado.nome = nome.value
    await inserirDados({ [id]: dado }, nomeBase)
    await criarLinhaCadastro(id, dado, nomeBase)

    removerPopup()

}
