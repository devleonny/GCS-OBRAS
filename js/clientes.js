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

function renderAppsCircle(id, apps = []) {
    const ativos = new Set(
        (Array.isArray(apps) ? apps : Object.keys(apps || {}))
            .map(v => String(v).toUpperCase().trim())
    )

    const corAtiva = '#16a34a'
    const corInativa = '#d1d5db'
    const stroke = '#ffffff'

    const cor = sigla => ativos.has(sigla) ? corAtiva : corInativa

    return `
        <div class="pizza-apps">
            <svg viewBox="0 0 100 100" width="100" height="100" aria-label="Apps" onclick="ativarCadastro(${id})">
                <!-- fatias -->
                <path d="M50 50 L50 0 A50 50 0 0 1 100 50 Z" fill="${cor('AC')}" stroke="${stroke}" stroke-width="2"></path>
                <path d="M50 50 L100 50 A50 50 0 0 1 50 100 Z" fill="${cor('IAC')}" stroke="${stroke}" stroke-width="2"></path>
                <path d="M50 50 L50 100 A50 50 0 0 1 0 50 Z" fill="${cor('HNK')}" stroke="${stroke}" stroke-width="2"></path>
                <path d="M50 50 L0 50 A50 50 0 0 1 50 0 Z" fill="${cor('HNW')}" stroke="${stroke}" stroke-width="2"></path>

                <!-- textos -->
                <text x="68" y="28" text-anchor="middle" dominant-baseline="middle"
                      font-size="11" font-weight="700" fill="#111827">AC</text>

                <text x="72" y="68" text-anchor="middle" dominant-baseline="middle"
                      font-size="10" font-weight="700" fill="#111827">IAC</text>

                <text x="30" y="72" text-anchor="middle" dominant-baseline="middle"
                      font-size="10" font-weight="700" fill="#111827">HNK</text>

                <text x="28" y="30" text-anchor="middle" dominant-baseline="middle"
                      font-size="10" font-weight="700" fill="#111827">HNW</text>
            </svg>
        </div>
    `
}

async function ativarCadastro(id) {

    overlayAguarde()

    if (!id)
        return popup({ mensagem: 'Cliente sem cnpj/cpf' })

    await enviar(`clientes/${id}/cadastrar_omie`, true)

    popup({ mensagem: 'Cadastramento Omie solicitado, aguarde pelo menos 1 min' })

}

