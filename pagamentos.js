let filtrosAtivosPagamentos = {}
let opcoesStatus = [
    '',
    'Aguardando aprovação da Diretoria',
    'Aguardando aprovação da Gerência',
    'Pagamento Excluído',
    'Processando...'
]

function imagemEspecifica(justificativa) {

    let cor = '#222'
    let imagem = "imagens/remover.png"
    if (justificativa.status.includes('Aprovado')) {
        cor = '#4CAF50'
        imagem = "imagens/concluido.png"
    } else if (dados_setores[justificativa.usuario]?.permissao == 'qualidade') {
        cor = '#32a5e7'
        imagem = "imagens/qualidade.png"
    } else if (justificativa.status.includes('Reprovado')) {
        cor = '#B12425'
        imagem = "imagens/remover.png"
    } else if (justificativa.status.includes('Aguardando')) {
        cor = '#D97302'
        imagem = "imagens/avencer.png"
    } else if (justificativa.status.includes('Aguardando')) {
        cor = '#D97302'
        imagem = "imagens/avencer.png"
    } else {
        cor = '#B12425'
    }

    return { imagem, cor }

}

carregarPagamentos()

async function recuperarPagamentos() {

    overlayAguarde()

    await lista_setores()
    await sincronizarDados('dados_categorias', true)
    await sincronizarDados('lista_pagamentos', true)
    await sincronizarDados('dados_clientes', true)
    await sincronizarDados('dados_orcamentos', true)

    // Atualizar os do clone;
    ativarCloneGCS(true)
    await sincronizarDados('dados_orcamentos', true)
    ativarCloneGCS(false)

    await criarBaseCC()

    await retomarPaginacao()

    removerOverlay()

}

async function criarBaseCC() {

    let dados_CC = {}
    const dados_orcamentos = await recuperarDados('dados_orcamentos', true)
    const dados_clientes = await recuperarDados('dados_clientes')
    const departamentosFixos = JSON.parse(localStorage.getItem('departamentos_fixos'))

    for (const dep of departamentosFixos) dados_CC[dep] = { nome: dep }

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        const omie_cliente = orcamento?.dados_orcam?.omie_cliente
        const cliente = dados_clientes?.[omie_cliente] || {}

        dados_CC[idOrcamento] = {
            analista: orcamento?.dados_orcam?.analista || '',
            contrato: orcamento?.dados_orcam?.contrato || '',
            nome: cliente?.nome || '',
            cidade: cliente?.cidade || '',
            cnpj: cliente?.cnpj || '',
            valor: orcamento.total_geral ? dinheiro(orcamento.total_geral) : ''
        }
    }

    await inserirDados(dados_CC, 'dados_CC', true)
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

