function parametroPagamento(p) { return p?.param_estavel || p?.param?.[0] || {} }

async function atualizarPixPagamento() {
    const recebedor = document.querySelector('[name="recebedor"]');
    const campo = document.querySelector('[name="chave_pix"]');
    const confirmar = document.querySelector('[name="confirmar_pix"]');
    const id = recebedor.id;
    campo.value = ''; campo.dataset.cliente = ''; confirmar.checked = false;
    try {
        const cliente = await recuperarDado('clientes', id);
        if (recebedor.id !== id) return;
        campo.value = cliente?.chave_pix || ''; campo.dataset.cliente = id;
        await calculadoraPagamento();
    } catch (erro) { popup({ mensagem: 'Falha ao consultar PIX. Selecione o recebedor novamente.' }); }
}

let idP = null

const opcoesStatus = [
    '',
    'Aguardando aprovação da Diretoria',
    'Aguardando aprovação da Gerência',
    'Pagamento Excluído',
    'Processando...',
    'A VENCER',
    'PAGO'
]

function imagemEspecifica(justificativa) {

    const nomeStatus = String(justificativa.status).toLowerCase()

    let cor = '#222'
    let imagem = "imagens/cancel.png"
    if (nomeStatus.includes('aprovado')) {
        cor = '#4CAF50'
        imagem = "imagens/concluido.png"

    } else if (nomeStatus.includes('reprovado')) {
        cor = '#B12425'
        imagem = "imagens/cancel.png"

    } else if (nomeStatus.includes('aguardando')) {
        cor = '#D97302'
        imagem = "imagens/avencer.png"

    } else if (nomeStatus.includes('processando')) {
        cor = '#026aeb'
        imagem = "imagens/salvo.png"

    } else {
        cor = '#B12425'
    }

    return { imagem, cor }

}

async function telaPagamentos() {

    overlayAguarde()

    const pag = 'pagamentos'
    const tabela = await modTab({
        pag,
        detalhes: true,
        btnExtras: `<div class="pagamentos-pesquisas-referencias">
            <label>Categorias
                <input type="search" placeholder="Pesquisar categoria" aria-label="Pesquisar categoria"
                    onkeydown="confirmarPesquisa({ event, chave: 'snapshots.categorias.*.categoria', op: 'includes', elemento: this, pag: 'pagamentos' })"
                    onchange="confirmarPesquisa({ chave: 'snapshots.categorias.*.categoria', op: 'includes', elemento: this, pag: 'pagamentos' })">
            </label>
            <label>Departamentos
                <input type="search" placeholder="Pesquisar departamento" aria-label="Pesquisar departamento"
                    onkeydown="confirmarPesquisa({ event, chave: 'snapshots.departamentos.*.departamento', op: 'includes', elemento: this, pag: 'pagamentos' })"
                    onchange="confirmarPesquisa({ chave: 'snapshots.departamentos.*.departamento', op: 'includes', elemento: this, pag: 'pagamentos' })">
            </label>
        </div>`,
        colunas: {
            'Data de Vencimento': { chave: 'param_estavel.data_vencimento', tipoPesquisa: 'data' },
            'APP': { chave: 'app', op: '=', tipoPesquisa: 'select' },
            'Valor': { chave: 'snapshots.valor' },
            'Status': { chave: 'status' },
            'Solicitante': { chave: 'criado' },
            'Recebedor': { chave: 'snapshots.cliente' },
            'Detalhes': {}
        },
        filtros: {
            'snapshots.criado': {
                op: '!=',
                value: 'Integração'
            }
        },
        funcaoAdicional: ['atualizarPainelEsquerdo'],
        body: 'bodyPagamentos',
        base: 'lista_pagamentos',
        criarLinha: 'criarLinhaPagamento'
    })

    const acumulado = `
        <div class="divPagamentos">

            <aside class="pagamentos-status-lateral" aria-label="Filtrar pagamentos por status">
                <div class="painelEsquerdo"></div>
            </aside>

            <div class="painelDireito">

                ${tabela}

            </div>

        </div>
        `

    tela.innerHTML = acumulado

    await paginacao(pag)

    removerOverlay()

}

async function filtrarPagamentos(st) {

    controles.pagamentos.pagina = 1
    const status = String(st || '').trim()

    controles.pagamentos.filtros = {
        ...controles?.pagamentos?.filtros,
        status: { op: '=', value: status }
    }

    if (st == 'TODOS')
        delete controles.pagamentos.filtros.status

    await paginacao('pagamentos')

}

async function atualizarPainelEsquerdo() {

    const { por_status } = await recuperarDado('mvw_contagem_pagamentos', 1) || {}

    const titulos = (por_status || [])
        .map(item => {

            const { status, quantidade } = item || {}
            const filtro = controles.pagamentos?.filtros?.status
            const filtroStatus = filtro?.original || filtro?.value
            const selecionado = filtroStatus
                ? String(status) === String(filtroStatus)
                : status === 'TODOS'

            return `
                <div class="balao-pagamentos${selecionado ? ' selecionado' : ''}"
                role="button" tabindex="0" aria-label="${escaparAtributo(status)}: ${quantidade} pagamentos"
                title="${escaparAtributo(status)}"
                data-status="${escaparAtributo(status)}"
                onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); filtrarPagamentos(this.dataset.status) }"
                onclick="filtrarPagamentos(this.dataset.status)">
                    
                    <div class="dir">
                        <img src="${iconePagamento(status)}">
                        <label>${escaparAtributo(status)}</label>
                    </div>

                    <span class="esq">${quantidade}</span>
                    
                </div>
            `
        })
        .join('')

    const painelEsquerdo = document.querySelector('.painelEsquerdo')
    if (painelEsquerdo)
        painelEsquerdo.innerHTML = titulos

}