async function telaClientes() {

    overlayAguarde()

    const colunas = {
        'Check': {},
        'CPF/CNPJ': { chave: 'cnpj' },
        'Empresa': { chave: 'nomeEmpresa' },
        'Permissão': { chave: 'permissao' },
        'Usuário': { chave: 'usuario' },
        'Matrícula': { chave: 'matricula' },
        'Nome Fantasia': { chave: 'nome' },
        'Endereço Cadastro': { chave: 'snapshots.enderecoCadastro' },
        'Comentário': { chave: 'comentario' },
        'Apps': {},
        'Ações': {}
    }

    const btnExtras = `
        <div style="${horizontal}; gap: 1rem;">
            <input onclick="checksCliente(this)" style="width: 1.5rem; height: 1.5rem;" type="checkbox">
            <img src="imagens/trocar.png" onclick="classificarUnidades()">
            <button onclick="formularioCliente()">Adicionar Cadastro</button>
        </div>`

    const pag = 'clientes'
    const tabela = await modTab({
        pag: 'clientes',
        colunas,
        substituicoes: [
            {
                path: 'empresa',
                tabela: 'empresas',
                campoBusca: 'id',
                retorno: 'nome',
                destino: 'nomeEmpresa'
            }
        ],
        funcaoAdicional: ['contarPorTagCliente'],
        body: 'bodyClientes',
        btnExtras,
        criarLinha: 'criarLinhaClienteGCS',
        base: 'clientes'
    })

    const dropdownTags = montarDropdownCheckbox({
        titulo: 'Tags',
        pag,
        path: 'tags.*.tag',
        opcoes: tagsClientes
    })

    const dropdownEstados = montarDropdownCheckbox({
        titulo: 'Estados',
        pag,
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


    await paginacao(pag)
    mostrarMapa()

    removerOverlay()
}

async function contarPorTagCliente() {

    const contagem = await contarPorCampo({
        base: 'clientes',
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

    const {
        id,
        apps,
        nome,
        cnpj,
        usuario,
        matricula,
        permissao,
        tags,
        comentario,
        nomeEmpresa
    } = cliente

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

    const labelsTags = (tags || [])
        .map(item => tagCliente(item.tag))
        .join('')

    const tds = `
        <td>
            <input
            onchange="checkPoint(this)"
            data-id="${id}"
            data-nome="${nome}"
            type="checkbox"
            ${controles?.clientes?.cp?.[id] ? 'checked' : ''}
            style="width: 1.5rem; height: 1.5rem;"
            name="empresa">
        </td>
        <td style="white-space: nowrap;">${cnpj || ''}</td>

        <td>
            ${nomeEmpresa ? `<span class="and">${nomeEmpresa}` : ''}</span>
        </td>

        <td>${permissao ? `<span class="fin">${permissao}</span>` : ''}</td>
        <td>${usuario ? `<span class="fin">${usuario}</span>` : ''}</td>
        <td>${matricula ? `<span class="fin">${matricula}</span>` : ''}</td>

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

        <td>${renderAppsCircle(cnpj ? id : null, Object.keys(apps || []))}</td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="formularioCliente(${id})">
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

    overlayAguarde()

    const {
        matricula,
        endereco_entrega = {},
        ddd,
        celular,
        email,
        endereco,
        bairro,
        estado,
        cidade,
        cep,
        nome,
        usuario,
        permissao,
        cnpj,
        comentario,
        empresa,
        tags
    } = await recuperarDado('clientes', idCliente) || {}

    const labelsTags = (tags || [])
        .map(item => tagCliente(item.tag, true))
        .join('')

    const opcoes = tagsClientes
        .map(o => `<option>${o}</option>`)
        .join('')

    const { nome: nomeEmpresa } = empresa
        ? await recuperarDado('empresas', empresa)
        : {}

    controlesCxOpcoes.empresa = {
        base: 'empresas',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' }
        }
    }

    let editarPermissao = {}
    const { permissao: permissaoUsuario } = acesso || {}

    if (['adm', 'diretoria'].includes(permissaoUsuario)) {

        editarPermissao = {
            texto: 'Permissão',
            elemento: `<select name="permissao">${permissoes.map(p => `<option ${permissao == p ? 'selected' : ''}>${p}</option>`).join('')}</select>`
        }

    }

    const linhas = [
        {
            texto: 'Matrícula',
            elemento: `<span class="fin">${matricula || 'automático'}</span>`
        },
        {
            texto: 'Empresa',
            elemento: `<span ${empresa ? `id="${empresa}"` : ''} name="empresa" class="opcoes" onclick="cxOpcoes('empresa')">${nomeEmpresa || 'Selecionar'}</span>`
        },
        {
            texto: 'CPF/CNPJ',
            elemento: `<input placeholder="CPF ou CNPJ" oninput="formatarCnpj(this)" name="cnpj" value="${cnpj || ''}">`
        },
        {
            texto: 'Nome',
            elemento: `<textarea placeholder="Nome Completo" maxlength="60" oninput="this.value = this.value.toUpperCase()" name="nome">${nome || ''}</textarea>`
        },
        {
            texto: 'E-mail',
            elemento: `<textarea name="email" placeholder="E-mail">${email || ''}</textarea>`
        },
        {
            texto: 'Celular',
            elemento: `
            <input name="ddd" placeholder="DDD" style="width: 40px;" value="${ddd || ''}">
            <input name="celular" placeholder="Celular" value="${celular || ''}">
            `
        },
        {
            texto: 'Usuário',
            elemento: `
                <div style="${vertical}; gap: 5px;">
                    <input name="usuario" placeholder="Usuário" oninput="verificarDisponibilidade(this)" value="${usuario || ''}" ${usuario ? 'readOnly="true"' : ''}>
                    <div data-valido="${usuario ? 'S' : 'N'}" id="status_usuario"></div>
                </div>
            `
        },
        editarPermissao,
        {
            texto: 'Tags',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 5px;">
                    <select name="tag">
                        ${opcoes}
                    </select>

                    <button onclick="adicionarTag()">Confirmar</button>
                </div>
                
                <div name="tags" style="${vertical}; gap: 2px;">
                    ${labelsTags}
                </div>
            </div>
            `
        },
        {
            texto: 'Comentário',
            elemento: `<textarea placeholder="Comentário" name="comentario">${comentario || ''}</textarea>`
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
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this, 'cadastro')" name="cep" value="${cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `<select onchange="datalistCidades(this.value, 'cidade')" name="estado">${aEstados.map(e => `<option ${estado == e ? 'selected' : ''}>${e}</option>`)}</select>`
        },
        {
            texto: 'Cidade',
            elemento: `<select name="cidade">${cidade ? `<option>${cidade}</option>` : ''}</select>`
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
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <h3>Endereço de Entrega</h3>
                    <img src="gifs/entrega.gif">
                </div>
                `
        },
        {
            texto: 'Cep',
            elemento: `<input oninput="formatarCep(this)" name="e_cep" value="${endereco_entrega?.cep || ''}">`
        },
        {
            texto: 'Estado',
            elemento: `<select onchange="datalistCidades(this.value, 'e_cidade')" name="e_estado">${aEstados.map(e => `<option ${endereco_entrega?.estado == e ? 'selected' : ''}>${e}</option>`)}</select>`
        },
        {
            texto: 'Cidade',
            elemento: `<select name="e_cidade">${endereco_entrega?.cidade ? `<option>${endereco_entrega?.cidade}</option>` : ''}</select>`
        },
        {
            texto: 'Endereço',
            elemento: `<textarea name="e_endereco">${endereco_entrega?.endereco || ''}</textarea>`
        },
        {
            texto: 'Bairro',
            elemento: `<textarea name="e_bairro">${endereco_entrega?.bairro || ''}</textarea>`
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

    if (idCliente && ['adm', 'diretoria'].includes(permissaoUsuario))
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirCliente(${idCliente})` })

    const titulo = idCliente
        ? 'Editar Cliente'
        : 'Criar Cliente'

    popup({ linhas, botoes, titulo })

}

async function verificarDisponibilidade(input) {

    const usuario = input.value.trim('')

    const statusUsuario = document.getElementById('status_usuario')

    let pesquisa = null

    if (usuario.length > 5) {

        pesquisa = await pesquisarDB({
            base: 'clientes',
            filtros: {
                usuario: { op: '=', value: usuario }
            }
        })

    }

    const modelo = (texto, img) => `
        <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/${img}.png" style="width: 1.5rem;">
            <span>${texto}</span>
        </div>
    `

    // Validador;
    statusUsuario.dataset.valido = (!pesquisa || pesquisa.resultados.length)
        ? 'N'
        : 'S'

    statusUsuario.innerHTML = (!pesquisa || pesquisa.resultados.length)
        ? modelo('Não disponível', 'cancel')
        : modelo('Usuário válido', 'concluido')


}

async function datalistCidades(estado, local) {

    if (!estado)
        return

    try {

        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        })

        if (!resposta.ok)
            throw new Error(`Erro na requisição: ${resposta.status} ${resposta.statusText}`)

        const cidades = await resposta.json()
        const opcoes = cidades
            .map(c => `<option>${c.nome}</option>`)
            .join('')

        document.querySelector(`[name="${local}"]`).innerHTML = opcoes

    } catch (err) {
        console.log(err)
    }

}

