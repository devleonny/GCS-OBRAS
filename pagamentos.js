let filtrosAtivosPagamentos = {}
let opcoesStatus = [
    '',
    'Aguardando aprovação da Diretoria',
    'Aguardando aprovação da Gerência',
    'Pagamento Excluído',
    'Processando...'
]

let ordem = 0
function ordenar() {
    ordem++
    return ordem
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

    for (const dep of departamentosFixos) dados_CC[dep] = { nome: dep, analista: '--', contrato: '--', estado: '--', cnpj: '--', valor: '--' }

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        const omie_cliente = orcamento?.dados_orcam?.omie_cliente
        const cliente = dados_clientes?.[omie_cliente] || {}

        dados_CC[idOrcamento] = {
            analista: orcamento?.dados_orcam?.analista || '--',
            contrato: orcamento?.dados_orcam?.contrato || '--',
            nome: cliente?.nome || '--',
            estado: cliente?.estado || '--',
            cnpj: cliente?.cnpj || '--',
            valor: orcamento.total_geral ? dinheiro(orcamento.total_geral) : '--'
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
    let lista_pagamentos = await filtrarPagamentos() // Filtrar de acordo com o usuário atual;
    const dados_categorias = await recuperarDados('dados_categorias')
    const orcamentos = await recuperarDados('dados_orcamentos', true) || {};
    const dados_clientes = await recuperarDados('dados_clientes') || {};
    let linhas = ''

    let pagamentosFiltrados = Object.keys(lista_pagamentos)
        .map(idPagamento => {

            let pagamento = lista_pagamentos[idPagamento];
            let omieCliente = orcamentos?.[pagamento.id_orcamento]?.dados_orcam?.omie_cliente || ''
            let nome_orcamento = dados_clientes?.[omieCliente]?.nome || pagamento.id_orcamento

            let valor_categorias = pagamento.param[0].categorias.map(cat =>
                `<p>${dinheiro(cat.valor)} - ${dados_categorias[cat.codigo_categoria].categoria}</p>`
            ).join('');


            let data_registro = pagamento.data_registro || pagamento.param[0].data_previsao;

            return {
                id: idPagamento,
                param: pagamento.param,
                data_registro,
                data_previsao: pagamento.param[0].data_previsao,
                nome_orcamento,
                valor_categorias,
                status: pagamento.status,
                observacao: pagamento.param[0].observacao,
                criado: pagamento.criado,
                anexos: pagamento.anexos
            };
        })
        .filter(Boolean);

    const parseDate = (data) => {
        const [dia, mes, ano] = data.split('/').map(Number);
        return new Date(ano, mes - 1, dia);
    };

    pagamentosFiltrados.sort((a, b) => parseDate(b.data_previsao) - parseDate(a.data_previsao));

    let contagens = { TODOS: { qtde: 0, valor: 0 } }

    for ([ordem, pagamento] of Object.entries(pagamentosFiltrados)) {

        if (!contagens[pagamento.status]) {
            contagens[pagamento.status] = { qtde: 0, valor: 0 }
        }

        contagens[pagamento.status].qtde++
        contagens[pagamento.status].valor += pagamento.param[0].valor_documento

        contagens.TODOS.qtde++
        contagens.TODOS.valor += pagamento.param[0].valor_documento

        let div = `
            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                <img src="${iconePagamento(pagamento.status)}" style="width: 2vw;">
                <label>${pagamento.status}</label>
            </div>
            `
        let setor_criador = ''
        if (dados_setores[pagamento.criado]) {
            setor_criador = dados_setores[pagamento.criado].setor
        }

        let recebedor = pagamento.param[0].codigo_cliente_fornecedor
        if (dados_clientes[recebedor]) {
            recebedor = dados_clientes[recebedor].nome
        }

        linhas += `
                <tr>
                    <td>${pagamento.data_previsao}</td>
                    <td>${pagamento.nome_orcamento}</td>
                    <td style="text-align: left;">${pagamento.valor_categorias}</td>
                    <td>${div}</td>
                    <td>${pagamento.criado}</td>
                    <td>${setor_criador}</td>
                    <td>${recebedor}</td>
                    <td style="text-align: center;"><img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="abrirDetalhesPagamentos('${pagamento.id}')"></td>
                </tr>
            `
    };

    let colunas = ['Data de Previsão', 'Centro de Custo', 'Valor e Categoria', 'Status Pagamento', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

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

            <div class="divTabela">
                <table id="pagamentos" class="tabela">
                    <thead>
                        <tr>${cabecalho1}</tr>
                        <tr id="thead_pesquisa">${cabecalho2}</tr>
                    </thead>
                    <tbody id="body">
                        ${linhas}
                    </tbody>
                </table>
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
                    <button id="aprovar" style="display: none; background-color: green; padding: 5px;" onclick="atualizar_feedback(true, '${idPagamento}')">Aprovar</button>
                    <button id="reprovar" onclick="atualizar_feedback(false, '${idPagamento}')" style="display: none; padding: 5px;">Reprovar</button>
                </div>
            </div>
        </div>
        `
}

async function abrirDetalhesPagamentos(id_pagamento) {

    ordem = 0

    const dados_categorias = await recuperarDados('dados_categorias')

    let valores = ''
    let painelParceiro = false
    let permissao = acesso.permissao
    let permissoesEdicao = ['adm', 'fin', 'gerente']
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    let cliente_omie = pagamento.param[0].codigo_cliente_fornecedor
    let cliente = await recuperarDado('dados_clientes', cliente_omie)

    let orcamento = await recuperarDado('dados_orcamentos', pagamento.id_orcamento) || false
    let omieClienteOrcamento = orcamento?.dados_orcam?.omie_cliente || ''
    let clienteOrcamento = await recuperarDado('dados_clientes', omieClienteOrcamento)

    let anexos = Object.entries(pagamento?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexoPagamento('${id_pagamento}', '${idAnexo}')`))
        .join('')

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


    let acoes_orcamento = ''

    if (orcamento) {
        acoes_orcamento += `
        <div class="btn_detalhes" onclick="abrirAtalhos('${pagamento.id_orcamento}')">
            <img src="imagens/pasta.png">
            <label style="cursor: pointer;">Consultar Orçamento</label>
        </div>
        `
    }

    acoes_orcamento += `
    
        <div onclick="duplicarPagamento('${id_pagamento}')" class="btn_detalhes">
            <img src="imagens/reembolso.png">
            <label style="cursor: pointer; margin-right: 5px;">Duplicar Pagamento</label>
        </div> 
    
    `

    pagamento.param[0].categorias.forEach((item, indice) => {

        let displayLabel = 'none';

        if (permissao == 'adm') {
            displayLabel = '';
        }

        valores += `
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                <label><strong>${dinheiro(item.valor)}</strong> - ${dados_categorias[item.codigo_categoria].categoria}</label>
                <img style="width: 2vw; cursor: pointer; display: ${displayLabel};" src="imagens/editar.png" onclick="painelEditarPagamento('${id_pagamento}', '${indice}')">
                <img style="width: 25px; cursor: pointer; display: ${displayLabel};" src="imagens/excluir.png" onclick="desejaExcluirCategoria('${id_pagamento}', '${indice}')">
            </div>
        `
        if (String(dados_categorias[item.codigo_categoria].categoria).includes('Parceiros')) {
            painelParceiro = true
        }

    })

    let divValores = `
        <div style="display: flex; flex-direction: column; width: 100%;">
            ${valores}
            <hr style="width: 100%;">
            <div style="display: flex; align-items: center; justify-content: start; gap: 5vw;">
                <label>${dinheiro(pagamento.param[0].valor_documento)}</label>
                ${acesso.permissao == 'adm'
            ? `<div class="btn_detalhes" style="width: max-content;" onclick="painelEditarPagamento('${id_pagamento}')">
                    <img src="imagens/baixar.png">
                    <label style="cursor: pointer;">Acrescentar Valor</label>
                </div>`
            : ''}
            </div>
        </div>
        `

    let btnEditar = ''
    if (acesso.usuario == pagamento.criado || permissoesEdicao.includes(permissao)) {
        btnEditar = `
            <label style="position: absolute; top: 1vw; right: 1vw; text-decoration: underline; font-size: 0.9vw;" onclick="editar_comentario('${id_pagamento}')">Editar</label>
        `
    }

    let formParceiros = ''

    if (painelParceiro) {

        let campos = {
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

                if (orcamento.status && orcamento.status.historico && orcamento.status.historico) {
                    var his = orcamento.status.historico
                    for (let hist in his) {
                        var item_historico = his[hist]
                        if (String(item_historico.status).includes('PEDIDO')) {
                            let anexos = item_historico.anexos

                            for (anx in anexos) {
                                let anexo = anexos[anx]

                                docsExistentes += criarAnexoVisual(anexo.nome, anexo.link);

                            }
                        }
                    }
                }
            }

            let label_elemento = campos[campo]
            infos += `
            <div style="display: flex; flex-direction: column;">
                <div style="display: flex; gap: 5px; align-items: center; justify-content: left;">
                    <label class="numero">${ordenar()}</label>
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; justify-content: left;">

                        <div style="display: flex; gap: 5px; align-items: center; justify-content: left; width: 100%;">
                            <label>${label_elemento}</label>
                            <label class="contorno_botoes" for="anexo_${campo}" style="justify-content: center; border-radius: 50%;">
                                <img src="imagens/anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                                <input type="file" id="anexo_${campo}" style="display: none;" onchange="salvarAnexosParceiros(this, '${campo}','${pagamento.id_pagamento}')">
                            </label>
                        </div> 
                    
                        <div id="div${campo}" class="container">
                            ${docsExistentes}
                        </div>

                    </div> 
                </div>
            </div>            
            `
        }

        formParceiros = `
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; gap: 5px; width: 100%;">
            ${infos}
            <div style="display: flex; flex-direction: column;">
                <div style="display: flex; gap: 5px; align-items: center; justify-content: left;">
                    <label class="numero">${ordenar()}</label>
                    <label>Resumo de Custo</label>          
                </div>
                <br>

                ${carregarTabelaCustoParceiro({ resumo: pagamento.resumo, id_pagamento: pagamento.id_pagamento })}

            </div>
        </div>
        `
    }

    let btns = ''
    if (permissao == 'adm') {
        btns = `
        <div onclick="deseja_excluir_pagamento('${id_pagamento}')" class="btn_detalhes">
            <img src="imagens/remover.png">
            <label style="cursor: pointer; margin-right: 5px;">Excluir pagamento</label>
        </div>
        <div onclick="refazer_pagamento('${id_pagamento}')" class="btn_detalhes">
            <img src="imagens/concluido.png">
            <label style="cursor: pointer; margin-right: 5px;">Refazer Pagamento</label>
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
            <select class="opcoesSelect" style="width: max-content;" onchange="alterarStatusPagamento('${id_pagamento}', this)">
                ${opcoes}
            </select>
        `
    }

    let acumulado = `
    <div style="background-color: #d2d2d2; width: 60vw; display: flex; flex-direction: column; align-items: start; overflow-x: hidden;">
    
        ${justificativaHTML(id_pagamento)}

        <div class="detalhesPagamento">

            ${acoes_orcamento}
            ${btns}

            ${modelo('Status Atual', `${divStatus}`)}
            ${modelo('Quem recebe', `${cliente.nome}`)}
            
            ${modelo('Centro de Custo', `
                <div style="display: flex; align-items: center; justify-content: start; gap: 10px;">
                    <label>${clienteOrcamento?.nome || pagamento.id_orcamento}</label>
                    ${botao('Alterar', `alterarCC('${id_pagamento}')`, 'green')}
                </div>
                `)}
            
            ${modelo('Data de Solicitação', `${pagamento.data_registro}`)}
            ${modelo('Data de Pagamento', `${pagamento.param[0].dtVencimento}`)}

            ${divValores}

            <hr style="width: 100%;">

            ${formParceiros}
            <br>
            <div id="comentario" class="contorno" style="width: 90%;">
                <div class="contorno_interno" style="background-color: #ffffffde;">
                    <label style="width: 100%; text-align: left;"><strong>Observações </strong><br> ${pagamento.param[0].observacao.replace(/\||\n/g, "<br>")}</label>
                    ${btnEditar}
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                <label><strong>Anexos</strong> • </label>  
                
                <label for="anexoPagamento" style="text-decoration: underline; cursor: pointer;">
                    Incluir Anexo
                    <input type="file" id="anexoPagamento" style="display: none;" onchange="salvarAnexosPagamentos(this, '${id_pagamento}')" multiple>
                </label>

                ${acesso.permissao == 'adm'
            ? `<div class="btn_detalhes" style="width: max-content;" onclick="reprocessarAnexos('${id_pagamento}')">
                            <img src="imagens/omie.png">
                            <label style="cursor: pointer;">Reimportar Anexos no Omie</label>
                        </div>`
            : ''}
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

function deseja_excluir_pagamento(id) {

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

async function desejaExcluirCategoria(id, indice) {


    const dados_categorias = await recuperarDados('dados_categorias')
    let pagamento = await recuperarDado('lista_pagamentos', id)

    let categoria = pagamento.param[0].categorias[indice]

    return popup(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw;">
                <label>Deseja realmente excluir essa categoria?</label>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
                <label>Categoria: ${dados_categorias[categoria.codigo_categoria].categoria}</label>
                <label>Valor Atual: ${dinheiro(categoria.valor)}</label>
            </div>
            <label onclick="confirmarExclusaoCategoria('${id}', '${indice}')" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>
        `)

}

