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
var anexos = {}

var fluxograma = {
    'AGUARDANDO': { cor: '#4CAF50', modulos: ['PROJETOS', 'RELATÓRIOS'] },
    'PEDIDO DE VENDA ANEXADO': { cor: '#4CAF50', modulos: ['LOGÍSTICA', 'RELATÓRIOS'], nome: 'FAZER REMESSA DE VENDA' },
    'PEDIDO DE SERVIÇO ANEXADO': { cor: '#4CAF50', modulos: ['LOGÍSTICA', 'RELATÓRIOS'], nome: 'FAZER REMESSA DE SERVIÇO' },
    'FATURAMENTO PEDIDO DE VENDA': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'], nome: 'EMITIR NOTA DE VENDA' },
    'FATURAMENTO PEDIDO DE SERVIÇO': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'], nome: 'EMITIR NOTA DE SERVIÇO' },
    'REMESSA DE VENDA': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'], nome: 'EMITIR NOTA DE REMESSA DE SERVIÇO' },
    'REMESSA DE SERVIÇO': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'], nome: 'EMITIR NOTA DE REMESSA DE VENDA' },
    'PEDIDO DE VENDA FATURADO': { cor: '#ff4500', modulos: ['LOGÍSTICA', 'RELATÓRIOS'], nome: 'COLOCAR STATUS DE ENVIO VENDA' },
    'PEDIDO DE SERVIÇO FATURADO': { cor: '#ff4500', modulos: ['LOGÍSTICA', 'RELATÓRIOS'], nome: 'COLOCAR STATUS DE ENVIO SERVIÇO' },
    'FINALIZADO': { cor: 'blue', modulos: ['RELATÓRIOS'] },
    'MATERIAL ENVIADO': { cor: '#B3702D', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'MATERIAL ENTREGUE': { cor: '#B3702D', modulos: ['RELATÓRIOS'] },
    'COTAÇÃO PENDENTE': { cor: '#0a989f', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'COTAÇÃO FINALIZADA': { cor: '#0a989f', modulos: ['RELATÓRIOS'] },
    'RETORNO DE MATERIAIS': { cor: '#aacc14', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
}

async function resumo_orcamentos() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let setores = JSON.parse(localStorage.getItem('dados_setores')) || {};
    let setores_por_nome = {};

    Object.keys(setores).forEach(id => {
        setores_por_nome[setores[id].nome] = setores[id];
    });

    let orcamentos_por_usuario = {};
    delete dados_orcamentos['id'];

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

            <div id="div_anexos" style="display: flex; flex-direction: column; justify-content: right; align-items: center; gap: 10px;">
            </div>

            <div class="contorno_botoes"> 
                <img src="imagens/anexo2.png" style="width: 15px;">
                <label for="adicionar_anexo">Anexar arquivos
                    <input type="file" id="adicionar_anexo" style="display: none;" onchange="salvar_anexo()" multiple> 
                </label>
            </div>
            
            <hr style="width: 80%">

            <button style="background-color: #4CAF50; width: 100%;" onclick="salvar_pedido()">Salvar</button>

        </div>

    </div>

    `;

    document.body.insertAdjacentHTML('beforeend', acumulado)
}


async function painel_adicionar_notas(chave) {

    var painel_status = document.getElementById('status')
    if (painel_status) {
        painel_status.remove()
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var cliente = dados_orcamentos[id_orcam].dados_orcam.cliente_selecionado
    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    var funcao = `salvar_notas()`
    if (chave !== undefined) {
        funcao = `salvar_notas('${chave}')`
    }

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
                    </select>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
                <label><strong>Comentário</strong></label>
                <textarea rows="5" style="width: 80%;" id="comentario_status"></textarea>
            </div>

            <div id="div_anexos"
                style="display: flex; flex-direction: column; justify-content: right; align-items: center; gap: 10px;">
            </div>

            <div class="contorno_botoes">
                <img src="imagens/anexo2.png" style="width: 15px;">
                <label for="adicionar_anexo">Anexar arquivos
                    <input type="file" id="adicionar_anexo" style="display: none;" onchange="salvar_anexo()" multiple>
                </label>
            </div>

            <hr style="width: 80%">

            <button style="background-color: #4CAF50" onclick="${funcao}">Salvar</button>

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

async function carregar_itens(apenas_visualizar, requisicao) {

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

        var todos_os_status = dados_orcamentos[id_orcam].status;

        Object.keys(todos_os_status).forEach(chave_pedido => {

            var lista_interna = todos_os_status[chave_pedido].historico;

            Object.keys(lista_interna).forEach(chave2 => {

                var sst = lista_interna[chave2]

                if (sst.requisicoes) {

                    for (let requisicao of sst.requisicoes) {

                        if (requisicao.codigo == item.codigo) {

                            qtde -= requisicao.qtde_enviar

                        }

                    }

                }

            })
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

        var quantidade = `
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: space-evenly; gap: 10px;">

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
                <label><strong>Quantidade a enviar</strong></label>
                <input class="pedido" type="number" style="width: 100%; padding: 0px; margin: 0px; height: 40px;" oninput="calcular_requisicao()" value="${qtde_na_requisicao}">
            </div>

            <div class="contorno_botoes" style="display: flex; align-items: center; justify-content: center; gap: 5px; background-color: #222; font-size: 1.2em;">
                <label><strong>Orçamento</strong></label>
                <label class="num">${qtde}</label>   
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

async function carregar_status_divs(valor, chave, id) { // "valor" é o último status no array de status que vem do script de orçamentos;

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    if (chave == undefined) {
        chave = gerar_id_5_digitos()
    }

    overlay.style.display = 'block'

    if (id) {
        id_orcam = id
        dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
        orcamento = dados_orcamentos[id_orcam]
    }

    if (!valor || valor == 'AGUARDANDO') {

        return painel_adicionar_pedido()

    } else if (String(valor).includes('ANEXADO')) {

        return detalhar_requisicao(chave)

    } else if (String(valor).includes('FATURAMENTO') || String(valor).includes('REMESSA')) {

        return painel_adicionar_notas(chave)

    } else if (String(valor).includes('FATURADO')) {

        return envio_de_material(chave, id_orcam)

    }

}

async function salvar_pedido(chave) {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let st = '';
    let chave_his = gerar_id_5_digitos();
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
        status: '',
        historico: {}
    };

    novo_lancamento.historico[chave_his] = {
        status: '',
        data: data.textContent,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        anexos: anexos,
    };


    novo_lancamento.valor = Number(valor.value)
    novo_lancamento.tipo = tipo.value
    novo_lancamento.pedido = pedido.value
    st = `PEDIDO DE ${String(tipo.value).toUpperCase()} ANEXADO`

    novo_lancamento.status = st;
    novo_lancamento.historico[chave_his].status = st;

    if (!orcamento.status) {
        orcamento.status = {}
    }

    if (!orcamento.status[chave]) {
        orcamento.status[chave] = {}
    }

    orcamento.status[chave] = novo_lancamento;

    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}`, codificarUTF8(novo_lancamento))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())
    await inserirDados(dados_orcamentos, 'dados_orcamentos');

    abrir_esquema(id_orcam)

}

async function salvar_notas(chave) {

    let nota = document.getElementById('nota')
    let tipo = document.getElementById('tipo')
    let data = document.getElementById('data')
    let comentario_status = document.getElementById('comentario_status')

    fechar_status()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento = dados_orcamentos[id_orcam];

    let st = '';
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    if (!orcamento.status) {
        orcamento.status = {};
    }

    var novo_lancamento = orcamento.status[chave];
    novo_lancamento.notas = [];
    var chave_his = gerar_id_5_digitos();

    novo_lancamento.historico[chave_his] = {
        status: '',
        data: data.textContent,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        anexos: anexos,
        notas: []
    };


    novo_lancamento.historico[chave_his].notas.push({
        nota: nota.value,
        modalidade: tipo.value
    });

    if (tipo.value == 'Venda') {
        st = `PEDIDO DE VENDA FATURADO`;
    } else if (tipo.value == 'Serviço') {
        st = `PEDIDO DE SERVIÇO FATURADO`;
    } else if (tipo.value == 'Remessa') {
        st = tipo.value.includes('Serviço') ? `REMESSA DE SERVIÇO` : `REMESSA DE VENDA`;
    }

    novo_lancamento.status = st;
    novo_lancamento.historico[chave_his].status = st;

    await inserirDados(dados_orcamentos, 'dados_orcamentos');
    abrir_esquema(id_orcam)

    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/historico/${chave_his}`, codificarUTF8(novo_lancamento.historico[chave_his]))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    anexos = {}
    itens_adicionais = {}
}

