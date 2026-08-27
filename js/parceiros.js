async function formularioParceiro(id = crypto.randomUUID()) {

    overlayAguarde()

    // Verificar se tem pagamento ativo;
    const pagamento = id
        ? await recuperarDado('lista_pagamentos', id) || null
        : null

    if (pagamento)
        return popup({ mensagem: 'Já existe uma solicitação de pagamento: não é possível editar.' })

    const {
        itens,
        margem,
        tecnicos,
        comentario,
    } = id
            ? await recuperarDado('parceiros', id) || {}
            : {}

    const tecnico = tecnicos?.[0]

    const ativo = controles?.ocorrencias?.ativo

    const orcamentos = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': {
                op: '=',
                value: ativo
            }
        }
    })

    const orcamento = orcamentos?.resultados?.[0]
    const base = Object.values(itens || orcamento?.dados_composicoes || {})
        .filter(i => i?.tipo !== 'VENDA')

    const colunas = {
        'Código': { chave: 'codigo' },
        'Descrição': { chave: 'descricao' },
        'Unidade': { chave: 'unidade' },
        'Quantidade': { chave: 'qtde' },
        'Valor Orçamento': { chave: 'custo' },
        'Valor Total Orçado': {},
        'Impostos (20%)': {},
        'Margem Unitária': {},
        'Margem Total': {},
        'Parceiro Unitário': {},
        'Parceiro Total': {},
        'Desvio': {},
    }

    const tabela = await modTab({
        base,
        colunas,
        funcaoAdicional: ['calcularLpuParceiro'],
        criarLinha: 'adicionarLinhaParceiro',
        pag: 'lpu_parceiro',
        body: 'bodyParceiros'
    })

    const stringHtml = (titulo, valor) => `
        <div style="${vertical}; gap: 3px;">
            <label><b>${titulo}</b>:</label>
            <div>${valor}</div>
        </div>`

    controlesCxOpcoes.tecnico = {
        btnExtras: `<button onclick="formularioCliente()">Adicionar Técnico</button>`,
        retornar: ['usuario'],
        base: 'clientes',
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Matrícula': { chave: 'matricula' },
            'Nome': { chave: 'nome' },
            'CNPJ': { chave: 'cnpj' },
            'Permissão': { chave: 'permissao', tipoPesquisa: 'select' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div style="${horizontal}; align-items: start; gap: 2rem;">

                <div class="requisicao-contorno">

                    <div class="requisicao-titulo">
                        Informações Complementares
                    </div>

                    <div class="requisicao-dados">


                        ${stringHtml('Selecione o técnico', `
                        <span ${tecnico ? `id="${tecnico}"` : ''} 
                            class="opcoes" 
                            name="tecnico" 
                            onclick="cxOpcoes('tecnico')">${tecnico || 'Selecione'}
                        </span>
                        `)}

                        ${stringHtml('Margem Geral (%)', `<input id="margem_lpu" value="${margem || '40'}" oninput="calcularLpuParceiro()">`)}
                        ${stringHtml('Comentário', `<textarea id="comentario">${comentario || ''}</textarea>`)}

                    </div>

                </div>
        
                <div class="requisicao-contorno">

                    <div class="requisicao-titulo">
                        Totais
                    </div>

                    <div class="requisicao-dados">
                        ${stringHtml('Total do Valor Orçamento', '<label id="total_orcamento"></label>')}
                        ${stringHtml('Total Margem Disponível', '<label id="total_margem"></label>')}
                        ${stringHtml('Total do Valor Parceiro', '<label id="total_parceiro"l></label>')}
                        ${stringHtml('Total Desvio', '<label id="total_desvio"></label>')}
                    </div>
                </div>

            </div>

            <br>
            ${tabela}
        </div>
        `

    const botoes = [
        {
            texto: 'Adicionar Serviço',
            funcao: 'itemAdicional()',
            img: 'baixar'
        },
        {
            texto: 'Salvar LPU',
            funcao: `salvarLpuParceiro('${id}')`,
            img: 'concluido'
        },
    ]

    popup({ botoes, elemento, cor: 'white', titulo: 'LPU Parceiro', autoDestruicao: ['lpu_parceiro'] })

    await paginacao('lpu_parceiro')

}

async function adicionarLinhaParceiro(composicao) {

    const { codigo, avulso, descricao, vUnitParc, vTotalParc, unidade, qtde, custo } = composicao || {}

    const tds = `
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>${unidade || ''}</td>
        <td>
            <input 
                class="requisicao-campo" 
                name="qtde"
                oninput="calcularLpuParceiro()" 
                type="number" 
                value="${qtde || ''}">
        </td>
        <td name="custo" style="white-space: nowap;">${dinheiro(custo || 0)}</td>
        <td name="vTotalOrcado" style="white-space: nowrap;"></td>
        <td name="tImpostos" style="white-space: nowrap;"></td>
        <td name="mUnit" style="white-space: nowrap;"></td>
        <td name="mTotal" style="white-space: nowrap;"></td>
        <td>
            <input 
            class="requisicao-campo" 
            name="vUnitParc"
            oninput="this.closest('tr').dataset.edicao = 'unitario'; calcularLpuParceiro()" 
            type="number" 
            value="${vUnitParc || ''}">
        </td>
        <td>
            <input 
            class="requisicao-campo" 
            name="vTotalParc"
            oninput="this.closest('tr').dataset.edicao = 'total'; calcularLpuParceiro()" 
            type="number"
            value="${vTotalParc || ''}">
        </td>
        <td name="desvio" style="white-space: nowrap;"></td>`

    return `<tr  data-avulso=${avulso ? 'S' : 'N'} data-codigo="${codigo}">${tds}</tr>`

}

async function itemAdicional() {

    controlesCxOpcoes.composicao = {
        retornar: ['descricao'],
        base: 'dados_composicoes',
        filtros: {
            'tipo': { op: '!=', value: 'SERVIÇO' }
        },
        colunas: {
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
            'Tipo': { chave: 'tipo' },
            'Unidade': { chave: 'unidade' }
        }
    }

    const linhas = [
        {
            texto: 'Descrição',
            elemento: `<span name="composicao" class="opcoes" onclick="cxOpcoes('composicao')">Selecione</span>`
        },
        {
            texto: 'Quantidade',
            elemento: `<input name="qtde" type="number">`
        },
        {
            texto: 'Custo',
            elemento: `<input name="custo" type="number">`
        },
        {
            texto: 'Unidade',
            elemento: `<input name="unidade">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarAdicional()', autoDestruicao: ['composicao'] }
    ]

    popup({ linhas, botoes, titulo: 'Incluir Serviço' })
}

