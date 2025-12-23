let unidades = []

async function telaCadastros() {

    filtrosPagina = {}

    mostrarMenus(false)

    titulo.textContent = 'Cadastros'

    const acumulado = `
        <div style="${vertical}; gap: 2px;">
            <div class="tabela-cadastro"></div>
        </div>
    `

    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes']
    let tabs = document.querySelector('.tabela-cadastro')
    if (!tabs) telaInterna.innerHTML = acumulado
    tabs = document.querySelector('.tabela-cadastro')

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

    tabelaClientes()

}

async function criarLinhaCadastro(id, dados, b) {

    const tds = `
        <td>${dados?.nome || '...'}</td>
        <td style="width: 2rem;">
            <img src="imagens/pesquisar.png" onclick="editarBaseAuxiliar('${b}', '${id}')">
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
            elemento: `<input name="nome" placeholder="${inicialMaiuscula(nomeBase)}" value="${dados?.nome || ''}">`
        }
    ]

    const form = new formulario({ linhas, botoes, titulo: `Gerenciar ${inicialMaiuscula(nomeBase)}` })
    form.abrirFormulario()
}

async function salvarNomeAuxiliar(nomeBase, id) {

    overlayAguarde()

    id = id || ID5digitos()

    const nome = document.querySelector('[name="nome"]')
    await enviar(`${nomeBase}/${id}/nome`, nome.value)

    let dado = await recuperarDado(nomeBase, id) || {}
    dado.nome = nome.value
    await inserirDados({ [id]: dado }, nomeBase)
    await criarLinhaCadastro(id, dado, nomeBase)

    removerPopup()

}

async function tabelaClientes() {

    dados_clientes = await recuperarDados('dados_clientes')
    const colunas = [
        `<input onclick="checksCliente(this)" style="width: 1.5rem; height: 1.5rem;" type="checkbox">`,
        'Nome',
        'CNPJ',
        'Cidade',
        'Endereço',
        'Estado',
        'Empresa',
        ''
    ]

    const btnExtras = `
        <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/trocar.png" onclick="classificarUnidades()">
            <img src="imagens/baixar.png" onclick="">
            <span>Clientes/Unidades</span>
        </div>
    `
    const htmlTab = modeloTabela({
        minWidth: '70rem;',
        colunas,
        btnExtras,
        body: `tabela_dados_clientes`
    })

    const tabs = document.querySelector('.tabela-cadastro')
    const tabClientes = document.getElementById('tabela_dados_clientes')
    if (!tabClientes) tabs.insertAdjacentHTML('beforeend', htmlTab)

    for (const [idCliente, cliente] of Object.entries(dados_clientes)) {
        criarLinhaCliente(idCliente, cliente)
    }

}

function criarLinhaCliente(idCliente, { nome, cnpj, cidade, bairro, estado, empresa } = {}) {

    const tds = `
    <td>
        <input 
        data-id="${idCliente}" 
        data-nome="${nome}" 
        type="checkbox" 
        style="width: 1.5rem; height: 1.5rem;" 
        name="empresa">
    </td>
    <td>${nome || ''}</td>
    <td>${cnpj || ''}</td>
    <td>${cidade || ''}</td>
    <td>${bairro || ''}</td>
    <td>${estado || ''}</td>
    <td>${empresas?.[empresa]?.nome || ''}</td>
    <td>
        <img src="imagens/pesquisar.png" onclick="">
    </td>
    `

    const trExistente = document.getElementById(idCliente)
    if (trExistente) trExistente.innerHTML = tds

    const tbody = document.getElementById('tabela_dados_clientes')
    tbody.insertAdjacentHTML('beforeend', `<tr id="${idCliente}">${tds}</tr>`)
}

function checksCliente(inputM) {
    const inputs = document.querySelectorAll('[name="empresa"]')

    for (const input of inputs) {
        const tr = input.closest('tr')
        if (tr.style.display == 'none') continue

        input.checked = inputM.checked
    }
}

function classificarUnidades() {

    const inputs = document.querySelectorAll('[name="empresa"]')
    unidades = []

    for (const input of inputs) {
        const tr = input.closest('tr')
        if (tr.style.display == 'none') continue
        if (!input.checked) continue

        const id = input.dataset.id
        const nome = input.dataset.nome
        unidades.push({ id, nome })
    }

    if (unidades.length == 0) return popup(mensagem('Marque pelo menos 1 unidade'), 'Alerta', true)

    const opcoes = Object.entries(empresas)
        .map(([idEmpresa, empresa]) => {
            if (idEmpresa == 0) return ''
            return `<option value="${idEmpresa}">${empresa.nome}</option>`
        }).join('')

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; gap: 5px; padding: 0.5rem;">
                <select id="selectEmp">
                    <option value=""></option>
                    ${opcoes}
                </select>
                ${unidades.map(u => `<span style="text-align: left; max-width: 30rem;">• ${u.nome}</span>`).join('')}
            </div>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'vincularEmpresas()' }
    ]

    const form = new formulario({ linhas, botoes, titulo: `Vincular clientes` })
    form.abrirFormulario()
}

async function vincularEmpresas() {

    overlayAguarde()

    const selectEmp = document.getElementById('selectEmp')
    if (!selectEmp) return

    const response = await fetch(`${api}/vincular-empresas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidades, empresa: selectEmp.value })
    })

    let data
    try {
        data = await response.json()
        if (data.mensagem) return popup(mensagem(data.mensagem), 'Alerta', true)

        await sincronizarDados('dados_clientes')
        await telaCadastros()
        removerPopup()

    } catch (e) {
        return { mensagem: e }
    }

}