async function carregarPagamentos() {

    let div_pagamentos = document.getElementById('div_pagamentos')
    if (!div_pagamentos) return

    //Chamada para o endpoint que já retorna os pagamentos filtrados;
    let acumulado = ''
    const lista_pagamentos = await filtrarPagamentos() // Filtrar de acordo com o usuário atual;
    const orcamentos = await recuperarDados('dados_orcamentos', true) || {};
    const dados_clientes = await recuperarDados('dados_clientes') || {};
    let linhas = ''
    let contagens = { TODOS: { qtde: 0, valor: 0 } }

    for (const [idPagamento, pagamento] of Object.entries(lista_pagamentos).reverse()) {

        if (!contagens[pagamento.status]) contagens[pagamento.status] = { qtde: 0, valor: 0 }

        contagens[pagamento.status].qtde++
        contagens[pagamento.status].valor += pagamento.param[0].valor_documento

        contagens.TODOS.qtde++
        contagens.TODOS.valor += pagamento.param[0].valor_documento

        const recebedor = dados_clientes?.[pagamento?.param[0]?.codigo_cliente_fornecedor]?.nome || ''
        const setorCriador = dados_setores?.[pagamento.criado]?.setor || ''
        const cc = orcamentos?.[pagamento.id_orcamento]?.dados_orcam?.omie_cliente || pagamento.id_orcamento
        const nomeCC = dados_clientes?.[cc]?.nome || cc

        linhas += `
                <tr>
                    <td>${pagamento.param[0].data_vencimento}</td>
                    <td>${nomeCC}</td>
                    <td>${dinheiro(pagamento.param[0].valor_documento)}</td>
                    <td>
                        <div style="${horizontal}; justify-content: start; gap: 5px;">
                            <img src="${iconePagamento(pagamento.status)}" style="width: 2vw;">
                            <label style="text-align: left;">${pagamento.status}</label>
                        </div>
                    </td>
                    <td>${pagamento.criado}</td>
                    <td>${setorCriador}</td>
                    <td>${recebedor}</td>
                    <td style="text-align: center;">
                        <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="abrirDetalhesPagamentos('${idPagamento}')">
                    </td>
                </tr>
            `
    };

    let colunas = ['Data de Previsão', 'Centro de Custo', 'Valor', 'Status', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

    let cabecalho1 = ''
    let cabecalho2 = ''
    colunas.forEach((coluna, i) => {

        cabecalho1 += `
                <th>${coluna}</th>
                `

        if (coluna == 'Detalhes') {
            cabecalho2 += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            cabecalho2 += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="display: flex; align-items: center; justify-content: left;">
                        <input style="width: 100%; font-size: 0.9vw;" placeholder="..." oninput="pesquisarGenerico(${i}, this.value, filtrosAtivosPagamentos, 'body')">
                        <img src="imagens/pesquisar2.png" style="width: 1vw;">
                    </div>
                </th>
                `}
    })

    let titulos = ''
    for ([nomeStatus, item] of Object.entries(contagens)) {

        if (item.valor == 0) continue

        titulos += `

            <div class="ambosLadosEtiqueta" onclick="pesquisarGenerico(3, '${nomeStatus == 'TODOS' ? '' : nomeStatus}', filtrosAtivosPagamentos, 'body')">
                
                <div class="ladoTexto">
                    <div style="display: flex; flex-direction: column; align-items: end; justify-content: end;">
                        <Label style="font-size: 0.8vw;"><strong>${nomeStatus}</strong></label>
                        <label style="font-size: 0.8vw;">${dinheiro(item.valor)}</label>
                    </div>
                    <img src="${iconePagamento(nomeStatus)}" style="width: 2vw;">
                </div>

                <div class="ladoQuantidade">
                    ${item.qtde}
                </div>
                
            </div>
            `
    }

    let div_titulos = `
        <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; width: 30%;">

            <div class="painelEsquerdo">
                ${titulos}
            </div>

        </div>
        `
    acumulado += `
        <div id="div_pagamentos" style="display: flex; justify-content: center; align-items: start; margin-right: 1vw;">

            ${div_titulos}
            <div style="${vertical};">
                <div class="painelBotoes"></div>
                <div class="divTabela">
                    <table id="pagamentos" class="tabela">
                        <thead>
                            <tr>${cabecalho1}</tr>
                            <tr>${cabecalho2}</tr>
                        </thead>
                        <tbody id="body">
                            ${linhas}
                        </tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
        </div>
        `
    div_pagamentos.innerHTML = acumulado

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

            <img src="gifs/alerta.gif" style="width: 3vw;">

            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; width: 100%; gap: 3px;">
                <label style="font-size: 1.2vw;">Aprovação do pagamento</label>

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

    overlayAguarde()

    let valores = ''
    let painelParceiro = false
    const dados_categorias = await recuperarDados('dados_categorias')
    const permissao = acesso.permissao
    const pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    const cliente_omie = pagamento.param[0].codigo_cliente_fornecedor
    const cliente = await recuperarDado('dados_clientes', cliente_omie)
    const orcamento = await recuperarDado('dados_orcamentos', pagamento.id_orcamento) || false
    const omieClienteOrcamento = orcamento?.dados_orcam?.omie_cliente || ''
    const clienteOrcamento = await recuperarDado('dados_clientes', omieClienteOrcamento)
    const anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexoPagamento('${id_pagamento}', '${idAnexo}')`))
        .join('')
    const btnDetalhes = (img, nome, funcao) => `
        <div class="btnDetalhes" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <label style="cursor: pointer;">${nome}</label>
        </div>
    `

    let historico = Object.entries(pagamento?.historico || {})
        .map(([his, justificativa]) => `
            <div class="vitrificado" style="border: 1px solid ${imagemEspecifica(justificativa).cor}">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                    <label><strong>Status </strong>${justificativa.status}</label>
                    <label><strong>Usuário </strong>${justificativa.usuario}</label>
                    <label><strong>Data </strong>${justificativa.data}</label>
                    <label><strong>Justificativa </strong>${justificativa.justificativa.replace(/\n/g, "<br>")}</label>
                </div>
                <img src="${imagemEspecifica(justificativa).imagem}" style="width: 3vw;">
            </div>`)
        .join('')

    pagamento.param[0].categorias.forEach(item => {

        const nomeCategoria = dados_categorias[item.codigo_categoria].categoria
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
                <label style="font-size: 2vw;">${dinheiro(pagamento.param[0].valor_documento)}</label>
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
                            <label style="cursor: pointer;"><strong>Orçamento disponível</strong></label>
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

                    for (const [idAnexo, anexo] of Object.entries(anexos)) {
                        docsExistentes += criarAnexoVisual(anexo.nome, anexo.link);
                    }
                }
            }

            infos += `
                <div class="balao2025">
                    <label class="numero"></label>
                    <div class="camposFinanceiro">

                        <div style="display: flex; gap: 5px; align-items: center; justify-content: left; width: 100%;">
                            <label class="contorno_botoes" for="anexo_${campo}" style="justify-content: start; border-radius: 50%;">
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

    const acumulado = `
    <div style="${vertical}; background-color: #d2d2d2; width: 60vw; overflow-x: hidden;">
    
        ${justificativaHTML(id_pagamento)}

        <div class="detalhesPagamento">

            ${orcamento ? btnDetalhes('pasta', 'Consultar Orçamento', `abrirAtalhos('${pagamento.id_orcamento}')`) : ''}
            ${btnDetalhes('reembolso', 'Duplicar Pagamento', `duplicarPagamento('${id_pagamento}')`)}
            ${(acesso.permissao == 'adm' || pagamento.usuario == acesso.usuario) ? btnDetalhes('editar', 'Editar Pagamento', `editarPagamento('${id_pagamento}')`) : ''}
            ${acesso.permissao == 'adm' ? btnDetalhes('remover', 'Excluir pagamento', `confirmarExclusaoPagamento('${id_pagamento}')`) : ''}
            ${acesso.permissao == 'adm' ? btnDetalhes('concluido', 'Lançar pagamento', `relancarPagamento('${id_pagamento}')`) : ''}
            ${acesso.permissao == 'adm' ? btnDetalhes('omie', 'Reimportar Anexos no Omie', `reprocessarAnexos('${id_pagamento}')`) : ''}

            ${modelo('Status Atual', `${divStatus}`)}
            ${modelo('Quem recebe', `${cliente.nome}`)}
            ${modelo('Centro de Custo', `<label>${clienteOrcamento?.nome || pagamento.id_orcamento}</label>`)}
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
    </div>
    `

    popup(acumulado, 'Detalhes do Pagamento')

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

async function alterarStatusPagamento(idPagamento, select) {

    let pagamento = await recuperarDado('lista_pagamentos', idPagamento)

    pagamento.status = select.value
    enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')
    await retomarPaginacao()

}

function confirmarExclusaoPagamento(id) {

    return popup(`
        <div style="background-color: #d2d2d2; display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column; padding: 2vw;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw;">
                <label>Deseja realmente excluir o pagamento?</label>
            </div>
            <label onclick="confirmarExclusaoPagamento('${id}')" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>
        `, 'AVISO', true)

}

async function retomarPaginacao() {

    await carregarPagamentos()

    let tabela = document.getElementById('div_pagamentos')
    let thead = tabela.querySelector('thead')
    let tsearch = thead.querySelectorAll('tr')[1]
    let ths = tsearch.querySelectorAll('th')

    for (col in filtrosAtivosPagamentos) {
        ths[col].querySelector('input').value = filtrosAtivosPagamentos[col]
        pesquisarGenerico(col, filtrosAtivosPagamentos[col], filtrosAtivosPagamentos, 'body')
    }
}

async function confirmarExclusaoPagamento(id) {

    removerPopup() //PopUp
    removerPopup() //Tela de Pagamento

    await deletarDB('lista_pagamentos', id)
    await deletar(`lista_pagamentos/${id}`)

    await retomarPaginacao()

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
                balao.style.background = `linear-gradient(to right, ${divs[i].children.length == 0 ? '#B12425' : 'green'
                    } 10%, #3b444c 0%)`
            }

            i++
        }
    }

    const v_orcado = document.getElementById('v_orcado')
    const el = document.querySelector('[name="tabelaParceiro"]')
    const balao = el?.parentElement
    if (!contornoBotaoLiberacao) el.textContent = i + 1

    if (balao) {
        balao.style.background = `linear-gradient(to right, ${v_orcado.value == 0 ? '#B12425' : 'green'
            } 10%, #3b444c 0%)`
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
            lancarPagamento(pagamento);
        } else if (permissao == 'fin' || (permissao == 'gerente' && setor == 'FINANCEIRO')) {
            status = `Aprovado pelo ${setor}`;
            lancarPagamento(pagamento);
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

    await retomarPaginacao()

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

        if (ultimoPagamento.total <= 500) {
            ultimoPagamento.status = 'Processando...'
            lancarPagamento(ultimoPagamento)
        } else if (permissao == 'gerente') {
            ultimoPagamento.status = 'Aguardando aprovação da Diretoria'
        } else {
            ultimoPagamento.status = 'Aguardando aprovação da Gerência'
        }

    }

    await enviar(`lista_pagamentos/${id_pagamento}`, ultimoPagamento)

    await inserirDados({ [id_pagamento]: ultimoPagamento }, 'lista_pagamentos')

    await retomarPaginacao()

    localStorage.removeItem('ultimoPagamento')

    popup(`
            <div style="${horizontal}; padding: 2vw; background-color: #d2d2d2; gap: 10px;">
                <img src="imagens/concluido.png" style="width: 2vw;">
                <label>Pagamento Solicitado</label>
            </div>                
        `, 'ALERTA')

}