async function salvarAdicional() {

    const obVal = (n) => {
        const painel = document.querySelector('.painel-padrao')
        const el = painel.querySelector(`[name="${n}"]`)
        return el ? el : null
    }

    const composicao = obVal('composicao')

    if (!composicao.id)
        return popup({ mensagem: 'Descrição não pode ficar em branco' })

    upsertItemLpu({
        avulso: 'S',
        codigo: composicao.id,
        descricao: composicao.textContent,
        qtde: Number(obVal('qtde').value),
        custo: Number(obVal('custo').value),
        unidade: obVal('unidade').value
    })

    removerPopup()

    await paginacao('lpu_parceiro')

}

async function salvarLpuParceiro(id = crypto.randomUUID()) {

    overlayAguarde()

    const parceiro = await recuperarDado('parceiros', id)
    const departamento = controles?.ocorrencias?.ativo
    const tecnico = document.querySelector('[name="tecnico"]')

    if (!tecnico.id)
        return popup({ mensagem: 'O campo técnico é obrigatório' })

    const dados = {
        ...parceiro,
        departamento,
        total: conversor(document.getElementById('total_parceiro').textContent),
        itens: obterBaseLpuParceiro(),
        totais: controles.lpu_parceiro.totais || {},
        margem: Number(document.getElementById('margem_lpu').value),
        executor: acesso.usuario,
        data: new Date().toLocaleString(),
        comentario: document.getElementById('comentario').value,
        tecnicos: [tecnico.textContent] // Precisa ser uma lista... bem, é complicado...
    }

    await enviar(`parceiros/${id}`, dados)
    removerPopup()

}

