let idP = null
let filtrosAtivosPagamentos = {}
let departamentos = {}
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
    } else if (dados_setores[justificativa.usuario]?.permissao == 'qualidade') {
        cor = '#32a5e7'
        imagem = "imagens/qualidade.png"
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

async function recuperarPagamentos() {

    overlayAguarde()

    const tabelas = [
        'departamentos_AC', // Referência;
        'dados_categorias',
        'lista_pagamentos',
        'dados_setores',
        'dados_clientes',
        'dados_orcamentos'
    ]

    for (const tabela of tabelas) await sincronizarDados(tabela)
    await auxDepartamentos() // Resgatar dados do orçamento no objeto

    await telaPagamentos()

    removerOverlay()

}

async function filtrarPagamentos() {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let usuariosPermitidos = ['diretoria', 'adm']
    let setoresPermitidos = ['FINANCEIRO']
    let pagamentosFiltrados = {}

    for (let [idPagamento, pagamento] of Object.entries(lista_pagamentos)) {

        if (
            (usuariosPermitidos.includes(acesso.permissao) || setoresPermitidos.includes(acesso.setor))
        ) {
            if (pagamento.mes && acesso.permissao != 'adm') continue;

            pagamentosFiltrados[idPagamento] = pagamento;

        } else if (
            pagamento.criado == acesso.usuario ||
            (acesso.permissao == 'gerente' && pagamento.status.includes('Gerência')) ||
            (acesso.permissao == 'qualidade' && pagamento.status.includes('Qualidade'))
        ) {
            pagamentosFiltrados[idPagamento] = pagamento;
        }
    }

    return pagamentosFiltrados
}

async function telaPagamentos() {

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes')
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    departamentos = await recuperarDados('departamentos_AC')
    dados_setores = await recuperarDados('dados_setores')

    const lista_pagamentos = await filtrarPagamentos() // Filtrar de acordo com o usuário atual;
    let colunas = ['Data de Previsão', 'Departamentos', 'APP', 'Valor', 'Status', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']
    let cabecalho1 = ''
    let cabecalho2 = ''
    colunas.forEach((coluna, i) => {

        cabecalho1 += `<th>${coluna}</th>`

        if (coluna == 'Detalhes') {
            cabecalho2 += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            cabecalho2 += `<th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, filtrosAtivosPagamentos, 'body')"></th>`
        }
    })

    const acumulado = `
        <div class="divPagamentos">

            <div class="painelEsquerdo" style="width: 20vw;"></div>

            <div style="${vertical}; width: 70vw;">
                <div class="painelBotoes"></div>
                <div class="div-tabela">
                    <table id="pagamentos" class="tabela">
                        <thead>
                            <tr>${cabecalho1}</tr>
                            <tr>${cabecalho2}</tr>
                        </thead>
                        <tbody id="body"></tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `
    const painelEsquerdo = document.querySelector('.painelEsquerdo')
    if (!painelEsquerdo) tela.innerHTML = acumulado
    preencherDados()

    function preencherDados() {

        let contagens = { TODOS: { qtde: 0, valor: 0 } }
        for (const [, pagamento] of Object.entries(lista_pagamentos).reverse()) {

            if (!contagens[pagamento.status]) contagens[pagamento.status] = { qtde: 0, valor: 0 }

            contagens[pagamento.status].qtde++
            contagens[pagamento.status].valor += pagamento.param[0].valor_documento

            contagens.TODOS.qtde++
            contagens.TODOS.valor += pagamento.param[0].valor_documento

            criarLinhaPagamento(pagamento)
        }

        let titulos = ''
        for ([nomeStatus, item] of Object.entries(contagens)) {

            if (item.valor == 0) continue

            titulos += `

            <div class="balao-pagamentos" onclick="pesquisarGenerico(4, '${nomeStatus == 'TODOS' ? '' : nomeStatus}', filtrosAtivosPagamentos, 'body')">
                
                <div class="dir">
                    <div style="${vertical};">
                        <Label><b>${nomeStatus}</b></label>
                        <label style="white-space: nowrap;">${dinheiro(item.valor)}</label>
                    </div>
                    <img src="${iconePagamento(nomeStatus)}">
                </div>

                <span class="esq">${item.qtde}</span>
                
            </div>
            `
        }

        const painelEsquerdo = document.querySelector('.painelEsquerdo')
        if (painelEsquerdo) return painelEsquerdo.innerHTML = titulos

    }

    criarMenus('pagamentos')
    removerOverlay()

}

function criarLinhaPagamento(pagamento) {

    const cliente = dados_clientes?.[pagamento.param[0].codigo_cliente_fornecedor] || {}
    const recebedor = cliente?.nome || ''
    const usuario = dados_setores?.[pagamento.criado] || {}
    const setorCriador = usuario?.setor || ''
    const codDep = pagamento?.param[0]?.distribuicao?.[0]?.cCodDep
    const dep = departamentos?.[codDep] || {}

    const tds = `
        <td>${pagamento.param[0].data_vencimento}</td>
        <td>${dep?.descricao || ''} • ${dep?.cliente?.nome || ''}</td>
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
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;" onclick="abrirDetalhesPagamentos('${pagamento.id_pagamento}')">
        </td>
        `
    const idLinha = pagamento.id_pagamento
    const tr = document.getElementById(idLinha)
    if (tr) return tr.innerHTML = tds

    document.getElementById('body').insertAdjacentHTML('beforeend', `<tr id="${pagamento.id_pagamento}">${tds}</tr>`)
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
        case status == 'TODOS':
            icone = 'todos'
            break
    }

    return `imagens/${icone}.png`
}

function justificativaHTML(idPagamento) {

    return `
        <div class="balao" style="display: flex; align-items: center; justify-content: center; width: 100%;">

            <img src="gifs/alerta.gif" style="width: 2rem;">

            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; width: 100%; gap: 3px;">
                <label style="font-size: 1.0rem;">Aprovação do pagamento</label>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; width: 70%;">
                    <textarea id="justificativa" style="width: 100%; font-size: 0.8vw;" placeholder="Descreva o motivo da aprovação/reprovação" oninput="auxiliar(this)"></textarea>
                    <button id="aprovar" style="display: none; background-color: green; padding: 5px;" onclick="autorizarPagamentos(true, '${idPagamento}')">Aprovar</button>
                    <button id="reprovar" onclick="autorizarPagamentos(false, '${idPagamento}')" style="display: none; padding: 5px;">Reprovar</button>
                </div>
            </div>
        </div>
        `
}

async function abrirDetalhesPagamentos(id_pagamento) {

    idP = id_pagamento

    overlayAguarde()

    let valores = ''
    let painelParceiro = false
    const dados_categorias = await recuperarDados('dados_categorias')
    const permissao = acesso.permissao
    const pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    const cliente_omie = pagamento.param[0].codigo_cliente_fornecedor
    const cliente = await recuperarDado('dados_clientes', cliente_omie) || await recuperarDado('dados_clientes_IAC', cliente_omie)
    const anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexoPagamento('${id_pagamento}', '${idAnexo}')`))
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
                <img src="${imagemEspecifica(justificativa).imagem}" style="width: 3vw;">
            </div>`)
        .join('')

    pagamento.param[0].categorias.forEach(item => {

        const nomeCategoria = dados_categorias?.[item.codigo_categoria]?.categoria || 'Categoria Desativada'
        valores += `
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                <label><strong>${dinheiro(item.valor)}</strong> - ${nomeCategoria}</label>
            </div>
        `
        if (nomeCategoria.includes('Parceiros')) painelParceiro = true

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

    let formParceiros = ''

    if (painelParceiro) {

        const campos = {
            pedido: 'PDF do pedido do Cliente',
            lpu_parceiro: 'LPU do parceiro de serviço & material',
            orcamento: 'Orçamento GCS ou orçamento externo',
            relatorio_fotografico: 'Relatório Fotográfico',
            os: 'Ordem de Serviço',
            medicao: 'Paga sobre medição?'
        }

        let infos = ''
        for (let campo in campos) {
            let docsExistentes = ''
            if (campo == 'orcamento' && orcamento) {

                docsExistentes += `
                    <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                        <div onclick="ir_pdf('${pagamento.id_orcamento}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 15vw;">
                            <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                            <label style="cursor: pointer;"><b>Orçamento disponível</b></label>
                        </div>
                    </div>
                `
            }

            if (campo == 'pedido') {
                docsExistentes = ''

                const historico = orcamento?.status?.historico || {}

                for (let [chave, his] of Object.entries(historico)) {

                    if (!chave.includes('PEDIDO')) continue

                    const anexos = his?.anexos || {}

                    for (const [, anexo] of Object.entries(anexos)) {
                        docsExistentes += criarAnexoVisual(anexo.nome, anexo.link);
                    }
                }
            }

            infos += `
                <div class="balao2025">
                    <label class="numero"></label>
                    <div class="camposFinanceiro">

                        <div style="display: flex; gap: 5px; align-items: center; justify-content: left; width: 100%;">
                            <label for="anexo_${campo}" style="justify-content: start; border-radius: 50%;">
                                <img src="imagens/anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                                <input type="file" id="anexo_${campo}" style="display: none;" onchange="salvarAnexosParceiros(this, '${campo}','${pagamento.id_pagamento}')">
                            </label>
                            <label style="text-align: left;">${campos[campo]}</label>
                        </div> 
                    
                        <div id="div${campo}" class="container">
                            ${docsExistentes}
                        </div>

                    </div> 
                </div>
            `
        }

        formParceiros = `
            <div style="${vertical}; gap: 5px; width: 90%;">
                ${infos}

                <div class="balao2025">
                    <span name="tabelaParceiro" class="numero"></span>
                    <div class="camposFinanceiro">
                        ${carregarTabelaCustoParceiro({ resumo: pagamento.resumo, id_pagamento: pagamento.id_pagamento })}
                    </div>
                </div>
            </div>
            `
    }

    let divStatus = `<label>${pagamento.status}</label>`
    if (permissao == 'adm') {
        let opcoes = ''
        opcoesStatus.forEach(op => {
            opcoes += `<option ${pagamento.status == op ? 'selected' : ''}>${op}</option>`
        })

        divStatus = `
            <select class="selectStatus" onchange="alterarStatusPagamento('${id_pagamento}', this)">
                ${opcoes}
            </select>
        `
    }

    const codDep = pagamento?.param?.[0]?.distribuicao?.[0]?.cCodDep
    const cc = departamentos[codDep] || {}

    const bEspeciais = acesso.permissao == 'adm'
        ? `
        ${btnDetalhes('editar', 'Editar Pagamento', `editarPagamento('${id_pagamento}')`)}
        ${btnDetalhes('remover', 'Excluir pagamento', `confirmarExclusaoPagamento('${id_pagamento}')`)}
        ${btnDetalhes('concluido', 'Lançar pagamento', `relancarPagamento('${id_pagamento}')`)}
        ${btnDetalhes('anexo', 'Reimportar Anexos no Omie', `reprocessarAnexos('${id_pagamento}')`)}`
        : ''

    const acumulado = `
        ${justificativaHTML(id_pagamento)}

        <div class="detalhesPagamento">
            <div style="${vertical}; gap: 1px; width: 100%;">
                ${cc?.id_orcamento ? btnDetalhes('pasta', 'Consultar Orçamento', `abrirAtalhos('${cc?.id_orcamento}')`) : ''}
                ${btnDetalhes('reembolso', 'Duplicar Pagamento', `duplicarPagamento('${id_pagamento}')`)}

                ${bEspeciais}

            </div>

            <hr style="width: 100%;">

            <div style="${vertical}; width: 100%;">
                <span><b>Departamento/Centro de Custo</b></span>
                <span 
                class="opcoes" 
                name="cc" 
                onclick="cxOpcoes('cc', 'departamentos_AC', ['cliente/nome', 'cliente/cidade', 'cliente/cnpj', 'descricao'], 'salvarCC()')">
                    ${cc?.descricao || 'Selecione'}
                </span>
            </div>

            ${modelo('Status Atual', `${divStatus}`)}
            ${modelo('Quem recebe', `${cliente.nome}`)}
            ${modelo('Data de Solicitação', `${pagamento.data_registro}`)}
            ${modelo('Data de Pagamento', `${pagamento.param[0].data_vencimento}`)}

            ${divValores}

            ${formParceiros}

            <div id="comentario" class="contorno" style="width: 90%;">
                <div class="contorno_interno" style="background-color: #ffffffde;">
                    <label style="width: 100%; text-align: left;"><strong>Observações </strong><br> ${pagamento.param[0].observacao.replace(/\||\n/g, "<br>")}</label>
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                <label><strong>Anexos</strong> • </label>  
                
                <label for="anexoPagamento" style="text-decoration: underline; cursor: pointer;">
                    Incluir Anexo
                    <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this, '${id_pagamento}')" multiple>
                </label>

            </div>
            
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 3px;">
                ${anexos}
            </div>

            <label><strong>Histórico</strong></label>

            ${historico}

        </div>
    `

    const telaDetalhes = document.querySelector('.tela-detalhes')
    if (telaDetalhes) return telaDetalhes.innerHTML = acumulado
    popup(`<div class="tela-detalhes">${acumulado}</div>`, 'Detalhes do Pagamento', true)

    // Depois que se abre o pagamento, percorra os anexos e preencha cada item;
    if (pagamento.anexos_parceiros) {

        let itens = pagamento.anexos_parceiros

        for (item in itens) {
            let anexos_on = itens[item]

            for (anx in anexos_on) {

                let anexo = anexos_on[anx]

                let element = criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_parceiro('${id_pagamento}', '${item}', '${anx}')`);

                document.getElementById(`div${item}`).insertAdjacentHTML('beforeend', element)

            }
        }
    }

    calcularCusto()

}

async function salvarCC() {

    const nameCC = document.querySelector('[name="cc"]')
    const pagamento = await recuperarDado('lista_pagamentos', idP)

    pagamento.param[0].distribuicao = [{
        cCodDep: Number(nameCC.id),
        nPerDep: 100
    }]

    await inserirDados({ [idP]: pagamento }, 'lista_pagamentos')
    enviar(`lista_pagamentos/${idP}`, pagamento)

    const resposta = await lancarPagamento({ pagamento, call: 'AlterarContaPagar', dataFixa: true })

    console.log(resposta)

}

async function alterarStatusPagamento(idPagamento, select) {

    let pagamento = await recuperarDado('lista_pagamentos', idPagamento)

    pagamento.status = select.value
    enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')
    await telaPagamentos()

}

async function confirmarExclusaoPagamento(id) {

    removerPopup() // PopUp
    removerPopup() // Tela de Pagamento

    await deletarDB('lista_pagamentos', id)
    await deletar(`lista_pagamentos/${id}`)

    const tr = document.getElementById(id)

    if (tr) tr.remove()

}

async function excluirAnexoPagamento(id_pagamento, anx) {

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    if (pagamento.anexos && pagamento.anexos[anx]) {

        delete pagamento.anexos[anx]

        deletar(`lista_pagamentos/${id_pagamento}/anexos/${anx}`)
        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')
        await abrirDetalhesPagamentos(id_pagamento)
    }

}

async function excluir_anexo_parceiro(id_pagamento, campo, anx) {

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    if (pagamento.anexos_parceiros && pagamento.anexos_parceiros[campo] && pagamento.anexos_parceiros[campo][anx]) {

        delete pagamento.anexos_parceiros[campo][anx]
        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')
        deletar(`lista_pagamentos/${id_pagamento}/anexos_parceiros/${campo}/${anx}`)
        await abrirDetalhesPagamentos(id_pagamento)

    }

}

function colorirParceiros() {
    const contornoBotaoLiberacao = document.querySelector('.contornoBotaoLiberacao')
    const numeros = document.querySelectorAll('.numero')
    const divs = document.querySelectorAll('div.container')
    let i = 0

    if (!contornoBotaoLiberacao) {

        for (const numero of numeros) {
            numero.textContent = i + 1

            if (!divs[i]) continue

            const balao = numero?.parentElement
            if (balao) {
                balao.style.background = `linear-gradient(to right, ${divs[i].children.length == 0 ? '#B12425' : 'green'} 10%, #f0f0f0 10%)`
            }

            i++
        }
    }

    const v_orcado = document.getElementById('v_orcado')
    const el = document.querySelector('[name="tabelaParceiro"]')
    const balao = el?.parentElement
    if (!contornoBotaoLiberacao) el.textContent = i + 1

    if (balao) {
        balao.style.background = `linear-gradient(to right, ${v_orcado.value == 0 ? '#B12425' : 'green'} 10%, #f0f0f0 10%)`
    }
}

function auxiliar(elemento) {

    const aprovar = document.getElementById('aprovar')
    const reprovar = document.getElementById('reprovar')

    aprovar.style.display = elemento.value == '' ? 'none' : 'block'
    reprovar.style.display = elemento.value == '' ? 'none' : 'block'

}

async function autorizarPagamentos(resposta, id_pagamento) {

    overlayAguarde()

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    let dataFormatada = obterDatas('completa')
    let justificativa = document.getElementById('justificativa').value
    let usuario = acesso.usuario;
    let permissao = acesso.permissao
    let setor = acesso.setor
    let status;
    let setorUsuarioPagamento = dados_setores?.[pagamento.criado]?.setor || ''

    let categorias = pagamento.param[0].categorias
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
        } else if (permissao !== 'qualidade' && setorUsuarioPagamento == 'INFRA' && pagamentoParceiroAtivo) {
            status = 'Aguardando aprovação da Qualidade';
        } else if (permissao == 'gerente' || permissao == 'qualidade') {
            status = 'Aguardando aprovação da Diretoria';
        } else {
            status = 'Aguardando aprovação da Gerência';
        }
    } else {
        status = `Reprovado por ${permissao}`;
    }

    let historico = {
        status,
        usuario,
        justificativa,
        data: dataFormatada
    };

    let id_justificativa = ID5digitos()
    pagamento.status = status

    if (!pagamento.historico) {
        pagamento.historico = {};
    }
    pagamento.historico[id_justificativa] = historico

    await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id_pagamento)

    await enviar(`lista_pagamentos/${id_pagamento}/historico/${id_justificativa}`, historico)
    await enviar(`lista_pagamentos/${id_pagamento}/status`, status)

    await telaPagamentos()

}

