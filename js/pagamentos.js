let idP = null
let departamentos = {}
let dados_categorias_AC = {}
let departamentos_AC = {}
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
        'dados_categorias_AC', // Referência;
        'lista_pagamentos',
        'dados_setores',
        'dados_clientes',
        'dados_orcamentos'
    ]

    for (const base of tabelas) await sincronizarDados({ base })

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

            pagamentosFiltrados[idPagamento] = pagamento

        } else if (
            pagamento.criado == acesso.usuario ||
            (acesso.permissao == 'gerente' && pagamento.status.includes('Gerência')) ||
            (acesso.permissao == 'qualidade' && pagamento.status.includes('Qualidade'))
        ) {
            pagamentosFiltrados[idPagamento] = pagamento
        }
    }

    return pagamentosFiltrados
}

async function telaPagamentos() {

    overlayAguarde()

    await auxDepartamentos() // Orcs, deps e clis;
    dados_setores = await recuperarDados('dados_setores')
    dados_categorias_AC = await recuperarDados('dados_categorias_AC')

    const lista_pagamentos = await filtrarPagamentos() // Filtrar de acordo com o usuário atual;
    let colunas = ['Data de Previsão', 'Departamentos', 'APP', 'Valor', 'Status', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']
    let cabecalho1 = ''
    let cabecalho2 = ''
    colunas.forEach((coluna, i) => {

        cabecalho1 += `<th>${coluna}</th>`

        if (coluna == 'Detalhes') {
            cabecalho2 += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            cabecalho2 += `<th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, 'bodyPagamentos')"></th>`
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
                        <tbody id="bodyPagamentos"></tbody>
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

            <div class="balao-pagamentos" onclick="pesquisarGenerico(4, '${nomeStatus == 'TODOS' ? '' : nomeStatus}', 'bodyPagamentos')">
                
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

    const deps = (pagamento?.param[0]?.distribuicao || [])
        .map(dep => {
            const departamento = departamentos_AC?.[dep.cCodDep] || {}
            const nomeCliente = departamento?.cliente?.nome || ''
            return `
                <div style="${vertical}; gap: 2px; text-align: left;">
                    <span>• <b>${departamento?.descricao || ''}</b></span>
                    <span>${nomeCliente}</span>
                </div>
            `
        }).join('')

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
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;" onclick="abrirDetalhesPagamentos('${pagamento.id_pagamento}')">
        </td>
        `
    const idLinha = pagamento.id_pagamento
    const tr = document.getElementById(idLinha)
    if (tr) return tr.innerHTML = tds

    document.getElementById('bodyPagamentos').insertAdjacentHTML('beforeend', `<tr id="${pagamento.id_pagamento}">${tds}</tr>`)
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
        <div class="balao" style="${horizontal}; width: 100%;">

            <img src="gifs/alerta.gif" style="width: 3rem;">

            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; width: 100%; gap: 3px;">
                <label>Aprovação do pagamento</label>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; width: 70%;">
                    <textarea id="justificativa" style="width: 100%;" placeholder="Descreva o motivo da aprovação/reprovação" oninput="auxiliar(this)"></textarea>
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

    const modelo = (texto1, elemento) => `
        <div style="${vertical}; gap: 2px;">
            <span><b>${texto1}</b></span>
            <div>${elemento}</div>
        </div>
    `

    let valores = ''
    let painelParceiro = false
    const permissao = acesso.permissao
    const pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    const cliente_omie = pagamento.param[0].codigo_cliente_fornecedor
    const cliente = await recuperarDado('dados_clientes', cliente_omie) || await recuperarDado('dados_clientes_IAC', cliente_omie)
    const anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoPagamento('${id_pagamento}', '${idAnexo}')`))
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

        const nomeCategoria = dados_categorias_AC?.[item.codigo_categoria]?.categoria || 'Categoria Desativada'
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
                        <div onclick="irPdf('${pagamento.id_orcamento}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 15vw;">
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

    // Edição de Status;
    const divStatus = (permissao == 'adm')
        ? `
        <select class="selectStatus" onchange="alterarStatusPagamento('${id_pagamento}', this)">
            ${opcoesStatus.map(op => `<option ${pagamento.status == op ? 'selected' : ''}>${op}</option>`).join('')}
        </select>`
        : `<label>${pagamento.status}</label>`;

    const depPagam = pagamento?.param?.[0]?.distribuicao || []
    const orcsVinculados = []

    for (const dep of depPagam) {
        const cc = departamentos[dep.cCodDep]
        if (!cc?.ids?.length) continue
        for (const id of cc.ids) orcsVinculados.push(id)
    }

    const btnsOrcamentos = orcsVinculados
        .map(id => {
            const orc = dados_orcamentos[id] || {}
            const idCli = orc.dados_orcam.omie_cliente
            const cli = dados_clientes[idCli] || {}
            return btnDetalhes('pasta', `${cli?.nome || '...'} <br>${dinheiro(orc?.total_geral)}`, `abrirAtalhos('${id}')`)
        }).join('')

    const bEspeciais = permissao == 'adm'
        ? `
        ${btnDetalhes('editar', 'Editar Pagamento', `editarPagamento('${id_pagamento}')`)}
        ${btnDetalhes('cancel', 'Excluir pagamento', `confirmarExclusaoPagamento('${id_pagamento}')`)}
        ${btnDetalhes('concluido', 'Lançar pagamento', `relancarPagamento('${id_pagamento}')`)}
        ${btnDetalhes('anexo', 'Reimportar Anexos no Omie', `reprocessarAnexos('${id_pagamento}')`)}`
        : ''

    const deps = (pagamento?.param[0]?.distribuicao || [])
        .map(dep => {
            const departamento = departamentos?.[dep.cCodDep] || {}
            const nomeCliente = departamento?.cliente?.nome || ''
            return `
                <div style="${vertical}; gap: 2px; text-align: left;">
                    <span>• <b>${departamento?.descricao || ''}</b></span>
                    <span>${nomeCliente}</span>
                </div>
            `
        }).join('')

    const acumulado = `
        ${justificativaHTML(id_pagamento)}

        <div class="detalhesPagamento">
            <div style="${vertical}; gap: 1px; width: 100%;">
                ${btnsOrcamentos}
                ${btnDetalhes('reembolso', 'Duplicar Pagamento', `duplicarPagamento('${id_pagamento}')`)}

                ${bEspeciais}

            </div>

            <hr>

            ${modelo('Departamentos', deps)}
            ${modelo('Status Atual', divStatus)}
            ${modelo('Quem recebe', cliente.nome)}
            ${modelo('Data de Solicitação', pagamento.data_registro)}
            ${modelo('Data de Pagamento', pagamento.param[0].data_vencimento)}

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

                let element = criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${id_pagamento}', '${item}', '${anx}')`);

                document.getElementById(`div${item}`).insertAdjacentHTML('beforeend', element)

            }
        }
    }

    calcularCusto()

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

