const aEstados = [
    '',
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO'
]

const tagCliente = (nome, ativarRemover = false) => {
    return `
        <div style="${horizontal}; gap: 5px;">
            <span data-nome="${nome}" class="tag-cliente">
                ${nome || '--'}
            </span>
            ${ativarRemover ? `<img onclick="this.parentElement.remove()" src="imagens/cancel.png">` : ''}
        </div>`
}

async function classificarUnidades() {

    if (Object.keys(controles?.clientes?.cp || {}).length == 0)
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
                ${Object.entries(controles.clientes.cp || {}).map(([, u]) => `<span style="text-align: left; max-width: 30rem;">• ${u}</span>`).join('')}
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

    const unidades = Object.entries(controles?.clientes?.cp || {})
        .map(([id, nome]) => {
            return { id, nome }
        })

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

        controles.clientes.cp = {}

        removerPopup()

    } catch (err) {
        return popup({ mensagem: err.message || 'Falha no vínculo das empresas' })
    }

}

async function telaClientes() {
    mostrarMenus(false)

    const colunas = {
        'Check': {},
        'CPF / CNPJ': { chave: 'cnpj' },
        'Empresa': { chave: 'snapshots.empresa' },
        'Nome Fantasia': { chave: 'nome' },
        'Endereço Cadastro': { chave: 'snapshots.enderecoCadastro' },
        'Comentário': { chave: 'comentario' },
        'Ações': {}
    }

    const btnExtras = `
        <div style="${horizontal}; gap: 1rem;">
            <input onclick="checksCliente(this)" style="width: 1.5rem; height: 1.5rem;" type="checkbox">
            <img src="imagens/trocar.png" onclick="classificarUnidades()">
            <img src="imagens/baixar.png" onclick="formularioCliente()">
        </div>`

    const tabela = await modTab({
        pag: 'clientes',
        colunas,
        funcaoAdicional: ['contarPorTagCliente'],
        body: 'bodyClientes',
        btnExtras,
        criarLinha: 'criarLinhaClienteGCS',
        base: 'dados_clientes'
    })


    const dropdownTags = montarDropdownCheckboxClientes({
        titulo: 'Tags',
        path: 'tags.*.tag',
        opcoes: tagsClientes
    })

    const dropdownEstados = montarDropdownCheckboxClientes({
        titulo: 'Estados',
        path: 'estado',
        opcoes: Object.keys(posicoesEstados || {})
    })

    const mapa = criarMapa({ apenasMapa: true, path: 'estado', pag: 'clientes' })

    tela.innerHTML = `
        <div class="tela-clientes">
            <div class="bloco-clientes">${tabela}</div>
            <div class="bloco-clientes mapa">
                <div class="cabecalho-etiquetas">
                    ${dropdownTags}
                    ${dropdownEstados}
                </div>
                ${mapa}
            </div>
        </div>`


    await paginacao()
    mostrarMapa()

    criarMenus('clientes')
}

async function limparFiltrosClientesDropdown() {
    if (controles?.clientes?.filtros) {
        delete controles.clientes.filtros['tags.*.tag']
        delete controles.clientes.filtros['estado']

        if (Object.keys(controles.clientes.filtros).length === 0)
            delete controles.clientes.filtros
    }

    atualizarLabelDropdownClientes('tags.*.tag')
    atualizarLabelDropdownClientes('estado')

    document.querySelectorAll('.filtro-dropdown-cliente').forEach(drop => {
        drop.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false
        })
    })

    await paginacao('clientes')
}

function regrasAtuaisClientes(path) {
    const atual = controles?.clientes?.filtros?.[path]

    if (!atual)
        return []

    return Array.isArray(atual)
        ? [...atual]
        : [atual]
}

function valoresMarcadosClientes(path) {
    const atual = regrasAtuaisClientes(path)
    const grupo = atual.find(r => r?.modo === 'OR' && r?.origem === 'dropdown')
    return (grupo?.regras || []).map(r => r.value)
}

