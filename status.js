// Lógicas de Status
var itens_adicionais = {}
var overlay = document.getElementById('overlay');
var acesso = JSON.parse(localStorage.getItem('acesso')) || {};
var id_orcam = ''
var dataAtual = new Date();
var data_status = dataAtual.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
});

document.addEventListener("DOMContentLoaded", async () => {
    let orcamento_que_deve_voltar = localStorage.getItem("orcamento_que_deve_voltar");

    if (orcamento_que_deve_voltar) {

        orcamento_que_deve_voltar = orcamento_que_deve_voltar.replace(/"/g, "");

        exibir_todos_os_status(orcamento_que_deve_voltar);
        
        // 🔥 Remove os dados do localStorage após exibição
        localStorage.removeItem("orcamento_que_deve_voltar");

    }
});


var fluxograma = {
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

let totalValoresPedidos; // Variável global

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

    let painel_status = document.getElementById('status')
    let espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    let estrutura = document.getElementById('estrutura')

    if (estrutura) {
        estrutura.remove()
    }

    if (painel_status) {
        painel_status.remove()
    }

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
    <div id="status" class="status" style="display: flex; overflow: auto;">
        
        <span class="close" onclick="fechar_status()">×</span>

        <label style="position: absolute; top: 5px; left: 5px; font-size: 0.6em;" id="data">${data}</label>

        <div style="display: flex; justify-content: space-evenly; align-items: center;">
            <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
        </div>

        <br>
        <div id="container_status"></div>
        
        <hr style="width: 80%">

        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 5px;">
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

            <button style="background-color: #4CAF50; width: 100%;" onclick="salvar_pedido()">Salvar</button>

        </div>

    </div>

    `;

    document.body.insertAdjacentHTML('beforeend', acumulado)
}

async function painel_adicionar_notas(chave) {

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var cliente = dados_orcamentos[id_orcam].dados_orcam.cliente_selecionado
    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    var acumulado = `
        <div id="status" class="status" style="display: flex; overflow: auto;">

            <span class="close" onclick="fechar_status()">×</span>
            <label style="position: absolute; top: 5px; left: 5px; font-size: 0.6em;" id="data">${data}</label>

            <div style="display: flex; justify-content: space-evenly; align-items: center;">
                <label class="novo_titulo" style="color: #222" id="nome_cliente">${cliente}</label>
            </div>

            <br>
            
            <div id="container_status"></div>

            <hr style="width: 80%">

            <div style="display: flex; flex-direction: column; align-items: start: justify-content: center; gap: 5px;">
                <label class="novo_titulo" style="color: #222;">Inclua o número da Nota</label>
                <label>Remessa, Venda ou Serviço</label>
            </div>

            <div style="display: flex; flex-direction: column; justify-content: center; align-items: start;"
                <label><strong>Número da Nota</strong></label>
                <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                    <input type="number" class="pedido" id="nota">
                    <select id="tipo">
                        <option>Remessa</option>
                        <option>Venda</option>
                        <option>Serviço</option>
                        <option>Venda + Serviço</option>
                    </select>
                </div>
                <label><strong>Valor da Nota</strong></label>
                <input type="number" class="pedido" id="valorNota">
                <label><strong>Valor do Frete</strong></label>
                <input type="number" class="pedido" id="valorFrete">
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                <label><strong>Comentário</strong></label>
                <textarea rows="5" style="width: 80%;" id="comentario_status"></textarea>
            </div>

            <hr style="width: 80%">

            <button style="background-color: #4CAF50" onclick="salvar_notas('${chave}')">Salvar</button>

        </div>
    `
    document.body.insertAdjacentHTML('beforeend', acumulado)
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

        await conversor_composicoes_orcamento(orcamento)

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
                    var custo = conversor(itens[codigo].custo)
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

function alterar_todos(valor_ref) {
    var trs = tabela_requisicoes.querySelectorAll('tr')
    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td');
        if (tds[7]) {
            var select = tds[7].querySelector('select');
            if (select) {
                select.value = valor_ref;
            }
        }
    })
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

async function carregar_itens(apenas_visualizar, requisicao, editar) {

    if (!id_orcam) {
        return ''
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento = dados_orcamentos[id_orcam]

    orcamento = await conversor_composicoes_orcamento(orcamento)

    var linhas = ''

    if (!orcamento.dados_composicoes || Object.keys(orcamento.dados_composicoes).length == 0) {
        return ''
    }

    Object.keys(orcamento.dados_composicoes).forEach(it => {

        var item = orcamento.dados_composicoes[it]
        var codigo = item.codigo
        var qtde = item.qtde
        var qtde_na_requisicao = 0
        var tipo = dados_composicoes[codigo]?.tipo || item.tipo
        var infos = ['descricao', 'descricaocarrefour', 'modelo', 'fabricante']
        var elements = ''
        let mod_livre = true
        let qtde_editar = qtde

        var historico = dados_orcamentos[id_orcam].status.historico

        Object.keys(historico).forEach(chave => {

            var sst = historico[chave]

            if (sst.requisicoes) {

                for (let requisicao of sst.requisicoes) {

                    if (requisicao.codigo == item.codigo) {

                        qtde_editar -= requisicao.qtde_enviar

                    }

                }

            }
        })

        infos.forEach(item => {

            if (dados_composicoes[codigo] && dados_composicoes[codigo][item]) {
                elements += `
                <label>
                <strong>${item.toUpperCase()}</strong> 
                <br> 
                ${dados_composicoes[codigo][item]}
                </label>
                `
                mod_livre = false
            }

        })

        if (mod_livre) {
            elements = `
            <label>${item.descricao}</label>
            `
        }

        var part_number = `
            <input value="${dados_composicoes[codigo]?.omie || ''}" class="pedido" style="font-size: 1.2em; width: 100%; height: 40px; padding: 0px; margin: 0px;">
        `

        // Ajustando o select para ter a opção correta selecionada;
        var selectTipo = `
            <select onchange="calcular_requisicao()">
                <option value="SERVIÇO" ${tipo === 'SERVIÇO' ? 'selected' : ''}>SERVIÇO</option>
                <option value="VENDA" ${tipo === 'VENDA' ? 'selected' : ''}>VENDA</option>
            </select>
        `;

        if (requisicao) {
            qtde_na_requisicao = requisicao[codigo]?.qtde_enviar || ''
        }

        let somasQtde = 0

        let q = 0

        if (editar) {

            Object.values(orcamento.status).forEach(status => {
                if (status.historico) {
                    Object.entries(status.historico).forEach(([chave, historico]) => {

                        if (historico.status.includes("REQUISIÇÃO")) {

                            for (let requisicaoUnica of historico.requisicoes) {

                                if (requisicaoUnica.codigo == codigo) {

                                    somasQtde += Number(requisicaoUnica.qtde_enviar)

                                    q++

                                }

                            }

                        }

                    });
                }
            });

        }

        let quantidadeAtual = undefined

        if (Number(requisicao[codigo]?.qtde_enviar) != NaN) {

            quantidadeAtual = qtde - qtde_editar + Number(requisicao[codigo]?.qtde_enviar)

        }

        if (q == 1) {

            quantidadeAtual = qtde_editar

        }

        var quantidade = `
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: space-evenly; gap: 10px;">

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
                <label><strong>Quantidade a enviar</strong></label>
                <input class="pedido" type="number" style="width: 100%; padding: 0px; margin: 0px; height: 40px;" oninput="calcular_requisicao()" value="${requisicao[codigo]?.qtde_enviar || qtde_na_requisicao}">
            </div>

            <div class="contorno_botoes" style="display: flex; align-items: center; justify-content: center; gap: 5px; background-color: #222; font-size: 1.2em;">
                <label><strong>Orçamento</strong></label>
                <label class="num">${quantidadeAtual || qtde_editar}</label>   
            </div>

        </div>
        `
        var opcoes = `
        <select style="border: none; cursor: pointer;">
            <option>Nada a fazer</option>
            <option>Estoque AC</option>
            <option>Comprar</option>
            <option>Enviar do CD</option>
            <option>Fornecido pelo Cliente</option>
        </select>
        `

        if (apenas_visualizar) {
            part_number = `<label style="font-size: 1.2em;">${requisicao[codigo]?.partnumber || ''}</label>`
            selectTipo = `<label style="font-size: 1.2em; margin: 10px;">${requisicao[codigo]?.tipo || ''}</label>`
            quantidade = `<label style="font-size: 1.2em;">${requisicao[codigo]?.qtde_enviar || ''}</label>`
            opcoes = `<label style="font-size: 1.2em;">${requisicao[codigo]?.requisicao || ''}</label>`
        }

        var linha = `
            <tr style="background-color: white;">
                <td style="text-align: center; font-size: 1.2em; white-space: nowrap;">${codigo}</td>
                <td style="text-align: center;">
                ${part_number}
                </td>
                <td style="position: relative;">
                    <div style="display: flex; flex-direction: column; gap: 5px; align-items: start;">
                    ${elements}
                    </div>
                    <img src="imagens/construcao.png" style="position: absolute; bottom: 5px; right: 5px; width: 20px; cursor: pointer;" onclick="abrir_adicionais('${codigo}')">
                </td>
                <td style="text-align: center; padding: 0px; margin: 0px; font-size: 0.8em;">
                    ${selectTipo}
                </td>
                <td style="text-align: center;">
                    ${quantidade}
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
                    ${opcoes}
                </td>
            </tr>
        `
        if (apenas_visualizar == undefined || !apenas_visualizar || (apenas_visualizar && requisicao && requisicao[codigo] && requisicao[codigo].qtde_enviar)) {
            linhas += linha
        }

    })

    return linhas
}

function remover_linha_materiais(element) {
    element.closest('tr').remove()
}

function adicionar_linha_materiais(descricao, und, qtde) {

    var painel_cotacoes = document.getElementById('painel_cotacoes');

    if (painel_cotacoes) {

        var tabela = painel_cotacoes.querySelector('table');
        var materiais = JSON.parse(localStorage.getItem('dados_materiais')) || {}
        var tbody = tabela.querySelector('tbody');
        var itens = ''

        for (material in materiais) {
            var item = materiais[material]
            itens += `
        <option>${item.descricao}</option>
        `
        }

        var linha = `
        <tr>
            <td><img src="imagens/excluir.png" onclick="remover_linha_materiais(this)" style="cursor: pointer;"></td>
            <td>?</td>
            <td style="width: 300px;">
            <input list="itens" onchange="mostrar_estoque()" placeholder="Digite o nome do material" style="width: 300px;">
            <datalist id="itens">
                ${itens}
            </datalist>
            </td>
            <td><input value="UND"></td>
            <td><input placeholder="0"></td>
            <td></td>
        </tr>
    `;

        tbody.insertAdjacentHTML('beforeend', linha);

        if (descricao !== undefined) {
            var trs = tbody.querySelectorAll('tr')
            var tds = trs[trs.length - 1].querySelectorAll('td')
            tds[2].querySelector('input').value = descricao
            tds[3].querySelector('input').value = und
            tds[4].querySelector('input').value = qtde
        }
    }
}

function mostrar_estoque() {

    var tabela = painel_cotacoes.querySelector('table');
    var materiais = JSON.parse(localStorage.getItem('dados_materiais')) || {}
    var tbody = tabela.querySelector('tbody')
    var trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td')
        var chave_desc = tds[2].querySelector('input').value

        tds[1].textContent = materiais[chave_desc].partnumber
        tds[5].textContent = materiais[chave_desc].estoque
    })

}

function abrir_adicionais(codigo) {

    var acumulado = `

    <img src="imagens/BG.png" style="height: 80px; position: absolute; top: -15px; left: 5px;">

    <div style="display: flex; align-items: center; justify-content: space-evenly;">
        <label style="font-size: 2.5vw;">Itens Adicionais</label> 
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: white; border-radius: 5px;">

        <div id="painel_cotacoes" style="background-color: #B12425; border-radius: 5px; font-size: 1.0vw; color: #222;">

            <table style="border-collapse: collapse; ">

                <thead>
                    <th>Remover</th>
                    <th>Partnumber</th>
                    <th>Descrição</th>
                    <th>Unidade</th>
                    <th>Quantidade</th>
                    <th>Estoque</th>
                </thead>
                <tbody>
                </tbody>

            </table>

        </div>

        <div style="display: flex; gap: 10px; justify-content: space-between; width: 80%; margin: 10px; cursor: pointer;">
            <img src="imagens/baixar.png" onclick="adicionar_linha_materiais()">

            <label style="background-color: #4CAF50; box-shadow: 0 0px 0px transparent;" class="contorno_botoes"
            onclick="salvar_itens_adicionais('${codigo}')">Salvar</label>
        </div>

    </div>
    `

    openPopup_v2(acumulado)

    for (cd in itens_adicionais) {

        if (cd == codigo) {
            var adicionais = itens_adicionais[cd]

            for (ad in adicionais) {
                var dados = adicionais[ad]
                adicionar_linha_materiais(ad, dados.unidade, dados.qtde)
            }

            mostrar_estoque()

        }
    }

}

function salvar_itens_adicionais(codigo) {

    var tabela = painel_cotacoes.querySelector('table');
    var tbody = tabela.querySelector('tbody')
    var trs = tbody.querySelectorAll('tr')

    if (itens_adicionais[codigo]) {
        delete itens_adicionais[codigo]
    }

    itens_adicionais[codigo] = {}

    var adicionais = itens_adicionais[codigo]

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td')
        var descricao = tds[2].querySelector('input').value

        if (descricao !== '') {

            if (!adicionais[descricao]) {
                adicionais[descricao] = {}
            }

            adicionais[descricao].partnumber = tds[1].textContent
            adicionais[descricao].descricao = tds[2].querySelector('input').value
            adicionais[descricao].unidade = tds[3].querySelector('input').value
            adicionais[descricao].qtde = Number(tds[4].querySelector('input').value)

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

            var codigo = tds[0].textContent

            var container = document.getElementById(`container_${codigo}`)
            if (container) {
                container.remove()
            }

            if (itens_adicionais[codigo]) {

                var adicionais = itens_adicionais[codigo]
                var div = ''

                for (ad in adicionais) {

                    var adicional = adicionais[ad]

                    div += `
                    <div class="div_adicionais">
                        <label>${adicional.qtde}</label>
                        <label>${adicional.unidade}</label>
                        <label>${adicional.partnumber}</label>
                        <label>${adicional.descricao}</label>
                    </div>
                    `
                }

                var acumulado = `
                <div id="container_${codigo}" class="contorno" style="width: 80%;">
                    <div style="padding: 5px; background-color: #99999940; border-radius: 3px; font-size: 0.6vw; display: flex; flex-direction: column; justify-content: center; align-items: start; gap: 2px;">
                    <label><strong>ITENS ADICIONAIS</strong></label>
                        ${div}
                    </div>
                </div>
                `

                tds[2].querySelector('div').insertAdjacentHTML('beforeend', acumulado)
            }

        })
    }
}

async function salvar_pedido(chave) {
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let data = document.getElementById('data')
    let comentario_status = document.getElementById('comentario_status')
    let valor = document.getElementById('valor')
    let tipo = document.getElementById('tipo')
    let pedido = document.getElementById('pedido')

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Não deixe campos em Branco</label>
            </div>
        `);
    }

    fechar_status() // Só fechar após coletar a informação necessária;

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];

    if (chave == undefined) {
        chave = gerar_id_5_digitos()
    }

    let novo_lancamento = {
        status: 'PEDIDO',
        data: data.textContent,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value
    };

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    orcamento.status.historico[chave] = novo_lancamento;

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)
    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    await abrir_esquema(id_orcam)
}

