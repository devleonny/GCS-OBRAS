
let itens_adicionais = {}
let id_orcam = ''
let dataAtual = new Date();
let data_status = dataAtual.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
});

const fluxograma = {
    'ORÇAMENTOS': { cor: '#1CAF29' },
    'LOGÍSTICA': { cor: '#4CAF10' },
    'NFE - VENDAS': { cor: '#B05315' },
    'REQUISIÇÃO': { cor: '#B12425' },
    'ATIVIDADE EM ANDAMENTO': { cor: '#b17724' },
    'CONCLUÍDO': { cor: '#ff4500' },
    'FATURADO': { cor: '#b17724' },
    'PAGAMENTO RECEBIDO': { cor: '#b17724' }
}

document.addEventListener("DOMContentLoaded", async () => {
    let orcamento_que_deve_voltar = localStorage.getItem("orcamento_que_deve_voltar");

    if (orcamento_que_deve_voltar) {

        orcamento_que_deve_voltar = orcamento_que_deve_voltar.replace(/"/g, "");

        exibir_todos_os_status(orcamento_que_deve_voltar)

        // 🔥 Remove os dados do localStorage após exibição
        localStorage.removeItem("orcamento_que_deve_voltar");
    }

});

async function sincronizar_e_reabrir() {
    await recuperar_orcamentos()
    await abrir_esquema(id_orcam)
}

async function resumo_orcamentos() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let setores = JSON.parse(localStorage.getItem('dados_setores')) || {};
    let setores_por_nome = {};

    Object.keys(setores).forEach(id => {
        setores_por_nome[setores[id].nome] = setores[id];
    });

    let orcamentos_por_usuario = {};

    for (let id in dados_orcamentos) {
        let orcamento = dados_orcamentos[id];
        let analista = orcamento.dados_orcam.analista;

        if (!orcamentos_por_usuario[analista]) {
            orcamentos_por_usuario[analista] = {};
        }

        orcamentos_por_usuario[analista][id] = orcamento;
    }

    let linhas = '';

    for (let pessoa in orcamentos_por_usuario) {
        let orcamentos = orcamentos_por_usuario[pessoa];
        let contadores = {
            aprovados: 0,
            reprovados: 0,
            pendentes: 0,
            total: 0
        };

        for (let id in orcamentos) {
            let orc = orcamentos[id];

            if (orc.status) {
                let pedidos = orc.status;
                for (let ped in pedidos) {
                    let pedido = pedidos[ped];
                    if (String(pedido.pedido).includes('?')) {
                        contadores.pendentes += 1;
                    } else {
                        contadores.aprovados += 1;
                    }
                    contadores.total += 1;
                }
            } else {
                contadores.total += 1;
            }

            if (orc.aprovacao && Object.keys(orc.aprovacao).length > 0) {
                let responsaveis = orc.aprovacao;
                let valor = conversor(orc.total_geral);
                let gerente = false;
                let diretoria = false;

                if (responsaveis.Gerente && responsaveis.Gerente.status) {
                    gerente = responsaveis.Gerente.status === 'aprovado';
                }

                if (responsaveis.Diretoria && responsaveis.Diretoria.status) {
                    diretoria = responsaveis.Diretoria.status === 'aprovado';
                }

                if (valor > 21000) {
                    if (diretoria) {
                        contadores.aprovados += 1;
                    } else if (gerente) {
                        contadores.pendentes += 1;
                    } else {
                        contadores.reprovados += 1;
                    }
                } else {
                    gerente ? contadores.aprovados += 1 : contadores.reprovados += 1;
                }
            }
        }

        // Corrigindo o cálculo de pendentes:
        contadores.pendentes = contadores.total - (contadores.aprovados + contadores.reprovados);

        let porc = {
            apr: ((contadores.aprovados / contadores.total) * 100 || 0).toFixed(0),
            rep: ((contadores.reprovados / contadores.total) * 100 || 0).toFixed(0),
            pen: ((contadores.pendentes / contadores.total) * 100 || 0).toFixed(0)
        };

        function div_porc(porc, cor) {
            return `
                <div style="width: 100px; background-color: #dfdfdf; display: flex; align-items: center; justify-content: start; border-radius: 3px;">
                    <div style="width: ${porc}%; background-color: ${cor}; text-align: center; border-radius: 3px;">
                        <label style="color: black; margin-left: 3px;">${porc}%</label>
                    <div>
                </div>
            `;
        }

        linhas += `
            <tr style="background-color: white; color: #222;">
                <td>${pessoa}</td>
                <td>${setores_por_nome[pessoa]?.setor || '--'}</td>
                <td style="text-align: center;">${contadores.total}</td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.aprovados}</label>
                        ${div_porc(porc.apr, '#4CAF50')}
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.reprovados}</label>
                        ${div_porc(porc.rep, 'red')}
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <label>${contadores.pendentes}</label>
                        ${div_porc(porc.pen, 'orange')}
                    </div>
                </td>
            </tr>
        `;
    }

    let colunas = ['Analista', 'Setor', 'Total', 'Aprovados', 'Reprovados', 'Pendentes'];
    let ths = colunas.map(col => `<th>${col}</th>`).join('');

    let acumulado = `
        <img src="imagens/BG.png" style="height: 70px; position: absolute; top: 3px; left: 3px;">
        <label>Relatório de orçamentos por Pessoa</label>
        <div>
            <table class="tabela" style="table-layout: auto;">
                <thead>
                    <tr>${ths}</tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `;

    openPopup_v2(acumulado);
}

async function painel_adicionar_pedido() {

    let espelho_ocorrencias = document.getElementById('espelho_ocorrencias')

    if (espelho_ocorrencias) {
        espelho_ocorrencias.remove()
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let cliente = dados_orcamentos[id_orcam].dados_orcam.cliente_selecionado
    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    var acumulado = `

        <label style="position: absolute; bottom: 5px; right: 5px; font-size: 0.6em;" id="data">${data}</label>

        <div style="display: flex; justify-content: space-evenly; align-items: center;">
            <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
        </div>

        <br>
        <div id="container_status"></div>
        
        <hr style="width: 80%">

        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 5px; padding: 10px">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <p class="novo_titulo" style="cursor: pointer; color: #222">Escolha o tipo do <strong>Pedido</strong> </p> 
                <select id="tipo">
                    <option>Selecione</option>
                    <option>Serviço</option>
                    <option>Venda</option>
                    <option>Venda + Serviço</option>
                </select>
            </div>

            <div style="display: flex; gap: 10px; align-items: center; justify-content: center; align-items: center;">
                <input type="checkbox" onchange="ocultar_pedido(this)" style="cursor: pointer; width: 30px; height: 30px;">
                <label>Sem Pedido</label>
            </div>

            <div id="div_pedidos">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <label style="white-space: nowrap;">Número do Pedido</label>
                    <input type="text" class="pedido" id="pedido">
                </div>

                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <label style="white-space: nowrap;">Valor do Pedido</label>
                    <input type="number" class="pedido" id="valor">
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                <label>Comentário</label>
                <textarea rows="5" id="comentario_status"></textarea>
            </div>

            <hr style="width: 80%">

            <button style="background-color: #4CAF50; width: 95%;" onclick="salvar_pedido()">Salvar</button>

            <div id="aviso_campo_branco" style="display: none; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Não deixe campos em Branco</label>
            </div>

        </div>

    `

    openPopup_v2(acumulado, "Novo Pedido", true)

}

async function painel_adicionar_notas(chave) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var cliente = dados_orcamentos[id_orcam].dados_orcam.cliente_selecionado
    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    let st = dados_orcamentos[id_orcam].status?.historico[chave] || {}
    let notas = st.notas ? st.notas[0] : {}

    var acumulado = `

        <label style="position: absolute; bottom: 5px; right: 5px; font-size: 0.6em;" id="data">${data}</label>

        <div style="display: flex; justify-content: space-evenly; align-items: center; padding: 10px;">
            <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
        </div>

        <br>
        
        <div id="container_status"></div>

        <hr style="width: 80%">

        <div style="display: flex; flex-direction: column; align-items: start: justify-content: center; gap: 5px;">
            <label class="novo_titulo" style="color: #222;">Inclua o número da Nota</label>
            <label>Remessa, Venda ou Serviço</label>
        </div>

        <div style="display: flex; flex-direction: column; justify-content: center; align-items: start; padding: 10px;"
            <label><strong>Número da Nota</strong></label>
            <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                <input type="number" class="pedido" id="nota" value="${notas?.nota || ''}">
                <select id="tipo">
                    <option>Selecione</option>
                    <option ${notas?.modalidade == 'Remessa' ? 'selected' : ''}>Remessa</option>
                    <option ${notas?.modalidade == 'Venda' ? 'selected' : ''}>Venda</option>
                    <option ${notas?.modalidade == 'Serviço' ? 'selected' : ''}>Serviço</option>
                    <option ${notas?.modalidade == 'Venda + Serviço' ? 'selected' : ''}>Venda + Serviço</option>
                </select>
            </div>
            <label><strong>Valor da Nota</strong></label>
            <input type="number" class="pedido" id="valorNota" value="${notas?.valorNota || ''}">
            <label><strong>Valor do Frete</strong></label>
            <input type="number" class="pedido" id="valorFrete" value="${notas?.valorFrete || ''}">
        </div>

        <div style="display: flex; flex-direction: column; gap: 3px; align-items: start; padding: 10px;">
            <label><strong>Comentário</strong></label>
            <textarea rows="5" style="width: 80%;" id="comentario_status">${st?.comentario || ''}</textarea>
        </div>

        <hr style="width: 80%">

        <button style="background-color: #4CAF50" onclick="salvar_notas('${chave}')">Salvar</button>

        <div id="aviso_campo_branco" style="display: none; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Não deixe campos em Branco</label>
        </div>

    `

    openPopup_v2(acumulado, "Nova Nota Fiscal", true)

}

function ocultar_pedido(elemento) {

    let pedido = document.getElementById('pedido')
    let valor = document.getElementById('valor')
    let div_pedidos = document.getElementById('div_pedidos')

    if (pedido && valor && div_pedidos) {

        if (elemento.checked) {
            div_pedidos.style.display = 'none'
            pedido.value = '???'
            valor.value = 0
        } else {
            div_pedidos.style.display = 'block'
            pedido.value = ''
            valor.value = 0
        }
    }
}

async function calcular_requisicao(sincronizar) {

    var tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {
        var tbody = tabela_requisicoes.querySelector('tbody')

        let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
        var orcamento = dados_orcamentos[id_orcam]

        var itens = orcamento.dados_composicoes
        var estado = orcamento.dados_orcam.estado

        if (tbody) {
            var trs = tbody.querySelectorAll('tr')

            var total_sem_icms = 0
            var total_com_icms = 0

            trs.forEach(tr => {

                if (tr.style.display !== 'none') {
                    var tds = tr.querySelectorAll('td')
                    var codigo = tds[0].textContent

                    let quantidadeDisponivel = 0
                    if (tds[4].querySelector('label.num')) {
                        quantidadeDisponivel = tds[4].querySelector('label.num').textContent
                    } else {
                        quantidadeDisponivel = tds[4].querySelector('label').textContent
                    }

                    if (tds[4].querySelector('input') && tds[4].querySelector('input').value > conversor(quantidadeDisponivel)) {
                        tds[4].querySelector('input').value = conversor(quantidadeDisponivel)
                    }

                    var tipo = 'Error 404'

                    if (sincronizar) { // Incicialmente para carregar os tipos;
                        tipo = itens[codigo].tipo
                        tds[3].querySelector('select').value = tipo

                    } else {
                        tipo = tds[3].querySelector('select') ? tds[3].querySelector('select').value : tds[3].querySelector('label').textContent
                    }

                    var infos = ['', '']
                    if (tipo == 'VENDA') {
                        infos = ['<strong>s • ICMS</strong> <br>', '<strong>c • ICMS</strong> <br>']
                    }

                    var icms = 0
                    if (estado == 'BA' && tipo == 'VENDA') {
                        icms = 0.205
                    } else if (estado !== 'BA' && tipo == 'VENDA') {
                        icms = 0.12
                    }

                    var qtde = tds[4].querySelector('input') ? tds[4].querySelector('input').value : tds[4].textContent
                    var custo = conversor(itens[codigo]?.custo)
                    var unt_sem_icms = custo - (custo * icms)

                    var labels_unitarios = tds[5].querySelectorAll('label')
                    labels_unitarios[0].innerHTML = `${infos[1]} ${dinheiro(custo)}`
                    labels_unitarios[1].innerHTML = (qtde == '' || tipo == 'SERVIÇO') ? '' : `${infos[0]} ${dinheiro(unt_sem_icms)}`


                    var labels_totais = tds[6].querySelectorAll('label')
                    labels_totais[0].innerHTML = `${infos[1]} ${dinheiro(custo * qtde)}`
                    labels_totais[1].innerHTML = (qtde == '' || tipo == 'SERVIÇO') ? '' : `${infos[0]} ${dinheiro(unt_sem_icms * qtde)} `

                    total_sem_icms += unt_sem_icms * qtde
                    total_com_icms += qtde * custo
                }
            })

            var total_c_icms = document.getElementById('total_c_icms')
            var total_s_icms = document.getElementById('total_s_icms')

            if (total_c_icms && total_s_icms) {
                total_c_icms.textContent = dinheiro(total_com_icms)
                total_s_icms.textContent = dinheiro(total_sem_icms)
            }

        }
    }

}

function pesquisar_na_requisicao() {

    var pesquisa1 = document.getElementById('pesquisa1');

    if (pesquisa1) {

        var tabela = document.getElementById('tabela_requisicoes');
        var tbody = tabela.querySelector('tbody');
        var trs = tbody.querySelectorAll('tr');

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td');
            var mostrar_linha = false;

            tds.forEach(td => {

                var select = td.querySelector('select');
                var conteudo = select ? select.value : td.textContent;

                if (String(conteudo).toLowerCase().includes(String(pesquisa1.value).toLowerCase()) || pesquisa1.value == '') {
                    mostrar_linha = true;
                }
            });

            tr.style.display = mostrar_linha ? 'table-row' : 'none';
        });
    }
}

