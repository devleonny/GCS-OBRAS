let filtrosAtivosPagamentos = {}
let opcoesStatus = [
    '',
    'Aguardando aprovação da Diretoria',
    'Aguardando aprovação da Gerência',
    'Pagamento Excluído',
    'Processando...'
]

carregarPagamentos()

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

    await sincronizarDados('dados_categorias')
    await sincronizarDados('lista_pagamentos')

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
                        <input style="width: 100%; font-size: 0.9vw;" placeholder="..." oninput="pesquisar_generico(${i}, this.value, filtrosAtivosPagamentos, 'body')">
                        <img src="imagens/pesquisar2.png" style="width: 1vw;">
                    </div>
                </th>
                `}
    })

    let titulos = ''
    for ([nomeStatus, item] of Object.entries(contagens)) {

        if (item.valor == 0) continue

        titulos += `

            <div class="ambosLadosEtiqueta" onclick="pesquisar_generico(3, '${nomeStatus == 'TODOS' ? '' : nomeStatus}', filtrosAtivosPagamentos, 'body')">
                
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
        <div class="balao">

            <div style="display: flex; align-items: center; justify-content: center; width: 100%;">

                <img src="gifs/alerta.gif" style="width: 3vw;">

                <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; width: 100%; gap: 3px;">
                    <label style="font-size: 1.3vw;">Responda a solicitação aqui</label>

                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; width: 70%;">
                        <textarea id="justificativa" style="width: 100%; font-size: 0.8vw;" placeholder="Descreva o motivo da aprovação/reprovação" oninput="auxiliar(this)"></textarea>
                        <button id="aprovar" style="display: none; background-color: green; padding: 5px;" onclick="atualizar_feedback(true, '${idPagamento}')">Aprovar</button>
                        <button id="reprovar" onclick="atualizar_feedback(false, '${idPagamento}')" style="display: none; padding: 5px;">Reprovar</button>
                    </div>
                </div>
            </div>
        </div>
        `
}

async function abrirDetalhesPagamentos(id_pagamento) {

    ordem = 0

    let dados_clientes = await recuperarDados('dados_clientes') || {};
    const dados_categorias = await recuperarDados('dados_categorias')

    let valores = ''
    let painelParceiro = false

    let permissao = acesso.permissao
    let permissoesEdicao = ['adm', 'fin', 'gerente']
    let pagamento = await recuperarDado('lista_pagamentos', id_pagamento)
    let cliente_omie = pagamento.param[0].codigo_cliente_fornecedor
    let cliente = await recuperarDado('dados_clientes', cliente_omie)

    let orcamento = await recuperarDado('dados_orcamentos', pagamento.id_orcamento)
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
        .map(([his, justificativa]) => `<div style="display: flex; gap: 10px; align-items: center; margin: 3vw;">
                <div class="vitrificado" style="border: 2px solid ${imagemEspecifica(justificativa).cor}">
                    <p><strong>Status </strong>${justificativa.status}</p>
                    <p><strong>Usuário </strong>${justificativa.usuario}</p>
                    <p><strong>Data </strong>${justificativa.data}</p>
                    <p><strong>Justificativa </strong>${justificativa.justificativa.replace(/\n/g, "<br>")}</p>
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
    
        <div onclick="duplicar_pagamento('${id_pagamento}')" class="btn_detalhes">
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
                <img style="width: 2vw; cursor: pointer; display: ${displayLabel};" src="imagens/editar.png" onclick="modal_editar_pagamento('${id_pagamento}', '${indice}')">
                <img style="width: 25px; cursor: pointer; display: ${displayLabel};" src="imagens/excluir.png" onclick="deseja_excluir_categoria('${id_pagamento}', '${indice}')">
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
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label>${dinheiro(pagamento.param[0].valor_documento)}</label>
                ${acesso.permissao == 'adm' ?
            `<div class="btn_detalhes" style="width: max-content;" onclick="modal_editar_pagamento('${id_pagamento}')">
                    <img src="imagens/baixar.png">
                    <label style="cursor: pointer;">Acrescentar Valor</label>
                </div>`: ''}
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
                                <input type="file" id="anexo_${campo}" style="display: none;" onchange="salvar_anexos_parceiros(this, '${campo}','${pagamento.id_pagamento}')">
                            </label>
                        </div> 
                    
                        <div id="container_${campo}" class="container">
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
    
    ${justificativaHTML(id_pagamento)}

    <div style="width: 60vw; display: flex; gap: 10px; flex-direction: column; align-items: baseline; text-align: left; overflow: auto; padding: 2vw;">
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
        ${modelo('Data de Pagamento', `${pagamento.param[0].data_vencimento}`)}

        ${divValores}

        ${formParceiros}

        <div id="comentario" class="contorno" style="width: 90%;">
            <div class="contorno_interno">
                <label style="width: 100%;"><strong>Observações </strong><br> ${pagamento.param[0].observacao.replace(/\||\n/g, "<br>")}</label>
                ${btnEditar}
            </div>
        </div>

        <label><strong>Anexos </strong> • 
        
            <label for="adicionar_anexo_pagamento" style="text-decoration: underline; cursor: pointer;">
                Incluir Anexo
                <input type="file" id="adicionar_anexo_pagamento" style="display: none;" onchange="salvar_anexos_pagamentos(this, '${id_pagamento}')" multiple>
            </label>

        </label>
        
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 3px;">
            ${anexos}
        </div>

        <label><strong>Histórico </strong> • ${historico}</label>
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

                document.getElementById(`container_${item}`).insertAdjacentHTML('beforeend', element)

            }
        }
    }

    calcularCusto()

}