async function salvar_notas(chave) {
    let nota = document.getElementById('nota')
    let valorNota = document.getElementById('valorNota')
    let valorFrete = document.getElementById('valorFrete')
    let tipo = document.getElementById('tipo')
    let data = document.getElementById('data')
    let comentario_status = document.getElementById('comentario_status')

    fechar_status()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    if (!orcamento.status) {
        orcamento.status = { historico: {} };
    }

    var novo_lancamento = {
        status: 'FATURADO',
        data: data.textContent,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        notas: [{
            nota: nota.value,
            modalidade: tipo.value,
            valorNota: valorNota.value,
            valorFrete: valorFrete.value
        }]
    };

    chave == undefined ? chave = gerar_id_5_digitos() : chave

    orcamento.status.historico[chave] = novo_lancamento;

    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)
    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    await abrir_esquema(id_orcam)

    itens_adicionais = {}
}

async function salvar_requisicao(chave) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    let pendencias = []
    let interromper_processo = false

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

    var tabela_requisicoes = document.getElementById('tabela_requisicoes')
    var tbody = tabela_requisicoes.querySelector('tbody');

    if (tbody) {
        var trs = tbody.querySelectorAll('tr');
        var lista_partnumbers = {};

        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td');
            var codigo = tds[0].textContent
            var partnumber = tds[1].querySelector('input')?.value || '';
            var requisicao = tds[7].querySelector('select')?.value || '';
            var tipo = tds[3].querySelector('select')?.value || '';
            var qtde = tds[4].querySelector('input')?.value || '';

            if (qtde !== '' && partnumber === '') {
                interromper_processo = true
                pendencias.push(tds[1].querySelector('input'))
            }

            if (qtde !== '') {
                novo_lancamento.requisicoes.push({
                    codigo: codigo,
                    partnumber: partnumber,
                    tipo: tipo,
                    qtde_enviar: qtde,
                    requisicao: requisicao
                });
            }

            if (partnumber !== '') {
                lista_partnumbers[codigo] = partnumber;
            }
        });

        if (orcamento.modalidade !== 'MODALIDADE LIVRE') {
            atualizar_partnumber(lista_partnumbers)
        }
    }

    if (interromper_processo) {
        pendencias.forEach(element => {
            element.style.backgroundColor = '#B12425'
        })

        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label> Preencha os PARTNUMBERs pendentes [Vermelho]</label>
            </div>
        `);
    }

    orcamento.status.historico[chave] = novo_lancamento;

    var painel_status = document.getElementById('status')
    if (painel_status) {
        painel_status.remove()
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, novo_lancamento)

    await abrir_esquema(id_orcam)

    itens_adicionais = {}
}

async function fechar_status() {
    var status = document.getElementById('status')
    if (status) {
        status.remove()
    }
    remover_popup()

    await abrir_esquema(id_orcam)
}

function fechar_espelho_ocorrencias() {
    var espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    if (espelho_ocorrencias) {
        espelho_ocorrencias.remove()
    }
    remover_popup()
}

function botao_novo_pedido(id) {
    return `
    <div class="contorno_botoes" style="background-color: ${fluxograma['PEDIDO'].cor}" onclick="painel_adicionar_pedido()">
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
    overlay.style.display = 'block'

    let espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let detalhes = document.getElementById('detalhes')
    if (detalhes) {
        detalhes.remove()
    }
    if (espelho_ocorrencias) {
        espelho_ocorrencias.remove()
    }

    id_orcam = id

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var orcamento = dados_orcamentos[id]

    var acumulado = ''

    acumulado += `
    <span class="close" onclick="fechar_espelho_ocorrencias()">&times;</span>
    <div style="display: flex; gap: 10px">
        <label class="novo_titulo" style="color: #222; margin-right: 10vw;" id="cliente_status">${orcamento.dados_orcam.cliente_selecionado}</label>
    </div>
    `

    var analista = orcamento.dados_orcam.analista
    var acumulado_botoes = ''

    if (orcamento.status) {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="abrir_esquema('${id}')">
            <img src="imagens/esquema.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Histórico</label>
        </div>
        `
    }

    acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_pdf('${id}')">
            <img src="imagens/pdf.png" style="width: 55px;">
            <label style="cursor: pointer;">Abrir Orçamento em PDF</label>
        </div>
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_excel('${id}')">
            <img src="imagens/excel.png">
            <label style="cursor: pointer;">Baixar Orçamento em Excel</label>
        </div>
    `
    acumulado_botoes += `
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

    acumulado_botoes += botao_novo_pedido(id)

    acumulado += `
        <hr style="width: 100%">
        <div style="display: flex; flex-direction: column; justify-content: center;">
            ${acumulado_botoes}
        </div>
    `
    var elementus = `
    <div id="espelho_ocorrencias" class="status" style="display: flex;">
        ${acumulado}
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', elementus)

}

async function remover_reprovacao(responsavel) {

    fechar_espelho_ocorrencias()

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
    fechar_espelho_ocorrencias()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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

function verificar_timestamp_nome(nome) {
    let regex = /^(\d{13})\.\w+$/;
    let match = nome.match(regex);

    if (match) {
        let timestamp = parseInt(match[1]);
        let data = new Date(timestamp);
        return !isNaN(data.getTime()) && data.getFullYear() > 2000;
    }

    return false;
}

const { shell } = require('electron');

function abrirArquivo(link) {

    if (verificar_timestamp_nome(link)) { // Se for um link composto por timestamp, então vem do servidor;
        link = `https://leonny.dev.br/uploads/${link}`
    } else { // Antigo Google;
        link = `https://drive.google.com/file/d/${link}/view?usp=drivesdk`
    }

    try {
        shell.openExternal(link);
    } catch {
        window.open(link, '_blank');
    }
}

async function abrir_esquema(id) {
    overlay.style.display = 'block'
    var status = document.getElementById('status')
    if (status) {
        status.remove()
    }
    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {}
    let orcamento = dados_orcamentos[id]
    var categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    )

    if (orcamento && orcamento.status) {
        var levantamentos = ''
        if (orcamento.levantamentos) {
            for (chave in orcamento.levantamentos) {
                var levantamento = orcamento.levantamentos[chave]
                levantamentos += `
                <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                    <div class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/anexo2.png" style="width: 2vw;">
                        <label style="font-size: 0.8em;">${String(levantamento.nome).slice(0, 10)} ... ${String(levantamento.nome).slice(-7)}</label>
                    </div>
                    <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_levantamento('${id}', '${chave}')">
                </div>                
                `
            }
        }

        var acumulado = `
        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
        
            <div onclick="sincronizar_e_reabrir()" style="display: flex; flex-direction: column; justify-content: left; align-items: center; cursor: pointer;">
                <img src="imagens/atualizar2.png" style="width: 3vw;">
                <label style="font-size: 1vw;">Atualizar</label>
            </div>
            • 
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: start; font-size: 1.2vw; color: #222;">
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
            <div onclick="mostrar_painel()" class="contorno_botoes" style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <img src="imagens/pesquisar.png" style="width: 2vw;">
                <label style="font-size: 1vw;">Exibir Painel de Custos</label>
            </div>

        </div>    
        `

        let blocos_por_status = {}
        let links_requisicoes = ''
        let string_pagamentos = ''
        let tem_pagamento = false
        let pagamentos_painel = {}
        var historico = orcamento.status.historico || {}

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
                    <div onclick="detalhar_requisicao('${chave}', true)" class="anexos" style="cursor: pointer; display: flex; gap: 10px; justify-content: left; align-items: center;">
                        <img src="gifs/lampada.gif" style="width: 25px">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; cursor: pointer;">
                            <label style="cursor: pointer;"><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                            <label style="font-size: 0.7em; cursor: pointer;">Clique Aqui</label>
                        </div>
                    </div>
                    `
                editar = `
                    <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="detalhar_requisicao('${chave}', false, true)">
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
                    <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="retorno_de_materiais('${chave}')">
                        <img src="imagens/editar4.png">
                        <label>Editar</label>
                    </div>
                    `
            }

            if (String(sst.status).includes('FATURADO')) {
                editar = `
                    <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="painel_adicionar_notas('${chave}')">
                        <img src="imagens/editar4.png">
                        <label>Editar</label>
                    </div>
                    `
            }

            var notas = ''
            if (sst.notas) {
                notas += `${sst.notas[0].nota}`
            }
            var valorNota = 0
            if (sst.notas) {
                valorNota += Number(sst.notas[0].valorNota)
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
                <label><strong>Previsão: </strong>${sst.envio.previsao}</label>
                `

                editar = `
                <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="envio_de_material('${chave}')">
                    <img src="imagens/editar4.png">
                    <label>Editar</label>
                </div>
                `
            }

            blocos_por_status[campo] += `
                    <div class="bloko" style="gap: 0px; border: 1px solid ${fluxograma[sst.status].cor}; background-color: white; justify-content: center;">
                        <div style="cursor: pointer; display: flex; flex-direction: column; background-color: ${fluxograma[sst.status].cor}1f; padding: 3px; border-top-right-radius: 3px; border-top-left-radius: 3px;">
                            <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="deseja_apagar('${chave}')">&times;</span>
                            <label><strong>Executor: </strong>${sst.executor}</label>
                            <label><strong>Data: </strong>${sst.data}</label>
                            <label><strong>Comentário: </strong> <br> ${coments}</label>
                            ${dados_envio}
                            ${dados_pedidos}
                            ${sst.notas ? `<label><strong>NF: </strong>${notas}</label>` : ''}
                            ${sst.notas ? `<label><strong>Valor NF: </strong>${dinheiro(valorNota)}</label>` : ''}
                            ${totais}
                            ${links_requisicoes}
                            ${String(sst.status).includes('COTAÇÃO') ? `<a href="cotacoes.html" style="color: black;" onclick="localStorage.setItem('cotacaoEditandoID','${chave}'); localStorage.setItem('operacao', 'editar'); localStorage.setItem('iniciouPorClique', 'true');">Clique aqui para abrir a cotação</a>` : ""}
                            
                            <div class="escondido" style="display: none;">
                                <div class="contorno_botoes" style="background-color: ${fluxograma[sst.status].cor}">
                                    <img src="imagens/anexo2.png">
                                    <label>Anexo
                                        <input type="file" style="display: none;" onchange="salvar_anexo('${chave}', this)" multiple>  
                                    </label>
                                </div>

                                <div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
                                    ${await carregar_anexos(chave)}
                                </div>

                                <div class="contorno_botoes" onclick="toggle_comentario('comentario_${chave}')" style="background-color: ${fluxograma[sst.status].cor}">
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
                        </div>

                        <div style="cursor: pointer; background-color: ${fluxograma[sst.status].cor}; border-bottom-right-radius: 3px; border-bottom-left-radius: 3px; display: flex; align-items: center; justify-content: center;" onclick="exibirItens(this)">
                            <label style="color: white; font-size: 0.9vw;">▼</label>
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
        <select onchange="alterar_status(this)" style="font-size: 1vw;">
            ${opcoes}
        </select>
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
                                <div class="contorno_botoes" style="background-color: ${fluxograma['REQUISIÇÃO'].cor}"
                                    onclick="detalhar_requisicao()">
                                    <label>Nova <strong>Requisição</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['MATERIAL ENVIADO'].cor}"
                                    onclick="envio_de_material(undefined)">
                                    <label>Enviar <strong>Material</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['FATURADO'].cor};"
                                    onclick="painel_adicionar_notas()">
                                    <label>Nova <strong>Nota Fiscal</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['COTAÇÃO PENDENTE'].cor};"
                                    onclick="iniciar_cotacao('${id}')">
                                    <label>Nova <strong>Cotação</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['RETORNO DE MATERIAIS'].cor};"
                                    onclick="retorno_de_materiais('${id}')">
                                    <label>Retorno de <strong>Materiais</strong></label>
                                </div>
                                <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                    <img src="gifs/atencao.gif" style="width: 2vw;">
                                    <label style="text-decoration: underline; cursor: pointer;" onclick="deseja_apagar('${chave}')">
                                        Excluir este número de Pedido
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

    var estruturaHtml = `
        <div id="estrutura" class="status" style="display: flex; flex-direction: column; gap: 10px; width: 100%; overflow: auto;">
        <span class="close" onclick="fechar_estrutura()">&times;</span>

        <div style="max-width: 90%; display: flex; flex-direction: column;">
            ${acumulado}
        </div>

        ${painel_custos}
        `;
    document.body.insertAdjacentHTML('beforeend', estruturaHtml);

    // É só esperar a página incluir os elementos acima, simples... não precisa de timeInterval...
    let totalValoresPedidos = somarValoresPedidos();
    let totalValoresManuais = somarValoresManuais(dados_orcamentos[id]);
    let totalFinal = conversor(orcamento.total_geral) - totalValoresManuais;
    let valorPedidoSpan = document.getElementById('valor_pedido');
    let valorTotalSpan = document.getElementById('valor_total_pedido');

    console.log(conversor(orcamento.total_geral));

    if (valorPedidoSpan) {
        valorPedidoSpan.textContent = orcamento.total_geral;
    }

    if (valorTotalSpan) {
        valorTotalSpan.textContent = dinheiro(totalFinal)
    }

    fechar_espelho_ocorrencias();
}

function mostrar_painel() {
    let painel_custos = document.getElementById('painel_custos')
    let overlay_de_custos = document.getElementById('overlay_de_custos')
    let estrutura = document.getElementById('estrutura')
    if (painel_custos) {
        if (painel_custos.style.display == 'flex') {
            painel_custos.style.display = 'none'
            overlay_de_custos.style.display = 'none'

        } else {
            painel_custos.style.display = 'flex'
            overlay_de_custos.style.display = 'block'
            overlay_de_custos.style.height = estrutura.scrollHeight + 'px';
        }
    }
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

async function alterar_status(select, id) {

    let tela_orcamentos = false
    if (id !== undefined) {
        id_orcam = id
        tela_orcamentos = true
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    dados_orcamentos[id_orcam].status.atual = select.value

    enviar(`dados_orcamentos/${id_orcam}/status/atual`, select.value)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    if (tela_orcamentos) {
        filtrar_orcamentos(undefined, undefined, undefined, true)
        select.parentElement.parentElement.style.display = 'none'
    } else {
        await preencher_orcamentos_v2()
    }

}

function exibirItens(div) {

    let elemento = div.previousElementSibling;
    let label = div.querySelector('label')
    let itens = elemento.querySelectorAll('.escondido');

    itens.forEach(item => {
        let exibir = item.style.display !== 'flex';
        item.style.display = exibir ? 'flex' : 'none';

        exibir ? label.textContent = '▲' : label.textContent = '▼'

    });
}

async function iniciar_cotacao(chave, id_orcam) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_do_orcamento = dados_orcamentos[id_orcam].dados_composicoes
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let todos_os_status = orcamento.status[chave].historico
    let itens = {} // Dicionário;
    let tem_requisicao = false

    for (chave2 in todos_os_status) {

        let teste = todos_os_status[chave2]

        if (String(teste.status).includes('FATURAMENTO')) {

            if (teste.requisicoes) {

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
        if (String(his.status).includes('FATURAMENTO')) {

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

    let id_compartilhado = unicoID()
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

    orcamento.status[chave].status = 'COTAÇÃO PENDENTE'
    orcamento.status[chave].historico[id_compartilhado] = {
        status: 'COTAÇÃO PENDENTE',
        data: data_completa,
        executor: acesso.usuario,
        cotacao: nova_cotacao
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/${chave}/historico/${id_compartilhado}`, orcamento.status[chave].historico[id_compartilhado])

    let dados = {
        tabela: 'cotacoes',
        cotacao: nova_cotacao
    }

    enviar_dados_generico(dados) // 29 Mantém por enquanto...

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
        console.warn("⚠️ Valor manual não encontrado.");
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

    let acumulado = `

    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">

        <label class="novo_titulo">Retorno de Materiais</label>

    </div>
    
    <table id="tabelaRetornoMateriais" style="border-collapse: collapse; border: 1px solid black; background-color: white; width: 100%; text-align: center;">
        <tr style="border: 1px solid black;">
            <th style="border: 1px solid black; color: black; padding: 8px;">Descrição</th>
            <th style="border: 1px solid black; color: black; padding: 8px;">Quantidade Disponivel</th>
            <th style="border: 1px solid black; color: black; padding: 8px;">Quantidade para Retorno</th>
        </tr>
        `

    Object.values(orcamento.dados_composicoes).forEach(item => {

        acumulado += `
        <tr style="border: 1px solid black;">
            <td class="dados_descricao_retorno" data-codigo="${item.codigo}" style="border: 1px solid black; color: black; padding: 8px;">${dados_composicoes[item.codigo].descricao}</td>
            <td style="border: 1px solid black; color: black; padding: 8px;">${item.qtde}</td>
            <td style="border: 1px solid black; color: black; padding: 8px;"><input class="dados_qtde_retorno" type="number" " ></td>
        </tr>
        `

    })

    acumulado += `
    
    </table>
    
    <button id="botao_salvar_retorno" onclick="salvar_materiais_retorno('${chave}')">Salvar</button>

    `

    openPopup_v2(acumulado)

}