async function removerAnexoPagamento(id_pagamento, anx) {

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    if (pagamento.anexos && pagamento.anexos[anx]) {

        delete pagamento.anexos[anx]

        deletar(`lista_pagamentos/${id_pagamento}/anexos/${anx}`)
        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')
        await abrirDetalhesPagamentos(id_pagamento)
    }

}

async function removerAnexoParceiro(id_pagamento, campo, anx) {

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

    const pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    const justificativa = document.getElementById('justificativa').value
    const usuario = acesso.usuario;
    const permissao = acesso.permissao
    const setor = acesso.setor
    let status;
    const setorUsuarioPagamento = dados_setores?.[pagamento.criado]?.setor || ''

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

    await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id_pagamento)

    await enviar(`lista_pagamentos/${id_pagamento}/historico/${idJustificativa}`, historico)
    await enviar(`lista_pagamentos/${id_pagamento}/status`, status)

    await telaPagamentos()

}

async function salvarPagamento() {

    overlayAguarde()

    const resposta = await calculadoraPagamento(true) // Última verificação antes de salvar;
    if (resposta && resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Atenção', true)

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const permissao = acesso.permissao
    let id_pagamento = ultimoPagamento.id_pagamento

    // Verificar se na observação contém a primeira linha "Solicitante"
    const observacao = ultimoPagamento.param[0].observacao
    const identificacao = 'Solicitante:'
    if (!observacao.includes(identificacao))
        ultimoPagamento.param[0].observacao = `${identificacao} ${acesso.usuario} \n ${observacao}`

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

        const divPagamentos = document.querySelector('.divPagamentos')
        if (divPagamentos) criarLinhaPagamento(ultimoPagamento)

        localStorage.removeItem('ultimoPagamento')
        popup(mensagem('Pagamento Salvo', 'imagens/concluido.png'), 'Sucesso')

    } catch (e) {
        console.log(e)
        popup(mensagem('Não foi possível salvar o pagamento, tente novamente.'), 'Alerta', true)

    }

}