async function carregar_itens(apenas_visualizar, requisicao, editar, tipoRequisicao, seEditar, valoresTotais) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let orcamento = dados_orcamentos[id_orcam];

    var linhas = '';

    if (!orcamento.dados_composicoes || Object.keys(orcamento.dados_composicoes).length == 0) {
        return '';
    }

    // Filtra os itens com base no tipo de requisição
    let itensFiltrados = [];

    for (id in orcamento.dados_composicoes) {
        let item = orcamento.dados_composicoes[id]
        if (tipoRequisicao === 'infraestrutura') {
            const descricao = dados_composicoes[item.codigo]?.descricao.toLowerCase();
            if ((
                descricao.includes('eletrocalha') ||
                descricao.includes('eletroduto') ||
                descricao.includes('perfilado')
            )) {

                itensFiltrados.push(item)
            }
        } else { itensFiltrados.push(item) }

    }

    // Função para criar uma linha da tabela
    function criarLinha(codigo, item, tipo, qtde_na_requisicao, qtde_editar, partnumber, elements, aux, apenas_visualizar, seEditar, valoresTotais) {

        if (!seEditar) {

            qtde_editar -= qtde_na_requisicao
            qtde_na_requisicao = ""

        } else {

            Object.values(valoresTotais).forEach(item => {

                if (item.codigoRequisicao == codigo) {

                    qtde_editar += qtde_na_requisicao - item.qtdeTotal

                }

            })

        }

        return `
            <tr class="lin_req" style="background-color: white;">
                <td style="text-align: center; font-size: 1.2em; white-space: nowrap;">${codigo}</td>
                <td style="text-align: center;">
                    ${apenas_visualizar ? `<label style="font-size: 1.2em;">${requisicao[codigo]?.partnumber || dados_composicoes[codigo]?.omie || ''}</label>` : partnumber}
                </td>
                <td style="position: relative;">
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: start;">
                        ${elements || 'Informação não disponível'}
                    </div>
                    ${aux}
                </td>
                <td style="text-align: center; padding: 0px; margin: 0px; font-size: 0.8em;">
                    ${apenas_visualizar ? `<label style="font-size: 1.2em; margin: 10px;">${requisicao[codigo]?.tipo || tipo || ''}</label>` : `
                        <select onchange="calcular_requisicao()" style="border: none;">
                            <option value="SERVIÇO" ${tipo === 'SERVIÇO' ? 'selected' : ''}>SERVIÇO</option>
                            <option value="VENDA" ${tipo === 'VENDA' ? 'selected' : ''}>VENDA</option>
                        </select>
                    `}
                </td>
                <td style="text-align: center;">
                    ${apenas_visualizar ? `<label style="font-size: 1.2em;">${requisicao[codigo]?.qtde_enviar || ''}</label>` : `
                        <div style="display: flex; align-items: center; justify-content: center; gap: 2vw;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: start; gap: 5px;">
                                <label>Quantidade a enviar</label>
                                <input class="pedido" type="number" style="width: 10vw; padding: 0px; margin: 0px; height: 40px;" oninput="calcular_requisicao()" value="${qtde_na_requisicao}">
                            </div>
                            <label class="num">${qtde_editar}</label>  
                        </div>
                    `}
                </td>
                <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                    <label></label>
                    <br>
                    <br>
                    <label style="color: red; font-size: 1.0em;"></label>
                </td>
                <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                    <label></label>
                    <br>
                    <br>
                    <label style="color: red; font-size: 1.0em;"></label>
                </td>
                <td>
                    ${apenas_visualizar ? `<label style="font-size: 1.2em;">${requisicao[codigo]?.requisicao || ''}</label>` : `
                        <select style="border: none; cursor: pointer;">
                            <option style="text-align: center;">Nada a fazer</option>
                            <option>Estoque AC</option>
                            <option>Comprar</option>
                            <option>Enviar do CD</option>
                            <option>Fornecido pelo Cliente</option>
                        </select>
                    `}
                </td>
            </tr>
        `;
    }


    for (item of itensFiltrados) {
        var codigo = item.codigo;
        var qtde = item.qtde;
        var qtde_na_requisicao = 0;
        var tipo = dados_composicoes[codigo]?.tipo || item.tipo;
        var elements = '';
        let mod_livre = true;
        let qtde_editar = qtde;
        var historico = dados_orcamentos.id_orcam?.status.historico || {};

        Object.keys(historico).forEach(chave => {
            var sst = historico[chave];

            if (sst.requisicoes) {
                for (let requisicao of sst.requisicoes) {
                    if (requisicao.codigo == item.codigo) {
                        qtde_editar -= requisicao.qtde_enviar;
                    }
                }
            }
        });

        if (dados_composicoes[codigo]) {
            elements += `
                <label style="font-size: 0.8vw;"><strong>DESCRIÇÃO</strong> <br>${dados_composicoes[codigo].descricao}</label>
                <label style="font-size: 0.8vw;"><strong>FABRICANTE</strong> ${dados_composicoes[codigo].fabricante} • <strong>MODELO</strong> ${dados_composicoes[codigo].modelo}</label>
                `;
            mod_livre = false;
        }

        if (mod_livre) {
            elements = `
            <label>${item.descricao}</label>
            `;
        }

        var part_number = `
            <input value="${dados_composicoes[codigo]?.omie || ''}" class="pedido" style="font-size: 1.0vw; width: 10vw; height: 40px; padding: 0px; margin: 0px;">
        `;

        if (requisicao) {
            qtde_na_requisicao = requisicao[codigo]?.qtde_enviar || '';
        }

        let somasQtde = 0;

        let q = 0;

        if (editar) {
            Object.values(orcamento?.status || []).forEach(status => {
                if (status?.historico) {
                    Object.entries(status.historico).forEach(([chave, historico]) => {
                        if (historico?.status && String(historico.status).includes("REQUISIÇÃO") && historico.requisicoes) {
                            for (let requisicaoUnica of historico.requisicoes) {
                                if (requisicaoUnica.codigo == codigo) {
                                    somasQtde += Number(requisicaoUnica.qtde_enviar);
                                    q++;
                                }
                            }
                        }
                    });
                }
            });
        }

        let aux = `<img src="imagens/construcao.png" style="position: absolute; top: 5px; right: 5px; width: 20px; cursor: pointer;" onclick="abrir_adicionais('${codigo}')">`;

        if (apenas_visualizar) {
            aux = '';
        }

        if (apenas_visualizar && qtde_na_requisicao == 0) {
            continue
        }

        linhas += criarLinha(codigo, item, tipo, qtde_na_requisicao, qtde_editar, part_number, elements, aux, apenas_visualizar, seEditar, valoresTotais)

    };

    // Adiciona os itens adicionais
    if (itens_adicionais && Object.keys(itens_adicionais).length > 0) {
        for (const codigo in itens_adicionais) {
            if (itens_adicionais.hasOwnProperty(codigo) && itens_adicionais[codigo]) {
                let item = itens_adicionais[codigo];
                let tipo = "SERVIÇO"

                //Verificar se o item já foi adicionado pra evitar duplicação
                let jaExiste = false;
                for (const itemExistente of itensFiltrados) {
                    if (itemExistente.codigo === codigo) {
                        jaExiste = true
                        break
                    }
                }
                if (!jaExiste) {
                    let elements = `
                <label>${item.descricao}</label>
            `;

                    let partnumber = `
                <input value="${item.partnumber || ''}" class="pedido" style="font-size: 1.0vw; width: 10vw; height: 40px; padding: 0px; margin: 0px;">
            `;

                    let aux = `<img src="imagens/construcao.png" style="position: absolute; top: 5px; right: 5px; width: 20px; cursor: pointer;" onclick="abrir_adicionais('${codigo}')">`;

                    linhas += criarLinha(codigo, item, tipo, item.qtde || 0, item.qtde || 0, partnumber, elements, aux, apenas_visualizar);
                }
            }
        }
    }

    return linhas;

}

function abrirModalTipoRequisicao() {
    let modal = `
        <div style="text-align: center">
            <button onclick="escolherTipoRequisicao('Requisição Completa'); adicionarColunasCompra()" style="
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-right: 10px;
            ">Requisição Completa</button>
            <button onclick="escolherTipoRequisicao('infraestrutura'); adicionarColunasCompra()" style="
                background-color: #2196F3;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Requisição de Infraestrutura</button>
        </div>
    `;

    openPopup_v2(modal, 'Escolha o tipo de Requisição', true);
}

function escolherTipoRequisicao(tipo) {
    fecharModalTipoRequisicao();
    detalhar_requisicao(undefined, undefined, tipo); // Passa o tipo de requisição
}

function fecharModalTipoRequisicao() {
    const modal = document.getElementById('modalTipoRequisicao');
    if (modal) {
        modal.remove();
    }
}
function remover_linha_materiais(element) {
    element.closest('tr').remove()
}

async function abrir_adicionais(codigo) {

    var acumulado = `
        <div id="tela" style="display: flex; flex-direction: column; align-items: start; justify-content: center; background-color: white; border-radius: 3px; padding: 5px;">
            <div class="tabela_manutencao">
                <div class="linha"
                    style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px;">
                    <div style="width: 8vw;">
                        <label>Part Number</label>
                    </div>
                    <div style="width: 25vw;">
                        <label>Descrição</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Quantidade</label>
                    </div>
                    <div style="width: 20vw;">
                        <label>Unidade</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Estoque</label>
                    </div>
                    <div style="width: 10vw;">
                        <label>Estoque Usado</label>
                    </div>
                    <div style="width: 5vw;">
                        <label>Remover</label>
                    </div>
                </div>

                <div id="linhas_manutencao">
                    <div id="excluir_inicial" class="linha" style="width: 70vw;">
                        <label>Lista Vazia</label>
                    </div>
                </div>
            </div>

            <br>

            <div style="display: flex; align-items: center; width: 100% ">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div onclick="adicionar_linha_manut()" class="contorno_botoes"
                        style="background-color: #151749; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/chamados.png" style="cursor: pointer; width: 2vw;">
                        <label>Adicionar Peça</label>
                    </div>
                    <div onclick="recuperar_estoque()" class="contorno_botoes" style="background-color: #151749; color: white;">
                        <img src="imagens/sync.png" style="cursor: pointer; width: 2vw;">
                        <label>Sincronizar Estoque</label>
                    </div>
                </div>

                <div onclick="salvar_itens_adicionais('${codigo}')" class="contorno_botoes"
                    style="background-color: green; display: flex; align-items: center; justify-content: center; gap: 10px; margin-left: auto;">
                    <img src="imagens/estoque.png" style="cursor: pointer; width: 2vw">
                    <label>Salvar</label>
                </div>
            </div>
        </div>
    `

    openPopup_v2(acumulado, 'Itens Adicionais', true)

    for (cd in itens_adicionais) {

        if (cd == codigo) {
            var adicionais = itens_adicionais[cd]

            for (ad in adicionais) {
                var dados = adicionais[ad]
                adicionar_linha_manut(ad, dados)
            }

        }
    }

}

function adicionar_linha_manut(ad, dados) {
    let tbody = document.getElementById('linhas_manutencao')
    let aleatorio = ad ? ad : gerar_id_5_digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
        <div class="linha_completa">
            <div class="linha">
                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="text" value="${dados?.partnumber || ''}">
                </div>
                <div style="position: relative; width: 25vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent; height: 100%; resize: none; border: none; outline: none;" type="text" id="${aleatorio}" oninput="sugestoes(this, 'sug_${aleatorio}', 'estoque')">${dados?.descricao || ''}</textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div> 
                    <input id="input_${aleatorio}" style="display: none;">
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="number" value="${dados?.qtde || ''}">
                </div>

                <div style="width: 20vw; height: 30px; background-color: #b5b5b5;">
                    <select style="width: 100%; background-color: transparent;">
                        <option ${dados?.unidade == 'UND' ? 'checked' : ''}>UND</option>
                        <option ${dados?.unidade == 'METRO' ? 'checked' : ''}>METRO</option>
                        <option ${dados?.unidade == 'CX' ? 'checked' : ''}>CX</option>
                        <option ${dados?.unidade == 'PCT' ? 'checked' : ''}>PCT</option>
                    </select>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 5vw; display: flex; align-items: center; justify-content: center;">
                    <img src="imagens/remover.png" onclick="remover_esta_linha(this)" style="width: 30px; cursor: pointer;">
                </div>
            </div>
            <hr style="width: 100%; margin: 0px;">
        </div>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_esta_linha(div_menor) {
    let linha_completa = div_menor.closest('.linha_completa')
    if (linha_completa) {
        linha_completa.remove()
    }
}

async function sugestoes(textarea, div, base) {

    let div_sugestoes = document.getElementById(div)
    let query = String(textarea.value).toUpperCase()
    div_sugestoes.innerHTML = '';

    if (query === '') {
        let campo = div.split('_')[1]
        let endereco = document.getElementById(`endereco_${campo}`)

        if (endereco) {
            document.getElementById(`codigo_${campo}`).innerHTML = ''
            endereco.innerHTML = ''
            return
        }

        return
    }

    let dados = await recuperarDados(`dados_${base}`) || {}
    let opcoes = ''

    for (id in dados) {
        let item = dados[id]
        let info;

        info = String(item.descricao)

        if (info.includes(query)) {
            opcoes += `
                    <div onclick="definir_campo(this, '${div}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
                `
        }
    }

    div_sugestoes.innerHTML = opcoes

}

async function definir_campo(elemento, div, id) {

    let campo = String(div).split('_')[1]

    let input_aleatorio = document.getElementById(`input_${campo}`)
    input_aleatorio.value = id

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let estoques = ['estoque', 'estoque_usado']

    let dic_quantidades = {}

    estoques.forEach(estoque => {

        let estoque_do_objeto = dados_estoque[id][estoque]
        let historicos = estoque_do_objeto.historico
        dic_quantidades[estoque] = estoque_do_objeto.quantidade


        for (his in historicos) {
            let historico = historicos[his]

            if (historico.operacao == 'entrada') {
                dic_quantidades[estoque] += historico.quantidade
            } else if (historico.operacao == 'saida') {
                dic_quantidades[estoque] -= historico.quantidade
            }
        }

        let div_linha = input_aleatorio.parentElement.parentElement

        let inputs = div_linha.querySelectorAll('input, textarea, select')

        inputs[0].value = dados_estoque[id].partnumber
        inputs[5].value = dic_quantidades.estoque
        inputs[6].value = dic_quantidades.estoque_usado

    })

    document.getElementById(campo).value = elemento.textContent
    document.getElementById(div).innerHTML = '' // Sugestões
}

function salvar_itens_adicionais(codigo) {
    let tabela = document.getElementById('linhas_manutencao')
    let linhas = tabela.querySelectorAll('.linha')

    itens_adicionais[codigo] = {}

    let adicionais = itens_adicionais[codigo]

    linhas.forEach(linha => {
        let valores = linha.querySelectorAll('input, textarea, select')
        let cod = valores[1].id

        if (cod !== '') {
            if (!adicionais[cod]) {
                adicionais[cod] = {}
            }

            adicionais[cod].partnumber = valores[0].value
            adicionais[cod].descricao = valores[1].value
            adicionais[cod].qtde = valores[3].value
            adicionais[cod].unidade = valores[4].value
        }
    })

    mostrar_itens_adicionais()
    remover_popup()
}


function mostrar_itens_adicionais() {
    var tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {

        var tbody = tabela_requisicoes.querySelector('tbody')
        var trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td')
            let codigo = tds[0]?.textContent || undefined
            if (codigo === "---") {
                return tr.remove()
            }

            let local = document.getElementById(`tabela_${codigo}`)
            if (local) {
                local.remove()
            }

            if (itens_adicionais[codigo]) {

                var adicionais = itens_adicionais[codigo]
                let linhas = ''
                for (ad in adicionais) {

                    var adicional = adicionais[ad]

                    let linha = `
                    <tr class="linha-itens-adicionais">
                        <td style="text-align: center;">---</td>
                        <td>${adicional.partnumber}</td>
                        <td>${adicional.descricao}</td>
                        <td style="text-align: center;">ADICIONAL</td>
                        <td style="text-align: center;">${adicional.qtde}</td>
                        <td style="text-align: center;">---</td>
                        <td style="text-align: center;">---</td>
                        <td style="text-align: center;">
                            ${tds[7].querySelector("select")?.value || "---"}
                         </td>

                    </tr>
                    `
                    tr.insertAdjacentHTML("afterend", linha)
                }


            }

        })
    }
}

