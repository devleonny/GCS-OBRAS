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
    const colunas = {
        'Categorias': { chave: 'snapshots.categorias.*.categoria' },
        'Data de Previsão': { chave: 'param.*.data_vencimento', tipoPesquisa: 'data' },
        'Departamentos': { chave: 'snapshots.departamentos.*.departamento' },
        'APP': { chave: 'app', op: '=', tipoPesquisa: 'select' },
        'Valor': { chave: 'snapshots.valor' },
        'Status': { chave: 'status' },
        'Solicitante': { chave: 'criado' },
        'Recebedor': { chave: 'snapshots.cliente' },
        'Detalhes': {}
    }

    const tabela = await modTab({
        pag,
        colunas,
        filtros: {
            criado: { op: '!=', value: 'Integração' }
        },
        funcaoAdicional: ['atualizarPainelEsquerdo'],
        body: 'bodyPagamentos',
        base: 'lista_pagamentos',
        criarLinha: 'criarLinhaPagamento'
    })

    const acumulado = `
        <div class="divPagamentos">

            <div class="painelEsquerdo"></div>

            <div class="painelDireito">

                ${tabela}

            </div>

        </div>
        `

    tela.innerHTML = acumulado

    await paginacao()

    removerOverlay()

}

async function filtrarPagamentos(st) {

    controles.pagamentos.filtros = {
        ...controles?.pagamentos?.filtros,
        status: { op: 'includes', value: st }
    }

    if (st == 'todos')
        delete controles.pagamentos.filtros.status

    await paginacao()

}

async function atualizarPainelEsquerdo() {

    const contagens = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            criado: { op: '!=', value: 'Integração' }
        },
        path: 'status'
    })

    const titulos = Object.entries(contagens)
        .map(([st, qtde]) => {

            return `
            <div class="balao-pagamentos" 
            onclick="filtrarPagamentos('${st}')">
                
                <div class="dir">
                    <img src="${iconePagamento(st)}">
                    <Label>${inicialMaiuscula(st)}</label>
                </div>

                <span class="esq">${qtde}</span>
                
            </div>
            `
        })
        .join('')

    const painelEsquerdo = document.querySelector('.painelEsquerdo')
    if (painelEsquerdo) painelEsquerdo.innerHTML = titulos

}

async function criarLinhaPagamento(pagamento) {

    const { id, criado, app, status, snapshots, param } = pagamento || {}
    const { recebedor, data_vencimento, valor_documento } = param?.[0] || {}

    const deps = (snapshots?.departamentos || [])
        .map(({ departamento }) => {
            return `<span style="text-align: left;">• <b>${departamento || ''}</b></span>`
        })
        .join('')

    const categorias = Object.values(snapshots?.categorias || {})
        .map(({ categoria }) => categoria)

    const spanCategorias = [... new Set(categorias)]
        .map(categoria => `<span class="etiquetas">${categoria}</span>`)
        .join('')

    const tds = `
        <td>
            <div style="display: flex; flex-wrap: wrap; gap: 3px;">${spanCategorias}</div>
        </td>
        <td>${data_vencimento}</td>
        <td>
            <div style="${vertical}; gap: 2px;">
                ${deps}
            </div>
        </td>
        <td>${app || 'AC'}</td>
        <td style="white-space: nowrap; text-align: left;">${dinheiro(valor_documento || 0)}</td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <img src="${iconePagamento(status)}" style="width: 1.5rem;">
                <label style="text-align: left;">${status}</label>
            </div>
        </td>
        <td>${criado || ''}</td>
        <td>${snapshots?.cliente || ''}</td>
        <td style="text-align: center;">
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;" onclick="abrirDetalhesPagamentos('${id}')">
        </td>
        `
    return `<tr>${tds}</tr>`
}

function iconePagamento(status) {

    let icone = `interrogacao`
    switch (true) {

        case status == 'PAGO':
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
        case status == 'todos':
            icone = 'todos'
            break
    }

    return `imagens/${icone}.png`
}

