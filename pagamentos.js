var overlay = document.getElementById('overlay')
var centros_de_custo = {};
var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

carregamento_div = document.querySelector("#tela_carregamento")

carregamento('tela_carregamento')

if (!(localStorage.getItem("carimbo_data_hora_pagamentos"))) {
    carimbo_data_hora_pagamentos()
}
recuperar_dados_clientes()
try {
    consultar_pagamentos()
} catch {
    atualizar_pagamentos_menu()
}

function atualizarAndamento(texto) {
    var andamento = document.getElementById('andamento')
    if (andamento) {
        andamento.textContent = texto
    }
}

async function consultar_pagamentos(especial) { //True aqui vai retornar o painel de títulos com as contagens;

    var div_pagamentos = document.getElementById('div_pagamentos')
    if (div_pagamentos) {
        div_pagamentos.remove()
    }
    var acumulado = ''
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    var dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var clientes = {}
    var linhas = ''
    dados_categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    );

    Object.keys(dados_clientes).forEach(item => {
        var cliente = dados_clientes[item]
        clientes[cliente.omie] = cliente
    })

    var pagamentosFiltrados = Object.keys(lista_pagamentos)
        .map(pagamento => {
            var pg = lista_pagamentos[pagamento];
            if (pg.criado !== 'Omie') {

                var continuar = false
                if (acesso.permissao == 'gerente' && dados_setores[acesso.usuario].setor == dados_setores[pg.criado].setor) {
                    continuar = true
                } else if (pg.criado === acesso.usuario) {
                    continuar = true
                } else if (acesso.permissao == 'diretoria' || acesso.permissao == 'adm' || acesso.permissao == 'fin') {
                    continuar = true
                }

                if (continuar) {
                    var valor_categorias = pg.param[0].categorias.map(cat =>
                        `<p>${dinheiro(cat.valor)} - ${dados_categorias[cat.codigo_categoria]}</p>`
                    ).join('');
                    var nome_orcamento = orcamentos[pg.id_orcamento]
                        ? orcamentos[pg.id_orcamento].dados_orcam.cliente_selecionado
                        : pg.departamento;
                    var data_registro = pg.data_registro || pg.param[0].data_previsao;

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
                }

            }
            return null;
        })
        .filter(Boolean);

    const parseDate = (data) => {
        const [dia, mes, ano] = data.split('/').map(Number);
        return new Date(ano, mes - 1, dia);
    };

    pagamentosFiltrados.sort((a, b) => parseDate(b.data_previsao) - parseDate(a.data_previsao));

    var contadores = {
        gerente: { qtde: 0, valor: 0, termo: 'gerência', label: 'Aguardando aprovação da Gerência', icone: 'gerente.png' },
        diretoria: { qtde: 0, valor: 0, termo: 'da diretoria', label: 'Aguardando aprovação da Diretoria', icone: 'diretoria.png' },
        reprovados: { qtde: 0, valor: 0, termo: 'reprovado', label: 'Reprovados', icone: 'remover.png' },
        excluidos: { qtde: 0, valor: 0, termo: 'excluído', label: 'Pagamentos Excluídos', icone: 'alerta.gif' },
        salvos: { qtde: 0, valor: 0, termo: 'localmente', label: 'Salvo localmente', icone: 'salvo.png' },
        pago: { qtde: 0, valor: 0, termo: 'pago', label: 'Pagamento realizado', icone: 'concluido.png' },
        avencer: { qtde: 0, valor: 0, termo: 'a vencer', label: 'Pagamento será feito outro dia', icone: 'avencer.png' },
        hoje: { qtde: 0, valor: 0, termo: 'hoje', label: 'Pagamento será feito hoje', icone: 'vencehoje.png' },
        todos: { qtde: 0, valor: 0, termo: '', label: 'Todos os pagamentos', icone: 'voltar.png' }
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
            icone = 'alerta.gif'
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
                <td style="text-align: center;"><img src="pesquisar2.png" style="width: 30px; cursor: pointer;" onclick="abrir_detalhes('${pg.id}')"></td>
            </tr>
        `
    };

    var carimbo_data_hora_pagamentos = JSON.parse(localStorage.getItem('carimbo_data_hora_pagamentos'))[0] || ''

    var colunas = ['Data de Previsão', 'Centro de Custo', 'Valor e Categoria', 'Status Pagamento', 'Solicitante', 'Setor', 'Recebedor', 'Detalhes']

    var cabecalho1 = ''
    var cabecalho2 = ''
    colunas.forEach((coluna, i) => {

        cabecalho1 += `
            <th style="background-color: #B12425;">${coluna}</th>
            `
        cabecalho2 += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
            <img src="pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
            <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_em_pagamentos(${i}, this.value)">
            </th>
            `
    })

    var titulos = ''

    for (item in contadores) {
        if (contadores[item].valor !== 0) {
            titulos += `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.0vw;" onclick="pesquisar_em_pagamentos(3, '${contadores[item].termo}')">
                <label class="contagem" style="background-color: #B12425;">${contadores[item].qtde}</label>
                <img src="${contadores[item].icone}" style="width: 25px; height: 25px;">
                
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <Label style="display: flex; gap: 10px; font-size: 0.8vw;">${contadores[item].label}</label>
                    <label>${dinheiro(contadores[item].valor)}</label>
                </div>
            </div>
            `
        }
    }

    var div_titulos = `
        <div class="contorno_botoes" style="background-color: #22222287; display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: left; margin: 10px;">
        ${titulos}
        </div>
    `
    if (especial) {
        return div_titulos
    }

    acumulado += `
    <div id="div_pagamentos">
        <div style="display: flex; gap: 10px; justify-content: space-evenly; align-items: center; width: 100%; color: white;">
            

            <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento()">
                <label>Novo <strong>Pagamento</strong></label>
            </div>

            ${div_titulos}

            <div style="display: flex; flex-direction: column; gap: 10px; justify-content: space-evenly; align-items: start;">

                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;"
                    onclick="window.location.href='inicial.html'">
                    <img src="voltar.png" style="cursor: pointer; width: 30px;" onclick="window.location.href='inicial.html'">
                    <label style="color: white;">Voltar</label>
                </div>
                    
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="atualizar_pagamentos_menu()">
                    <img src="atualizar_2.png" style="width: max-content; cursor: pointer; width: 30px;">
                    <label style="color: white;">Atualizar Pagamentos</label>
                </div>

                <label>Sincronizado: ${carimbo_data_hora_pagamentos}</label>

                <label id="andamento">...</label>
            </div>


        </div>
        <div style="border-radius: 5px; height: 800px; overflow-y: auto;">
            <table id="pagamentos" style="width: 100%; color: #222; font-size: 0.8em; border-collapse: collapse; table-layout: fixed;">
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
    `
    var elementus = `
    <div id="pagamentos">
        ${acumulado}
    <div>
    `
    document.body.insertAdjacentHTML('beforeend', elementus)

    carregamento_div.remove()

}