async function criarLinhaPagamento(pagamento) {

    const { id, criado, app, status, snapshots } = pagamento || {}
    const { data_vencimento, valor_documento } = parametroPagamento(pagamento)

    const deps = (snapshots?.departamentos || [])
        .map(({ departamento }) => {
            return `<span onclick="painelCustos(this.dataset.departamento)" data-departamento="${escaparAtributo(departamento || '')}" class="tag-pendencias pagamento-balao pagamento-balao-departamento">${escaparAtributo(departamento || '')}</span>`
        })
        .join('')

    const categorias = Object.values(snapshots?.categorias || {})
        .map(({ categoria }) => categoria)

    const spanCategorias = [... new Set(categorias)]
        .map(categoria => `<span class="tag-pendencias pagamento-balao">${escaparAtributo(categoria || '')}</span>`)
        .join('')

    const tds = `
        <td>${data_vencimento}</td>
        <td>${app || 'AC'}</td>
        <td style="white-space: nowrap; text-align: left;">${dinheiro(valor_documento || 0)}</td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px; min-width: 200px;">
                <img src="${iconePagamento(status)}" style="width: 1.5rem;">
                <label style="text-align: left;">${status}</label>
            </div>
        </td>
        <td>${criado || ''}</td>
        <td>${snapshots?.cliente || ''}</td>
        <td style="text-align: center;">
            <img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" onclick="abrirDetalhesPagamentos('${id}')">
        </td>
        `
    return {
        linha: `<tr>${tds}</tr>`,
        detalhes: `<div class="pagamentos-referencias-detalhes">
            <div><strong>Categorias</strong><div class="pagamento-lista-baloes">${spanCategorias || 'Sem categorias'}</div></div>
            <div><strong>Departamentos</strong><div class="listagem-departamentos">${deps || 'Sem departamentos'}</div></div>
        </div>`
    }
}

function iconePagamento(status) {

    let icone = `interrogacao`
    switch (true) {

        case (status == 'PAGO' || status == 'RECEBIDO'):
            icone = 'concluido'
            break
        case status == 'A VENCER':
            icone = 'avencer'
            break
        case status == 'VENCE HOJE':
            icone = 'vencehoje'
            break
        case status.includes('Aprovado'):
            icone = 'joinha'
            break
        case status.includes('Reprovado'):
            icone = 'desjoinha'
            break
        case status.includes('Excluído'):
            icone = 'alerta'
            break
        case status.includes('ATRASADO'):
            icone = 'atrasado'
            break
        case status == 'Aguardando aprovação da Diretoria':
            icone = 'diretoria'
            break
        case status == 'Aguardando aprovação da Gerência':
            icone = 'gerente'
            break
        case status == 'Processando...':
            icone = 'salvo'
            break
        case status == 'TODOS':
            icone = 'todos'
            break
    }

    return `imagens/${icone}.png`
}