async function confirmarExclusaoCategoria(id, indice) {

    removerPopup()

    let pagamento = await recuperarDado('lista_pagamentos', id)
    let categorias = pagamento.param[0].categorias
    categorias.splice(indice, 1)

    pagamento.param[0].valor_documento = calcularTotalCategorias(pagamento.param[0].categorias)

    let resposta = await alterarParam(id, pagamento.param[0])

    if (resposta.status && resposta.status == 'Atualizado') {
        await inserirDados({ [id]: pagamento }, 'lista_pagamentos')

    } else {
        return popup(`
            <div style="display: none; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw;">
                <label>Falha ao atualizar os dados neste pagamento. Tente novamente.</label>
            </div>
            `, 'Aviso', true)
    }

    await recuperarPagamentos()
    await abrirDetalhesPagamentos(id)

}

async function painelEditarPagamento(id, indice) {

    const dados_categorias = await recuperarDados('dados_categorias')

    let funcao = indice ? `editar_pagamento('${id}', ${indice})` : `editar_pagamento('${id}')`
    let categoriaAtual;
    let valor;
    if (indice) { // Caso seja uma edicao;
        let pagamento = await recuperarDado('lista_pagamentos', id)
        categoriaAtual = pagamento.param[0].categorias[indice].codigo_categoria
        valor = pagamento.param[0].categorias[indice].valor
    }

    let opcoes = ''
    Object.entries(dados_categorias).forEach(([codigo, objeto]) => {
        opcoes += `<option data-codigo="${codigo}" ${categoriaAtual == codigo ? 'selected' : ''}>${objeto.categoria}</option>`
    })

    let acumulado = `
        <div style="display: flex; justify-content: start; flex-direction: column; gap: 15px; align-items: start; padding: 20px;">
            
            <div style="width: 100%; display: flex; flex-direction: column; align-items: flex-start;">
                <label for="valor_mudado" style="margin-bottom: 5px;"><strong>Novo Valor:</strong></label>
                <input id="valor_mudado" type="number" style="width: 95%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 5px;" value="${valor ? valor : ''}">
            </div>
    
            <div style="width: 100%; display: flex; flex-direction: column; align-items: start; justify-content: start;">
                    <label style="margin-bottom: 5px;"><strong>Nova Categoria:</strong></label>
                    <select id="categoria_mudada" style="background-color: #d2d2d2; padding: 5px; border-radius: 3px; cursor: pointer;">
                        ${opcoes}
                    </select>
            </div>
    
            <label onclick="${funcao}"
                class="contorno_botoes"
                style="background-color: #4CAF50;">Confirmar</label>
        </div>    
    `

    return popup(acumulado, 'Categorias', true)

}