async function salvar_pedido(chave) {
    let data = document.getElementById('data')
    let comentario_status = document.getElementById('comentario_status')
    let valor = document.getElementById('valor')
    let tipo = document.getElementById('tipo')
    let pedido = document.getElementById('pedido')

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {

        let aviso_campo_branco = document.getElementById("aviso_campo_branco")

        aviso_campo_branco.style.display = "flex"

        setTimeout(() => {

            aviso_campo_branco.style.display = "none"

        }, 3000);

        return

    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]

    if (!chave) {
        chave = gerar_id_5_digitos();
    }

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    if (!orcamento.status.historico[chave]) {
        orcamento.status.historico[chave] = {}
    }

    orcamento.status.historico[chave].status = 'PEDIDO'
    orcamento.status.historico[chave].data = data.textContent
    orcamento.status.historico[chave].executor = acesso.usuario
    orcamento.status.historico[chave].comentario = comentario_status.value
    orcamento.status.historico[chave].valor = Number(valor.value)
    orcamento.status.historico[chave].tipo = tipo.value
    orcamento.status.historico[chave].pedido = pedido.value

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    remover_popup()
    await abrir_esquema(id_orcam)

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, orcamento.status.historico[chave])

}

async function salvar_notas(chave) {
    let nota = document.getElementById('nota')
    let valorNota = document.getElementById('valorNota')
    let valorFrete = document.getElementById('valorFrete')
    let tipo = document.getElementById('tipo')
    let data = document.getElementById('data')
    let comentario_status = document.getElementById('comentario_status')
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];

    if (tipo.value == "Selecione" || nota.value == "" || valorNota.value == "" || valorFrete.value == "") {

        let aviso_campo_branco = document.getElementById("aviso_campo_branco")

        aviso_campo_branco.style.display = "flex"

        setTimeout(() => {

            aviso_campo_branco.style.display = "none"

        }, 3000);

        return

    }

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    if (!orcamento.status.historico[chave]) {
        orcamento.status.historico[chave] = {}
    }

    orcamento.status.historico[chave].status = 'FATURADO'
    orcamento.status.historico[chave].data = data.textContent
    orcamento.status.historico[chave].executor = acesso.usuario
    orcamento.status.historico[chave].comentario = comentario_status.value
    orcamento.status.historico[chave].notas = [{
        nota: nota.value,
        modalidade: tipo.value,
        valorNota: valorNota.value,
        valorFrete: valorFrete.value
    }]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    remover_popup()
    await abrir_esquema(id_orcam)

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, orcamento.status.historico[chave])

    itens_adicionais = {}
}

async function salvar_requisicao(chave) {

    // Overlay
    let janela = document.querySelectorAll('.janela')
    janela = janela[janela.length - 1] // A última que existir
    janela.insertAdjacentHTML('beforeend', overlay_aguarde())

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    var novo_lancamento = {
        status: 'REQUISIÇÃO',
        data: data_status,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        requisicoes: [],
        adicionais: itens_adicionais,
        total_sem_icms: total_s_icms.textContent,
        total_com_icms: total_c_icms.textContent
    };

    var linhas = document.querySelectorAll('.lin_req');
    var lista_partnumbers = {};

    for (let linha of linhas) {

        let valores = linha.querySelectorAll('input, select');

        if (valores.length == 0) { continue }
        let tds = linha.querySelectorAll('td')

        let codigo = tds[0].textContent
        let partnumber = valores[0].value
        let tipo = valores[1].value
        let qtde = valores[2].value
        let requisicao = valores[3].value

        if (partnumber == '' && qtde !== '') {
            return openPopup_v2(`
                    <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                        <label> Preencha os PARTNUMBERs pendentes</label>
                    </div>
                `, 'Aviso', true);
        }

        if (qtde != '') {
            novo_lancamento.requisicoes.push({
                codigo: codigo,
                partnumber: partnumber,
                tipo: tipo,
                qtde_enviar: qtde,
                requisicao: requisicao
            });
        }

        lista_partnumbers[codigo] = partnumber;

    }

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)

    if (orcamento.modalidade !== 'MODALIDADE LIVRE') {
        atualizar_partnumber(lista_partnumbers)
    }

    orcamento.status.historico[chave] = novo_lancamento;

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    remover_popup()
    await abrir_esquema(id_orcam)

    itens_adicionais = {}

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }
}

function botao_novo_pedido(id) {
    return `
    <div class="contorno_botoes" style="background-color: #4CAF50;" onclick="painel_adicionar_pedido()">
        <label>Novo <strong>Pedido </strong></label>
    </div>
`
}

function botao_novo_pagamento(id) {
    return `
    <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento()">
        <label>Novo <strong>Pagamento</strong></label>
    </div>   
`}

async function exibir_todos_os_status(id) {

    let detalhes = document.getElementById('detalhes')
    if (detalhes) {
        detalhes.remove()
    }

    id_orcam = id

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var orcamento = dados_orcamentos[id]

    var acumulado = `
        <div style="display: flex;">
            <label style="color: #222; font-size: 1.5vw;" id="cliente_status">${orcamento.dados_orcam.cliente_selecionado}</label>
        </div>
    `
    var analista = orcamento.dados_orcam.analista
    var acumulado_botoes = ''

    acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="abrir_esquema('${id}')">
            <img src="imagens/esquema.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Histórico</label>
        </div>
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_pdf('${id}')">
            <img src="imagens/pdf.png" style="width: 55px;">
            <label style="cursor: pointer;">Abrir Orçamento em PDF</label>
        </div>
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_excel('${id}')">
            <img src="imagens/excel.png">
            <label style="cursor: pointer;">Baixar Orçamento em Excel</label>
        </div>
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_duplicar('${id}')">
            <img src="imagens/duplicar.png">
            <label style="cursor: pointer;">Duplicar Orçamento</label>
        </div>
    `

    if ((document.title !== 'Projetos' && analista == acesso.nome_completo) || (acesso.permissao == 'adm' || acesso.permissao == 'fin')) {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_excluir('${id}')">
            <img src="imagens/apagar.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Excluir Orçamento</label>
        </div>    
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_editar('${id}')">
            <img src="imagens/editar.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Editar Orçamento</label>
        </div>         
        `
    }

    acumulado += `
        <hr>
        <div style="display: flex; flex-direction: column; justify-content: center; width: 30vw;">
            ${acumulado_botoes}
        </div>
    `

    openPopup_v2(acumulado, 'Opções do Orçamento')

}

async function remover_reprovacao(responsavel) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]

    delete orcamento.aprovacao[responsavel]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    await deletar(`dados_orcamentos/${id_orcam}/aprovacao/${responsavel}`)

    exibir_todos_os_status(id_orcam)
    await preencher_orcamentos_v2()
}