async function abrir_detalhes(id_pagamento) {

    ordem = 0
    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var dados_clientes = await recuperarDados('dados_clientes') || {};
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    var cc = 'Erro 404'
    var pedido = ''
    var categorias_invertidas = {}
    Object.keys(dados_categorias).forEach(cat => {
        categorias_invertidas[dados_categorias[cat]] = cat
    })

    var dados_clientes_invertido = {};
    Object.entries(dados_clientes).forEach(([nome, item]) => {
        if (item.omie) {
            dados_clientes_invertido[item.omie] = {
                ...item,
                nome: nome
            };
        }
    });

    dados_clientes = dados_clientes_invertido;

    var cliente = 'Error 404'
    var pedido = 'Error 404'
    var pagamento = lista_pagamentos[id_pagamento]

    if (dados_orcamentos[pagamento.id_orcamento] && dados_orcamentos[pagamento.id_orcamento].status[pagamento.id_pedido]) {
        pedido = dados_orcamentos[pagamento.id_orcamento].status[pagamento.id_pedido].pedido
    }

    if (dados_orcamentos[pagamento.id_orcamento]) {
        cc = dados_orcamentos[pagamento.id_orcamento].dados_orcam.cliente_selecionado
        pedido = `
        <label><strong>Número do Pedido • </strong>${pedido}</label>
        `
    } else {
        cc = pagamento.id_orcamento
    }

    var anexos = ''

    cliente = pagamento.param[0].codigo_cliente_fornecedor

    if (dados_clientes_invertido[pagamento.param[0].codigo_cliente_fornecedor]) {
        cliente = dados_clientes_invertido[pagamento.param[0].codigo_cliente_fornecedor].nome
    }

    Object.keys(pagamento.anexos).forEach(anx => {

        var anexo = pagamento.anexos[anx]

        var arquivo = `https://drive.google.com/file/d/${anexo.link}/view?usp=drivesdk`

        anexos += `
        <div style="display: flex; gap: 10px; align-items: center; justify-content: left; cursor: pointer;" onclick="abrirArquivo('${arquivo}')">
        <img src="anexo.png" style="width: 20px; cursor: pointer;">
        <label>${anexo.nome}</label>
        </div>
        `
    })

    var historico = ''
    var cor = '#222'
    if (pagamento.historico) {

        pagamento.historico.forEach(item => {

            var imagem = 'remover.png'
            if (item.status.includes('Aprovado')) {
                cor = '#4CAF50'
                imagem = 'concluido.png'
            } else if (item.status.includes('Aguardando')) {
                cor = '#D97302'
                imagem = 'avencer.png'
            } else if (item.status.includes('Reprovado')) {
                cor = '#B12425'
                imagem = 'remover.png'
            } else {
                cor = '#B12425'
            }

            historico += `
            <div style="display: flex; gap: 10px; align-items: center; margin: 3vw;">
                <div class="vitrificado" style="border: 2px solid ${cor}">
                    <p><strong>Status </strong>${item.status}</p>
                    <p><strong>Usuário </strong>${item.usuario}</p>
                    <p><strong>Data </strong>${item.data}</p>
                    <p><strong>Justificativa </strong>${item.justificativa.replace(/\n/g, "<br>")}</p>
                </div>
                <img src="${imagem}">
            </div>
            `
        })

    }

    var acoes_orcamento = ''
    if (dados_orcamentos[pagamento.id_orcamento]) {
        acoes_orcamento += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="exibir_todos_os_status('${pagamento.id_orcamento}')">
            <img src="pasta.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Consultar Orçamento</label>
        </div>    
        `
    }

    var ultima_alteracao = ''
    if (pagamento.ultima_alteracao) {
        ultima_alteracao = `alterado às ${pagamento.ultima_alteracao}`
    }

    var valores = ''
    var habilitar_painel_parceiro = {
        ativar: false,
        valor: 0
    }

    pagamento.param[0].categorias.forEach(item => {
        valores += `
            <label><strong>${dinheiro(item.valor)}</strong> - ${categorias_invertidas[item.codigo_categoria]}</label>
        `
        if (String(categorias_invertidas[item.codigo_categoria]).includes('Parceiros')) {
            habilitar_painel_parceiro.ativar = true
            habilitar_painel_parceiro.valor += item.valor
        }
    })

    var div_valores = `
        <div style="display: flex; flex-direction: column;">
            ${valores}
        <hr style="width: 100%;">
        <label>${dinheiro(pagamento.param[0].valor_documento)}</label>
        </div>
        `
    var acumulado = ''
    if (pagamento.param[0].valor_documento > 500 && (pagamento.status.includes('Aguardando') || pagamento.status.includes('Reprovado')) && (acesso.permissao == 'gerente' || acesso.permissao == 'adm' || acesso.permissao == 'diretoria' || acesso.permissao == 'fin' || pagamento.criado == acesso.usuario)) {
        acumulado += `
        <div class="balao">

            <div style="display: flex; align-items: center; justify-content: center;">

                <img src="alerta.gif">

                <label style="margin: 10px;">Responda a solicitação aqui</label>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px;">
                    <textarea id="justificativa" placeholder="Descreva o motivo da aprovação/reprovação" oninput="auxiliar(this)"></textarea>
                    <button id="aprovar" style="display: none; background-color: green; padding: 5px;" onclick="atualizar_feedback('Aprovar', '${id_pagamento}')">Aprovar</button>
                    <button id="reprovar" onclick="atualizar_feedback('Reprovar', '${id_pagamento}')" style="display: none; padding: 5px;">Reprovar</button>
                </div>

            </div>
        </div>
        `
    }

    var botao_editar = ''
    if (acesso.usuario == pagamento.criado || (acesso.permissao == 'adm' || acesso.permissao == 'fin' || acesso.permissao == 'gerente')) {
        botao_editar = `
            <button style="position: absolute; top: 0; right: 0;" onclick="editar_comentario('${id_pagamento}')">Editar</button>
        `
    }

    var info_adicional_parceiro = ''

    if (habilitar_painel_parceiro.ativar) { //29

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
            if (campo == 'orcamento') {
                info_existente += `
                <div class="anexos" onclick="ir_pdf('${pagamento.id_orcamento}')" style="border: solid 1px green;">
                    <img src="anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                    <label style="cursor: pointer; font-size: 0.6em;"><strong>Orçamento disponível</strong></label>
                </div>
            `
            }

            if (campo == 'pedido') {
                var info_existente = ''
                let orcamento = ''
                if (dados_orcamentos[pagamento.id_orcamento]) {
                    orcamento = dados_orcamentos[pagamento.id_orcamento]
                }

                if (orcamento.status && orcamento.status[pagamento.id_pedido] && orcamento.status[pagamento.id_pedido].historico) {
                    var his = orcamento.status[pagamento.id_pedido].historico
                    for (hist in his) {
                        var item_historico = his[hist]
                        if (String(item_historico.status).includes('ANEXADO')) {
                            let anexos = item_historico.anexos

                            for (anx in anexos) {
                                let anexo = anexos[anx]
                                info_existente += `
                                <div onclick="abrirArquivo('https://drive.google.com/file/d/${anexo.link}')" class="anexos" style="border: solid 1px green;">
                                    <img src="anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                                    <label style="cursor: pointer; font-size: 0.6em"><strong>${anexo.nome}</strong></label>
                                </div>                                
                                `
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
                                <img src="anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                                <input type="file" id="anexo_${campo}" style="display: none;" onchange="anexos_parceiros('${campo}','${pagamento.id_pagamento}')">
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
                <div style="background-color: #222; border-radius: 5px; margin: 5px;">
                    <table style="font-size: 1vw; padding: 5px;">
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
                                    <img src="editar.png" style="width: 30px; cursor: pointer;" onclick="editar_resumo('${pagamento.id_pagamento}')">
                                </div>
                                </td>
                                <td style="color: #222; white-space: nowrap;" id="v_pago">${dinheiro(habilitar_painel_parceiro.valor)}</td>
                                <td style="color: #222;" id="resultado">${resultado}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `
    }

    acumulado += `
    <div style="display: flex; gap: 10px; flex-direction: column; align-items: baseline; text-align: left;">
        <span class="close" onclick="fechar_detalhes()">&times;</span>
        ${acoes_orcamento}
        <label><strong>Status atual • </strong> ${pagamento.status}</label>
        <label><strong>Quem recebe? • </strong> ${cliente}</label>
        <div id="centro_de_custo_div" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <label><strong>Centro de Custo</strong> • ${cc}</label>
            <img src="alerta.gif" style="width: 30px; cursor: pointer;" onclick="alterar_centro_de_custo('${id_pagamento}')">
        </div>
        ${pedido}
        <label><strong>Data de Solicitação</strong> • ${pagamento.data_registro}</label>
        <label><strong>Data de Pagamento</strong> • ${pagamento.param[0].data_vencimento}</label>

        ${div_valores}

        ${info_adicional_parceiro}

        <div id="comentario" class="contorno"><strong>Observações </strong> •  ${ultima_alteracao} <br> ${pagamento.param[0].observacao.replace(/\n/g, "<br>")}
            ${botao_editar}
        </div>
        <label><strong>Anexos </strong> • 
        
            <label for="adicionar_anexo_pagamento" style="text-decoration: underline; cursor: pointer;">
                Incluir Anexo
                <input type="file" id="adicionar_anexo_pagamento" style="display: none;" onchange="salvar_anexo_pagamento('${id_pagamento}')">
            </label>

        </label>
        
        ${anexos}
        
        <label><strong>Histórico </strong> • ${historico}</label>
    </div>
    `

    var elementus = `
    <div id="detalhes" class="status" style="display: flex;">
        ${acumulado}
    </div>
    
    `
    var detalhes = document.getElementById('detalhes')
    if (detalhes) {
        detalhes.remove()
    }
    document.body.insertAdjacentHTML('beforeend', elementus)
    overlay.style.display = 'block'

    // Depois que se abre o pagamento, percorra os anexos e preencha cada item;
    if (pagamento.anexos_parceiros) {
        var itens = pagamento.anexos_parceiros
        for (item in itens) {
            var anexos_on = itens[item]

            for (anx in anexos_on) {

                var anexo = anexos_on[anx]

                var element = `
                <div onclick="abrirArquivo('https://drive.google.com/file/d/${anexo.link}')" class="anexos" style="border: solid 1px green;">
                    <img src="anexo.png" style="cursor: pointer; width: 20px; height: 20px;">
                    <label style="cursor: pointer; font-size: 0.6em;"><strong>${anexo.nome}</strong></label>
                </div>
                `
                document.getElementById(`container_${item}`).insertAdjacentHTML('beforeend', element)

            }
        }
    }

    colorir_parceiros()

}