function calcularLpuParceiro() {

    const elMargem = document.getElementById('margem_lpu')
    if (!elMargem)
        return

    const margemPercentual = Number(document.getElementById('margem_lpu').value) / 100;

    let totais = {
        orcamento: 0,
        parceiro: 0,
        desvio: 0,
        margem: 0
    }

    const trs = document.querySelectorAll('#bodyParceiros tr')

    for (const tr of trs) {

        const codigo = tr.dataset.codigo
        const removido = tr.dataset.removido == 'S'

        // Pode encerrar;
        if (!codigo)
            continue

        const avulso = tr.dataset.avulso == 'S'
        const qtde = Number(tr.querySelector('[name="qtde"]').value) || 0
        const valorOrcamento = conversor(tr.querySelector('[name="custo"]').textContent)
        const totalLinha = qtde * valorOrcamento

        const edicao = tr.dataset.edicao
        const vUnitParc = tr.querySelector('[name="vUnitParc"]')
        const vTotalParc = tr.querySelector('[name="vTotalParc"]')

        const totalParceiro = edicao == 'unitario'
            ? Number(vUnitParc.value) * qtde
            : Number(vTotalParc.value)

        if (edicao == 'unitario') {
            vTotalParc.value = totalParceiro
        } else {
            vUnitParc.value = qtde == 0 ? 0 : totalParceiro / qtde
        }

        const totalMargem = totalLinha * margemPercentual
        const margemPorItem = qtde == 0
            ? 0
            : totalMargem / qtde

        const desvio = avulso
            ? - totalParceiro
            : totalMargem - totalParceiro

        const img = desvio < 0
            ? 'offline'
            : 'online'

        if (edicao == 'unitario') {
            vTotalParc.value = (totalParceiro).toFixed(2)
        } else {
            vUnitParc.value = (totalParceiro / qtde).toFixed(2)
        }

        totais.parceiro += removido ? 0 : totalParceiro
        totais.desvio += removido ? 0 : desvio
        totais.orcamento += removido ? 0 : totalLinha

        tr.querySelector('[name="vTotalOrcado"]').textContent = dinheiro(totalLinha)
        tr.querySelector('[name="tImpostos"]').textContent = dinheiro(totalLinha * 0.2)

        // Para itens avulsos não existe margem;
        tr.querySelector('[name="mUnit"]').textContent = !avulso
            ? dinheiro(margemPorItem)
            : ''

        tr.querySelector('[name="mTotal"]').textContent = !avulso
            ? dinheiro(totalMargem)
            : ''

        tr.querySelector('[name="desvio"]').innerHTML = `
            <div style="${horizontal}; gap: 3px;">
                <img src="imagens/${img}.png" style="width: 1.5rem;">
                ${dinheiro(desvio)}
            </div>`

        // Salvamento no objeto;
        upsertItemLpu({
            codigo,
            vUnitParc: Number(vUnitParc.value),
            vTotalParc: Number(vTotalParc.value),
            qtde
        })

    }

    totais.margem = totais.orcamento * margemPercentual

    // Salvamento no objeto;
    controles.lpu_parceiro.totais = totais

    for (const [campo, total] of Object.entries(totais)) {
        const el = document.getElementById(`total_${campo}`)
        if (el)
            el.textContent = dinheiro(total)
    }

}

function obterBaseLpuParceiro() {
    if (!Array.isArray(controles?.lpu_parceiro?.base))
        controles.lpu_parceiro.base = Object.values(controles?.lpu_parceiro?.base || {})

    return controles.lpu_parceiro.base
}

function encontrarItemLpu(codigo) {
    return obterBaseLpuParceiro().find(item => String(item.codigo) === String(codigo))
}

function upsertItemLpu(item) {
    const base = obterBaseLpuParceiro()
    const i = base.findIndex(atual => String(atual.codigo) === String(item.codigo))

    if (i >= 0) base[i] = { ...base[i], ...item }
    else base.push(item)
}

async function gerarPdfParceiro(id, visualizar) {

    overlayAguarde()

    const {
        tecnicos,
        itens,
        totais,
        comentario
    } = await recuperarDado('parceiros', id) || {}

    const listaTecnicos = (tecnicos || [])
        .map(t => `<span>${t}</span>`)
        .join('')

    const colunas = [
        'Código',
        'Descrição',
        'Quantidade',
        'Unidade',
        'Valor Unitário',
        'Valor Total'
    ]

    const linhas = (itens || [])
        .filter(({ vUnitParc = 0 }) => vUnitParc != 0)
        .map(({ codigo, descricao, qtde, unidade, vUnitParc, vTotalParc }) => {

            return `
                <tr>
                    <td>${codigo || ''}</td>
                    <td>${descricao || ''}</td>
                    <td>${qtde || ''}</td>
                    <td>${unidade || ''}</td>
                    <td>${dinheiro(vUnitParc)}</td>
                    <td>${dinheiro(vTotalParc)}</td>
                </tr>
            `
        }).join('')

    const htmlContent = `
        <div id="pdf" style="${vertical}; gap: 1rem;">
            <img src="https://i.imgur.com/5zohUo8.png" style="width: 5rem;">

            <table class="tabela-v2">
                <thead>
                    ${colunas.map(c => `<th>${c}</th>`).join('')}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>

            <table class="tabela-v2">
                <tbody>
                    <tr>
                        <td colspan="5" style="background-color: #eaeaea; text-align: right;">TOTAL</td>
                        <td>${dinheiro(totais?.parceiro)}</td>
                    </tr>
                </tbody>
            </table>

            <div style="${vertical};">
                <span><b>TÉCNICOS</b></span>
                ${listaTecnicos}
                <span><b>COMENTÁRIO</b></span>
                <div style="white-space: pre-wrap;">${comentario || ''}</div>
            </div>
        </div>
`

    const elemento = `<div style="padding: 2rem;">${htmlContent}</div>`

    if (visualizar)
        return popup({ cor: '#fbfbfb', elemento, titulo: 'PDF' })

    try {

        await pdf({
            id: 'pdf', 
            estilos: ['tabelas-vers-2', 'estilos'], 
            nome: `LPU PARCEIRO - ${Date.now()}`
        })

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF' })
    }
}