function justificativaHTML(idPagamento) {

    return `
        <div class="balao" style="${horizontal}; width: 100%;">

            <img src="gifs/alerta.gif" style="padding: 1rem;">

            <div style="${vertical}; width: 100%; gap: 3px;">
                <label>Aprovação do pagamento</label>

                <textarea id="justificativa" placeholder="Descreva o motivo da aprovação/reprovação"></textarea>

                <div style="${horizontal}; gap: 1rem">
                    <button onclick="autorizarPagamentos('S', '${idPagamento}')">Aprovar</button>
                    <button style="background-color: #b12425 ;" onclick="autorizarPagamentos('N', '${idPagamento}')">Reprovar</button>
                </div>
            </div>
        </div>
        `
}

async function abrirDetalhesPagamentos(id) {

    overlayAguarde()

    const modelo = (texto1, elemento) => `
        <div style="${vertical}; gap: 2px;">
            <span><b>${texto1}</b></span>
            <div>${elemento}</div>
        </div>`

    let valores = ''
    const { permissao, usuario } = acesso
    const pagamento = await recuperarDado('lista_pagamentos', id) || {}

    const anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoPagamento('${id}', '${idAnexo}')`))
        .join('')

    const btnDetalhes = (img, nome, funcao) => `
        <div class="btnDetalhes" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <label style="cursor: pointer;">${nome}</label>
        </div>`

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
            </div>`)
        .join('')

    for (const item of pagamento.param[0].categorias) {
        const nomeCategoria = (await recuperarDado('categorias', item.codigo_categoria))?.categoria || '?'

        valores += `
        <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
            <label style="text-align: left;"><strong>${dinheiro(item.valor)}</strong> - ${nomeCategoria}</label>
        </div>`
    }

    const divValores = `
        <hr style="width: 100%;">
        <div style="${vertical}">
            <div style="${horizontal}; justify-content: start; gap: 10px;">
                <label style="font-size: 1.5rem;">${dinheiro(pagamento.param[0].valor_documento)}</label>
                <label>Total</label>
            </div>
            ${valores}
        </div>
        <hr style="width: 100%;">
        `

    // Edição de Status;
    const divStatus = (permissao == 'adm')
        ? `
        <select class="selectStatus" onchange="alterarStatusPagamento('${id}', this)">
            ${opcoesStatus.map(op => `<option ${pagamento.status == op ? 'selected' : ''}>${op}</option>`).join('')}
        </select>`
        : `<label>${pagamento.status}</label>`;

    const depPagam = pagamento?.param?.[0]?.distribuicao || []

    // Orçamentos & chamados vinculados;
    const resultados = await Promise.all(
        depPagam.map(async (dep) => {
            const cc = await recuperarDado('departamentos', dep.cCodDep)
            if (!cc) return []

            const pesquisa = await pesquisarDB({
                base: 'dados_orcamentos',
                filtros: {
                    'dados_orcam.contrato': { op: '=', value: cc.descricao }
                }
            })

            return pesquisa.resultados || []
        })
    )

    const vinculados = resultados.flat()

    const btnsOrcamentos = vinculados
        .map(resultado => {
            const total = resultado?.total_geral
                ? dinheiro(resultado?.total_geral)
                : ''
            return btnDetalhes('pasta', `${resultado?.snapshots?.cliente || '...'} 
                <br>${total}`, `abrirAtalhos('${resultado.id}')`)
        }).join('')

    const liberados = ['adm', 'Diretoria']
    const bEspeciais = [
        btnDetalhes('reembolso', 'Duplicar Pagamento', `duplicarPagamento('${id}')`)
    ]

    if (liberados.includes(permissao) || pagamento.criado == usuario)
        bEspeciais.push(btnDetalhes('editar', 'Editar Pagamento', `editarPagamento('${id}')`))

    bEspeciais.push(
        ...(liberados.includes(permissao)
            ? [
                btnDetalhes('cancel', 'Excluir pagamento', `confirmarExclusaoPagamento('${id}')`),
                btnDetalhes('anexo', 'Reimportar Anexos no Omie', `reprocessarAnexos('${id}')`)
            ]
            : []
        )
    )

    const deps = (pagamento?.snapshots?.departamentos || [])
        .map(({ departamento, valor }) => {
            return `
                <div style="${vertical}; gap: 2px; text-align: left;">
                    <span>• <b>${departamento}</b> → ${dinheiro(valor)}</span>
                </div>
            `
        }).join('')

    const acumulado = `
        ${justificativaHTML(id)}

        <div class="detalhes-pagamento">
            <div style="${vertical}; gap: 1px; width: 100%;">
                ${btnsOrcamentos}
                ${bEspeciais.join('')}

            </div>

            <hr>

            ${modelo('Departamentos', deps)}
            ${modelo('Status Atual', divStatus)}
            ${modelo('Quem recebe', pagamento?.snapshots?.cliente || '')}
            ${modelo('Data de Solicitação', pagamento?.data_registro || '')}
            ${modelo('Data de Pagamento', pagamento.param[0].data_vencimento)}

            ${divValores}

            <div id="comentario" class="contorno" style="width: 90%;">
                <div class="contorno-iterno" style="background-color: #ffffffde;">
                    <label style="width: 100%; text-align: left;"><strong>Observações </strong><br> ${(pagamento?.param?.[0]?.observacao || '').replace(/\||\n/g, "<br>")}</label>
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                <label><strong>Anexos</strong> • </label>  
                
                <label for="anexoPagamento" style="text-decoration: underline; cursor: pointer;">
                    Incluir Anexo
                    <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this, '${id}')" multiple>
                </label>

            </div>
            
            <div class="detalhes-anexos">
                ${anexos}
            </div>

            <label><strong>Histórico</strong></label>

            ${historico}

        </div>
        <div class="rodape-detalhes"></div>
    `

    const telaDetalhes = document.querySelector('.tela-detalhes')
    if (telaDetalhes) {
        removerOverlay()
        return telaDetalhes.innerHTML = acumulado
    }

    popup({ elemento: `<div class="tela-detalhes">${acumulado}</div>`, titulo: 'Detalhes do Pagamento' })

}

