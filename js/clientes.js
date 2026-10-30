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

const tagCliente = nome => {
    return `
        <div class="cliente-tag">
            <span data-nome="${escaparAtributo(nome || '')}" class="etiquetas">
                ${escaparAtributo(nome || '--')}
            </span>
        </div>`
}

// Último painel
function obVal(n) {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

    const el = (painel || document).querySelector(`[name="${n}"]`)
    return el ? el.value || el.id : null
}

// Vínculo em massa de clientes a uma empresa: popup com busca própria (todas as páginas, não só a
// visível na tabela), "marcar todos os encontrados" e a lista dos selecionados, que se mantém entre
// buscas. A seleção é feita só aqui (a tabela não tem mais checkbox).
const vinculoMassa = { selecionados: new Map(), encontrados: [], total: 0, termo: '', consulta: 0, timer: null }
const LIMITE_BUSCA_VINCULO = 50
const LIMITE_MARCAR_VINCULO = 1000

async function classificarUnidades() {

    const empresas = await pesquisarDB({ base: 'empresas', limite: 500 })
    const opcoes = (empresas.resultados || [])
        .filter(empresa => empresa.id != 'mQK7')
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
        .map(empresa => `<option value="${escaparAtributo(empresa.id)}">${escaparAtributo(empresa.nome)}</option>`)
        .join('')

    vinculoMassa.selecionados = new Map()
    vinculoMassa.encontrados = []
    vinculoMassa.total = 0
    vinculoMassa.termo = ''

    const elemento = `
        <div class="vinculo-massa">
            <section class="vinculo-busca">
                <input type="search" class="vinculo-campo" placeholder="Buscar por nome, CNPJ ou ID..."
                    oninput="buscarVinculoMassa(this.value)" onkeydown="if (event.key === 'Enter') buscarVinculoMassa(this.value, true)">
                <div class="vinculo-busca-topo">
                    <span class="vinculo-info" data-vinculo="info">Digite para buscar clientes.</span>
                    <button type="button" data-vinculo="marcar" hidden onclick="marcarEncontradosVinculo()"></button>
                </div>
                <div class="vinculo-lista" data-vinculo="resultados"></div>
            </section>
            <section class="vinculo-selecao">
                <div class="vinculo-busca-topo">
                    <strong data-vinculo="contagem">Selecionados</strong>
                    <button type="button" onclick="limparSelecaoVinculo()">Limpar</button>
                </div>
                <div class="vinculo-lista" data-vinculo="selecionados"></div>
            </section>
        </div>`

    const conteudoRodape = `
        <label class="vinculo-empresa">
            <span>Empresa</span>
            <select data-vinculo="empresa">
                <option value="" disabled selected>Escolha a empresa</option>
                <option value="">(sem empresa: remover vínculo)</option>
                ${opcoes}
            </select>
        </label>`

    const botoes = [{ texto: 'Vincular', img: 'concluido', funcao: 'vincularEmpresas()' }]

    popup({ elemento, botoes, conteudoRodape, titulo: 'Vincular clientes em massa' })
    renderizarSelecionadosVinculo()
    document.querySelector('.vinculo-campo')?.focus()
}

function campoVinculo(nome) {
    return document.querySelector(`.popup-janela-fora [data-vinculo="${nome}"]`)
}

// Busca com pausa curta entre teclas (Enter busca na hora).
function buscarVinculoMassa(termo, agora = false) {
    clearTimeout(vinculoMassa.timer)
    vinculoMassa.timer = setTimeout(() => executarBuscaVinculo(termo), agora ? 0 : 350)
}

function filtroBuscaVinculo(termo) {
    return { cadastrais: { op: 'includes', value: termo } }
}

async function executarBuscaVinculo(termo) {
    const consulta = ++vinculoMassa.consulta
    termo = String(termo || '').trim()
    const info = campoVinculo('info')

    if (!termo) {
        vinculoMassa.encontrados = []
        vinculoMassa.total = 0
        vinculoMassa.termo = ''
        if (info) info.textContent = 'Digite para buscar clientes.'
        return renderizarEncontradosVinculo()
    }

    if (info) info.textContent = 'Buscando...'
    const resposta = await pesquisarDB({ base: 'vw_2_clientes', filtros: filtroBuscaVinculo(termo), limite: LIMITE_BUSCA_VINCULO })
        .catch(() => null)
    if (consulta !== vinculoMassa.consulta) return // chegou resposta de uma busca antiga

    vinculoMassa.encontrados = resposta?.resultados || []
    vinculoMassa.total = Number(resposta?.total) || vinculoMassa.encontrados.length
    vinculoMassa.termo = termo
    renderizarEncontradosVinculo()
}

function nomeClienteVinculo(cliente) {
    return cliente?.nome || (cliente?.cadastrais || []).find(Boolean) || `Cliente ${cliente?.id}`
}

