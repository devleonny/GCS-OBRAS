let idP = null

const opcoesStatus = [
    '',
    'Aguardando aprovação da Diretoria',
    'Aguardando aprovação da Gerência',
    'Pagamento Excluído',
    'Processando...'
]

function imagemEspecifica(justificativa) {

    const nomeStatus = String(justificativa.status).toLowerCase()

    let cor = '#222'
    let imagem = "imagens/remover.png"
    if (nomeStatus.includes('aprovado')) {
        cor = '#4CAF50'
        imagem = "imagens/concluido.png"

    } else if (nomeStatus.includes('reprovado')) {
        cor = '#B12425'
        imagem = "imagens/remover.png"

    } else if (nomeStatus.includes('aguardando')) {
        cor = '#D97302'
        imagem = "imagens/avencer.png"

    } else if (nomeStatus.includes('aguardando')) {
        cor = '#D97302'
        imagem = "imagens/avencer.png"

    } else {
        cor = '#B12425'
    }

    return { imagem, cor }

}

async function telaPagamentos() {

    mostrarMenus(false)

    const pag = 'pagamentos'
    const colunas = {
        'Data de Previsão': { chave: 'param.*.data_vencimento' },
        'Departamentos': { chave: 'snapshots.departamentos' },
        'APP': { chave: 'app', op: '=' },
        'Valor': { chave: 'snapshots.valor' },
        'Status': { chave: 'status' },
        'Solicitante': { chave: 'criado' },
        'Setor': '',
        'Recebedor': { chave: 'snapshots.cliente' },
        'Detalhes': ''
    }

    const tabela = await modTab({
        pag,
        colunas,
        funcaoAdicional: ['atualizarPainelEsquerdo'],
        body: 'bodyPagamentos',
        base: 'lista_pagamentos',
        criarLinha: 'criarLinhaPagamento',
    })

    const acumulado = `
        <div class="divPagamentos">

            <div class="painelEsquerdo"></div>

            <div class="painelDireito">

                ${tabela}

            </div>

        </div>
        `
    const divPagamentos = document.querySelector('.divPagamentos')
    if (!divPagamentos) tela.innerHTML = acumulado

    await paginacao()
    criarMenus('pagamentos')

}