async function salvar_requisicao(chave, chave2) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var orcamento = dados_orcamentos[id_orcam];
    var st = '';
    let pendencias = []
    let interromper_processo = false

    if (!orcamento.status) {
        orcamento.status = {};
    }

    if (chave2 == undefined) {
        chave2 = gerar_id_5_digitos()
    }

    if (!orcamento.status[chave]) {
        orcamento.status[chave] = { historico: {} };
    }

    var pedido = orcamento.status[chave].pedido
    var novo_lancamento = orcamento.status[chave];

    await calcular_requisicao()

    novo_lancamento.historico[chave2] = {
        status: '',
        data: data_status,
        executor: acesso.usuario,
        comentario: comentario_status.value,
        anexos: anexos,
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
                novo_lancamento.historico[chave2].requisicoes.push({
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

        atualizar_partnumber(lista_partnumbers);

    }

    var tipo = String(orcamento.status[chave].tipo).toUpperCase()

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

    } else {
        st = `FATURAMENTO PEDIDO DE ${tipo}`;

    }

    novo_lancamento.status = st;
    novo_lancamento.historico[chave2].status = st;
    novo_lancamento.historico[chave2].pedido_selecionado = pedido;

    var painel_status = document.getElementById('status')
    if (painel_status) {
        painel_status.remove()
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/status`, st)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/historico/${chave2}`, codificarUTF8(novo_lancamento.historico[chave2]))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    abrir_esquema(id_orcam)

    anexos = {}
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
    <div class="contorno_botoes" style="background-color: ${fluxograma['PEDIDO DE VENDA ANEXADO'].cor}" onclick="carregar_status_divs('AGUARDANDO', undefined, '${id}')">
        <label>Novo <strong>Pedido </strong></label>
    </div>
`}

function botao_novo_pagamento(ch_pedido) {
    return `
    <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento('${ch_pedido}')">
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

    if (orcamento.lpu_ativa == 'LPU CARREFOUR') {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="rir('${id}')">
            <img src="imagens/carrefour.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Itens Reais em Excel</label>
        </div> 
    `}

    acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_duplicar('${id}')">
            <img src="imagens/duplicar.png">
            <label style="cursor: pointer;">Duplicar Orçamento</label>
        </div>
    `

    if ((modulo == 'PROJETOS' && document.title !== 'Projetos' && analista == acesso.nome_completo) || (acesso.permissao == 'adm' || acesso.permissao == 'fin')) {
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

    if (modulo == 'PROJETOS' || modulo == 'RELATÓRIOS' || document.title == 'Projetos') {
        acumulado_botoes += botao_novo_pedido(id)
    }

    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    let responsaveis = ['Gerente']
    let painel_aprovacao = ''
    if (conversor(orcamento.total_geral) > 21000) {
        responsaveis.push('Diretoria')
    }

    responsaveis.forEach(responsavel => {
        if (orcamento.aprovacao && orcamento.aprovacao[responsavel]) {
            let aprovado = orcamento.aprovacao[responsavel]
            let cor = aprovado.status == 'aprovado' ? '#4CAF50' : '#B12425'
            let img = aprovado.status == 'aprovado' ? 'concluido' : 'remover'
            let botao_cancelar = ''
            if (
                acesso.permissao == 'adm' ||
                (responsavel == 'Gerente' && (acesso.permissao == 'gerente' || acesso.permissao == 'diretoria') ||
                    (responsavel == 'Diretoria' && acesso.permissao == 'diretoria')
                )
            ) {
                botao_cancelar = `<button style="background-color: #222;" onclick="remover_reprovacao('${responsavel}')">Cancelar</button>`
            }

            painel_aprovacao += `
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <div class="contorno">
                    <div class="avenida_contorno" style="margin: 0px; padding: 3px; background-color: ${cor}47;">
                        <div style="position: relative; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                            <label style="padding: 5px;">${String(aprovado.status).toUpperCase()} por ${aprovado.usuario} <strong>${responsavel}</strong></label>
                            <textarea rows="3" style="width: 100%; padding: 0px; border: none;" readOnly>${aprovado.justificativa}</textarea>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <label style="font-size: 0.8vw;">${aprovado.data}</label>
                                ${botao_cancelar}
                            </div>
                        </div>
                    </div>
                </div>    
                <img src="imagens/${img}.png">
            </div>
            `
        } else {

            if (
                acesso.permissao == 'adm' ||
                (responsavel == 'Gerente' && acesso.permissao == 'gerente') ||
                (responsavel == 'Diretoria' && acesso.permissao == 'diretoria')
            ) {

                painel_aprovacao += `
                <div class="contorno">
                    <div class="avenida_contorno" style="margin: 0px; background-color: #097fe661;">
                        <div style="position: relative; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                            <label>Aprovação ${responsavel}</label>
                            <textarea rows="3" id="justificativa_${responsavel}"></textarea>
                            <label>${data}</label>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <button style="background-color: green;" onclick="aprovar_orcamento('${responsavel}', true, '${data}')">Aprovar</button>
                            <button onclick="aprovar_orcamento('${responsavel}', false, '${data}')">Reprovar</button>
                        </div>
                    </div>
                </div>
            `
            }
        }
    })

    acumulado += `
        <hr style="width: 80%">
        <div style="display: flex; align-items: start; justify-content: space-between; gap: 20px;">
            <div style="display: flex; flex-direction: column; justify-content: center;">
                ${acumulado_botoes}
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label>Aprovações deste Orçamento</label>
                ${painel_aprovacao}
            </div>
        </div>
    `

    if (orcamento.status) {

        for (chave_pedido in orcamento.status) {

            var pedido_completo = orcamento.status[chave_pedido]
            var st = pedido_completo

            for (chave2 in st.historico) {

                var his = st.historico[chave2]
                var exibir_label = false;
                let status_chave2 = String(his.status)

                fluxograma[status_chave2].modulos.forEach(sst => {
                    if (sst === modulo) {
                        exibir_label = true;
                    }
                });


                if (exibir_label) {

                    var coments = ''
                    if (his.comentario) {
                        coments = his.comentario.replace(/\n/g, '<br>')
                    }

                    let funcao = ''
                    if (status_chave2.includes('ANEXADO')) {

                        funcao = `detalhar_requisicao('${chave_pedido}')`

                    } else if (status_chave2.includes('FATURAMENTO')) {

                        if (acesso.permissao == 'adm' || acesso.permissao == 'fin') {
                            funcao = `painel_adicionar_notas('${chave_pedido}')`
                        }

                    } else if (status_chave2 == 'MATERIAL ENVIADO') {

                        funcao = `envio_de_material('${chave_pedido}', '${id_orcam}', '${chave2}')`

                    } else if (status_chave2.includes('FATURADO')) {

                        funcao = `envio_de_material('${chave_pedido}', '${id_orcam}')`

                    }

                    if (funcao !== '') {
                        acumulado += `
                        <hr style="width: 80%">
                        <div class="contorno">
                            <div class="avenida_contorno" style="background-color: ${fluxograma[status_chave2].cor}1f; margin: 0px;">
                                <label><strong>Status: </strong>${status_chave2}</label>
                                <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                    <label><strong>Número: </strong>${st.pedido}</label>
                                    <img src="gifs/alerta.gif" style="width: 2vw; cursor: pointer;" onclick="popup_atualizar_item('${chave_pedido}', 'pedido')">
                                </div>
                                <label><strong>Data: </strong> ${his.data}</label>
                                <label><strong>Executor: </strong> ${his.executor}</label>
                                <label><strong>Comentário: </strong> <br>${coments}</label>
                                <div class="contorno_botoes" style="background-color: ${fluxograma[status_chave2].cor}" onclick="${funcao}">
                                    <label>Continuar</label>
                                </div>
                            </div>
                        </div>
                        `
                    }
                }
            }
        }
    }

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
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

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
    await enviar('PUT', `dados_orcamentos/${id_orcam}/aprovacao/${responsavel}`, aprov)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    exibir_todos_os_status(id_orcam)
    await preencher_orcamentos_v2()
}

try {
    const { shell } = require('electron');

    function abrirArquivo(link) {
        try {
            shell.openExternal(link);
        } catch {
            window.open(link, '_blank');
        }
    }
} catch { }

function popup_atualizar_item(chave1, item) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: left;">
            <label>Atualize a informação</label>
            <input class="pedido" style="width: 100%" id="elemento_para_atualizado">
            <button style="background-color: green;" onclick="atulizar_item('${chave1}', '${item}')">Salvar</button>
        </div>
    `)
}

async function atulizar_item(chave1, item) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var orcamento = dados_orcamentos[id_orcam]
    var novo = elemento_para_atualizado.value
    remover_popup()

    novo == '' ? novo = '???' : ''
    orcamento.status[chave1][item] = novo

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave1}/${item}`, codificarUTF8(novo))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    var estrutura = document.getElementById('estrutura')
    var espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    if (estrutura) {
        estrutura.remove()
        abrir_esquema(id_orcam)
    } else if (espelho_ocorrencias) {
        espelho_ocorrencias.remove()
        exibir_todos_os_status(id_orcam)
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
    let dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {}

    var categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    )

    if (dados_orcamentos[id] && dados_orcamentos[id].status) {
        var todos_os_status = dados_orcamentos[id].status;

        var etiquetas = ''
        if (dados_orcamentos[id].etiqueta) {
            var etiquetas_orcamento = dados_orcamentos[id].etiqueta

            Object.keys(etiquetas_orcamento).forEach(et => {
                var etiqueta = dados_etiquetas[et]
                etiquetas += `
                <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                    <div class="contorno_botoes" style="background-color: ${etiqueta.cor}" onclick="remover_etiqueta('${id_orcam}', '${et}')">
                    ${etiqueta.nome}
                    </div>
                    <label style="font-size: 0.6em;">${etiquetas_orcamento[et]}</label>
                </div>    
                `
            })
        }

        var levantamentos = ''

        if (dados_orcamentos[id].levantamentos) {

            for (chave in dados_orcamentos[id].levantamentos) {

                var levantamento = dados_orcamentos[id].levantamentos[chave]

                var imagem = ''

                if (formato(levantamento.formato) == 'PDF') {
                    imagem = 'pdf'
                } else if (formato(levantamento.formato) == 'IMAGEM') {
                    imagem = 'imagem'
                } else if (formato(levantamento.formato) == 'PLANILHA') {
                    imagem = 'excel2'
                } else {
                    imagem = 'anexo'
                }

                let arquivo = `https://drive.google.com/file/d/${levantamento.link}/view?usp=drivesdk`
                levantamentos += `
                <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: center;" onclick="abrirArquivo('${arquivo}')">
                    <div style="cursor: pointer; align-items: center; width: max-content; font-size: 0.7em; display: flex; justify-content; left; box-shadow: 2px 2px #94a0ab; background-color: #e9e9e9; color: #555; padding: 5px; margin:5px; border-radius: 5px;">
                        <img src="imagens/${imagem}.png" style="width: 25px;">
                        <label style="cursor: pointer;"><strong>${encurtar_texto(levantamento.nome, 10)}</strong></label>
                    </div>
                    <label style="text-decoration: underline; font-size: 0.7em; cursor: pointer;" onclick="excluir_levantamento('${id}', '${chave}')">Excluir</label>
                </div>
                `
            }
        }

        var acumulado = `
        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
            <div onclick="abrir_esquema('${id_orcam}')" style="display: flex; flex-direction: column; justify-content: left; align-items: center; cursor: pointer;">
                <img src="imagens/atualizar2.png" style="width: 50px;">
                <label>Atualizar</label>
            </div>
            • 
            <label class="novo_titulo" style="color: #222">${dados_orcamentos[id].dados_orcam.cliente_selecionado}</label>
            • 
            <label class="novo_titulo" style="color: #222">${dados_orcamentos[id].dados_orcam.contrato}</label>
            •
            <div onclick="selecionar_etiqueta()" class="contorno_botoes" style="display: flex; gap: 10px; align-items: center; justify-content: center; background-color: #222;"> 
                <img src="imagens/etiqueta.png" style="width: 20px;">
                <label>Etiqueta</label>
            </div>
            •
            <div>${etiquetas}</div>

            <div style="display: flex; flex-direction: column; align-items: start;">
                <div class="contorno_botoes" style="background-color: #222;">
                    <img src="imagens/anexo2.png" style="width: 15px;">
                    <label for="adicionar_levantamento">Anexar levantamento
                        <input type="file" id="adicionar_levantamento" style="display: none;"
                            onchange="salvar_levantamento('${id}')">
                    </label>
                </div>
                ${levantamentos}
            </div>

        </div>    
        `;
        var contador = 1;


        for (chave_pedido in todos_os_status) {

            var lista_interna = todos_os_status[chave_pedido].historico;
            var blocos = '';
            var links_requisicoes = ''
            var string_pagamentos = ''
            var tem_pagamento = false
            var pagamentos_painel = {}

            for (pag in lista_pagamentos) {
                if (pag !== 'id') { // IndexedDB armazena um item com esse 'id';
                    var pagamento = lista_pagamentos[pag]
                    var comentario = 'Sem observação'
                    if (pagamento.param[0].observacao) {
                        comentario = pagamento.param[0].observacao.replace(/\|/g, '<br>')
                    }

                    if (pagamento.id_pedido == chave_pedido || pagamento.pedido == todos_os_status[chave_pedido].pedido) {
                        string_pagamentos += `
                    <div style="display: flex; flex-direction: column; border-radius: 5px; border: solid 1px white; padding: 10px; background-color: white; color: #222;">
                            
                        <label style="display: flex; gap: 10px;"><strong>${pagamento.status}</strong></label>
                        <label><strong>Data:</strong> ${pagamento.param[0].data_previsao}</label>
                        <label><strong>Observação:</strong><br>${comentario}</label>
                        `
                        pagamento.param[0].categorias.forEach(cat => {
                            var nome_cat = ''
                            categorias[cat.codigo_categoria] ? nome_cat = categorias[cat.codigo_categoria] : nome_cat = cat.codigo_categoria
                            string_pagamentos += `
                            <label><strong>Categoria:</strong> ${nome_cat} • R$ ${dinheiro(cat.valor)}</label>
                            `

                            if (!pagamentos_painel[pagamento.status]) {
                                pagamentos_painel[pagamento.status] = 0
                            }
                            pagamentos_painel[pagamento.status] += Number(cat.valor)

                        })
                        string_pagamentos += `
                        </div>
                        `
                        tem_pagamento = true
                    }
                }
            }

            if (tem_pagamento) {
                blocos += `
                <div class="bloko" style="background-color: #097fe6">
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">
                    <img src="imagens/pesquisar.png" style="width: 25px; height: 25px;">
                    <input id="${chave_pedido}" style="padding: 10px; border-radius: 5px;" placeholder="Pesquisar pagamento" oninput="pesquisar_pagamentos('${chave_pedido}')">
                    </div>
                    <div id="div_pagamentos_pesquisa_${chave_pedido}" style="display: flex; flex-direction: column; gap: 10px;">
                    ${string_pagamentos}
                    </div>
                </div>
            `}


            for (chave2 in lista_interna) {

                var sst = lista_interna[chave2]
                var anxsss = ''
                links_requisicoes = ''
                let editar = ''

                if (String(sst.status).includes('FATURAMENTO') || String(sst.status).includes('REMESSA')) {

                    links_requisicoes += `
                    <div class="anexos" style="cursor: pointer; display: flex; gap: 10px; justify-content: left; align-items: center;">
                        <img src="gifs/lampada.gif" style="width: 25px">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;"
                            <label style="cursor: pointer;" onclick="detalhar_requisicao('${chave_pedido}', true, '${chave2}')"><strong>REQUISIÇÃO DISPONÍVEL</strong></label>
                            <label style="font-size: 0.7em;">Clique Aqui</label>
                        </div>
                    </div>
                    `
                    editar = `
                        <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="detalhar_requisicao('${chave_pedido}', false, '${chave2}')">
                            <img src="imagens/editar4.png" style="width: 15px;">
                            <label>Editar</label>
                        </div>
                    `
                }

                if (String(sst.status).includes("RETORNO")) {

                    editar = `
                        <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="retorno_de_materiais('${chave_pedido}', '${id}', false)">
                            <img src="imagens/editar4.png" style="width: 15px;">
                            <label>Editar</label>
                        </div>
                    `

                }

                if (String(sst.status).includes('COTAÇÃO')) {

                    await recuperarCotacoes()

                    let cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};

                    let cotacaoAtual = {}

                    for (let cotacao of Object.values(cotacoes)) {

                        if (cotacao.informacoes.idOrcamento) {

                            if (id_orcam == cotacao.informacoes.idOrcamento) {

                                cotacaoAtual = cotacoes[cotacao.informacoes.id]

                            }

                        }


                    }

                    var idCotacao = cotacaoAtual.informacoes.id

                    if (cotacaoAtual.status == "Finalizada") {

                        sst.status = "COTAÇÃO FINALIZADA"
                        await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave_pedido}/historico/${chave2}/status`, "COTAÇÃO FINALIZADA")
                        await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

                    } else {

                        sst.status = "COTAÇÃO PENDENTE"
                        await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave_pedido}/historico/${chave2}/status`, "COTAÇÃO PENDENTE")
                        await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

                    }

                }

                if (sst.anexos) {

                    Object.keys(sst.anexos).forEach(key_anx => {

                        var anx = sst.anexos[key_anx]

                        var arquivo = `https://drive.google.com/file/d/${anx.link}/view?usp=drivesdk`

                        anxsss += `
                        <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                            <div onclick="abrirArquivo('${arquivo}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                                <label style="font-size: 0.8em;">${String(anx.nome).slice(0, 10)} ... ${String(anx.nome).slice(-7)}</label>
                            </div>
                            <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="chamar_excluir_anexo('${chave_pedido}', '${chave2}', '${key_anx}')">
                        </div>
                    `
                    })

                }

                var notas = ''
                if (sst.notas) {
                    notas += `${sst.notas[0].nota}`
                }

                var totais = ''
                if (sst.requisicoes) {

                    var infos = calcular_quantidades(sst.requisicoes, dados_orcamentos[id].dados_composicoes)

                    totais += `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; flex-direction: column;">
                            <label><strong>Total sem ICMS: </strong><br>${sst.total_sem_icms}</label>
                            <label><strong>Total com ICMS: </strong><br>${sst.total_com_icms}</label>
                        </div>

                        <div class="contorno_botoes" style="border-radius: 3px; padding: 10px; background-color: ${infos.cor};">
                            <label>${infos.label_porcentagem}</label>
                        </div>
                    </div>
                    `
                }

                var dados_de_envio = ''
                if (sst.envio) {

                    function conv_data(data) {

                        if (data !== '') {
                            var split_data = String(data).split('-')
                            data = `${split_data[2]}/${split_data[1]}/${split_data[0]}`
                        }

                        return data
                    }

                    var envio = sst.envio
                    let dt_previsao = ''
                    if (envio.previsao) {
                        dt_previsao = conv_data(envio?.previsao)
                    }

                    editar = `
                        <div style="background-color: ${fluxograma[sst.status].cor}" class="contorno_botoes" onclick="envio_de_material('${chave_pedido}', '${id_orcam}','${chave2}')">
                            <img src="imagens/editar4.png" style="width: 15px;">
                            <label>Editar</label>
                        </div>
                    `
                    dados_de_envio = `
                    <label><strong>Rastreio: </strong> ${envio.rastreio}</label>
                    <label><strong>Custo do Frete:</strong> ${dinheiro(envio.custo_frete)}</label>
                    <label><strong>NF: </strong> ${envio.nf}</label>
                    <label><strong>Transportadora: </strong> ${envio.transportadora}</label>
                    <label><strong>Volumes: </strong> ${envio.volumes}</label>
                    <label><strong>Data de Saída: </strong> ${conv_data(envio.data_saida)}</label>
                    <label><strong>Data de Previsão: </strong> ${dt_previsao}</label>
                    <label><strong>Data de Entrega: </strong> ${conv_data(envio.entrega)}</label>
                    `
                }
                var coments = ''
                if (sst.comentario) {
                    var coments = sst.comentario.replace(/\n/g, '<br>')
                }

                blocos += `
                <div class="bloko" style="border: 1px solid ${fluxograma[sst.status].cor}">
                    <div style="display: flex; flex-direction: column; background-color: ${fluxograma[sst.status].cor}1f; padding: 3px; border-radius: 3px; padding: 3px; height: 100vh;">
                        <span class="close" style="position: absolute; top: 15px; right: 15px;" onclick="deseja_apagar('${chave_pedido}', '${chave2}')">&times;</span>
                        <label><strong>Status: </strong>${sst.status}</label>
                        <label><strong>Executor: </strong>${sst.executor}</label>
                        <label><strong>Data: </strong>${sst.data}</label>
                        <label><strong>Comentário: </strong> <br> ${coments}</label>
                        ${sst.notas ? `<label><strong>NF: </strong>${notas}</label>` : ''}
                        ${totais}
                        ${dados_de_envio}
                        ${links_requisicoes}
                        ${String(sst.status).includes('COTAÇÃO') ? `<a href="cotacoes.html" style="color: black;" onclick="localStorage.setItem('cotacaoEditandoID','${idCotacao}'); localStorage.setItem('operacao', 'editar'); localStorage.setItem('iniciouPorClique', 'true');">Clique aqui para abrir a cotação</a>` : ""}
                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                            <div class="contorno_botoes" style="background-color: ${fluxograma[sst.status].cor}">
                                <img src="imagens/anexo2.png" style="width: 15px;">
                                <label for="adicionar_anexo_${chave_pedido}_${chave2}">Anexo
                                    <input type="file" id="adicionar_anexo_${chave_pedido}_${chave2}" style="display: none;" onchange="salvar_anexo('${chave_pedido}', '${chave2}')" multiple>  
                                </label>
                            </div>
                            <div class="contorno_botoes" onclick="toggle_comentario('comentario_${chave2}')" style="background-color: ${fluxograma[sst.status].cor}">
                                <img src="imagens/comentario.png" style="width: 15px;">
                                <label>Comentário</label>
                            </div>

                            ${editar}
                        </div>
                        <div id="comentario_${chave2}" style="display: none; justify-content: space-evenly; align-items: center;">

                            <textarea placeholder="Comente algo aqui..."></textarea>

                            <label class="contorno_botoes" style="background-color: green;" onclick="salvar_comentario_trello('${chave_pedido}', '${chave2}')">Salvar</label>
                            <label class="contorno_botoes" style="background-color: #B12425;" onclick="toggle_comentario('comentario_${chave2}')">&times;</label>

                        </div>
                        <div id="caixa_comentarios_${chave2}" style="display: flex; flex-direction: column;">
                            ${await carregar_comentarios(chave_pedido, chave2)}
                        </div>
                        ${anxsss}
                    </div>
                </div>
                `

            }

            var valor_do_pedido = '???'
            if (todos_os_status[chave_pedido].valor) {
                valor_do_pedido = dinheiro(conversor(todos_os_status[chave_pedido].valor))
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

            var resultado = conversor(todos_os_status[chave_pedido].valor) - total_pago
            var porcentagem = total_pago / conversor(todos_os_status[chave_pedido].valor) * 100
            var string_porcentagem = `${(porcentagem).toFixed(0)}%`
            var cor_indicador = 'orangered'
            if (porcentagem < 35) {
                cor_indicador = 'green'
            } else if (porcentagem > 40) {
                cor_indicador = '#B12425'
            }

            var div_pags = `
            <div class="contorno_botoes" style="display: flex; flex-direction: column; align-items: start; padding: 10px; border-radius: 5px; background-color: #222222bf; color: white;">
                <label>Gestão de Custos</label>
                ${pags}
                <hr style="width: 100%;">
                <label>${valor_do_pedido} <label style="font-size: 0.6em;">Valor do Pedido</label></label>
                <label>(-) ${dinheiro(total_pago)}  <label class="indicador" style="background-color: ${cor_indicador}">${string_porcentagem}</label></label>
                <hr style="width: 100%;">
                <label>${dinheiro(resultado)}</label>
            </div>
            `
            var ultima_alteracao = ''
            if (todos_os_status[chave_pedido].alterado_por) {
                var info = todos_os_status[chave_pedido]

                ultima_alteracao = `
                <label>Alterado por <strong>${info.alterado_por}</strong>, às ${info.alterado_quando}</label>
                `
            }

            var opcoes_status = ''
            var atual_status = todos_os_status[chave_pedido].status
            for (fluxo in fluxograma) {
                opcoes_status += `
                <option ${fluxo == atual_status ? 'selected' : ''}>${fluxo}</option>
                `
            }

            var linhas = `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <hr style="width: 80%;">
                    <div style="display: flex; gap: 10px;">
                        <div
                            style="display: flex; align-items: center; font-size: 1.5em; font-weight: bold; background-color: #444; color: #fff; padding: 5px 10px; border-radius: 5px;">
                            ${contador}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                            <img src="gifs/atencao.gif" style="width: 2vw;">
                            <label style="text-decoration: underline; cursor: pointer;"
                                onclick="deseja_apagar('${chave_pedido}')">
                                Excluir este número de Pedido
                            </label>
                            </div>

                            <div style="display: flex; flex-direction: column; align-items: start;">
                                <label>
                                    <strong>Situação atual: </strong>
                                </label>
                                <select onchange="alterar_status_principal(this, '${chave_pedido}')">
                                    ${opcoes_status}
                                </select>
                                ${ultima_alteracao}
                            </div>

                            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                <label style="text-align: left;"><strong>Número do pedido:</strong>
                                    ${todos_os_status[chave_pedido].pedido}</label>
                                <img src="gifs/alerta.gif" style="width: 2vw; cursor: pointer;"
                                    onclick="popup_atualizar_item('${chave_pedido}', 'pedido')">
                            </div>

                            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                <label style="text-align: left;"><strong>Valor deste Pedido</strong>
                                    ${valor_do_pedido}</label>
                                <img src="gifs/alerta.gif" style="width: 2vw; cursor: pointer;"
                                    onclick="popup_atualizar_item('${chave_pedido}', 'valor')">
                            </div>
                            
                            <div style="display: flex; gap: 10px;">
                                ${botao_novo_pagamento(chave_pedido)}
                                ${botao_novo_pedido(id)}
                                <div class="contorno_botoes" style="background-color: ${fluxograma['FATURAMENTO PEDIDO DE VENDA'].cor}"
                                    onclick="detalhar_requisicao('${chave_pedido}')">
                                    <label>Nova <strong>Requisição</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['PEDIDO DE VENDA FATURADO'].cor};"
                                    onclick="carregar_status_divs('FATURAMENTO', '${chave_pedido}', '${id}')">
                                    <label>Nova <strong>Nota Fiscal</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['MATERIAL ENVIADO'].cor};"
                                    onclick="envio_de_material('${chave_pedido}', '${id}')">
                                    <label>Envio de <strong>Material</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['COTAÇÃO PENDENTE'].cor};"
                                    onclick="iniciar_cotacao('${chave_pedido}', '${id}')">
                                    <label>Nova <strong>Cotação</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['RETORNO DE MATERIAIS'].cor};"
                                    onclick="retorno_de_materiais('${chave_pedido}', '${id}', true)">
                                    <label>Retorno de <strong>Materiais</strong></label>
                                </div>
                            </div>
                        </div>

                        ${pags !== '' ? div_pags : ''}

                    </div>
                    <div class="container-blocos">
                        ${blocos}
                    </div>
                </div>
            `;

            acumulado += linhas;
            contador++;

        };

        var estruturaHtml = `
        <div id="estrutura" class="status" style="display: flex; flex-direction: column; gap: 10px; width: 100%; height: 100vh; overflow: auto;">
        <span class="close" onclick="fechar_estrutura()">&times;</span>
        ${acumulado}
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', estruturaHtml);

        fechar_espelho_ocorrencias();
    }

}

async function iniciar_cotacao(chave, id_orcam) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let itens_do_orcamento = dados_orcamentos[id_orcam].dados_composicoes
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let todos_os_status = orcamento.status[chave].historico
    let itens = {} // Dicionário;

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
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/historico/${id_compartilhado}`, codificarUTF8(orcamento.status[chave].historico[id_compartilhado]))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    let dados = {
        tabela: 'cotacoes',
        cotacao: nova_cotacao
    }

    enviar_dados_generico(dados) // 29 Mantém por enquanto...

    abrir_esquema(id_orcam)

}