async function aprovar_orcamento(responsavel, aprovar, data) {
    let justificativa = document.getElementById(`justificativa_${responsavel}`)
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let orcamento = dados_orcamentos[id_orcam]
    let aprov = {
        usuario: acesso.usuario,
        data: data,
        justificativa: justificativa.value,
        status: aprovar ? 'aprovado' : 'reprovado'
    }

    if (!orcamento.aprovacao) {
        orcamento.aprovacao = {}
    }

    orcamento.aprovacao[responsavel] = aprov

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/aprovacao/${responsavel}`, aprov)

    exibir_todos_os_status(id_orcam)
    await preencher_orcamentos_v2()
}

const { shell } = require('electron');

async function abrir_esquema(id) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    let orcamento = dados_orcamentos[id]
    let dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}

    if (Object.keys(dados_setores).length == 0) {
        dados_setores = await lista_setores()
        localStorage.setItem('dados_setores', JSON.stringify(dados_setores))
    }

    let setor = dados_setores[acesso.usuario]?.setor
    let permissao = dados_setores[acesso.usuario]?.permissao
    let categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    )

    let desejaApagar = "deseja_apagar"

    if (orcamento) {
        var levantamentos = ''
        if (orcamento.levantamentos) {
            for (chave in orcamento.levantamentos) {
                var levantamento = orcamento.levantamentos[chave]
                levantamentos += `
                <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                    <div onclick="abrirArquivo('${levantamento.link}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/anexo2.png" style="width: 2vw;">
                        <label style="font-size: 0.8em;">${String(levantamento.nome).slice(0, 10)} ... ${String(levantamento.nome).slice(-7)}</label>
                    </div>
                    <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_levantamento('${id}', '${chave}')">
                </div>                
                `
            }
        }

        const usuariosPermitidos = ['adm', 'gerente', 'diretoria']
        const setoresPermitidos = ['LOGÍSTICA']

        let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
        acesso = await lista_setores(acesso.usuario)
        let permissao = acesso.permissao

        const setorPermitido = setoresPermitidos.includes(acesso?.setor)
        const usuarioPermitido = usuariosPermitidos.includes(permissao)

        var acumulado = `
        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;" class="painel-custos-container">
        
            <div onclick="sincronizar_e_reabrir()" style="display: flex; flex-direction: column; justify-content: left; align-items: center; cursor: pointer;">
                <img src="imagens/atualizar2.png" style="width: 3vw;">
                <label style="font-size: 1vw;">Atualizar</label>
            </div>
            • 
            <div style="display: flex; flex-direction: column; justify-content: start; align-items: start; font-size: 0.8vw; color: #222;">
                <label>${orcamento.dados_orcam.contrato}</label>
                <label>${orcamento.dados_orcam.cliente_selecionado}</label>
            </div>
            • 
            <div style="display: flex; flex-direction: column; align-items: start;">
                <div class="contorno_botoes" style="background-color: #222;">
                    <img src="imagens/anexo2.png" style="width: 2vw;">
                    <label style="font-size: 1vw;" for="adicionar_levantamento">Anexar levantamento
                        <input type="file" id="adicionar_levantamento" style="display: none;"
                            onchange="salvar_levantamento('${id}')">
                    </label>
                </div>
                ${levantamentos}
            </div>
            • 
            <div onclick="mostrar_painel()" class="contorno_botoes" id="permissao_visualizar" style=" align-items: center; justify-content: center; gap: 5px;
            ${!(usuarioPermitido || setorPermitido) ? 'display: none;' : ''}">
                <img src="imagens/pesquisar.png" style="width: 2vw;">
                <label style="font-size: 1vw;">Exibir Painel de Custos</label>
            </div>
            • 
            <div onclick="mostrar_itens_restantes('${id_orcam}')" class="contorno_botoes" style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <img src="imagens/interrogacao.png" style="width: 2vw;">
                <label style="font-size: 1vw;">Itens Pendentes</label>
            </div>

        </div>    
        `

        let blocos_por_status = {}
        let links_requisicoes = ''
        let string_pagamentos = ''
        let tem_pagamento = false
        let pagamentos_painel = {}
        var historico = orcamento.status?.historico || {}

        for (pag in lista_pagamentos) {

            var pagamento = lista_pagamentos[pag]
            var comentario = 'Sem observação'
            if (pagamento.param[0].observacao) {
                comentario = pagamento.param[0].observacao.replace(/\|/g, '<br>')
            }

            if (pagamento.id_orcamento == id) {

                let pagamentos_localizados = ''
                pagamento.param[0].categorias.forEach(cat => {

                    pagamentos_localizados += `
                        <label><strong>Categoria:</strong> ${categorias[cat.codigo_categoria] ?
                            categorias[cat.codigo_categoria] : cat.codigo_categoria} • R$ ${dinheiro(cat.valor)}</label>
                        `

                    if (!pagamentos_painel[pagamento.status]) {
                        pagamentos_painel[pagamento.status] = 0
                    }
                    pagamentos_painel[pagamento.status] += Number(cat.valor)

                })

                string_pagamentos += `
                <div style="display: flex; flex-direction: column; border-radius: 5px; border: solid 1px white; padding: 10px; background-color: white; color: #222;">
                        
                    <label style="display: flex; gap: 10px;"><strong>${pagamento.status}</strong></label>
                    <label><strong>Data:</strong> ${pagamento.param[0].data_previsao}</label>
                    <label><strong>Observação:</strong><br>${comentario}</label>
                    ${pagamentos_localizados}

                </div>
                `
                tem_pagamento = true
            }

        }

        if (tem_pagamento) {

            if (!blocos_por_status['PAGAMENTOS']) {
                blocos_por_status['PAGAMENTOS'] = ''
            }

            blocos_por_status['PAGAMENTOS'] = `
            <div class="bloko"
            style="background-color: #097fe6; height: max-content; overflow-y: auto;">
                <div style="display: flex; justify-content: center; align-items: center;">
                    <label style="color: white; font-size: 1.3vw;">Pagamentos</label>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">
                    <img src="imagens/pesquisar.png" style="width: 1vw;">
                    <input style="width: 12vw; font-size: 0.7vw; padding: 3px; border-radius: 3px;" placeholder="Pesquisar pagamento" oninput="pesquisar_pagamentos(this)">
                </div>
                <div style="height: max-content; max-height: 500px; overflow: auto;">
                    <div class="escondido" style="display: none; flex-direction: column; justify-content: start; align-items: center; gap: 10px;">
                        ${string_pagamentos}
                    </div>
                </div>

                <div style="cursor: pointer; background-color: #097fe6; border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; display: flex; align-items: center; justify-content: center;" onclick="exibirItens(this)">
                    <label style="color: white; font-size: 0.9vw;">▼</label>
                </div>
            </div>
        `}

        for (chave in historico) {

            let sst = historico[chave]

            links_requisicoes = ''
            let editar = ''

            if (sst.status.includes('REQUISIÇÃO')) {
                links_requisicoes += `
                    <div onclick="detalhar_requisicao('${chave}')" class="label_requisicao">
                        <img src="gifs/lampada.gif" style="width: 25px">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; cursor: pointer;">
                            <label style="cursor: pointer;"><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                            <label style="font-size: 0.7em; cursor: pointer;">Clique Aqui</label>
                        </div>
                    </div>
                    `
                editar = `
                    <div style="background-color: #B12425" class="contorno_botoes" onclick="detalhar_requisicao('${chave}', true)">
                        <img src="imagens/editar4.png">
                        <label>Editar</label>
                    </div>
                    `
            }

            let dados_pedidos = ''
            let opcoes = ['Serviço', 'Venda', 'Venda + Serviço']
            let html_opcoes = ''
            opcoes.forEach(op => {
                html_opcoes += `
                    <option ${sst.tipo == op ? 'selected' : ''}>${op}</option>
                    `
            })

            if (String(sst.status).includes('PEDIDO')) {
                dados_pedidos = `
                    <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                        <label><strong>Pedido:</strong></label>
                        <input style="border-radius: 2px; width: 8vw; font-size: 0.7vw;" value="${sst.pedido}" oninput="mostrar_botao_pedido(this)">
                        <img src="imagens/concluido.png" style="display: none; width: 1vw;" onclick="atualizar_pedido('${chave}', 'pedido', this)">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                        <label><strong>Valor:</strong></label>
                        <input class="valores_pedidos" style="border-radius: 2px; width: 8vw; font-size: 0.7vw;" value="${sst.valor}" oninput="mostrar_botao_pedido(this)">
                        <img src="imagens/concluido.png" style="display: none; width: 1vw;" onclick="atualizar_pedido('${chave}', 'valor', this)">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                        <label><strong>Tipo:</strong></label>
                        <select style="text-align: center; border: none; padding: 0px; margin: 0px; font-size: 0.7vw;" onchange="atualizar_pedido('${chave}', 'tipo', this)">
                            ${html_opcoes}
                        </select>
                    </div>                                        
                    `
            }

            if (String(sst.status).includes('RETORNO')) {
                editar = `
                    <div style="background-color: #aacc14" class="contorno_botoes" onclick="retorno_de_materiais('${chave}')">
                        <img src="imagens/editar4.png">
                        <label>Editar</label>
                    </div>
                    `
            }

            if (String(sst.status).includes('FATURADO')) {
                editar = `
                    <div style="background-color: #ff4500" class="contorno_botoes" onclick="painel_adicionar_notas('${chave}')">
                        <img src="imagens/editar4.png">
                        <label>Editar</label>
                    </div>
                    `
            }

            var notas = ''
            if (sst.notas) {
                notas += `
                <label><strong>NF: </strong>${sst.notas[0].nota}</label>
                <label><strong>Valor NF: </strong>${dinheiro(sst.notas[0].valorNota)}</label>
                <label><strong>Valor FRETE: </strong>${dinheiro(sst.notas[0].valorFrete)}</label>
                <label><strong>Tipo: </strong>${sst.notas[0].modalidade}</label>
                `
            }

            var totais = ''
            if (sst.requisicoes) {
                var infos = calcular_quantidades(sst.requisicoes, dados_orcamentos[id].dados_composicoes)
                totais += `
                    <div style="display: flex; flex-direction: column;">
                        <label><strong>Total sem ICMS: </strong><br>${sst.total_sem_icms}</label>
                        <label><strong>Total com ICMS: </strong><br>${sst.total_com_icms}</label>
                    </div>
                    <div class="contorno_botoes" style="border-radius: 3px; padding: 5px; background-color: ${infos.cor};">
                        <label style="font-size: 0.7vw;">${infos.label_porcentagem}</label>
                    </div>
                `
            }

            var coments = ''
            if (sst.comentario) {
                var coments = sst.comentario.replace(/\n/g, '<br>')
            }

            let campo = fluxograma[sst.status]?.campo || sst.status
            if (!blocos_por_status[campo]) {
                blocos_por_status[campo] = ''
            }

            let dados_envio = ''
            if (sst.envio) { // Cartão específico de envio de materias... {.envio}
                dados_envio = `
                <label><strong>Rastreio: </strong>${sst.envio.rastreio}</label>
                <label><strong>Transportadora: </strong>${sst.envio.transportadora}</label>
                <label><strong>Volumes: </strong>${sst.envio.volumes}</label>
                <label><strong>Data de Saída: </strong>${sst.envio.data_saida}</label>
                <label><strong>Data de Entrega: </strong>${sst.envio.previsao}</label>
                `

                editar = `
                <div style="background-color: #b17724" class="contorno_botoes" onclick="envio_de_material('${chave}')">
                    <img src="imagens/editar4.png">
                    <label>Editar</label>
                </div>
                `
            }

            if (String(sst.status).includes('COTAÇÃO')) {

                desejaApagar = "deseja_apagar_cotacao"

            }

            const antigoFluxogramaCores = {
                'INCLUIR PEDIDO': { cor: '#4CAF50' },
                'PEDIDO': { cor: '#4CAF50' },
                'REQUISIÇÃO': { cor: '#B12425' },
                'MATERIAL SEPARADO': { cor: '#b17724' },
                'FATURADO': { cor: '#ff4500' },
                'MATERIAL ENVIADO': { cor: '#b17724' },
                'MATERIAL ENTREGUE': { cor: '#b17724' },
                'COTAÇÃO PENDENTE': { cor: '#0a989f' },
                'COTAÇÃO FINALIZADA': { cor: '#0a989f' },
                'RETORNO DE MATERIAIS': { cor: '#aacc14' },
                'FINALIZADO': { cor: 'blue' }
            }

            blocos_por_status[campo] += `
                    <div class="bloko" style="gap: 0px; border: 1px solid ${antigoFluxogramaCores[sst.status].cor}; background-color: white; justify-content: center;">

                        <div style="cursor: pointer; display: flex; align-items: start; flex-direction: column; background-color: ${antigoFluxogramaCores[sst.status].cor}1f; padding: 3px; border-top-right-radius: 3px; border-top-left-radius: 3px;">
                            <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="${desejaApagar}('${chave}')">&times;</span>
                            <label><strong>Executor: </strong>${sst.executor}</label>
                            <label><strong>Data: </strong>${sst.data}</label>
                            <label><strong>Comentário: </strong> <br> ${coments}</label>
                            ${dados_envio}
                            ${dados_pedidos}
                            ${notas}
                            ${totais}
                            ${links_requisicoes}
                            ${String(sst.status).includes('COTAÇÃO') ? `<a href="cotacoes.html" style="color: black;" onclick="localStorage.setItem('cotacaoEditandoID','${chave}'); localStorage.setItem('operacao', 'editar'); localStorage.setItem('iniciouPorClique', 'true');">Clique aqui para abrir a cotação</a>` : ""}
                            
                            <div class="escondido" style="display: none;">
                                <div class="contorno_botoes" style="background-color: ${antigoFluxogramaCores[sst.status].cor}">
                                    <img src="imagens/anexo2.png">
                                    <label>Anexo
                                        <input type="file" style="display: none;" onchange="salvar_anexo('${chave}', this)" multiple>  
                                    </label>
                                </div>

                                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                                    ${await carregar_anexos(chave)}
                                </div>

                                <div class="contorno_botoes" onclick="toggle_comentario('comentario_${chave}')" style="background-color: ${antigoFluxogramaCores[sst.status].cor}">
                                    <img src="imagens/comentario.png">
                                    <label>Comentário</label>
                                </div>

                                ${editar}

                                <div id="comentario_${chave}" style="display: none; justify-content: space-evenly; align-items: center;">
                                    <textarea placeholder="Comente algo aqui..."></textarea>
                                    <label class="contorno_botoes" style="background-color: green;" onclick="salvar_comentario('${chave}')">Salvar</label>
                                    <label class="contorno_botoes" style="background-color: #B12425;" onclick="toggle_comentario('comentario_${chave}')">&times;</label>
                                </div>
                                <div id="caixa_comentarios_${chave}" style="display: flex; flex-direction: column;">
                                    ${await carregar_comentarios(chave)}
                                </div>
                            </div>
                            <br>
                        </div>

                        <div style="cursor: pointer; background-color: ${antigoFluxogramaCores[sst.status].cor}; border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; display: flex; align-items: center; justify-content: center;" onclick="exibirItens(this)">
                            <label style="color: white; font-size: 0.9vw;">ver mais</label>
                        </div>

                    </div>

                `
        }

        var pags = ''
        var total_pago = 0

        for (pg in pagamentos_painel) {
            pags += `
                <div style="display: flex; flex-direction: column; align-items: start;">
                    <label style="font-size: 0.7em;"><strong>${pg}</strong></label>
                    <label style="font-size: 1.2em;">${dinheiro(pagamentos_painel[pg])}</label>
                </div>
                `
            if (pg == 'PAGO') {
                total_pago += pagamentos_painel[pg]
            }
        }

        let blocos = ''

        for (div in blocos_por_status) {
            let divisao = blocos_por_status[div]
            blocos += `
                <div style="display: flex; flex-direction: column; justify-content: start; align-items: center; width: 16vw; overflow-y: auto; gap: 10px;">
                    ${divisao}
                </div>
                `
        }

        let opcoes = ''
        for (fluxo in fluxograma) {

            opcoes += `
                <option ${orcamento.status?.atual == fluxo ? 'selected' : ''}>${fluxo}</option>
            `
        }

        let selects = `
        <div style="display: flex; align-items: start; justify-content: center; flex-direction: column; gap: 2px;">
            <label>Status atual</label>
            <select id="select-status-${id_orcam}" data-id-orcamento="${id_orcam}" onchange="alterar_status(this, ${id_orcam})" style="font-size: 1vw; background-color: #d2d2d2; border-radius: 3px; padding: 3px;">
                ${opcoes}
            </select>
        </div>
        `
        acumulado += `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <hr style="width: 100%;">

                    <div style="display: flex;">

                        <div style="display: flex; flex-direction: column; gap: 10px; padding: 3px;">

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">  

                                ${selects}

                            </div>

                            <div style="display: flex; gap: 10px; font-size: 0.9vw;">
                                ${botao_novo_pagamento(id)}
                                ${botao_novo_pedido(id)}
                                <div class="contorno_botoes" style="background-color: #B12425"
                                    onclick="abrirModalTipoRequisicao()">
                                    <label>Nova <strong>Requisição</strong></label>
                                </div>
                                
                                ${(permissao == 'adm' || setor == 'LOGÍSTICA') ? `                                
                                    
                                <div class="contorno_botoes" style="background-color: #b17724"
                                    onclick="envio_de_material(undefined)">
                                    <label>Enviar <strong>Material</strong></label>
                                </div>
                                
                                ` : ''}

                                <div class="contorno_botoes" style="background-color: #ff4500;"
                                    onclick="painel_adicionar_notas()">
                                    <label>Nova <strong>Nota Fiscal</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: #0a989f;"
                                    onclick="iniciar_cotacao('${id}')">
                                    <label>Nova <strong>Cotação</strong></label>
                                </div>

                                ${(permissao == 'adm' || setor == 'LOGÍSTICA') ? `  

                                <div class="contorno_botoes" style="background-color: #aacc14;"
                                    onclick="retorno_de_materiais('${id}')">
                                    <label>Retorno de <strong>Materiais</strong></label>
                                </div>
                                
                                ` : ''}

                                <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                    <img src="gifs/atencao.gif" style="width: 2vw;">
                                    <label style="text-decoration: underline; cursor: pointer;" onclick="deseja_apagar()">
                                        Excluir TODO o Histórico?
                                    </label>
                                </div>                                
                            </div>
                        </div>

                    </div>
                    <div class="container-blocos">
                        ${blocos}
                    </div>
                </div>
            `

    };

    let painel_custos = `

            <div id="overlay_de_custos" style="
            display: none; 
            background-color: rgba(0, 0, 0, 0.7);
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            z-index: 1001;
            border-radius: 3px;"></div>

        <div id="painel_custos" class="contorno_botoes" style="
        resize: both;
        overflow: auto;
        position: absolute; 
        top: 10%; 
        left: 5%; 
        font-size: 1vw; 
        display: none; 
        flex-direction: column; 
        align-items: center; 
        padding: 10px; 
        border-radius: 5px; 
        background-color: #222; 
        color: white;
        z-index: 1002;">

            <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="mostrar_painel()">&times;</span>
            <label>Gestão de Custos</label>
            ${pags}
            <hr style="width: 100%;">
            <label style="font-size: 0.8vw;"> <span id="valor_pedido">0,00</span> <label style="font-size: 0.8vw;">Valor do Pedido</label></label>
            <hr style="width: 100%;">
            <label onclick="valores_manuais()" style="font-size: 0.7vw;">➕ Adicionar Valor Manual</label>

            <div id="lista-valores-manuais">
                ${Object.entries(dados_orcamentos[id].valoresManuais || {}).length > 0
            ? Object.entries(dados_orcamentos[id].valoresManuais).map(([chave, valor]) => `
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-size: 0.8vw">${valor.nomeValorManual}: ${dinheiro(valor.valorManual)}</label>
                                    <button onclick="removerValorManual('${id}', '${chave}')" 
                                        style="background: none; border: none; color: red; cursor: pointer; font-size: 0.8vw;">❌</button>
                                </div>
                            `).join("")
            : "<label style='font-size: 0.8vw; color: gray;'>Nenhum valor manual adicionado.</label>"}
            </div>

            <hr style="width: 100%;">
            <label><span id="valor_total_pedido">0,00</span></label>
        </div>
    `

    let estruturaHtml = `
        <div id="status" style="display: flex; flex-direction: column; gap: 10px; width: 100%; overflow: auto;">
            <div style="max-width: 90%; display: flex; flex-direction: column;">
                ${acumulado}
            </div>

            ${painel_custos}
        </div>
    `

    let status = document.getElementById('status')
    if (status) {
        let janela = status.parentElement // Elemento Janela do status;
        janela.innerHTML = estruturaHtml
    } else {
        openPopup_v2(estruturaHtml, 'Histórico do Orçamento')
    }

    // É só esperar a página incluir os elementos acima, simples... não precisa de timeInterval...
    let totalValoresManuais = somarValoresManuais(dados_orcamentos[id]);
    let totalFinal = conversor(orcamento.total_geral) - totalValoresManuais;
    let valorPedidoSpan = document.getElementById('valor_pedido');
    let valorTotalSpan = document.getElementById('valor_total_pedido');

    if (valorPedidoSpan) {
        valorPedidoSpan.textContent = orcamento.total_geral;
    }

    if (valorTotalSpan) {
        valorTotalSpan.textContent = dinheiro(totalFinal)
    }
}

function mostrar_painel() {
    let painel_custos = document.getElementById('painel_custos')
    let overlay_de_custos = document.getElementById('overlay_de_custos')

    if (painel_custos) {
        if (painel_custos.style.display == 'flex') {
            painel_custos.style.display = 'none'
            overlay_de_custos.style.display = 'none'

        } else {
            painel_custos.style.display = 'flex'
            overlay_de_custos.style.display = 'block'
        }
    }
}

async function mostrar_itens_restantes(id_orcam) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_no_orcamento = orcamento.dados_composicoes
    let valoresTotais = {}

    let acumulado = `

        <table class="tabela">

            <tr>
                <th>Codigo</th>
                <th>Item</th>
                <th>Itens Orçados</th>
                <th>Itens Pendentes</th>
            </tr>

    `

    if (orcamento.status) {

        Object.values(orcamento.status.historico).forEach(item => {

            if (item.status.includes("REQUISIÇÃO")) {

                item.requisicoes.forEach(item2 => {

                    if (valoresTotais[item2.codigo]) {

                        valoresTotais[item2.codigo].qtdeTotal += Number(item2.qtde_enviar);

                    } else {

                        valoresTotais[item2.codigo] = {

                            qtdeTotal: Number(item2.qtde_enviar),
                            codigoRequisicao: item2.codigo

                        }

                    }

                })

            }

        })

    }

    Object.values(itens_no_orcamento).forEach(item => {

        let deduzirTotal = 0

        if (valoresTotais[item.codigo]) {

            deduzirTotal = valoresTotais[item.codigo].qtdeTotal

        }

        acumulado += `
        
            <tr style="border: 1px solid black;">
                <td>${item.codigo}</td>
                <td>${dados_composicoes[item.codigo].descricao}</td>
                <td>${item.qtde}</td>
                <td>${item.qtde - deduzirTotal}</td>
            </tr>

        `

    })

    acumulado += `
    
        </table>
    
    `

    openPopup_v2(acumulado, "Itens Pendentes")

}

function somarValoresPedidos() {
    let total = 0;

    document.querySelectorAll('.valores_pedidos').forEach(input => {
        let valor = input.value.replace(/[^\d,.-]/g, '').replace(',', '.'); // Remove caracteres inválidos
        let numero = parseFloat(valor) || 0;
        total += numero;
    });

    return total;
}

function somarValoresManuais(dados) {
    let totalManuais = 0;

    if (dados.valoresManuais) {
        Object.values(dados.valoresManuais).forEach(valorManual => {
            let valor = parseFloat(valorManual.valorManual) || 0;
            totalManuais += valor;
        });
    }

    return totalManuais;
}

async function atualizar_pedido(chave, campo, img_select) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let orcamento = dados_orcamentos[id_orcam]

    let elemento = campo == 'tipo' ? img_select : img_select.previousElementSibling;

    orcamento.status.historico[chave][campo] = elemento.value

    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/${campo}`, elemento.value)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    campo !== 'tipo' ? img_select.style.display = 'none' : ''
}