function encerrarIntervalos() {
    clearInterval(intervaloCompleto);
    clearInterval(intervaloCurto);
}

async function atualizar_departamentos() {

    var departamentos = document.getElementById('departamentos')
    var aguarde = document.getElementById('aguarde')

    departamentos.style.display = 'none'
    aguarde.style.display = 'flex'

    await localStorage.setItem('departamentos_fixos', JSON.stringify(await receber('departamentos_fixos')))

    departamentos.style.display = 'flex'
    aguarde.style.display = 'none'

}

async function telaPagamento() {

    const modeloCampos = (name, nomeCampo, elemento) => `
        <div class="balao2025">
            <span name="${name}Numero" class="numero"></span>

            <div class="camposFinanceiro">
                <div style="${horizontal}; justify-content: start; width: 30%;">${nomeCampo}</div>
                ${elemento}
            </div>
        </div>`

    const acumulado = `

        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; height: 60vh; overflow-y: auto; overflow-x: hidden;">

            ${modeloCampos('cc', 'Centro de Custo', `
                    <span class="opcoes" name="cc" onclick="cxOpcoes('cc', 'dados_CC', ['nome', 'contrato', 'analista', 'cidade', 'cnpj', 'valor'], 'calculadoraPagamento()')">Selecionar</span>
                `)}

            ${modeloCampos('recebedor', 'Recebedor', `
                    <span class="opcoes" name="recebedor" onclick="cxOpcoes('recebedor', 'dados_clientes', ['nome', 'cnpj'], 'calculadoraPagamento()')">Selecionar</span>
                `)}

            ${modeloCampos('descricao', 'Descrição', `
                    <textarea style="width:80%" rows="3" id="descricao" oninput="calculadoraPagamento()"
                        placeholder="Deixe algum comentário importante. \nIsso facilitará o processo."></textarea>
                `)}

            ${modeloCampos('formaPagamento', 'Forma de Pagamento', `
                    <select id="pagamentoSelect" onchange="atualizarFormaPagamento(this.value)"
                        style="border-radius: 3px; padding: 5px; cursor: pointer;">
                        <option>Chave Pix</option>
                        <option>Boleto</option>
                    </select>
                    <div id="formaPagamentoDiv">
                        <textarea rows="3" id="pix"
                            placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."
                            oninput="calculadoraPagamento()"></textarea>
                    </div>
                `)}

            ${modeloCampos('categorias', `
                    <img src="imagens/baixar.png" style="width: 2vw; cursor: pointer;" onclick="maisCategoria()">`, `
                    <div class="centralCategorias"></div>
                `)}

            ${modeloCampos('anexos', 'Anexos Diversos', `
                    <label class="contorno_botoes" for="anexoPagamento" style="justify-content: center;">
                        Selecionar
                        <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this)" multiple>
                    </label>
                    <div id="anexosDiversos" style="${vertical}; gap: 2px;"></div>
                `)}

            <div id="painelParceiro" style="${vertical}; gap: 5px; width: 100%;">
                ${incluirCamposAdicionais()}
            </div>

        </div>

        <div class="contornoBotaoLiberacao">

            <div style="${vertical}">
                <label>Total</label>
                <label style="font-size: 2vw;" id="totalPagamento"></label>
                <label id="dataPagamento"></label>
            </div>

            <img src="gifs/interrogacao.gif" onclick="duvidas()">

            <label id="liberarBotao" class="contorno_botoes" style="background-color: green; display: none;"
                onclick="salvarPagamento()">Salvar</label>
            
            ${botao('Atualizar', 'recuperarPagamentos()', '#097fe6')}

            ${botao('Apagar', 'apagarPagamento()', '#B12425')}
            
        </div>
    `;

    popup(acumulado, 'Solicitação de Pagamento')

    await recuperarUltimoPagamento()

}

