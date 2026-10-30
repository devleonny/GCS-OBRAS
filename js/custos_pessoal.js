// Custos de Pessoal: custo mensal por pessoa (Omie + lançamentos manuais) distribuído
// pelos dias em cada obra. Só adm, diretoria e fin. Cálculo: gcs/SCRIPTS/custos_pessoal.js.
// pendentesAbertos: a lista "Dias úteis sem obra" começa recolhida e só abre no clique.
const estadoCustosPessoal = { mes: null, dados: null, abertos: new Set(), pendentesAbertos: false }
const ITENS_SUGERIDOS_CUSTOS = ['Alimentação', 'Café', 'Janta', 'Ajuda de custo', 'Ajuste']

function mesAtualCustos(deslocamento = 0) {
    const hoje = new Date()
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1)
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMesCustos(mes) {
    const [ano, numero] = String(mes).split('-').map(Number)
    const nome = new Date(ano, numero - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return nome.charAt(0).toUpperCase() + nome.slice(1)
}

function mesCurtoCustos(mes) {
    const [ano, numero] = String(mes).split('-')
    return `${numero}/${ano}`
}

async function chamarCustosPessoal(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/custos-pessoal/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok)
        throw new Error(dados.mensagem || `Falha (${resposta.status})`)
    return dados
}

async function telaCustosPessoal() {

    if (!['adm', 'diretoria', 'fin'].includes(acesso?.permissao))
        return popup({ mensagem: 'Acesso restrito a administração, diretoria e financeiro.' })

    // Salário pago em outubro é de setembro: começa no mês anterior.
    estadoCustosPessoal.mes ??= mesAtualCustos(-1)

    tela.innerHTML = `
        <div class="tela-custos-pessoal">
            <div class="custos-cabecalho">
                <div>
                    <h2>Custos de Pessoal</h2>
                    <small>(valor do mês ÷ dias úteis) × dias em cada obra. O relatório de custos mostra só o total por obra, sem nomes.</small>
                </div>
                <div class="custos-navegacao">
                    <button type="button" class="custos-seta" onclick="mudarMesCustos(-1)" aria-label="Mês anterior">‹</button>
                    <input type="month" name="mesCustos" value="${estadoCustosPessoal.mes}" onchange="irParaMesCustos(this.value)">
                    <button type="button" class="custos-seta" onclick="mudarMesCustos(1)" aria-label="Próximo mês">›</button>
                    <button type="button" class="custos-secundario" onclick="configurarCategoriasCustos()">Categorias do Omie</button>
                </div>
            </div>
            <div class="custos-conteudo"></div>
        </div>
    `

    await carregarCustosPessoal()
}