async function retorno_de_materiais(chave_pedido, id, qualBotao) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id];
    let retornoAtual = undefined
    let chave2 = undefined

    Object.entries(orcamento.status[chave_pedido].historico).forEach(([chave, item]) => {
        if (item.status.includes("RETORNO")) {
            retornoAtual = item.materiaisRetorno;
            chave2 = chave; // Armazena a chave do objeto
        }
    });


    if (retornoAtual && qualBotao) {

        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Já existe um Retorno de Materiais no Pedido</label>
            </div>
        `)

    }

    let acumulado = `

    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">

        <label class="novo_titulo">Retorno de Materiais</label>

    </div>
    
    <table id="tabelaRetornoMateriais" style="border-collapse: collapse; border: 1px solid black; background-color: white; width: 100%; text-align: center;">

        <tr style="border: 1px solid black;">

            <th style="border: 1px solid black; color: black; padding: 8px;">Descrição</th>
            <th style="border: 1px solid black; color: black; padding: 8px;">Quantidade Disponivel</th>
            <th style="border: 1px solid black; color: black; padding: 8px;">Quantidade para Retorno</th>

        </tr>`

    if (retornoAtual) {

        Object.values(orcamento.dados_composicoes).forEach(item => {

            acumulado += `<tr style="border: 1px solid black;">

        <td class="dados_descricao_retorno" data-codigo="${item.codigo}" style="border: 1px solid black; color: black; padding: 8px;">${dados_composicoes[item.codigo].descricao}</td>
        <td style="border: 1px solid black; color: black; padding: 8px;">${item.qtde}</td>
        <td style="border: 1px solid black; color: black; padding: 8px;"><input class="dados_qtde_retorno" type="number" value="${retornoAtual[item.codigo]}" ></td>

    </tr>`

        })
    } else {

        Object.values(orcamento.dados_composicoes).forEach(item => {

            acumulado += `<tr style="border: 1px solid black;">

        <td class="dados_descricao_retorno" data-codigo="${item.codigo}" style="border: 1px solid black; color: black; padding: 8px;">${dados_composicoes[item.codigo].descricao}</td>
        <td style="border: 1px solid black; color: black; padding: 8px;">${item.qtde}</td>
        <td style="border: 1px solid black; color: black; padding: 8px;"><input class="dados_qtde_retorno" type="number" " ></td>

    </tr>`

        })
    }

    acumulado += `
    
    </table>
    
    <button id="botao_salvar_retorno" onclick="salvar_materiais_retorno('${chave_pedido}', ${chave2})">Salvar</button>

    `

    openPopup_v2(acumulado)

}

async function salvar_materiais_retorno(chave_pedido, chave2) {

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

    if (!chave2) {
        chave2 = unicoID()
    }
    let data_completa = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status[chave_pedido].status = 'RETORNO DE MATERIAIS'
    orcamento.status[chave_pedido].historico[chave2] = {
        status: 'RETORNO DE MATERIAIS',
        data: data_completa,
        executor: acesso.usuario,
        materiaisRetorno: dadosMateriaisRetorno
    };

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave_pedido}/historico/${chave2}`, codificarUTF8(orcamento.status[chave_pedido].historico[chave2]))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    abrir_esquema(id_orcam)

}