async function alterarStatusPagamento(idPagamento, select) {

    await enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

}

async function confirmarExclusaoPagamento(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPagamento('${id}')` }
    ]

    popup({ mensagem: 'Você tem certeza que deseja excluir?', botoes })

}

async function excluirPagamento(id) {

    removerTodosPopups()

    overlayAguarde()

    await deletar(`lista_pagamentos/${id}`)

    const resposta = await excluirPagamentoOmie(id)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    removerPopup()

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

        const historico = {
            status,
            usuario,
            justificativa,
            data: new Date().toLocaleString('pt-BR')
        }

        await enviar(`lista_pagamentos/${id}/historico/${crypto.randomUUID()}`, historico)
        await abrirDetalhesPagamentos(id)

        // Aprovação disparada sem precisar aguardar...
        aprovarPagamento(id)

    } catch (err) {
        popup({ mensagem: 'Ocorreu um erro ao processar a solicitação. Tente novamente.' })
    }

}

async function salvarPagamento() {

    overlayAguarde()

    const resposta = await calculadoraPagamento()

    if (resposta?.mensagem)
        return popup({ mensagem: resposta.mensagem })

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const permissao = acesso.permissao
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
    const observacao = ultimoPagamento.param[0].observacao
    const identificacao = 'Solicitante:'
    if (!observacao.includes(identificacao))
        ultimoPagamento.param[0].observacao = `${identificacao} ${acesso.usuario} \n ${observacao}`

    ultimoPagamento.status = 'Processando...'

    try {

        const id = ultimoPagamento.id || crypto.randomUUID()
        await enviar(`lista_pagamentos/${id}`, ultimoPagamento)

        localStorage.removeItem('ultimoPagamento')

        removerPopup(null, false) // Remove tudo;
        await abrirDetalhesPagamentos(id)

        popup({ imagem: 'imagens/concluido.png', tempo: 5, mensagem: 'Pagamento Salvo' })

    } catch (e) {
        console.log(e)
        popup({ mensagem: 'Não foi possível salvar o pagamento, tente novamente.' })
    }

}

async function formularioPagamento() {

    try {

        overlayAguarde()

        const totalPagamento = document.getElementById('totalPagamento')

        if (totalPagamento)
            return

        const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
        const {
            app = 'IAC',
            param,
            data_modificada = null,
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
        } = param?.[0] || {}

        const { nome } = codigo_cliente_fornecedor
            ? await recuperarDado('clientes', codigo_cliente_fornecedor) || {}
            : {}

        const [dia, mes, ano] = data_vencimento
            ? data_vencimento.split('/')
            : new Date().toLocaleDateString().split('/')

        const dtVencimento = `${ano}-${mes}-${dia}`

        controlesCxOpcoes.recebedor = {
            base: 'clientes',
            retornar: ['nome'],
            funcaoAdicional: ['calculadoraPagamento'],
            colunas: {
                'Nome': { chave: 'nome' },
                'CNPJ/CPF': { chave: 'cnpj' },
                'Cidade': { chave: 'cidade' },
                'Estado': { chave: 'estado' }
            }
        }

        const linhas = [
            {
                texto: 'Recebedor',
                elemento: `
            <div style="${horizontal}; gap: 1rem;">
                <span 
                class="opcoes" 
                name="recebedor"
                ${codigo_cliente_fornecedor ? `id="${codigo_cliente_fornecedor}"` : ''}
                onclick="cxOpcoes('recebedor')">
                    ${nome || 'Selecione'}
                </span>
                <img onclick="formularioCliente()" src="imagens/baixar.png">
            </div>
            `
            },
            {
                texto: 'Observação <br>ou Chave Pix <br>ou Boleto',
                elemento: `
            <textarea rows="3" style="resize: vertical; width: 70%;" name="observacao" oninput="calculadoraPagamento()">${observacao || ''}</textarea>`
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
                texto: '<span style="padding-right: 2rem;"><b>IAC</b> Apenas reembolso para funcionário</span>',
                elemento: `
                <select name="app" onchange="calculadoraPagamento(); alterarAPP(this.value)">
                    ${empresas.map(op => `<option ${app == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
            },
            {
                texto: 'Data de Pagamento',
                elemento: `
            <div style="${horizontal}; gap: 5px;">
                <input readOnly="${data_modificada ? 'false' : 'true'}" type="date" name="dataPagamento" value="${dtVencimento || ''}" oninput="calculadoraPagamento()">
                <input name="dataModificada" oninput="calculadoraPagamento()" ${data_modificada ? 'checked' : ''} type="checkbox" style="width: 1.5rem; height: 1.5rem;">
                <span>Data editável</span>
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
            },
            {
                elemento: '<div id="statusPagamento"></div>'
            }
        ]

        const botoes = [
            { texto: 'Salvar Pagamento', img: 'concluido', funcao: 'salvarPagamento()' },
            { texto: 'Regras', img: 'alerta', funcao: 'duvidas()' },
            { texto: 'Recomeçar', img: 'cancel', funcao: 'apagarPagamento()' }
        ]

        popup({ linhas, botoes, titulo: 'Solicitação de Pagamento' })

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

        // Verificação inicial;
        await alterarAPP(app)
        await calculadoraPagamento()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao abrir o formulário de pagamento' })
    }

}