async function atualizarPainelEsquerdo() {

    const contagens = await contarPorCampo({ base: 'lista_pagamentos', path: 'status' })

    const titulos = Object.entries(contagens)
        .map(([st, qtde]) => {

            const filtros = st == 'todos'
                ? '{}'
                : `{op: '=', value: '${st}'}`

            return `
            <div class="balao-pagamentos" 
            onclick="controles.pagamentos.filtros = {'status':${filtros}}; paginacao()">
                
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

    const recebedor = pagamento?.snapshots?.cliente || ''
    const usuario = await recuperarDado('dados_setores', pagamento.criado) || {}
    const setorCriador = usuario?.setor || ''

    const deps = (pagamento?.snapshots?.departamentos || [])
        .map(dep => {
            return `<span style="text-align: left;">• <b>${dep}</b></span>`
        })
        .join('')

    const tds = `
        <td>${pagamento.param[0].data_vencimento}</td>
        <td>
            <div style="${vertical}; gap: 2px;">
                ${deps}
            </div>
        </td>
        <td>${pagamento?.app || 'AC'}</td>
        <td style="white-space: nowrap; text-align: left;">${dinheiro(pagamento.param[0].valor_documento)}</td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <img src="${iconePagamento(pagamento.status)}" style="width: 1.5rem;">
                <label style="text-align: left;">${pagamento.status}</label>
            </div>
        </td>
        <td>${pagamento.criado}</td>
        <td>${setorCriador}</td>
        <td>${recebedor}</td>
        <td style="text-align: center;">
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;" onclick="abrirDetalhesPagamentos('${pagamento.id}')">
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
        case status.includes('Aguardando aprovação da Qualidade'):
            icone = 'qualidade2'
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
                    <button onclick="autorizarPagamentos(true, '${idPagamento}')">Aprovar</button>
                    <button style="background-color: #b12425 ;" onclick="autorizarPagamentos(false, '${idPagamento}')">Reprovar</button>
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
        </div>
    `

    let valores = ''
    const permissao = acesso.permissao
    const pagamento = await recuperarDado('lista_pagamentos', id)
    const anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoPagamento('${id}', '${idAnexo}')`))
        .join('')
    const btnDetalhes = (img, nome, funcao) => `
        <div class="btnDetalhes" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <label style="cursor: pointer;">${nome}</label>
        </div>
    `

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

    pagamento.param[0].categorias.forEach(async item => {

        const nomeCategoria = await recuperarDado('dados_categorias_AC', item.codigo_categoria)?.categoria || '...'
        valores += `
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                <label style="text-align: left;"><strong>${dinheiro(item.valor)}</strong> - ${nomeCategoria}</label>
            </div>
        `

    })

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
    const vinculados = []
    for (const dep of depPagam) {
        const cc = await recuperarDado('departamentos_AC', dep.cCodDep)
        if (!cc)
            continue

        const pesquisa = await pesquisarDB({
            base: 'dados_orcamentos',
            filtros: { 'snapshots.contrato': { op: 'includes', value: cc.descricao } }
        })

        if (!pesquisa.resultados.length)
            continue

        vinculados.push(...pesquisa.resultados)
    }

    const btnsOrcamentos = vinculados
        .map(resultado => {
            const total = resultado?.total_geral
                ? dinheiro(resultado?.total_geral)
                : ''
            return btnDetalhes('pasta', `${resultado?.snapshots?.cliente || '...'} 
                <br>${total}`, `abrirAtalhos('${resultado.id}')`)
        }).join('')

    const bEspeciais = permissao == 'adm'
        ? `
        ${btnDetalhes('editar', 'Editar Pagamento', `editarPagamento('${id}')`)}
        ${btnDetalhes('cancel', 'Excluir pagamento', `confirmarExclusaoPagamento('${id}')`)}
        ${btnDetalhes('concluido', 'Lançar pagamento', `relancarPagamento('${id}')`)}
        ${btnDetalhes('anexo', 'Reimportar Anexos no Omie', `reprocessarAnexos('${id}')`)}`
        : ''

    const deps = (pagamento?.snapshots?.departamentos || [])
        .map(dep => {
            return `
                <div style="${vertical}; gap: 2px; text-align: left;">
                    <span>• <b>${dep}</b></span>
                </div>
            `
        }).join('')

    const acumulado = `
        ${justificativaHTML(id)}

        <div class="detalhes-pagamento">
            <div style="${vertical}; gap: 1px; width: 100%;">
                ${btnsOrcamentos}
                ${btnDetalhes('reembolso', 'Duplicar Pagamento', `duplicarPagamento('${id}')`)}

                ${bEspeciais}

            </div>

            <hr>

            ${modelo('Departamentos', deps)}
            ${modelo('Status Atual', divStatus)}
            ${modelo('Quem recebe', pagamento?.snapshots?.cliente || '')}
            ${modelo('Data de Solicitação', pagamento.data_registro)}
            ${modelo('Data de Pagamento', pagamento.param[0].data_vencimento)}

            ${divValores}

            <div id="comentario" class="contorno" style="width: 90%;">
                <div class="contorno_interno" style="background-color: #ffffffde;">
                    <label style="width: 100%; text-align: left;"><strong>Observações </strong><br> ${pagamento.param[0].observacao.replace(/\||\n/g, "<br>")}</label>
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                <label><strong>Anexos</strong> • </label>  
                
                <label for="anexoPagamento" style="text-decoration: underline; cursor: pointer;">
                    Incluir Anexo
                    <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this, '${id}')" multiple>
                </label>

            </div>
            
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 3px;">
                ${anexos}
            </div>

            <label><strong>Histórico</strong></label>

            ${historico}

        </div>
        <div class="rodape-detalhes"></div>
    `

    const telaDetalhes = document.querySelector('.tela-detalhes')
    if (telaDetalhes) return telaDetalhes.innerHTML = acumulado
    popup({ elemento: `<div class="tela-detalhes">${acumulado}</div>`, titulo: 'Detalhes do Pagamento' })

}

async function alterarStatusPagamento(idPagamento, select) {

    const pagamento = await recuperarDado('lista_pagamentos', idPagamento)

    pagamento.status = select.value
    enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')

}