function renderizarEncontradosVinculo() {
    const lista = campoVinculo('resultados')
    const info = campoVinculo('info')
    const marcar = campoVinculo('marcar')
    if (!lista) return

    const { encontrados, total, selecionados } = vinculoMassa

    lista.innerHTML = encontrados.map(cliente => {
        const id = String(cliente.id)
        const empresa = cliente.snapshots?.empresa || ''
        return `
            <label class="vinculo-item">
                <input type="checkbox" value="${escaparAtributo(id)}" data-nome="${escaparAtributo(nomeClienteVinculo(cliente))}"
                    ${selecionados.has(id) ? 'checked' : ''} onchange="alternarClienteVinculo(this)">
                <span class="vinculo-item-texto">
                    <span>${escaparAtributo(nomeClienteVinculo(cliente))}</span>
                    ${empresa ? `<small>${escaparAtributo(empresa)}</small>` : ''}
                </span>
            </label>`
    }).join('') || (vinculoMassa.termo ? '<span class="vinculo-vazio">Nenhum cliente encontrado.</span>' : '')

    if (info && encontrados.length)
        info.textContent = total > encontrados.length
            ? `Mostrando ${encontrados.length} de ${total}`
            : `${total} encontrado${total === 1 ? '' : 's'}`
    else if (info && vinculoMassa.termo && !encontrados.length)
        info.textContent = '0 encontrados'

    if (marcar) {
        const ids = idsTodosEncontradosVinculo()
        const todosMarcados = !!ids?.length && ids.every(id => selecionados.has(id))
        marcar.hidden = !encontrados.length
        marcar.dataset.marcar = todosMarcados ? 'N' : 'S'
        marcar.textContent = todosMarcados
            ? 'Desmarcar encontrados'
            : `Marcar ${total === 1 ? 'o encontrado' : `os ${Math.min(total, LIMITE_MARCAR_VINCULO)} encontrados`}`
    }
}

function renderizarSelecionadosVinculo() {
    const lista = campoVinculo('selecionados')
    const contagem = campoVinculo('contagem')
    if (!lista) return

    const itens = [...vinculoMassa.selecionados]
    if (contagem) contagem.textContent = `Selecionados (${itens.length})`

    lista.innerHTML = itens.map(([id, nome]) => `
        <span class="vinculo-chip" title="${escaparAtributo(nome)}">
            <span>${escaparAtributo(nome)}</span>
            <button type="button" aria-label="Remover" data-id="${escaparAtributo(id)}" onclick="removerClienteVinculo(this.dataset.id)">×</button>
        </span>`).join('') || '<span class="vinculo-vazio">Nenhum cliente selecionado.</span>'

    const vincular = [...document.querySelectorAll('.popup-janela-fora .botoes-rodape span')].find(span => span.textContent.startsWith('Vincular'))
    if (vincular) vincular.textContent = itens.length ? `Vincular ${itens.length} cliente${itens.length === 1 ? '' : 's'}` : 'Vincular'
}

function alternarClienteVinculo(input) {
    if (input.checked) vinculoMassa.selecionados.set(input.value, input.dataset.nome)
    else vinculoMassa.selecionados.delete(input.value)
    renderizarSelecionadosVinculo()
    renderizarEncontradosVinculo()
}

function removerClienteVinculo(id) {
    vinculoMassa.selecionados.delete(String(id))
    renderizarSelecionadosVinculo()
    renderizarEncontradosVinculo()
}

function limparSelecaoVinculo() {
    vinculoMassa.selecionados.clear()
    renderizarSelecionadosVinculo()
    renderizarEncontradosVinculo()
}

// Ids de todos os encontrados pela busca atual: os da lista, se couberam, ou os buscados por
// completo no "Marcar todos" (a lista mostra só os 50 primeiros). null = ainda não conhecidos.
function idsTodosEncontradosVinculo() {
    const { encontrados, total, termo, todosDoTermo } = vinculoMassa
    if (total <= encontrados.length) return encontrados.map(cliente => String(cliente.id))
    return todosDoTermo?.termo === termo ? todosDoTermo.ids : null
}

// Marca todos os encontrados pela busca, inclusive além dos 50 mostrados (até LIMITE_MARCAR_VINCULO).
async function marcarEncontradosVinculo() {
    const botao = campoVinculo('marcar')
    const { encontrados, total, termo } = vinculoMassa

    if (botao?.dataset.marcar === 'N') {
        (idsTodosEncontradosVinculo() || []).forEach(id => vinculoMassa.selecionados.delete(id))
    } else {
        let todos = encontrados
        if (total > encontrados.length) {
            if (botao) botao.textContent = 'Marcando...'
            const resposta = await pesquisarDB({ base: 'vw_2_clientes', filtros: filtroBuscaVinculo(termo), limite: LIMITE_MARCAR_VINCULO })
                .catch(() => null)
            todos = resposta?.resultados || encontrados
            vinculoMassa.todosDoTermo = { termo, ids: todos.map(cliente => String(cliente.id)) }
        }
        todos.forEach(cliente => vinculoMassa.selecionados.set(String(cliente.id), nomeClienteVinculo(cliente)))
    }

    renderizarSelecionadosVinculo()
    renderizarEncontradosVinculo()
}

async function vincularEmpresas() {

    const selectEmp = campoVinculo('empresa')
    if (!selectEmp) return

    const unidades = [...vinculoMassa.selecionados].map(([id, nome]) => ({ id, nome }))

    if (!unidades.length)
        return popup({ mensagem: 'Selecione pelo menos 1 cliente.' })

    if (selectEmp.selectedIndex <= 0)
        return popup({ mensagem: 'Escolha a empresa (ou "sem empresa" para remover o vínculo).' })

    const nomeEmpresa = selectEmp.value ? selectEmp.selectedOptions[0].textContent : 'nenhuma empresa'

    overlayAguarde()

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}
        const response = await fetch(`${api}/vincular-empresas`, {
            method: "POST",
            headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ unidades, empresa: selectEmp.value })
        })

        const data = await response.json()
        if (data.mensagem || data.erro)
            return popup({ mensagem: data.mensagem || data.erro })

        vinculoMassa.selecionados.clear()

        removerPopup()
        popup({ mensagem: `${unidades.length} cliente${unidades.length === 1 ? '' : 's'} vinculado${unidades.length === 1 ? '' : 's'} a ${escaparAtributo(nomeEmpresa)}.`, imagem: 'imagens/concluido.png' })

    } catch (err) {
        return popup({ mensagem: err.message || 'Falha no vínculo das empresas' })
    }

}