function confirmarExcluirCliente(idCliente) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirCliente('${idCliente}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza que deseja excluir?', removerAnteriores: true, titulo: 'Exclusão de cliente' })
}

async function excluirCliente(idCliente) {

    await deletar(`clientes/${idCliente}`)

}

async function salvarCliente(idCliente = null) {

    overlayAguarde()

    // Se novo, a tabela é outra;
    const cadastro = idCliente
        ? false
        : true

    try {

        // Último painel
        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
        const obVal = (n) => {
            const el = painel.querySelector(`[name="${n}"]`)
            return el ? el.value || el.id : null
        }

        const usuarioValido = document.getElementById('status_usuario').dataset.valido == 'S'

        // Verificações do CNPJ
        const cnpj = obVal('cnpj')

        if (!usuarioValido) { // Se usuário preenchido e válido, cnpj não é obrigatório;

            if (!validarCpfCnpj(cnpj))
                return popup({ mensagem: 'Campo CPF/CNPJ inválido!' })

            const pesquisa = await pesquisarDB({
                base: 'clientes',
                filtros: {
                    'cnpj': { op: '=', value: cnpj }
                }
            })

            const primeiroResultado = pesquisa.resultados?.[0]

            if (pesquisa.resultados.length > 0 && Number(primeiroResultado?.id) !== idCliente)
                return popup({ mensagem: `Já existe outro cadastro com este CPF/CNPJ > ${pesquisa.resultados?.[0]?.nome || ''}` })

        }

        const divtags = painel.querySelector('[name="tags"]')
        const tagsExistente = divtags.querySelectorAll('.tag-cliente')
        const tags = [...tagsExistente || []]
            .map(span => { return { tag: span.dataset.nome } })

        const novo = {
            cnpj,
            nome: obVal('nome'),
            endereco: obVal('endereco'),
            bairro: obVal('bairro'),
            cep: obVal('cep'),
            cidade: obVal('cidade'),
            estado: obVal('estado'),
            comentario: obVal('comentario'),
            tags,
            endereco_entrega: {
                endereco: obVal('e_endereco'),
                bairro: obVal('e_bairro'),
                cep: obVal('e_cep'),
                cidade: obVal('e_cidade'),
                estado: obVal('e_estado'),
            },

            /// Novos campos 07/2026;
            usuario: usuarioValido ? obVal('usuario') : null,
            ddd: obVal('ddd'),
            celular: obVal('celular'),
            email: obVal('email'),
            empresa: obVal('empresa')
        }

        // Mesclagem;
        const cliente = {
            ...idCliente ? await recuperarDado('cliente', idCliente) : {},
            ...novo
        }

        // Se novo;
        if (cadastro && cliente.cnpj)
            cliente.cadastrar_omie = true

        // Permissão;
        const permissao = obVal('permissao')

        if (permissao)
            cliente.permissao = permissao

        await enviar(`clientes/${idCliente || 'novo'}`, cliente)

        removerTodosPopups()

        popup({ mensagem: 'Cadastro atualizado com sucesso' })

    } catch (err) {
        popup({ mensage: 'Não foi possível salvar o cliente. Fale com o suporte.' })
    }

}

async function formatarCep(input, campo) {

    const ajuste = campo == 'cadastro'
        ? ''
        : 'e_'

    let v = input.value.replace(/\D/g, '').slice(0, 8)

    if (v.length == 0) {
        document.querySelector(`[name="${ajuste}endereco"]`).value = ''
        document.querySelector(`[name="${ajuste}bairro"]`).value = ''
        document.querySelector(`[name="${ajuste}cidade"]`).value = ''
        document.querySelector(`[name="${ajuste}estado"]`).value = ''
    }

    if (v.length == 8) {

        overlayAguarde()
        const { city, street, neighborhood, state } = await buscarEndereco(v)

        document.querySelector(`[name="${ajuste}endereco"]`).value = street || ''
        document.querySelector(`[name="${ajuste}bairro"]`).value = neighborhood || ''
        document.querySelector(`[name="${ajuste}cidade"]`).innerHTML = `<option>${city || ''}</option>`
        document.querySelector(`[name="${ajuste}estado"]`).value = state || ''

        removerOverlay()
    }

    if (v.length > 5)
        v = v.replace(/(\d{5})(\d)/, '$1-$2')

    input.value = v

}

async function buscarEndereco(cep) {

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }

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