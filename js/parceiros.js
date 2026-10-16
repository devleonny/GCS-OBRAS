function arredondarValorParceiro(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100
}

async function salvarEtapaParceiro(caminho, dados) {
    const resultado = await enviar(caminho, dados)
    if (!resultado?.success)
        throw new Error(resultado?.mensagem || 'Não foi possível salvar o fluxo do parceiro.')
    return resultado
}

async function validarSaldoPagamentoParceiro(pagamento, id) {
    if (!pagamento?.lpu_parceiro_id) return
    const c = await obterControlePagamentosParceiro(pagamento.lpu_parceiro_id, id)
    const valor = arredondarValorParceiro((pagamento.param_estavel ? [pagamento.param_estavel] : pagamento.param || []).reduce((soma, item) => soma + Number(item.valor_documento || 0), 0))
    const solicitacao = c.parceiro.solicitacoes?.[id]
    if (solicitacao && valor !== arredondarValorParceiro(solicitacao.valor))
        throw new Error('O valor do pagamento deve permanecer igual ao da solicitação parcial aprovada.')
    if (!(valor > 0) || valor > c.disponivel)
        throw new Error('Saldo insuficiente na LPU para liberar este pagamento.')
}

async function concluirAprovacaoParceiro(id, idLpu, idOcorrencia, pagamento) {
    const idRegistro = `${id}_aprovacao`
    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    if (!ocorrencia?.correcoes?.[idRegistro]) {
        const valor = (pagamento.param_estavel ? [pagamento.param_estavel] : pagamento.param || []).reduce((soma, item) => soma + Number(item.valor_documento || 0), 0)
        await salvarEtapaParceiro(`dados_ocorrencias/${idOcorrencia}/correcoes/${idRegistro}`, {
            usuario: pagamento.aprovado_gerente_por || acesso.usuario,
            data: pagamento.data_registro,
            aba: id,
            descricao: `🟢 Pagamento aprovado por ${pagamento.aprovado_gerente_por || acesso.usuario} no valor de ${dinheiro(valor)}`,
            dtCorrecao: '', tipoCorrecao: 'WRuo2'
        })
    }
    if (id !== idLpu) {
        const parceiro = await recuperarDado('parceiros', idLpu)
        if (parceiro?.solicitacoes?.[id]?.status === 'Aguardando gerente')
            await salvarEtapaParceiro(`parceiros/${idLpu}/solicitacoes/${id}/status`, 'Enviada ao financeiro')
    }
}

async function obterControlePagamentosParceiro(id, ignorarSolicitacao = null) {
    const parceiro = await recuperarDado('parceiros', id)
    if (!parceiro) throw new Error('LPU do parceiro não encontrada.')
    const total = arredondarValorParceiro(parceiro.total ?? parceiro.totais?.parceiro ?? 0)
    const solicitacoes = Object.entries(parceiro.solicitacoes || {})
    const pagamentos = await Promise.all([
        recuperarDado('lista_pagamentos', id),
        ...solicitacoes.map(([chave]) => recuperarDado('lista_pagamentos', chave))
    ])
    const linhas = solicitacoes.map(([chave, solicitacao], indice) => ({
        ...solicitacao, id: chave, pagamento: pagamentos[indice + 1]
    }))
    if (pagamentos[0]) {
        linhas.unshift({ id, valor: total, data: pagamentos[0].data_registro, status: 'Pagamento legado', pagamento: pagamentos[0], legado: true })
    } else {
        const { master } = await recuperarDado('contratos_vinculados', parceiro.departamento) || {}
        const ocorrencia = await recuperarDado('dados_ocorrencias', master || parceiro.departamento)
        if (ocorrencia?.correcoes?.[id]?.tipoCorrecao === '24e1ea27-1bd8-451a-b5bf-edda134cfdd6')
            linhas.unshift({ id, valor: total, status: 'Solicitação legada aguardando gerente', legado: true })
    }
    let pago = 0, reservado = 0
    for (const linha of linhas) {
        const pagamento = linha.pagamento
        const status = String(pagamento?.status || linha.status || '')
        const liberado = pagamento?.excluido || /reprovad|cancelad|excluíd|excluid|falha na solicitação/i.test(status)
        const valor = arredondarValorParceiro(pagamento
            ? (pagamento.param_estavel ? [pagamento.param_estavel] : pagamento.param || []).reduce((soma, item) => soma + Number(item.valor_documento || 0), 0)
            : linha.valor)
        linha.valor = valor
        linha.statusAtual = status
        linha.encerrada = Boolean(liberado)
        if (linha.id === ignorarSolicitacao || liberado) continue
        if (/^(PAGO|RECEBIDO)$/i.test(status.trim())) pago += valor
        else reservado += valor
    }
    pago = arredondarValorParceiro(pago)
    reservado = arredondarValorParceiro(reservado)
    return { parceiro, total, pago, reservado, disponivel: arredondarValorParceiro(total - pago - reservado), faltaPagar: arredondarValorParceiro(total - pago), linhas }
}