function renderAppsCircle(id, apps = []) {
    const ativos = new Set(
        (Array.isArray(apps) ? apps : Object.keys(apps || {}))
            .map(v => String(v).toUpperCase().trim())
    )
    const setores = [
        { sigla: 'AC', x: 67, y: 32, caminho: 'M50 50V7a43 43 0 0 1 43 43Z' },
        { sigla: 'IAC', x: 68, y: 67, caminho: 'M50 50h43a43 43 0 0 1-43 43Z' },
        { sigla: 'HNK', x: 32, y: 68, caminho: 'M50 50v43A43 43 0 0 1 7 50Z' },
        { sigla: 'HNW', x: 32, y: 32, caminho: 'M50 50H7A43 43 0 0 1 50 7Z' }
    ]
    const resumo = setores.map(({ sigla }) => sigla + ': ' + (ativos.has(sigla) ? 'cadastrado' : 'sem cadastro')).join(' ? ')
    const fatias = setores.map(({ sigla, x, y, caminho }) => {
        const ativo = ativos.has(sigla)
        return `
            <g>
                <title>${sigla}: ${ativo ? 'Cadastrado no Omie' : 'Sem cadastro no Omie'}</title>
                <path d="${caminho}" fill="${ativo ? '#527d60' : '#e8eeea'}" stroke="#fff" stroke-width="2.5"></path>
                <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
                    font-size="11" font-weight="600" fill="${ativo ? '#fff' : '#65756b'}">${sigla}</text>
            </g>`
    }).join('')

    return `
        <button type="button" class="pizza-apps" title="${resumo}. Clique para solicitar cadastro no Omie."
            aria-label="${resumo}. Solicitar cadastro no Omie" onclick="ativarCadastro(${id})">
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <circle cx="50" cy="50" r="47" fill="#fff" stroke="#d5e2d9" stroke-width="1.5"></circle>
                ${fatias}
                <circle cx="50" cy="50" r="3" fill="#fff"></circle>
            </svg>
        </button>
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

    try {

        const pag = 'clientes'
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

        const btnExtras = `
            <div class="clientes-filtros" style="${horizontal}; gap: 1rem; padding: 3px;">
                <button type="button" class="clientes-adicionar clientes-vincular" onclick="classificarUnidades()">Vincular em massa</button>
                <button type="button" class="clientes-adicionar" onclick="formularioCliente()">Adicionar Cadastro</button>
                ${dropdownTags}
                ${dropdownEstados}
                <div style="${horizontal}; gap: 1rem;">
                    <label class="interruptor">
                        <input onchange="mostrarMapa()" type="checkbox">
                        <span class="trilho"></span>
                    </label>
                    <label style="color: white;">Mapa</label>
                </div>
            </div>
        `

        const tabela = await modTab({
            pag,
            base: 'vw_2_clientes',
            colunas: {
                'Ações': {},
                'Disp. em': {},
                'Foto': {},
                'Nome': { chave: 'cadastrais', op: 'includes' },
                'IDs': { chave: 'ids', op: 'includes' },
                'Endereço Cadastro': { chave: 'snapshots.enderecoCadastro' },
                'Comentário': { chave: 'comentario' }
            },
            funcaoAdicional: ['contarPorTagCliente'],
            body: 'bodyClientes',
            btnExtras,
            topoEmLinha: true,
            criarLinha: 'criarLinhaClienteGCS'
        })

        const mapa = criarMapa({
            apenasMapa: true,
            path: 'estado',
            pag
        })

        tela.innerHTML = `
        <div class="clientes-layout">
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Clientes, Usuários & Fornecedores</h2></div>
                ${tabela}
            </div>
            ${mapa}
        </div>`

        await paginacao(pag)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir a tabela de clientes: Fale com o cliente.' })
    }

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

function auxiliarFotoUsuario() {
    if (!acesso?.id) return
    const perfil = JSON.parse(localStorage.getItem('acesso') || '{}')
    const imagemMenu = document.querySelector('.nomeUsuario .foto-usuario-menu')
    const fotoAtual = imagemMenu?.currentSrc || imagemMenu?.src || urlFotoCliente(perfil.foto)
    popup({
        titulo: 'Trocar minha foto',
        elemento: `
            <form data-foto-cliente data-usuario="${escaparAtributo(acesso.id)}"
                onsubmit="event.preventDefault(); salvarMinhaFoto(this)"
                style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px;">
                <button type="button" class="cliente-foto-escolher" aria-label="Alterar minha foto"
                    onclick="this.form.querySelector('[name=arquivo_foto]').click()">
                <img class="moldura-foto" src="${escaparAtributo(fotoAtual)}" alt="Prévia da sua foto"
                    onerror="this.onerror = null; this.src = logo"
                    style="width: 160px; height: 160px; object-fit: cover; border-radius: 50%;">
                </button>
                <small>Clique na imagem para alterar</small>
                <input type="file" name="arquivo_foto" accept="image/*" hidden onchange="previaFotoCliente(this)">
                <span role="status" data-status-foto></span>
                <button type="submit">Salvar foto</button>
            </form>`
    })
}

async function salvarMinhaFoto(formulario) {
    const botao = formulario.querySelector('[type="submit"]')
    if (botao.disabled) return
    const status = formulario.querySelector('[data-status-foto]')
    const input = formulario.querySelector('[name="arquivo_foto"]')
    if (!input.files?.[0]?.type.startsWith('image/')) {
        status.textContent = 'Selecione uma imagem para a foto.'
        return
    }
    const id = formulario.dataset.usuario
    if (!acesso?.id || String(acesso.id) !== id) return
    botao.disabled = true
    input.disabled = true
    status.textContent = 'Salvando foto...'
    try {
        const arquivos = await importarAnexos({ input })
        const foto = arquivos?.[0]?.link
        if (!foto) throw new Error('Não foi possível enviar a imagem. Tente novamente.')
        const resposta = await enviar(`clientes/${id}/foto`, foto)
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'Não foi possível salvar a foto.')
        atualizarFotoUsuario({ id, foto })
        removerPopup(formulario.closest('.popup').id)
    } catch (erro) {
        status.textContent = erro.message || 'Não foi possível salvar a foto.'
    } finally {
        botao.disabled = false
        input.disabled = false
    }
}

function previaFotoCliente(input) {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
        input.value = ''
        return popup({ mensagem: 'Selecione uma imagem para a foto.' })
    }
    const bloco = input.closest('[data-foto-cliente]')
    const leitor = new FileReader()
    leitor.onload = () => {
        if (!bloco.isConnected || input.files?.[0] !== arquivo) return
        bloco.querySelector('img').src = leitor.result
        bloco.classList.add('tem-foto')
    }
    leitor.onerror = () => {
        input.value = ''
        popup({ mensagem: 'Não foi possível ler a imagem. Selecione novamente.' })
    }
    leitor.readAsDataURL(arquivo)
}

function removerFotoCliente(botao) {
    const bloco = botao.closest('[data-foto-cliente]')
    bloco.querySelector('[name=foto]').value = ''
    bloco.querySelector('[name=arquivo_foto]').value = ''
    bloco.querySelector('img').src = logo
    bloco.classList.remove('tem-foto')
}

async function baixarFotoCliente(botao) {
    const bloco = botao.closest('[data-foto-cliente]')
    const arquivo = bloco.querySelector('[name="arquivo_foto"]')?.files?.[0]
    const foto = bloco.querySelector('[name="foto"]')?.value
    if (!arquivo && !foto)
        return popup({ mensagem: 'Este cadastro não possui foto para baixar.' })

    let url
    try {
        let blob = arquivo
        if (!blob) {
            const resposta = await fetch(urlFotoCliente(foto))
            if (!resposta.ok) throw new Error('Falha ao baixar foto')
            blob = await resposta.blob()
        }
        url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const extensao = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' }[blob.type]
        link.download = arquivo?.name || `foto-cliente${extensao ? `.${extensao}` : ''}`
        document.body.appendChild(link)
        link.click()
        link.remove()
    } catch (erro) {
        console.error('Erro ao baixar foto do cliente:', erro)
        popup({ mensagem: 'Não foi possível baixar a foto. Tente novamente.' })
    } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
}

function urlFotoCliente(foto) {
    if (!foto) return logo
    return /^https?:\/\//i.test(foto) ? foto : `${api}/uploads/${foto}`
}

function criarLinhaClienteGCS(cliente) {

    const {
        id,
        apps,
        foto,
        nome,
        cnpj,
        email,
        tags,
        comentario,
        cadastrais,
        ids
    } = cliente || {}

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

    const tags1 = (tags || [])
        .map(item => tagCliente(item.tag))
        .join('')

    const tags2 = (ids || [])
        .filter(Boolean)
        .map(t => `<span class="fin">${t}</span>`)
        .join('')

    const tds = `
        <td>
            <img src="imagens/pesquisar.svg" onclick="formularioCliente(${id})">
        </td>

        <td>${renderAppsCircle(cnpj ? id : null, Object.keys(apps || []))}</td>
        <td><button type="button" title="Abrir cadastro" aria-label="Abrir cadastro"
            data-cliente="${escaparAtributo(id)}" onclick="formularioCliente(Number(this.dataset.cliente))"
            style="padding: 0; border: none; background: transparent; cursor: pointer;">
            <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt="" loading="lazy"
                onerror="this.onerror = null; this.src = logo">
        </button></td>

        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px;">

                <div style="${vertical}; gap: 2px;">

                    ${(cadastrais || []).map(c => `<span>${c || ''}</span>`).join('')}

                    <div style="display: flex; flex-wrap: wrap; gap: 2px;">
                        ${tags1}
                    </div>
                </div>

            </div>
        </td>
        
        <td>
            <div style="display: flex; flex-wrap: wrap; gap: 2px;">${tags2}</div>
        </td>

        <td>${eCadastro}</td>
        <td>
            <div style="white-space: pre-wrap;">${comentario || ''}</div>
        </td>
        `

    return `<tr>${tds}</tr>`

}

// Tags marcadas na lista de checkbox do formulário de clientes.
function tagsMarcadasCliente(painel) {
    return [...(painel?.querySelectorAll('[name="tags"] input[type="checkbox"]:checked') || [])]
        .map(caixa => caixa.value)
}

const MESES_ANIVERSARIO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// Maior dia de cada mês (fevereiro aceita 29; em ano não bissexto a view comemora em 28/02).
const DIAS_MES_ANIVERSARIO = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Aceita 'MM-DD' (atual) e 'AAAA-MM-DD' (se algum cadastro já tiver ano).
function campoAniversarioCliente(aniversario) {
    const [, mes = '', dia = ''] = String(aniversario || '').match(/(\d{2})-(\d{2})$/) || []
    const opcoesDia = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
        .map(d => `<option value="${d}" ${d === dia ? 'selected' : ''}>${Number(d)}</option>`).join('')
    const opcoesMes = MESES_ANIVERSARIO
        .map((nome, i) => {
            const m = String(i + 1).padStart(2, '0')
            return `<option value="${m}" ${m === mes ? 'selected' : ''}>${nome}</option>`
        }).join('')
    return `
        <div style="${horizontal}; justify-content: start; gap: 5px;">
            <select name="aniversario_dia" aria-label="Dia do aniversário"><option value="">Dia</option>${opcoesDia}</select>
            <select name="aniversario_mes" aria-label="Mês do aniversário"><option value="">Mês</option>${opcoesMes}</select>
        </div>`
}

// '' quando incompleto; lança erro se o dia não existe no mês (ex.: 31 de abril).
function valorAniversarioCliente() {
    const dia = obVal('aniversario_dia') || ''
    const mes = obVal('aniversario_mes') || ''
    if (!dia && !mes) return ''
    if (!dia || !mes) throw new Error('Preencha o dia e o mês do aniversário, ou deixe os dois em branco.')
    if (Number(dia) > DIAS_MES_ANIVERSARIO[Number(mes) - 1])
        throw new Error(`${MESES_ANIVERSARIO[Number(mes) - 1]} não tem dia ${Number(dia)}.`)
    return `${mes}-${dia}`
}

async function formularioCliente(idCliente) {

    overlayAguarde()

    const {
        matricula,
        foto,
        endereco_entrega = {},
        chave_pix,
        ddd,
        celular,
        aniversario,
        email,
        endereco,
        bairro,
        estado,
        cidade,
        cep,
        nome,
        usuario,
        permissao,
        setor,
        cargo,
        cnpj,
        comentario,
        empresa,
        tags
    } = await recuperarDado('clientes', idCliente) || {}

    // Tags em lista de checkbox: as da lista padrão e, marcadas, as antigas que não estão nela.
    const marcadas = new Set((tags || []).map(item => item.tag).filter(Boolean))
    const opcoesTags = [...new Set([...tagsClientes.filter(Boolean), ...marcadas])]
        .map(tag => `
            <label class="cliente-tag-opcao">
                <input type="checkbox" value="${escaparAtributo(tag)}" ${marcadas.has(tag) ? 'checked' : ''}
                    onchange="verificarDisponibilidade(this.closest('.painel-padrao').querySelector('[name=nome]'))">
                <span>${escaparAtributo(tag)}</span>
            </label>`)
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
            elemento: `<div data-foto-cliente class="${foto ? 'tem-foto' : ''}" style="${vertical}; align-items: center; width: 100%; gap: 8px;">
                <button type="button" class="cliente-foto-escolher" title="Clique para trocar a foto" aria-label="Escolher foto do cliente"
                    onclick="this.closest('[data-foto-cliente]').querySelector('[name=arquivo_foto]').click()">
                    <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt=""
                        onerror="if (this.src !== logo) this.src = logo; this.closest('[data-foto-cliente]').classList.remove('tem-foto')">
                </button>
                <input type="hidden" name="foto" value="${escaparAtributo(foto || '')}">
                <input type="file" name="arquivo_foto" accept="image/*" hidden onchange="previaFotoCliente(this)">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="baixarFotoCliente(this)">Baixar foto</button>
                    <button type="button" onclick="removerFotoCliente(this)">Remover foto</button>
                </div>
            </div>`
        },
        {
            texto: 'Empresa',
            elemento: `<span ${empresa ? `id="${empresa}"` : ''} name="empresa" class="opcoes" onclick="cxOpcoes('empresa')">${nomeEmpresa || 'Selecionar'}</span>`
        },
        {
            texto: 'Tags',
            elemento: `<div name="tags" class="cliente-tags-lista">${opcoesTags}</div>`
        },
        {
            texto: 'CPF/CNPJ',
            elemento: `<input placeholder="CPF ou CNPJ" oninput="formatarCnpj(this)" name="cnpj" value="${cnpj || ''}">`
        },
        {
            // Usuário fica oculto aqui (obVal e verificarDisponibilidade leem do painel);
            // o rodapé mostra o valor em balão (cliente-rodape).
            texto: 'Nome',
            elemento: `
            <textarea
            placeholder="Nome Completo"
            maxlength="60"
            ${!usuario ? `oninput="verificarDisponibilidade(this)"` : ''}
            name="nome">${nome || ''}</textarea>
            <input type="hidden" name="usuario" value="${escaparAtributo(usuario || '')}" data-form-cliente>`
        },
        { elemento: '<span class="cliente-secao">Endereço de cadastro</span>' },
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
        { elemento: '<span class="cliente-secao">Dados de contato</span>' },
        editarPermissao,
        {
            texto: 'E-mail',
            elemento: `<textarea name="email" placeholder="E-mail">${email || ''}</textarea>`
        },
        {
            texto: 'Celular',
            elemento: `
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <input name="ddd" placeholder="DDD" style="width: 40px;" value="${ddd || ''}">
                <input name="celular" placeholder="Celular" style="flex: 1;" value="${celular || ''}">
            </div>
            `
        },
        {
            // Só dia e mês, sem ano: gravado como 'MM-DD' (popup de aniversariantes).
            texto: 'Aniversário',
            elemento: campoAniversarioCliente(aniversario)
        },
        {
            texto: 'Chave Pix',
            elemento: `<textarea placeholder="Chave Pix" name="chave_pix">${chave_pix || ''}</textarea>`
        },
        {
            texto: 'Cargo',
            elemento: `<textarea name="cargo" placeholder="Cargo">${escaparAtributo(cargo || '')}</textarea>`
        },
        {
            texto: 'Setor',
            elemento: `<select name="setor">${setores.map(s => `<option ${setor == s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
        },
        {
            texto: 'Comentário',
            elemento: `<textarea placeholder="Comentário" name="comentario">${comentario || ''}</textarea>`
        },
        { elemento: '<span class="cliente-secao">Endereço de entrega</span>' },
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

    if (idCliente && usuario && ['adm', 'diretoria'].includes(permissaoUsuario))
        botoes.push({ texto: 'Senha provisória', img: 'chave', funcao: `confirmarSenhaProvisoria(${idCliente})` })

    if (idCliente && ['adm', 'diretoria'].includes(permissaoUsuario))
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirCliente(${idCliente})` })

    const titulo = idCliente
        ? 'Editar Cliente'
        : 'Criar Cliente'

    // Matrícula e usuário em balões no rodapé; o status da geração do usuário fica ao lado.
    const conteudoRodape = `
        <div class="cliente-rodape">
            <span class="cliente-balao"><small>Matrícula</small><b>${escaparAtributo(matricula || 'automático')}</b></span>
            <span class="cliente-balao"><small>Usuário</small><b id="balao_usuario">${escaparAtributo(usuario || 'automático')}</b></span>
            <div data-valido="${usuario ? 'F' : 'N'}" id="status_usuario" class="cliente-status-usuario"></div>
        </div>`

    popup({ linhas, botoes, titulo, conteudoRodape })

    // Cadastro sem usuário: já avalia ao abrir (antes só ao digitar o nome ou mexer nas tags).
    if (!usuario)
        verificarDisponibilidade([...document.querySelectorAll('.painel-padrao')].at(-1)?.querySelector('[name="nome"]'))

}