async function confirmarExclusaoPagamento(id) {

    removerPopup() // PopUp
    removerPopup() // Tela de Pagamento

    await deletarDB('lista_pagamentos', id)
    await deletar(`lista_pagamentos/${id}`)

}

async function removerAnexoPagamento(id, anx) {

    const pagamento = await recuperarDado('lista_pagamentos', id)

    if (pagamento.anexos && pagamento.anexos[anx]) {

        delete pagamento.anexos[anx]

        deletar(`lista_pagamentos/${id}/anexos/${anx}`)
        await inserirDados({ [id]: pagamento }, 'lista_pagamentos')
        await abrirDetalhesPagamentos(id)
    }

}

async function removerAnexoParceiro(id, campo, anx) {

    let pagamento = await recuperarDado('lista_pagamentos', id)

    if (pagamento.anexos_parceiros && pagamento.anexos_parceiros[campo] && pagamento.anexos_parceiros[campo][anx]) {

        delete pagamento.anexos_parceiros[campo][anx]
        await inserirDados({ [id]: pagamento }, 'lista_pagamentos')
        deletar(`lista_pagamentos/${id}/anexos_parceiros/${campo}/${anx}`)
        await abrirDetalhesPagamentos(id)

    }

}

async function autorizarPagamentos(resposta, id) {

    overlayAguarde()

    const pagamento = await recuperarDado('lista_pagamentos', id)
    const justificativa = document.getElementById('justificativa').value
    const usuario = acesso.usuario;
    const permissao = acesso.permissao
    const setor = acesso.setor
    let status;

    const categorias = pagamento.param[0].categorias
    let pagamentoParceiroAtivo = false
    for (item of categorias) {
        if (item.codigo_categoria == '2.01.99') pagamentoParceiroAtivo = true
    }

    if (resposta) {
        if (permissao == 'diretoria') {
            status = 'Aprovado pela Diretoria';
            lancarPagamento({ pagamento });
        } else if (permissao == 'fin' || (permissao == 'gerente' && setor == 'FINANCEIRO')) {
            status = `Aprovado pelo ${setor}`;
            lancarPagamento({ pagamento });
        } else if (permissao == 'gerente') {
            status = 'Aguardando aprovação da Diretoria';
        } else {
            status = 'Aguardando aprovação da Gerência';
        }
    } else {
        status = `Reprovado por ${permissao}`;
    }

    const historico = {
        status,
        usuario,
        justificativa,
        data: new Date().toLocaleString()
    }

    const idJustificativa = ID5digitos()
    pagamento.status = status

    pagamento.historico ??= {}
    pagamento.historico[idJustificativa] = historico

    await inserirDados({ [id]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id)

    await enviar(`lista_pagamentos/${id}/historico/${idJustificativa}`, historico)
    await enviar(`lista_pagamentos/${id}/status`, status)

}

async function salvarPagamento() {

    overlayAguarde()

    const resposta = await calculadoraPagamento(true) // Última verificação antes de salvar;
    if (resposta && resposta.mensagem) return popup({ mensagem: resposta.mensagem })

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const permissao = acesso.permissao
    const anexoPagamento = document.getElementById('anexoPagamento')
    const anexos = await importarAnexos({ input: anexoPagamento })

    if (anexos.mensagem) return popup({ mensagem: anexos.mensagem })
    ultimoPagamento.anexos = Object.fromEntries(
        anexos.map(a => [a.link, a])
    )

    // Verificar se na observação contém a primeira linha "Solicitante"
    const observacao = ultimoPagamento.param[0].observacao
    const identificacao = 'Solicitante:'
    if (!observacao.includes(identificacao))
        ultimoPagamento.param[0].observacao = `${identificacao} ${acesso.usuario} \n ${observacao}`

    if (!ultimoPagamento.id) {

        ultimoPagamento.id = unicoID()
        ultimoPagamento.param[0].codigo_lancamento_integracao = ultimoPagamento.id

        if (ultimoPagamento.param[0].valor_documento <= 500) {
            ultimoPagamento.status = 'Processando...'
            lancarPagamento({ pagamento: ultimoPagamento })
        } else if (permissao == 'gerente') {
            ultimoPagamento.status = 'Aguardando aprovação da Diretoria'
        } else {
            ultimoPagamento.status = 'Aguardando aprovação da Gerência'
        }

    }

    try {
        await enviar(`lista_pagamentos/${ultimoPagamento.id}`, ultimoPagamento)
        await inserirDados({ [ultimoPagamento.id]: ultimoPagamento }, 'lista_pagamentos')
        localStorage.removeItem('ultimoPagamento')
        popup({ imagem: 'imagens/concluido.png', tempo: 5, mensagem: 'Pagamento Salvo' })

    } catch (e) {
        console.log(e)
        popup({ mensagem: 'Não foi possível salvar o pagamento, tente novamente.' })
    }

}

async function formularioPagamento() {

    const totalPagamento = document.getElementById('totalPagamento')
    if (totalPagamento) return

    const ulP = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const { observacao = '', categorias = [], distribuicao = [], valor_documento = 0, data_vencimento, codigo_cliente_fornecedor = '' } = ulP?.param?.[0] || {}
    const { nome = 'Selecionar' } = await recuperarDado('dados_clientes', codigo_cliente_fornecedor) || {}
    const [dia, mes, ano] = data_vencimento ? data_vencimento.split('/') : ''
    const dtVencimento = `${ano}-${mes}-${dia}`

    controlesCxOpcoes.recebedor = {
        base: 'dados_clientes',
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
                    ${nome}
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
                    <img src="imagens/baixar.png" style="width: 1.5rem; cursor: pointer;" onclick="maisCampo({ base: 'departamentos_AC' })">
                    <div class="central-departamentos_AC"></div>
                </div>
            `
        },
        {
            texto: 'Categorias',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" style="width: 1.5rem; cursor: pointer;" onclick="maisCampo({ base: 'dados_categorias_AC'})">
                    <div class="central-dados_categorias_AC"></div>
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
                <select name="app" onchange="calculadoraPagamento()">
                    ${['IAC', 'AC', 'HNK'].map(op => `<option ${ulP?.app == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Data de Pagamento',
            elemento: `<input type="date" name="dataPagamento" value="${dtVencimento}" oninput="calculadoraPagamento()">`
        },
        {
            texto: 'Anexos Diversos',
            elemento: `
                <div style="${vertical}; align-items: end;">

                    <input type="file" id="anexoPagamento" multiple>

                    <div id="anexosDiversos" style="${vertical}; gap: 2px;">
                        ${Object.values(ulP.anexos || {}).map(anexo => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoTemporario('${anexo.link}')`)).join('')}
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

    popup({ linhas, botoes, titulo: 'Solicitação de Pagamento', nra: false })

    // Categorias;
    for (const categoria of categorias)
        await maisCampo({ atualizar: false, id: categoria.codigo_categoria, base: 'dados_categorias_AC', valor: categoria.valor })

    // Departamentos;
    for (const departamento of distribuicao)
        await maisCampo({ atualizar: false, id: departamento.cCodDep, base: 'departamentos_AC', valor: departamento.nValDep })

    await calculadoraPagamento()

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
        dataFinal = new Date(
            dataFinal.getFullYear(),
            dataFinal.getMonth() + 1,
            10
        )

        while (dataFinal.getDay() === 0 || dataFinal.getDay() === 6) {
            dataFinal.setDate(dataFinal.getDate() + 1)
        }
    }

    if (data) {
        const informada = new Date(data + 'T00:00:00')
        if (informada > dataFinal) {
            dataFinal = informada
        }
    }

    if (dataFinal < dataMinima) {
        dataFinal = dataMinima
    }

    return dataFinal.toLocaleDateString('pt-BR')
}