async function historicoPagamentosParceiro(id) {
    try {
        overlayAguarde()
        const c = await obterControlePagamentosParceiro(id)
        const indicadores = [['Combinado', c.total], ['Pago', c.pago], ['Em aprovação / pagamento', c.reservado], ['Disponível', c.disponivel], ['Falta pagar', c.faltaPagar]]
            .map(([nome, valor]) => `<div><span>${nome}</span><strong>${dinheiro(valor)}</strong></div>`).join('')
        const linhas = c.linhas.map(linha => `<tr>
            <td>${escaparAtributo(linha.data || '')}</td>
            <td>${dinheiro(linha.valor)}</td>
            <td>${escaparAtributo(linha.statusAtual)}</td>
            <td>${escaparAtributo(linha.comentario || (linha.legado ? 'Fluxo anterior' : ''))}</td>
            <td>
                ${linha.pagamento ? `<button onclick="abrirDetalhesPagamentos('${linha.id}')">Ver pagamento</button>` : ''}
                ${linha.ocorrencia_id ? `<button onclick="irOcorrenciaParceiro('${linha.ocorrencia_id}', '${linha.id}')">Ver correções</button>` : ''}
                ${!linha.legado && !linha.pagamento && !linha.encerrada ? `<button onclick="cancelarSolicitacaoParceiro('${id}', '${linha.id}')">Cancelar solicitação</button>` : ''}
            </td></tr>`).join('')
        popup({ titulo: 'Pagamentos da LPU Parceiro', elemento: `<div class="parceiro-historico">
            <div class="parceiro-indicadores">${indicadores}</div>
            <div class="parceiro-historico-tabela"><table class="tabela"><thead><tr><th>Solicitado em</th><th>Valor</th><th>Status</th><th>Etapa / motivo</th><th>Ações</th></tr></thead><tbody>${linhas || '<tr><td colspan="5">Nenhum pagamento solicitado.</td></tr>'}</tbody></table></div>
            </div>`, botoes: c.disponivel > 0 ? [{ texto: 'Solicitar pagamento parcial', funcao: `atualizarDadosParceiro('${id}')`, img: 'baixar' }] : [] })
    } catch (erro) { popup({ mensagem: erro.message }) }
}