// Senha provisória: para usuário novo ou para quem perdeu o acesso. No primeiro login com ela
// a pessoa é obrigada a criar a própria senha (login.js, formularioPrimeiroAcesso).
function confirmarSenhaProvisoria(idCliente) {

    const botoes = [
        { texto: 'Gerar', img: 'chave', funcao: `gerarSenhaProvisoriaCliente(${idCliente})` }
    ]

    popup({
        mensagem: `
            Gerar uma senha provisória para este usuário?<br>
            <small>A senha atual deixa de funcionar e os aparelhos conectados saem. A provisória vale 48 horas
            e, no primeiro acesso, a pessoa cria a senha dela.</small>`,
        botoes
    })
}

async function gerarSenhaProvisoriaCliente(idCliente) {

    overlayAguarde()

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/senha-provisoria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: idCliente })
        })
        const dados = await resposta.json().catch(() => ({}))

        removerPopup()

        if (!resposta.ok || !dados.success)
            return popup({ mensagem: dados.mensagem || 'Falha ao gerar a senha provisória.' })

        const validade = new Date(dados.expiraEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        const semAcesso = !dados.permissao || ['novo', 'desativado'].includes(dados.permissao)

        const linhas = [
            { texto: 'Usuário', elemento: `<input value="${escaparAtributo(dados.usuario)}" readOnly>` },
            {
                texto: 'Senha provisória',
                elemento: `
                    <div style="${horizontal}; gap: 5px;">
                        <input value="${escaparAtributo(dados.senha)}" readOnly style="font-family: monospace; font-size: 1.1rem;">
                        <button type="button" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => this.textContent = 'Copiada')">Copiar</button>
                    </div>`
            },
            { elemento: `<small style="text-align: left;">Válida até ${validade}. Ela aparece só agora: copie e envie para a pessoa.</small>` },
            semAcesso
                ? { elemento: `<small style="text-align: left; color: #a63c3c;">A permissão deste usuário está como "${escaparAtributo(dados.permissao || 'sem permissão')}": ajuste a permissão no cadastro para ele conseguir entrar.</small>` }
                : {}
        ]

        popup({ linhas, titulo: 'Senha provisória' })

    } catch {
        removerOverlay()
        popup({ mensagem: 'Sem conexão com o servidor. Tente novamente.' })
    }
}