async function alterarStatusPagamento(idPagamento, select) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamento = lista_pagamentos[idPagamento]

    pagamento.status = select.value
    enviar(`lista_pagamentos/${idPagamento}/status`, select.value)

    await inserirDados(lista_pagamentos, 'lista_pagamentos')
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

async function deseja_excluir_categoria(id, indice) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    const dados_categorias = await recuperarDados('dados_categorias')

    let pagamento = lista_pagamentos[id]

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
            <label onclick="confirmarExclusao_categoria('${id}', '${indice}')" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>
        `)

}

async function confirmarExclusao_categoria(id, indice) {

    removerPopup()

    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

    let pagamento = lista_pagamentos[id]
    let categorias = pagamento.param[0].categorias
    categorias.splice(indice, 1)

    pagamento.param[0].valor_documento = calcularTotalCategorias(pagamento.param[0].categorias)

    let resposta = await alterarParam(id, pagamento.param[0])

    if (resposta.status && resposta.status == 'Atualizado') {
        await inserirDados(lista_pagamentos, 'lista_pagamentos')

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

async function modal_editar_pagamento(id, indice) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    const dados_categorias = await recuperarDados('dados_categorias')

    let funcao = indice ? `editar_pagamento('${id}', ${indice})` : `editar_pagamento('${id}')`
    let categoriaAtual;
    let valor;
    if (indice) { // Caso seja uma edicao;
        let pagamento = lista_pagamentos[id]
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

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let pagamento = lista_pagamentos[id]

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

        await inserirDados(lista_pagamentos, 'lista_pagamentos')
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
        pesquisar_generico(col, filtrosAtivosPagamentos[col], filtrosAtivosPagamentos, 'body')
    }
}

async function relancar_pagamento(id) {

    removerPopup()
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamento = lista_pagamentos[id]
    pagamento.status = 'Nova tentativa...'
    await lancar_pagamento(pagamento)
    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await retomarPaginacao()

}

async function confirmarExclusaoPagamento(id) {

    removerPopup() //PopUp
    removerPopup() //Tela de Pagamento

    await deletarDB('lista_pagamentos', id)
    await deletar(`lista_pagamentos/${id}`)

    await retomarPaginacao()

}

function deletar_arquivo_servidor(link) {
    fetch(`https://leonny.dev.br/uploads/${link}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Erro:', error));
}

async function excluirAnexoPagamento(id_pagamento, anx) {
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    if (
        lista_pagamentos[id_pagamento] &&
        lista_pagamentos[id_pagamento].anexos &&
        lista_pagamentos[id_pagamento].anexos[anx]
    ) {

        let link = lista_pagamentos[id_pagamento].anexos[anx].link
        deletar_arquivo_servidor(link)

        delete lista_pagamentos[id_pagamento].anexos[anx]

        deletar(`lista_pagamentos/${id_pagamento}/anexos/${anx}`)
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
        await abrirDetalhesPagamentos(id_pagamento)
    }

}

async function excluir_anexo_parceiro(id_pagamento, campo, anx) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    if (
        lista_pagamentos[id_pagamento] &&
        lista_pagamentos[id_pagamento].anexos_parceiros &&
        lista_pagamentos[id_pagamento].anexos_parceiros[campo] &&
        lista_pagamentos[id_pagamento].anexos_parceiros[campo][anx]
    ) {

        delete lista_pagamentos[id_pagamento].anexos_parceiros[campo][anx]
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
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

async function recuperarPagamentos() {

    overlayAguarde()

    await lista_setores()
    await sincronizarDados('lista_pagamentos', true)
    await sincronizarDados('dados_clientes', true)
    await retomarPaginacao()

    removerPopup()

}

async function atualizar_feedback(resposta, id_pagamento) {

    overlayAguarde()

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamento = lista_pagamentos[id_pagamento]
    let dataFormatada = data_atual('completa')
    let justificativa = document.getElementById('justificativa').value
    let usuario = acesso.usuario;
    let permissao = acesso.permissao
    let setor = acesso.setor
    let status;

    let dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
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

    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id_pagamento)
    await retomarPaginacao()

    await enviar(`lista_pagamentos/${id_pagamento}/historico/${id_justificativa}`, historico)
    await enviar(`lista_pagamentos/${id_pagamento}/status`, status)

}


async function editar_comentario(id) {

    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    var pagamento = lista_pagamentos[id]
    var div_comentario = document.getElementById('comentario')

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

    var dataFormatada = data_atual('completa')
    var comentario = document.getElementById('comentario').querySelector('textarea').value
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    var pagamento = lista_pagamentos[id]

    pagamento.param[0].observacao = comentario

    pagamento.ultima_alteracao = dataFormatada

    enviar(`lista_pagamentos/${id}/param[0]/observacao`, comentario)
    enviar(`lista_pagamentos/${id}/ultima_alteracao`, dataFormatada)

    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id)

}