function tudoMarcadoClientes(path, opcoes = []) {
    const validas = opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => a.localeCompare(b))

    const marcados = valoresMarcadosClientes(path)

    return validas.length > 0 && validas.every(o => marcados.includes(o))
}

function labelDropdownClientes(path) {
    const marcados = valoresMarcadosClientes(path)

    if (marcados.length === 0)
        return 'Selecionar'

    if (marcados.length === 1)
        return marcados[0]

    return `${marcados.length} selecionados`
}

function atualizarLabelDropdownClientes(path) {
    const drop = document.querySelector(`.filtro-dropdown-cliente[data-path="${path}"]`)
    if (!drop)
        return

    const label = drop.querySelector('.dropdown-label')
    if (!label)
        return

    label.textContent = labelDropdownClientes(path)
}

async function alternarTodosDropdownClientes(path, opcoes = []) {
    controles.clientes ??= {}
    controles.clientes.filtros ??= {}

    const regras = regrasAtuaisClientes(path)
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'))

    const validas = opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => a.localeCompare(b))

    if (!validas.length)
        return

    const marcarTudo = !tudoMarcadoClientes(path, validas)

    if (marcarTudo) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: validas.map(value => ({
                op: '=',
                value
            }))
        })
    }

    if (outrasRegras.length === 0) {
        delete controles.clientes.filtros[path]
    } else if (outrasRegras.length === 1) {
        controles.clientes.filtros[path] = outrasRegras[0]
    } else {
        controles.clientes.filtros[path] = outrasRegras
    }

    if (Object.keys(controles.clientes.filtros).length === 0)
        delete controles.clientes.filtros

    const drop = document.querySelector(`.filtro-dropdown-cliente[data-path="${path}"]`)
    if (drop) {
        const checks = drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')
        checks.forEach(input => {
            input.checked = marcarTudo
        })

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]')
        if (checkTodos)
            checkTodos.checked = marcarTudo
    }

    atualizarLabelDropdownClientes(path)
    await paginacao('clientes')
}

async function alternarFiltroDropdownClientes(path, valor, marcado) {
    controles.clientes ??= {}
    controles.clientes.filtros ??= {}

    const regras = regrasAtuaisClientes(path)
    const grupoAtual = regras.find(r => r?.modo === 'OR' && r?.origem === 'dropdown')
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'))

    let regrasDropdown = [...(grupoAtual?.regras || [])]
        .filter(r => r.value !== valor)

    if (marcado) {
        regrasDropdown.push({
            op: '=',
            value: valor
        })
    }

    if (regrasDropdown.length > 0) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: regrasDropdown
        })
    }

    if (outrasRegras.length === 0) {
        delete controles.clientes.filtros[path]
    } else if (outrasRegras.length === 1) {
        controles.clientes.filtros[path] = outrasRegras[0]
    } else {
        controles.clientes.filtros[path] = outrasRegras
    }

    if (Object.keys(controles.clientes.filtros).length === 0)
        delete controles.clientes.filtros

    const drop = document.querySelector(`.filtro-dropdown-cliente[data-path="${path}"]`)
    if (drop) {
        const opcoes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')]
            .map(input => input.value)

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]')
        if (checkTodos)
            checkTodos.checked = tudoMarcadoClientes(path, opcoes)
    }

    atualizarLabelDropdownClientes(path)
    await paginacao('clientes')
}