function calcularTotalCategorias(categorias) {

    let novoValorDocumento = 0
    categorias.forEach(item => {
        novoValorDocumento += item.valor
    })

    return novoValorDocumento

}

async function editar_pagamento(id, indice) {

    let valorMudado = Number(document.getElementById('valor_mudado').value)
    let categoriaMudada = document.getElementById('categoria_mudada')

    removerPopup()
    overlayAguarde()

    let pagamento = await recuperarDado('lista_pagamentos', id)

    let codigoMudado = categoriaMudada.options[categoriaMudada.selectedIndex].dataset.codigo;
    if (indice !== undefined) {
        pagamento.param[0].categorias[indice].valor = valorMudado
        pagamento.param[0].categorias[indice].codigo_categoria = codigoMudado // Atualização do código da categoria

    } else {
        pagamento.param[0].categorias.push({
            "codigo_categoria": codigoMudado,
            "valor": valorMudado
        })
    }

    pagamento.param[0].valor_documento = calcularTotalCategorias(pagamento.param[0].categorias) // Atualizar o valor geral do pagamento;

    let resposta = await alterarParam(id, pagamento.param[0])

    if (resposta.status && resposta.status == 'Atualizado') {

        await inserirDados({ [id]: pagamento }, 'lista_pagamentos')
        await retomarPaginacao()
        await abrirDetalhesPagamentos(id)

    } else {
        return popup(`
            <div style="display: none; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw;">
                <label>Falha ao atualizar os dados neste pagamento. Tente novamente.</label>
            </div>
            `, 'Aviso', true)
    }
}