async function alterarAPP(app) {
    for (const [id, controle] of Object.entries(controlesCxOpcoes)) {
        if (typeof controle == 'string')
            continue

        controle.filtros ??= {}
        controle.filtros.app = { op: '=', value: app }
    }

    const spanCategorias = [...document.querySelectorAll('.central-categorias span')]
    const spanDepartamentos = [...document.querySelectorAll('.central-departamentos span')]
    const recebedorEl = document.querySelector('[name="recebedor"]')
    const recebedor = recebedorEl?.textContent?.trim()

    // Categorias;
    const verificarCategorias = spanCategorias
        .filter(span => span.id)
        .map(async (span) => {
            const textoSpan = span.textContent

            const { resultados } = await pesquisarDB({
                base: 'categorias',
                filtros: {
                    app: { op: '=', value: app },
                    categoria: { op: '=', value: textoSpan }
                }
            })

            const { categoria, id } = resultados[0] || {}

            if (id) {
                span.id = id
                span.textContent = categoria
                span.style.backgroundColor = '#097fe6'
            } else {
                span.style.backgroundColor = '#ff0000'
            }
        })

    // Departamentos;
    const verificarDepartamentos = spanDepartamentos
        .filter(span => span.id)
        .map(async (span) => {
            const textoSpan = span.textContent

            const { resultados } = await pesquisarDB({
                base: 'departamentos',
                filtros: {
                    app: { op: '=', value: app },
                    descricao: { op: '=', value: textoSpan }
                }
            })

            const { descricao, codigo } = resultados[0] || {}

            if (codigo) {
                span.id = codigo
                span.textContent = descricao
                span.style.backgroundColor = '#097fe6'
            } else {
                span.style.backgroundColor = '#ff0000'
            }
        })

    // Recebedor;
    const verificarRecebedor = (async () => {
        if (!recebedorEl || !recebedor || !recebedorEl.id)
            return

        const { cnpj } = await recuperarDado('clientes', recebedorEl.id) || {}
        const { resultados } = await pesquisarDB({
            base: 'clientes',
            filtros: {
                app: { op: '=', value: app },
                cnpj: { op: '=', value: cnpj }
            }
        })

        const cliente = resultados[0]

        if (cliente?.id) {
            recebedorEl.id = cliente.id
            recebedorEl.textContent = cliente.nome || recebedor
            recebedorEl.style.backgroundColor = '#097fe6'
        } else {
            recebedorEl.style.backgroundColor = '#ff0000'
        }
    })()

    await Promise.all([
        verificarRecebedor,
        ...verificarCategorias,
        ...verificarDepartamentos
    ])
}