async function abrirDetalhesPagamentos(id) {

    try {
        overlayAguarde()

        const modelo = (texto1, elemento) => `
            <div style="${vertical}; gap: 2px;">
                ${texto1 ? `<span><b>${texto1}</b></span>` : ''}
                ${elemento ? `<div style="${vertical}; text-align: left;">${elemento}</div>` : ''}
            </div>
            `
        const botoes = (icone, nome, funcao) => `
            <div class="btn-detalhes" onclick="${funcao}">
                ${icone}
                <label style="cursor: pointer;">${nome}</label>
            </div>
            `
        const iconePasta = `<svg class="btn-detalhes-icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v1H2V5z"/><path d="M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z"/></svg>`
        const modListagem = (listagem) => `
            <div style="${vertical}; width: 100%; border-radius: 8px; overflow: hidden;">
                <div class="bloco-arredondado">${listagem}</div>
            </div>
        `
        const { permissao, usuario } = acesso
        const pagamento = await recuperarDado('lista_pagamentos', id) || {}

        const valoresPorCategoria = (pagamento?.snapshots?.categorias || [])
            .map(({ categoria, valor }) =>
                `<label style="margin-left: 1rem; text-align: left;"><b>${dinheiro(valor)}</b> - ${categoria}</label>`
            )
            .join('')

        const anexos = Object.entries(pagamento?.anexos || {})
            .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoPagamento('${id}', '${idAnexo}')`))
            .join('')

        const historico = Object.entries(pagamento?.historico || {})
            .map(([, justificativa]) => `
                <div class="vitrificado" style="border: 1px solid ${imagemEspecifica(justificativa).cor}">
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                        <label><strong>Status </strong>${justificativa.status}</label>
                        <label><strong>Usuário </strong>${justificativa.usuario}</label>
                        <label><strong>Data </strong>${justificativa.data}</label>
                        <label><strong>Justificativa</strong> ${justificativa.justificativa.replace(/\n/g, "<br>")}</label>
                    </div>
                    <img src="${imagemEspecifica(justificativa).imagem}">
                </div>
            `
            )
            .join('')

        // Edição de Status;
        const divStatus = (permissao == 'adm')
            ? `
                <select onchange="alterarStatusPagamento('${id}', this)">
                    ${opcoesStatus.map(op => `<option ${pagamento.status == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
            : `<label>${pagamento.status}</label>`;

        const depPagam = pagamento.snapshots?.departamentos?.map(d => ({ cCodDep: d.departamento })) || []

        // Orçamentos & chamados vinculados;
        const resultados = await Promise.all(
            depPagam.map(async (dep) => {
                const cc = { descricao: dep.cCodDep }

                const pesquisa = await pesquisarDB({
                    base: 'mvw_dados_orcamentos',
                    filtros: {
                        'dados_orcam.contrato': { op: '=', value: cc.descricao }
                    }
                })

                return pesquisa.resultados || []
            })
        )

        const vinculados = resultados.flat()

        const btnsOrcamentos = vinculados
            .map(({ cliente, total_geral, id }) => {
                return botoes(iconePasta, `${cliente || '...'} 
                <br>${dinheiro(total_geral)}`, `abrirAtalhos('${id}')`)
            })
            .join('')

        // Ações do pagamento vão para o rodapé padrão do popup.
        const liberados = ['adm', 'diretoria']
        const acoesRodape = [
            { texto: 'Duplicar Pagamento', img: 'reembolso', funcao: `duplicarPagamento('${id}')` }
        ]

        // Pagamento migrado LPU
        const idLpuParceiro = pagamento.lpu_parceiro_id || id
        const lpuParceiro = await recuperarDado('parceiros', idLpuParceiro)
        if (lpuParceiro)
            acoesRodape.push({ texto: 'Ver LPU Parceiro', img: 'tecnico', funcao: `gerarPdfParceiro('${idLpuParceiro}', true)` })

        if (liberados.includes(permissao) || pagamento.criado == usuario)
            acoesRodape.push({ texto: 'Editar Pagamento', img: 'editar', funcao: `editarPagamento('${id}')` })

        if (liberados.includes(permissao))
            acoesRodape.push(
                { texto: 'Reimportar Anexos no Omie', img: 'anexo', funcao: `reprocessarAnexos('${id}')` },
                { texto: 'Excluir pagamento', img: 'cancel', funcao: `confirmarExclusaoPagamento('${id}')` }
            )

        const deps = (pagamento?.snapshots?.departamentos || [])
            .map(({ departamento, valor }) => {
                return `
                    <div style="${horizontal}; justify-content: start; gap: 2px;">
                        <button onclick="painelCustos('${departamento}')">Ver Custos</button>
                        <span><b>${departamento}</b> → ${dinheiro(valor)}</span>
                    </div>
            `
            }).join('')

        const acumulado = `
        
            <div class="balao">

                <div style="${vertical}; gap: 2px;">
                    <button onclick="autorizarPagamentos('S', '${id}')">Aprovar</button>
                    <button style="background-color: #b12425 ;" onclick="autorizarPagamentos('N', '${id}')">Reprovar</button>
                </div>

                <textarea id="justificativa" placeholder="Descreva o motivo da aprovação ou reprovação"></textarea>

            </div>

            <div class="detalhes-pagamento">

                ${modListagem(btnsOrcamentos)}

                ${modListagem(
            modelo('Valor Total do Pagamento', `<span class="valor-total-pagamento">${dinheiro(parametroPagamento(pagamento).valor_documento)}</span>`)
        )}

                ${modListagem(
            modelo('Por Departamento', deps)
        )}

                ${modListagem(
            modelo('Por Categoria', valoresPorCategoria)
        )}

                ${modListagem(`
                    ${modelo('Status Atual', divStatus)}
                    ${modelo('Quem recebe', pagamento?.snapshots?.cliente || '')}
                    ${modelo('Data de Solicitação', pagamento?.data_registro || '')}
                    ${modelo('Data de Pagamento', parametroPagamento(pagamento).data_vencimento)}
                    ${modelo('Chave PIX', escaparAtributo(parametroPagamento(pagamento).chave_pix || ''))}
                    ${modelo('Observação', parametroPagamento(pagamento).observacao)}
                    ${modelo('Anexos', `
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0;">
                            <label for="anexoPagamento" style="text-decoration: underline; cursor: pointer;">
                                Incluir Anexo
                                <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this, '${id}')" multiple>
                            </label>
                            <div class="detalhes-anexos">
                                ${anexos}
                            </div>
                        </div>
                        `)}
                    `)}

                <label><b>Histórico</b></label>

                ${historico}

            </div>
        `

        const telaDetalhes = document.querySelector('.tela-detalhes')
        if (telaDetalhes) {
            removerOverlay()
            return telaDetalhes.innerHTML = acumulado
        }

        popup({ elemento: `<div class="tela-detalhes">${acumulado}</div>`, titulo: 'Detalhes do Pagamento', botoes: acoesRodape })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir detalhes do pagamento: Fale com o suporte.' })
    }

}

async function alterarStatusPagamento(idPagamento, select) {

    const pagamento = await recuperarDado('lista_pagamentos', idPagamento)
    if (!/reprovad|cancelad|excluíd|excluid/i.test(select.value)) {
        try { await validarSaldoPagamentoParceiro(pagamento, idPagamento) }
        catch (erro) { select.value = pagamento.status; return popup({ mensagem: erro.message }) }
    }
    await enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

}

async function confirmarExclusaoPagamento(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPagamento('${id}')` }
    ]

    popup({ mensagem: 'Você tem certeza que deseja excluir?', botoes })

}

function respostaPositivaExclusaoOmie(mensagem) {
    return /pagamento\s+(?:j[aá]\s+inexistente|exclu[ií]do)\s+no\s+omie/i.test(String(mensagem || ''))
}

async function excluirPagamento(id) {

    removerTodosPopups()

    overlayAguarde()

    try {
        const pagamento = await recuperarDado('lista_pagamentos', id)

        if (!pagamento)
            throw new Error('Pagamento não localizado.')

        const resposta = await excluirPagamentoOmie(id, pagamento.app)

        if (resposta?.mensagem && !respostaPositivaExclusaoOmie(resposta.mensagem))
            throw new Error(resposta.mensagem)

        if (pagamento.lpu_parceiro_id && pagamento.solicitacao_parceiro_id !== pagamento.lpu_parceiro_id) {
            const parceiro = await recuperarDado('parceiros', pagamento.lpu_parceiro_id)
            const solicitacao = parceiro?.solicitacoes?.[pagamento.solicitacao_parceiro_id]
            if (solicitacao?.ocorrencia_id)
                await salvarEtapaParceiro(`dados_ocorrencias/${solicitacao.ocorrencia_id}/correcoes/${id}_cancelamento`, {
                    aba: id, tipoCorrecao: 'WRuo2', data: dataServidor().toLocaleString(), usuario: acesso.usuario,
                    descricao: 'Pagamento parcial cancelado pelo financeiro; saldo liberado.'
                })
            await salvarEtapaParceiro(`parceiros/${pagamento.lpu_parceiro_id}/solicitacoes/${pagamento.solicitacao_parceiro_id}`, {
                ...solicitacao, status: 'Cancelada pelo financeiro', pagamento_cancelado: pagamento,
                cancelado_por: acesso.usuario, cancelado_em: dataServidor().toLocaleString()
            })
        }
        await deletar(`lista_pagamentos/${id}`)

        removerPopup()

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao excluir pagamento.' })
    } finally {
        removerOverlay()
    }

}