function editar_resumo(id_pagamento) {
    var container_resumo = document.getElementById('container_resumo')
    if (container_resumo) {
        container_resumo.innerHTML = `
        <input placeholder="R$ 0,00" type="number" oninput="calcular_custo()" id="v_orcado">
        <img src="concluido.png" style="width: 30px; cursor: pointer;" onclick="atualizar_resumo('${id_pagamento}')">
        <img src="cancel.png" style="width: 30px; cursor: pointer;" onclick=" abrir_detalhes('${id_pagamento}')">
        `
    }
}

function atualizar_resumo(id_pagamento) {

    var v_pago = conversor(document.getElementById('v_pago').textContent)
    var v_orcado = Number(document.getElementById('v_orcado').value)

    var dados = {
        id_pagamento: id_pagamento,
        tabela: 'anexos_parceiros',
        resumo: { v_pago, v_orcado }
    }

    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}

    var pagamento = lista_pagamentos[id_pagamento]

    if (!pagamento.resumo) {
        pagamento.resumo = {}
    }

    pagamento.resumo = { v_pago, v_orcado }

    localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))
    abrir_detalhes(id_pagamento)

    enviar_dados_generico(dados)
}

function colorir_parceiros() {
    var detalhes = document.getElementById('detalhes')
    if (detalhes) {

        var labels = detalhes.querySelectorAll('label.numero')
        var divs = detalhes.querySelectorAll('div.container')

        divs.forEach((div, i) => {
            if (div.children.length == 0) {
                labels[i].style.backgroundColor = '#B12425'
            } else {
                labels[i].style.backgroundColor = 'green'
            }
        })
        var v_orcado = document.getElementById('v_orcado')
        if (v_orcado && conversor(v_orcado.textContent) == 0) {
            labels[labels.length - 1].style.backgroundColor = '#B12425'
        } else {
            labels[labels.length - 1].style.backgroundColor = 'green'
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

function fechar_detalhes() {

    var detalhes = document.getElementById('detalhes')
    if (detalhes) {
        detalhes.remove()
    }
    remover_popup()

}

async function atualizar_pagamentos_menu() {

    recuperar_orcamentos()
    recuperar()
    atualizarAndamento('Sincronizando pagamentos...')
    await obter_lista_pagamentos()
    atualizarAndamento('Verificando hierarquia de setores...')
    await lista_setores()

    remover_popup()
    atualizarAndamento('Processando dados na tabela...')
    await consultar_pagamentos()

    for (coluna in filtrosAtivosPagamentos) {
        pesquisar_em_pagamentos(coluna, filtrosAtivosPagamentos[coluna])
    }

}

function atualizar_feedback(resposta, id_pagamento) {

    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}

    var pagamento = lista_pagamentos[id_pagamento]

    var dataFormatada = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    var usuario = acesso.usuario
    var status = `Aprovado por ${usuario}`
    var justificativa = document.getElementById('justificativa').value

    if (resposta == 'Aprovar' && (acesso.permissao == 'gerente' || acesso.permissao == 'adm')) {
        status = 'Aguardando aprovação da Diretoria'
    } else if (resposta == 'Aprovar' && acesso.permissao == 'diretoria') {
        status = 'Aprovado pela Diretoria'
    } else if (resposta == 'Aprovar' && acesso.permissao == 'fin') {
        status = 'Aprovado pelo Financeiro'
    } else if (resposta == 'Reprovar') {
        status = `Reprovado por ${acesso.permissao}`
    } else {
        status = 'Aguardando aprovação da Gerência'
    }

    var historico = {
        status,
        usuario,
        justificativa,
        data: dataFormatada
    }

    var dados = {
        id_pagamento: id_pagamento,
        tabela: 'atualizacoes_pagamentos',
        alteracao: 'justificativa',
        status,
        historico
    }

    if (!pagamento.historico) {
        pagamento.historico = []
    }
    pagamento.status = status

    pagamento.historico.push(historico)

    enviar_dados_generico(dados)

    localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))
    fechar_e_abrir(id_pagamento)

}