async function salvarPagamento() {

    overlayAguarde()

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const permissao = acesso.permissao
    let id_pagamento = ultimoPagamento.id_pagamento

    if (!id_pagamento) {

        id_pagamento = unicoID()
        ultimoPagamento.id_pagamento = id_pagamento
        ultimoPagamento.param[0].codigo_lancamento_integracao = id_pagamento

        if (ultimoPagamento.param[0].valor_documento <= 500) {
            ultimoPagamento.status = 'Processando...'
            lancarPagamento({ pagamento: ultimoPagamento })
        } else if (permissao == 'gerente') {
            ultimoPagamento.status = 'Aguardando aprovação da Diretoria'
        } else {
            ultimoPagamento.status = 'Aguardando aprovação da Gerência'
        }

    }

    ultimoPagamento.param[0].codigo_lancamento_integracao = id_pagamento

    try {
        await enviar(`lista_pagamentos/${id_pagamento}`, ultimoPagamento)
        await inserirDados({ [id_pagamento]: ultimoPagamento }, 'lista_pagamentos')
        criarLinhaPagamento(ultimoPagamento)
        localStorage.removeItem('ultimoPagamento')
        popup(mensagem('Pagamento Salvo', 'imagens/concluido.png'), 'Sucesso')

    } catch {

        popup(mensagem('Não foi possível salvar o pagamento, tente novamente.'), 'Alerta', true)

    }

}