function normalizarTexto(texto = '') {
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function gerarUsuario(nome = '') {
    const palavrasIgnoradas = [
        'de',
        'da',
        'do',
        'das',
        'dos'
    ]

    const partesValidas = normalizarTexto(nome)
        .split(' ')
        .filter(Boolean)
        .filter(parte => {
            return !palavrasIgnoradas.includes(parte)
        })

    if (partesValidas.length < 2) {
        return {
            primeiraOpcao: null,
            segundaOpcao: null
        }
    }

    const primeiroNome = partesValidas[0]
    const segundoNome = partesValidas[1]
    const ultimoNome = partesValidas.at(-1)

    const primeiraOpcao = `${primeiroNome}_${segundoNome}`

    const segundaOpcao = primeiroNome === ultimoNome
        ? null
        : `${primeiroNome}_${ultimoNome}`

    return {
        primeiraOpcao,
        segundaOpcao
    }
}

async function verificarDisponibilidade(input) {

    const modelo = (texto, imagem) => `
        <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/${imagem}.png" style="width: 1.5rem;">
            <span>${texto}</span>
        </div>
    `
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const tagsValidas = ['FUNCIONÁRIO', 'CLIENTE', 'TÉCNICO', 'TÉCNICO PARCEIRO', 'MATRIZ']
    const tagValida = tagsMarcadasCliente(painel).some(tag => tagsValidas.includes(tag))

    const campoNome = document.querySelector('[name="nome"]')
    const campoUsuario = document.querySelector('[name="usuario"]')
    const statusUsuario = document.getElementById('status_usuario')

    // Fixo, já foi cadastrado e não deve alterar;
    if (statusUsuario.dataset.valido == 'F')
        return

    if (!tagValida) {
        statusUsuario.innerHTML = modelo('Preencha outra tag', 'alerta')
        return
    }

    const valorInformado = typeof input === 'string'
        ? input
        : input?.value

    const nomeInformado = String(
        valorInformado || campoNome?.value || ''
    )

    const nomeLimpo = nomeInformado.trim()

    const balaoUsuario = document.getElementById('balao_usuario')

    const bloquear = texto => {
        if (campoUsuario) {
            campoUsuario.value = ''
        }

        if (balaoUsuario) balaoUsuario.textContent = 'automático'

        if (statusUsuario) {
            statusUsuario.dataset.valido = 'N'
            statusUsuario.innerHTML = modelo(texto, 'cancel')
        }

        return null
    }

    const aprovar = (usuario, mensagem) => {
        if (campoUsuario) {
            campoUsuario.value = usuario
        }

        if (balaoUsuario) balaoUsuario.textContent = usuario

        if (statusUsuario) {
            statusUsuario.dataset.valido = 'S'
            statusUsuario.innerHTML = modelo(
                mensagem,
                'concluido'
            )
        }

        return usuario
    }

    if (!nomeLimpo) {
        return bloquear(
            'Informe o nome para gerar o usuário'
        )
    }

    const partesNome = normalizarTexto(nomeLimpo)
        .split(' ')
        .filter(Boolean)

    // Empresa (CNPJ): nome de uma palavra vale (ex.: SERFORTE → serforte, ou serforte_4964 se em uso).
    // Pessoa continua exigindo nome e sobrenome.
    const cnpjDigitos = String(painel.querySelector('[name="cnpj"]')?.value || '').replace(/\D/g, '')
    const empresaUmaPalavra = cnpjDigitos.length === 14 && partesNome.length === 1

    if (partesNome.length < 2 && !empresaUmaPalavra) {
        return bloquear(
            'Informe pelo menos nome e sobrenome'
        )
    }

    if (nomeLimpo.length < (empresaUmaPalavra ? 3 : 6)) {
        return bloquear(
            `Nome curto (mínimo de ${empresaUmaPalavra ? 3 : 6} caracteres)`
        )
    }

    const {
        primeiraOpcao,
        segundaOpcao
    } = empresaUmaPalavra
        ? { primeiraOpcao: partesNome[0].replace(/\s/g, ''), segundaOpcao: `${partesNome[0]}_${cnpjDigitos.slice(0, 4)}` }
        : gerarUsuario(nomeLimpo)

    if (!primeiraOpcao) {
        return bloquear(
            'Não foi possível gerar o nome de usuário'
        )
    }

    const pesquisarUsuario = async usuario => {
        const pesquisa = await pesquisarDB({
            base: 'clientes',
            filtros: {
                usuario: {
                    op: '=',
                    value: usuario
                }
            }
        })

        return Boolean(
            pesquisa?.resultados?.length
        )
    }

    const primeiraEmUso = await pesquisarUsuario(
        primeiraOpcao
    )

    if (!primeiraEmUso) {
        return aprovar(
            primeiraOpcao,
            'Usuário disponível'
        )
    }

    if (
        segundaOpcao &&
        segundaOpcao !== primeiraOpcao
    ) {
        const segundaEmUso = await pesquisarUsuario(
            segundaOpcao
        )

        if (!segundaEmUso) {
            return aprovar(
                segundaOpcao,
                'Usuário disponível (2)'
            )
        }
    }

    return bloquear(
        'Nome de usuário em uso'
    )
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

    try {

        overlayAguarde()

        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

        // FIXO ou S = SIM, é válido;
        const usuarioValido = ['S', 'F'].includes(document.getElementById('status_usuario').dataset.valido)

        let aniversario
        try { aniversario = valorAniversarioCliente() }
        catch (erro) { return popup({ mensagem: erro.message }) }

        // Verificações do CNPJ
        const cnpj = obVal('cnpj')

        if (cnpj) { // Se preencher o cnpj, vai ter que ser válido;

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

        const tags = tagsMarcadasCliente(painel).map(tag => ({ tag }))

        let foto = obVal('foto') || ''
        const arquivoFoto = painel.querySelector('[name="arquivo_foto"]')
        if (arquivoFoto?.files?.length) {
            if (!arquivoFoto.files[0].type.startsWith('image/'))
                return popup({ mensagem: 'Selecione uma imagem para a foto.' })

            const arquivos = await importarAnexos({ input: arquivoFoto })
            if (!Array.isArray(arquivos) || !arquivos[0]?.link)
                throw new Error('Não foi possível enviar a foto do cliente.')

            foto = arquivos[0].link
            painel.querySelector('[name="foto"]').value = foto
            arquivoFoto.value = ''
        }

        const novo = {
            foto,
            cnpj,
            nome: obVal('nome').toUpperCase(),
            endereco: obVal('endereco'),
            bairro: obVal('bairro'),
            cep: obVal('cep'),
            setor: obVal('setor'),
            cargo: obVal('cargo'),
            cidade: obVal('cidade'),
            estado: obVal('estado'),
            comentario: obVal('comentario'),
            chave_pix: obVal('chave_pix'),
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
            aniversario,
            email: obVal('email'),
            empresa: obVal('empresa')
        }

        // Mesclagem;
        const cliente = {
            ...idCliente ? await recuperarDado('clientes', idCliente) : {},
            ...novo
        }

        // Permissão;
        const permissao = obVal('permissao')

        // Cadastrar Omie;
        if (!idCliente && cliente.cnpj)
            cliente.cadastrar_omie = true

        if (permissao)
            cliente.permissao = permissao

        await enviar(`clientes/${idCliente || '0000'}`, cliente)

        removerPopup()

        popup({ imagem: 'imagens/concluido.png', mensagem: 'Cadastro atualizado com sucesso' })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Não foi possível salvar o cliente. Fale com o suporte.' })
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

    if (!input)
        return null

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

    // Número diferente do consultado (outro CNPJ, CPF ou apagado): sai a empresa anterior.
    const digitos = v.replace(/\D/g, '')
    if (input.dataset.cnpjConsultado && input.dataset.cnpjConsultado !== digitos) {
        input.dataset.cnpjConsultado = ''
        desfazerPreenchimentoCnpj(input)
    }

    // CNPJ completo e válido: busca na Receita uma vez por número. Só em formulários com endereço
    // (cadastro de clientes); o pedido de pagamento a parceiro usa a mesma máscara e não consulta.
    const painelCliente = input.closest('.painel-padrao') || document
    const temEndereco = painelCliente.querySelector('[name="endereco"]')
    if (temEndereco && digitos.length === 14 && validarCpfCnpj(v) && input.dataset.cnpjConsultado !== digitos) {
        input.dataset.cnpjConsultado = digitos
        preencherClientePorCnpj(input, digitos)
    }

    // CPF ou CNPJ muda a regra do usuário (empresa aceita nome de uma palavra): reavalia.
    if (temEndereco && document.getElementById('status_usuario'))
        verificarDisponibilidade(painelCliente.querySelector('[name="nome"]'))
}

// O que a consulta preencheu em cada formulário (por campo de CNPJ). Ao trocar o número, é
// desfeito onde o valor continua o mesmo (o usuário não mexeu) e a nova empresa preenche de novo.
const preenchidosPorCnpj = new WeakMap()

function desfazerPreenchimentoCnpj(input) {
    const painel = input.closest('.painel-padrao') || document
    painel.querySelector('#statusReceitaCnpj')?.remove()

    for (const [nome, valor] of Object.entries(preenchidosPorCnpj.get(input) || {})) {
        const elemento = painel.querySelector(`[name="${nome}"]`)
        if (!elemento || elemento.value !== valor) continue
        if (elemento.tagName === 'SELECT') elemento.innerHTML = ''
        else elemento.value = ''
    }
    preenchidosPorCnpj.delete(input)
}

// Preenche nome e endereço de cadastro com os dados da Receita. Só campos vazios: na edição de
// um cliente nada do que já existe é sobrescrito. Avisa se a empresa não está ativa.
async function preencherClientePorCnpj(input, cnpj) {

    const painel = input.closest('.painel-padrao') || document
    const campo = nome => painel.querySelector(`[name="${nome}"]`)
    const vazio = nome => !String(campo(nome)?.value || '').trim()
    const preenchidos = {}
    const definir = (nome, valor) => {
        if (!valor || !campo(nome) || !vazio(nome)) return
        campo(nome).value = valor
        preenchidos[nome] = campo(nome).value
    }

    let status = painel.querySelector('#statusReceitaCnpj')
    if (!status) {
        status = document.createElement('div')
        status.id = 'statusReceitaCnpj'
        status.className = 'cnpj-receita'
        input.insertAdjacentElement('afterend', status)
    }
    status.className = 'cnpj-receita'
    status.textContent = 'Consultando CNPJ na Receita...'

    // Minha Receita (fonte dos dados) e, se falhar, a BrasilAPI (mesmos campos). 404/400 = não existe.
    const fontes = [`https://minhareceita.org/${cnpj}`, `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`]
    let dados
    let consultou = false
    for (const url of fontes) {
        try {
            const resposta = await fetch(url, { signal: AbortSignal.timeout(8000) })
            if (resposta.ok) { dados = await resposta.json(); consultou = true; break }
            if ([400, 404].includes(resposta.status)) { consultou = true; break }
            throw new Error(`HTTP ${resposta.status}`)
        } catch (erro) {
            console.warn('Consulta de CNPJ falhou em', url, erro)
        }
    }

    // O usuário trocou o número enquanto a consulta rodava: a resposta é descartada.
    if (input.value.replace(/\D/g, '') !== cnpj) return

    if (!consultou) {
        input.dataset.cnpjConsultado = '' // tenta de novo na próxima digitação
        status.className = 'cnpj-receita alerta'
        status.textContent = 'Não foi possível consultar a Receita agora. Preencha manualmente.'
        return
    }

    if (!dados) {
        status.className = 'cnpj-receita alerta'
        status.textContent = 'CNPJ não encontrado na Receita.'
        return
    }

    const situacao = dados.descricao_situacao_cadastral || ''
    const ativa = situacao.toUpperCase() === 'ATIVA'
    status.className = `cnpj-receita ${ativa ? 'ok' : 'erro'}`
    status.textContent = `${dados.razao_social || ''} · ${situacao || 'situação desconhecida'}`
    status.title = ativa ? 'Dados da Receita Federal' : 'Empresa não está ativa na Receita Federal: confira antes de cadastrar.'

    const nome = (dados.razao_social || dados.nome_fantasia || '').toUpperCase().slice(0, 60)
    const logradouro = [dados.descricao_tipo_de_logradouro, dados.logradouro].filter(Boolean).join(' ')
    const endereco = [logradouro, dados.numero, dados.complemento].filter(Boolean).join(', ').toUpperCase().slice(0, 60)
    const cep = String(dados.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')

    definir('nome', nome)
    definir('endereco', endereco)
    definir('bairro', (dados.bairro || '').toUpperCase())
    definir('cep', cep)
    definir('email', (dados.email || '').toLowerCase())

    // Estado e cidade: só se a cidade ainda não foi escolhida. A lista vem do IBGE (com acento);
    // a Receita manda sem acento, então compara sem acentos.
    if (dados.uf && vazio('cidade') && campo('estado') && campo('cidade')) {
        campo('estado').value = dados.uf
        await datalistCidades(dados.uf, 'cidade')
        const semAcento = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
        const opcao = [...campo('cidade').options].find(o => semAcento(o.value) === semAcento(dados.municipio))
        if (opcao) campo('cidade').value = opcao.value
        else if (dados.municipio) campo('cidade').innerHTML = `<option>${escaparAtributo(dados.municipio)}</option>`
        preenchidos.cidade = campo('cidade').value
    }

    preenchidosPorCnpj.set(input, preenchidos)
}