async function calculadoraPagamento(ultimaValidacao) {

    const obVal = (name) => {
        const elemento = document.querySelector(`[name="${name}"]`)
        return elemento
    }

    const codigo_cliente_fornecedor = Number(obVal('recebedor').id)
    if (ultimaValidacao && !codigo_cliente_fornecedor) return { mensagem: 'Recebedor em branco' }

    const observacao = obVal('observacao').value
    const app = obVal('app').value
    const dataPagamento = obVal('dataPagamento')
    const categorias = {}
    const distribuicao = {}
    let valor_documento = 0
    let atraso = 0
    const totais = {
        cat: 0,
        dep: 0
    }

    // Categorias
    const inputsCat = document.querySelectorAll('[name="dados_categorias_AC"]')
    for (const input of inputsCat) {
        const span = input.parentElement.nextElementSibling
        if (ultimaValidacao && !span.id) return { mensagem: 'Não deixe Categorias em branco' }
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
        if (atraso == 0 && span.textContent == 'Adiantamento de Parceiro')
            atraso = 1
        else if (span.textContent == 'Pagamento de Parceiros')
            atraso = 2
    }

    // Departamentos
    const inputsDep = document.querySelectorAll('[name="departamentos_AC"]')
    for (const input of inputsDep) {
        const span = input.parentElement.nextElementSibling
        const cCodDep = Number(span.id)
        if (ultimaValidacao && !span.id) return { mensagem: 'Não deixe Centro de Custo em branco' }
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
    const dataFinal = dataRegras(dataPagamento.value, atraso)
    const [dia, mes, ano] = dataFinal.split('/')
    const dtFinalInp = `${ano}-${mes}-${dia}`
    dataPagamento.value = dtFinalInp

    let ulP = {
        app,
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

    // Pagamento salvo localmente;
    const ulPAtual = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    ulP = {
        ...ulPAtual,
        ...ulP
    }

    if (!ulP.criado) ulP.criado = acesso.usuario

    if (!ulPAtual?.param?.[0]?.codigo_lancamento_integracao)
        ulP.param[0].codigo_lancamento_integracao = ulPAtual?.param?.[0]?.codigo_lancamento_integracao || unicoID()

    localStorage.setItem('ultimoPagamento', JSON.stringify(ulP))

    const dif =
        Math.round(totais.cat * 100) !== Math.round(totais.dep * 100)

    if (ultimaValidacao && dif) return { mensagem: 'Existe uma diferença entre Centro de custo x Categorias' }
    if (ultimaValidacao && valor_documento == 0) return { mensagem: 'Pagamento sem valor' }

    let divPag = `<span style="font-size: 1.5rem;">${dinheiro(valor_documento)}</span>`

    const mod = (t1, t2) => `
        <div style="${vertical}; gap: 2px;">
            <span>${t1}</span>
            <span style="font-size: 1.5rem;">${dinheiro(t2)}</span>
        </div>
    `
    if (dif) {

        divPag = `
        <div style="${horizontal}; gap: 1rem;">

            ${mod('Centro de Custo', totais.dep)}

            <img src="imagens/diferente.png">

            ${mod('Categorias', totais.cat)}

            <img src="imagens/diferente.png">

            ${mod('Diferença', Math.abs(totais.dep - totais.cat))}

        </div>
        `
    }

    document.getElementById('totalPagamento').innerHTML = divPag

}

async function maisCampo({ valor = '', base, id, atualizar = true }) {

    if (!base) return

    const aleatorio = ID5digitos()
    const elemento = await recuperarDado(base, id)

    const esquema = {
        dados_categorias_AC: {
            retornar: ['categoria'],
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
        departamentos_AC: {
            retornar: ['descricao'],
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
        base,
        retornar: esquema[base].retornar,
        funcaoAdicional: ['calculadoraPagamento'],
        colunas: esquema[base].colunas
    }

    const campoAdicional = `
        <div style="${horizontal}; justify-content: start; margin-right: 1rem;">

            <div style="${horizontal}; gap: 5px;">
                <span>R$</span> 
                <input name="${base}" value="${valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            </div>

            ${esquema[base].span}

            <label src="imagens/remover.png" 
            style="cursor: pointer; width: 1.5rem; font-size: 2.0rem;" 
            onclick="removerCampo(this)">
                &times;
            </label>

        </div>
    `

    document.querySelector(`.central-${base}`).insertAdjacentHTML('beforeend', campoAdicional)
    if (atualizar) await calculadoraPagamento()

}

async function removerCampo(xis) {
    xis.parentElement.remove()
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

    if (id !== undefined) {
        let pagamento = await recuperarDado('lista_pagamentos', id);

        if (!pagamento.anexos) pagamento.anexos = {};

        anexos.forEach(anexo => {
            pagamento.anexos[anexo.link] = anexo;
            enviar(`lista_pagamentos/${id}/anexos/${anexo.link}`, anexo);
        });

        await inserirDados({ [id]: pagamento }, 'lista_pagamentos');
        await abrirDetalhesPagamentos(id);

    } else {

        let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {};
        const anexosDiversos = document.getElementById('anexosDiversos')

        if (!ultimoPagamento.anexos) ultimoPagamento.anexos = {};

        anexos.forEach(anexo => {

            anexosDiversos.insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoTemporario('${anexo.link}')`))

            ultimoPagamento.anexos[anexo.link] = {
                nome: anexo.nome,
                formato: anexo.formato,
                link: anexo.link
            };
        });

        localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento));

    }

}

async function removerAnexoTemporario(link) {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {};
    delete ultimoPagamento.anexos[link]
    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))
    document.querySelector(`[name="${link}"]`).remove()
    await calculadoraPagamento()

}

async function atualizarResumo(id) {

    const divAtualizar = document.getElementById('atualizarResumo')

    divAtualizar.innerHTML = `<img src="gifs/loading.gif" style="width: 1.5rem;">`

    const v_pago = conversor(document.getElementById('v_pago').textContent)
    const v_orcado = Number(document.getElementById('v_orcado').value)
    const v_lpu = Number(document.getElementById('v_lpu').value)

    let pagamento = await recuperarDado('lista_pagamentos', id)

    if (!pagamento.resumo) pagamento.resumo = {}

    pagamento.resumo = { v_pago, v_orcado, v_lpu }

    enviar(`lista_pagamentos/${id}/resumo`, pagamento.resumo)

    await inserirDados({ [id]: pagamento }, 'lista_pagamentos')

    divAtualizar.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
            <img src="imagens/concluido.png" style="width: 1.5vw">
            <label>Atualizado!</label>
        </div>
        `
    setTimeout(() => {
        divAtualizar.innerHTML = `${botao('Atualizar', `atualizarResumo('${id}')`, 'green')}`
    }, 3000)

}

function compararDatas(data1, data2) {
    const d1 = new Date(data1);
    const d2 = new Date(data2);

    const maior = data1 == '' ? data2 : d1.getTime() > d2.getTime() ? data1 : data2;

    return maior;
}

async function salvarAnexosParceiros(input, campo, id) {

    const anexos = await importarAnexos({ input })

    if (id == undefined) { // O anexo do parceiro é incluído no formulário de pagamento; (Pagamento ainda não existe)
        let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

        anexos.forEach(anexo => {

            ultimoPagamento.anexos_parceiros ??= {}
            ultimoPagamento.anexos_parceiros[campo] ??= {}
            ultimoPagamento.anexos_parceiros[campo][anexo.link] = anexo

            document.getElementById(`div${campo}`).insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${campo}', '${link}')`))
        })

        localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

    } else { // O anexo deve ser incluído no pagamento já existente;

        let pagamento = await recuperarDado('lista_pagamentos', id)

        pagamento.anexos_parceiros ??= {}
        pagamento.anexos_parceiros[campo] ??= {}

        anexos.forEach(anexo => {

            let id = ID5digitos()

            if (pagamento.anexos_parceiros[campo][id]) pagamento.anexos_parceiros[campo][id] = {}

            pagamento.anexos_parceiros[campo][id] = anexo
            enviar(`lista_pagamentos/${id}/anexos_parceiros/${campo}/${id}`, anexo)

            let container = document.getElementById(`div${campo}`)

            let string_anexo = criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${id}', '${campo}', '${id}')`);

            if (container) container.insertAdjacentHTML('beforeend', string_anexo)
        })

        await inserirDados({ [id]: pagamento }, 'lista_pagamentos')

    }

}

async function removerAnexoParceiroTemporario(campo, link) {

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    delete ultimoPagamento.anexos_parceiros[campo][link]

    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

    document.querySelector(`[name="${link}"]`).remove()

}

async function duplicarPagamento(id) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id)
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

    const omieStatus = ['A VENCER', 'PAGO', 'ATRASADO', 'VENCE HOJE']

    if (omieStatus.includes(pagamento.status))
        return popup({ mensagem: 'Este pagamento já está no Omie e por isso não pode ser editado!' })

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await formularioPagamento()

    removerOverlay()

}
