// "campos": colunas extras da base além do nome (usadas pela garantia dos chamados).
const basesCadastro = {
    empresas: { titulo: 'Empresas', singular: 'Empresa' },
    tipos: { titulo: 'Tipos', singular: 'Tipo' },
    sistemas: { titulo: 'Sistemas', singular: 'Sistema' },
    prioridades: { titulo: 'Prioridades', singular: 'Prioridade' },
    correcoes: {
        titulo: 'Correções', singular: 'Correção',
        campos: [{ chave: 'fora_garantia', texto: 'Permitido fora da garantia', tipo: 'simNao' }]
    },
    transportadoras: { titulo: 'Transportadoras', singular: 'Transportadora' }
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
            'Nome': { chave: 'nome' },
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

    const tds = `
        <td>${nome}</td>
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

    const { singular = nomeBase, campos = [] } = basesCadastro[nomeBase] || {}

    const linhas = [
        {
            texto: 'Nome',
            elemento: `<textarea name="nome" style="text-transform: uppercase;" placeholder="${singular}">${dados?.nome || ''}</textarea>`
        },
        ...campos.map(campo => ({
            texto: campo.texto,
            elemento: campo.tipo === 'simNao'
                ? `<input name="${campo.chave}" type="checkbox" style="width: 2rem; height: 2rem;" ${dados?.[campo.chave] === 'S' ? 'checked' : ''}>`
                : `<input name="${campo.chave}" type="number" min="1" max="120" step="1" placeholder="${campo.padrao} (padrão)" value="${dados?.[campo.chave] ?? ''}">`
        }))
    ]

    popup({ linhas, botoes, titulo: id ? `Editar ${singular}` : `Adicionar ${singular}` })

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

    for (const [caminho, valor] of [['nome', nome], ...extras]) {
        const resposta = await enviar(`${nomeBase}/${id}/${caminho}`, valor)
        if (!resposta?.success)
            return popup({ mensagem: `Não foi possível salvar: ${resposta?.mensagem || 'sem resposta do servidor'}.` })
    }

    removerPopup()

}
