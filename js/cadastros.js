// "campos": colunas extras da base além do nome (usadas pela garantia dos chamados).
const basesCadastro = {
    // Empresa (rede/grupo de clientes): foto que aparece nos clientes vinculados sem foto própria e
    // condição de pagamento que pré-preenche o pedido (js/condicao_pagamento.js).
    empresas: { titulo: 'Empresas', singular: 'Empresa', completo: true },
    tipos: { titulo: 'Tipos', singular: 'Tipo' },
    sistemas: { titulo: 'Sistemas', singular: 'Sistema' },
    prioridades: { titulo: 'Prioridades', singular: 'Prioridade' },
    correcoes: {
        titulo: 'Correções', singular: 'Correção',
        campos: [
            { chave: 'fora_garantia', texto: 'Permitido fora da garantia', tipo: 'simNao' },
            // Status automático do sistema (FATURADO da nota, logística...) entra no histórico do chamado,
            // mas não troca este status da aba: só uma correção lançada por pessoa (SCRIPTS/snapshots.js).
            { chave: 'nao_sobrepor', texto: 'Não sobreposto por status automático', tipo: 'simNao' }
        ]
    }
    // Transportadoras saiu daqui (16/11/2026): a tabela não era usada; as transportadoras da NF-e e da
    // separação são os clientes com a tag TRANSPORTADORA.
}

function valorCampoCadastro(campo, dados) {
    const valor = dados?.[campo.chave]
    if (campo.tipo === 'simNao') return valor === 'S' ? 'Sim' : 'Não'
    return valor ?? `${campo.padrao} (padrão)`
}

async function telaCadastros() {

    const bases = Object.keys(basesCadastro)

    const abas = bases
        .map(b => `
            <button type="button" class="cadastros-aba" data-base="${b}" onclick="abrirTabelaCadastrastro('${b}')">
                ${basesCadastro[b].titulo}
            </button>`)
        .join('')

    tela.innerHTML = `
        <div class="tela-cadastros">
            <div class="cadastros-cabecalho">
                <div class="cadastros-titulo">
                    <span>Categorias de Formulário</span>
                    <small>Listas de opções usadas nos formulários do sistema</small>
                </div>
                <button type="button" class="cadastros-novo" onclick="editarBaseAuxiliar(document.querySelector('.cadastros-aba.ativa')?.dataset.base)">
                    <b>+</b>
                    <span>Adicionar</span>
                </button>
            </div>
            <div class="cadastros-abas" role="tablist">
                ${abas}
            </div>
            <div class="cadastros-painel"></div>
        </div>
    `

    await abrirTabelaCadastrastro(bases[0])

}

async function abrirTabelaCadastrastro(base) {

    const local = document.querySelector('.cadastros-painel')
    if (!local)
        return

    for (const aba of document.querySelectorAll('.cadastros-aba')) {
        const ativa = aba.dataset.base === base
        aba.classList.toggle('ativa', ativa)
        aba.setAttribute('aria-selected', ativa)
    }

    const novo = document.querySelector('.cadastros-novo span')
    if (novo)
        novo.textContent = `Adicionar ${basesCadastro[base]?.singular || ''}`.trim()

    local.innerHTML = `<div class="cadastros-carregando"><img src="gifs/loading-gcs.png"></div>`

    const pag = `cad_${base}`
    const tabela = await modTab({
        pag,
        base,
        ordenar: {
            path: 'nome',
            direcao: 'asc'
        },
        colunas: {
            ...(basesCadastro[base]?.completo ? { 'Foto': {} } : {}),
            'Nome': { chave: 'nome' },
            ...(basesCadastro[base]?.completo ? { 'Faturamento': {}, 'Condição de pagamento': {} } : {}),
            ...Object.fromEntries((basesCadastro[base]?.campos || []).map(c => [c.texto, { chave: c.chave }])),
            '': {}
        },
        body: `cad_${base}`,
        criarLinha: 'criarLinhaCadastro'
    })

    local.innerHTML = tabela

    await paginacao(pag)

}