async function salvar_materiais_retorno(chave) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam];
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

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
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, orcamento.status.historico[chave])

    await abrir_esquema(id_orcam)

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
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let st = 'MATERIAL ENVIADO'

    status.executor = acesso.usuario
    status.data = data_status
    status.status = st

    historico[chave] = status
    remover_popup()

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`, status)
    abrir_esquema(id_orcam)
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
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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
            <div class="anexos" style="width: 95%; margin: 0px; margin-top: 5px;">
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
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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

function fechar_estrutura() {
    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }
    remover_popup()
}

async function chamar_duplicar(id) {
    fechar_espelho_ocorrencias()
    duplicar(id)
}

async function chamar_editar(id) {
    fechar_espelho_ocorrencias()
    editar(id)
}

async function chamar_excluir(id) {
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Deseja realmente excluir o orçamento?</label>
        </div>
        <button onclick="apagar('${id}')">Confirmar</button>
        `)
}

async function detalhar_requisicao(chave) {

    let visualizar = true
    if (chave == undefined) {
        chave = gerar_id_5_digitos()
        visualizar = false
    }

    var painel_status = document.getElementById('status')
    if (painel_status) {
        painel_status.remove()
    }

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }
    fechar_espelho_ocorrencias()
    overlay.style.display = 'block'


    itens_adicionais = {}
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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

    if (chave && orcamento.status.historico[chave]) {
        let cartao = orcamento.status.historico[chave]
        menu_flutuante = `
        <div class="menu_flutuante" id="menu_flutuante">
            <div class="icone" onclick="gerarpdf('${orcamento.dados_orcam.cliente_selecionado}', '${cartao.pedido}')">
                <img src="imagens/pdf.png">
                <label>PDF</label>
            </div>
            <div class="icone" onclick="excel()">
                <img src="imagens/excel.png">
                <label>Excel</label>
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

    var elementus = `   
    <span class="close" onclick="fechar_status()" id="span">&times;</span>

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
                <th style="text-align: center;">Requisição</th>
            </thead>
            <tbody>
            ${await carregar_itens(visualizar, requisicao)}
            </tbody>
        </table>
    <div>
    `
    var elementus_tus = `
    <div id="status" class="status" style="display: flex; width: 100%; overflow: auto;">
        ${elementus}
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', elementus_tus)

    await calcular_requisicao()
    mostrar_itens_adicionais()
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
            anexos_divs += `
                <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                    <div onclick="abrirArquivo('${anexo.link}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                        <label style="font-size: 0.8em;">${String(anexo.nome).slice(0, 10)} ... ${String(anexo.nome).slice(-7)}</label>
                    </div>
                    <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="excluir_anexo('${chave}', '${id}', this)">
                </div>
            `
        }
    }

    return anexos_divs

}

