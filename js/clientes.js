const aEstados = [
    '',
    'Acre',
    'Alagoas',
    'Amapá',
    'Amazonas',
    'Bahia',
    'Ceará',
    'Distrito Federal',
    'Espírito Santo',
    'Goiás',
    'Maranhão',
    'Mato Grosso',
    'Mato Grosso do Sul',
    'Minas Gerais',
    'Pará',
    'Paraíba',
    'Paraná',
    'Pernambuco',
    'Piauí',
    'Rio de Janeiro',
    'Rio Grande do Norte',
    'Rio Grande do Sul',
    'Rondônia',
    'Roraima',
    'Santa Catarina',
    'São Paulo',
    'Sergipe',
    'Tocantins'
]

function checksCliente(inputM) {
    const inputs = document.querySelectorAll('[name="empresa"]')

    for (const input of inputs) {
        const tr = input.closest('tr')
        if (tr.style.display == 'none') continue

        input.checked = inputM.checked
    }
}

async function classificarUnidades() {

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

    if (unidades.length == 0)
        return popup({ mensagem: 'Marque pelo menos 1 unidade' })

    const empresas = await pesquisarDB({
        base: 'empresas'
    })

    const opcoes = (empresas.resultados || [])
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((empresa) => {
            if (empresa.id == 'mQK7') return ''
            return `<option value="${empresa.id}">${empresa.nome}</option>`
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

    popup({ linhas, botoes, titulo: `Vincular clientes` })

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
        if (data.mensagem)
            return popup({ mensagem: data.mensagem })

        await sincronizarDados({ base: 'dados_clientes' })
        await telaClientes()
        removerPopup()

    } catch (err) {
        return popup({ mensagem: err.message || 'Falha no vínculo das empresas' })
    }

}

async function telaClientes() {

    mostrarMenus(false)
    overlayAguarde()

    const colunas = {
        'Check': '',
        'CPF / CNPJ': { chave: 'cnpj' },
        'Empresa': { chave: 'snapshots.empresa' },
        'Nome Fantasia': { chave: 'nome' },
        'Endereço Cadastro': '',
        'Endereço Entrega': '',
        'Ações': ''
    }

    const btnExtras = `
        <div style="${horizontal}; gap: 1rem;">
            <input onclick="checksCliente(this)" style="width: 1.5rem; height: 1.5rem;" type="checkbox">
            <img src="imagens/trocar.png" onclick="classificarUnidades()">
            <img src="imagens/baixar.png" onclick="formularioCliente()">
        </div>
    `
    const pag = 'clientes'
    const tabela = await modTab({
        pag,
        colunas,
        body: 'bodyClientes',
        btnExtras,
        criarLinha: 'criarLinhaClienteGCS',
        base: 'dados_clientes'
    })

    tela.innerHTML = `
        <div class="tela-clientes">
            ${tabela}
        </div>`

    await paginacao(pag)

    if (app == 'GCS')
        criarMenus('clientes')

    removerOverlay()

}

function criarLinhaClienteGCS(cliente) {

    const idCliente = cliente.id
    const { nome, cnpj, endereco, bairro, cep, cidade, estado, empresa } = cliente
    const enderecoEntrega = cliente.enderecoEntrega ?? {}

    const eCadastro = `
        <div style="${vertical}; gap: 1px; text-align: left;">
            <span><b>Endereço:</b> ${endereco || ''}</span>
            <span><b>Bairro:</b> ${bairro || ''}</span>
            <span><b>Cep:</b> ${cep || ''}</span>
            <span><b>Cidade:</b> ${cidade || ''}</span>
            <span><b>Estado:</b> ${estado || ''}</span>
        </div>
    `
    const eEntrega = `
        <div style="${vertical}; gap: 1px; text-align: left;">
            <span><b>Endereço:</b> ${enderecoEntrega.endereco || ''}</span>
            <span><b>Bairro:</b> ${enderecoEntrega.bairro || ''}</span>
            <span><b>Cep:</b> ${enderecoEntrega.cep || ''}</span>
            <span><b>Cidade:</b> ${enderecoEntrega.cidade || ''}</span>
            <span><b>Estado:</b> ${enderecoEntrega.estado || ''}</span>
        </div>
    `

    const tds = `
        <td>
            <input 
            data-id="${idCliente}" 
            data-nome="${nome}" 
            type="checkbox" 
            style="width: 1.5rem; height: 1.5rem;" 
            name="empresa">
        </td>
        <td style="white-space: nowrap;">${cnpj || ''}</td>
        <td><span>${cliente.snapshots.empresa}</span></td>
        <td style="text-align: left;">${nome || ''}</td>
        <td>${eCadastro}</td>
        <td>${eEntrega}</td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="formularioCliente(${idCliente})">
        </td>
    `

    return `<tr>${tds}</tr>`

}

async function formularioCliente(idCliente) {

    const cliente = await recuperarDado('dados_clientes', idCliente) || {}
    const enderecoEntrega = cliente?.enderecoEntrega || {}

    const linhas = [
        {
            texto: 'CPF/CNPJ',
            elemento: `<input oninput="formatarCnpj(this)" name="cnpj" value="${cliente.cnpj || ''}">`
        },
        {
            texto: 'Nome Fantasia',
            elemento: `<textarea oninput="this.value = this.value.toUpperCase()" name="nome">${cliente.nome || ''}</textarea>`
        },
        {
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <h3>Endereço de Cadastro</h3>
                    <img src="gifs/cadastro.gif">
                </div>
                `
        },
        {
            texto: 'Endereço',
            elemento: `<textarea name="endereco">${cliente.endereco || ''}</textarea>`
        },
        {
            texto: 'Bairro',
            elemento: `<textarea name="bairro">${cliente.bairro || ''}</textarea>`
        },
        {
            texto: 'Cidade',
            elemento: `<input name="cidade" value="${cliente.cidade || ''}">`
        },
        {
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this)" name="cep" value="${cliente.cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `
            <select name="estado">
                ${aEstados.map(estado => `<option ${cliente.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
            </select>
            `
        },
        {
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <h3>Endereço de Entrega</h3>
                    <img src="gifs/entrega.gif">
                </div>
                `
        },
        {
            texto: 'Endereço',
            elemento: `<textarea name="e_endereco">${enderecoEntrega.endereco || ''}</textarea>`
        },
        {
            texto: 'Bairro',
            elemento: `<textarea name="e_bairro">${enderecoEntrega.bairro || ''}</textarea>`
        },
        {
            texto: 'Cidade',
            elemento: `<input name="e_cidade" value="${enderecoEntrega.cidade || ''}">`
        },
        {
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this)" name="e_cep" value="${enderecoEntrega.cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `
            <select name="e_estado">
                ${aEstados.map(estado => `<option ${enderecoEntrega.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
            </select>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: idCliente ? `salvarCliente(${idCliente})` : 'salvarCliente()' }
    ]

    if (idCliente) botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirCliente(${idCliente})` })

    const titulo = idCliente
        ? 'Editar Cliente'
        : 'Criar Cliente'

    popup({ linhas, botoes, titulo })

}

function confirmarExcluirCliente(idCliente) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirCliente('${idCliente}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza que deseja excluir?', nra: false, titulo: 'Exclusão de cliente' })
}

async function excluirCliente(idCliente) {

    deletar(`dados_clientes/${idCliente}`)
    await deletarDB(`dados_clientes/${idCliente}`)

}

async function salvarCliente(idCliente = codCliAleatorio()) {

    overlayAguarde()

    const obVal = (n) => {
        const el = document.querySelector(`[name="${n}"]`)
        return el ? el.value : ''
    }

    const cnpj = obVal('cnpj')

    const resposta = await verificarClienteExistente({ cnpj, idCliente })

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    const novo = {
        cnpj,
        nome: obVal('nome'),
        endereco: obVal('endereco'),
        bairro: obVal('bairro'),
        cep: obVal('cep'),
        cidade: obVal('cidade'),
        estado: obVal('estado'),
        enderecoEntrega: {
            endereco: obVal('e_endereco'),
            bairro: obVal('e_bairro'),
            cep: obVal('e_cep'),
            cidade: obVal('e_cidade'),
            estado: obVal('e_estado'),
        }
    }

    const cliente = {
        ...await recuperarDado('dados_clientes', idCliente) || {},
        ...novo
    }

    await inserirDados({ [idCliente]: cliente }, 'dados_clientes')
    removerPopup()

    enviar(`dados_clientes/${idCliente}`, cliente)

}

function formatarCep(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8)

    if (v.length > 5)
        v = v.replace(/(\d{5})(\d)/, '$1-$2')

    input.value = v
}

function formatarCnpj(input) {
    let v = input.value.replace(/\D/g, '')

    if (v.length <= 11) {
        v = v
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    } else {
        v = v
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    }

    input.value = v
}

function codCliAleatorio() {
    const agora = Date.now() % 1e7
    const rand = Math.floor(Math.random() * 1e3)
    return Number(`${agora}${rand.toString().padStart(3, '0')}`)
}

async function verificarClienteExistente(dados) {

    try {
        const response = await fetch(`${api}/verificar-cliente-existente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}