async function apagarPagamento() {
    localStorage.removeItem('ultimoPagamento')
    removerPopup()
    await telaPagamento()
}

function duvidas() {
    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">
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

async function atualizarFormaPagamento(formato, pular) {
    const formaPagamentoDiv = document.getElementById('formaPagamentoDiv');
    formato = formato || 'Chave Pix'
    document.getElementById('pagamentoSelect').value = formato

    formaPagamentoDiv.innerHTML = `
        ${formato == 'Chave Pix'
            ? `<textarea rows="3" id="pix" oninput="calculadoraPagamento()" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>`
            : `<input type="date" id="dtVencimento" oninput="calculadoraPagamento()" >`
        }
    `;

    if (!pular) await calculadoraPagamento()
}

function incluirCamposAdicionais() {

    const campos = {
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
                    <label class="contorno_botoes" for="anexo_${campo}" style="justify-content: center;">
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

    divAtualizar.innerHTML = `<img src="gifs/loading.gif" style="width: 2vw;">`

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
            ${botao('Atualizar', `atualizarResumo('${id_pagamento}')`, 'green')}
        </div>
        `
        : ''

    return `
            <div style="${vertical}">
                ${botaoAtualizar}
                <table class="tabela" style="margin: 5px; color: black;">
                    <thead style="background-color:#c4c4c4;">
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
    // aaaa-mm-dd
    const partes1 = data1.split("-");
    const date1 = new Date(partes1[0], partes1[1] - 1, partes1[2]);

    // dd/mm/aaaa
    const partes2 = data2.split("/");
    const date2 = new Date(partes2[2], partes2[1] - 1, partes2[0]);

    const dataFinal = date1.getTime() > date2.getTime() ? data1 : data2

    return new Date(dataFinal).toLocaleDateString('pt-BR')
}

async function calculadoraPagamento() {

    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    let cor = ''
    const recebedor = document.querySelector('[name="recebedor"]')
    const pix = document.getElementById('pix')
    const dtVencimento = document.getElementById('dtVencimento')
    const cc = document.querySelector('[name="cc"]')
    const auxCategorias = calcularCategorias()
    const v_orcado = document.getElementById('v_orcado')
    const coloridos = document.querySelectorAll('.numero')
    const painelParceiro = document.getElementById('painelParceiro')
    const data = obterDatas('curta', auxCategorias.atrasoRegras)
    const dataFinal = dtVencimento ? compararDatas(dtVencimento.value, data) : data
    const descricao = document.getElementById('descricao')

    // Validação de cores;
    colorir(v_orcado.value !== '', 'tabelaParceiro')
    colorir(cc.id !== '', 'cc')
    colorir(recebedor.id !== '', 'recebedor')
    colorir(descricao.value !== '', 'descricao')
    colorir(auxCategorias.completo, 'categorias')
    colorir(Object.keys(ultimoPagamento?.anexos || {}).length > 0, 'anexos')
    if (pix) colorir(pix.value !== '', 'formaPagamento')
    if (dtVencimento) colorir(dtVencimento.value !== '', 'formaPagamento')
    if (ultimoPagamento.anexos_parceiros && Object.keys(ultimoPagamento.anexos_parceiros).length > 0) {
        for (const [campo, anexos] of Object.entries(ultimoPagamento.anexos_parceiros)) {
            colorir(Object.keys(anexos).length > 0, campo)
        }
    }

    // Valores totais e de parceiros(quando existir);
    document.getElementById('v_pago').textContent = auxCategorias.valorParceiro
    document.getElementById('totalPagamento').textContent = dinheiro(auxCategorias.total || 0)
    document.getElementById('dataPagamento').textContent = `Será Pago em ${dataFinal}`

    painelParceiro.style.display = auxCategorias.atrasoRegras > 0 ? 'flex' : 'none'
    if (painelParceiro.innerHTML == '' && auxCategorias.atrasoRegras > 0) {
        document.getElementById('v_pago').textContent = dinheiro(auxCategorias.valorParceiro)
        calcularCusto() // Tabela básica de parceiros;
    }

    // Verificar se todos os campos obrigatórios foram preenchidos (1 ao 5 == 0 ao 4);
    coloridos.forEach((numero, i) => { numero.textContent = (i + 1) })
    for (const item of coloridos) {

        const numero = Number(item.textContent)
        cor = item.style.backgroundColor

        if (cor !== 'green' || numero > 4) break

    }

    document.getElementById('liberarBotao').style.display = cor == 'green' ? 'flex' : 'none'

    backupPagamento()

    function backupPagamento() {
        const pagamentoSelect = document.getElementById('pagamentoSelect')
        const assinatura = `Solicitante: ${acesso.usuario}`
        const descricaoFinal = descricao.value.includes(assinatura) ? descricao.value : `${assinatura} \n ${descricao.value}`

        ultimoPagamento = {
            ...ultimoPagamento,
            pagamentoSelect: pagamentoSelect.value,
            id_orcamento: cc.id,
            departamento: cc.id,
            data_registro: obterDatas('completa'),
            criado: acesso.usuario,
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
                    data_previsao: dataFinal,
                    categorias: auxCategorias.categorias,
                    id_conta_corrente: '6054234828', // Itaú AC > Padrão;
                    distribuicao: []
                }
            ]

        }

        if (pix) {
            ultimoPagamento.pix = pix.value
            delete ultimoPagamento.dtVencimento
        }

        if (dtVencimento) {
            ultimoPagamento.dtVencimento = dtVencimento.value
            delete ultimoPagamento.pix
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
        if (balao) balao.style.background = `linear-gradient(to right, ${validacao ? 'green' : '#B12425'} 10%, #3b444c 0%)`
    }

}

async function recuperarUltimoPagamento() {

    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento'))

    if (!ultimoPagamento) return await calculadoraPagamento()

    overlayAguarde()

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_CC = await recuperarDados('dados_CC') || {}

    const cc = document.querySelector('[name="cc"]')
    cc.id = ultimoPagamento?.id_orcamento || ''
    cc.textContent = dados_CC?.[cc.id]?.nome || 'Selecionar'

    const recebedor = document.querySelector('[name="recebedor"]')
    recebedor.id = ultimoPagamento?.param[0]?.codigo_cliente_fornecedor || ''
    recebedor.textContent = dados_clientes?.[ultimoPagamento?.param[0]?.codigo_cliente_fornecedor]?.nome || 'Selecionar'

    atualizarFormaPagamento(ultimoPagamento.pagamentoSelect, true)

    if (ultimoPagamento.pagamentoSelect == 'Boleto') {
        document.getElementById('dtVencimento').value = ultimoPagamento?.dtVencimento || ''
    } else {
        document.getElementById('pix').value = ultimoPagamento?.pix || ''
    }

    document.getElementById('descricao').value = ultimoPagamento?.param[0]?.observacao || ''

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

    await calculadoraPagamento()

    removerOverlay()

}

async function maisCategoria(dados = {}) {

    const aleatorio = ID5digitos()
    const categoria = await recuperarDado('dados_categorias', dados.codigo_categoria)
    const categoriaHTML = `
        <div style="${horizontal}; justify-content: start;">

            R$ <input value="${dados?.valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            
            <span class="opcoes" name="${aleatorio}" ${dados.codigo_categoria ? `id="${dados.codigo_categoria}"` : ''} onclick="cxOpcoes('${aleatorio}', 'dados_categorias', ['categoria'], 'calculadoraPagamento()')">${categoria?.categoria || 'Selecionar'}</span>

            <label src="imagens/remover.png" style="cursor: pointer; width: 2vw; font-size: 2.5vw;" onclick="apagarCategoria(this)">&times;</label>

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

    delete pagamento.id_pagamento
    delete pagamento.param[0].codigo_lancamento_integracao
    delete pagamento.historico
    delete pagamento.status

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await telaPagamento()

    removerOverlay()

}

async function editarPagamento(id_pagamento) {

    overlayAguarde()
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)

    const omieStatus = ['A VENCER', 'PAGO', 'ATRASADO', 'VENCE HOJE']

    if (omieStatus.includes(pagamento.status)) return popup(mensagem('Este pagamento já está no Omie e por isso não pode ser editado!'), 'AVISO', true)

    localStorage.setItem('ultimoPagamento', JSON.stringify(pagamento))

    await telaPagamento()

    removerOverlay()

}