async function atualizarDadosParceiro(id) {

    overlayAguarde()

    const [pagamento, parceiro] = await Promise.all([
        recuperarDado('lista_pagamentos', id) || null,
        recuperarDado('parceiros', id) || {}
    ])

    if (pagamento)
        return popup({ mensagem: 'Já existe um pagamento lançado para esta LPU.' })

    const { tecnicos } = parceiro

    const tecnico = tecnicos?.[0]

    const pesquisa = await pesquisarDB({
        base: 'clientes',
        filtros: {
            usuario: { op: '=', value: tecnico }
        }
    })

    const {
        id: idCliente,
        cnpj,
        ddd,
        celular,
        chave_pix
    } = pesquisa.resultados?.[0] || {}

    const linhas = [
        {
            texto: 'CPF/CNPJ',
            elemento: `<input placeholder="CPF ou CNPJ" oninput="formatarCnpj(this)" name="cnpj" value="${cnpj || ''}">`
        },
        {
            texto: 'Chave Pix',
            elemento: `<textarea placeholder="Chave Pix" name="chave_pix">${chave_pix || ''}</textarea>`
        },
        {
            texto: 'Celular',
            elemento: `
            <input name="ddd" placeholder="DDD" style="width: 40px;" value="${ddd || ''}">
            <input name="celular" placeholder="Celular" value="${celular || ''}">
            `
        },
        {
            texto: 'Previsão de Pagamento',
            elemento: `<input name="data_pagamento" type="date">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `solicitarPagamentoParceiro('${id}', ${idCliente})` }
    ]

    popup({ linhas, botoes, titulo: 'Atualize os dados do técnico' })

}

async function solicitarPagamentoParceiro(id, idCliente) {

    try {

        overlayAguarde()

        // Atualização cadastral;

        const chave_pix = document.querySelector('[name="chave_pix"]').value

        if (!chave_pix)
            return popup({ mensagem: 'A Chave Pix é obrigatória' })

        const dados = {
            chave_pix,
            cnpj: document.querySelector('[name="cnpj"]').value,
            ddd: document.querySelector('[name="ddd"]').value,
            celular: document.querySelector('[name="celular"]').value
        }

        // o id da LPU PARCEIRO será o mesmo para aba e para idCorrecao;

        const { usuario } = acesso || {}

        const {
            tecnicos,
            itens,
            departamento
        } = await recuperarDado('parceiros', id) || {}

        const total = (itens || [])
            .reduce((acc, item) => acc + (item.vTotalParc), 0)

        const correcao = {
            data_pagamento: document.querySelector('[name="data_pagamento"]')?.value || null,
            aba: id,
            data: new Date().toLocaleString(),
            tecnico: tecnicos,
            descricao: `Solicitação de pagamento de parceiro de ${dinheiro(total)} para ${(tecnicos || []).map(t => t).join(', ')}.`,
            permissao: ['gerente'],
            usuario,
            tipoCorrecao: '24e1ea27-1bd8-451a-b5bf-edda134cfdd6' // PAGAMENTO DE PARCEIRO
        }

        await Promise.all([
            enviar(`clientes/${idCliente}`, dados),
            enviar(`dados_ocorrencias/${departamento}/correcoes/${id}`, correcao)
        ])

        removerTodosPopups()

        popup({ mensagem: 'Pagamento do parceiro enviado para aprovação do gerente' })

    } catch (err) {

        popup({ mensagem: err.message || 'Falha ao gerar o pagamento do parceiro' })

    }

}