function montarDropdownCheckboxClientes({ titulo, path, opcoes = [] }) {
    const validas = opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => a.localeCompare(b))

    const marcados = valoresMarcadosClientes(path)
    const todosAtivos = tudoMarcadoClientes(path, validas)

    const itens = validas
        .map(o => `
            <label class="dropdown-item">
                <input
                    type="checkbox"
                    data-item="opcao"
                    value="${o}"
                    ${marcados.includes(o) ? 'checked' : ''}
                    onchange="alternarFiltroDropdownClientes('${path}', ${JSON.stringify(o).replace(/"/g, '&quot;')}, this.checked)">
                <span>${o}</span>
            </label>
        `)
        .join('')

    return `
        <div style="${vertical}; gap: 2px;">
            <span style="color: white;">${titulo}</span>
            <div class="filtro-dropdown filtro-dropdown-cliente" data-path="${path}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <span class="dropdown-label">${labelDropdownClientes(path)}</span>
                    <span>▾</span>
                </div>
                <div class="dropdown-menu" data-aberto="N">
                    <label class="dropdown-item" style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px;">
                        <input
                            type="checkbox"
                            data-item="todos"
                            ${todosAtivos ? 'checked' : ''}
                            onchange="alternarTodosDropdownClientes('${path}', ${JSON.stringify(validas).replace(/"/g, '&quot;')})">
                        <span>Todos</span>
                    </label>

                    ${itens || '<span>Nenhuma opção</span>'}
                </div>
            </div>
        </div>
    `
}

async function contarPorTagCliente() {

    const contagem = await contarPorCampo({
        base: 'dados_clientes',
        path: 'estado',
        filtros: controles?.clientes?.filtros || {}
    })

    auxMapa(contagem)

}

async function filtrarPorTag(tag) {

    controles.clientes.filtros ??= {}

    controles.clientes.filtros = {
        ...controles.clientes.filtros,
        'tags.*.tag': { op: 'includes', value: tag }
    }

    await paginacao()

}

function criarLinhaClienteGCS(cliente) {

    const idCliente = cliente.id
    const { nome, cnpj, tags, comentario } = cliente
    const enderecoEntrega = cliente.enderecoEntrega ?? {}

    const modelo = ({ endereco, bairro, cep, cidade, estado }) => {
        return `
        <div style="${vertical}; min-width: 200px; gap: 1px; text-align: left;">
            <span><b>Endereço:</b> ${endereco || ''}</span>
            <span><b>Bairro:</b> ${bairro || ''}</span>
            <span><b>Cep:</b> ${cep || ''}</span>
            <span><b>Cidade:</b> ${cidade || ''}</span>
            <span><b>Estado:</b> ${estado || ''}</span>
        </div>`
    }

    const eCadastro = modelo({ ...cliente })
    //const eEntrega = modelo({ ...enderecoEntrega })

    const labelsTags = (tags || [])
        .map(item => tagCliente(item.tag))
        .join('')

    const tds = `
        <td>
            <input
            onchange="checkPoint(this)"
            data-id="${idCliente}"
            data-nome="${nome}"
            type="checkbox"
            ${controles?.clientes?.cp?.[idCliente] ? 'checked' : ''}
            style="width: 1.5rem; height: 1.5rem;"
            name="empresa">
        </td>
        <td style="white-space: nowrap;">${cnpj || ''}</td>
        <td>
            <span>${cliente?.snapshots?.empresa || ''}</span>
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <span>${nome || ''}</span>
                <div style="display: flex; flex-wrap: wrap; gap: 2px; min-width: 200px;">
                    ${labelsTags}
                </div>
            </div>
        </td>
        <td>${eCadastro}</td>
        <td>
            <div style="white-space: pre-wrap;">${comentario || ''}</div>
        </td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="formularioCliente(${idCliente})">
        </td>`

    return `<tr>${tds}</tr>`

}

function checkPoint(input) {

    const codCliente = input.dataset.id

    controles.clientes.cp ??= {}

    if (input.checked)
        controles.clientes.cp[codCliente] = input.dataset.nome
    else
        delete controles.clientes.cp[codCliente]

}

function checksCliente(inputM) {
    const inputs = document.querySelectorAll('[name="empresa"]')

    for (const input of inputs) {

        input.checked = inputM.checked
        checkPoint(input)

    }
}

function adicionarTag() {
    const painel = document.querySelector('.painel-padrao')

    const tag = painel.querySelector('[name="tag"]')

    const divtags = painel.querySelector('[name="tags"]')
    const tagsExistente = divtags.querySelectorAll('.tag-cliente')

    const existente = [...tagsExistente]
        .some(span => span.dataset.nome == tag.value)

    if (existente || tag.value == '')
        return

    divtags.insertAdjacentHTML('beforeend', tagCliente(tag.value, true))
}