async function criarPagamento() {

    const modeloCampos = (name, nomeCampo, elemento) => `
        <div class="balao2025">
            <span name="${name}Numero" class="numero"></span>

            <div class="camposFinanceiro">
                <div style="${horizontal}; justify-content: start; width: 30%;">${nomeCampo}</div>
                ${elemento}
            </div>
        </div>`

    const acumulado = `
        <div class="formulario-pagamento">

            <div style="${horizontal}: gap: 1vw;">
                ${botao('Atualizar GCS', 'recuperarPagamentos()', '#097fe6')}
                ${botao('Recomeçar', 'apagarPagamento()', '#B12425')}
            </div>

            <hr style="width: 100%;">

            ${modeloCampos('cc', 'Centro de Custo', `
                    <span class="opcoes" name="cc" onclick="cxOpcoes('cc', 'departamentos_AC', ['cliente/nome', 'descricao', 'cliente/cidade', 'cliente/cnpj'], 'calculadoraPagamento()')">Selecionar</span>
                `)}

            ${modeloCampos('recebedor', 'Recebedor', `
                    <span class="opcoes" name="recebedor" onclick="cxOpcoes('recebedor', 'dados_clientes', ['nome', 'cnpj'], 'calculadoraPagamento()')">Selecionar</span>
                `)}

            ${modeloCampos('descricao', `
                <div style="${vertical}">
                    <span>Descrição</span>
                    <span>Chave Pix</span>
                    <span>nº Boleto</span>
                </div>
                `, `<textarea style="width:80%" rows="3" id="descricao" oninput="calculadoraPagamento()"></textarea>`)}

            ${modeloCampos('categorias', 'Categorias', `
                    <img src="imagens/baixar.png" style="width: 1.5rem; cursor: pointer;" onclick="maisCategoria()">
                    <div class="centralCategorias"></div>
                `)}

            ${modeloCampos('anexos', 'Anexos Diversos', `
                    <label class="opcoes" for="anexoPagamento" style="justify-content: center;">
                        Selecionar
                        <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this)" multiple>
                    </label>
                    <div id="anexosDiversos" style="${vertical}; gap: 2px;"></div>
                `)}

            ${modeloCampos('app', `
                <div style="${horizontal}; gap: 5px; margin-right: 3rem;">
                    <select id="app" onchange="calculadoraPagamento()">
                        ${['AC', 'IAC'].map(op => `<option>${op}</option>`).join('')}
                    </select>
                </div>
                `, '<span style="padding-right: 2rem;"><b>IAC</b> Apenas reembolso para funcionário</span>')}

            <div id="painelParceiro" style="${vertical}; gap: 5px; width: 100%;">
                ${incluirCamposAdicionais()}
            </div>

        </div>

        <div class="contornoBotaoLiberacao">

            <div style="${vertical}">
                <label>Total</label>
                <label style="font-size: 1.5rem;" id="totalPagamento"></label>
                <div style="${horizontal}; gap: 10px;">
                    <span>Será pago em</span>
                    <input type="date" id="dataPagamento" oninput="calculadoraPagamento()">
                </div>
            </div>
            
            <div style="${vertical}; align-items: center;" onclick="duvidas()">
                <img src="gifs/interrogacao.gif">
                <span><b>REGRAS</b></span>
            </div>

            <button id="liberarBotao" onclick="salvarPagamento()">Salvar</button>
                
        </div>
    `

    popup(acumulado, 'Solicitação de Pagamento')

    await recuperarUltimoPagamento()

}