async function criarLinhaCadastro(dados) {

    const { id, base, nome } = dados || {}
    const extras = (basesCadastro[base]?.campos || [])
        .map(campo => `<td>${valorCampoCadastro(campo, dados)}</td>`)
        .join('')
    const completo = basesCadastro[base]?.completo

    const tds = `
        ${completo ? `<td>${dados.foto ? `<img class="cad-empresa-foto" src="${escaparAtributo(urlFotoCliente(dados.foto))}" alt="" loading="lazy" onerror="this.remove()">` : ''}</td>` : ''}
        <td>${nome}</td>
        ${completo ? `<td>${escaparAtributo([codigoEmpresaFat(dados.empresa_faturamento), dados.limite_faturamento_dia ? `limite dia ${dados.limite_faturamento_dia}` : ''].filter(Boolean).join(' · ') || '—')}</td>` : ''}
        ${completo ? `<td>${escaparAtributo(resumoCondicaoPag(normalizarCondicaoPag(dados.condicao_pagamento)) || '—')}</td>` : ''}
        ${extras}
        <td class="cadastros-acao">
            <img src="imagens/pesquisar.svg" title="Editar" onclick="editarBaseAuxiliar('${base}', '${id}')">
        </td>
    `

    return `<tr>${tds}</tr>`
}