function deseja_apagar(chave) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <label>Deseja apagar essa informação?</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button style="background-color: green" onclick="apagar_status_historico('${chave}')">Confirmar</button>
                <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

async function apagar_status_historico(chave) {

    remover_popup()

    remover_cotacao(chave)

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    delete dados_orcamentos[id_orcam].status.historico[chave]
    await deletar(`dados_orcamentos/${id_orcam}/status/historico/${chave}`)

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    fechar_estrutura()
    await abrir_esquema(id_orcam)

}

function remover_cotacao(chave) { //29
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
    if (menu_flutuante) {
        menu_flutuante.style.display = 'none'
    }

    var status = document.getElementById('status')

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
        ${status.innerHTML}
    </body>
    </html>`;

    if (pedido.includes("?")) {
        pedido = ""
    }

    await gerar_pdf_online(htmlContent, `REQUISICAO_${cliente}_${pedido}`);

    if (menu_flutuante) {
        menu_flutuante.style.display = 'flex'
    }
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
    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">
        <img src="imagens/logistica.png" style="width: 50px;">
        <label class="novo_titulo">Registrar Envio de Material</label>
    </div>
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
            <label>Previsão de Entrega</label>
            <input type="date" id="previsao" value="${envio.previsao}">
        </div>

        <button style="background-color: #4CAF50; width: 100%; margin: 0px;" onclick="registrar_envio_material('${chave}')">Salvar</button>
      
    </div>
    `
    openPopup_v2(acumulado)
}