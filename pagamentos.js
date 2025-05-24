let filtrosAtivosPagamentos = {}
let dados_setores = {}

consultar_pagamentos()

async function consultar_pagamentos() {

    let div_pagamentos = document.getElementById('div_pagamentos')
    if (!div_pagamentos) {
        return
    }
    div_pagamentos.innerHTML = ''

    //Recuperar dados do usuário atual
    const acesso = JSON.parse(localStorage.getItem('acesso'));
    const usuarioAtual = acesso.usuario;
    const permissaoUsuario = acesso.permissao

    try {
        //Chamada para o endpoint que já retorna os pagamentos filtrados      
        let acumulado = ''
        let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

        if (Object.keys(lista_pagamentos).length == 0) {
            lista_pagamentos = await receber('lista_pagamentos')
            await inserirDados(lista_pagamentos, 'lista_pagamentos')
        }

        let dados_categorias = await recuperarDados('dados_categorias')
        if (!dados_categorias) {
            dados_categorias = await receber('dados_categorias')
            inserirDados(dados_categorias, 'dados_categorias')
        }

        // timestamp para dados_setores: Sempre atualizado;
        let timestamps = JSON.parse(localStorage.getItem('timestamps')) || {}
        let timestamp_atual_setores = await ultimo_timestamp('dados_setores')

        if (timestamp_atual_setores.timestamp > (timestamps?.dados_setores || 0)) {
            dados_setores = await lista_setores()
            timestamps.dados_setores = timestamp_atual_setores.timestamp
            localStorage.setItem('timestamps', JSON.stringify(timestamps))
        } else {
            dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
        }

        let orcamentos = await recuperarDados('dados_orcamentos') || {};
        let dados_clientes = await recuperarDados('dados_clientes') || {};
        let clientes = {}
        let linhas = ''

        Object.keys(dados_clientes).forEach(item => {
            let cliente = dados_clientes[item]
            clientes[cliente.omie] = cliente
        })

        let pagamentosFiltrados = Object.keys(lista_pagamentos)
            .map(pagamento => {

                let pg = lista_pagamentos[pagamento];

                let valor_categorias = pg.param[0].categorias.map(cat =>
                    `<p>${dinheiro(cat.valor)} - ${dados_categorias[cat.codigo_categoria]}</p>`
                ).join('');
                let nome_orcamento = orcamentos[pg.id_orcamento]
                    ? orcamentos[pg.id_orcamento].dados_orcam?.cliente_selecionado
                    : pg.id_orcamento;
                let data_registro = pg.data_registro || pg.param[0].data_previsao;

                return {
                    id: pagamento,
                    param: pg.param,
                    data_registro,
                    data_previsao: pg.param[0].data_previsao,
                    nome_orcamento,
                    valor_categorias,
                    status: pg.status,
                    observacao: pg.param[0].observacao,
                    criado: pg.criado,
                    anexos: pg.anexos
                };
            })
            .filter(Boolean);

        const parseDate = (data) => {
            const [dia, mes, ano] = data.split('/').map(Number);
            return new Date(ano, mes - 1, dia);
        };

        pagamentosFiltrados.sort((a, b) => parseDate(b.data_previsao) - parseDate(a.data_previsao));

        let contadores = {
            gerente: { qtde: 0, valor: 0, termo: 'gerência', label: 'Aguardando aprovação da Gerência', icone: "imagens/gerente.png" },
            qualidade: { qtde: 0, valor: 0, termo: 'qualidade', label: 'Aguardando aprovação da Qualidade', icone: "imagens/qualidade2.png" },
            diretoria: { qtde: 0, valor: 0, termo: 'da diretoria', label: 'Aguardando aprovação da Diretoria', icone: "imagens/diretoria.png" },
            reprovados: { qtde: 0, valor: 0, termo: 'reprovado', label: 'Reprovados', icone: "imagens/remover.png" },
            excluidos: { qtde: 0, valor: 0, termo: 'excluído', label: 'Pagamentos Excluídos', icone: "gifs/alerta.gif" },
            salvos: { qtde: 0, valor: 0, termo: 'localmente', label: 'Salvo localmente', icone: "imagens/salvo.png" },
            pago: { qtde: 0, valor: 0, termo: 'pago', label: 'Pagamento realizado', icone: "imagens/concluido.png" },
            avencer: { qtde: 0, valor: 0, termo: 'a vencer', label: 'Pagamento será feito outro dia', icone: "imagens/avencer.png" },
            hoje: { qtde: 0, valor: 0, termo: 'hoje', label: 'Pagamento será feito hoje', icone: "imagens/vencehoje.png" },
            todos: { qtde: 0, valor: 0, termo: '', label: 'Todos os pagamentos', icone: "imagens/voltar_2.png" }
        }

        for (pagamento in pagamentosFiltrados) {

            var pg = pagamentosFiltrados[pagamento]

            var icone = ''

            if (pg.status == 'PAGO') {
                icone = contadores.pago.icone
                contadores.pago.qtde += 1
                contadores.pago.valor += pg.param[0].valor_documento
            } else if (pg.status == 'Aguardando aprovação da Diretoria') {
                icone = contadores.diretoria.icone
                contadores.diretoria.qtde += 1
                contadores.diretoria.valor += pg.param[0].valor_documento
            } else if (pg.status == 'A VENCER') {
                icone = contadores.avencer.icone
                contadores.avencer.qtde += 1
                contadores.avencer.valor += pg.param[0].valor_documento
            } else if (pg.status == 'Aguardando aprovação da Qualidade') {
                icone = contadores.qualidade.icone
                contadores.qualidade.qtde += 1
                contadores.qualidade.valor += pg.param[0].valor_documento
            } else if (pg.status == 'Aguardando aprovação da Gerência') {
                icone = contadores.gerente.icone
                contadores.gerente.qtde += 1
                contadores.gerente.valor += pg.param[0].valor_documento
            } else if (pg.status == 'VENCE HOJE') {
                icone = contadores.hoje.icone
                contadores.hoje.qtde += 1
                contadores.hoje.valor += pg.param[0].valor_documento
            } else if (pg.status.includes('Reprovado')) {
                icone = contadores.reprovados.icone
                contadores.reprovados.qtde += 1
                contadores.reprovados.valor += pg.param[0].valor_documento
            } else if (pg.status.includes('Pagamento salvo localmente')) {
                icone = contadores.salvos.icone
                contadores.salvos.valor += pg.param[0].valor_documento
                contadores.salvos.qtde += 1
            } else if (pg.status.includes('Excluído')) {
                icone = contadores.excluidos.icone
                contadores.excluidos.valor += pg.param[0].valor_documento
                contadores.excluidos.qtde += 1
            } else {
                icone = "gifs/alerta.gif"
            }
            contadores.todos.qtde += 1
            contadores.todos.valor += pg.param[0].valor_documento

            var div = `
            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                <img src="${icone}" style="width: 30px;">
                <label>${pg.status}</label>
            </div>
            `
            var setor_criador = ''
            if (dados_setores[pg.criado]) {
                setor_criador = dados_setores[pg.criado].setor
            }

            var recebedor = pg.param[0].codigo_cliente_fornecedor

            if (clientes[recebedor]) {
                recebedor = clientes[recebedor].nome
            }

            linhas += `
                <tr>
                    <td>${pg.data_previsao}</td>
                    <td>${pg.nome_orcamento}</td>
                    <td style="text-align: left;">${pg.valor_categorias}</td>
                    <td>${div}</td>
                    <td>${pg.criado}</td>
                    <td>${setor_criador}</td>
                    <td>${recebedor}</td>
                    <td style="text-align: center;"><img src="imagens/pesquisar2.png" style="width: 30px; cursor: pointer;" onclick="abrir_detalhes('${pg.id}')"></td>
                </tr>
            `
        };

        var colunas = ['Data de Previsão', 'Centro de Custo', 'Valor e Categoria', 'Status Pagamento', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

        var cabecalho1 = ''
        var cabecalho2 = ''
        colunas.forEach((coluna, i) => {

            cabecalho1 += `
                <th>${coluna}</th>
                `
            cabecalho2 += `
                <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" style="text-align: center;" placeholder="..." oninput="pesquisar_em_pagamentos(${i}, this.value)">
                </th>
                `
        })

        var titulos = ''

        for (item in contadores) {
            if (contadores[item].valor !== 0) {
                titulos += `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.0vw;" onclick="pesquisar_em_pagamentos(3, '${contadores[item].termo}')">
                    <label class="contagem" style="background-color: #B12425; color: white;">${contadores[item].qtde}</label>
                    <img src="${contadores[item].icone}" style="width: 25px; height: 25px;">
                    
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <Label style="display: flex; gap: 10px; font-size: 0.8vw;">${contadores[item].label}</label>
                        <label>${dinheiro(contadores[item].valor)}</label>
                    </div>
                </div>
                <hr style="width: 100%;">
                `
            }
        }

        var div_titulos = `
        <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; width: 30%;">

            <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento(true)">
                <label>Novo <strong>Pagamento</strong></label>
            </div>

            <div class="contorno_botoes" style="background-color: #ffffffe3; color: #222; display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: left; margin: 10px;">
                ${titulos}
            </div>
        </div>
        `
        acumulado += `
        <div id="div_pagamentos">
            <div style="display: flex; justify-content: center; align-items: start; gap: 10px;">
                ${div_titulos}
                <div style="border-radius: 5px; height: 800px; overflow-y: auto;">
                    <table id="pagamentos" class="tabela">
                        <thead>
                            ${cabecalho1}
                        </thead>
                        <thead id="thead_pesquisa">
                            ${cabecalho2}
                        </thead>
                        <tbody id="body">
                            ${linhas}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `
        var elementus = `
        <div id="pagamentos">
            ${acumulado}
        <div>
        `
        div_pagamentos.innerHTML = elementus
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        div_pagamentos.innerHTML = '<p>Erro ao carregar pagamentos</p>';
    }

}


async function abrir_detalhes(id_pagamento) {

    ordem = 0
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let dados_categorias = await recuperarDados('dados_categorias')
    if (!dados_categorias) {
        dados_categorias = await receber('dados_categorias')
        inserirDados(dados_categorias, 'dados_categorias')
    }

    var cc = 'Erro 404'

    var dados_clientes_invertido = {};

    for (cnpj in dados_clientes) {
        dados_clientes_invertido[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    dados_clientes = dados_clientes_invertido // Cod Omie em evidência;

    let pagamento = lista_pagamentos[id_pagamento]

    if (dados_orcamentos[pagamento.id_orcamento]) {
        cc = dados_orcamentos[pagamento.id_orcamento].dados_orcam?.cliente_selecionado
    } else {
        cc = pagamento.id_orcamento
    }

    let anexos = ''
    let cliente = pagamento.param[0].codigo_cliente_fornecedor
    let cliente_omie = pagamento.param[0].codigo_cliente_fornecedor

    if (dados_clientes[cliente_omie]) {
        cliente = dados_clientes[cliente_omie].nome
    }

    for (anx in pagamento.anexos) {

        var anexo = pagamento.anexos[anx]

        anexos += criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_complementares('${id_pagamento}', '${anx}')`);

    }

    var historico = ''
    var cor = '#222'
    if (pagamento.historico) {

        for (his in pagamento.historico) {

            let justificativa = pagamento.historico[his]

            var imagem = "imagens/remover.png"
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

            historico += `
            <div style="display: flex; gap: 10px; align-items: center; margin: 3vw;">
                <div class="vitrificado" style="border: 2px solid ${cor}">
                    <p><strong>Status </strong>${justificativa.status}</p>
                    <p><strong>Usuário </strong>${justificativa.usuario}</p>
                    <p><strong>Data </strong>${justificativa.data}</p>
                    <p><strong>Justificativa </strong>${justificativa.justificativa.replace(/\n/g, "<br>")}</p>
                </div>
                <img src="${imagem}">
            </div>
            `
        }

    }

    var acoes_orcamento = ''

    if (dados_orcamentos[pagamento.id_orcamento]) {
        acoes_orcamento += `
        <div class="btn_detalhes" onclick="exibir_todos_os_status('${pagamento.id_orcamento}')">
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

    var ultima_alteracao = ''
    if (pagamento.ultima_alteracao) {
        ultima_alteracao = `alterado às ${pagamento.ultima_alteracao}`
    }

    var valores = ''
    var habilitar_painel_parceiro = {
        ativar: false,
        valor: 0
    }

    var categoria_atual = ''
    pagamento.param[0].categorias.forEach((item, indice) => {

        let displayLabel = 'none';

        if (acesso.permissao === 'adm') {
            displayLabel = '';
        }

        valores += `
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                <label><strong>${dinheiro(item.valor)}</strong> - ${dados_categorias[item.codigo_categoria]}</label>
                <img style="width: 2vw; cursor: pointer; display: ${displayLabel};" src="imagens/editar.png" onclick="modal_editar_pagamento('${id_pagamento}', '${indice}')">
                <img style="width: 25px; cursor: pointer; display: ${displayLabel};" src="imagens/excluir.png" onclick="deseja_excluir_categoria('${id_pagamento}', '${indice}')">
            </div>
        `
        if (String(dados_categorias[item.codigo_categoria]).includes('Parceiros')) {
            habilitar_painel_parceiro.ativar = true
            habilitar_painel_parceiro.valor += item.valor
        }
        categoria_atual = dados_categorias[item.codigo_categoria]
    })

    var div_valores = `
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
    let permissao = acesso.permissao

    var acumulado = ''
    if (
        pagamento.param[0].valor_documento >= 500 &&
        (pagamento.status.includes('Aguardando') || pagamento.status.includes('Reprovado')) &&
        (permissao == 'gerente' ||
            permissao == 'adm' ||
            permissao == 'diretoria' ||
            permissao == 'fin' ||
            pagamento.criado == acesso.usuario ||
            (permissao == "qualidade" && categoria_atual.includes("Parceiros")))
    ) {
        acumulado += `
        <div class="balao">

            <div style="display: flex; align-items: center; justify-content: center; width: 100%;">

                <img src="gifs/alerta.gif" style="width: 3vw;">

                <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; width: 100%; gap: 3px;">
                    <label style="font-size: 1.3vw;">Responda a solicitação aqui</label>

                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; width: 70%;">
                        <textarea id="justificativa" style="width: 100%;" placeholder="Descreva o motivo da aprovação/reprovação" oninput="auxiliar(this)"></textarea>
                        <button id="aprovar" style="display: none; background-color: green; padding: 5px;" onclick="atualizar_feedback('Aprovar', '${id_pagamento}')">Aprovar</button>
                        <button id="reprovar" onclick="atualizar_feedback('Reprovar', '${id_pagamento}')" style="display: none; padding: 5px;">Reprovar</button>
                    </div>
                </div>
            </div>
        </div>
        `
    }

    var botao_editar = ''
    if (acesso.usuario == pagamento.criado || (permissao == 'adm' || permissao == 'fin' || permissao == 'gerente')) {
        botao_editar = `
            <label style="position: absolute; top: 1vw; right: 1vw; text-decoration: underline; font-size: 0.9vw;" onclick="editar_comentario('${id_pagamento}')">Editar</label>
        `
    }

    var info_adicional_parceiro = ''

    if (habilitar_painel_parceiro.ativar) {

        var campos = {
            pedido: 'PDF do pedido do Cliente',
            lpu_parceiro: 'LPU do parceiro de serviço & material',
            orcamento: 'Orçamento GCS ou orçamento externo',
            relatorio_fotografico: 'Relatório Fotográfico',
            os: 'Ordem de Serviço',
            medicao: 'Paga sobre medição?'
        }

        var infos = ''
        for (campo in campos) {
            var info_existente = ''
            if (campo == 'orcamento' && dados_orcamentos[pagamento.id_orcamento]) {

                info_existente += `
                    <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                        <div onclick="ir_pdf('${pagamento.id_orcamento}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 15vw;">
                            <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                            <label style="cursor: pointer;"><strong>Orçamento disponível</strong></label>
                        </div>
                    </div>
                `
            }

            if (campo == 'pedido') {
                var info_existente = ''
                let orcamento = ''
                if (dados_orcamentos[pagamento.id_orcamento]) {
                    orcamento = dados_orcamentos[pagamento.id_orcamento]
                }

                if (orcamento.status && orcamento.status.historico && orcamento.status.historico) {
                    var his = orcamento.status.historico
                    for (hist in his) {
                        var item_historico = his[hist]
                        if (String(item_historico.status).includes('PEDIDO')) {
                            let anexos = item_historico.anexos

                            for (anx in anexos) {
                                let anexo = anexos[anx]

                                info_existente += criarAnexoVisual(anexo.nome, anexo.link);

                            }
                        }
                    }
                }
            }

            var label_elemento = campos[campo]
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
                        ${info_existente}
                        </div>

                    </div> 
                </div>
            </div>            
            `
        }

        var v_pago = ''
        var v_orcado = ''
        var resultado = '%'
        if (pagamento.resumo) {
            v_pago = conversor(pagamento.resumo.v_pago)
            v_orcado = conversor(pagamento.resumo.v_orcado)
            resultado = `${(v_pago / v_orcado * 100).toFixed(0)}%`
        }

        info_adicional_parceiro = `
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; gap: 5px; width: 100%;">
            ${infos}
            <div style="display: flex; flex-direction: column;">
                <div style="display: flex; gap: 5px; align-items: center; justify-content: left;">
                    <label class="numero">${ordenar()}</label>
                    <label>Resumo de Custo</label>          
                </div>
                <br>
                <table class="tabela">
                    <thead>
                        <th>Valor Orçado Válido</th>
                        <th>A Pagar</th>
                        <th>%</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="color: #222; white-space: nowrap;">
                            <div id="container_resumo" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <label id="v_orcado">${dinheiro(v_orcado)}</label>
                                <img src="imagens/editar.png" style="width: 30px; cursor: pointer;" onclick="editar_resumo('${pagamento.id_pagamento}')">
                            </div>
                            </td>
                            <td style="color: #222; white-space: nowrap;" id="v_pago">${dinheiro(habilitar_painel_parceiro.valor)}</td>
                            <td style="color: #222;" id="resultado">${resultado}</td>
                        </tr>
                    </tbody>
                </table>
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

    acumulado += `
    <div style="max-width: 50vw; display: flex; gap: 10px; flex-direction: column; align-items: baseline; text-align: left; overflow: auto; padding: 2vw;">
        ${acoes_orcamento}
        ${btns}
        <label><strong>Status atual • </strong> ${pagamento.status}</label>
        <label><strong>Quem recebe? • </strong> ${cliente}</label>
        <div id="centro_de_custo_div" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <label><strong>Centro de Custo</strong> • ${cc}</label>
            <img src="gifs/alerta.gif" style="width: 30px; cursor: pointer;" onclick="alterar_centro_de_custo('${id_pagamento}')">
        </div>
        <label><strong>Data de Solicitação</strong> • ${pagamento.data_registro}</label>
        <label><strong>Data de Pagamento</strong> • ${pagamento.param[0].data_vencimento}</label>

        ${div_valores}

        ${info_adicional_parceiro}

        <div id="comentario" class="contorno" style="width: 90%;">
            <div class="contorno_interno">
                <label><strong>Observações </strong> •  ${ultima_alteracao} <br> ${pagamento.param[0].observacao.replace(/\||\n/g, "<br>")}</label>
                ${botao_editar}
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

    openPopup_v2(acumulado, 'Detalhes do Pagamento')

    // Depois que se abre o pagamento, percorra os anexos e preencha cada item;
    if (pagamento.anexos_parceiros) {
        var itens = pagamento.anexos_parceiros
        for (item in itens) {
            var anexos_on = itens[item]

            for (anx in anexos_on) {

                var anexo = anexos_on[anx]

                let element = criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo_parceiro('${id_pagamento}', '${item}', '${anx}')`);

                document.getElementById(`container_${item}`).insertAdjacentHTML('beforeend', element)

            }
        }
    }

    colorir_parceiros()

}

function deseja_excluir_pagamento(id) {

    return openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Deseja realmente excluir o pagamento?</label>
            </div>
            <label onclick="confirmar_exclusao_pagamento('${id}')" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>
        `)

}

async function deseja_excluir_categoria(id, indice) {

    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let dados_categorias = await recuperarDados('dados_categorias')
    if (!dados_categorias) {
        dados_categorias = await receber('dados_categorias')
        inserirDados(dados_categorias, 'dados_categorias')
    }
    let pagamento = lista_pagamentos[id]

    let categoria = pagamento.param[0].categorias[indice]

    return openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Deseja realmente excluir essa categoria?</label>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
                <label>Categoria: ${dados_categorias[categoria.codigo_categoria]}</label>
                <label>Valor Atual: ${dinheiro(categoria.valor)}</label>
            </div>
            <label onclick="confirmar_exclusao_categoria('${id}', '${indice}')" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>
        `)

}

async function confirmar_exclusao_categoria(id, indice) {

    remover_popup()

    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

    let pagamento = lista_pagamentos[id]
    let categorias = pagamento.param[0].categorias
    categorias.splice(indice, 1)

    pagamento.param[0].valor_documento = calcularTotalCategorias(pagamento.param[0].categorias)

    let resposta = await alterarParam(id, pagamento.param[0])

    if (resposta.status && resposta.status == 'Atualizado') {
        await inserirDados(lista_pagamentos, 'lista_pagamentos')

    } else {
        return openPopup_v2(`
            <div style="display: none; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Falha ao atualizar os dados neste pagamento. Tente novamente.</label>
            </div>
            `, 'Aviso', true)
    }
    await atualizar_pagamentos_menu()
    await abrir_detalhes(id)

}

async function modal_editar_pagamento(id, indice) {

    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let dados_categorias = await recuperarDados('dados_categorias')
    if (!dados_categorias) {
        dados_categorias = await receber('dados_categorias')
        await inserirDados(dados_categorias, 'dados_categorias')
    }

    let opcoes = ''

    Object.entries(dados_categorias).forEach(([codigo, categoria]) => {
        opcoes += `<option data-codigo="${codigo}">${categoria}</option>`
    })

    let edicao = ''
    let funcao = indice ? `editar_pagamento('${id}', ${indice})` : `editar_pagamento('${id}')`
    if (indice) { // Caso seja uma edicao;
        let pagamento = lista_pagamentos[id]
        let categoria = pagamento.param[0].categorias[indice]

        edicao = `
            <label><strong>Categoria:</strong> ${dados_categorias[categoria.codigo_categoria]}</label>
            <label><strong>Valor Atual:</strong> ${dinheiro(categoria.valor)}</label>
        `
    }

    let acumulado = `
        <div style="display: flex; justify-content: start; flex-direction: column; gap: 15px; align-items: start; padding: 20px;">
            
            ${edicao}
    
            <div style="width: 100%; display: flex; flex-direction: column; align-items: flex-start;">
                <label for="valor_mudado" style="margin-bottom: 5px;"><strong>Novo Valor:</strong></label>
                <input id="valor_mudado" type="number" style="width: 95%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 5px;">
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

    return openPopup_v2(acumulado, 'Categorias', true)

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

    remover_popup()
    overlayAguarde()

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let pagamento = lista_pagamentos[id]

    let codigoMudado = categoriaMudada.options[categoriaMudada.selectedIndex].dataset.codigo;
    if (indice) {

        if (valorMudado != 0) {
            pagamento.param[0].categorias[indice].valor = valorMudado
            pagamento.param[0].categorias[indice].codigo_categoria = codigoMudado // Atualização do código da categoria
        }

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
        await consultar_pagamentos()
        await abrir_detalhes(id)

    } else {
        return openPopup_v2(`
            <div style="display: none; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
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

async function relancar_pagamento(id) {

    remover_popup()
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let pagamento = lista_pagamentos[id]

    pagamento.status = 'Pagamento salvo localmente'
    await lancar_pagamento(pagamento)
    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await consultar_pagamentos()

}

async function confirmar_exclusao_pagamento(id) {

    remover_popup()
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    delete lista_pagamentos[id]

    deletar(`lista_pagamentos/${id}`)
    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await consultar_pagamentos()

}

function deletar_arquivo_servidor(link) {
    fetch(`https://leonny.dev.br/uploads/${link}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Erro:', error));
}

async function excluir_anexo_complementares(id_pagamento, anx) {
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
        await abrir_detalhes(id_pagamento)
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
        await abrir_detalhes(id_pagamento)
    }

}

function editar_resumo(id_pagamento) {
    var container_resumo = document.getElementById('container_resumo')
    if (container_resumo) {
        container_resumo.innerHTML = `
        <input placeholder="R$ 0,00" type="number" oninput="calcular_custo()" id="v_orcado">
        <img src="imagens/concluido.png" style="width: 30px; cursor: pointer;" onclick="atualizar_resumo('${id_pagamento}')">
        <img src="imagens/cancel.png" style="width: 30px; cursor: pointer;" onclick=" abrir_detalhes('${id_pagamento}')">
        `
    }
}

async function atualizar_resumo(id_pagamento) {

    var v_pago = conversor(document.getElementById('v_pago').textContent)
    var v_orcado = Number(document.getElementById('v_orcado').value)
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

    var pagamento = lista_pagamentos[id_pagamento]

    if (!pagamento.resumo) {
        pagamento.resumo = {}
    }

    pagamento.resumo = { v_pago, v_orcado }

    enviar(`lista_pagamentos/${id_pagamento}/resumo`, pagamento.resumo)

    await inserirDados(lista_pagamentos, 'lista_pagamentos');
    await abrir_detalhes(id_pagamento)

}

function colorir_parceiros() {

    var labels = document.querySelectorAll('label.numero')
    var divs = document.querySelectorAll('div.container')

    if (labels) {

        divs.forEach((div, i) => {
            if (div.children.length == 0) {
                labels[i].style.backgroundColor = '#B12425'
            } else {
                labels[i].style.backgroundColor = 'green'
            }
        })

        if (labels.length > 0) {
            var v_orcado = document.getElementById('v_orcado')
            if (v_orcado && conversor(v_orcado.textContent) == 0) {
                labels[labels.length - 1].style.backgroundColor = '#B12425'
            } else {
                labels[labels.length - 1].style.backgroundColor = 'green'
            }
        }
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

async function atualizar_pagamentos_menu() {

    overlayAguarde()

    await lista_setores()

    let pagamentosFiltrados = await filtrarPagamentosUsuario(acesso.usuario)

    await inserirDados(pagamentosFiltrados, 'lista_pagamentos')

    let dados_categorias = await recuperarDados('dados_categorias')
    if (!dados_categorias) {
        dados_categorias = await receber('dados_categorias')
        inserirDados(dados_categorias, 'dados_categorias')
    }

    await inserirDados(await receber('dados_categorias'), 'dados_categorias')

    await consultar_pagamentos()

    for (coluna in filtrosAtivosPagamentos) {
        pesquisar_em_pagamentos(coluna, filtrosAtivosPagamentos[coluna])
    }

    document.getElementById("aguarde").remove()

}

async function atualizar_feedback(resposta, id_pagamento) {
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let pagamento = lista_pagamentos[id_pagamento];

    let criado = pagamento.criado
    let setor = ""
    Object.keys(dados_setores).forEach(usuario => {
        if (criado == usuario) {
            setor = dados_setores[usuario].setor
        }
    })

    let dataFormatada = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let usuario = acesso.usuario;
    let justificativa = document.getElementById('justificativa').value;
    let categoria_atual = pagamento.param[0].categorias[0].codigo_categoria
    let permissao = acesso.permissao

    // Definir status com base na resposta e na permissão
    let status;
    if (resposta == 'Aprovar') {
        if ((permissao == 'gerente' || permissao == 'adm') && categoria_atual == "2.01.99" && setor == "INFRA") {
            status = 'Aguardando aprovação da Qualidade';
        } else if (permissao == 'gerente' || permissao == 'adm' || permissao == 'qualidade') {
            status = 'Aguardando aprovação da Diretoria';
        } else if (permissao == 'diretoria') {
            status = 'Aprovado pela Diretoria';
            lancar_pagamento(pagamento)
        } else if (permissao == 'fin' || (permissao == 'gerente' && setor == 'RH')) {
            status = 'Aprovado pelo Financeiro/RH';
            lancar_pagamento(pagamento)
        } else {
            status = 'Aguardando aprovação da Gerência';
        }
    } else if (resposta == 'Reprovar') {
        // Quando reprovado, retorna para o usuário que criou
        status = `Reprovado por ${usuario}`;

        // Adiciona observação de reprovação
        pagamento.param[0].observacao += `\n\nREPROVAÇÃO (${dataFormatada} por ${usuario}):\n${justificativa}`;
    }

    let historico = {
        status,
        usuario,
        justificativa,
        data: dataFormatada
    };

    let id_justificativa = gerar_id_5_digitos()
    pagamento.status = status

    if (!pagamento.historico) {
        pagamento.historico = {};
    }
    pagamento.historico[id_justificativa] = historico

    await inserirDados(lista_pagamentos, 'lista_pagamentos');
    await fechar_e_abrir(id_pagamento, true)

    await enviar(`lista_pagamentos/${id_pagamento}/historico/${id_justificativa}`, historico)
    await enviar(`lista_pagamentos/${id_pagamento}/status`, status)

    // Atualiza a observação no servidor se foi reprovado
    if (resposta == 'Reprovar') {
        await enviar(`lista_pagamentos/${id_pagamento}/param[0]/observacao`, pagamento.param[0].observacao)
    }
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
            <button onclick="fechar_e_abrir('${id}')">Cancelar</button>
        </div>
        `
    }

}

async function fechar_e_abrir(id, fechar) {

    await consultar_pagamentos()

    for (coluna in filtrosAtivosPagamentos) {
        pesquisar_em_pagamentos(coluna, filtrosAtivosPagamentos[coluna])
    }

    if (!fechar) {
        abrir_detalhes(id)
    }

}

function alterar_centro_de_custo(id) {

    var centro_de_custo_div = document.getElementById('centro_de_custo_div')

    centro_de_custo_div.innerHTML = `
    <label>Escolha o novo centro de custo</label>

    <div class="autocomplete-container">
        <label id="id_orcamento" style="display: none;"></label>
        <textarea style="width: 80%;" type="text" class="autocomplete-input" id="cc"
            placeholder="Chamado D7777 ou Loja SAM'S... ou Setor LOGÍSTICA..." oninput="carregar_opcoes_cc(this)"></textarea>
        <div class="autocomplete-list"></div>
    </div>

    <img src="imagens/concluido.png" style="width: 20px; cursor: pointer;" onclick="salvar_centro_de_custo('${id}')">
    </div>
    `
}

async function salvar_centro_de_custo(id) {
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let id_orcamento = document.getElementById('id_orcamento').textContent
    var pagamento = lista_pagamentos[id]

    pagamento.id_orcamento = id_orcamento

    enviar(`lista_pagamentos/${id}/id_orcamento`, id_orcamento)

    await inserirDados(lista_pagamentos, 'lista_pagamentos');
    await fechar_e_abrir(id)

}

async function salvar_comentario_pagamento(id) {

    var dataFormatada = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    var comentario = document.getElementById('comentario').querySelector('textarea').value
    var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    var pagamento = lista_pagamentos[id]

    pagamento.param[0].observacao = comentario

    pagamento.ultima_alteracao = dataFormatada

    enviar(`lista_pagamentos/${id}/param[0]/observacao`, comentario)
    enviar(`lista_pagamentos/${id}/ultima_alteracao`, dataFormatada)

    await inserirDados(lista_pagamentos, 'lista_pagamentos')

    await fechar_e_abrir(id)

}


async function criar_pagamento_v2() {

    if (!await calculadora_pagamento()) {

        var id_pagamento = unicoID()
        var acesso = JSON.parse(localStorage.getItem('acesso'))
        var total = document.getElementById('total_de_pagamento').textContent
        var codigo_cliente = document.getElementById('codigo_omie').textContent

        let descricao = `Solicitante: ${acesso.usuario} |`

        // Categorias
        var valores = central_categorias.querySelectorAll('input[type="number"]');
        var textareas = central_categorias.querySelectorAll('textarea');
        var rateio_categorias = [];
        var categorias_acumuladas = {};
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

        for (var codigo_categoria in categorias_acumuladas) {
            rateio_categorias.push({
                'codigo_categoria': codigo_categoria,
                'valor': categorias_acumuladas[codigo_categoria]
            });
        }

        const selectElement = document.getElementById('forma_pagamento');
        const formaSelecionada = selectElement.value;
        var objetoDataVencimento = ""

        if (formaSelecionada === 'Chave Pix') {

            var chave_pix = document.getElementById('pix').value

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

        var param = [
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

        var pagamento = {
            'id_pagamento': id_pagamento,
            'id_orcamento': id_orcam,
            'departamento': id_orcam,
            'data_registro': data_atual('completa'),
            'anexos': ultimo_pagamento.anexos,
            'anexos_parceiros': ultimo_pagamento.anexos_parceiros,
            'criado': acesso.usuario,
            param
        }

        var v_orcado = document.getElementById('v_orcado')
        if (v_orcado) {
            var v_pago = document.getElementById('v_pago')
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
            pagamento.status = 'Pagamento salvo localmente'
            lancar_pagamento(pagamento)
        } else if (permissao == 'gerente') {
            pagamento.status = 'Aguardando aprovação da Diretoria'
        } else {
            pagamento.status = 'Aguardando aprovação da Gerência'
        }

        enviar(`lista_pagamentos/${id_pagamento}`, pagamento)

        remover_popup()

        var lista_pagamentos = await recuperarDados('lista_pagamentos') || {};

        lista_pagamentos[pagamento.id_pagamento] = pagamento

        inserirDados(lista_pagamentos, 'lista_pagamentos');

        openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="imagens/concluido.png" style="width: 3vw; height: 3vw;">
                <label>Pagamento Solicitado</label>
            </div>                
        `)

        var esquema = document.getElementById('esquema')
        if (esquema) {
            fechar_esquema()
            abrir_esquema(id_orcam)
        }

        if (document.title == 'PAGAMENTOS') {
            consultar_pagamentos()
        }

        localStorage.removeItem('ultimo_pagamento')

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
                        placeholder="Chamado D7777 ou Loja SAM'S... ou Setor LOGÍSTICA..." oninput="carregar_opcoes_cc(this)" id="cc"></textarea>
                    <div class="autocomplete-list"></div>
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
                        <textarea style="width: 80%;" oninput="carregar_opcoes_clientes(this)" type="text"
                            class="autocomplete-input" placeholder="Quem receberá?" id="recebedor"></textarea>
                        <div class="autocomplete-list"></div>
                    </div>

                    <img src="imagens/atualizar_2.png" style="width: 2vw; cursor: pointer; margin-right: 5px;" onclick="atualizar_base_clientes()">

                </div>

                <div id="aguarde_2"
                    style="display: none; width: 100%; align-items: center; justify-content: center; gap: 10px;">
                    <img src="gifs/loading.gif" style="width: 5vw">
                    <label>Verificando clientes do Omie...</label>
                </div>

            </div>

            <div id="container_cnpj_cpf" style="display: none; align-items: center; gap: 10px; width: 100%;">

                <div class="numero" style="background-color: transparent;">
                    <img src="gifs/alerta.gif" style="width: 30px; height: 30px;">
                </div>

                <div class="itens_financeiro" style="background-color: #B12425">
                    <div
                        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
                            <input style="width: 80%;" type="text" id="cnpj_cpf" oninput="calculadora_pagamento()"
                                placeholder="Digite o CNPJ ou CPF aqui...">
                            <img src="imagens/confirmar.png" onclick="botao_cadastrar_cliente()" id="botao_cadastrar_cliente"
                                style="margin: 10px; cursor: pointer; width: 2vw;">
                        </div>

                        <label style="font-size: 0.7em;">Esse <strong>recebedor</strong> parece novo...
                            preencha o CPF/CNPJ e clique no símbolo de confirmação. </label>
                    </div>
                </div>

            </div>

            <div class="ordem">
                <label id="descricao_numero" class="numero">${ordenar()}</label>
                <div class="itens_financeiro">
                    <label>Descrição do pagamento</label>
                    <textarea style="width:80%" rows="3" id="descricao_pagamento" oninput="calculadora_pagamento()"
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
                            oninput="calculadora_pagamento()"></textarea>
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

            ${incluir_campos_adicionais()}

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

    openPopup_v2(acumulado, 'Solicitação de Pagamento')

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
    let anexos = await anexo_v2(input)
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
        abrir_detalhes(id_pagamento)
    }

    await recuperar_ultimo_pagamento()

}

async function atualizarFormaPagamento() {
    const formaPagamento = document.getElementById('forma_pagamento').value;
    const formaPagamentoContainer = document.getElementById('forma_pagamento_container');

    formaPagamentoContainer.innerHTML = `
        ${formaPagamento === 'Chave Pix'
            ? `<textarea rows="3" id="pix" oninput="calculadora_pagamento()" placeholder="CPF ou E-MAIL ou TELEFONE ou Código de Barras..."></textarea>`
            : `
                <div style="display: flex; flex-direction: column; justify-content: center;">
                    <label style="font-size: 0.8em; display: block; margin-top: 10px;">Data de Vencimento</label>
                    <input type="date" id="data_vencimento" oninput="calculadora_pagamento()" style="cursor: pointer; width: 90%; text-align: center;">
                </div>
            `
        }
    `;

    await calculadora_pagamento()
}

async function atualizar_base_clientes() {

    var div_recebedor = document.getElementById('div_recebedor')
    var aguarde_2 = document.getElementById('aguarde_2')

    if (div_recebedor) {

        div_recebedor.style.display = 'none'
        aguarde_2.style.display = 'flex'

        await recuperar_clientes()

        div_recebedor.style.display = 'flex'
        aguarde_2.style.display = 'none'

    }

}

function calcular_custo() {
    var resultado = document.getElementById('resultado')
    if (resultado) {

        var v_pago = conversor(document.getElementById('v_pago').textContent)
        var v_orcado = document.getElementById('v_orcado')

        var porcentagem = (v_pago / v_orcado.value * 100).toFixed(0)

        resultado.innerHTML = `
        ${porcentagem}%
        `
    }

}

function incluir_campos_adicionais() {

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

    var acumulado = `
    <div id="painel_parceiro" style="display: none; flex-direction: column; align-items: start; justify-content: start; gap: 5px; width: 100%;">
        ${campos_div}
        
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <label id="recebedor_numero" class="numero">${ordenar()}</label>
            <div style="background-color: #d2d2d2;">
                <table style="font-size: 1vw;">
                    <thead>
                        <th>Valor Orçado Válido</th>
                        <th>A Pagar</th>
                        <th>%</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input style="border: none; width: 100%; background-color: transparent;" id="v_orcado" placeholder="Valor Orçado" oninput="calcular_custo()"></td>
                            <td style="color: #222; white-space: nowrap;" id="v_pago"></td>
                            <td style="color: #222;" id="resultado"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `

    return acumulado
}

async function opcoes_clientes() {

    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var opcoes = []

    for (cnpj in dados_clientes) {
        var infos = dados_clientes[cnpj]

        opcoes.push(`[${cnpj}] ${infos.nome}`)
    }

    return opcoes
}

async function calculadora_pagamento() {

    var central_categorias = document.getElementById('central_categorias')
    var bloqueio = false

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

        let container_cnpj_cpf = document.getElementById('container_cnpj_cpf')
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
                container_cnpj_cpf.style.display = 'flex'
                bloqueio = true
            } else {
                colorir('green', 'recebedor_numero')
                container_cnpj_cpf.style.display = 'none'
                ultimo_pagamento.recebedor = cod_omie.textContent
            }

        } else {
            bloqueio = true
            container_cnpj_cpf.style.display = 'flex'
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

        await calculadora_pagamento()

    }
}

async function nova_categoria() {
    var categoria = `
        <div class="itens_financeiro" style="font-size: 0.8em; gap: 10px;">
            
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 30%; padding: 5px;">
                <label>Categoria</label>
                <label style="display: none;"></label>
                <textarea type="text" oninput="carregar_opcoes_categorias(this)" placeholder="Categoria" style="width: 100%; font-size: 0.8vw;"></textarea>
                <div class="autocomplete-list"></div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; width: 30%; padding: 5px;">
                <label>Valor</label>
                <input type="number" style="width: 100%;" oninput="calculadora_pagamento()" placeholder="0,00">
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
    await calculadora_pagamento()
}

function apagar_categoria(elemento) {
    var linha = elemento.closest('div');
    linha.parentNode.removeChild(linha);
    calculadora_pagamento()
}

async function botao_cadastrar_cliente() {
    let cnpj_cpf = document.getElementById('cnpj_cpf')
    let textarea_nome = document.getElementById('recebedor')
    let container_cnpj_cpf = document.getElementById('container_cnpj_cpf')
    let aguarde_2 = document.getElementById('aguarde_2')
    let div_recebedor = document.getElementById('div_recebedor')
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let codigo_omie = document.getElementById('codigo_omie')

    div_recebedor.style.display = 'none'
    container_cnpj_cpf.style.display = 'none'
    aguarde_2.style.display = 'flex'

    let resposta = await cadastrarCliente(textarea_nome.value, cnpj_cpf.value)

    if (resposta.faultstring) {
        let texto = resposta.faultstring
        let regex = /CPF\/CNPJ \[(.*?)\].*?Id \[(.*?)\]/;
        let match = texto.match(regex);

        if (match) {
            let cpfCnpj = match[1];
            let omie = match[2];

            if (!dados_clientes[cpfCnpj]) {
                dados_clientes[cpfCnpj] = {
                    omie: omie,
                    nome: textarea_nome.value
                }
            }
            await inserirDados(dados_clientes, 'dados_clientes')
        }

    } else if (resposta.codigo_cliente_omie) {

        let omie = resposta.codigo_cliente_omie
        let cpfCnpj = formatarCpfCnpj(cnpj_cpf.value)

        if (!dados_clientes[cpfCnpj]) {
            dados_clientes[cpfCnpj] = {
                omie: omie,
                nome: textarea_nome.value
            }
        }
        await inserirDados(dados_clientes, 'dados_clientes')
    }

    let cliente = dados_clientes[formatarCpfCnpj(cnpj_cpf.value)]
    codigo_omie.textContent = cliente.omie
    textarea_nome.value = cliente.nome

    div_recebedor.style.display = 'flex'
    aguarde_2.style.display = 'none'

    await calculadora_pagamento()

}

function formatarCpfCnpj(numero) {
    numero = numero.replace(/\D/g, '');

    if (numero.length === 11) {
        return numero.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numero.length === 14) {
        return numero.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

async function cadastrarCliente(nome, cnpj_cpf) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/cadastrar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                nome: nome,
                cnpj_cpf: cnpj_cpf
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Erro na requisição: " + response.status);
                }
                return response.json();
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                console.error("Erro:", error);
                reject({});
            });
    });
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

    let anexos = await anexo_v2(input)

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

            let id = gerar_id_5_digitos()

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

async function carregar_opcoes_categorias(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let div = textarea.nextElementSibling
    let id = gerar_id_5_digitos()
    textarea.id = id
    div.innerHTML = ''
    let dados_categorias = await recuperarDados('dados_categorias') || {};
    let opcoes = ''

    for (codigo in dados_categorias) {
        var categoria = String(dados_categorias[codigo]).toLowerCase();

        if (categoria.includes(pesquisa)) {
            opcoes += `
                <div onclick="selecionar_categoria('${codigo}', '${categoria}', '${id}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start;">
                    <label style="width: 90%; font-size: 0.8vw;">${categoria.toUpperCase()}</label>
                </div>
                `
        }

    }

    let label_codigo = textarea.previousElementSibling;
    label_codigo.textContent = ''

    if (pesquisa == '') {
        opcoes = ''
    }

    div.innerHTML = opcoes
    calculadora_pagamento()

}

function selecionar_categoria(codigo, categoria, id) {
    let textarea = document.getElementById(id)
    let label_codigo = textarea.previousElementSibling;
    label_codigo.textContent = codigo
    textarea.value = categoria.toUpperCase()

    let sugestoes = textarea.nextElementSibling
    sugestoes.innerHTML = ''
    calculadora_pagamento()
}

async function carregar_opcoes_clientes(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let div = textarea.nextElementSibling
    div.innerHTML = ''
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let opcoes = ''

    for (cnpj in dados_clientes) {
        var cliente = dados_clientes[cnpj];
        let omie = cliente.omie
        let nome = String(cliente.nome).toLowerCase()
        let form_cnpj = String(cnpj).replace(/\D/g, '')

        if (form_cnpj.includes(pesquisa) || nome.includes(pesquisa)) {
            opcoes += `
                <div onclick="selecionar_cliente('${omie}', '${nome}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start;">
                    <label style="width: 90%; font-size: 0.8vw;"><strong>CNPJ/CPF</strong> ${cnpj}</label>
                    <label style="width: 90%; font-size: 0.8vw;"><strong>Cliente</strong> ${nome.toUpperCase()}</label>
                </div>
                `
        }

    }

    document.getElementById('codigo_omie').textContent = ''

    if (pesquisa == '') {
        opcoes = ''
    }

    div.innerHTML = opcoes
    calculadora_pagamento()

}

function selecionar_cliente(omie, nome) {

    let b = document.getElementById('codigo_omie')
    b.textContent = omie
    let textarea = b.nextElementSibling

    textarea.value = nome.toUpperCase()
    let sugestoes = textarea.nextElementSibling
    sugestoes.innerHTML = ''
    calculadora_pagamento()
}

async function carregar_opcoes_cc(textarea) {

    let pesquisa = String(textarea.value).toLowerCase()
    let div = textarea.nextElementSibling
    div.innerHTML = ''
    let departamentos_fixos = JSON.parse(localStorage.getItem('departamentos_fixos')) || [];
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let opcoes = ''

    departamentos_fixos.forEach(dep => {
        if (dep.toLowerCase().includes(pesquisa)) {
            opcoes += `
            <div onclick="selecionar_cc('${dep}', '${dep}', '${dep}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 5px;">
                <label style="width: 100%; font-size: 0.8vw;"><strong>Setor</strong> ${dep}</label>
            </div>
        `}
    })

    for (id in dados_orcamentos) {
        var orc = dados_orcamentos[id];
        let contrato = String(orc.dados_orcam.contrato).toLowerCase()
        let cliente = String(orc.dados_orcam.cliente_selecionado).toLocaleLowerCase()

        if (contrato.includes(pesquisa) || cliente.includes(pesquisa)) {

            opcoes += `
                <div onclick="selecionar_cc('${id}', '${cliente}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5px;">
                    <label style="width: 100%; font-size: 0.8vw;"><strong>Chamado</strong> ${orc.dados_orcam.contrato}</label>
                    <label style="width: 100%; font-size: 1.0vw;">${orc.dados_orcam.cliente_selecionado}</label>
                    <label style="width: 100%; font-size: 0.8vw;"><strong>Analista</strong> ${orc.dados_orcam.analista}</label>
                </div>
                `
        }

    }

    document.getElementById('id_orcamento').textContent = ''

    if (pesquisa == '') {
        opcoes = ''
    }

    div.innerHTML = opcoes
    await calculadora_pagamento()
}

function selecionar_cc(id_orcamento, cliente) {
    let b = document.getElementById('id_orcamento')
    b.textContent = id_orcamento
    let textarea = b.nextElementSibling

    textarea.value = cliente.toUpperCase()
    let sugestoes = textarea.nextElementSibling
    sugestoes.innerHTML = ''
    calculadora_pagamento()
}

function pesquisar_em_pagamentos(coluna, texto) {

    filtrosAtivosPagamentos[coluna] = texto.toLowerCase();

    var tbody = document.getElementById('body');
    var trs = tbody.querySelectorAll('tr');

    var thead_pesquisa = document.getElementById('thead_pesquisa');
    var inputs = thead_pesquisa.querySelectorAll('input');
    inputs[coluna].value = texto

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtrosAtivosPagamentos) {
            var filtroTexto = filtrosAtivosPagamentos[col];

            if (filtroTexto && col < tds.length) {
                var conteudoCelula = tds[col].textContent.toLowerCase();

                if (!conteudoCelula.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none';
    });

}

async function duplicar_pagamento(id_pagamento) {

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {};
    let dados_categorias = await recuperarDados('dados_categorias')
    if (!dados_categorias) {
        dados_categorias = await receber('dados_categorias')
        inserirDados(dados_categorias, 'dados_categorias')
    }

    let pagamento = lista_pagamentos[id_pagamento]

    let contador = 0;

    let categorias = []

    Object.entries(pagamento.param[0].categorias).forEach(categoriaPagamento => {

        Object.entries(dados_categorias).forEach(([chave, nomecategoria]) => {

            if (categoriaPagamento[1].codigo_categoria == chave) {

                categorias[contador] = {
                    nome: nomecategoria,
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

async function filtrarPagamentosUsuario(usuario) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/pagamentosFiltrados", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario })
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