async function criar_pagamento_v2() {

    if (!await calculadoraPagamento()) {

        const id_pagamento = unicoID()
        let total = document.getElementById('total_de_pagamento').textContent
        let codigo_cliente = document.getElementById('codigo_omie').textContent

        let descricao = `Solicitante: ${acesso.usuario} |`

        // Categorias
        let valores = central_categorias.querySelectorAll('input[type="number"]');
        let textareas = central_categorias.querySelectorAll('textarea');
        let rateio_categorias = [];
        let categorias_acumuladas = {};
        let atraso_na_data = 0

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

                if (texto.includes('ADIANTAMENTO') && atraso_na_data == 0) {
                    atraso_na_data = 1
                } else if (texto.includes('PAGAMENTO')) {
                    atraso_na_data = 2
                }

            }
        })

        for (let codigo_categoria in categorias_acumuladas) {
            rateio_categorias.push({
                'codigo_categoria': codigo_categoria,
                'valor': categorias_acumuladas[codigo_categoria]
            });
        }

        const selectElement = document.getElementById('forma_pagamento');
        const formaSelecionada = selectElement.value;
        let objetoDataVencimento = ""

        if (formaSelecionada === 'Chave Pix') {

            let chave_pix = document.getElementById('pix').value

            descricao += `Chave PIX: ${chave_pix} |`

            objetoDataVencimento = data_atual('curta', atraso_na_data)

        } else if (formaSelecionada === 'Boleto') {

            let data_vencimento = document.querySelector("#data_vencimento").value;

            const [ano, mes, dia] = data_vencimento.split("-");

            data_vencimento = `${dia}/${mes}/${ano}`;

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

                data_vencimento = `${novoDia}/${novoMes}/${novoAno}`;
                descricao += `Data de Vencimento do Boleto: ${data_vencimento} |`;

            } else {
                descricao += `Data de Vencimento do Boleto: ${data_vencimento} |`;
            }

            objetoDataVencimento = data_vencimento;

        }

        descricao += document.getElementById('descricao_pagamento').value

        let param = [
            {
                "codigo_cliente_fornecedor": codigo_cliente,
                "valor_documento": conversor(total),
                "observacao": descricao,
                "codigo_lancamento_integracao": id_pagamento,
                "data_vencimento": objetoDataVencimento,
                "categorias": rateio_categorias,
                "data_previsao": objetoDataVencimento,
                "id_conta_corrente": '6054234828', // Itaú AC
                "distribuicao": []
            }
        ]

        let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}
        let id_orcamento = document.getElementById('id_orcamento')

        if (id_orcamento) {
            id_orcam = id_orcamento.textContent
        }

        let pagamento = {
            'id_pagamento': id_pagamento,
            'id_orcamento': id_orcam,
            'departamento': id_orcam,
            'data_registro': data_atual('completa'),
            'anexos': ultimo_pagamento.anexos,
            'anexos_parceiros': ultimo_pagamento.anexos_parceiros,
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

        localStorage.removeItem('ultimo_pagamento')

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

var ordem = 0
function ordenar() {
    ordem++
    return ordem
}

async function tela_pagamento(tela_atual_em_orcamentos) {

    ordem = 0
    var datalist = ''
    if (tela_atual_em_orcamentos) {

        datalist += `
        <div class="ordem">

            <label id="cc_numero" class="numero">${ordenar()}</label>

            <div class="itens_financeiro" id="departamentos">
                <label>Centro de Custo</label>

                <div class="autocomplete-container">
                    <label id="id_orcamento" style="display: none;"></label>
                    <textarea style="width: 80%;" type="text" class="autocomplete-input"
                        placeholder="Chamado D7777 ou Loja SAM'S... ou Setor LOGÍSTICA..." oninput="opcoesCC(this)" id="cc"></textarea>
                </div>

                <img src="imagens/atualizar_2.png" style="position: relative; width: 2vw; cursor: pointer; margin-right: 5px;" onclick="atualizar_departamentos()">

            </div>

            <div id="aguarde" style="display: none; width: 100%; align-items: center; justify-content: center; gap: 10px;">
                <img src="gifs/loading.gif" style="width: 5vw">
                <label>Aguarde...</label>
            </div>
        </div>
        `
    }

    var acumulado = `

        <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: left; gap: 5px; font-size: 0.9vw; background-color: #ececec; color: #222; padding: 2vw; border-radius: 5px;">

            <div style="display: flex; flex-direction: column; align-items: baseline; justify-content: center; width: 100%;">
                <label>• Após às <strong>11h</strong> será lançado no dia útil seguinte;</label>
                <label>• Maior que <strong>R$ 500,00</strong> passa por aprovação;</label>
                <label style="text-align: left;">• Pagamento de parceiro deve ser lançado até dia <strong>5</strong> de cada
                    mês,
                    <br> e será pago dia <strong>10</strong> de cada mês;</label>
                <label>• Adiantamento de parceiro, o pagamento ocorre em até 8 dias.</label>
            </div>

            ${datalist}

            <div class="ordem">
                <label id="recebedor_numero" class="numero">${ordenar()}</label>

                <div class="itens_financeiro" id="div_recebedor">
                    <label>Recebedor</label>

                    <div class="autocomplete-container">
                        <label id="codigo_omie" style="display: none;"></label>
                        <textarea style="width: 80%;" oninput="opcoesClientes(this)" type="text"
                            class="autocomplete-input" placeholder="Quem receberá?" id="recebedor"></textarea>
                    </div>

                    <img src="imagens/atualizar_2.png" style="width: 2vw; cursor: pointer; margin-right: 5px;" onclick="recuperarClientes()">

                </div>

            </div>

            <div class="ordem">
                <label id="descricao_numero" class="numero">${ordenar()}</label>
                <div class="itens_financeiro">
                    <label>Descrição do pagamento</label>
                    <textarea style="width:80%" rows="3" id="descricao_pagamento" oninput="calculadoraPagamento()"
                        placeholder="Deixe algum comentário importante. \nIsso facilitará o processo."></textarea>
                </div>
            </div>

            <div class="ordem">
                <label id="pix_ou_boleto_numero" class="numero">${ordenar()}</label>
                <div class="itens_financeiro" style="padding: 10px;">
                    <label>Forma de Pagamento</label>
                    <select id="forma_pagamento" onchange="atualizarFormaPagamento()"
                        style="border-radius: 3px; padding: 5px; cursor: pointer;">
                        <option>Chave Pix</option>
                        <option>Boleto</option>
                    </select>
                    <div id="forma_pagamento_container">
                        <textarea rows="3" id="pix"
                            placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."
                            oninput="calculadoraPagamento()"></textarea>
                    </div>
                </div>
            </div>

            <div class="ordem">
                <label id="categoria_numero" class="numero">${ordenar()}</label>

                <div style="width: 80%; display: flex; align-items: start; justify-content: start; flex-direction: column;">
                    <label style="text-decoration: underline; cursor: pointer;" onclick="nova_categoria()">Clique aqui para
                        + 1 Categoria</label>
                    <div id="central_categorias" class="central_categorias">
                        ${await nova_categoria()}
                    </div>
                </div>
            </div>

            <div class="ordem">
                <label id="anexo_numero" class="numero">${ordenar()}</label>

                <div style="display: flex; flex-direction: column; justify-content: left; width: 80%;">
                    <div style="display: flex; justify-content: left; width: 80%;">
                        <label for="adicionar_anexo_pagamento"
                            style="text-decoration: underline; cursor: pointer; margin-left: 20px;">
                            Incluir Anexos (Multiplos)
                            <input type="file" id="adicionar_anexo_pagamento" style="display: none;"
                                onchange="salvar_anexos_pagamentos(this)" multiple>
                        </label>
                    </div>

                    <div id="container_anexos"
                        style="display: flex; flex-direction: column; justify-content: left; width: 100%;"></div>
                </div>

            </div>

            ${incluirCamposAdicionais()}

            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;" class="time">
    
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 40%;">
                    <label style="white-space: nowrap;">Agora</label>
                    <label id="tempo" class="itens_financeiro" style="font-weight: lighter; padding: 5px; white-space: nowrap;"></label>
                </div>

                <img src="gifs/alerta.gif" style="width: 30px;">        

                <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 30%;">
                    <label style="white-space: nowrap;"> Vai cair em </label>
                    <label id="tempo_real" class="itens_financeiro" style="font-weight: lighter; padding: 5px;"></label>
                </div>
            </div>

            <br>

            <div class="contorno_botao_liberacao">
                <label>Total do pagamento</label>
                <label style="font-size: 2.0em;" id="total_de_pagamento">R$ 0,00</label>
                <label id="liberar_botao" class="contorno_botoes" style="background-color: green; display: none;"
                    onclick="criar_pagamento_v2()">Salvar Pagamento</label>
            </div>

        </div>
    `;

    popup(acumulado, 'Solicitação de Pagamento')

    intervaloCompleto = setInterval(function () {
        if (!tempo || !tempo.textContent) {
            clearInterval(intervaloCompleto)
        }
        document.getElementById('tempo').textContent = data_atual('completa')
    }, 1000);

    intervaloCurto = setInterval(function () {
        document.getElementById('tempo_real').textContent = data_atual('curta');
    }, 1000);

    await recuperar_ultimo_pagamento()

}

async function salvar_anexos_pagamentos(input, id_pagamento) {
    let anexos = await importarAnexos(input)
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamento = lista_pagamentos[id_pagamento]

    anexos.forEach(anexo => {

        if (id_pagamento !== undefined) {

            if (!pagamento.anexos) {
                pagamento.anexos = {}
            }

            pagamento.anexos[anexo.link] = anexo
            enviar(`lista_pagamentos/${id_pagamento}/anexos/${anexo.link}`, anexo)

        } else {
            let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}
            if (!ultimo_pagamento.anexos) {
                ultimo_pagamento.anexos = {}
            }
            ultimo_pagamento.anexos[anexo.link] = {
                nome: anexo.nome,
                formato: anexo.formato,
                link: anexo.link
            };
            localStorage.setItem('ultimo_pagamento', JSON.stringify(ultimo_pagamento))
        }
    })

    if (id_pagamento !== undefined) {
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
        abrirDetalhesPagamentos(id_pagamento)
    }

    await recuperar_ultimo_pagamento()

}