async function apagarPagamento() {
    localStorage.removeItem('ultimoPagamento')
    removerPopup()
    await criarPagamento()
}

function duvidas() {
    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">
            <label>• Se faltar algo, Clique em <strong>Atualizar GCS</strong> no botão azul para atualizar tudo;</label>
            <label>• Se o botão <strong>"Salvar"</strong> não apareceu, é porque falta preencher algum campo;</label>
            <label>• Após às <strong>11h</strong> será lançado no dia útil seguinte;</label>
            <label>• Maior que <strong>R$ 500,00</strong> passa por aprovação;</label>
            <label style="text-align: left;">• Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada
                mês,
                <br> e será pago dia <strong>10</strong> do mês seguinte;</label>
            <label>• Adiantamento de parceiro, o pagamento ocorre em até 8 dias.</label>
        </div>
    `

    popup(acumulado, 'Informações Importantes', true)
}

async function salvarAnexosPagamentos(input, id_pagamento) {
    const anexos = await importarAnexos(input);

    if (id_pagamento !== undefined) {
        let pagamento = await recuperarDado('lista_pagamentos', id_pagamento);

        if (!pagamento.anexos) pagamento.anexos = {};

        anexos.forEach(anexo => {
            pagamento.anexos[anexo.link] = anexo;
            enviar(`lista_pagamentos/${id_pagamento}/anexos/${anexo.link}`, anexo);
        });

        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos');
        await abrirDetalhesPagamentos(id_pagamento);

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
        await calculadoraPagamento()

    }

}

async function removerAnexoTemporario(link) {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {};
    delete ultimoPagamento.anexos[link]
    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))
    document.querySelector(`[name="${link}"]`).remove()
    await calculadoraPagamento()

}

function incluirCamposAdicionais() {

    const campos = {
        pedido: { titulo: 'Pedido' },
        lpu_parceiro: { titulo: 'LPU do parceiro de serviço & material' },
        os: { titulo: 'Ordem de Serviço' },
        relatorio_fotografico: { titulo: 'Relatório de Fotográfico' },
        medicao: { titulo: 'Tem medição para anexar?' },
    }

    let camposHtml = ''
    for (const campo in campos) {

        let conteudo = campos[campo]
        camposHtml += `
            <div class="balao2025">
                <span name="${campo}Numero" class="numero"></span>
                <div class="camposFinanceiro" style="justify-content: space-between;">
                    <div style="width: 30%; text-align: left;">${conteudo.titulo}</div>
                    <label class="opcoes" for="anexo_${campo}" style="justify-content: center;">
                        Selecionar
                        <input type="file" id="anexo_${campo}" style="display: none;" onchange="salvarAnexosParceiros(this, '${campo}')" multiple>
                    </label>
                    <div id="div${campo}" style="${vertical}"></div>
                </div>
            </div>
            `
    }

    const acumulado = `
        ${camposHtml}
        <br>
        <div class="balao2025">
            <span name="tabelaParceiro" class="numero"></span>
            <div class="camposFinanceiro">
                ${carregarTabelaCustoParceiro()}
            </div>
        </div>
        <br>
    `
    return acumulado
}

async function atualizarResumo(id_pagamento) {

    const divAtualizar = document.getElementById('atualizarResumo')

    divAtualizar.innerHTML = `<img src="gifs/loading.gif" style="width: 1.5rem;">`

    const v_pago = conversor(document.getElementById('v_pago').textContent)
    const v_orcado = Number(document.getElementById('v_orcado').value)
    const v_lpu = Number(document.getElementById('v_lpu').value)

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    if (!pagamento.resumo) pagamento.resumo = {}

    pagamento.resumo = { v_pago, v_orcado, v_lpu }

    enviar(`lista_pagamentos/${id_pagamento}/resumo`, pagamento.resumo)

    await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')

    divAtualizar.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
            <img src="imagens/concluido.png" style="width: 1.5vw">
            <label>Atualizado!</label>
        </div>
        `
    setTimeout(() => {
        divAtualizar.innerHTML = `${botao('Atualizar', `atualizarResumo('${id_pagamento}')`, 'green')}`
    }, 3000)

}