function dataRegras(data, atraso) {
    const agora = new Date()
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
        dataFinal.setDate(dataFinal.getDate() + 8)
    }

    if (atraso === 2) {
        const dia = dataFinal.getDate()
        const ano = dataFinal.getFullYear()
        const mes = dataFinal.getMonth()

        const mesAlvo = dia <= 5 ? mes : mes + 1
        dataFinal = new Date(ano, mesAlvo, 10)

        while (dataFinal.getDay() === 0 || dataFinal.getDay() === 6) {
            dataFinal.setDate(dataFinal.getDate() + 1)
        }
    }

    if (data) {
        const tInformada = toTimestamp(data) // aceita yyyy-mm-dd
        if (tInformada != null) {
            const tFinal = dataFinal.getTime()
            if (tInformada > tFinal) dataFinal = new Date(tInformada)
        }
    }

    if (dataFinal < dataMinima) dataFinal = dataMinima

    return dataFinal.toLocaleDateString('pt-BR')
}

async function calculadoraPagamento() {

    const obVal = (name) => {
        const elemento = document.querySelector(`[name="${name}"]`)
        return elemento
    }

    const codigo_cliente_fornecedor = Number(obVal('recebedor').id)
    if (!codigo_cliente_fornecedor)
        return { mensagem: 'Recebedor em branco' }

    const observacao = obVal('observacao').value
    const app = obVal('app').value
    const categorias = {}
    const distribuicao = {}
    let valor_documento = 0
    let atraso = 0
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

        // Totais
        totais.cat += valor
        if (!categorias[codigo_categoria]) {
            categorias[codigo_categoria] = { codigo_categoria, valor }
        } else {
            categorias[codigo_categoria].valor += valor
        }

        // Atrasos por regra;
        if (atraso == 0 && span.textContent.includes('Adiantamento'))
            atraso = 1
        else if (span.textContent == 'Pagamento de Parceiros')
            atraso = 2
    }

    // Departamentos
    const inputsDep = document.querySelectorAll('[name="departamentos"]')
    for (const input of inputsDep) {

        const span = input.parentElement.nextElementSibling
        const cCodDep = Number(span.id)

        if (!span.id)
            return { mensagem: 'Não deixe Centro de Custo em branco' }

        const nValDep = Number(input.value)

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
    const dataModificada = obVal('dataModificada')
    const dataPagamento = obVal('dataPagamento')
    const hoje = new Date().toISOString().slice(0, 10)
    const dataCalculada = dataRegras(hoje, atraso)

    let dataFinal = null
    let dataPermitida = true

    if (dataModificada.checked) {
        const dataEscolhida = dataPagamento.value
        const [diaRegra, mesRegra, anoRegra] = dataCalculada.split('/')
        const dataRegraISO = `${anoRegra}-${mesRegra}-${diaRegra}`

        dataPermitida = !!dataEscolhida && new Date(dataEscolhida).getTime() >= new Date(dataRegraISO).getTime()

        const [ano, mes, dia] = dataEscolhida.split('-')
        dataFinal = `${dia}/${mes}/${ano}`

        dataPagamento.readOnly = false
    } else {
        dataFinal = dataCalculada
        dataPermitida = true

        const [dia, mes, ano] = dataCalculada.split('/')
        dataPagamento.readOnly = true
        dataPagamento.value = `${ano}-${mes}-${dia}`
    }

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
        data_permitida: dataPermitida,
        data_modificada: dataModificada?.checked,
        data_registro: new Date().toLocaleString(),
        param: [
            {
                codigo_cliente_fornecedor,
                observacao,
                data_previsao: dataFinal,
                data_vencimento: dataFinal,
                valor_documento,
                categorias: Object.values(categorias),
                distribuicao: Object.values(distribuicao)
            }
        ]
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

    const { app = 'IAC' } = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    const aleatorio = crypto.randomUUID()
    let elemento = {}

    if (base == 'categorias') {

        const pesquisa = await pesquisarDB({
            base,
            filtros: {
                app: { op: '=', value: app },
                id: { op: '=', value: id }
            }
        })

        elemento = pesquisa.resultados?.[0] || {}

    } else {
        elemento = await recuperarDado(base, id)
    }

    const esquema = {
        categorias: {
            retornar: ['categoria'],
            filtroPesquisa: true,
            filtros: {
                app: { op: '=', value: app }
            },
            colunas: {
                'Categoria': { chave: 'categoria' }
            },
            span: `
                <span 
                    class="opcoes" 
                    name="${aleatorio}" 
                    ${id ? `id="${id}"` : ''}
                    onclick="cxOpcoes('${aleatorio}')">
                        ${elemento?.categoria || 'Selecionar'}
                </span>`
        },
        departamentos: {
            retornar: ['descricao'],
            filtros: {
                app: { op: '=', value: app }
            },
            colunas: {
                'Descrição': { chave: 'descricao' }
            },
            span: `
                <span
                    class="opcoes"
                    name="${aleatorio}"
                    ${id ? `id="${id}"` : ''}
                    onclick="cxOpcoes('${aleatorio}')">
                        ${elemento?.descricao || 'Selecionar'}
                </span>`
        }
    }

    controlesCxOpcoes[aleatorio] = {
        ...esquema[base],
        base,
        funcaoAdicional: ['calculadoraPagamento']
    }

    const campoAdicional = `
        <div data-id="${aleatorio}" style="${horizontal}; justify-content: start; margin-right: 1rem;">

            <div style="${horizontal}; gap: 5px;">
                <span>R$</span> 
                <input name="${base}" value="${valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            </div>

            ${esquema[base].span}

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
                • Após às <strong>11h</strong> será lançado no dia útil seguinte;<br>
                • Maior que <strong>R$ 500,00</strong> passa por aprovação;<br>
                • Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada mês,<br>
                e será pago dia <strong>10</strong> do mês seguinte;<br>
                • Adiantamento de parceiro, o pagamento ocorre em até 8 dias.
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
    const assinatura = `Solicitante: ${pagamento.criado}`

    delete pagamento.id
    delete pagamento.criado
    delete pagamento.param[0].codigo_lancamento_integracao
    delete pagamento.historico
    delete pagamento.status

    pagamento.param[0].observacao = pagamento.param[0].observacao.replace(assinatura, '')

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await formularioPagamento()

    removerOverlay()

}

async function editarPagamento(id) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id)

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await formularioPagamento()

    removerOverlay()

}


async function baixarExcelRelatorioPagamentos() {

    overlayAguarde()

    const schema = {
        view: "vw_relatorio_pagamentos",
        titulo: "pagamentos.xlsx",

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {
            moedas: ["Valor Documento"]
        }
    }

    try {
        await baixarRelatorioExcel(schema, `Pagamentos_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function aprovarPagamento(id) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/aprovar-pagamento`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}

async function excluirPagamentoOmie(id) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/excluir-pagamento`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}