function editar_comentario(id) {

    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var pagamento = lista_pagamentos[id]
    var div_comentario = document.getElementById('comentario')

    if (div_comentario) {

        div_comentario.innerHTML = `
        <textarea style="width: 80%" rows="20">
        ${pagamento.param[0].observacao}
        </textarea>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px;">
            <button onclick="salvar_comentario('${id}')" style="background-color: green">Alterar Comentário</button>
            <button onclick="fechar_e_abrir('${id}')">Cancelar</button>
        </div>
        `
    }

}

function fechar_e_abrir(id) {
    fechar_detalhes()
    consultar_pagamentos()
    abrir_detalhes(id)
}

function alterar_centro_de_custo(id) {

    var centro_de_custo_div = document.getElementById('centro_de_custo_div')

    centro_de_custo_div.innerHTML = `
    <label>Escolha o novo centro de custo</label>

    <div class="autocomplete-container">
        <textarea style="width: 80%;" type="text" class="autocomplete-input" id="cc"
            placeholder="42017... ou D7777 ou SAM'S... ou LOGÍSTICA..."></textarea>
        <div class="autocomplete-list" id="cc_sugestoes"></div>
    </div>

    <img src="concluido.png" style="width: 20px; cursor: pointer;" onclick="salvar_centro_de_custo('${id}')">
    </div>
    `

    carregar_opcoes(opcoes_centro_de_custo(), 'cc', 'cc_sugestoes') // Carregar os centros de custo;
}