async function alterar_status_principal(select, chave) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var orcamento = dados_orcamentos[id_orcam]

    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    orcamento.status[chave].status = select.value
    orcamento.status[chave].alterado_por = acesso.usuario
    orcamento.status[chave].alterado_quando = data

    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/status`, select.value)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/alterado_por`, acesso.usuario)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave}/alterado_quando`, data)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    abrir_esquema(id_orcam)

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

async function envio_de_material(chave1, id_orcam, chave2) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcam]
    let envio = {}
    let funcao = `registrar_envio_material('${chave1}', '${id_orcam}')`
    let comentario = ''
    if (chave2 !== undefined) {
        envio = orcamento.status[chave1].historico[chave2].envio
        funcao = `registrar_envio_material('${chave1}', '${id_orcam}', '${chave2}')`
        comentario = orcamento.status[chave1].historico[chave2].comentario
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
            <input id="rastreio" value="${envio?.rastreio}">
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
            <input id="nf" value="${envio.nf}">
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

        <hr style="width: 80%;">

        <div class="pergunta">
            <label>Apenas quando o material for entregue, preencha esta data</label>
            <input type="date" id="entrega" value="${envio.entrega}">
        </div>

        <hr style="width: 80%;">

        <button style="background-color: #4CAF50; width: 100%; margin: 0px;" onclick="${funcao}">Salvar</button>
      
    </div>
    `
    openPopup_v2(acumulado)

}