async function removerAnexoPagamento(id, anx) {

    const pagamento = await recuperarDado('lista_pagamentos', id)

    if (pagamento.anexos && pagamento.anexos[anx]) {

        delete pagamento.anexos[anx]

        await deletar(`lista_pagamentos/${id}/anexos/${anx}`)
        await abrirDetalhesPagamentos(id)
    }

}

async function removerAnexoParceiro(id, campo, anx) {

    await deletar(`lista_pagamentos/${id}/anexos_parceiros/${campo}/${anx}`)
    await abrirDetalhesPagamentos(id)

}

async function autorizarPagamentos(resposta, id) {

    try {

        overlayAguarde()

        const justificativa = document.getElementById('justificativa').value

        const { usuario, permissao } = acesso || {}

        const status = resposta == 'S'
            ? `Aprovado por ${permissao}`
            : `Reprovado por ${permissao}`

        const pagamento = await recuperarDado('lista_pagamentos', id) || {}
        const { historico } = pagamento
        if (resposta == 'S') await validarSaldoPagamentoParceiro(pagamento, id)

        await enviar(`lista_pagamentos/${id}`, {
            status,
            historico: {
                ...historico,
                [crypto.randomUUID()]: {
                    status,
                    usuario,
                    justificativa,
                    data: dataServidor().toLocaleString('pt-BR')
                }
            }
        })

        await abrirDetalhesPagamentos(id)


    } catch (err) {
        popup({ mensagem: err.message || 'Ocorreu um erro ao processar a solicitação. Tente novamente.' })
    }

}

async function salvarPagamento() {

    try {
    overlayAguarde()

    const resposta = await calculadoraPagamento()

    if (resposta?.mensagem)
        return popup({ mensagem: resposta.mensagem })

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const pix = document.querySelector('[name="chave_pix"]')
    if (!pix.value.trim() || !document.querySelector('[name="confirmar_pix"]').checked)
        return popup({ mensagem: 'Informe e confirme a chave PIX do recebedor.' })
    if (pix.dataset.cliente !== document.querySelector('[name="recebedor"]').id)
        return popup({ mensagem: 'Aguarde a consulta PIX ou selecione o recebedor novamente.' })
    const anexoPagamento = document.getElementById('aPagamentos')
    const anexos = await importarAnexos({ input: anexoPagamento })

    if (anexos.mensagem)
        return popup({ mensagem: anexos.mensagem })

    ultimoPagamento.anexos = {
        ...ultimoPagamento.anexos,
        ...Object.fromEntries(
            anexos.map(a => [a.link, a])
        )
    }

    // Verificar se na observação contém a primeira linha "Solicitante"
    const observacao = ultimoPagamento.param_estavel.observacao
    const identificacao = 'Solicitante:'
    if (!observacao.includes(identificacao))
        ultimoPagamento.param_estavel.observacao = `${identificacao} ${acesso.usuario} \n ${observacao}`

    ultimoPagamento.status = 'Processando...'

    try {

        const id = ultimoPagamento.id || crypto.randomUUID()
        await validarSaldoPagamentoParceiro(ultimoPagamento, id)
        const resultado = await enviar(`lista_pagamentos/${id}`, ultimoPagamento)
        if (!resultado?.success) throw new Error(resultado?.mensagem || "Falha ao salvar pagamento.")

        localStorage.removeItem('ultimoPagamento')

        removerPopup(null, false) // Remove tudo;
        await abrirDetalhesPagamentos(id)

        popup({ imagem: 'imagens/concluido.png', tempo: 5, mensagem: 'Pagamento Salvo' })

    } catch (e) {
        console.log(e)
        popup({ mensagem: e.message || 'Falha ao salvar ou ao abrir o pagamento, verifique com o suporte.' })
    }

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao salvar pagamento.' })
    } finally {
        removerOverlay()
    }
}

