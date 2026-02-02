const cLinear = (cor) => `background: linear-gradient(90deg, ${cor} 0%, ${cor}91 85%)`

function isDark(cor) {
    if (!cor) return false
    const c = cor.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150
}

async function renderAtivas({ idOrcamento, tags = {}, recarregarPainel }) {

    const html = await Promise.all(
        Object.entries(tags).map(async ([id, info]) => {
            const tag = await recuperarDado('tags_orcamentos', id) || {}
            const cor = tag.cor || '#999'
            const branco = isDark(cor) ? 'color: #fff;' : ''

            return `
                <div  
                    data-id="${id}"
                    class="tag"
                    style="${cLinear(cor)}; ${branco}"
                    title="${info.usuario} - ${info.data}"
                    onclick="confirmarRemocaoTag({idTag: '${id}', idOrcamento: '${idOrcamento}', recarregarPainel: ${recarregarPainel}})">
                    <span>${tag.nome || '--'}</span>
                </div>
            `
        })
    )

    return html.join('')
}


function renderDisponiveis() {

    const acumulado = Object.entries(db.tags_orcamentos)
        .sort(([, a], [, b]) =>
            (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
        )
        .map(([id, tag]) => {
            const cor = tag.cor || '#999'
            const branco = isDark(cor) ? 'color: #fff;' : ''

            return `
                <div class="tag" style="${cLinear(cor)}; ${branco}">
                    <span onclick="vincularTag('${id}')">
                        ${tag.nome || '--'}
                    </span>
                    <img src="imagens/tag_${branco == 'color: #fff;' ? 'branca' : 'preta'}.png"
                         style="width:1.4rem"
                         onclick="abrirEdicaoTag('${id}')">
                </div>
            `
        })
        .join('')

    return acumulado
}

async function renderPainel(idOrcamento) {

    id_orcam = idOrcamento

    const acumulado = `
        <div style="${horizontal}; padding-left: 0.5rem; padding-right: 0.5rem; margin: 5px; background-color: white; border-radius: 10px;">
            <input oninput="pesquisarEtiqueta(this)" placeholder="Pesquisar Etiqueta" style="width: 100%;">
            <img src="imagens/pesquisar4.png" style="width: 2rem; padding: 0.5rem;"> 
        </div>
        <span>Disponíveis</span>
        <div class="tags-janela">
        <div class="etiquetas-organizadas">${renderDisponiveis()}</div>
        </div>
        <hr>
        <span>Ativas</span>
        <div style="grid-template-rows: repeat(3, auto);" class="etiquetas-organizadas" name="etiquetas-ativas">${renderAtivas({ idOrcamento })}</div>

    `

    await recarregarLinhas()

    const painel = document.querySelector('.painel-etiquetas')
    if (painel) return painel.innerHTML = acumulado

    const botoes = [
        { texto: 'Criar Etiqueta', img: 'etiqueta', funcao: `abrirEdicaoTag()` }
    ]

    popup({ titulo: 'Gerenciar Etiquetas', elemento: `<div class="painel-etiquetas">${acumulado}</div>`, botoes })

}

function pesquisarEtiqueta(input) {

    const pesquisa = String(input.value).toLocaleLowerCase().trim()
    const tags = document.querySelectorAll('.tag')

    for (const tag of tags) {
        const span = tag.querySelector('span')
        const texto = String(span.textContent).toLowerCase().trim()
        const mostrar = texto.includes(pesquisa)
        tag.style.display = mostrar ? '' : 'none'
    }

}

async function vincularTag(idTag) {
    overlayAguarde()

    const orcamento = db.dados_orcamentos[id_orcam]
    orcamento.tags ??= {}
    orcamento.tags[idTag] = {
        data: new Date().toLocaleString(),
        usuario: acesso.usuario
    }

    db.dados_orcamentos[id_orcam] = orcamento
    enviar(`dados_orcamentos/${id_orcam}/tags/${idTag}`, orcamento.tags[idTag])
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    renderPainel(id_orcam)
    removerOverlay()
}

function confirmarRemocaoTag({ idTag, idOrcamento, recarregarPainel }) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `removerTag({idTag: '${idTag}', idOrcamento: '${idOrcamento}', recarregarPainel: ${recarregarPainel}})` }
    ]

    popup({ mensagem: 'Remover tag?', botoes })
}