async function registrar_envio_material(chave1, id_orcam, chave2) {

    var campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario_envio', 'volumes', 'data_saida', 'previsao', 'entrega']
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
    let historico = dados_orcamentos[id_orcam].status[chave1].historico
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let st = status.envio.entrega !== '' ? 'MATERIAL ENTREGUE' : 'MATERIAL ENVIADO'

    status.anexos = {}
    status.executor = acesso.usuario
    status.data = data_status
    status.status = st
    dados_orcamentos[id_orcam].status[chave1].status = st

    let id = gerar_id_5_digitos()
    if (chave2 !== undefined) {
        id = chave2
    }

    historico[id] = status
    remover_popup()
    abrir_esquema(id_orcam)

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave1}/historico/${id}`, codificarUTF8(status))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave1}/status`, st)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())

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

    for (chave2 in historico) {
        if (historico[chave2].requisicoes) {
            var requisicoes = historico[chave2].requisicoes

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

function confirmar_exclusao_comentario(id_comentario, chave1, chave2) {

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Excluir o comentário?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="excluir_comentario('${id_comentario}', ${chave1}, '${chave2}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

async function excluir_comentario(id_comentario, chave1, chave2) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let comentarios = dados_orcamentos[id_orcam].status[chave1].historico[chave2].comentarios || {}

    delete comentarios[id_comentario]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await deletar(`dados_orcamentos/${id_orcam}/status/${chave1}/historico/${chave2}/comentarios/${id_comentario}`)
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())
    await carregar_comentarios(chave1, chave2)

}

async function carregar_comentarios(chave1, chave2) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let comentss = ''
    if (dados_orcamentos[id_orcam].status[chave1] && dados_orcamentos[id_orcam].status[chave1].historico[chave2]) {

        let comentarios = dados_orcamentos[id_orcam].status[chave1].historico[chave2].comentarios || {}

        for (it in comentarios) {

            let item = comentarios[it]
            let excluir = ''

            if (acesso.usuario == item.usuario || acesso.permissao == 'adm') {
                excluir = ` •<label onclick="confirmar_exclusao_comentario('${it}', ${chave1}, '${chave2}')" style="text-decoration: underline; cursor: pointer;"> Excluir</label>`
            }

            comentss += `
            <div class="anexos" style="width: 95%;">
                <label>${item.comentario.replace(/\n/g, '<br>')}
                <br><strong>${item.data} • ${item.usuario}</strong>${excluir}</label>
            </div>
        `
        }

    }

    let div_caixa = document.getElementById(`caixa_comentarios_${chave2}`)
    if (div_caixa) {
        div_caixa.innerHTML = comentss
    } else {
        return comentss
    }
}