async function formularioPagamento() {

    try {

        overlayAguarde()

        const totalPagamento = document.getElementById('totalPagamento')

        if (totalPagamento)
            return

        const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
        if (ultimoPagamento.param && !ultimoPagamento.param_estavel) {
            return popup({ mensagem: 'Rascunho antigo: recomece para selecionar as referencias estaveis.', botoes: [{ texto: 'Recomeçar', funcao: 'apagarPagamento()' }] })
        }
        const {
            app,
            id,
            status,
            anexos
        } = ultimoPagamento

        // Verificação se esse pagamento já subiu pro Omie;
        if (status && status.includes('PAGO')) {
            apagarPagamento()
            return popup({ mensagem: 'Este pagamento já foi pago, não pode ser alterado!' })
        }

        const {
            observacao = '',
            categorias = [],
            distribuicao = [],
            valor_documento = 0,
            data_vencimento,
            codigo_cliente_fornecedor
        } = ultimoPagamento.param_estavel || {}

        const { nome, chave_pix: pixCadastro = '' } = codigo_cliente_fornecedor
            ? await recuperarDado('clientes', codigo_cliente_fornecedor) || {}
            : {}

        const [dia, mes, ano] = data_vencimento
            ? data_vencimento.split('/')
            : dataRegras(null, 0).split('/')

        const dtVencimento = `${ano}-${mes}-${dia}`

        controlesCxOpcoes.recebedor = {
            base: 'clientes',
            retornar: ['nome'],
            funcaoAdicional: ['atualizarPixPagamento'],
            colunas: {
                'Nome': { chave: 'nome' },
                'CNPJ/CPF': { chave: 'cnpj' },
                'Cidade': { chave: 'cidade' },
                'Estado': { chave: 'estado' }
            }
        }

        const linhas = [
            {
                texto: '<span style="padding-right: 2rem;"><b>IAC</b> Apenas reembolso para funcionário</span>',
                elemento: `
                <select name="app" onchange="calculadoraPagamento()">
                    ${empresas.map(op => `<option ${app == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
            },
            {
                texto: 'Recebedor',
                elemento: `
            <div style="${horizontal}; gap: 1rem;">
                <span 
                class="opcoes" 
                name="recebedor"
                ${codigo_cliente_fornecedor ? `id="${escaparAtributo(codigo_cliente_fornecedor)}"` : ''}
                onclick="cxOpcoes('recebedor')">
                    ${escaparAtributo(nome || 'Selecione')}
                </span>
                <img onclick="formularioCliente()" src="imagens/baixar.png">
            </div>
            `
            },
            {
                texto: 'Chave PIX',
                elemento: `<div style="${vertical}; gap: 5px;">
                    <textarea name="chave_pix" rows="3" style="resize: vertical; width: 100%; box-sizing: border-box;" data-cliente="${escaparAtributo(codigo_cliente_fornecedor || '')}"
                        placeholder="Informe a chave PIX" oninput="document.querySelector('[name=confirmar_pix]').checked = false; calculadoraPagamento()">${escaparAtributo(ultimoPagamento.param_estavel?.chave_pix ?? pixCadastro)}</textarea>
                    <label><input type="checkbox" name="confirmar_pix" onchange="calculadoraPagamento()"> Conferi com o recebedor e confirmo esta chave PIX.</label>
                </div>`
            },
            {
                texto: 'Observação',
                elemento: `
            <textarea rows="3" style="resize: vertical; width: 70%;" name="observacao" oninput="calculadoraPagamento()">${escaparAtributo(observacao || '')}</textarea>`
            },
            {
                texto: 'Centro de Custo',
                elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" style="width: 1.5rem; cursor: pointer;" onclick="maisCampo({ base: 'departamentos' })">
                    <div class="central-departamentos"></div>
                </div>
            `
            },
            {
                texto: 'Categorias',
                elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" style="width: 1.5rem; cursor: pointer;" onclick="maisCampo({ base: 'categorias'})">
                    <div class="central-categorias"></div>
                </div>
            `
            },
            {
                texto: 'Total do Pagamento',
                elemento: `<div id="totalPagamento">${dinheiro(valor_documento)}</div>`
            },
            {
                texto: 'Data de Pagamento',
                elemento: `
            <div style="${horizontal}; gap: 5px;">
                <input type="date" name="dataPagamento" data-editada="${!!ultimoPagamento.data_modificada || !!id}" value="${dtVencimento || ''}" oninput="this.dataset.editada = 'true'; calculadoraPagamento()">
            </div>
            `
            },
            {
                texto: 'Anexos Diversos',
                elemento: `
                <div style="${vertical}; align-items: end; gap: 5px;">

                    <input type="file" id="aPagamentos" multiple>

                    <div id="anexosDiversos" style="${vertical}; gap: 2px;">
                        ${Object.values(anexos || {}).map(anexo => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoTemporario('${anexo.link}')`)).join('')}
                    </div>
                </div>
            `
            }
        ]

        const botoes = [
            { texto: 'Salvar Pagamento', img: 'concluido', funcao: 'salvarPagamento()' },
            { texto: 'Regras', img: 'alerta', funcao: 'duvidas()' },
            { texto: 'Recomeçar', img: 'cancel', funcao: 'apagarPagamento()' }
        ]

        popup({
            linhas,
            botoes,
            conteudoRodape: '<div id="statusPagamento" role="status"></div>',
            titulo: 'Solicitação de Pagamento'
        })

        // Categorias;
        await Promise.all(
            categorias.map(categoria =>
                maisCampo({
                    atualizar: false,
                    id: categoria.codigo_categoria,
                    base: 'categorias',
                    valor: categoria.valor
                })
            )
        )

        // Departamentos;
        await Promise.all(
            distribuicao.map(departamento =>
                maisCampo({
                    atualizar: false,
                    id: departamento.cCodDep,
                    base: 'departamentos',
                    valor: departamento.nValDep
                })
            )
        )

        if (!categorias.length) await maisCampo({ base: 'categorias', atualizar: false })
        if (!distribuicao.length) await maisCampo({ base: 'departamentos', atualizar: false })

        // Verificação inicial;
        await calculadoraPagamento()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao abrir o formulário de pagamento' })
    } finally {
        removerOverlay()
    }

}

function dataRegras(data, atraso) {
    const agora = dataServidor()
    let dataMinima = new Date(agora)

    if (agora.getDay() === 5 && agora.getHours() >= 11) {
        dataMinima.setDate(dataMinima.getDate() + 3)
    } else if (agora.getDay() === 6) {
        dataMinima.setDate(dataMinima.getDate() + 2)
    } else if (agora.getDay() === 0) {
        dataMinima.setDate(dataMinima.getDate() + 1)
    } else if (agora.getHours() >= 11) {
        dataMinima.setDate(dataMinima.getDate() + 1)
    }

    let dataFinal = new Date(dataMinima)

    if (atraso === 1) {
        dataFinal = new Date(agora)
        dataFinal.setDate(dataFinal.getDate() + 7)
    }

    if (atraso === 2) {
        dataFinal = new Date(agora.getFullYear(), agora.getMonth() + 1, 10)
    }

    if (data) {
        const tInformada = toTimestamp(data)

        if (tInformada != null && tInformada > dataFinal.getTime()) {
            dataFinal = new Date(tInformada)
        }
    }

    if (dataFinal < dataMinima) {
        dataFinal = new Date(dataMinima)
    }

    while (dataFinal.getDay() === 0 || dataFinal.getDay() === 6) {
        dataFinal.setDate(dataFinal.getDate() + 1)
    }

    return dataFinal.toLocaleDateString('pt-BR')
}

function atualizarDataSugeridaPagamento() {
    const campo = document.querySelector('[name="dataPagamento"]')
    if (!campo || campo.dataset.editada === 'true') return
    let modalidade = 0
    for (const input of document.querySelectorAll('[name="categorias"]')) {
        const nome = (input.parentElement.nextElementSibling?.textContent || '')
            .toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
        if (/pagamento de parceiros?/.test(nome)) modalidade = 2
        else if (modalidade !== 2 && /adiantamento.*parceiros?/.test(nome)) modalidade = 1
    }
    const [dia, mes, ano] = dataRegras(null, modalidade).split('/')
    campo.value = `${ano}-${mes}-${dia}`
}

async function calculadoraPagamento() {

    atualizarDataSugeridaPagamento()

    const obVal = (name) => {
        const elemento = document.querySelector(`[name="${name}"]`)
        return elemento
    }

    const codigo_cliente_fornecedor = obVal('recebedor').id
    if (!codigo_cliente_fornecedor)
        return { mensagem: 'Recebedor em branco' }

    const observacao = obVal('observacao').value
    const app = obVal('app').value
    const categorias = Object.create(null)
    const distribuicao = Object.create(null)
    let valor_documento = 0
    const totais = {
        cat: 0,
        dep: 0
    }

    // Categorias
    const inputsCat = document.querySelectorAll('[name="categorias"]')
    for (const input of inputsCat) {
        const span = input.parentElement.nextElementSibling
        if (!span.id)
            return { mensagem: 'Não deixe Categorias em branco' }

        const codigo_categoria = span.id
        const valor = Number(input.value)
        if (!Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001)
            return { mensagem: 'Informe valores positivos com até duas casas decimais.' }

        // Totais
        totais.cat += valor
        if (!categorias[codigo_categoria]) {
            categorias[codigo_categoria] = { codigo_categoria, valor }
        } else {
            categorias[codigo_categoria].valor += valor
        }

    }

    // Departamentos
    const inputsDep = document.querySelectorAll('[name="departamentos"]')
    for (const input of inputsDep) {

        const span = input.parentElement.nextElementSibling
        const cCodDep = span.id

        if (!span.id)
            return { mensagem: 'Não deixe Centro de Custo em branco' }

        const nValDep = Number(input.value)
        if (!Number.isFinite(nValDep) || nValDep <= 0 || Math.abs(nValDep * 100 - Math.round(nValDep * 100)) > 0.000001)
            return { mensagem: 'Informe valores positivos com até duas casas decimais.' }

        // Totais
        totais.dep += nValDep
        valor_documento += nValDep

        if (!distribuicao[cCodDep]) {
            distribuicao[cCodDep] = { cCodDep, nValDep }
        } else {
            distribuicao[cCodDep].nValDep += nValDep
        }

    }

    // Verificar categorias [Parceiros] e postergar pagamentos;
    const dataPagamento = obVal('dataPagamento')
    if (!dataPagamento.value) return { mensagem: 'Informe a data de pagamento.' }
    const [anoPagamento, mesPagamento, diaPagamento] = dataPagamento.value.split('-')
    const dataFinal = `${diaPagamento}/${mesPagamento}/${anoPagamento}`

    const ulPSalvo = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    // Se existir status, então o usuário deve saber o que acontece ao salvar;
    const divStatus = document.querySelector('#statusPagamento')

    divStatus.innerHTML = ['A VENCER', 'VENCE HOJE', 'ATRASADO'].includes(ulPSalvo.status)
        ? `
            <div class="alerta-piscando">
                <img src="gifs/alerta.gif">
                <span>Este pagamento já foi lançado no OMIE, <br>
                então editando agora ele pode precisar ser aprovado de novo!</span>
            </div>
        `
        : ''

    const ulP = {
        ...ulPSalvo,
        app,
        data_permitida: true,
        data_modificada: dataPagamento.dataset.editada === 'true',
        data_registro: dataServidor().toLocaleString(),
        param_estavel: {
                codigo_cliente_fornecedor,
                chave_pix: obVal('chave_pix').value.trim(),
                observacao,
                data_previsao: dataFinal,
                data_vencimento: dataFinal,
                valor_documento: Math.round(valor_documento * 100) / 100,
                categorias: Object.values(categorias),
                distribuicao: Object.values(distribuicao)
        }
    }

    delete ulP.param
    ulP.snapshots = {
        ...ulPSalvo.snapshots,
        cliente: obVal('recebedor').textContent.trim(), valor: ulP.param_estavel.valor_documento,
        categorias: Object.values(categorias).map(c => ({ categoria: c.codigo_categoria, valor: c.valor })),
        departamentos: Object.values(distribuicao).map(d => ({ departamento: d.cCodDep, valor: d.nValDep }))
    }
    if (!ulP.criado)
        ulP.criado = acesso.usuario

    localStorage.setItem('ultimoPagamento', JSON.stringify(ulP))

    const dif = Math.round(totais.cat * 100) !== Math.round(totais.dep * 100)
    const labelTotal = document.getElementById('totalPagamento')

    let divPag = `<span style="font-size: 1.5rem;">${dinheiro(valor_documento)}</span>`

    if (dif) {

        const mod = (t1, t2) => `
            <div style="${vertical}; gap: 2px;">
                <span>${t1}</span>
                <span style="font-size: 1.5rem;">${dinheiro(t2)}</span>
            </div>
        `

        divPag = `
        <div style="${horizontal}; gap: 1rem;">

            ${mod('Centro de Custo', totais.dep)}

            <img src="imagens/diferente.png">

            ${mod('Categorias', totais.cat)}

            <img src="imagens/diferente.png">

            ${mod('Diferença', Math.abs(totais.dep - totais.cat))}

        </div>
        `
        labelTotal.innerHTML = divPag
        return { mensagem: 'Existe uma diferença entre Centro de custo x Categorias' }

    }

    labelTotal.innerHTML = divPag

    if (valor_documento == 0)
        return { mensagem: 'Pagamento sem valor' }


}

async function maisCampo({ valor = '', base, id, atualizar = true }) {

    if (!base) return

    const aleatorio = crypto.randomUUID()
    const span = `<span class="opcoes" name="${aleatorio}" ${id ? `id="${escaparAtributo(id)}"` : ''} onclick="cxOpcoes('${aleatorio}')">${escaparAtributo(id || 'Selecionar')}</span>`
    controlesCxOpcoes[aleatorio] = {
        base: base === 'categorias' ? 'mesc_categorias' : 'mesc_departamentos',
        retornar: ['id'], colunas: { 'Descrição': { chave: 'id' } },
        funcaoAdicional: ['calculadoraPagamento']
    }

    const campoAdicional = `
        <div data-id="${aleatorio}" style="${horizontal}; justify-content: start; margin-right: 1rem;">

            <div style="${horizontal}; gap: 5px;">
                <span>R$</span> 
                <input name="${base}" value="${valor || ''}" type="number" min="0.01" step="0.01" oninput="calculadoraPagamento()" placeholder="0,00">
            </div>

            ${span}

            <label src="imagens/cancel.png" 
            style="cursor: pointer; width: 1.5rem; font-size: 2.0rem;" 
            onclick="removerCampo(this)">
                &times;
            </label>

        </div>
    `

    document.querySelector(`.central-${base}`).insertAdjacentHTML('beforeend', campoAdicional)

    if (atualizar)
        await calculadoraPagamento()

}

async function removerCampo(xis) {
    xis.parentElement.remove()

    const idAleatorio = xis.parentElement.dataset.id
    delete controlesCxOpcoes[idAleatorio]

    await calculadoraPagamento()
}

async function apagarPagamento() {
    localStorage.removeItem('ultimoPagamento')
    removerPopup()
    await formularioPagamento()
}

function duvidas() {
    const elemento = `
        <div style="${vertical}; text-align: left; padding: 1rem;">
            <label>
                • A data é sugerida automaticamente e pode ser alterada livremente no formulário;<br>
                • Pagamentos de <strong>qualquer valor</strong> passam por aprovação;<br>
                • Para pagamento de parceiro, a sugestão é o dia <strong>10 do mês seguinte</strong>;<br>
                • Para adiantamento de parceiro, a sugestão é uma semana à frente;<br>
                • No lançamento, datas em dias não úteis avançam para o próximo dia útil. Para hoje, a aprovação final deve ocorrer até as <strong>11h</strong>.
            </label>
        </div>
    `

    popup({ elemento, titulo: 'Informações Importantes' })
}

async function salvarAnexosPagamentos(input, id) {

    const anexos = await importarAnexos({ input })

    for (const anexo of anexos) {
        await enviar(`lista_pagamentos/${id}/anexos/${anexo.link}`, anexo)
    }

    await abrirDetalhesPagamentos(id)
    removerOverlay()

}

async function removerAnexoTemporario(link) {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {};
    delete ultimoPagamento.anexos[link]
    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))
    document.querySelector(`[name="${link}"]`).remove()
    await calculadoraPagamento()

}

function compararDatas(data1, data2) {
    const d1 = new Date(data1);
    const d2 = new Date(data2);

    const maior = data1 == '' ? data2 : d1.getTime() > d2.getTime() ? data1 : data2;

    return maior;
}


async function duplicarPagamento(id) {

    overlayAguarde()
    const pagamento = await recuperarDado('lista_pagamentos', id)
    if (pagamento?.lpu_parceiro_id)
        return popup({ mensagem: 'Para manter o saldo e as aprovações, solicite outro pagamento parcial na LPU.' })
    if (!pagamento.param_estavel) {
        removerOverlay()
        return popup({ mensagem: 'Migre este pagamento antigo para param_estavel no servidor antes de duplicar.' })
    }
    const param_estavel = { ...pagamento.param_estavel }
    param_estavel.observacao = (param_estavel.observacao || '').replace(`Solicitante: ${pagamento.criado}`, '')
    localStorage.setItem('ultimoPagamento', JSON.stringify({ app: pagamento.app, param_estavel }))

    await formularioPagamento()

    removerOverlay()

}

async function editarPagamento(id) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id)

    if (!pagamento.param_estavel) {
        removerOverlay()
        return popup({ mensagem: 'Migre este pagamento antigo para param_estavel no servidor antes de editar.' })
    }
    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await formularioPagamento()

    removerOverlay()

}


async function baixarExcelRelatorioPagamentos() {

    overlayAguarde()

    const dados = {
        base: "vw_relatorio_pagamentos",
        titulo: `Pagamentos_${agoraServidor()}`,
        formatacao: {
            moedas: ["Valor Documento"]
        }
    }

    try {
        await baixarRelatorioExcel(dados)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function excluirPagamentoOmie(id, app) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/excluir-pagamento`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, app })
    })

    if (!resposta.ok) {
        const texto = await resposta.text()
        let mensagem = texto
        try {
            mensagem = JSON.parse(texto)?.mensagem || texto
        } catch (_) { }
        if (respostaPositivaExclusaoOmie(mensagem))
            return { success: true, mensagem, inexistente_no_omie: true }
        throw new Error(mensagem || 'Falha ao excluir pagamento no servidor.')
    }

    return await resposta.json()
}