async function alterarParam(id, param) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/param", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, param })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
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

    let labels = document.querySelectorAll('label.numero')
    let divs = document.querySelectorAll('div.container')

    if (labels) {

        divs.forEach((div, i) => {

            labels[i].style.backgroundColor = div.children.length == 0 ? '#B12425' : 'green'

        })

        let v_orcado = document.getElementById('v_orcado')
        if (v_orcado) labels[labels.length - 1].style.backgroundColor = v_orcado.value == 0 ? '#B12425' : 'green'

    }
}

function auxiliar(elemento) {

    var aprovar = document.getElementById('aprovar')
    var reprovar = document.getElementById('reprovar')

    if (elemento.value == '') {
        aprovar.style.display = 'none'
        reprovar.style.display = 'none'
    } else {
        aprovar.style.display = 'block'
        reprovar.style.display = 'block'
    }
}

async function atualizar_feedback(resposta, id_pagamento) {

    overlayAguarde()

    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    let dataFormatada = data_atual('completa')
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
            lancar_pagamento(pagamento);
        } else if (permissao == 'fin' || (permissao == 'gerente' && setor == 'FINANCEIRO')) {
            status = `Aprovado pelo ${setor}`;
            lancar_pagamento(pagamento);
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


async function editar_comentario(id) {

    const pagamento = await recuperarDado('lista_pagamentos', id)
    let div_comentario = document.getElementById('comentario')

    if (div_comentario) {

        div_comentario.innerHTML = `
        <textarea style="width: 80%" rows="20">
        ${pagamento.param[0].observacao}
        </textarea>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px;">
            <button onclick="salvar_comentario_pagamento('${id}')" style="background-color: green">Alterar Comentário</button>
            <button onclick="abrirDetalhesPagamentos('${id}')">Cancelar</button>
        </div>
        `
    }

}

async function salvar_comentario_pagamento(id) {

    const comentario = document.getElementById('comentario').querySelector('textarea').value
    let pagamento = await recuperarDado('lista_pagamentos', id)

    pagamento.param[0].observacao = comentario

    enviar(`lista_pagamentos/${id}/param[0]/observacao`, comentario)

    await inserirDados({ [id]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id)

}

async function salvarPagamento() {

    overlayAguarde()

    if (!await calculadoraPagamento()) {

        const id_pagamento = unicoID()
        let total = document.getElementById('totalPagamento').textContent
        const recebedor = document.querySelector('[name="recebedor"]')
        const codOmie = recebedor.id

        let descricao = `Solicitante: ${acesso.usuario} |`

        // Categorias
        let valores = centralCategorias.querySelectorAll('input[type="number"]');
        let textareas = centralCategorias.querySelectorAll('textarea');
        let rateio_categorias = [];
        let categorias_acumuladas = {};
        let atrasoRegras = 0

        textareas.forEach((textarea, i) => {

            let valor = Number(valores[i].value)
            let label = textarea.previousElementSibling;
            let codigo = label.textContent
            let texto = String(textarea.value)

            if (!categorias_acumuladas[codigo]) {
                categorias_acumuladas[codigo] = 0
            }

            categorias_acumuladas[codigo] += valor

            if (texto.includes('PARCEIRO')) {

                if (texto.includes('ADIANTAMENTO') && atrasoRegras == 0) {
                    atrasoRegras = 1
                } else if (texto.includes('PAGAMENTO')) {
                    atrasoRegras = 2
                }

            }
        })

        for (let codigo_categoria in categorias_acumuladas) {
            rateio_categorias.push({
                'codigo_categoria': codigo_categoria,
                'valor': categorias_acumuladas[codigo_categoria]
            });
        }

        const selectElement = document.getElementById('pagamentoSelect');
        const formaSelecionada = selectElement.value;
        let objetoDataVencimento = ""

        if (formaSelecionada === 'Chave Pix') {

            let chave_pix = document.getElementById('pix').value

            descricao += `Chave PIX: ${chave_pix} |`

            objetoDataVencimento = data_atual('curta', atrasoRegras)

        } else if (formaSelecionada === 'Boleto') {

            let dtVencimento = document.querySelector("#dtVencimento").value;

            const [ano, mes, dia] = dtVencimento.split("-");

            dtVencimento = `${dia}/${mes}/${ano}`;

            const dataVencimento = new Date(ano, mes - 1, dia);

            const diaSemana = dataVencimento.getDay();

            if (diaSemana === 0 || diaSemana === 6) {
                const diasParaAdicionar = diaSemana === 0 ? 1 : 2;
                dataVencimento.setDate(dataVencimento.getDate() + diasParaAdicionar);

                let novoDia = dataVencimento.getDate();
                let novoMes = dataVencimento.getMonth() + 1;
                let novoAno = dataVencimento.getFullYear();

                novoDia = novoDia.toString().padStart(2, '0');
                novoMes = novoMes.toString().padStart(2, '0');

                dtVencimento = `${novoDia}/${novoMes}/${novoAno}`;
                descricao += `Data de Vencimento do Boleto: ${dtVencimento} |`;

            } else {
                descricao += `Data de Vencimento do Boleto: ${dtVencimento} |`;
            }

            objetoDataVencimento = dtVencimento;

        }

        descricao += document.getElementById('descricao').value

        let param = [
            {
                "codigo_cliente_fornecedor": codigo_cliente,
                "valor_documento": conversor(total),
                "observacao": descricao,
                "codigo_lancamento_integracao": id_pagamento,
                "dtVencimento": objetoDataVencimento,
                "categorias": rateio_categorias,
                "data_previsao": objetoDataVencimento,
                "id_conta_corrente": '6054234828', // Itaú AC
                "distribuicao": []
            }
        ]

        let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
        let id_orcamento = document.getElementById('id_orcamento')

        if (id_orcamento) {
            id_orcam = id_orcamento.textContent
        }

        let pagamento = {
            'id_pagamento': id_pagamento,
            'id_orcamento': id_orcam,
            'departamento': id_orcam,
            'data_registro': data_atual('completa'),
            'anexos': ultimoPagamento.anexos,
            'anexos_parceiros': ultimoPagamento.anexos_parceiros,
            'criado': acesso.usuario,
            param
        }

        let v_orcado = document.getElementById('v_orcado')
        if (v_orcado) {
            let v_pago = document.getElementById('v_pago')
            pagamento.resumo = {
                v_pago: v_pago.textContent,
                v_orcado: v_orcado.value,
            }
        }

        if (Object.keys(dados_setores).length == 0) {
            dados_setores = await lista_setores()
        }

        let permissao = acesso.permissao

        if (conversor(total) < 500) {
            pagamento.status = 'Processando...'
            lancar_pagamento(pagamento)
        } else if (permissao == 'gerente') {
            pagamento.status = 'Aguardando aprovação da Diretoria'
        } else {
            pagamento.status = 'Aguardando aprovação da Gerência'
        }

        await enviar(`lista_pagamentos/${id_pagamento}`, pagamento)

        removerPopup()

        await inserirDados({ [id_pagamento]: pagamento }, 'lista_pagamentos');

        if (document.title == 'PAGAMENTOS') await retomarPaginacao()

        localStorage.removeItem('ultimoPagamento')

        popup(`
            <div style="padding: 2vw; background-color: #d2d2d2; display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="imagens/concluido.png" style="width: 2vw;">
                <label>Pagamento Solicitado</label>
            </div>                
        `)

    }

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

    ordem = 0

    const modeloCampos = (name, nomeCampo, elemento) => `
        <div class="ordem">
            <div name="${name}Numero" class="numero">${ordenar()}</div>

            <div class="camposFinanceiro">
                <div style="${horizontal}; width: 30%;">${nomeCampo}</div>
                ${elemento}
            </div>

        </div>
    `

    const acumulado = `

        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; height: 60vh; overflow-y: auto;">

            <div style="display: flex; flex-direction: column; align-items: baseline; justify-content: center; width: 100%;">
                <label>• Após às <strong>11h</strong> será lançado no dia útil seguinte;</label>
                <label>• Maior que <strong>R$ 500,00</strong> passa por aprovação;</label>
                <label style="text-align: left;">• Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada
                    mês,
                    <br> e será pago dia <strong>10</strong> de cada mês;</label>
                <label>• Adiantamento de parceiro, o pagamento ocorre em até 8 dias.</label>
            </div>

            ${modeloCampos('cc', 'Centro de Custo', `
                    <span name="cc" onclick="cxOpcoes('cc', 'dados_CC', ['nome', 'contrato', 'analista', 'estado', 'cnpj', 'valor'], 'calculadoraPagamento()')">Selecionar</span>
                `)}

            ${modeloCampos('recebedor', 'Recebedor', `
                    <span name="recebedor" onclick="cxOpcoes('recebedor', 'dados_clientes', ['nome', 'cnpj'], 'calculadoraPagamento()')">Selecionar</span>
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

            <div id="camposAdicionais"></div>

        </div>

        <div class="contornoBotaoLiberacao">
            <label>Total do pagamento</label>
            <label style="font-size: 2.0em;" id="totalPagamento">R$ 0,00</label>
            <label id="liberarBotao" class="contorno_botoes" style="background-color: green; display: none;"
                onclick="salvarPagamento()">Salvar Pagamento</label>
        </div>
    `;

    popup(acumulado, 'Solicitação de Pagamento')

    await recuperarUltimoPagamento()

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

async function atualizarFormaPagamento(formato) {
    const formaPagamentoDiv = document.getElementById('formaPagamentoDiv');
    document.getElementById('pagamentoSelect').value = formato

    formaPagamentoDiv.innerHTML = `
        ${formato == 'Chave Pix'
            ? `<textarea rows="3" id="pix" oninput="calculadoraPagamento()" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>`
            : `<input type="date" id="dtVencimento" oninput="calculadoraPagamento()" >`
        }
    `;

    await calculadoraPagamento('atualizarFormaPagamento')
}

function incluirCamposAdicionais() {

    const camposAdicionais = document.getElementById('camposAdicionais')
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
            <div class="ordem">
                <label name="${campo}Numero" class="numero">${ordenar()}</label>
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
        <div id="painelParceiro" style="${vertical}; gap: 5px; width: 100%;">
            ${camposHtml}
            <br>
            <div style="display: flex; align-items: center; justify-content: center;">
                <label id="parceiro_numero" class="numero">${ordenar()}</label>

                ${carregarTabelaCustoParceiro()}

            </div>
        </div>
        <br>
    `

    if (camposAdicionais) return camposAdicionais.innerHTML = acumulado
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
            <div class="camposFinanceiro">
                ${botaoAtualizar}
                <table class="tabela" style="margin: 5px;">
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
                            <td id="v_pago">${dinheiro(resumo?.v_pago) || ''}</td>
                            <td id="res_ORAP"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
}

async function calculadoraPagamento(teste) {

    console.log(teste);
    
    let ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    let total = 0
    const camposAdicionais = document.getElementById('camposAdicionais')
    const recebedor = document.querySelector('[name="recebedor"]')
    const descricao = document.getElementById('descricao')
    const pix = document.getElementById('pix')
    const dtVencimento = document.getElementById('dtVencimento')
    const cc = document.querySelector('[name="cc"]')
    const auxCategorias = calcularCategorias()

    // Validação de cores;
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
    // Fim das validações;

    document.getElementById('totalPagamento').textContent = dinheiro(total)

    console.log(auxCategorias)

    if (camposAdicionais.innerHTML == '' && auxCategorias.atrasoRegras > 0) {
        incluirCamposAdicionais()
        document.getElementById('v_pago').textContent = dinheiro(auxCategorias.valorParceiro)
        calcularCusto() // Tabela básica de parceiros;
    } else if (auxCategorias?.atrasoRegras == 0) {
        camposAdicionais.innerHTML = ''
    }

    backupPagamento()

    function backupPagamento() {
        const pagamentoSelect = document.getElementById('pagamentoSelect')

        ultimoPagamento = {
            ...ultimoPagamento,
            cc: cc.id,
            dtVencimento,
            recebedor: recebedor.id,
            categorias: auxCategorias.categorias,
            descricao: descricao.value,
            pagamentoSelect: pagamentoSelect.value
        }

        if (auxCategorias.atrasoRegras == 0) delete ultimoPagamento.anexos_parceiros

        if (pix) {
            ultimoPagamento.pix = pix.value
            delete ultimoPagamento.dtVencimento
        }

        if (dtVencimento) {
            ultimoPagamento.dtVencimento = dtVencimento.value
            delete ultimoPagamento.pix
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
            categorias: [],
            i: 0
        }

        if (!centralCategorias || spansCategorias.length === 0) return resultado

        for (const span of spansCategorias) {

            const valor = Number(valores[resultado.i].value)
            const codigo = span.id
            const nome = span.textContent

            total += valor

            resultado.categorias.push({ nome, valor, codigo })

            if (nome.includes('Adiantamento de Parceiro') && resultado.atrasoRegras == 0) {
                resultado.atrasoRegras = 1
            } else if (nome.includes('Pagamento de Parceiro')) {
                resultado.atrasoRegras = 2
            }

            resultado.valorParceiro += valor

            if (codigo == '' || valor == 0) return resultado

            resultado.i++

        }

        resultado.completo = true
        return resultado

    }

    function colorir(validacao, elemento) {
        const el = document.querySelector(`[name="${elemento}Numero"]`)
        if (el) el.style.backgroundColor = validacao ? 'green' : '#B12425'
    }

}

async function recuperarUltimoPagamento() {

    overlayAguarde()
    const ultimoPagamento = JSON.parse(localStorage.getItem('ultimoPagamento')) || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_CC = await recuperarDados('dados_CC') || {}

    const cc = document.querySelector('[name="cc"]')
    cc.id = ultimoPagamento?.cc || ''
    cc.textContent = dados_CC[cc?.id]?.nome || 'Selecionar'

    const recebedor = document.querySelector('[name="recebedor"]')
    recebedor.id = ultimoPagamento?.recebedor || ''
    recebedor.textContent = dados_clientes?.[ultimoPagamento?.recebedor]?.nome || 'Selecionar'

    atualizarFormaPagamento(ultimoPagamento.pagamentoSelect)
    if (ultimoPagamento.pix) document.getElementById('pix').value = ultimoPagamento?.pix || ''
    if (ultimoPagamento.dtVencimento) document.getElementById('dtVencimento').value = ultimoPagamento?.dtVencimento || ''

    document.getElementById('descricao').value = ultimoPagamento?.descricao || ''

    if (ultimoPagamento.categorias) for (const categoria of ultimoPagamento.categorias) maisCategoria(categoria)

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

    await calculadoraPagamento('recup')

    removerOverlay()

}

async function maisCategoria(dados = {}) {

    const aleatorio = ID5digitos()
    const categoria = `
        <div style="${horizontal}; justify-content: start; width: 100%;">

            R$ <input value="${dados?.valor || ''}" type="number" oninput="calculadoraPagamento()" placeholder="0,00">
            
            <span name="${aleatorio}" ${dados.codigo ? `id="${dados.codigo}"` : ''} onclick="cxOpcoes('${aleatorio}', 'dados_categorias', ['categoria'], 'calculadoraPagamento()')">${dados?.nome || 'Selecionar'}</span>

            <label src="imagens/remover.png" style="cursor: pointer; width: 2vw; font-size: 2.5vw;" onclick="apagarCategoria(this)">&times;</label>

        </div>
    `;

    document.querySelector('.centralCategorias').insertAdjacentHTML('beforeend', categoria)
    if (!dados.codigo) await calculadoraPagamento('categ')

}

function apagarCategoria(elemento) {
    var linha = elemento.closest('div');
    linha.parentNode.removeChild(linha);
    calculadoraPagamento()
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

function alterarCC(id) {

    let acumulado = `
    <div style="padding: 2vw; display: flex; align-items: center; justify-content: center; gap: 10px; background-color: #d2d2d2;">

        <label id="id_orcamento" style="display: none;"></label>
        <textarea style="width: 80%; font-size: 1.0vw;" type="text" class="autocomplete-input" id="cc" oninput="opcoesCC(this)"></textarea>

        ${botao('Confirmar', `salvarCC('${id}')`, 'green')}

    </div>
    `

    popup(acumulado, 'Selecione o novo Centro de Custo', true)
}

async function salvarCC(id) {

    overlayAguarde()

    let id_orcamento = document.getElementById('id_orcamento').textContent
    let pagamento = await recuperarDado('lista_pagamentos', id)

    pagamento.id_orcamento = id_orcamento

    enviar(`lista_pagamentos/${id}/id_orcamento`, id_orcamento)

    await inserirDados({ [id]: pagamento }, 'lista_pagamentos');

    removerPopup()

    await abrirDetalhesPagamentos(id)

}

async function duplicarPagamento(id_pagamento) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    const dados_categorias = await recuperarDados('dados_categorias')

    let pagamento = lista_pagamentos[id_pagamento]

    let contador = 0;

    let categorias = []

    Object.entries(pagamento.param[0].categorias).forEach(categoriaPagamento => {

        Object.entries(dados_categorias).forEach(([chave, objeto]) => {

            if (categoriaPagamento[1].codigo_categoria == chave) {

                categorias[contador] = {
                    nome: objeto.categoria,
                    codigo: chave,
                    valor: categoriaPagamento[1].valor
                };

                contador++

            }

        })

    })

    let novo_ultimoPagamento = {}

    novo_ultimoPagamento.categorias = categorias
    novo_ultimoPagamento.dtVencimento = pagamento.param[0].dtVencimento.replace(/\//g, "-");
    novo_ultimoPagamento.id_orcamento = pagamento.id_orcamento
    novo_ultimoPagamento.recebedor = pagamento.param[0].codigo_cliente_fornecedor

    let observacao = pagamento.param[0].observacao;

    let partes = observacao.split('|');

    let descricaoParte = partes[2]?.trim();

    let chavePixParte = partes[1]?.split('Chave PIX:')[1]?.trim();

    if (!chavePixParte && partes[1]) {
        descricaoParte = partes[1]?.trim();
    }

    novo_ultimoPagamento.descricao = descricaoParte || '';

    novo_ultimoPagamento.pix = chavePixParte || '';


    localStorage.setItem('ultimoPagamento', JSON.stringify(novo_ultimoPagamento))

    telaPagamento()

}