async function salvar_comentario_trello(chave1, chave2) {

    toggle_comentario(`comentario_${chave2}`)
    let id_div = `comentario_${chave2}`
    let textarea = document.getElementById(id_div).querySelector('textarea')
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let orcamento = dados_orcamentos[id_orcam]

    var id = unicoID()

    var comentario = {
        id: id,
        chave2: chave2,
        comentario: textarea.value,
        data: data_atual('completa'),
        usuario: acesso.usuario
    }
    let cartao = orcamento.status[chave1].historico[chave2]
    if (!cartao.comentarios) {
        cartao.comentarios = {}
    }

    cartao.comentarios[id] = comentario

    textarea.value = ''

    await enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave1}/historico/${chave2}/comentarios/${id}`, codificarUTF8(comentario))
    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())
    await carregar_comentarios(chave1, chave2)

}


function toggle_comentario(id) {
    var elemento = document.getElementById(id)
    if (elemento.style.display == 'none') {
        elemento.style.display = 'flex'
    } else {
        elemento.style.display = 'none'
    }
}

function selecionar_etiqueta() {

    var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {}

    var etiquetas = ''
    Object.keys(dados_etiquetas).forEach(et => {

        var etiqueta = dados_etiquetas[et]
        etiquetas += `
        <div class="contorno_botoes" style="background-color: ${etiqueta.cor}; font-size: 0.7em;" onclick="associar_etiqueta('${id_orcam}', '${et}')">
        ${etiqueta.nome}
        </div>
        `
    })

    var acumulado = `
    <label class="novo_titulo">Etiquetas</label>
    <div class="contorno_botoes" style="background-color: white; display; flex; gap: 10px; justify-content: center; align-items: center;">
        <input placeholder="Nova Etiqueta" id="etiqueta_nome">
        <input type="color" id="etiqueta_cor">
        <label style="color: #222;" onclick="nova_etiqueta()">Salvar</label>
    </div>
    <div>
    ${etiquetas}
    </div>
    `

    openPopup_v2(acumulado)

}

function nova_etiqueta() {

    var cor = document.getElementById('etiqueta_cor')
    var nome = document.getElementById('etiqueta_nome')

    if (cor && nome) {

        var id = unicoID()
        var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {}

        dados_etiquetas[id] = {
            nome: nome.value,
            cor: cor.value
        }

        nova_etiqueta_api(id, nome.value, cor.value)

        localStorage.setItem('dados_etiquetas', JSON.stringify(dados_etiquetas))

        remover_popup()
        selecionar_etiqueta()

    }
}

function nova_etiqueta_api(id, nome, cor) {

    var dados = {
        'tabela': 'nova_etiqueta',
        'nome': nome,
        'cor': cor,
        'id': id
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

async function associar_etiqueta(id, id_etiqueta) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (!dados_orcamentos[id].etiqueta) {
        dados_orcamentos[id].etiqueta = {}
    }
    var dt = data_atual('completa')
    dados_orcamentos[id].etiqueta[id_etiqueta] = dt

    atualizar_etiqueta(id, id_etiqueta, dt)

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    fechar_estrutura()
    abrir_esquema(id)

    inicializar()
}


function remover_etiqueta(id, id_etiqueta) {

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Remover a etiqueta?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="remover_mesmo_a_etiqueta('${id}', '${id_etiqueta}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)

}

async function remover_mesmo_a_etiqueta(id, id_etiqueta) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    delete dados_orcamentos[id].etiqueta[id_etiqueta]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    atualizar_etiqueta(id, id_etiqueta, undefined, 'excluir')

    fechar_estrutura()
    abrir_esquema(id)

    remover_popup()

    var quadro = document.getElementById('quadro')
    if (quadro) {
        inicializar()
    }
}

function pesquisar_pagamentos(chave) {

    var todos_os_pagamentos = document.getElementById('div_pagamentos_pesquisa_' + chave)
    var pesquisa = String(document.getElementById(chave).value).toLowerCase()

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

function chamar_excluir_anexo(chave_pedido, chave2, key_anx) {

    openPopup_v2("Deseja excluir o anexo?", true, `excluir_anexo('${chave_pedido}', '${chave2}', '${key_anx}')`)

}


async function excluir_anexo(chave, chave2, chave_anexo) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    delete dados_orcamentos[id_orcam].status[chave].historico[chave2].anexos[chave_anexo]

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    excluir_status_na_nuvem(chave, chave2, chave_anexo)

    remover_popup()

    abrir_esquema(id_orcam)

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

async function detalhar_requisicao(chave, apenas_visualizar, chave2) {

    var painel_status = document.getElementById('status')
    if (painel_status) {
        painel_status.remove()
    }

    itens_adicionais = {}
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var usuario = acesso.usuario
    var data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    fechar_espelho_ocorrencias()

    overlay.style.display = 'block'

    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    orcamento = dados_orcamentos[id_orcam];

    var requisicao = {}
    var menu_flutuante = ''

    if (chave2) {

        menu_flutuante = `
        <div class="menu_flutuante" id="menu_flutuante">
            <div class="icone" onclick="gerarpdf('${orcamento.dados_orcam.cliente_selecionado}', '${orcamento.status[chave].pedido}')">
                <img src="imagens/pdf.png">
                <label>PDF</label>
            </div>
            <div class="icone" onclick="excel()">
                <img src="imagens/excel.png">
                <label>Excel</label>
            </div>
        </div> 
        `

        if (orcamento.status[chave].historico[chave2].adicionais) {
            itens_adicionais = orcamento.status[chave].historico[chave2].adicionais
        }

        if (orcamento.status[chave].historico[chave2].requisicoes) {
            orcamento.status[chave].historico[chave2].requisicoes.forEach(item => {
                requisicao[item.codigo] = {
                    partnumber: item.partnumber,
                    requisicao: item.requisicao,
                    tipo: item.tipo,
                    qtde_enviar: item.qtde_enviar
                }
            })
        }

    }

    var nome_cliente = orcamento.dados_orcam.cliente_selecionado
    var campos = ''
    var toolbar = ''

    if (!apenas_visualizar) {
        toolbar += `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; background-color: #151749; border-top-left-radius: 5px; border-top-right-radius: 5px">
            <img src="imagens/pesquisar.png" style="width: 25px; height: 25px; padding: 5px;">
            <input id="pesquisa1" style="padding: 10px; border-radius: 5px; margin: 10px; width: 50%;" placeholder="Pesquisar" oninput="pesquisar_na_requisicao()">
        </div>
        `
        var funcao = `salvar_requisicao('${chave}', '${chave2}')`
        if (chave2 == undefined) {
            funcao = `salvar_requisicao('${chave}')`
        }

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

                <label class="contorno_botoes" style="background-color: #4CAF50; " onclick="${funcao}">Salvar Requisição</label>
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
                <label style="color: #222"><strong>Número do Pedido</strong> ${orcamento.status[chave].pedido}</label>
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
            ${await carregar_itens(apenas_visualizar, requisicao)}
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

    var comentario_status = document.getElementById('comentario_status')
    if (comentario_status && chave2 !== undefined) {
        comentario_status.value = orcamento.status[chave].historico[chave2].comentario
    }

    await calcular_requisicao()
    mostrar_itens_adicionais()

}

function close_chave() {
    exibir_todos_os_status(id_orcam)
    document.getElementById('alerta').remove()
}

async function salvar_anexo(chave1, chave2) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    var elemento = chave1 !== undefined
        ? document.getElementById(`adicionar_anexo_${chave1}_${chave2}`)
        : document.getElementById(`adicionar_anexo`);

    var files = elemento.files;

    if (!files || files.length === 0) {
        openPopup_v2('Nenhum arquivo selecionado...');
        return;
    }

    openPopup_v2(`
        <div id="carregandhu" style="display: flex; align-items: center; justify-content: center;">
        </div>
    `);

    carregamento('carregandhu');

    let promises = [];

    for (let file of files) {
        let promise = new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = async (e) => {
                var base64 = e.target.result.split(',')[1];
                var mimeType = file.type;

                try {
                    var response = await fetch('http://localhost:3000/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: file.name,
                            mimeType: mimeType,
                            base64: base64
                        })
                    });

                    if (response.ok) {
                        var result = await response.json();
                        resolve({ file, result });
                    } else {
                        var errorResult = await response.json();
                        reject(new Error(errorResult.message || 'Erro desconhecido ao fazer upload.'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.readAsDataURL(file);
        });

        promises.push(promise);
    }

    Promise.all(promises)
        .then(results => {
            results.forEach(({ file, result }) => {
                if (chave1 === undefined && chave2 === undefined) {
                    let div_anexos = document.getElementById('div_anexos')

                    if (div_anexos) {
                        let id = gerar_id_5_digitos();

                        anexos[id] = {
                            nome: file.name,
                            formato: file.type,
                            link: result.fileId
                        };

                        let resposta = `
                            <div id="${id}" class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                                <div class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                    <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                                    <label style="font-size: 0.8em;">${String(file.name).slice(0, 10)} ... ${String(file.name).slice(-7)}</label>
                                </div>
                                <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="remover_anexo('${id}')">
                            </div>
                            `;

                        div_anexos.style = 'align-items: normal';
                        div_anexos.insertAdjacentHTML('beforeend', resposta);
                    }

                } else {

                    if (Array.isArray(dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos) || !dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos) {
                        dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos = {};
                    }

                    let id_anx = gerar_id_5_digitos()
                    let anx = {
                        nome: file.name,
                        formato: file.type,
                        link: result.fileId
                    }

                    dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos[id_anx] = anx

                    inserirDados(dados_orcamentos, 'dados_orcamentos');
                    enviar('PUT', `dados_orcamentos/${id_orcam}/status/${chave1}/historico/${chave2}/anexos/${id_anx}`, codificarUTF8(anx))

                    var estrutura = document.getElementById('estrutura');
                    if (estrutura) {
                        estrutura.remove();
                    }
                    abrir_esquema(id_orcam);
                }

            });

        })
        .catch(error => {
            openPopup_v2(`Erro ao fazer upload: ${error.message}`);
            console.error(error);
        });

    remover_popup();
}


function remover_anexo(id) {
    let div = document.getElementById(id)
    if (anexos && div) {
        div.remove()
        delete anexos[id]
    }
}

// `https://drive.google.com/file/d/${exemplo}/view?usp=drivesdk`