function calcularCusto() {

    if (!document.getElementById('v_pago')) return

    let v_pago = conversor(document.getElementById('v_pago').textContent)
    let v_lpu = Number(document.getElementById('v_lpu').value)
    let v_orcado = Number(document.getElementById('v_orcado').value)

    document.getElementById('res_VO').innerHTML = v_orcado !== 0 ? `${((v_lpu / v_orcado) * 100).toFixed(0)}%` : '--'
    document.getElementById('res_ORAP').innerHTML = v_orcado !== 0 ? `${((v_pago / v_orcado) * 100).toFixed(0)}%` : '--'

    colorirParceiros()
}

function carregarTabelaCustoParceiro(dados = {}) {

    const { resumo, id_pagamento } = dados

    if (resumo && isNaN(resumo.v_pago)) resumo.v_pago = conversor(resumo.v_pago)

    const botaoAtualizar = resumo
        ? `
        <div id="atualizarResumo">
            <button onclick="atualizarResumo('${id_pagamento}')">Atualizar</button>
        </div>
        `
        : ''

    return `
            <div style="${vertical}; padding: 5px;">
                ${botaoAtualizar}
                <table class="tabela">
                    <thead>
                        <th>Valor Orçado</th>
                        <th>LPU do Parceiro</th>
                        <th>% LPU x VO</th>
                        <th>A Pagar</th>
                        <th>% A Pagar x LPU</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input value="${resumo?.v_orcado || ''}" id="v_orcado" type="number" placeholder="Orçado" oninput="calcularCusto()"></td>
                            <td><input value="${resumo?.v_lpu || ''}" id="v_lpu" type="number" placeholder="LPU do Parceiro" oninput="calcularCusto()"></td>
                            <td id="res_VO"></td>
                            <td id="v_pago" style="white-space: nowrap;">${dinheiro(resumo?.v_pago) || ''}</td>
                            <td id="res_ORAP"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
}

function calcularDataPagamento(nivel) {
    let dataAtual = new Date();

    // var dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
    let diaDeHoje = dataAtual.getDate();
    let ano = dataAtual.getFullYear();
    let mes = dataAtual.getMonth();

    if (nivel == 2 && diaDeHoje > 5) { // Pagamento de Parceiro no dia 10 do mês seguinte;
        diaDeHoje = 10;
        mes += 1;
    } else if (nivel == 2) { // Pagamento de Parceiro no dia 10;
        diaDeHoje = 10;
    } else if (nivel == 1) { // Adiantamento de Parceiro (8 dias prévios);
        diaDeHoje += 8;

        var diasNoMes = new Date(ano, mes + 1, 0).getDate();
        if (diaDeHoje > diasNoMes) {
            diaDeHoje -= diasNoMes;
            mes += 1;
        }
    }

    if (mes > 11) {
        mes = 0;
        ano += 1;
    }

    dataAtual = new Date(ano, mes, diaDeHoje);

    if (dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 2);
    } else if (dataAtual.getDay() === 0) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    if (dataAtual.getDay() === 5 && dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 3);
    } else if (dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 2);
    } else if (dataAtual.getDay() === 0) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    } else if (dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    const anoF = dataAtual.getFullYear();
    const mesF = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const diaF = String(dataAtual.getDate()).padStart(2, '0');
    return `${anoF}-${mesF}-${diaF}`;

}

function compararDatas(data1, data2) {
    const d1 = new Date(data1);
    const d2 = new Date(data2);

    const maior = data1 == '' ? data2 : d1.getTime() > d2.getTime() ? data1 : data2;

    return maior;
}

async function calculadoraPagamento(pagamentoEmEdicao) {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    let cor = ''
    const recebedor = document.querySelector('[name="recebedor"]')
    const cc = document.querySelector('[name="cc"]')
    const auxCategorias = calcularCategorias()
    const v_orcado = document.getElementById('v_orcado')
    const coloridos = document.querySelectorAll('.numero')
    const painelParceiro = document.getElementById('painelParceiro')
    const descricao = document.getElementById('descricao')
    const app = document.getElementById('app').value

    const dataPagamento = document.getElementById('dataPagamento')
    const data = calcularDataPagamento(auxCategorias.atrasoRegras)
    let dataFinal = compararDatas(dataPagamento.value, data)

    // Validação de cores;
    colorir(app, 'app')
    colorir(v_orcado.value !== '', 'tabelaParceiro')
    colorir(cc.id !== '', 'cc')
    colorir(recebedor.id !== '', 'recebedor')
    colorir(descricao.value !== '', 'descricao')
    colorir(auxCategorias.completo, 'categorias')
    colorir(Object.keys(ultimoPagamento?.anexos || {}).length > 0, 'anexos')

    if (ultimoPagamento.anexos_parceiros && Object.keys(ultimoPagamento.anexos_parceiros).length > 0) {
        for (const [campo, anexos] of Object.entries(ultimoPagamento.anexos_parceiros)) {
            colorir(Object.keys(anexos).length > 0, campo)
        }
    }

    // Valores totais e de parceiros(quando existir);
    document.getElementById('v_pago').textContent = auxCategorias.valorParceiro
    document.getElementById('totalPagamento').textContent = dinheiro(auxCategorias.total || 0)
    document.getElementById('dataPagamento').value = dataFinal

    painelParceiro.style.display = auxCategorias.atrasoRegras > 0 ? 'flex' : 'none'
    if (painelParceiro.innerHTML == '' && auxCategorias.atrasoRegras > 0) {
        document.getElementById('v_pago').textContent = dinheiro(auxCategorias.valorParceiro)
        calcularCusto() // Tabela básica de parceiros;
    }

    // Verificar se todos os campos obrigatórios foram preenchidos (1 ao 5 == 0 ao 4);
    coloridos.forEach((numero, i) => { numero.textContent = (i + 1) })
    const baloes = document.querySelectorAll('.balao2025')
    let i = 0
    for (const item of baloes) {

        const numero = Number(coloridos[i].textContent)
        cor = item.style.background

        if (!cor.includes('green') || numero > 3) break

        i++

    }

    document.getElementById('liberarBotao').style.display = cor.includes('green') ? 'flex' : 'none'

    if (!pagamentoEmEdicao) backupPagamento()

    function backupPagamento() {

        const responsavelPagamento = ultimoPagamento?.criado || acesso.usuario
        const assinatura = `Solicitante: ${responsavelPagamento}`
        const descricaoFinal = descricao.value.includes(assinatura) ? descricao.value : `${assinatura} \n ${descricao.value}`
        const [ano, mes, dia] = dataFinal.split('-')
        dataFinal = `${dia}/${mes}/${ano}`

        ultimoPagamento = {
            ...ultimoPagamento,
            app,
            departamento: cc.id,
            data_registro: obterDatas('completa'),
            criado: responsavelPagamento,
            resumo: {
                v_pago: auxCategorias.valorParceiro,
                v_orcado: Number(v_orcado.value),
            },
            param: [
                {
                    codigo_cliente_fornecedor: recebedor.id,
                    valor_documento: auxCategorias.total,
                    observacao: descricaoFinal,
                    codigo_lancamento_integracao: '',
                    data_vencimento: dataFinal,
                    distribuicao: [
                        {
                            cCodDep: Number(cc.id),
                            nPerDep: 100
                        }
                    ],
                    data_previsao: dataFinal,
                    categorias: auxCategorias.categorias,
                }
            ]

        }

        if (auxCategorias.atrasoRegras == 0) {
            painelParceiro.innerHTML = incluirCamposAdicionais()
            delete ultimoPagamento.anexos_parceiros
        }

        localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))
    }

    function calcularCategorias() {

        const centralCategorias = document.querySelector('.centralCategorias')
        const spansCategorias = centralCategorias.querySelectorAll('span')
        const valores = centralCategorias.querySelectorAll('input[type="number"]');
        let resultado = {
            completo: false,
            atrasoRegras: 0,
            valorParceiro: 0,
            total: 0,
            categorias: [],
            i: 0
        }

        if (!centralCategorias || spansCategorias.length === 0) return resultado

        for (const span of spansCategorias) {

            const valor = Number(valores[resultado.i].value)
            const codigo_categoria = span.id
            const nome = span.textContent

            resultado.total += valor

            resultado.categorias.push({ valor, codigo_categoria })

            if (nome.includes('Adiantamento de Parceiro') && resultado.atrasoRegras == 0) {
                resultado.atrasoRegras = 1
            } else if (nome.includes('Pagamento de Parceiro')) {
                resultado.atrasoRegras = 2
            }

            resultado.valorParceiro += valor

            if (codigo_categoria == '' || valor == 0) return resultado

            resultado.i++

        }

        resultado.completo = true
        return resultado

    }

    function colorir(validacao, elemento) {
        const el = document.querySelector(`[name="${elemento}Numero"]`)
        const balao = el?.parentElement
        if (balao) balao.style.background = `linear-gradient(to right, ${validacao ? 'green' : '#B12425'} 10%, #f0f0f0 10%)`
    }

}