async function atualizarFormaPagamento() {
    const formaPagamento = document.getElementById('forma_pagamento').value;
    const formaPagamentoContainer = document.getElementById('forma_pagamento_container');

    formaPagamentoContainer.innerHTML = `
        ${formaPagamento === 'Chave Pix'
            ? `<textarea rows="3" id="pix" oninput="calculadoraPagamento()" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>`
            : `
                <div style="display: flex; flex-direction: column; justify-content: center;">
                    <label style="font-size: 0.8em; display: block; margin-top: 10px;">Data de Vencimento</label>
                    <input type="date" id="data_vencimento" oninput="calculadoraPagamento()" style="cursor: pointer; width: 90%; text-align: center;">
                </div>
            `
        }
    `;

    await calculadoraPagamento()
}

function incluirCamposAdicionais() {

    var campos = {
        lpu_parceiro: { titulo: 'LPU do parceiro de serviço & material' },
        os: { titulo: 'Ordem de Serviço' },
        relatorio_fotografico: { titulo: 'Relatório de Fotográfico' },
        medicao: { titulo: 'Tem medição para anexar?' },
    }

    var campos_div = ''
    for (campo in campos) {

        var conteudo = campos[campo]
        campos_div += `
            <div class="ordem">
                <label id="recebedor_numero" class="numero">${ordenar()}</label>

                <div class="itens_financeiro" style="justify-content: space-between;">
                    <label style="width: 100%;">${conteudo.titulo}</label>
                        <label class="contorno_botoes" for="anexo_${campo}" style="justify-content: center;">
                            Anexar
                            <input type="file" id="anexo_${campo}" style="display: none;" onchange="salvar_anexos_parceiros(this, '${campo}')" multiple>
                        </label>
                    <div id="container_${campo}" style="display: flex; flex-direction: column; justify-content: left; gap: 2px; width: 100%;"></div>
                </div>
            </div>    
            `
    }

    return `
        <div id="painel_parceiro" style="display: none; flex-direction: column; align-items: start; justify-content: start; gap: 5px; width: 100%;">
            ${campos_div}
            <br>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <label id="recebedor_numero" class="numero">${ordenar()}</label>

                ${carregarTabelaCustoParceiro()}

            </div>
        </div>
        <br>
    `
}