async function excluir_status_na_nuvem(chave1, chave2, chave_anexo) {

    var dados = {
        'id': id_orcam,
        'tabela': 'orcamento_status',
        'operacao': 'excluir_anexo',
        chave1,
        chave2,
        chave_anexo
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

function deseja_apagar(chave1, chave2) {

    let funcao = chave2 == undefined ? `apagar_status_historico('${chave1}')` : `apagar_status_historico('${chave1}', '${chave2}')`

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <label>Deseja apagar essa informação?</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button style="background-color: green" onclick="${funcao}">Confirmar</button>
                <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

async function apagar_status_historico(chave1, chave2) {

    remover_popup()

    remover_cotacao(chave2)

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (chave2 == undefined || chave2 == 'undefined') {
        delete dados_orcamentos[id_orcam].status[chave1]
        await deletar(`dados_orcamentos/${id_orcam}/status/${chave1}`)

    } else {
        delete dados_orcamentos[id_orcam].status[chave1].historico[chave2]
        await deletar(`dados_orcamentos/${id_orcam}/status/${chave1}/historico/${chave2}`)

    }

    await enviar('PUT', `dados_orcamentos/${id_orcam}/timestamp`, Date.now())
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    fechar_estrutura()
    abrir_esquema(id_orcam)

}

function remover_cotacao(chave2) {

    let status = "excluido";
    let operacao = "excluir";
    let idCotacao = chave2

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
        await enviar('PUT', `dados_composicoes/${codigo}/partnumber`, codificarUTF8(partnumber))
        await enviar('PUT', `dados_composicoes/${codigo}/timestamp`, Date.now())
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
        </style>
    </head>
    <body>
        ${status.innerHTML}
    </body>
    </html>`;

    if (pedido.includes("?")) {
        pedido = ""
    }

    const formData = {
        htmlContent: htmlContent,
        nomeArquivo: `REQUISICAO_${cliente}_${pedido}`
    };

    // Envia para salvar o PDF localmente
    ipcRenderer.send('generate-pdf-local', formData);

    ipcRenderer.once('generate-pdf-local-reply', (event, response) => {
        if (response.success) {
            console.log('PDF gerado com sucesso!', response.filePath);
        } else {
            console.error('Erro ao gerar PDF:', response.error);
        }

    });

    if (menu_flutuante) {
        menu_flutuante.style.display = 'flex'
    }

}