function salvar_centro_de_custo(id) {
    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var pagamento = lista_pagamentos[id]

    var cc = document.getElementById('cc')

    if (cc) {

        var elemento = cc.value

        var cod = elemento.match(/\[(\d+)\]$/)[1];

        chave1 = centros_de_custo[cod].key_pedido
        id_orcam = centros_de_custo[cod].key_orc

        pagamento.id_orcamento = id_orcam
        pagamento.id_pedido = chave1

    } else {
        pagamento.id_orcamento = cc.value
        pagamento.id_pedido = cc.value
    }

    var dados = {
        id_pagamento: id,
        tabela: 'atualizacoes_pagamentos',
        alteracao: 'cc',
        id_orcamento: pagamento.id_orcamento,
        id_pedido: pagamento.id_pedido
    }

    enviar_dados_generico(dados)

    localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))
    fechar_e_abrir(id)

}

function salvar_comentario(id) {

    var dataFormatada = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    var comentario = document.getElementById('comentario').querySelector('textarea').value

    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {}
    var pagamento = lista_pagamentos[id]

    pagamento.param[0].observacao = comentario

    pagamento.ultima_alteracao = dataFormatada

    var dados = {
        id_pagamento: id,
        tabela: 'atualizacoes_pagamentos',
        alteracao: 'observacao',
        observacao: comentario,
        ultima_alteracao: dataFormatada
    }

    enviar_dados_generico(dados)

    localStorage.setItem('lista_pagamentos', JSON.stringify(lista_pagamentos))
    fechar_e_abrir(id)

}