async function atualizarResumo(id_pagamento) {

    const divAtualizar = document.getElementById('atualizarResumo')

    divAtualizar.innerHTML = `<img src="gifs/loading.gif" style="width: 2vw;">`

    const v_pago = conversor(document.getElementById('v_pago').textContent)
    const v_orcado = Number(document.getElementById('v_orcado').value)
    const v_lpu = Number(document.getElementById('v_lpu').value)
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

    let pagamento = lista_pagamentos[id_pagamento]

    if (!pagamento.resumo) pagamento.resumo = {}

    pagamento.resumo = { v_pago, v_orcado, v_lpu }

    enviar(`lista_pagamentos/${id_pagamento}/resumo`, pagamento.resumo)

    await inserirDados(lista_pagamentos, 'lista_pagamentos')

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
            <div style="display: flex; align-items: start; flex-direction: column; justify-content: start; gap: 5px;">
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
                            <td id="v_pago">${dinheiro(resumo?.v_pago) || ''}</td>
                            <td id="res_ORAP"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
}

async function calculadoraPagamento() {

    let central_categorias = document.getElementById('central_categorias')
    let bloqueio = false

    function colorir(cor, elemento) {
        document.getElementById(elemento).style.backgroundColor = cor
    }

    if (central_categorias) {

        let dados_clientes = await recuperarDados('dados_clientes') || {}
        let textareas = central_categorias.querySelectorAll('textarea');
        let valores = central_categorias.querySelectorAll('input[type="number"]');
        let total = 0
        let cod_omie = document.getElementById('codigo_omie')
        let descricao = document.getElementById('descricao_pagamento')
        let pix = document.getElementById('pix')
        let data_vencimento = document.getElementById('data_vencimento')
        let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}

        if (pix) {
            if (pix.value !== '') {
                colorir('green', 'pix_ou_boleto_numero')
                ultimo_pagamento.pix = pix.value
            } else {
                bloqueio = true
                colorir('#B12425', 'pix_ou_boleto_numero')
            }
        }

        if (data_vencimento) {

            if (data_vencimento.value) {
                colorir('green', 'pix_ou_boleto_numero')
                ultimo_pagamento.data_vencimento = data_vencimento.value
            } else {
                bloqueio = true
                colorir('#B12425', 'pix_ou_boleto_numero')
            }

        }

        if (document.getElementById('id_orcamento')) {

            let id_orcamento = document.getElementById('id_orcamento').textContent

            if (id_orcamento !== '') {
                colorir('green', 'cc_numero')
                ultimo_pagamento.id_orcamento = id_orcamento
            } else {
                bloqueio = true
                colorir('#B12425', 'cc_numero')
            }
        }

        let atraso_na_data = 0
        let valor_parceiro = 0

        if (textareas.length == 0) {
            bloqueio = true
            colorir('#B12425', 'categoria_numero')

        } else {

            let categorias = []
            let completo = true
            textareas.forEach((textarea, i) => {

                let valor = Number(valores[i].value)
                total += valor

                let label = textarea.previousElementSibling;
                let codigo = label.textContent
                let texto = String(textarea.value)

                categorias.push({
                    nome: texto,
                    codigo: codigo,
                    valor: valor
                })

                if (texto.includes('PARCEIRO')) {

                    pagamento_parceiros = true

                    if (texto.includes('ADIANTAMENTO') && atraso_na_data == 0) {
                        atraso_na_data = 1
                    } else if (texto.includes('PAGAMENTO')) {
                        atraso_na_data = 2
                    }

                    valor_parceiro += valor
                }

                if (codigo == '' || valor == 0) {
                    completo = false
                }

            })

            if (completo) {
                colorir('green', 'categoria_numero')
            } else {
                bloqueio = true
                colorir('#B12425', 'categoria_numero')
            }

            ultimo_pagamento.categorias = categorias
        }

        let painel_parceiro = document.getElementById('painel_parceiro')
        if (atraso_na_data > 0) {
            painel_parceiro.style.display = 'flex'
            document.getElementById('v_pago').textContent = dinheiro(valor_parceiro)
        } else {
            painel_parceiro.style.display = 'none'
        }

        let tempo_real = document.getElementById('tempo_real')
        if (tempo_real) {
            if (atraso_na_data > 0) {
                clearInterval(intervaloCurto);
                intervaloCurto = setInterval(function () {
                    tempo_real.textContent = data_atual('curta', atraso_na_data);
                }, 1000);

            } else {
                clearInterval(intervaloCurto);
                intervaloCurto = setInterval(function () {
                    tempo_real.textContent = data_atual('curta');
                }, 1000);
            }
        }

        descricao.value == '' ? colorir('#B12425', 'descricao_numero') : colorir('green', 'descricao_numero')

        ultimo_pagamento.descricao = descricao.value

        if (cod_omie.textContent !== '') {

            let cadastrado = false
            for (cnpj in dados_clientes) {
                let omie = dados_clientes[cnpj].omie
                if (omie == cod_omie.textContent) {
                    cadastrado = true
                    break
                }
            }

            if (!cadastrado) {
                bloqueio = true
            } else {
                colorir('green', 'recebedor_numero')
                ultimo_pagamento.recebedor = cod_omie.textContent
            }

        } else {
            bloqueio = true
            colorir('#B12425', 'recebedor_numero')
        }

        let liberar_botao = document.getElementById('liberar_botao')
        if (bloqueio) {
            liberar_botao.style.display = 'none'
        } else {
            liberar_botao.style.display = 'block'
        }

        document.getElementById('total_de_pagamento').textContent = dinheiro(total)

        localStorage.setItem('ultimo_pagamento', JSON.stringify(ultimo_pagamento))

    }

    calcularCusto()

    return bloqueio
}