// ---------------------------------------------------------------------------
// Pagamentos reprovados de quem está logado (ícone no topo, websocket.js carregarControles).
// - Ícone com contador só aparece se houver algum.
// - Alerta uma vez por pagamento: os já avisados ficam no navegador (localStorage, por usuário).
// - O popup lista cada um com o histórico de justificativas, para decidir entre editar e excluir.
// Excluir aqui usa /pagamentos/excluir-reprovado: só o solicitante e só se estiver reprovado.
// ---------------------------------------------------------------------------

let ultimosPagamentosReprovados = []

async function buscarPagamentosReprovados() {
    const { usuario } = acesso || {}
    if (!usuario) return []
    const { resultados } = await pesquisarDB({
        base: 'lista_pagamentos',
        filtros: {
            criado: { op: '=', value: usuario },
            status: { op: 'includes', value: 'reprovad' }
        },
        limite: 200
    }) || {}
    // O filtro "=" ignora maiúsculas/acentos: confirma o solicitante exato.
    return (resultados || []).filter(p => p.criado === usuario && /^reprovad/i.test(p.status || ''))
}

async function verificarPagamentosReprovados() {
    const atalho = document.getElementById('atalhoReprovados')
    const contador = document.getElementById('contadorReprovados')
    if (!navigator.onLine || !atalho || !contador) return

    try {
        const reprovados = await buscarPagamentosReprovados()
        ultimosPagamentosReprovados = reprovados

        atalho.style.display = reprovados.length ? '' : 'none'
        contador.style.display = reprovados.length ? 'flex' : 'none'
        contador.textContent = reprovados.length || ''

        // Alerta só pelos que ainda não foram avisados neste navegador.
        const chave = `pagamentosReprovadosAvisados_${acesso.usuario}`
        let avisados = []
        try { avisados = JSON.parse(localStorage.getItem(chave) || '[]') } catch { }
        const novos = reprovados.filter(p => !avisados.includes(String(p.id)))
        // Guarda só os que ainda estão reprovados, para a lista não crescer para sempre.
        try { localStorage.setItem(chave, JSON.stringify(reprovados.map(p => String(p.id)))) } catch { }

        if (novos.length)
            popup({
                titulo: 'Pagamento reprovado',
                mensagem: `
                    ${novos.length === 1 ? 'Um pagamento seu foi reprovado' : `${novos.length} pagamentos seus foram reprovados`}.<br>
                    <small>Veja as justificativas e decida se edita e reenvia, ou se exclui.</small>`,
                botoes: [{ texto: 'Ver pagamentos', img: 'pagamento', funcao: 'abrirPagamentosReprovados()' }]
            })
    } catch {
        atalho.style.display = 'none'
    }
}