async function recuperarUltimoPagamento() {

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento'))

    if (!ultimoPagamento) return await calculadoraPagamento()

    overlayAguarde()

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_CC = await recuperarDados('dados_CC') || {}

    const cc = document.querySelector('[name="cc"]')
    cc.id = ultimoPagamento?.departamento || ''
    cc.textContent = dados_CC?.[cc.id]?.nome || 'Selecionar'

    const recebedor = document.querySelector('[name="recebedor"]')
    recebedor.id = ultimoPagamento?.param[0]?.codigo_cliente_fornecedor || ''
    recebedor.textContent = dados_clientes?.[ultimoPagamento?.param[0]?.codigo_cliente_fornecedor]?.nome || 'Selecionar'

    document.getElementById('descricao').value = ultimoPagamento?.param[0]?.observacao || ''

    document.getElementById('app').value = ultimoPagamento?.app || 'AC'

    let dataSalva = ''
    if (ultimoPagamento?.param[0]?.data_vencimento) {
        dataSalva = ultimoPagamento?.param[0]?.data_vencimento
        const [dia, mes, ano] = dataSalva.split('/')
        dataSalva = `${ano}-${mes}-${dia}`
    }

    document.getElementById('dataPagamento').value = dataSalva

    for (const categoria of ultimoPagamento?.param[0]?.categorias || []) maisCategoria(categoria)

    if (ultimoPagamento.anexos) {
        const anexosDiversos = document.getElementById('anexosDiversos')
        for (const [link, anexo] of Object.entries(ultimoPagamento.anexos)) {
            anexosDiversos.insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, link, `removerAnexoTemporario('${link}')`))
        }
    }

    if (ultimoPagamento.anexos_parceiros) {
        for (const [campo, anexos] of Object.entries(ultimoPagamento.anexos_parceiros)) {

            const divLocalAnexo = document.getElementById(`div${campo}`)
            for (const [link, anexo] of Object.entries(anexos)) {
                divLocalAnexo.insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, link, `removerAnexoParceiro('${campo}', '${link}')`))
            }

        }
    }

    await calculadoraPagamento(true)

    removerOverlay()

}