async function recuperar_ultimo_pagamento() {
    let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento'))
    let codigo_omie = document.getElementById('codigo_omie') // Vou usar como identificador para separar ultimo pagamento das demais funções;

    if (ultimo_pagamento && codigo_omie) {
        let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
        let dados_clientes = await recuperarDados('dados_clientes') || {}
        let cliente = ultimo_pagamento.recebedor
        codigo_omie.textContent = cliente

        for (cnpj in dados_clientes) {
            if (dados_clientes[cnpj].omie == cliente) {
                cliente = dados_clientes[cnpj].nome
                break
            }
        }

        document.getElementById('recebedor').value = cliente || ''
        let cliente_selecionado = ultimo_pagamento.id_orcamento

        if (dados_orcamentos[ultimo_pagamento.id_orcamento] && dados_orcamentos[ultimo_pagamento.id_orcamento].dados_orcam.cliente_selecionado) {
            cliente_selecionado = dados_orcamentos[ultimo_pagamento.id_orcamento].dados_orcam?.cliente_selecionado
        }

        if (document.getElementById('cc') && document.getElementById('id_orcamento')) {

            document.getElementById('cc').value = cliente_selecionado || ''
            document.getElementById('id_orcamento').textContent = ultimo_pagamento.id_orcamento || ''

        }

        document.getElementById('descricao_pagamento').value = ultimo_pagamento.descricao || ''
        let forma_pagamento = document.getElementById('forma_pagamento')

        if (ultimo_pagamento.pix) {
            forma_pagamento.value = 'Chave Pix'
            atualizarFormaPagamento()
            document.getElementById('pix').value = ultimo_pagamento.pix || ''
        } else if (ultimo_pagamento.data_vencimento) {
            forma_pagamento.value = 'Boleto'
            atualizarFormaPagamento()
            document.getElementById('data_vencimento').value = ultimo_pagamento.data_vencimento || '';
        }

        if (ultimo_pagamento.categorias) {

            let central_categorias = document.getElementById('central_categorias')
            central_categorias.innerHTML = ''
            let categorias = ultimo_pagamento.categorias
            let tamanho = categorias.length

            for (let i = 0; i < tamanho; i++) {
                nova_categoria()
            }

            let textareas = central_categorias.querySelectorAll('textarea');
            let valores = central_categorias.querySelectorAll('input[type="number"]');

            textareas.forEach((textarea, i) => {

                let label = textarea.previousElementSibling;

                label.textContent = categorias[i].codigo
                textarea.value = categorias[i].nome
                valores[i].value = categorias[i].valor

            })

            let anexos = ultimo_pagamento.anexos
            let container_anexos = document.getElementById('container_anexos')
            container_anexos.innerHTML = ''

            for (anx in anexos) {

                let anexo = anexos[anx]

                let resposta = `
                <div id="${anx}" class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                    <div class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                        <label style="font-size: 0.8em; cursor: pointer;">${String(anexo.nome).slice(0, 10)} ... ${String(anexo.nome).slice(-7)}</label>
                    </div>
                    <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="remover_anx('${anx}')">
                </div>
                `;
                container_anexos.insertAdjacentHTML('beforeend', resposta);

            }

            let campos = ultimo_pagamento.anexos_parceiros

            for (campo in campos) {
                let anexos = campos[campo]
                let local = document.getElementById(`container_${campo}`)
                local.innerHTML = ''

                for (id_anx in anexos) {

                    let anexo = anexos[id_anx]

                    let resposta = criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_parceiro_2('${campo}', '${id_anx}')`);

                    if (local) {
                        local.insertAdjacentHTML('beforeend', resposta)
                    }
                }

            }

        }

        await calculadoraPagamento()

    }
}

async function nova_categoria() {
    var categoria = `
        <div class="itens_financeiro" style="font-size: 0.8em; gap: 10px;">
            
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 30%; padding: 5px;">
                <label>Categoria</label>
                <label style="display: none;"></label>
                <textarea type="text" oninput="opcoesCategorias(this)" placeholder="Categoria" style="width: 100%; font-size: 0.8vw;"></textarea>
            </div>

            <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 30%; padding: 5px;">
                <label>Valor</label>
                <input type="number" style="width: 100%;" oninput="calculadoraPagamento()" placeholder="0,00">
            </div>

            <label src="imagens/remover.png" style="cursor: pointer; width: 2vw; font-size: 2.5vw;" onclick="apagar_categoria(this)">&times;</label>
        </div>
    `;
    var central_categorias = document.getElementById('central_categorias')
    if (!central_categorias) {
        return categoria
    } else {
        central_categorias.insertAdjacentHTML('beforeend', categoria)
    }
    await calculadoraPagamento()
}

function apagar_categoria(elemento) {
    var linha = elemento.closest('div');
    linha.parentNode.removeChild(linha);
    calculadoraPagamento()
}

function formatarCpfCnpj(numero) {
    numero = numero.replace(/\D/g, '');

    if (numero.length === 11) {
        return numero.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numero.length === 14) {
        return numero.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

async function remover_anx(anx) {

    let div = document.getElementById(anx)
    let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}

    if (div && ultimo_pagamento.anexos[anx]) {
        let link = ultimo_pagamento.anexos[anx].link
        deletar_arquivo_servidor(link)
        delete ultimo_pagamento.anexos[anx]

        localStorage.setItem('ultimo_pagamento', JSON.stringify(ultimo_pagamento))
        div.remove()
    }

    await recuperar_ultimo_pagamento()

}

async function salvar_anexos_parceiros(input, campo, id_pagamento) {

    let anexos = await importarAnexos(input)

    if (id_pagamento == undefined) { // O anexo do parceiro é incluído no formulário de pagamento; (Pagamento ainda não existe)

        anexos.forEach(anexo => {
            let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}

            if (!ultimo_pagamento.anexos_parceiros) {
                ultimo_pagamento.anexos_parceiros = {}
            }

            if (!ultimo_pagamento.anexos_parceiros[campo]) {
                ultimo_pagamento.anexos_parceiros[campo] = {}
            }

            ultimo_pagamento.anexos_parceiros[campo][anexo.link] = anexo

            localStorage.setItem('ultimo_pagamento', JSON.stringify(ultimo_pagamento))
        })

        await recuperar_ultimo_pagamento()

    } else { // O anexo deve ser incluído no pagamento já existente;

        let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

        let pagamento = lista_pagamentos[id_pagamento]

        if (!pagamento.anexos_parceiros) {
            pagamento.anexos_parceiros = {}
        }

        if (!pagamento.anexos_parceiros[campo]) {
            pagamento.anexos_parceiros[campo] = {}
        }

        anexos.forEach(anexo => {

            let id = ID5digitos()

            if (pagamento.anexos_parceiros[campo][id]) {
                pagamento.anexos_parceiros[campo][id] = {}
            }

            pagamento.anexos_parceiros[campo][id] = anexo
            enviar(`lista_pagamentos/${id_pagamento}/anexos_parceiros/${campo}/${id}`, anexo)

            let container = document.getElementById(`container_${campo}`)

            let string_anexo = criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_parceiro('${id_pagamento}', '${campo}', '${id}')`);

            if (container) {
                container.insertAdjacentHTML('beforeend', string_anexo)
            }
        })

        await inserirDados(lista_pagamentos, 'lista_pagamentos')

    }


}