async function formularioPagamento() {

    const totalPagamento = document.getElementById('totalPagamento')
    if (totalPagamento) return

    dados_clientes = await recuperarDados('dados_clientes')
    const ulP = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    const { observacao = '', categorias = [], distribuicao = [], valor_documento = 0, data_vencimento, codigo_cliente_fornecedor = '' } = ulP?.param?.[0] || {}
    const { nome = 'Selecionar' } = dados_clientes?.[codigo_cliente_fornecedor] || {}
    const [dia, mes, ano] = data_vencimento ? data_vencimento.split('/') : ''
    const dtVencimento = `${ano}-${mes}-${dia}`

    const linhas = [
        {
            texto: 'Recebedor',
            elemento: `
            <span 
            class="opcoes" 
            name="recebedor"
            ${codigo_cliente_fornecedor ? `id="${codigo_cliente_fornecedor}"` : ''}
            onclick="cxOpcoes('recebedor', 'dados_clientes', ['nome', 'cnpj'], 'calculadoraPagamento()')">
                ${nome}
            </span>
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
                    <label for="anexoPagamento" style="justify-content: start; border-radius: 50%;">
                        <img src="imagens/anexo.png">
                        <input 
                            type="file" 
                            id="anexoPagamento" 
                            style="display: none;" onchange="salvarAnexosPagamentos(this)">
                    </label>
                    <div id="anexosDiversos" style="${vertical}; gap: 2px;">
                        ${Object.values(ulP.anexos || {}).map(anexo => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoTemporario('${anexo.link}')`)).join('')}
                    </div>
                </div>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar Pagamento', img: 'concluido', funcao: 'salvarPagamento()' },
        { texto: 'Atualizar', img: 'atualizar', funcao: 'recuperarPagamentos()' },
        { texto: 'Regras', img: 'alerta', funcao: 'duvidas()' },
        { texto: 'Recomeçar', img: 'cancel', funcao: 'apagarPagamento()' }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Solicitação de Pagamento' })
    form.abrirFormulario()

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

    const spans = {
        dados_categorias_AC: `
        <span 
            class="opcoes" 
            name="${aleatorio}" 
            ${id ? `id="${id}"` : ''}
            onclick="cxOpcoes('${aleatorio}', 'dados_categorias_AC', ['categoria'], 'calculadoraPagamento()')">
                ${elemento?.categoria || 'Selecionar'}
        </span>
        `,
        departamentos_AC: `
        <span
            class="opcoes"
            name="${aleatorio}"
            ${id ? `id="${id}"` : ''}
            onclick="cxOpcoes('${aleatorio}', 'departamentos_AC', ['descricao', 'cliente/nome', 'cliente/cnpj', 'total'], 'calculadoraPagamento()')">
                ${elemento?.descricao || 'Selecionar'}
        </span>
    `}

    const campoAdicional = `
        <div style="${horizontal}; justify-content: start; margin-right: 1rem;">

            <div style="${horizontal}; gap: 5px;">
                <span>R$</span> 
                <input name="${base}" value="${valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            </div>

            ${spans[base]}

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

function compararDatas(data1, data2) {
    const d1 = new Date(data1);
    const d2 = new Date(data2);

    const maior = data1 == '' ? data2 : d1.getTime() > d2.getTime() ? data1 : data2;

    return maior;
}

async function salvarAnexosParceiros(input, campo, id_pagamento) {

    const anexos = await importarAnexos(input)

    if (id_pagamento == undefined) { // O anexo do parceiro é incluído no formulário de pagamento; (Pagamento ainda não existe)
        let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

        anexos.forEach(anexo => {

            ultimoPagamento.anexos_parceiros ??= {}
            ultimoPagamento.anexos_parceiros[campo] ??= {}
            ultimoPagamento.anexos_parceiros[campo][anexo.link] = anexo

            document.getElementById(`div${campo}`).insertAdjacentHTML('beforeend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${campo}', '${link}')`))
        })

        localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

    } else { // O anexo deve ser incluído no pagamento já existente;

        let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

        pagamento.anexos_parceiros ??= {}
        pagamento.anexos_parceiros[campo] ??= {}

        anexos.forEach(anexo => {

            let id = ID5digitos()

            if (pagamento.anexos_parceiros[campo][id]) pagamento.anexos_parceiros[campo][id] = {}

            pagamento.anexos_parceiros[campo][id] = anexo
            enviar(`lista_pagamentos/${id_pagamento}/anexos_parceiros/${campo}/${id}`, anexo)

            let container = document.getElementById(`div${campo}`)

            let string_anexo = criarAnexoVisual(anexo.nome, anexo.link, `removerAnexoParceiro('${id_pagamento}', '${campo}', '${id}')`);

            if (container) container.insertAdjacentHTML('beforeend', string_anexo)
        })

        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos')

    }

}

async function removerAnexoParceiroTemporario(campo, link) {

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}

    delete ultimoPagamento.anexos_parceiros[campo][link]

    localStorage.setItem('ultimoPagamento', JSON.stringify(ultimoPagamento))

    document.querySelector(`[name="${link}"]`).remove()

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

    await formularioPagamento()

    removerOverlay()

}

async function editarPagamento(id_pagamento) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    const omieStatus = ['A VENCER', 'PAGO', 'ATRASADO', 'VENCE HOJE']

    if (omieStatus.includes(pagamento.status)) return popup(mensagem('Este pagamento já está no Omie e por isso não pode ser editado!'), 'AVISO', true)

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await formularioPagamento()

    removerOverlay()

}