function mostrar_botao_pedido(elemento) {
    let img = elemento.nextElementSibling;
    img.style.display = 'block'
}

async function alterar_status(select, id_orcam) {
    tela_orcamentos = id_orcam ? true : false

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    console.log("Dados antes da alteração:", dados_orcamentos);

    const orcamentoExistente = dados_orcamentos[id_orcam];
    if (!orcamentoExistente) {
        dados_orcamentos[id_orcam] = { status: {} };
    }

    // Garantir que o orçamento existe
    if (!dados_orcamentos[id_orcam]) {
        dados_orcamentos[id_orcam] = {};
    }

    // Garantir que a estrutura status existe
    if (!dados_orcamentos[id_orcam].status) {
        dados_orcamentos[id_orcam].status = {};
    }


    dados_orcamentos[id_orcam].status.atual = select.value || {};

    await enviar(`dados_orcamentos/${id_orcam}/status/atual`, select.value);
    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    if (tela_orcamentos) {
        filtrar_orcamentos(undefined, undefined, undefined, true);
        select.parentElement.parentElement.style.display = 'none';
    } else {
        await preencher_orcamentos_v2();
    }
}

function exibirItens(div) {

    let elemento = div.previousElementSibling;
    let label = div.querySelector('label')
    let itens = elemento.querySelectorAll('.escondido');

    itens.forEach(item => {
        let exibir = item.style.display !== 'flex';
        item.style.display = exibir ? 'flex' : 'none';

        exibir ? label.textContent = 'menos' : label.textContent = 'ver mais'

    });
}

async function iniciar_cotacao(id_orcam) {

    document.getElementById("status").insertAdjacentHTML("beforebegin", overlay_aguarde())

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_do_orcamento = dados_orcamentos[id_orcam].dados_composicoes
    let todos_os_status = orcamento.status.historico
    let itens = {} // Dicionário;
    let tem_requisicao = false

    for (chave2 in todos_os_status) {

        let status = todos_os_status[chave2]

        if (String(status.status).includes('REQUISIÇÃO')) {

            if (status.requisicoes) {

                tem_requisicao = true

            }

        }

    }

    if (!tem_requisicao) {

        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Precisa ter uma requisição para criar uma cotação</label>
            </div>
        `)

    }

    for (chave2 in todos_os_status) {
        let his = todos_os_status[chave2]
        if (String(his.status).includes('REQUISIÇÃO')) {

            let requisicao = his.requisicoes

            requisicao.forEach(item => {

                let it = item.codigo

                if (!itens[it]) {
                    itens[it] = {
                        quantidade: 0,
                        estoque: 0,
                        fornecedores: []
                    }
                }

                itens[it].tipoUnitario = dados_composicoes[it] !== undefined ? dados_composicoes[it].unidade : itens_do_orcamento[it].unidade
                itens[it].partnumber = item.partnumber
                itens[it].quantidade += conversor(item.qtde_enviar)
                itens[it].nomeItem = dados_composicoes[it] !== undefined ? dados_composicoes[it].descricao : itens_do_orcamento[it].descricao

            })

            let adicionais = his.adicionais || {}

            for (ad in adicionais) {

                let pais = adicionais[ad]

                if (itens[ad]) {
                    delete itens[ad]
                }

                for (filho in pais) {

                    let pais_e_filhos = pais[filho]

                    if (!itens[filho]) {
                        itens[filho] = {
                            quantidade: 0,
                            estoque: 0,
                            fornecedores: []
                        }
                    }

                    itens[filho].tipoUnitario = pais_e_filhos.unidade
                    itens[filho].partnumber = pais_e_filhos.partnumber
                    itens[filho].quantidade += conversor(pais_e_filhos.qtde)
                    itens[filho].nomeItem = filho

                }

            }

        }
    }

    // Converter dicionário em lista; 

    let itens_em_lista = []
    let i = 1
    for (it in itens) {
        itens[it].numeroItem = i
        itens_em_lista.push(itens[it])
        i++
    }

    // Fim

    let id_compartilhado = gerar_id_5_digitos()
    let data = new Date()
    let nova_cotacao = {
        informacoes: {
            id: id_compartilhado,
            data: data.toLocaleDateString('pt-BR'),
            hora: `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}:${String(data.getSeconds()).padStart(2, '0')}`,
            criador: acesso.usuario,
            apelidoCotacao: orcamento.dados_orcam.cliente_selecionado,
            idOrcamento: id_orcam,
            chavePedido: chave
        },
        dados: itens_em_lista,
        valorFinal: [],
        operacao: 'incluir',
        status: 'Pendente'
    }

    let data_completa = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status.historico[id_compartilhado] = {
        status: 'COTAÇÃO PENDENTE',
        data: data_completa,
        executor: acesso.usuario,
        cotacao: nova_cotacao
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${id_compartilhado}`, orcamento.status.historico[id_compartilhado])
    await enviar(`dados_cotacao/${id_compartilhado}`, nova_cotacao)

    document.getElementById("aguarde").remove()

    await abrir_esquema(id_orcam)

}

async function valores_manuais() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    let acumulado = `

    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif;">

    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">

        <label class="novo_titulo">Gestão de Custos</label>

    </div>
    
    <div style="padding: 20px; border-radius: 8px; text-align: center;">
        <label for="nome-valor-manual" style="display: block; margin-bottom: 5px; font-weight: bold;">Nome do Valor Manual:</label>
        <input type="text" id="nome-valor-manual" placeholder="Digite o nome" 
            style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;">

        <label for="valor-manual" style="display: block; margin-bottom: 5px; font-weight: bold;">Valor Manual:</label>
        <input type="number" id="valor-manual" placeholder="Digite o valor" 
            style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;">

        <button onclick="salvarValorManual()" 
            style="width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
            Salvar
        </button>
    </div>

    </div>

    `

    openPopup_v2(acumulado)

}

async function salvarValorManual() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let nome = document.getElementById("nome-valor-manual").value.trim();
    let valor = document.getElementById("valor-manual").value.trim();

    if (!nome || !valor) {
        openPopup_v2("⚠️ Por favor, preencha todos os campos.");
        return;
    }

    if (!dados_orcamentos[id_orcam].valoresManuais) {
        dados_orcamentos[id_orcam].valoresManuais = {};
    }

    let idValorManual = gerar_id_5_digitos(); // 🔥 Gera um ID único

    dados_orcamentos[id_orcam].valoresManuais[idValorManual] = {
        nomeValorManual: nome,
        valorManual: parseFloat(valor)
    };

    // 🔥 Limpa os inputs após salvar
    document.getElementById("nome-valor-manual").value = "";
    document.getElementById("valor-manual").value = "";

    remover_popup()

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/valoresManuais/${idValorManual}`, dados_orcamentos[id_orcam].valoresManuais[idValorManual]);

    abrir_esquema(id_orcam)

}

async function removerValorManual(id_orcam, idValorManual) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};

    if (!dados_orcamentos[id_orcam]?.valoresManuais || !dados_orcamentos[id_orcam].valoresManuais[idValorManual]) {
        return;
    }

    // 🗑️ Remove o valor manual do objeto
    delete dados_orcamentos[id_orcam].valoresManuais[idValorManual];

    // 🔥 Atualiza o localStorage e envia para a nuvem
    await inserirDados(dados_orcamentos, 'dados_orcamentos');
    await deletar(`dados_orcamentos/${id_orcam}/valoresManuais/${idValorManual}`);

    // 🔄 Atualiza a exibição do orçamento
    abrir_esquema(id_orcam);
}

function calcularResultado(orcamento) {
    if (!orcamento || !orcamento.total_geral) return "Erro nos dados";

    // 🔥 Converte total_geral para número (removendo "R$ " e convertendo vírgula para ponto)
    let totalGeral = parseFloat(orcamento.total_geral.replace("R$ ", "").replace(/\./g, "").replace(",", "."));

    if (isNaN(totalGeral)) return "Erro no total_geral";

    // 🔥 Soma os valores de valoresManuais
    let somaValoresManuais = Object.values(orcamento.valoresManuais || {})
        .reduce((soma, item) => soma + (parseFloat(item.valorManual) || 0), 0);

    // 🔥 Subtrai a soma dos valores manuais do total geral
    let resultadoFinal = totalGeral - somaValoresManuais;

    return resultadoFinal;
}


async function retorno_de_materiais(chave) {

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    let linhas = ''

    Object.values(orcamento.dados_composicoes).forEach(item => {
        linhas += `
        <tr>
            <td data-codigo="${item.codigo}">${dados_composicoes[item.codigo].descricao}</td>
            <td style="text-align: center;">${item.qtde}</td>
            <td><input style="background-color: #4CAF50; padding: 3px; border-radius: 3px;" type="number"></td>
        </tr>
        `
    })

    let acumulado = `
    <table id="tabelaRetornoMateriais" class="tabela" style="width: 50vw;">
        <thead>
            <th>Descrição</th>
            <th>Quantidade Disponivel</th>
            <th>Quantidade para Retorno</th>
        </thead>
        <tbody>
            ${linhas}
        </tbody>
    </table>
    <hr style="width: 80%;">
    <button style="background-color: #4CAF50;" onclick="salvar_materiais_retorno('${chave}')">Salvar</button>
    `
    openPopup_v2(acumulado, 'Retorno de Materiais', true)

}

async function salvar_materiais_retorno(chave) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    let tabelaRetornoMateriais = document.querySelector("#tabelaRetornoMateriais")

    let inputsQtde = tabelaRetornoMateriais.querySelectorAll(".dados_qtde_retorno")
    let tdsDescricao = tabelaRetornoMateriais.querySelectorAll(".dados_descricao_retorno")

    let dadosMateriaisRetorno = {};

    for (let i = 0; i < inputsQtde.length; i++) {
        let codigo = tdsDescricao[i].dataset.codigo; // Obtém o texto da descrição
        let quantidade = Number(inputsQtde[i].value) || 0; // Obtém o valor do input

        dadosMateriaisRetorno[codigo] = quantidade;
    }

    remover_popup()

    let data_completa = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status.historico[chave] = {
        status: 'RETORNO DE MATERIAIS',
        data: data_completa,
        executor: acesso.usuario,
        materiaisRetorno: dadosMateriaisRetorno
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    remover_popup()
    await abrir_esquema(id_orcam)

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, orcamento.status.historico[chave])

}

async function recuperarCotacoes() {
    const resposta = await fetch(
        'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=cotacoes'
    );

    const dados = await resposta.json();

    // Inicializar o objeto para armazenar as cotações
    let cotacoes = {};

    // Transformar a lista de cotações em um objeto com ID como chave
    dados.forEach((cotacao) => {
        const id = cotacao.informacoes.id;
        cotacoes[id] = cotacao;
    });
    localStorage.setItem("dados_cotacao", JSON.stringify(cotacoes));
}

async function registrar_envio_material(chave) {
    var campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario_envio', 'volumes', 'data_saida', 'previsao']
    var status = {
        envio: {}
    }

    campos.forEach(campo => {
        var info = document.getElementById(campo)
        var valor = info.value

        if (info.type == 'number') {
            valor = Number(info.value)
        }

        if (campo == 'comentario_envio') {
            status.comentario = valor
        } else {
            status.envio[campo] = valor
        }
    })

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let historico = dados_orcamentos[id_orcam].status.historico
    let st = 'MATERIAL ENVIADO'

    status.executor = acesso.usuario
    status.data = data_status
    status.status = st

    historico[chave] = status

    remover_popup()
    await abrir_esquema(id_orcam)

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, status)

}

function calcular_quantidades(requisicoes, itens_no_orcamento) {

    if (itens_no_orcamento == undefined) {

        return { cor: '', label_porcentagem: '' }
    }

    var porcentagem = {
        qtde_enviar: 0,
        qtde_orcamento: 0
    }

    if (!dicionario(itens_no_orcamento)) {
        var novo_itens_do_orcamento = {};

        itens_no_orcamento.forEach(it => {

            if (!novo_itens_do_orcamento[it.codigo]) {
                novo_itens_do_orcamento[it.codigo] = it;
            }
        });

        itens_no_orcamento = novo_itens_do_orcamento;
    }

    let totalQtde = Object.values(itens_no_orcamento).reduce((acc, item) => acc + Number(item.qtde), 0);

    totalQtde = conversor(totalQtde)

    porcentagem.qtde_orcamento = totalQtde

    requisicoes.forEach(req => {

        var qtde_enviar = conversor(req.qtde_enviar)

        porcentagem.qtde_enviar += qtde_enviar

    })

    var valor_porcentagem = (porcentagem.qtde_enviar / porcentagem.qtde_orcamento) * 100
    var cor = '#B12425'
    var label_porcentagem = `${valor_porcentagem.toFixed(0)}% Preenchido`

    if (!porcentagem.qtde_enviar || !porcentagem.qtde_orcamento) {
        label_porcentagem = 'Em branco'
    }

    if (valor_porcentagem > 90) {
        cor = 'green'
    } else if (valor_porcentagem > 50) {
        cor = 'orangered'
    } else if (valor_porcentagem > 20) {
        cor = 'orange'
    }

    var infos = {
        label_porcentagem: label_porcentagem,
        cor: cor
    }

    return infos

}

function calcular_quantidades_v2(historico, itens_no_orcamento) {
    let quantidades = {}

    for (chave in historico) {
        if (historico[chave].requisicoes) {
            var requisicoes = historico[chave].requisicoes

            requisicoes.forEach(item => {
                if (!quantidades[item.codigo]) {
                    quantidades[item.codigo] = {
                        qtde_enviar: 0,
                        qtde_orcamento: 0,
                        porcentagem: 0
                    };
                }

                var qtde_enviar = conversor(item.qtde_enviar)
                var qtde_orcamento = conversor(itens_no_orcamento[item.codigo].qtde)
                var porcentagem = qtde_enviar / qtde_orcamento

                quantidades[item.codigo].qtde_enviar += qtde_enviar
                quantidades[item.codigo].qtde_orcamento += qtde_orcamento
                quantidades[item.codigo].porcentagem += porcentagem
            })
        }
    }

    return quantidades
}

function confirmar_exclusao_comentario(id_comentario, chave) {
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Excluir o comentário?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="excluir_comentario('${id_comentario}', '${chave}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

async function excluir_comentario(id_comentario, chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let comentarios = dados_orcamentos[id_orcam].status.historico[chave].comentarios || {}

    delete comentarios[id_comentario]

    remover_popup()
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id_comentario}`)
    await carregar_comentarios(chave)
}