async function irOcorrenciaParceiro(id, aba) {
    removerTodosPopups()
    await telaOcorrencias()
    await pesquisarOcorrencias('id', id)
    const tab = document.getElementById(`aba_${id}_${aba}`)
    const conteudo = document.getElementById(`${id}_${aba}`)
    if (tab && conteudo) {
        exibirAba(id, aba)
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
}

async function cancelarSolicitacaoParceiro(id, idSolicitacao, confirmar = false) {
    if (!confirmar)
        return popup({ mensagem: 'Cancelar esta solicitação e liberar seu saldo?', botoes: [{ texto: 'Confirmar cancelamento', funcao: `cancelarSolicitacaoParceiro('${id}', '${idSolicitacao}', true)`, img: 'cancel' }] })
    try {
        overlayAguarde()
        const c = await obterControlePagamentosParceiro(id)
        const linha = c.linhas.find(item => item.id === idSolicitacao)
        if (!linha || linha.legado || linha.pagamento) throw new Error('Esta solicitação já possui pagamento. O cancelamento deve seguir o fluxo do financeiro.')
        if (linha.usuario !== acesso.usuario && acesso.permissao !== 'adm') throw new Error('Apenas o solicitante ou administrador pode cancelar.')
        await salvarEtapaParceiro(`dados_ocorrencias/${linha.ocorrencia_id}/correcoes/${idSolicitacao}_cancelamento`, {
            aba: idSolicitacao, tipoCorrecao: 'WRuo2', data: new Date().toLocaleString(), usuario: acesso.usuario,
            descricao: 'Solicitação de pagamento parcial cancelada; saldo liberado.'
        })
        await salvarEtapaParceiro(`parceiros/${id}/solicitacoes/${idSolicitacao}/status`, 'Cancelada')
        removerTodosPopups()
        await historicoPagamentosParceiro(id)
    } catch (erro) { popup({ mensagem: erro.message }) }
}

async function formularioParceiro(id = crypto.randomUUID()) {

    try {
        overlayAguarde()

        // Verificar se tem pagamento ativo;
        const pagamento = id
            ? await recuperarDado('lista_pagamentos', id) || null
            : null

        const lpuExistente = await recuperarDado('parceiros', id)
        if (pagamento || Object.keys(lpuExistente?.solicitacoes || {}).length)
            return popup({ mensagem: 'Já existe uma solicitação de pagamento: não é possível editar.' })

        const {
            itens,
            margem,
            tecnicos,
            comentario,
            pedido
        } = id
                ? await recuperarDado('parceiros', id) || {}
                : {}
        const { 
            pedido: numeroPedido
         } = pedido ? await recuperarDado('pedidos', pedido) || {} : {}

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
            alturaMinima: '60dvh',
            body: 'bodyParceiros'
        })

        controlesCxOpcoes.tecnico = {
            btnExtras: `<button onclick="formularioCliente()">Adicionar Técnico</button>`,
            retornar: ['usuario'],
            base: 'clientes',
            filtros: {
                permissao: { op: 'NOT_EMPTY' }
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

        const modeloLabel = ({ v1, v2 }) => {

            return `
            <div class="campo-requisicao${v1 === 'Comentário' ? ' requisicao-campo-comentario' : ''}">
                ${v1 ? `<span><small><b>${v1}</b></small></span>` : ''}
                <div>${v2}</div>
            </div>
        `
        }

        controlesCxOpcoes.pedido = {
            base: 'pedidos',
            filtros: {
                departamento: { op: 'includes', value: ativo }
            },
            retornar: ['pedido'],
            colunas: {
                'Pedido': { chave: 'pedido' },
                'Tipo': { chave: 'tipo' },
                'Valor': { chave: 'valor' },
            }
        }

        const campos = [
            {
                linha: 1,
                v1: 'Selecione o técnico',
                v2: `
                <span ${tecnico ? `id="${tecnico}"` : ''} 
                    class="opcoes" 
                    name="tecnico" 
                    onclick="cxOpcoes('tecnico')">${tecnico || 'Selecione'}
                </span>
            `
            },
            {
                linha: 1,
                v1: 'Número do Pedido',
                v2: `
                    <span ${pedido ? `id="${pedido}"` : ''} name="pedido" class="opcoes" onclick="cxOpcoes('pedido')">
                        ${numeroPedido || 'Selecione'}
                    </span>
            `
            },
            {
                linha: 1,
                v1: 'Margem Geral (%)',
                v2: `<input id="margem_lpu" value="${margem || '40'}" oninput="calcularLpuParceiro()">`
            },
            {
                linha: 1,
                v1: 'Comentário',
                v2: `<textarea rows="2" id="comentario">${comentario || ''}</textarea>`
            },
            {
                linha: 2,
                v1: 'Total do Orçamento',
                v2: `<label class="campo-valor verde" id="total_orcamento"></label>`
            },
            {
                linha: 2,
                v1: 'Total Margem Disponível',
                v2: `<label class="campo-valor verde" id="total_margem"></label>`
            },
            {
                linha: 2,
                v1: 'Total Desvio',
                v2: `<label class="campo-valor verde" id="total_desvio"></label>`
            }

        ]

        const linhas = [
            {
                linha: 1,
                titulo: 'Dados da LPU Parceiro'
            },
            {
                linha: 2,
                titulo: 'Totais'
            }
        ]
            .map(({ linha, titulo }) => {

                const c = campos
                    .filter(c => c.linha == linha)
                    .map(c => modeloLabel(c))
                    .join('')

                return `
                <section class="requisicao-contorno">
                    <div class="requisicao-titulo">
                        ${titulo}
                    </div>
                    <div class="requisicao-dados">
                        ${c}
                    </div>
                </section>
            `
            })
            .join('')

        const elemento = `
        <div class="requisicao-tela requisicao-formulario lpu-parceiro-formulario">

            <div class="requisicao-cabecalho-cartoes">${linhas}</div>
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

        popup({
            botoes,
            elemento,
            conteudoRodape: `<div class="rodape-resumo"><span>Total do parceiro</span><strong id="total_parceiro">${dinheiro(0)}</strong></div>`,
            cor: 'white',
            titulo: 'LPU Parceiro',
            autoDestruicao: ['lpu_parceiro']
        })

        await paginacao('lpu_parceiro')

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir a LPU do Parceiro: Fale com o suporte.' })
    }

}

async function adicionarLinhaParceiro(composicao) {

    const { codigo, avulso, descricao, vUnitParc, vTotalParc, unidade, qtde, custo } = composicao || {}

    const tds = `
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>${unidade || ''}</td>
        <td>
            <input 
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
            name="vUnitParc"
            oninput="this.closest('tr').dataset.edicao = 'unitario'; calcularLpuParceiro()" 
            type="number" 
            value="${vUnitParc || ''}">
        </td>
        <td>
            <input 
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
    const pagamentoExistente = await recuperarDado('lista_pagamentos', id)
    if (pagamentoExistente || Object.keys(parceiro?.solicitacoes || {}).length)
        return popup({ mensagem: 'Esta LPU já possui solicitações. Seus itens, valor e parceiro não podem ser alterados.' })
    const departamento = controles?.ocorrencias?.ativo
    const tecnico = document.querySelector('[name="tecnico"]')

    if (!tecnico.id)
        return popup({ mensagem: 'O campo técnico é obrigatório' })

    const dados = {
        ...parceiro,
        departamento,
        pedido: obVal('pedido'),
        total: conversor(document.getElementById('total_parceiro').textContent),
        itens: obterBaseLpuParceiro(),
        totais: controles.lpu_parceiro.totais || {},
        margem: Number(document.getElementById('margem_lpu').value),
        executor: acesso.usuario,
        data: new Date().toLocaleString(),
        comentario: document.getElementById('comentario').value,
        tecnicos: [String(tecnico.textContent).trim()] // Precisa ser uma lista... bem, é complicado...
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

        tr.querySelector('[name="vTotalOrcado"]').innerHTML = dinheiro(totalLinha)
        tr.querySelector('[name="tImpostos"]').innerHTML = dinheiro(totalLinha * 0.2)

        // Para itens avulsos não existe margem;
        tr.querySelector('[name="mUnit"]').innerHTML = !avulso
            ? dinheiro(margemPorItem)
            : ''

        tr.querySelector('[name="mTotal"]').innerHTML = !avulso
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
            el.innerHTML = dinheiro(total)
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

    const html = `
        <div id="pdf" style="font-size: 12px; ${vertical}; width: 90%; gap: 1rem;">
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

    const elemento = `<div style="padding: 2rem;">${html}</div>`

    if (visualizar)
        return popup({ cor: '#fbfbfb', elemento, titulo: 'PDF' })

    try {

        await pdf({
            html,
            estilos: ['tabelas-parceiro', 'estilos'],
            nome: `LPU PARCEIRO - ${Date.now()}`
        })

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF' })
    }
}

async function atualizarDadosParceiro(id) {

    overlayAguarde()

    const controle = await obterControlePagamentosParceiro(id)
    const { parceiro } = controle
    if (controle.disponivel <= 0)
        return popup({ mensagem: 'Esta LPU não tem saldo disponível para novas solicitações.' })

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
            elemento: `<div class="rodape-resumo"><span>Disponível para solicitar</span><strong>${dinheiro(controle.disponivel)}</strong></div>`
        },
        {
            texto: 'Valor deste pagamento',
            elemento: `<input name="valor_parcial" type="number" min="0.01" step="0.01" max="${controle.disponivel}" value="${controle.disponivel}">`
        },
        {
            texto: 'Etapa / motivo do pagamento',
            elemento: '<textarea name="comentario_parcela" rows="2"></textarea>'
        },
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

    popup({ linhas, botoes, titulo: 'Solicitar pagamento parcial' })

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

        const controle = await obterControlePagamentosParceiro(id)
        const valor = arredondarValorParceiro(Number(document.querySelector('[name="valor_parcial"]').value))
        if (!Number.isFinite(valor) || valor <= 0 || valor > controle.disponivel)
            return popup({ mensagem: 'Informe um valor positivo dentro do saldo disponível da LPU.' })
        const comentario = document.querySelector('[name="comentario_parcela"]').value.trim()
        const idSolicitacao = crypto.randomUUID()
        const { usuario } = acesso || {}
        const ativo = controle.parceiro.departamento

        const [parceiro, contrato] = await Promise.all([
            recuperarDado('parceiros', id),
            recuperarDado('contratos_vinculados', ativo)
        ])

        const {
            tecnicos
        } = parceiro ?? {}

        const {
            master
        } = contrato ?? {}

        const total = valor

        const correcao = {
            data_pagamento: document.querySelector('[name="data_pagamento"]')?.value || null,
            aba: idSolicitacao,
            lpu_id: id,
            valor_parcial: valor,
            data: new Date().toLocaleString(),
            tecnico: tecnicos,
            descricao: `[${ativo}] Solicitação parcial de ${dinheiro(total)} para ${(tecnicos || []).join(', ')}. LPU: ${dinheiro(controle.total)}.${comentario ? ` Etapa: ${comentario}` : ''}`,
            permissao: ['gerente'],
            usuario,
            tipoCorrecao: '24e1ea27-1bd8-451a-b5bf-edda134cfdd6' // PAGAMENTO DE PARCEIRO
        }

        // Departamento sempre do master, caso não exista, o ativo é o master;
        const chamadoPai = master || ativo
        if (!await recuperarDado('dados_ocorrencias', chamadoPai))
            return popup({ mensagem: 'A ocorrência principal não foi encontrada. Abra o chamado antes de solicitar o pagamento.' })

        const solicitacao = {
            valor, comentario, ocorrencia_id: chamadoPai,
            data: correcao.data, usuario, status: 'Aguardando gerente',
            data_pagamento: correcao.data_pagamento
        }
        await salvarEtapaParceiro(`clientes/${idCliente}`, dados)
        await salvarEtapaParceiro(`parceiros/${id}/solicitacoes/${idSolicitacao}`, solicitacao)
        try {
            await salvarEtapaParceiro(`dados_ocorrencias/${chamadoPai}/correcoes/${idSolicitacao}`, correcao)
        } catch (erro) {
            await salvarEtapaParceiro(`parceiros/${id}/solicitacoes/${idSolicitacao}/status`, 'Falha na solicitação')
            throw erro
        }

        removerTodosPopups()

        popup({ mensagem: 'Pagamento do parceiro enviado para aprovação do gerente' })

    } catch (err) {

        console.error(err)
        popup({ mensagem: err.message || 'Falha ao gerar o pagamento do parceiro' })

    }

}