async function editarBaseAuxiliar(nomeBase, id) {

    if (!nomeBase)
        return

    const dados = await recuperarDado(nomeBase, id)
    const funcao = id
        ? `salvarNomeAuxiliar('${nomeBase}', '${id}')`
        : `salvarNomeAuxiliar('${nomeBase}')`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirItemTabela('${nomeBase}', '${id}')` })

    const { singular = nomeBase, campos = [], completo } = basesCadastro[nomeBase] || {}

    const linhas = [
        ...(completo ? [{
            texto: 'Foto',
            elemento: `<div class="cad-empresa-foto-bloco" data-foto-empresa-cad>
                <img src="${escaparAtributo(urlFotoCliente(dados?.foto))}" alt="" title="Clique para escolher a foto"
                    onclick="this.parentElement.querySelector('[name=arquivo_foto]').click()" onerror="this.onerror = null; this.src = logo">
                <input type="hidden" name="foto" value="${escaparAtributo(dados?.foto || '')}">
                <input type="file" name="arquivo_foto" accept="image/*" hidden onchange="previaFotoEmpresaCad(this)">
                <div style="${vertical}; gap: 4px;">
                    <button type="button" onclick="this.closest('[data-foto-empresa-cad]').querySelector('[name=arquivo_foto]').click()">Escolher foto</button>
                    <button type="button" onclick="removerFotoEmpresaCad(this)">Remover foto</button>
                    <small style="color: #6b7a71;">Aparece em todos os clientes desta empresa que não têm foto própria.</small>
                </div>
            </div>`
        }] : []),
        {
            texto: 'Nome',
            elemento: `<textarea name="nome" style="text-transform: uppercase;" placeholder="${singular}">${dados?.nome || ''}</textarea>`
        },
        ...campos.map(campo => ({
            texto: campo.texto,
            elemento: campo.tipo === 'simNao'
                ? `<input name="${campo.chave}" type="checkbox" style="width: 2rem; height: 2rem;" ${dados?.[campo.chave] === 'S' ? 'checked' : ''}>`
                : `<input name="${campo.chave}" type="number" min="1" max="120" step="1" placeholder="${campo.padrao} (padrão)" value="${dados?.[campo.chave] ?? ''}">`
        })),
        ...(completo ? [{
            texto: 'Empresa de faturamento',
            elemento: `<select name="empresa_faturamento">
                <option value="">Selecione</option>
                ${EMPRESAS_FATURAMENTO.map(([v, t]) => `<option value="${v}" ${dados?.empresa_faturamento === v ? 'selected' : ''}>${t}</option>`).join('')}
            </select>`
        }, {
            texto: 'Limite de faturamento (dia)',
            elemento: `<div style="${vertical}; gap: 2px; width: 100%;">
                <input name="limite_faturamento_dia" type="number" min="1" max="31" step="1" inputmode="numeric" placeholder="Ex.: 25"
                    value="${escaparAtributo(dados?.limite_faturamento_dia ?? '')}"
                    oninput="this.nextElementSibling.textContent = textoLimiteFaturamento(this.value)">
                <small style="color: #6b7a71;">${escaparAtributo(textoLimiteFaturamento(dados?.limite_faturamento_dia))}</small>
            </div>`
        }, {
            texto: 'Condição de pagamento',
            elemento: `<div style="${vertical}; gap: 4px; width: 100%;">
                <label style="display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="tem_condicao" ${dados?.condicao_pagamento ? 'checked' : ''}
                    onchange="this.closest('div').querySelector('[data-condicao-pag]').hidden = !this.checked" style="width: 1.2rem; height: 1.2rem;"> Definir condição padrão</label>
                ${htmlCondicaoPag(dados?.condicao_pagamento)}
                <small style="color: #6b7a71;">Preenche sozinha o pedido dos clientes desta empresa; do pedido vai para a nota e para as faturas a receber.</small>
            </div>`
        }] : [])
    ]

    popup({ linhas, botoes, titulo: id ? `Editar ${singular}` : `Adicionar ${singular}` })
    if (completo) {
        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
        iniciarCondicoesPag(painel)
        const bloco = painel?.querySelector('[data-condicao-pag]')
        if (bloco) bloco.hidden = !dados?.condicao_pagamento
    }

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

function previaFotoEmpresaCad(input) {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
        input.value = ''
        return popup({ mensagem: 'Selecione uma imagem para a foto.' })
    }
    const leitor = new FileReader()
    leitor.onload = () => { input.closest('[data-foto-empresa-cad]').querySelector('img').src = leitor.result }
    leitor.readAsDataURL(arquivo)
}

function removerFotoEmpresaCad(botao) {
    const bloco = botao.closest('[data-foto-empresa-cad]')
    bloco.querySelector('[name="foto"]').value = ''
    bloco.querySelector('[name="arquivo_foto"]').value = ''
    bloco.querySelector('img').src = logo
}

async function salvarNomeAuxiliar(nomeBase, id = crypto.randomUUID()) {

    overlayAguarde()

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const nome = String(painel.querySelector('[name="nome"]').value).toUpperCase()

    // Campos extras: vazio em "meses" volta ao padrão; caixa de seleção vira S/N.
    const extras = []
    for (const campo of basesCadastro[nomeBase]?.campos || []) {
        const input = painel.querySelector(`[name="${campo.chave}"]`)
        if (campo.tipo === 'simNao') {
            extras.push([campo.chave, input.checked ? 'S' : 'N'])
            continue
        }
        const meses = input.value === '' ? null : Number(input.value)
        if (meses !== null && !(Number.isInteger(meses) && meses >= 1 && meses <= 120))
            return popup({ mensagem: `${campo.texto}: informe um número inteiro de 1 a 120, ou deixe vazio para ${campo.padrao}.` })
        extras.push([campo.chave, meses])
    }

    // Empresa: foto (envia o arquivo escolhido) e condição de pagamento (desmarcada = sem condição).
    if (basesCadastro[nomeBase]?.completo) {
        const marcada = painel.querySelector('[name="tem_condicao"]')?.checked
        const { condicao, erros } = marcada ? lerCondicaoPag(painel.querySelector('[data-condicao-pag]')) : { condicao: null, erros: [] }
        if (erros.length) return popup({ mensagem: `Condição de pagamento: ${erros[0]}` })
        let foto = painel.querySelector('[name="foto"]').value || ''
        const arquivo = painel.querySelector('[name="arquivo_foto"]')
        if (arquivo?.files?.length) {
            const enviados = await importarAnexos({ input: arquivo })
            if (!Array.isArray(enviados) || !enviados[0]?.link) return popup({ mensagem: 'Não foi possível enviar a foto.' })
            foto = enviados[0].link
            painel.querySelector('[name="foto"]').value = foto
            arquivo.value = ''
        }
        const limiteTexto = painel.querySelector('[name="limite_faturamento_dia"]').value
        const limite = limiteTexto === '' ? null : Number(limiteTexto)
        if (limite !== null && !(Number.isInteger(limite) && limite >= 1 && limite <= 31))
            return popup({ mensagem: 'Limite de faturamento: informe um dia de 1 a 31, ou deixe vazio.' })
        extras.push(['foto', foto || null], ['condicao_pagamento', condicao],
            ['empresa_faturamento', painel.querySelector('[name="empresa_faturamento"]').value || null],
            ['limite_faturamento_dia', limite])
    }

    for (const [caminho, valor] of [['nome', nome], ...extras]) {
        const resposta = await enviar(`${nomeBase}/${id}/${caminho}`, valor)
        if (!resposta?.success)
            return popup({ mensagem: `Não foi possível salvar: ${resposta?.mensagem || 'sem resposta do servidor'}.` })
    }

    removerPopup()

    // Foto da empresa: a lista de clientes aberta troca os avatares sem esperar o aviso do websocket.
    if (basesCadastro[nomeBase]?.completo && typeof atualizarFotosEmpresasCliente === 'function')
        atualizarFotosEmpresasCliente()

}