async function carregar_comentarios(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let comentss = ''
    if (dados_orcamentos[id_orcam].status.historico[chave]) {
        let comentarios = dados_orcamentos[id_orcam].status.historico[chave].comentarios || {}

        for (it in comentarios) {
            let item = comentarios[it]
            let excluir = ''

            if (acesso.usuario == item.usuario || acesso.permissao == 'adm') {
                excluir = ` •<label onclick="confirmar_exclusao_comentario('${it}', '${chave}')" style="text-decoration: underline; cursor: pointer;"> Excluir</label>`
            }

            comentss += `
            <div class="anexos2" style="width: 95%; margin: 0px; margin-top: 5px;">
                <label>${item.comentario.replace(/\n/g, '<br>')}
                <br><strong>${item.data} • ${item.usuario}</strong>${excluir}</label>
            </div>
            `
        }
    }

    let div_caixa = document.getElementById(`caixa_comentarios_${chave}`)
    if (div_caixa) {
        div_caixa.innerHTML = comentss
    }

    return comentss
}

async function salvar_comentario(chave) {
    toggle_comentario(`comentario_${chave}`)
    let id_div = `comentario_${chave}`
    let textarea = document.getElementById(id_div).querySelector('textarea')
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]

    var id = gerar_id_5_digitos()

    var comentario = {
        id: id,
        comentario: textarea.value,
        data: data_atual('completa'),
        usuario: acesso.usuario
    }

    let cartao = orcamento.status.historico[chave]
    if (!cartao.comentarios) {
        cartao.comentarios = {}
    }

    cartao.comentarios[id] = comentario

    textarea.value = ''

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/comentarios/${id}`, comentario)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await carregar_comentarios(chave)
}

function toggle_comentario(id) {
    var elemento = document.getElementById(id)
    if (elemento.style.display == 'none') {
        elemento.style.display = 'flex'
    } else {
        elemento.style.display = 'none'
    }
}

function pesquisar_pagamentos(input) {
    let div_do_input = input.parentElement
    let div_pagamentos = div_do_input.nextElementSibling
    let todos_os_pagamentos = div_pagamentos.querySelector('.escondido')
    let pesquisa = String(input.value).toLowerCase()

    if (todos_os_pagamentos) {
        var divs = todos_os_pagamentos.querySelectorAll('div')

        divs.forEach(div => {
            var mostrar = false
            var labels = div.querySelectorAll('label')

            labels.forEach(label => {
                if (label.textContent.toLocaleLowerCase().includes(pesquisa) || pesquisa == '') {
                    mostrar = true
                }
            })

            if (mostrar) {
                div.style.display = 'flex'
            } else {
                div.style.display = 'none'
            }
        })
    }
}

async function excluir_anexo(chave, id_anexo, img) {

    remover_popup()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    delete dados_orcamentos[id_orcam].status.historico[chave].anexos[id_anexo]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    deletar(`dados_orcamentos/${id_orcam}/status/historico/anexos/${id_anexo}`)

    img.parentElement.remove()

}

async function chamar_duplicar(id) {
    duplicar(id)
}

async function chamar_editar(id) {
    editar(id)
}

async function chamar_excluir(id) {
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Deseja realmente excluir o orçamento?</label>
        </div>
        <button style="background-color: green;" onclick="apagar('${id}')">Confirmar</button>
        `)
}

async function detalhar_requisicao(chave, editar, tipoRequisicao) {

    let seEditar = editar

    let visualizar = (editar || !chave) ? false : true

    if (!chave) {
        chave = gerar_id_5_digitos()
    }

    itens_adicionais = {}
    var usuario = acesso.usuario
    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    orcamento = dados_orcamentos[id_orcam];

    var requisicao = {}
    var menu_flutuante = ''
    var nome_cliente = orcamento.dados_orcam.cliente_selecionado
    let valoresTotais = {}

    if (editar == undefined && tipoRequisicao != undefined) {

        Object.values(orcamento.status?.historico || {}).forEach(item => {

            if (item.status.includes("REQUISIÇÃO")) {

                item.requisicoes.forEach(item2 => {


                    if (requisicao[item2.codigo]) {

                        requisicao[item2.codigo].qtde_enviar += Number(item2.qtde_enviar);

                    } else {

                        requisicao[item2.codigo] = {
                            partnumber: item2.partnumber,
                            requisicao: item2.requisicao,
                            tipo: item2.tipo,
                            qtde_enviar: Number(item2.qtde_enviar)
                        }

                    }

                })

            }

        })

    } else {

        Object.values(orcamento.status.historico).forEach(item => {

            if (item.status.includes("REQUISIÇÃO")) {

                item.requisicoes.forEach(item2 => {

                    if (valoresTotais[item2.codigo]) {

                        valoresTotais[item2.codigo].qtdeTotal += Number(item2.qtde_enviar);

                    } else {

                        valoresTotais[item2.codigo] = {

                            qtdeTotal: Number(item2.qtde_enviar),
                            codigoRequisicao: item2.codigo

                        }

                    }

                })

            }

        })


    }

    if (chave && orcamento.status && orcamento.status.historico && orcamento.status.historico[chave]) {
        let cartao = orcamento.status.historico[chave]
        menu_flutuante = `
        <div class="menu_flutuante" id="menu_flutuante">
            <div class="icone" onclick="gerarpdf('${orcamento.dados_orcam.cliente_selecionado}', '${cartao.pedido}')">
                <img src="imagens/pdf.png">
                <label>PDF</label>
            </div>
        </div> 
        `

        if (cartao.adicionais) {
            itens_adicionais = cartao.adicionais
        }

        if (cartao.requisicoes) {
            cartao.requisicoes.forEach(item => {
                requisicao[item.codigo] = {
                    partnumber: item.partnumber,
                    requisicao: item.requisicao,
                    tipo: item.tipo,
                    qtde_enviar: item.qtde_enviar
                }
            })
        }

    }

    var campos = ''
    var toolbar = ''

    if (!visualizar) {
        toolbar += `
    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; background-color: #151749; border-top-left-radius: 5px; border-top-right-radius: 5px">
        <img src="imagens/pesquisar.png" style="width: 25px; height: 25px; padding: 5px;">
        <input id="pesquisa1" style="padding: 10px; border-radius: 5px; margin: 10px; width: 50%;" placeholder="Pesquisar" oninput="pesquisar_na_requisicao()">
        <button class="botao-coluna" onclick="toggleColuna('valor_unitario')" style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; margin: 0 5px;">Ocultar Val. Unit.</button>
        <button class="botao-coluna" onclick="toggleColuna('valor_total')" style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; margin: 0 5px;">Ocultar Val. Total</button>
        <button class="botao-coluna" onclick="adicionarColunasCompra()" style="padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; margin: 0 5px;">Adicionar Análise</button>
    </div>
    `
        
        campos = `
        <div class="contorno" style="width: 500px;">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados da Requisição</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                
                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Data</strong> </label> <label id="data_status">${data}</label>
                </div>

                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Executor</strong> </label> <label id="usuario_status">${usuario}</label>
                </div>

                <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                    <label><strong>Comentário</strong></label>
                    <textarea rows="3" id="comentario_status" style="width: 80%;"></textarea>
                </div>

                <label class="contorno_botoes" style="background-color: #4CAF50; " onclick="salvar_requisicao('${chave}')">Salvar Requisição</label>
            </div>
        </div>
        `
    }

    var acumulado = `
    ${menu_flutuante}

    <div style="display: flex; align-items: center; justify-content: center; width: 100%; background-color: #151749; border-radius: 3px;">
        <img src="https://i.imgur.com/AYa4cNv.png" 
    style="height: 100px;">
    </div>

    <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
        <h1>REQUISIÇÃO DE COMPRA DE MATERIAL</h1>
    </div>

    <div style="display: flex; justify-content: left; align-items: center; margin: 10px;">

        ${campos}
            
        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados do Cliente</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <label style="color: #222" id="nome_cliente"><strong>Cliente</strong> ${nome_cliente}</label>
                <label style="display: none" id="id_orcam"></label>
                <label style="color: #222"><strong>CNPJ</strong> ${orcamento.dados_orcam.cnpj}</label>
                <label style="color: #222"><strong>Endereço</strong> ${orcamento.dados_orcam.bairro}</label>
                <label style="color: #222"><strong>Cidade</strong> ${orcamento.dados_orcam.cidade}</label>
                <label style="color: #222"><strong>Estado</strong> ${orcamento.dados_orcam.estado}</label>
                <label style="color: #222"><strong>Chamado</strong> ${orcamento.dados_orcam.contrato}</label>
                <label style="color: #222"><strong>Condições</strong> ${orcamento.dados_orcam.condicoes}</label>
            </div>
        </div>

        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">Total</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <div style="display: flex; gap: 10px;">
                    <label id="total_s_icms"></label>
                    <label style="font-size: 0.8em;"> <strong>Líquido (s/Icms)</strong> </label> 
                </div>
                <div style="display: flex; gap: 10px; color: red;">
                    <label id="total_c_icms"></label> 
                    <label style="font-size: 0.8em;"><strong>(c/Icms)</strong></label>
                </div>
            </div>
        </div>

    </div>

    <div id="tabela_itens" style="width: 100%; display: flex; flex-direction: column; align-items: left;">

    <div class="contorno">
        ${toolbar}
        <table class="tabela" id="tabela_requisicoes" style="width: 100%; font-size: 0.8em; table-layout: auto; border-radius: 0px;">
            <thead>
                <th style="text-align: center;">Código</th>
                <th style="text-align: center;">PART NUMBER</th>
                <th style="text-align: center;">Informações do Item</th>                        
                <th style="text-align: center;">Tipo</th>         
                <th style="text-align: center;">Quantidade</th>
                <th style="text-align: center;">Valor Unitário</th>     
                <th style="text-align: center;">Valor Total</th>
                <th style="text-align: center; display: none">Valor de Compra</th>
                <th style="text-align: center; display: none">Total de Compra</th>
                <th style="text-align: center; display: none">Resultado</th>         
                <th style="text-align: center;">Requisição</th>
            </thead>
            <tbody>
                ${await carregar_itens(visualizar, requisicao, itens_adicionais, tipoRequisicao, seEditar, valoresTotais)}
            </tbody>
        </table>
    <div>
    `

    openPopup_v2(acumulado, 'Requisição', true)

    await calcular_requisicao()
    mostrar_itens_adicionais()
}

function toggleColuna(tipo) {
    const tabela = document.getElementById('tabela_requisicoes');
    const cabecalhos = tabela.getElementsByTagName('th');
    const linhas = tabela.getElementsByTagName('tr')

    //Encontrar o índice da coluna
    let indice =-1
    for (let i=0; i < cabecalhos.length; i++) {
        if ((tipo === 'valor_unitario' && cabecalhos[i].textContent.includes('Valor Unitário')))
        {
            indice = i;
            break;
        } else if (tipo ===  'valor_total' && cabecalhos[i].textContent.includes('Valor Total'))
        {
            indice = i;
            break;
        }
    }

    if (indice === -1) return

    //Alternar visibilidade
    const botao = event.target;
    const escondido = botao.textContent.startsWith('Ocultar')

    //Atualizar texto do botão
    botao.textContent = escondido ?
    (tipo === 'valor_unitario' ? 'Mostrar Val. Unit.' : 'Mostrar Val. Total') :
    (tipo === 'valor_unitario' ? 'Ocultar Val. Unit' : 'Ocultar Val. Total');

    //Mostrar/Ocultar coluna
    for (let i = 0; i < linhas.length; i++) {
        const celulas = linhas[i].cells;
        if (celulas.length > indice) {
            celulas[indice].style.display = escondido ? 'none' : '';
        }
    }

}