function historicoJustificativasReprovado(pagamento) {
    const entradas = Object.values(pagamento?.historico || {})
        .filter(h => h && typeof h === 'object')
        .sort((a, b) => toTimestamp(a.data) - toTimestamp(b.data))
    if (!entradas.length)
        return '<p class="reprovado-sem-historico">Sem justificativas registradas.</p>'

    return entradas.map(h => {
        const { cor } = imagemEspecifica(h)
        return `
            <div class="reprovado-justificativa" style="--cor-justificativa: ${cor}">
                <div class="reprovado-justificativa-topo">
                    <b>${escaparAtributo(h.status || '')}</b>
                    <small>${escaparAtributo(h.usuario || '')} · ${escaparAtributo(h.data || '')}</small>
                </div>
                <div class="reprovado-justificativa-texto">${escaparAtributo(h.justificativa || '—').replace(/\n/g, '<br>')}</div>
            </div>`
    }).join('')
}

async function abrirPagamentosReprovados() {
    overlayAguarde()
    let reprovados
    try {
        reprovados = await buscarPagamentosReprovados()
        ultimosPagamentosReprovados = reprovados
    } catch {
        return popup({ mensagem: 'Não foi possível consultar seus pagamentos reprovados.' })
    }

    if (!reprovados.length) {
        verificarPagamentosReprovados()
        return popup({ mensagem: 'Você não tem pagamentos reprovados.', imagem: 'imagens/concluido.png' })
    }

    const cartoes = reprovados.map(p => {
        const id = escaparAtributo(String(p.id))
        const param = p.param_estavel || (Array.isArray(p.param) ? p.param[0] : p.param) || {}
        const valor = Number(p.snapshots?.valor?.[0] ?? param.valor_documento ?? 0)
        const departamentos = (p.snapshots?.departamentos || []).map(d => d.departamento).filter(Boolean)
        const categorias = (p.snapshots?.categorias || []).map(c => c.categoria).filter(Boolean)
        return `
            <div class="reprovado-cartao" data-pagamento="${id}">
                <div class="reprovado-cabecalho">
                    <div>
                        <b>${escaparAtributo(p.snapshots?.cliente || 'Recebedor não informado')}</b>
                        <small>${dinheiro(valor)}${param.data_previsao ? ` · previsto para ${escaparAtributo(param.data_previsao)}` : ''}</small>
                        ${departamentos.length ? `<small>${departamentos.map(escaparAtributo).join(', ')}</small>` : ''}
                        ${categorias.length ? `<small>${categorias.map(escaparAtributo).join(', ')}</small>` : ''}
                    </div>
                    <span class="reprovado-status">${escaparAtributo(p.status)}</span>
                </div>
                <div class="reprovado-historico">${historicoJustificativasReprovado(p)}</div>
                <div class="reprovado-acoes">
                    <button type="button" class="secundario" onclick="abrirDetalhesPagamentos('${id}')">Ver detalhes</button>
                    <button type="button" class="secundario" onclick="editarPagamento('${id}')">Editar e reenviar</button>
                    <button type="button" class="reprovado-excluir" onclick="confirmarExcluirReprovado('${id}')">Excluir</button>
                </div>
            </div>`
    }).join('')

    popup({
        titulo: `Pagamentos reprovados (${reprovados.length})`,
        elemento: `<div class="reprovados-lista">${cartoes}</div>`
    })
}

function confirmarExcluirReprovado(id) {
    popup({
        mensagem: 'Excluir este pagamento reprovado? Ele sai da sua lista e não pode ser reenviado depois.',
        botoes: [{ texto: 'Excluir', img: 'cancel', funcao: `excluirPagamentoReprovado('${id}')` }]
    })
}

async function excluirPagamentoReprovado(id) {
    overlayAguarde()
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/pagamentos/excluir-reprovado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id })
        })
        const dados = await resposta.json().catch(() => ({}))
        if (!resposta.ok || !dados.success)
            throw new Error(dados.mensagem || 'Falha ao excluir o pagamento.')

        removerTodosPopups()
        await verificarPagamentosReprovados()
        // Ainda há outros: reabre a lista atualizada.
        if (ultimosPagamentosReprovados.length) await abrirPagamentosReprovados()
        else popup({ mensagem: 'Pagamento excluído. Não há mais pagamentos reprovados.', imagem: 'imagens/concluido.png' })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}