async function excluir_anexo_parceiro_2(campo, anx) {

    let local = document.getElementById(`container_${campo}`)
    let ultimo_pagamento = JSON.parse(localStorage.getItem('ultimo_pagamento')) || {}

    if (ultimo_pagamento.anexos_parceiros[campo][anx] && local) {

        let link = ultimo_pagamento.anexos_parceiros[campo][anx].link
        deletar_arquivo_servidor(link)

        delete ultimo_pagamento.anexos_parceiros[campo][anx]
        localStorage.setItem('ultimo_pagamento', JSON.stringify(ultimo_pagamento))
        await recuperar_ultimo_pagamento()
    }

}

async function opcoesCategorias(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()

    let id = ID5digitos()
    textarea.id = id

    const dados_categorias = await recuperarDados('dados_categorias')
    let opcoes = ''

    for ([codigo, objeto] of Object.entries(dados_categorias)) {

        const termo = objeto.categoria.toLowerCase()

        if (termo.includes(pesquisa)) {
            opcoes += `
                <div class="autocomplete-item" onclick="selecionarCategoria('${codigo}', '${objeto.categoria}', '${id}')">
                    <label style="font-size: 1.0vw;">${objeto.categoria.toUpperCase()}</label>
                </div>
                `
        }
    }

    let label_codigo = textarea.previousElementSibling;
    label_codigo.textContent = ''

    if (pesquisa == '') return

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div_sugestoes = `
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', div_sugestoes)
    calculadoraPagamento()

}

function selecionarCategoria(codigo, categoria, id) {
    let textarea = document.getElementById(id)
    let label_codigo = textarea.previousElementSibling;
    label_codigo.textContent = codigo
    textarea.value = categoria.toUpperCase()

    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()
    calculadoraPagamento()
}

async function opcoesClientes(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let opcoes = ''

    for ([omie, cliente] of Object.entries(dados_clientes)) {

        let nome = String(cliente.nome).toLowerCase()
        let form_cnpj = String(cliente.cnpj).replace(/\D/g, '')

        if (form_cnpj.includes(pesquisa) || nome.includes(pesquisa)) {
            opcoes += `
                <div onclick="selecionarCliente('${omie}', '${nome}')" class="autocomplete-item" style="text-align: left; display: flex; flex-direction: column; align-items: start; justify-content: start;">
                    <label style="width: 90%; font-size: 0.9vw;">${nome.toUpperCase()}</label>
                    <label style="width: 90%; font-size: 0.7vw;"><strong>${cliente.cnpj}</strong></label>
                </div>
                `
        }

    }

    document.getElementById('codigo_omie').textContent = ''

    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()

    if (pesquisa == '') return

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let divSugestoes = `
    <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
        ${opcoes}
    </div>`

    document.body.insertAdjacentHTML('beforeend', divSugestoes)

}

async function selecionarCliente(omie, nome) {

    let b = document.getElementById('codigo_omie')
    b.textContent = omie
    let textarea = b.nextElementSibling
    textarea.value = nome.toUpperCase()

    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()
    await calculadoraPagamento()
}

async function opcoesCC(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let departamentos_fixos = JSON.parse(localStorage.getItem('departamentos_fixos')) || [];
    let dados_orcamentos = await recuperarDados('dados_orcamentos', true) || {};
    let dados_clientes = await recuperarDados('dados_clientes') || {}

    let opcoes = ''

    departamentos_fixos.forEach(dep => {
        if (dep.toLowerCase().includes(pesquisa)) {
            opcoes += `
            <div onclick="selecionarCC('${dep}', '${dep}', '${dep}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 5px;">
                <label style="width: 100%; font-size: 0.8vw;"><strong>Setor</strong> ${dep}</label>
            </div>
        `}
    })

    for ([idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        let cliente = dados_clientes?.[orcamento.dados_orcam.omie_cliente]?.nome || '??'
        let contrato = String(orcamento.dados_orcam.contrato).toLowerCase()
        cliente = cliente.toLowerCase()

        if (contrato.includes(pesquisa) || cliente.includes(pesquisa)) {

            opcoes += `
                <div onclick="selecionarCC('${idOrcamento}', '${cliente}')" class="autocomplete-item" style="text-align: left; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px;">
                    <label style="width: 100%; font-size: 0.7vw;"><strong>Chamado</strong> ${orcamento.dados_orcam.contrato}</label>
                    <label style="width: 100%; font-size: 0.7vw;"><strong>Valor</strong> ${dinheiro(orcamento.total_geral)}</label>
                    <label style="width: 100%; font-size: 0.7vw;"><strong>Analista</strong> ${orcamento.dados_orcam.analista}</label>
                    <label style="width: 100%; font-size: 0.8vw;">${cliente}</label>
                </div>
                `
        }

    }

    document.getElementById('id_orcamento').textContent = ''

    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()

    if (pesquisa == '') return

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let divSugestoes = `
    <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
        ${opcoes}
    </div>`

    document.body.insertAdjacentHTML('beforeend', divSugestoes)

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
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let id_orcamento = document.getElementById('id_orcamento').textContent
    let pagamento = lista_pagamentos[id]

    pagamento.id_orcamento = id_orcamento

    enviar(`lista_pagamentos/${id}/id_orcamento`, id_orcamento)

    await inserirDados(lista_pagamentos, 'lista_pagamentos');
    removerPopup()
    await abrirDetalhesPagamentos(id)

}

async function selecionarCC(id_orcamento, cliente) {

    let b = document.getElementById('id_orcamento')
    b.textContent = id_orcamento
    let textarea = b.nextElementSibling
    textarea.value = cliente.toUpperCase()

    let divSugestoes = document.getElementById('div_sugestoes')
    if (divSugestoes) divSugestoes.remove()

    await calculadoraPagamento()
}

async function duplicar_pagamento(id_pagamento) {

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

    let novo_ultimo_pagamento = {}

    novo_ultimo_pagamento.categorias = categorias
    novo_ultimo_pagamento.data_vencimento = pagamento.param[0].data_vencimento.replace(/\//g, "-");
    novo_ultimo_pagamento.id_orcamento = pagamento.id_orcamento
    novo_ultimo_pagamento.recebedor = pagamento.param[0].codigo_cliente_fornecedor

    let observacao = pagamento.param[0].observacao;

    let partes = observacao.split('|');

    let descricaoParte = partes[2]?.trim();

    let chavePixParte = partes[1]?.split('Chave PIX:')[1]?.trim();

    if (!chavePixParte && partes[1]) {
        descricaoParte = partes[1]?.trim();
    }

    novo_ultimo_pagamento.descricao = descricaoParte || '';

    novo_ultimo_pagamento.pix = chavePixParte || '';


    localStorage.setItem('ultimo_pagamento', JSON.stringify(novo_ultimo_pagamento))

    tela_pagamento(true)

}