function adicionarColunasCompra() {

    
    const tabela = document.getElementById('tabela_requisicoes');

    //Verifica se a tabela existe
    if (!tabela) {
        const popups = document.querySelectorAll('.janela')
        for (let popup of popups) {
            tabela = popup.querySelector('#tabela_requisicoes')
            if (tabela) break
        }
    }

    if (!tabela) {
        console.error('Tabela não encontrada. Elementos disponíveis:', 
                     document.querySelectorAll('table'));
        alert('A tabela de requisições não foi carregada corretamente. Tente novamente.');
        return;
    }
    const cabecalhos = tabela.querySelectorAll('th');
    const linhas = tabela.querySelectorAll('tr');
    
    // Índices das colunas originais
    const INDICE_VALOR_UNITARIO = 5; // Coluna "Valor Unitário"
    const INDICE_VALOR_TOTAL = 6;    // Coluna "Valor Total"
    const INDICE_REQUISICAO = 7;     // Coluna "Requisição" (original)
    
    // Verificar se as colunas já estão visíveis
    const colunasVisiveis = cabecalhos.length > 10; // Se já tiver mais de 10 colunas, significa que as de análise já foram adicionadas
    
    if (colunasVisiveis) {
        // Se as colunas estão visíveis, ocultá-las
        // Remove as colunas de análise (7, 8, 9)
        cabecalhos.forEach((th, index) => {
            if (index >= 7 && index <= 9) {
                th.remove();
            }
        });
        
        linhas.forEach((linha, index) => {
            if (index === 0) return; // Pular cabeçalho
            
            const celulas = linha.cells;
            if (celulas.length > 9) {
                // Remove as células de análise (7, 8, 9)
                celulas[9].remove();
                celulas[8].remove();
                celulas[7].remove();
            }
        });
        
        event.target.textContent = 'Adicionar Análise';
    } else {
        // Se as colunas estão ocultas, adicioná-las ANTES da coluna de Requisição
        
        // 1. Adicionar cabeçalhos
        const thead = tabela.querySelector('thead');
        if (!thead) {
            console.error('Cabeçalho da tabela não encontrado');
            return
        }
        const headerRow = thead.querySelector('tr');
        if (!headerRow) {
            console.error('Linha do cabeçalho não encontrada');
            return
            
        }
        
        // Criar novos cabeçalhos
        const headerValorCompra = document.createElement('th');
        headerValorCompra.textContent = 'Valor de Compra';
        headerValorCompra.style.textAlign = 'center';
        
        const headerTotalCompra = document.createElement('th');
        headerTotalCompra.textContent = 'Total de Compra';
        headerTotalCompra.style.textAlign = 'center';
        
        const headerResultado = document.createElement('th');
        headerResultado.textContent = 'Resultado';
        headerResultado.style.textAlign = 'center';
        
        // Inserir antes da coluna de Requisição (índice 7)
        headerRow.insertBefore(headerResultado, headerRow.children[7]);
        headerRow.insertBefore(headerTotalCompra, headerRow.children[7]);
        headerRow.insertBefore(headerValorCompra, headerRow.children[7]);
        
        // 2. Adicionar células nas linhas de dados
        linhas.forEach((linha, index) => {
            if (index === 0) return; // Pular cabeçalho
            
            const celulas = linha.cells;
            
            // Criar novas células
            const cellValorCompra = document.createElement('td');
            cellValorCompra.style.textAlign = 'center';
            
            const inputValorCompra = document.createElement('input');
            inputValorCompra.type = 'number';
            inputValorCompra.style.width = '80px';
            inputValorCompra.classList.add('pedido');
            inputValorCompra.oninput = function() { calcularComparacao(this); };
            cellValorCompra.appendChild(inputValorCompra);
            
            const cellTotalCompra = document.createElement('td');
            cellTotalCompra.style.textAlign = 'center';
            
            const cellResultado = document.createElement('td');
            cellResultado.style.textAlign = 'center';
            
            // Inserir antes da coluna de Requisição (índice 7)
            linha.insertBefore(cellResultado, celulas[7]);
            linha.insertBefore(cellTotalCompra, celulas[7]);
            linha.insertBefore(cellValorCompra, celulas[7]);
        });
        
        event.target.textContent = 'Ocultar Análise';
    }
}

function ocultarColunasCompra () {
    const tabela = document.getElementById('tabela_requisicoes');
    const cabecalhos = tabela.getElementsByTagName('th');
    
    // Índices das colunas relevantes
    const COL_VALOR_COMPRA = 7;
    const COL_TOTAL_COMPRA = 8;
    const COL_RESULTADO = 9;
    
    // Ocultar colunas
    cabecalhos[COL_VALOR_COMPRA].style.display = 'none';
    cabecalhos[COL_TOTAL_COMPRA].style.display = 'none';
    cabecalhos[COL_RESULTADO].style.display = 'none';
    
    // Ocultar células nas linhas
    const linhas = tabela.getElementsByTagName('tr');
    for (let i = 1; i < linhas.length; i++) {
        const celulas = linhas[i].cells;
        if (celulas.length > COL_RESULTADO) {
            celulas[COL_VALOR_COMPRA].style.display = 'none';
            celulas[COL_TOTAL_COMPRA].style.display = 'none';
            celulas[COL_RESULTADO].style.display = 'none';
        }
    }
    
    // Atualizar texto do botão
    const botao = event.target;
    botao.textContent = 'Adicionar Análise';
    botao.onclick ="setTimeout(() => { adicionarColunasCompra(),100)";

}


function calcularComparacao(inputElement) {
    const linha = inputElement.closest('tr');
    const celulas = linha.cells;
    
    // Índices das colunas (agora fixos, pois as colunas são adicionadas/removidas dinamicamente)
    const INDICE_QUANTIDADE = 4;        // Coluna "Quantidade"
    const INDICE_VALOR_TOTAL = 6;       // Coluna "Valor Total"
    const INDICE_VALOR_COMPRA = 7;      // Coluna "Valor de Compra" (nova)
    const INDICE_TOTAL_COMPRA = 8;      // Coluna "Total de Compra" (nova)
    const INDICE_RESULTADO = 9;         // Coluna "Resultado" (nova)
    
    
    // Obter valores
    const quantidadeText = celulas[INDICE_QUANTIDADE].querySelector('input') ?
                        celulas[INDICE_QUANTIDADE].querySelector('input').value :
                        celulas[INDICE_QUANTIDADE].textContent
    const quantidade = parseFloat(quantidadeText) || 0;
    const valorTotalText = celulas[INDICE_VALOR_TOTAL].textContent;
    const valorTotal = parseFloat(valorTotalText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    const valorCompra = parseFloat(inputElement.value) || 0;
    
    // Calcular total de compra
    const totalCompra = quantidade * valorCompra;
    celulas[INDICE_TOTAL_COMPRA].textContent = dinheiro(totalCompra);
    
    // Calcular resultado (diferença entre valor total e total de compra)
    const resultado = valorTotal - totalCompra;
    const resultadoCell = celulas[INDICE_RESULTADO];
    resultadoCell.textContent = dinheiro(resultado);
    
    // Aplicar formatação
    if (resultado > 0) {
        resultadoCell.style.color = 'green';
        resultadoCell.style.fontWeight = 'bold';
    } else if (resultado < 0) {
        resultadoCell.style.color = 'red';
        resultadoCell.style.fontWeight = 'bold';
    } else {
        resultadoCell.style.color = '';
        resultadoCell.style.fontWeight = '';
    }
}


function close_chave() {
    exibir_todos_os_status(id_orcam)
    document.getElementById('alerta').remove()
}

async function salvar_anexo(chave, input) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (input.files.length === 0) {
        openPopup_v2('Nenhum arquivo selecionado...');
        return;
    }

    let anexos = await anexo_v2(input) // Retorna uma lista [{}, {}]

    anexos.forEach(anexo => {

        if ((dados_orcamentos[id_orcam].status.historico[chave].anexos && Array.isArray(dados_orcamentos[id_orcam].status.historico[chave].anexos) || !dados_orcamentos[id_orcam].status.historico[chave].anexos)) {
            dados_orcamentos[id_orcam].status.historico[chave].anexos = {};
        }

        let id = gerar_id_5_digitos()

        dados_orcamentos[id_orcam].status.historico[chave].anexos[id] = anexo
        enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}/anexos/${id}`, anexo)
    })

    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    let div = input.parentElement.parentElement.nextElementSibling // input > label > div pai > div seguinte;

    div.innerHTML = await carregar_anexos(chave)

}

async function carregar_anexos(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let anexos_divs = ''
    let anexos = orcamento.status.historico[chave]?.anexos || {}

    if (anexos) {

        for (id in anexos) {
            var anexo = anexos[id]
            anexos_divs += criarAnexoVisual(anexo.nome, anexo.link, `excluir_anexo('${chave}', '${id}', this)`)
        }
    }

    return anexos_divs

}

function deseja_apagar(chave) {

    let funcao = chave ? `apagar_status_historico('${chave}')` : `apagar_status_historico()`

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 2vw;">
            <label>Deseja apagar essa informação?</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button style="background-color: green" onclick="${funcao}">Confirmar</button>
            </div>
        </div>
        `, 'Aviso', true)
}

async function apagar_status_historico(chave) {

    remover_popup()
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (!chave) {
        delete dados_orcamentos[id_orcam].status.historico
        await deletar(`dados_orcamentos/${id_orcam}/status/historico`)
    } else {
        delete dados_orcamentos[id_orcam].status.historico[chave]
        await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await abrir_esquema(id_orcam)
}

function deseja_apagar_cotacao(chave) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <label>Deseja apagar essa informação?</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button style="background-color: green" onclick="apagar_status_historico_cotacao('${chave}')">Confirmar</button>
            </div>
        </div>
        `)

}

async function apagar_status_historico_cotacao(chave) {

    remover_popup()
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (!chave) {
        delete dados_orcamentos[id_orcam].status.historico
        await deletar(`dados_orcamentos/${id_orcam}/status/historico`)
    } else {
        delete dados_orcamentos[id_orcam].status.historico[chave]
        await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)
    }

    await deletar(`dados_cotacao/${chave}`);

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await abrir_esquema(id_orcam)

}

function remover_cotacao(chave) {
    let status = "excluido";
    let operacao = "excluir";
    let idCotacao = chave

    const cotacaoParaExcluir = { operacao, status, idCotacao };

    const payload = {
        tabela: "cotacoes",
        cotacao: cotacaoParaExcluir,
    };

    enviar_dados_generico(payload);
}

async function atualizar_partnumber(dicionario) {
    for (codigo in dicionario) {
        let partnumber = dicionario[codigo]
        await enviar(`dados_composicoes/${codigo}/partnumber`, partnumber)
    }
}

function getComputedStylesAsText(element) {
    const computedStyles = window.getComputedStyle(element);
    let styleText = "";
    for (let property of computedStyles) {
        styleText += `${property}: ${computedStyles.getPropertyValue(property)}; `;
    }
    return styleText;
}

const { ipcRenderer } = require('electron');

ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {
    ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });
});

async function gerarpdf(cliente, pedido) {

    var janela = document.querySelectorAll('.janela')
    janela = janela[janela.length - 1]

    var htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <style>
        body {
            font-family: 'Poppins', sans-serif;
        }
        .titulo {
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #151749;
            padding: 10px;
            font-size: 1.5em;
            color: white;
            height: 20px;
        }
        .contorno {
            border-radius: 5px;
            height: max-content;
            border: 1px solid #151749;
            padding: 5px;
            margin: 5px;
        }
            
        .tabela {
            border-collapse: collapse;
            border-radius: 5px;
            overflow: hidden;
        }
        
        .tabela th {
            background-color: #151749;
            color: white;
        }

        .tabela th, .tabela td {
            margin: 5px;
            text-align: left;
        }

        .tabela td {
            background-color: #99999940;
        }

        label {
            margin: 5px;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            header,
            footer {
                display: none !important;
            }

            .table-container {
                margin-right: 0;
            }
        }
        </style>
    </head>
    <body>
        ${janela.innerHTML}
    </body>
    </html>`;

    if (pedido.includes("?")) {
        pedido = ""
    }

    await gerar_pdf_online(htmlContent, `REQUISICAO_${cliente}_${pedido}`);

}

async function envio_de_material(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let envio = {}
    let comentario = ''
    if (chave !== undefined) {
        envio = orcamento.status.historico[chave].envio
        comentario = orcamento.status.historico[chave].comentario
    } else {
        chave = gerar_id_5_digitos()
    }

    let transportadoras = ['JAMEF', 'CORREIOS', 'RODOVIÁRIA', 'JADLOG', 'AÉREO', 'OUTRAS']
    let opcoes_transportadoras = ''

    transportadoras.forEach(transp => {
        let marcado = envio.transportadora == transp ? 'selected' : ''
        opcoes_transportadoras += `
            <option ${marcado}>${transp}</option>
        `
    })

    var acumulado = `
    <div id="painel_envio_de_material">

        <div class="pergunta">
            <label>Número de rastreio</label>
            <input id="rastreio" value="${envio?.rastreio || ""}">
        </div>

        <div class="pergunta">
            <label>Transportadora</label>
            <select id="transportadora">
                ${opcoes_transportadoras}
            </select>
        </div>

        <div class="pergunta">
            <label>Custo do Frete</label>
            <input type="number" id="custo_frete" value="${envio.custo_frete}">
        </div>

        <div class="pergunta">
            <label>Nota Fiscal</label>
            <input id="nf" value="${envio.nf || ""}">
        </div>

        <div class="pergunta">
            <label>Comentário</label>
            <textarea id="comentario_envio" style="border: none; width: 152px; height: 70px;">${comentario}</textarea>
        </div>

        <div class="pergunta">
            <label>Quantos volumes?</label>
            <input type="number" id="volumes" value="${envio.volumes}">
        </div>

        <div class="pergunta">
            <label>Data de Saída</label>
            <input type="date" id="data_saida" value="${envio.data_saida}">
        </div>

        <div class="pergunta">
            <label>Data de Entrega</label>
            <input type="date" id="previsao" value="${envio.previsao}">
        </div>

        <hr style="width: 80%;">

        <button style="background-color: #4CAF50; margin: 0px;" onclick="registrar_envio_material('${chave}')">Salvar</button>
      
    </div>
    `
    openPopup_v2(acumulado, 'Envio de Material', true)
}