async function formularioCliente(idCliente) {

    const {
        enderecoEntrega = {},
        endereco,
        bairro,
        estado,
        cidade,
        cep,
        nome,
        cnpj,
        comentario,
        tags
    } = await recuperarDado('dados_clientes', idCliente) || {}

    const labelsTags = (tags || [])
        .map(item => tagCliente(item.tag, true))
        .join('')

    const opcoes = tagsClientes
        .map(o => `<option>${o}</option>`)
        .join('')

    const linhas = [
        {
            texto: 'CPF/CNPJ',
            elemento: `<input oninput="formatarCnpj(this)" name="cnpj" value="${cnpj || ''}">`
        },
        {
            texto: 'Nome Fantasia',
            elemento: `<textarea oninput="this.value = this.value.toUpperCase()" name="nome">${nome || ''}</textarea>`
        },
        {
            texto: 'Tags',
            elemento: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/concluido.png" onclick="adicionarTag()">
                <select name="tag">
                    ${opcoes}
                </select>
                
                <div name="tags" style="${vertical}; gap: 2px;">
                    ${labelsTags}
                </div>
            </div>
            `
        },
        {
            texto: 'Comentário',
            elemento: `<textarea name="comentario">${comentario || ''}</textarea>`
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
            elemento: `<textarea maxlength="60" name="endereco">${endereco || ''}</textarea>`
        },
        {
            texto: 'Bairro',
            elemento: `<textarea name="bairro">${bairro || ''}</textarea>`
        },
        {
            texto: 'Cidade',
            elemento: `<input name="cidade" value="${cidade || ''}">`
        },
        {
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this)" name="cep" value="${cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `
            <select name="estado">
                ${aEstados.map(e => `<option ${estado == e ? 'selected' : ''}>${e}</option>`).join('')}
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
            elemento: `<textarea name="e_endereco">${enderecoEntrega?.endereco || ''}</textarea>`
        },
        {
            texto: 'Bairro',
            elemento: `<textarea name="e_bairro">${enderecoEntrega?.bairro || ''}</textarea>`
        },
        {
            texto: 'Cidade',
            elemento: `<input name="e_cidade" value="${enderecoEntrega?.cidade || ''}">`
        },
        {
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this)" name="e_cep" value="${enderecoEntrega?.cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `
            <select name="e_estado">
                ${aEstados.map(estado => `<option ${enderecoEntrega?.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
            </select>
            `
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: idCliente
                ? `salvarCliente(${idCliente})`
                : 'salvarCliente()'
        }
    ]

    if (idCliente)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirCliente(${idCliente})` })

    const titulo = idCliente
        ? 'Editar Cliente'
        : 'Criar Cliente'

    popup({ linhas, botoes, titulo })

}

function confirmarExcluirCliente(idCliente) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirCliente('${idCliente}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza que deseja excluir?', removerAnteriores: true, titulo: 'Exclusão de cliente' })
}

async function excluirCliente(idCliente) {

    await deletar(`dados_clientes/${idCliente}`)

}

async function salvarCliente(idCliente = codCliAleatorio()) {

    overlayAguarde()

    // Último painel
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const obVal = (n) => {
        const el = painel.querySelector(`[name="${n}"]`)
        return el ? el.value : ''
    }

    const cnpj = obVal('cnpj')

    const resposta = await verificarClienteExistente({ cnpj, idCliente })

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    const divtags = painel.querySelector('[name="tags"]')
    const tagsExistente = divtags.querySelectorAll('.tag-cliente')
    const tags = [...tagsExistente || []]
        .map(span => { return { tag: span.dataset.nome } })

    const novo = {
        id: idCliente,
        cnpj,
        nome: obVal('nome'),
        endereco: obVal('endereco'),
        bairro: obVal('bairro'),
        cep: obVal('cep'),
        cidade: obVal('cidade'),
        estado: obVal('estado'),
        comentario: obVal('comentario'),
        tags,
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

    await enviar(`dados_clientes/${idCliente}`, cliente)

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