function mudarMesCustos(passo) {
    const [ano, numero] = estadoCustosPessoal.mes.split('-').map(Number)
    const data = new Date(ano, numero - 1 + passo, 1)
    irParaMesCustos(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`)
}

function irParaMesCustos(mes) {
    if (!/^\d{4}-\d{2}$/.test(mes || '')) return
    estadoCustosPessoal.mes = mes
    const campo = document.querySelector('[name="mesCustos"]')
    if (campo) campo.value = mes
    carregarCustosPessoal()
}

async function carregarCustosPessoal(dados = null) {
    const local = document.querySelector('.custos-conteudo')
    if (!local) return

    if (!dados) {
        local.innerHTML = `<div class="custos-vazio"><img src="gifs/loading-gcs.gif" alt=""></div>`
        try {
            dados = await chamarCustosPessoal('mes', { mes: estadoCustosPessoal.mes })
        } catch (erro) {
            local.innerHTML = `<div class="custos-vazio">${escaparAtributo(erro.message)}</div>`
            return
        }
    }

    estadoCustosPessoal.dados = dados
    renderizarCustosPessoal()
}

function chipItemCustos(pessoa, item) {
    const valor = dinheiro(item.valor)
    if (item.origem === 'omie')
        return `<span class="custos-chip omie" title="Vem do título do Omie">${escaparAtributo(item.item)} ${valor}<small>Omie · ${escaparAtributo(item.app)}</small></span>`

    const origem = {
        herdado: `desde ${mesCurtoCustos(item.desde)}`,
        manual: 'neste mês',
        avulso: 'só neste mês'
    }[item.origem]

    const dadosItem = escaparAtributo(JSON.stringify({ clienteId: pessoa.clienteId, nome: pessoa.nome, item: item.item, valor: item.valor, origem: item.origem }))
    return `<button type="button" class="custos-chip ${item.origem}" data-item="${dadosItem}" onclick="editarItemCustos(this.dataset.item)" title="Clique para alterar">
        ${escaparAtributo(item.item)} ${valor}<small>${origem}</small></button>`
}

function renderizarCustosPessoal() {
    const local = document.querySelector('.custos-conteudo')
    const { pessoas = [], diasUteis = 0, titulosSemPessoa = [], categorias = [] } = estadoCustosPessoal.dados || {}

    const soma = campo => pessoas.reduce((s, p) => s + Math.round(p[campo] * 100), 0) / 100
    const total = soma('total')
    const naoDistribuido = soma('naoDistribuido')
    const distribuido = Math.round((total - naoDistribuido) * 100) / 100
    const percentual = total ? Math.round(naoDistribuido / total * 1000) / 10 : 0

    const cards = `
        <div class="custos-cards">
            <div class="custos-card"><span>Custo de pessoal</span><b>${dinheiro(total)}</b><small>${pessoas.length} pessoa(s) · ${diasUteis} dias úteis</small></div>
            <div class="custos-card"><span>Distribuído nas obras</span><b>${dinheiro(distribuido)}</b></div>
            <div class="custos-card ${naoDistribuido > 0 ? 'alerta' : ''}"><span>Não distribuído</span><b>${dinheiro(naoDistribuido)}</b><small>${String(percentual).replace('.', ',')}% do total</small></div>
        </div>`

    // Quem mais ficou sem obra primeiro: é a lista para cobrar o preenchimento das correções.
    const pendentes = pessoas.filter(p => p.naoDistribuido > 0).sort((a, b) => b.naoDistribuido - a.naoDistribuido)
    const blocoPendentes = pendentes.length ? `
        <details class="custos-pendentes" ${estadoCustosPessoal.pendentesAbertos ? 'open' : ''}
            ontoggle="estadoCustosPessoal.pendentesAbertos = this.open">
            <summary>Dias úteis sem obra nas correções (${pendentes.length})</summary>
            <p>Esses valores não chegam a nenhum centro de custo. Peça para incluírem o técnico nas correções dos chamados.</p>
            <div class="custos-pendentes-lista">
                ${pendentes.map(p => `
                    <div><b>${escaparAtributo(p.nome)}</b>
                        <span>${String(p.diasSemObra).replace('.', ',')} de ${diasUteis} dias</span>
                        <span>${dinheiro(p.naoDistribuido)}</span>
                        ${p.aviso ? `<small>${escaparAtributo(p.aviso)}</small>` : ''}
                    </div>`).join('')}
            </div>
        </details>` : ''

    const avisoTitulos = titulosSemPessoa.length ? `
        <div class="custos-aviso">
            ${titulosSemPessoa.length} título(s) do Omie dessas categorias sem recebedor identificado
            (${dinheiro(titulosSemPessoa.reduce((s, t) => s + t.valor, 0))}): ficam fora do cálculo.
        </div>` : ''

    const avisoCategorias = !categorias.length ? `
        <div class="custos-aviso">Nenhuma categoria do Omie configurada: só os lançamentos manuais entram. Use "Categorias do Omie".</div>` : ''

    const linhas = pessoas.map(p => {
        const aberto = estadoCustosPessoal.abertos.has(p.clienteId)
        const detalhe = aberto ? `
            <tr class="custos-detalhe"><td colspan="6">
                ${p.porObra.length ? p.porObra.map(o => `
                    <div class="custos-obra">
                        <span>${escaparAtributo(o.contrato)}</span>
                        <small>${String(o.dias).replace('.', ',')} d × ${dinheiro(p.coeficiente)}</small>
                        <b>${dinheiro(o.valor)}</b>
                    </div>`).join('') : '<small>Nenhuma obra no mês.</small>'}
                ${p.naoDistribuido > 0 ? `<div class="custos-obra sem-obra"><span>Não distribuído</span><small>${String(p.diasSemObra).replace('.', ',')} d</small><b>${dinheiro(p.naoDistribuido)}</b></div>` : ''}
            </td></tr>` : ''

        return `
            <tr>
                <td>
                    <button type="button" class="custos-expandir" onclick="alternarPessoaCustos('${escaparAtributo(p.clienteId)}')" aria-expanded="${aberto}">${aberto ? '▾' : '▸'}</button>
                    <b>${escaparAtributo(p.nome)}</b>
                    ${p.usuario ? `<br><small>${escaparAtributo(p.usuario)}</small>` : ''}
                </td>
                <td>
                    <div class="custos-itens">
                        ${p.itens.map(item => chipItemCustos(p, item)).join('')}
                        <button type="button" class="custos-chip novo" onclick="novoItemCustos('${escaparAtributo(p.clienteId)}', this.dataset.nome)" data-nome="${escaparAtributo(p.nome)}">+ item</button>
                    </div>
                </td>
                <td class="custos-num">${dinheiro(p.total)}</td>
                <td class="custos-num">${dinheiro(p.coeficiente)}</td>
                <td class="custos-num">${String(p.diasDistribuidos).replace('.', ',')}</td>
                <td class="custos-num ${p.naoDistribuido > 0 ? 'custos-alerta' : ''}">${p.naoDistribuido > 0 ? dinheiro(p.naoDistribuido) : '—'}</td>
            </tr>
            ${detalhe}`
    }).join('')

    local.innerHTML = `
        ${cards}
        ${avisoCategorias}
        ${avisoTitulos}
        ${blocoPendentes}
        <div class="custos-tabela-wrap">
            <table class="tabela custos-tabela">
                <thead>
                    <tr>
                        <th>Pessoa</th>
                        <th>Itens do mês</th>
                        <th>Total</th>
                        <th>R$/dia útil</th>
                        <th>Dias em obras</th>
                        <th>Não distribuído</th>
                    </tr>
                </thead>
                <tbody>${linhas || '<tr><td colspan="6"><div class="custos-vazio">Nenhum custo de pessoal neste mês.</div></td></tr>'}</tbody>
            </table>
        </div>
        <div class="custos-rodape">
            <button type="button" onclick="novoItemCustos()">+ Adicionar pessoa</button>
        </div>
    `
}

function alternarPessoaCustos(clienteId) {
    const abertos = estadoCustosPessoal.abertos
    abertos.has(clienteId) ? abertos.delete(clienteId) : abertos.add(clienteId)
    renderizarCustosPessoal()
}

// Formulário de item manual. Sem clienteId: escolhe a pessoa (adicionar pessoa).
function formularioItemCustos({ clienteId = null, nome = '', item = '', valor = '', origem = null } = {}) {
    const editando = Boolean(item) && origem !== null
    const mes = rotuloMesCustos(estadoCustosPessoal.mes)

    controlesCxOpcoes.pessoaCustos = {
        base: 'clientes',
        retornar: ['nome'],
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        colunas: {
            'Nome': { chave: 'nome' },
            'Usuário': { chave: 'usuario' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        {
            texto: 'Pessoa',
            elemento: clienteId
                ? `<span name="pessoaCustos" id="${escaparAtributo(clienteId)}"><b>${escaparAtributo(nome)}</b></span>`
                : `<span class="opcoes" name="pessoaCustos" onclick="cxOpcoes('pessoaCustos')">Selecione</span>`
        },
        {
            texto: 'Item',
            elemento: `<input name="itemCustos" list="itensCustosSugeridos" value="${escaparAtributo(item)}" ${editando ? 'readonly' : ''} placeholder="Ex.: Alimentação">
                <datalist id="itensCustosSugeridos">${ITENS_SUGERIDOS_CUSTOS.map(i => `<option value="${i}">`).join('')}</datalist>`
        },
        {
            texto: 'Valor (R$)',
            elemento: `<input name="valorCustos" type="number" step="0.01" value="${valor === '' ? '' : Number(valor)}">`
        },
        {
            texto: 'Vale',
            elemento: `
                <div style="${vertical}; gap: 4px; align-items: start;">
                    <label><input type="radio" name="vigenciaCustos" value="recorrente" ${origem !== 'avulso' ? 'checked' : ''}> De ${mes} em diante</label>
                    <label><input type="radio" name="vigenciaCustos" value="avulso" ${origem === 'avulso' ? 'checked' : ''}> Só em ${mes} (avulso)</label>
                </div>`
        }
    ]

    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarItemCustos()' }]

    if (editando) {
        botoes.push({ texto: `Encerrar a partir de ${mes}`, img: 'cancel', funcao: 'encerrarItemCustos()' })
        if (origem !== 'herdado')
            botoes.push({ texto: 'Desfazer lançamento deste mês', img: 'reagendar', funcao: 'desfazerItemCustos()' })
    }

    popup({ linhas, botoes, titulo: editando ? `${item} · ${mes}` : `Novo item · ${mes}` })
}

function novoItemCustos(clienteId = null, nome = '') {
    formularioItemCustos({ clienteId, nome })
}

function editarItemCustos(dados) {
    try {
        formularioItemCustos(JSON.parse(dados))
    } catch {
        popup({ mensagem: 'Não foi possível abrir o item.' })
    }
}

function camposItemCustos() {
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    return {
        clienteId: painel?.querySelector('[name="pessoaCustos"]')?.id || '',
        item: painel?.querySelector('[name="itemCustos"]')?.value.trim() || '',
        valor: painel?.querySelector('[name="valorCustos"]')?.value ?? '',
        avulso: painel?.querySelector('[name="vigenciaCustos"]:checked')?.value === 'avulso'
    }
}

async function enviarItemCustos(corpo) {
    overlayAguarde()
    try {
        const dados = await chamarCustosPessoal('salvar', { ...corpo, mes: estadoCustosPessoal.mes })
        removerTodosPopups()
        await carregarCustosPessoal(dados)
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

function salvarItemCustos() {
    const campos = camposItemCustos()
    if (!campos.clienteId)
        return popup({ mensagem: 'Escolha a pessoa.' })
    if (!campos.item)
        return popup({ mensagem: 'Informe o item (ex.: Alimentação).' })
    if (campos.valor === '' || !Number.isFinite(Number(campos.valor)))
        return popup({ mensagem: 'Informe o valor.' })
    enviarItemCustos(campos)
}

// Valor 0 recorrente: o item deixa de valer deste mês em diante.
function encerrarItemCustos() {
    const { clienteId, item } = camposItemCustos()
    enviarItemCustos({ clienteId, item, valor: 0, avulso: false })
}

// Apaga o lançamento deste mês: o item volta a herdar o valor anterior (se houver).
function desfazerItemCustos() {
    const { clienteId, item } = camposItemCustos()
    enviarItemCustos({ clienteId, item, valor: null })
}

async function configurarCategoriasCustos() {
    overlayAguarde()
    let dados
    try {
        dados = await chamarCustosPessoal('categorias')
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }

    estadoCustosPessoal.categoriasDisponiveis = dados.disponiveis || []
    const linhas = [
        {
            elemento: `<small style="text-align: left;">Títulos do Omie destas categorias <b>sem departamento</b> entram no custo de pessoal (os com departamento já estão no centro de custo).</small>`
        },
        {
            elemento: `<div class="custos-config-lista">${(dados.configuradas || []).map(linhaCategoriaCustos).join('')}</div>`
        },
        {
            elemento: `<button type="button" onclick="adicionarCategoriaCustos()">+ Categoria</button>`
        }
    ]

    removerOverlay()
    popup({ linhas, botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarCategoriasCustos()' }], titulo: 'Categorias do Omie' })
}

function linhaCategoriaCustos({ categoria = '', item = '', deslocamento = 0 } = {}) {
    const opcoes = ['', ...estadoCustosPessoal.categoriasDisponiveis]
        .map(c => `<option value="${escaparAtributo(c)}" ${c === categoria ? 'selected' : ''}>${escaparAtributo(c || 'Escolha a categoria')}</option>`)
        .join('')
    return `
        <div class="custos-config-linha">
            <select name="categoriaConfig">${opcoes}</select>
            <input name="itemConfig" placeholder="Nome (ex.: Salário)" value="${escaparAtributo(item)}">
            <select name="deslocamentoConfig">
                <option value="-1" ${Number(deslocamento) === -1 ? 'selected' : ''}>Competência: mês anterior ao vencimento</option>
                <option value="0" ${Number(deslocamento) === 0 ? 'selected' : ''}>Competência: mês do vencimento</option>
            </select>
            <button type="button" class="custos-remover" onclick="this.closest('.custos-config-linha').remove()" aria-label="Remover">×</button>
        </div>`
}

function adicionarCategoriaCustos() {
    document.querySelector('.custos-config-lista')?.insertAdjacentHTML('beforeend', linhaCategoriaCustos())
}

async function salvarCategoriasCustos() {
    const categorias = [...document.querySelectorAll('.custos-config-linha')].map(linha => ({
        categoria: linha.querySelector('[name="categoriaConfig"]').value,
        item: linha.querySelector('[name="itemConfig"]').value.trim(),
        deslocamento: Number(linha.querySelector('[name="deslocamentoConfig"]').value)
    })).filter(c => c.categoria && c.item)

    overlayAguarde()
    try {
        await chamarCustosPessoal('categorias', { categorias })
        removerTodosPopups()
        await carregarCustosPessoal()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}
