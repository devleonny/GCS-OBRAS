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

async function telaClientes() {

    mostrarMenus(false)

    overlayAguarde()

    const colunas = ['CNPJ', 'Nome Fantasia', 'Endereço Cadastro', 'Endereço Entrega', '']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')
    const pesquisa = colunas
        .map((col, i) => `<th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico('${i}', this.textContent, 'bodyClientes')"></th>`)
        .join('')

    const acumulado = `
        <div style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="bodyClientes"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `

    tela.innerHTML = acumulado

    for (const [idCliente, cliente] of Object.entries(dados_clientes)) {
        criarLinhaCliente(idCliente, cliente)
    }

    criarMenus('clientes')

    removerOverlay()

}

function criarLinhaCliente(idCliente, cliente) {

    const enderecoCadastro = `
        <div style="${vertical}; gap: 1px; text-align: left;">
            <span><b>Endereço:</b> ${cliente.endereco || ''}</span>
            <span><b>Bairro:</b> ${cliente.bairro || ''}</span>
            <span><b>Cep:</b> ${cliente.cep || ''}</span>
            <span><b>Cidade:</b> ${cliente.cidade || ''}</span>
            <span><b>Estado:</b> ${cliente.estado || ''}</span>
        </div>
    `
    const entrega = cliente.enderecoEntrega || {}
    const enderecoEntrega = `
        <div style="${vertical}; gap: 1px; text-align: left;">
            <span><b>Endereço:</b> ${entrega.endereco || ''}</span>
            <span><b>Bairro:</b> ${entrega.bairro || ''}</span>
            <span><b>Cep:</b> ${entrega.cep || ''}</span>
            <span><b>Cidade:</b> ${entrega.cidade || ''}</span>
            <span><b>Estado:</b> ${entrega.estado || ''}</span>
        </div>
    `

    const tds = `
        <td>
            ${cliente?.cnpj || ''}
        </td>
        <td>
            ${cliente?.nome || ''}
        </td>
        <td>
            ${enderecoCadastro}
        </td>
        <td>
            ${enderecoEntrega}
        </td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="formularioCliente('${idCliente}')">
        </td>
    `

    const trExistente = document.getElementById(idCliente)
    const timestamp = Number(trExistente?.dataset?.timestamp)
    if (trExistente) {
        if (cliente.timestamp !== timestamp) trExistente.innerHTML = tds
        return
    }

    document.getElementById('bodyClientes').insertAdjacentHTML('beforeend', `<tr data-timestamp="${cliente?.timestamp}" id="${idCliente}">${tds}</tr>`)
}

async function formularioCliente(idCliente) {

    const cliente = dados_clientes[idCliente] || {}
    const enderecoEntrega = dados_clientes?.[idCliente]?.enderecoEntrega || {}

    const linhas = [
        {
            texto: 'CPF/CNPJ',
            elemento: `<input oninput="formatarCnpj(this)" name="cnpj" value="${cliente.cnpj || ''}">`
        },
        {
            texto: 'Nome Fantasia',
            elemento: `<textarea name="nome">${cliente.nome || ''}</textarea>`
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
        { texto: 'Salvar', img: 'concluido', funcao: idCliente ? `salvarCliente('${idCliente}')` : 'salvarCliente()' }
    ]

    const titulo = idCliente ? 'Salvar Cliente' : 'Editar Cliente'

    const form = new formulario({ linhas, botoes, titulo })
    form.abrirFormulario()

}

async function salvarCliente(idCliente = unicoID()) {

    overlayAguarde()

    const obVal = (n) => {
        const el = document.querySelector(`[name="${n}"]`)
        return el ? el.value : ''
    }

    const novo = {
        cnpj: obVal('cnpj'),
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

    const cliente = dados_clientes[idCliente] || {}
    const dados = {
        ...cliente,
        ...novo
    }

    dados_clientes[idCliente] = dados
    await inserirDados({ [idCliente]: dados }, 'dados_clientes')
    enviar(`dados_clientes/${idCliente}`, dados)

    removerPopup()

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