async function removerTag({ idTag, idOrcamento, recarregarPainel = true }) {
    overlayAguarde()

    const orcamento = db.dados_orcamentos[idOrcamento]
    delete orcamento.tags?.[idTag]

    deletar(`dados_orcamentos/${idOrcamento}/tags/${idTag}`)
    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    await recarregarLinhas()
    removerPopup()
    if (recarregarPainel) renderPainel(idOrcamento)
}

function abrirEdicaoTag(id = ID5digitos()) {
    const tag = db.tags_orcamentos[id] || {}

    const elemento = `
        <div class="painel-adicionar-etiqueta">
            <input name="nome" placeholder="Nome" value="${tag.nome || ''}">
            <input name="cor" type="color" value="${tag.cor || '#999'}">
        </div>
    `
    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTag('${id}')` }
    ]

    popup({ elemento, botoes, titulo: 'Tags' })
}

async function salvarTag(id) {
    overlayAguarde()

    const painel = document.querySelector('.painel-adicionar-etiqueta')
    const nome = painel.querySelector('[name="nome"]').value
    const cor = painel.querySelector('[name="cor"]').value

    if (!nome) return removerPopup()

    const tag = { nome, cor }
    db.tags_orcamentos[id] = tag

    enviar(`tags_orcamentos/${id}`, tag)
    await inserirDados({ [id]: tag }, 'dados_orcamentos')

    removerPopup()
    renderPainel(id_orcam)
}

async function recarregarLinhas() {
    if (telaAtiva == 'inicial') await telaInicial()
    if (telaAtiva == 'orcamentos') await telaOrcamentos()
}

async function sincronizarTags() {

    for (const [idTag, tag] of Object.entries(db.tags_orcamentos)) {
        const todas = document.querySelectorAll(`.tag[data-id="${idTag}"]`)
        if (!todas.length) continue

        const cor = tag.cor || '#999'
        const branco = isDark(cor)

        for (const t of todas) {
            t.style.background = `linear-gradient(90deg, ${cor} 0%, ${cor}91 85%)`
            t.style.color = branco ? '#fff' : ''
            t.querySelector('span').textContent = tag.nome || '--'
        }
    }
}

// Outra parada;

async function excelEspecial() {

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Orçamentos')

    sheet.columns = [
        { header: 'Nome Cliente', key: 'nome', width: 40 },
        { header: 'CNPJ', key: 'cnpj', width: 22 },
        { header: 'Valor', key: 'valor', width: 15 },
        { header: 'Cidade', key: 'cidade', width: 20 },
        { header: 'Endereço', key: 'endereco', width: 30 },
        { header: 'Itens', key: 'itens', width: 80 }
    ]

    for (const orcamento of Object.values(db.dados_orcamentos)) {
        const codOmie = orcamento?.dados_orcam?.omie_cliente
        const cliente = db.dados_clientes?.[codOmie]

        if (!cliente || !orcamento.dados_composicoes) continue
        if (!cliente.nome.includes('BOTICARIO')) continue

        if (
            orcamento.db.dados_composicoes?.['722'] &&
            orcamento.db.dados_composicoes?.['762']
        ) {

            const itens = Object.entries(orcamento.dados_composicoes)
                .map(([id, i]) =>
                    `${id} | ${i.descricao} | qtde: ${i.qtde} | custo: ${i.custo} | tipo: ${i.tipo}`
                )
                .join('\n')

            const row = sheet.addRow({
                nome: cliente.nome,
                cnpj: cliente.cnpj,
                valor: orcamento.total_geral,
                cidade: cliente.cidade,
                endereco: cliente.bairro,
                itens
            })

            row.getCell('itens').alignment = { wrapText: true, vertical: 'top' }
        }
    }

    sheet.getRow(1).font = { bold: true }

    const buffer = await workbook.xlsx.writeBuffer()

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'orcamentos_especiais.xlsx'
    a.click()

    URL.revokeObjectURL(url)
}