async function maisCategoria(dados = {}) {

    const aleatorio = ID5digitos()
    const categoria = await recuperarDado('dados_categorias', dados.codigo_categoria)
    const categoriaHTML = `
        <div style="${horizontal}; justify-content: start; margin-right: 1vw;">

            R$ <input value="${dados?.valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            
            <span class="opcoes" name="${aleatorio}" ${dados.codigo_categoria ? `id="${dados.codigo_categoria}"` : ''} onclick="cxOpcoes('${aleatorio}', 'dados_categorias', ['categoria'], 'calculadoraPagamento()')">${categoria?.categoria || 'Selecionar'}</span>

            <label src="imagens/remover.png" style="cursor: pointer; width: 1.5rem; font-size: 2.5vw;" onclick="apagarCategoria(this)">&times;</label>

        </div>
    `;

    document.querySelector('.centralCategorias').insertAdjacentHTML('beforeend', categoriaHTML)
    if (!dados.codigo) await calculadoraPagamento()

}

async function apagarCategoria(xis) {
    xis.parentElement.remove()
    await calculadoraPagamento()
}

async function salvarAnexosParceiros(input, campo, id_pagamento) {

    let anexos = await importarAnexos(input)

    if (id_pagamento == undefined) { // O anexo do parceiro é incluído no formulário de pagamento; (Pagamento ainda não existe)
        let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

        anexos.forEach(anexo => {

            if (!ultimoPagamento.anexos_parceiros) {
                ultimoPagamento.anexos_parceiros = {}
            }

            if (!ultimoPagamento.anexos_parceiros[campo]) {
                ultimoPagamento.anexos_parceiros[campo] = {}
            }

            ultimoPagamento.anexos_parceiros[campo][anexo.link] = anexo

            document.getElementById(`div${campo}`).insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${campo}', '${link}')`))
        })

        localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

        await calculadoraPagamento()

    } else { // O anexo deve ser incluído no pagamento já existente;

        let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

        if (!pagamento.anexos_parceiros) pagamento.anexos_parceiros = {}

        if (!pagamento.anexos_parceiros[campo]) pagamento.anexos_parceiros[campo] = {}

        anexos.forEach(anexo => {

            let id = ID5digitos()

            if (pagamento.anexos_parceiros[campo][id]) pagamento.anexos_parceiros[campo][id] = {}

            pagamento.anexos_parceiros[campo][id] = anexo
            enviar(`lista_pagamentos/${id_pagamento}/anexos_parceiros/${campo}/${id}`, anexo)

            let container = document.getElementById(`div${campo}`)

            let string_anexo = criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_parceiro('${id_pagamento}', '${campo}', '${id}')`);

            if (container) {
                container.insertAdjacentHTML('beforeend', string_anexo)
            }
        })

        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')

    }

}

async function removerAnexoParceiro(campo, link) {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    delete ultimoPagamento.anexos_parceiros[campo][link]

    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

    document.querySelector(`[name="${link}"]`).remove()

    await calculadoraPagamento()

}

async function duplicarPagamento(id_pagamento) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    const assinatura = `Solicitante: ${pagamento.criado}`

    delete pagamento.id_pagamento
    delete pagamento.criado
    delete pagamento.param[0].codigo_lancamento_integracao
    delete pagamento.historico
    delete pagamento.status

    pagamento.param[0].observacao = pagamento.param[0].observacao.replace(assinatura, '')

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await criarPagamento()

    removerOverlay()

}

async function editarPagamento(id_pagamento) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    const omieStatus = ['A VENCER', 'PAGO', 'ATRASADO', 'VENCE HOJE']

    if (omieStatus.includes(pagamento.status)) return popup(mensagem('Este pagamento já está no Omie e por isso não pode ser editado!'), 'AVISO', true)

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await criarPagamento()

    removerOverlay()

}