async function mostrar_painel() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let pags = ''
    let total_pago = 0

    let pagamentos_painel = {}

    for (pg in pagamentos_painel) {
        pags += `
            <div style="display: flex; flex-direction: column; align-items: start;">
                <label style="font-size: 0.7em;"><strong>${pg}</strong></label>
                <label style="font-size: 1.2em;">${dinheiro(pagamentos_painel[pg])}</label>
            </div>
            `
        if (pg == 'PAGO') {
            total_pago += pagamentos_painel[pg]
        }
    }

    let linhas = {
        SERVIÇO: {
            orcamento: '',
            impostos: '',
            total_custo: 0,
            total_orcado: 0,
            total_impostos: 0,
            total_lucro_liquido: 0
        },
        VENDA: {
            orcamento: '',
            impostos: '',
            total_custo: 0,
            total_orcado: 0,
            total_impostos: 0,
            total_lucro: 0
        }
    }

    for (id in orcamento.dados_composicoes) {
        let produto = dados_composicoes[id]

        // Verificar se produto existe antes de continuar
        if (!produto) {
            console.warn(`Produto com ID ${id} não encontrado em dados_composicoes`);
            continue; // Pula para a próxima iteração do loop
        }

        let lpu = orcamento.lpu_ativa.toLowerCase()
        let tabela = produto && produto[lpu]
        let qtde = orcamento.dados_composicoes[id].qtde
        let cotacao = tabela?.historico[tabela?.ativo]

        let custo_unit = cotacao?.valor_custo || 0
        let custo_total = custo_unit * qtde

        let vl_unit = cotacao?.valor || 0
        let total = vl_unit * qtde
        let lucro_unit = total - custo_total

        let descricao_produto = dados_composicoes[produto.codigo]?.descricao || 'Item sem descrição'

        // Agora podemos acessar produto.tipo com segurança
        linhas[produto.tipo].total_custo += custo_total
        linhas[produto.tipo].total_orcado += total
        linhas[produto.tipo].total_lucro += lucro_unit

        linhas[produto.tipo].orcamento += `
        <tr>
            <td style="font-size: 0.9em;">${descricao_produto}</td>
            <td style="font-size: 0.9em;">${qtde}</td>
            ${produto.tipo == 'VENDA' ? `
            <td style="font-size: 0.9em;">${cotacao?.margem || '--'}</td>
            ` : ''}
            <td style="font-size: 0.9em;">${dinheiro(vl_unit)}</td>
            <td style="font-size: 0.9em;">${dinheiro(total)}</td>
            ${produto.tipo == 'VENDA' ? `
            <td style="font-size: 0.9em;">${dinheiro(lucro_unit)}</td>
            ` : ''}
        </tr>
    `
    }

    let porcentagem_icms = orcamento.dados_orcam.estado == 'BA' ? 0.205 : 0.12

    let aliq_lp_venda = linhas.VENDA.total_orcado * 0.08
    let aliq_presuncao_venda = linhas.VENDA.total_orcado * 0.12
    let irpj_venda = aliq_lp_venda * 0.15
    let ad_irpj_venda = aliq_lp_venda * 0.10
    let csll_venda = aliq_presuncao_venda * 0.09
    let pis_venda = linhas.VENDA.total_orcado * 0.0065
    let cofins_venda = linhas.VENDA.total_orcado * 0.03
    let icms = linhas.VENDA.total_orcado * porcentagem_icms
    linhas.VENDA.total_impostos = irpj_venda + ad_irpj_venda + csll_venda + pis_venda + cofins_venda + icms

    linhas.VENDA.impostos = `

        <label>Impostos de Venda</label>
        <table class="tabela">
            <thead style="background-color:rgb(185, 0, 0);">
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Presunções dos Impostos de Saída</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Percentuais</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td style="font-size: 0.7em;">Aliquota do Lucro Presumido Comercio "Incide sobre o valor de Venda do Produto"</td>
                    <td><input style="font-size: 0.9em;" value="8%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(aliq_lp_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">Alíquota da Presunção CSLL (Incide sobre o valor de venda do produto)</td>
                    <td><input style="font-size: 0.9em;" value="12%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(aliq_presuncao_venda)}</td>
                </tr>
            </tbody>
        </table>
        <br>
        <table class="tabela">
            <thead style="background-color:rgb(185, 0, 0);">
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Impostos a Serem Pagos</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Percentuais</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td style="font-size: 0.7em;">O Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input style="font-size: 0.9em;" value="15%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(irpj_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">Adicional do Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input style="font-size: 0.9em;" value="10%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(ad_irpj_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">CSLL a ser Pago (9%) da Presunção</td>
                    <td><input style="font-size: 0.9em;" value="9%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(csll_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">O Programa de Integração Social (PIS) (0,65%) do faturamento</td>
                    <td><input style="font-size: 0.9em;" value="0.65%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(pis_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">A Contribuição para o Financiamento da Seguridade Social (COFINS) (3%) do faturamento</td>
                    <td><input style="font-size: 0.9em;" value="3%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(cofins_venda)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">O Imposto sobre Circulação de Mercadorias e Serviços (ICMS) (${(porcentagem_icms * 100).toFixed(1)}%) do faturamento</td>
                    <td><input style="font-size: 0.9em;" value="${(porcentagem_icms * 100).toFixed(1)}%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(icms)}</td>
                </tr>
                <tr style="background-color: #535151;">
                    <td></td>
                    <td style="font-size: 1em;">Total</td>
                    <td style="font-size: 0.9em;">${dinheiro(linhas.VENDA.total_impostos)}</td>
                </tr>                                                                               
            </tbody>
        </table>
        `

    let aliq_lucro_presumido = linhas.SERVIÇO.total_orcado * 0.32
    let aliq_presuncao = linhas.SERVIÇO.total_orcado * 0.32

    let irpj = aliq_presuncao * 0.15
    let ad_irpj = aliq_presuncao * 0.10
    let csll_presuncao = aliq_presuncao * 0.09
    let pis = linhas.SERVIÇO.total_orcado * 0.0065
    let cofins = linhas.SERVIÇO.total_orcado * 0.03
    let iss = linhas.SERVIÇO.total_orcado * 0.05
    linhas.SERVIÇO.total_impostos = irpj + ad_irpj + csll_presuncao + pis + cofins + iss

    linhas.SERVIÇO.impostos = `

        <label>Impostos de Serviço</label>
        <table class="tabela">
            <thead style="background-color:rgb(0, 138, 0);">
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Presunções dos Impostos de Saída</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Percentuais</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td style="font-size: 0.7em;">Aliquota do Lucro Presumido Comercio "Incide sobre o valor de Venda do Produto"</td>
                    <td style="text-align: center; font-size: 0.9em;">32%</td>
                    <td style="font-size: 0.9em;">${dinheiro(aliq_lucro_presumido)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">Alíquota da Presunção CSLL (Incide sobre o valor de venda do produto)</td>
                    <td style="text-align: center; font-size: 0.9em;">32%</td>
                    <td style="font-size: 0.9em;">${dinheiro(aliq_presuncao)}</td>
                </tr>
            </tbody>
        </table>
        <br>
        <table class="tabela">
            <thead style="background-color:rgb(0, 138, 0);">
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Impostos a Serem Pagos</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Percentuais</th>
                <th style="font-size: 0.8em; color: rgb(236, 236, 236);">Valor</th>
            </thead>
            <tbody>
                <tr>
                    <td style="font-size: 0.7em;">O Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input style="font-size: 0.9em;" value="15%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(irpj)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">Adicional do Imposto de Renda da Pessoa Jurídica (IRPJ) (Incide sobre a presunção de 8%)</td>
                    <td><input style="font-size: 0.9em;" value="10%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(ad_irpj)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">CSLL a ser Pago (9%) da Presunção</td>
                    <td><input style="font-size: 0.9em;" value="9%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(csll_presuncao)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">O Programa de Integração Social (PIS) (0,65%) do faturamento</td>
                    <td><input style="font-size: 0.9em;" value="0.65%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(pis)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">A Contribuição para o Financiamento da Seguridade Social (COFINS) (3%) do faturamento</td>
                    <td><input style="font-size: 0.9em;" value="3%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(cofins)}</td>
                </tr>
                <tr>
                    <td style="font-size: 0.7em;">O Imposto Sobre Serviços ( ISS )(5%) (Incide sobre o faturamento)</td>
                    <td><input style="font-size: 0.9em;" value="5%" readOnly></td>
                    <td style="font-size: 0.9em;">${dinheiro(iss)}</td>
                </tr>                
                <tr style="background-color: #535151;">
                    <td></td>
                    <td style="font-size: 1em;">Total</td>
                    <td style="font-size: 0.9em;">${dinheiro(linhas.SERVIÇO.total_impostos)}</td>
                </tr>                                                                               
            </tbody>
        </table>
        `

    let tabelas = ''
    let impostos = ''
    let total_custos = ''

    for (tipo in linhas) {
        let tab = linhas[tipo]

        if (tab.orcamento != '') {

            tabelas += `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                        <label>${tipo}</label>
                        <table class="tabela">
                            <thead style="${tipo == 'SERVIÇO' ? 'background-color:rgb(0, 138, 0);' : 'background-color:rgb(185, 0, 0);'}">
                                <th style="color: #fff; font-size: 0.9em;">Descrição</th>
                                <th style="color: #fff; font-size: 0.9em;">Quantidade</th>
                                ${tipo == 'VENDA' ? `
                                    <th style="color: #fff; font-size: 0.9em;">Margem</th>
                                ` : ''}
                                <th style="color: #fff; font-size: 0.9em;">Valor de ${tipo.toLocaleLowerCase()} Unit</th>
                                <th style="color: #fff; font-size: 0.9em;">Total de ${tipo.toLocaleLowerCase()}</th>
                                ${tipo == 'VENDA' ? `
                                    <th style="color: #fff; font-size: 0.9em;">Lucro Total</th>
                                ` : ''}
                            </thead>
                            <tbody>
                                ${tab.orcamento}
                                <tr style="background-color: #535151;">
                                    ${tipo == 'VENDA' ? `
                                    <td></td>
                                    <td></td>
                                    <td></td>`
                    : ''}

                                    ${tipo == 'SERVIÇO' ? `
                                    <td style="font-size: 1em; font-weight: 600;">Lucro de serviço</td>
                                    <td style="font-size: 0.9em; font-weight: 600;">${dinheiro(tab.total_orcado - linhas.SERVIÇO.total_impostos)}</td>`
                    : ''}
                                    <td></td>
                                    <td style="font-size: 0.9em; font-weight: 600;">${dinheiro(tab.total_orcado)}</td>

                                    ${tipo == 'VENDA' ? `
                                    <td style="font-size: 0.9em; font-weight: 600;">${dinheiro(tab.total_lucro)}</td>`
                    : ''}
                                </tr>
                            </tbody>

                        </table>
                    </div>
                </div>

            `
            impostos += `
                <br>
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                    <label style="font-size: 0.7vw;">Impostos de ${tipo.toLowerCase()}</label>
                    <label>${dinheiro(tab.total_impostos)}</label>
                </div>
            `
            if (tipo == 'VENDA') {
                total_custos = `
                    <br>
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                        <label style="font-size: 0.7vw;">Total de Custo (Compra de Material)</label>
                        <label>${dinheiro(linhas.VENDA.total_custo)}</label>
                    </div>
                `
            }
        }
    }

    let total_orcamento = linhas.SERVIÇO.total_orcado + linhas.VENDA.total_orcado
    let totalValoresManuais = somarValoresManuais(orcamento)
    let soma_custos = totalValoresManuais + linhas.SERVIÇO.total_impostos + linhas.VENDA.total_impostos + linhas.VENDA.total_custo
    let lucro_liquido = total_orcamento - soma_custos
    let lucro_porcentagem = (lucro_liquido / total_orcamento * 100).toFixed(2)
    const descontoTotal = orcamento.desconto_geral

    let acumulado = `

        <div style="overflow: auto;">
            <br>
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: start; gap: 2vw;">
                <div style="display: flex; justify-content: space-between; gap: 2vw;">
                    <div style="width: 20%; background-color: #e3e3e3; padding: 5px; border-radius: 5px;">
                        <label>Gestão de Custos</label>
                            ${pags}
                        <hr style="width: 100%;">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            <label style="font-size: 0.7vw;">Valor do Orçamento</label>
                            <label>${dinheiro(total_orcamento)}</label>
                        </div>
                        <hr style="width: 100%;">


                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            <label>Valores Lançados</label>
                            <label onclick="valores_manuais()" style="cursor: pointer; font-size: 0.7vw;">➕ Adicionar Valor Manual</label>
                        </div>

                        <div id="lista-valores-manuais">
                            ${Object.entries(orcamento.valoresManuais || {}).length > 0
            ? Object.entries(orcamento.valoresManuais).map(([chave, valor]) => `
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-size: 0.8vw">${valor.nomeValorManual}: ${dinheiro(valor.valorManual)}</label>
                                    <button onclick="removerValorManual('${id_orcam}', '${chave}')" 
                                        style="background: none; border: none; color: red; cursor: pointer; font-size: 0.8vw;">❌</button>
                                </div>
                            `).join("")
            : "<label style='font-size: 0.7vw; color: gray;'>Nenhum valor manual adicionado.</label>"}
                        </div>

                        <hr style="width: 100%;">

                        ${impostos}

                        ${total_custos}

                        <br>
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            <label style="font-size: 0.7vw;">Desconto</label>
                            <label>${dinheiro(descontoTotal)}</label>
                        </div>
                        <br>
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                            <label style="font-size: 0.7vw;">Lucro Líquido</label>
                            <label>${dinheiro(lucro_liquido)} (${lucro_porcentagem}%)</label>
                        </div>
                    </div>
                    <div style="width: 40%;">
                        ${linhas.VENDA.impostos}
                    </div>
                    <div style="width: 40%;">
                        ${linhas.SERVIÇO.impostos}
                    </div>
                </div>
                <div style="width: 100%; display: flex; flex-direction: column-reverse; gap: 2vw;">
                    ${tabelas}
                </div>
            </div>
            <br>
        </div>

    `

    openPopup_v2(acumulado, `Painel de Custos`, true)

}