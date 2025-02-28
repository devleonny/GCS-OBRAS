document.addEventListener("DOMContentLoaded", function () {
    let tipo = localStorage.getItem("ativarPendencias");

    if (tipo != null) {
        mostrar_apenas_pendencias(tipo);
        localStorage.removeItem("ativarPendencias");
    }
});

var status_deste_modulo = [];
var modulo = localStorage.getItem('modulo_ativo') || ''
var filtrosAtivos = {};
var filtrosAtivosPagamentos = {};
var intervaloCompleto;
var intervaloCurto;
let filtro_manutencao = {}

preencher_orcamentos_v2()

function pesquisar_v2(coluna, texto) {

    filtrosAtivos[coluna] = texto.toLowerCase();

    var tabela_itens = document.getElementById('orcamentos');
    var trs = tabela_itens.querySelectorAll('tr');

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtrosAtivos) {
            var filtroTexto = filtrosAtivos[col];

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

function filtros_de_orcamento(dados) {
    let dados_filtrados = {
        gerente: {},
        diretoria: {}
    }

    for (st_existentes in fluxograma) {
        dados_filtrados[st_existentes] = {}
    }

    for (id in dados) {
        let orcamento = dados[id]

        if (orcamento.status) {

            let pedidos = orcamento.status

            for (chave1 in pedidos) {
                let pedido = pedidos[chave1]
                if (String(pedido.pedido).includes('?')) {

                    if (conversor(orcamento.total_geral) > 20000) {
                        dados_filtrados.diretoria[id] = orcamento
                    }

                    dados_filtrados.gerente[id] = orcamento

                }

                if (pedido.historico) {

                    let ultimo_status = pedido.finalizado ? 'FINALIZADO' : ultimoStatus(pedido.historico)

                    if (!dados_filtrados[ultimo_status]) {
                        dados_filtrados[ultimo_status] = {}
                    }
                    dados_filtrados[ultimo_status][id] = orcamento
                }

            }

        } else {

            if (!dados_filtrados['INCLUIR PEDIDO']) {
                dados_filtrados['INCLUIR PEDIDO'] = {}
            }
            dados_filtrados['INCLUIR PEDIDO'][id] = orcamento

        }
    }

    return dados_filtrados

}

async function mostrar_apenas_pendencias(filtros) {

    localStorage.setItem('filtroAtivo', filtros)

    if (filtros == 'gerente' || filtros == 'diretoria') {
        localStorage.setItem('modulo_ativo', 'RELATÓRIOS')
        modulo = 'RELATÓRIOS'
    }

    await preencher_orcamentos_v2(filtros)

    let chamados = document.getElementById('chamados')
    if (chamados) {
        chamados.remove()
    }

    botao_limpar_painel_direito()

}

function botao_limpar_painel_direito() {

    let painel_direito = document.getElementById('painel_direito')

    if (painel_direito) {
        painel_direito.innerHTML = `
            <div class="block_reverso" style="background-color: #222222bf;" onclick="preencher_orcamentos_v2(undefined, true)">
                <img src="imagens/cancelar.png" style="width: 50px;">
                <p style="font-size: 0.8vw;">DESFAZER FILTRO</p>
            </div>
        `
    }

}

async function preencher_orcamentos_v2(filtros, remover) {

    var div_orcamentos = document.getElementById('orcamentos')
    if (!div_orcamentos) {
        return
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (Object.keys(dados_orcamentos).length == 0) {
        await recuperar_orcamentos()
        dados_orcamentos = await recuperarDados('dados_orcamentos')
    }

    let dados_filtrados = filtros_de_orcamento(dados_orcamentos)

    if (remover) {
        localStorage.removeItem('filtroAtivo')

    } else {
        let filtroAtivo = localStorage.getItem('filtroAtivo')

        if (filtros == undefined && filtroAtivo) {
            filtros = filtroAtivo
        }

        if (filtros !== undefined) {
            dados_orcamentos = dados_filtrados[filtros]
        }
    }

    document.getElementById('nome_modulo').textContent = modulo

    //Resetar a tabela caso o filtro não pertença ao módulo;
    if (fluxograma[filtros]) {

        let reiniciar = true
        let modulos = fluxograma[filtros].modulos

        modulos.forEach(mod => {
            if (modulo == mod) {
                reiniciar = false
            }
        })

        if (reiniciar) {
            localStorage.removeItem('filtroAtivo')
            return preencher_orcamentos_v2()
        }
    }
    //Fim

    let proximo = filtros

    if (fluxograma[filtros] && fluxograma[filtros].proximo) {
        proximo = fluxograma[filtros].proximo
    }

    document.getElementById('nome_filtro').textContent = proximo

    var desordenado = Object.entries(dados_orcamentos);
    desordenado.sort((a, b) => new Date(b[1].dados_orcam.data) - new Date(a[1].dados_orcam.data));
    dados_orcamentos = Object.fromEntries(desordenado);

    if (div_orcamentos) {

        var linhas = ''
        var status_deste_modulo = {}

        for (orcamento in dados_orcamentos) {

            var orc = dados_orcamentos[orcamento]
            var dados_orcam = orc.dados_orcam
            var data = new Date(dados_orcam.data).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            })

            var exibir_linha = true
            var pedidos = orc.status || {}
            var label_pedidos = ''
            var label_notas = ''

            for (pedido in pedidos) {
                let chave_pedido = pedidos[pedido]
                let historico = chave_pedido.historico

                let ultimo_status = chave_pedido.finalizado ? 'FINALIZADO' : ultimoStatus(historico)

                if (fluxograma[ultimo_status]) { // Contagem de pendências;

                    var modulos = fluxograma[ultimo_status].modulos
                    if (!modulos.includes(modulo)) {
                        exibir_linha = false

                    } else {
                        if (!status_deste_modulo[ultimo_status]) {
                            status_deste_modulo[ultimo_status] = 0
                        }
                        status_deste_modulo[ultimo_status] += 1
                    }

                }

                for (chave2 in historico) {

                    let chave_historico = historico[chave2]
                    let status = chave_historico.status

                    if (status == 'PEDIDO') {

                        let num_pedido = chave_historico.pedido
                        let tipo = chave_historico.tipo
                        let cor;

                        tipo == 'Venda' ? cor = '#ff9c24' : cor = '#00bfb7'

                        label_pedidos += `
                        <div class="etiqueta_pedidos"> 
                            <label style="font-size: 0.6vw;">${tipo}</label>
                            <label style="font-size: 0.7vw; margin: 2px;"><strong>${num_pedido}</strong></label>
                        </div>
                        `
                    }

                    if (chave_historico.notas) {
                        let cor;
                        var nota = chave_historico.notas[0]
                        nota.modalidade == 'Venda' ? cor = '#ff9c24' : cor = '#00bfb7'
                        label_notas += `
                        <div class="etiqueta_pedidos">
                            <label style="font-size: 0.8em; margin: 2px;">${nota.modalidade}</label>
                            <label style="font-size: 1.1em; margin: 2px;"><strong>${nota.nota}</strong></label>
                        </div>
                        `
                    }

                }

            }

            if (Object.keys(pedidos).length == 0) {

                let sx = 'INCLUIR PEDIDO'
                var modulos = fluxograma[sx].modulos
                if (!modulos.includes(modulo)) {
                    exibir_linha = false

                } else {
                    if (!status_deste_modulo[sx]) {
                        status_deste_modulo[sx] = 0
                    }
                    status_deste_modulo[sx] += 1
                }

            }

            let cor = '#ffc584'
            let fonte = 'black'

            if (orc.aprovacao && Object.keys(orc.aprovacao).length > 0) {

                let responsaveis = orc.aprovacao
                let valor = conversor(orc.total_geral)
                let gerente = false
                let diretoria = false

                if (responsaveis.Gerente && responsaveis.Gerente.status) {
                    let st = responsaveis.Gerente.status
                    gerente = st == 'aprovado' ? true : false
                }

                if (responsaveis.Diretoria && responsaveis.Diretoria.status) {
                    let st = responsaveis.Diretoria.status
                    diretoria = st == 'aprovado' ? true : false
                }

                if (valor > 21000) {
                    if (diretoria) {
                        cor = '#4CAF50';
                    } else if (gerente) {
                        cor = '#9cc0e0';
                    } else {
                        cor = '#ff7777';
                    }
                } else {
                    cor = gerente ? '#4CAF50' : '#ff7777';
                }

            }

            if (orc.status && cor == '#ffc584') {
                let pedidos = orc.status
                for (id in pedidos) {
                    let pedido = pedidos[id]
                    if (!String(pedido.pedido).includes('?')) {
                        cor = '#4CAF50'
                    }
                }
            }

            if (exibir_linha) {
                linhas += `
                <tr style="background-color: ${cor}; color: ${fonte};">
                    <td>${data}</td>
                    <td>${label_pedidos}</td>
                    <td>${label_notas}</td>
                    <td>${dados_orcam.contrato}</td>
                    <td>${dados_orcam.cliente_selecionado}</td>
                    <td>${dados_orcam.cidade}</td>
                    <td>${dados_orcam.analista}</td>
                    <td style="white-space: nowrap;">${orc.total_geral}</td>
                    <td style="white-space: nowrap;">${orc.lpu_ativa}</td>
                    <td style="text-align: center;" onclick="exibir_todos_os_status('${orcamento}')">
                        <img src="imagens/pesquisar3.png" style="width: 2vw; cursor: pointer;">
                    </td>
                </tr>
                `
            }
        }

        let infos = {
            orcamentos: [
                { cor: '#ffc584', label: 'Sem Pedido' },
                { cor: '#4CAF50', label: 'Aprovado' },
                { cor: '#ff7777', label: 'Reprovado' },
                { cor: '#80bbef', label: 'Diretoria Pendente' },
            ],
            requisições: [
                { cor: '#b3b3b3', label: 'Requisição Avulsa' },
                { cor: '#ffc584', label: 'Manutenção' },
                { cor: '#ff7777', label: 'Reprovado' },
                { cor: '#09e6d9', label: 'Material Separado' },
                { cor: '#80bbef', label: 'Material Enviado' },
                { cor: '#4CAF50', label: 'Material Recebido' },
            ]
        }

        let div = ''
        for (tab in infos) {
            let elementos = ''
            let info = infos[tab]
            for (item in info) {
                let cor = info[item].cor
                let label = info[item].label
                elementos += `
                    <div style="display: flex; align-items: center; justify-content: start; gap: 10px; color: white;">
                        <label class="numero" style="background-color: ${cor}; width: 1vw; height: 1vw;"></label>
                        <label>${label}</label>
                    </div>
                `
            }
            div += `
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 1px;">
                <label style="color: white;">${tab.toUpperCase()}</label>
                <hr style="width: 100%;">
                ${elementos}
            </div>
            `
        }

        var painel_direito = document.getElementById('painel_direito')
        let atalhos = `
        <div style="display: flex; justify-content: center; align-items: start; gap: 5px;">
            ${div}
        </div>
        `
        if (filtros) {
            botao_limpar_painel_direito()
        } else {
            atalhos += `
            <div class="block" onclick="window.location.href = 'adicionar.html'">
                <img src="imagens/projeto.png" style="width: 50px;">
                <p style="font-size: 0.8vw;">CRIAR ORÇAMENTO</p>
            </div>
            `
            if (modulo == 'CHAMADOS') {
                atalhos += `
                <div class="block" onclick="criar_manutencao()">
                    <img src="imagens/chamados.png" style="width: 50px;">
                    <p style="font-size: 0.8vw;">CRIAR MANUTENÇÃO</p>
                </div>
                `
            }

            for (var atalho in status_deste_modulo) {
                let quantidade = status_deste_modulo[atalho]

                let proximo = atalho

                if (fluxograma[atalho] && fluxograma[atalho].proximo) {
                    proximo = fluxograma[atalho].proximo
                }

                atalhos += `
                    <div class="block" style="background-color: #222222bf;" onclick="mostrar_apenas_pendencias('${atalho}')">
                        <div style="width: 50px; height: 50px; display: flex; justify-content: center; align-items: center;">
                            <label style="font-size: 1.5vw; color: white;">${quantidade}</label>
                        </div>
                        <label style="font-size: 0.8vw; cursor: pointer; color: white;">${proximo}</label>
                    </div>
                `
            }

            painel_direito.innerHTML = atalhos
        }

        var cabecs = ['Última alteração', 'Pedido', 'Notas', 'Chamado', 'Cliente', 'Cidade', 'Analista', 'Valor', 'LPU', 'Ações']
        var ths = ''
        var tsh = ''
        cabecs.forEach((cab, i) => {

            ths += `
            <th style="text-align: center;">${cab}</th>
            `
            if (cab !== 'Ações' && cab !== 'Aprovação') {
                tsh += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="position: relative;">
                        <input placeholder="..." style="text-align: left;" oninput="pesquisar_v2(${i}, this.value)">
                        <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    </div>
                </th>
            `} else {
                tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
            }
        })

        let linhas_orcamento = document.getElementById('linhas_orcamento')

        if (linhas !== '') {

            let toolbar = document.getElementById('toolbar')
            toolbar.innerHTML = ''

            let label = `<label style="background-color: #222;" onclick="mostrar_tabela('orcamentos_')">ORÇAMENTOS</label>`
            toolbar.insertAdjacentHTML('beforeend', label)

            if (linhas_orcamento) {
                linhas_orcamento.innerHTML = linhas

            } else {

                div_orcamentos.innerHTML = ''
                let tabela = `
                    <table id="orcamentos_" class="tabela" style="font-size: 0.8vw; background-color: #222;">
                        <thead>
                            ${ths}
                        </thead>
                        <thead id="tsh">
                            ${tsh}
                        </thead>
                        <tbody id="linhas_orcamento">
                            ${linhas}
                        </tbody>
                    </table>
                    `
                div_orcamentos.insertAdjacentHTML('beforeend', tabela)
            }
        }
    }

    await carregar_manutencoes()

}

async function recuperar_orcamentos() {

    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    let dados_orcamentos = await receber('dados_orcamentos') || {}
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    let dados_manutencao = await receber('dados_manutencao') || {}
    await inserirDados(dados_manutencao, 'dados_manutencao')

    if (document.title == 'ORÇAMENTOS') {

        await preencher_orcamentos_v2()

    }
    document.getElementById("aguarde").remove()
}

async function abrir_manutencao(id) {
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let dados_clientes_omie = {}

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    await criar_manutencao(id)
    let manutencao = dados_manutencao[id]
    let pecas = manutencao.pecas

    document.getElementById('comentario').value = manutencao.comentario
    document.getElementById('status_manutencao').value = manutencao.status_manutencao
    document.getElementById('chamado').value = manutencao.chamado

    if (manutencao.chamado == 'KIT TÉCNICO') {
        document.getElementById('kit').checked = true
        document.getElementById('div_chamado').style.display = 'none'
    }

    let pessoas = ['tecnico', 'cliente']

    pessoas.forEach(pessoa => {

        let chave = `codigo_${pessoa}`

        if (manutencao[chave] && manutencao[chave] !== '') {

            let item = dados_clientes_omie[manutencao[chave]]
            document.getElementById(chave).textContent = manutencao[chave]
            document.getElementById(pessoa).value = item.nome
            document.getElementById(`endereco_${pessoa}`).innerHTML = `
                <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
                <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
                <label><strong>CEP:</strong> ${item.cep}</label>
                <label><strong>Cidade:</strong> ${item.cidade}</label>
                <label><strong>Estado:</strong> ${item.estado}</label>        
            `
        }
    })

    let tamanho = Object.keys(pecas).length
    for (let i = 0; i < tamanho; i++) {
        adicionar_linha_manut()
    }

    let linhas_manutencao = document.getElementById('linhas_manutencao')
    let linhas = linhas_manutencao.querySelectorAll('.linha')

    let i = 0
    for (id_peca in pecas) {
        let peca = pecas[id_peca]
        let celulas = linhas[i].querySelectorAll('input, textarea')

        let estoques = ['estoque', 'estoque_usado']

        let dic_quantidades = {}

        estoques.forEach(estoque => {

            let estoque_do_objeto = dados_estoque[peca.codigo][estoque]
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

        })

        celulas[0].value = peca.descricao
        celulas[1].value = peca.codigo
        celulas[2].value = peca.quantidade
        celulas[3].value = peca.comentario
        celulas[4].value = dic_quantidades.estoque
        celulas[5].value = dic_quantidades.estoque_usado

        i++
    }

    let div_historico = document.getElementById('historico')

    let historicos = {}
    if (manutencao.historico) {
        historicos = manutencao.historico
    }

    historicos[id] = manutencao // Acrescentei o objeto atual para que ele entre no histórico;
    let infos = ''

    for (his in historicos) {
        let historico = historicos[his]
        let imagem;

        switch (historico.status_manutencao) {
            case 'MANUTENÇÃO':
                imagem = 'avencer'
                break
            case 'REQUISIÇÃO AVULSA':
                imagem = 'avulso'
                break
            case 'MATERIAL SEPARADO':
                imagem = 'estoque'
                break
            case 'MATERIAL ENVIADO':
                imagem = 'logistica'
                break
            case 'MATERIAL RECEBIDO':
                imagem = 'concluido'
                break
            default:
                imagem = 'cancel'
        }

        infos += `
            <div style="display: flex; align-items: center; justify-content: space-evenly;">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; font-size: 0.8vw;">
                    <label><strong>Data:</strong> ${historico.data}</label>
                    <label><strong>Status:</strong> ${historico.status_manutencao}</label>
                    <label><strong>Usuário:</strong> ${historico.usuario}</label>
                    <label><strong>Comentário:</strong></label>
                    <textarea style="width: 20vw;" readOnly>${historico.comentario}</textarea>
                </div>
                <img src="imagens/${imagem}.png">
            </div>
            <hr style="width: 80%;">
            `
    }

    let elemento = `
        <br>
            
            <div style="background-color: #151749; border-top-left-radius: 3px; border-top-right-radius: 3px; width: 70vw; padding: 5px;">Histórico</div>

            <div style="width: 70vw; background-color: #d2d2d2; color: #222; padding: 5px;">
                ${infos}
            </div>
        `

    div_historico.insertAdjacentHTML('beforeend', elemento)

}

async function capturar_html_pdf(id) {

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}
    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    let manutencao = dados_manutencao[id]
    let campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    let pessoas = ['tecnico', 'cliente']
    let divs = ''

    pessoas.forEach(pessoa => {
        let elementos = ''
        let codigo = manutencao[`codigo_${pessoa}`]

        if (codigo !== '') {
            let dados = dados_clientes_omie[codigo] || {}

            campos.forEach(campo => {
                elementos += `<label style="text-align: left;"><strong>${campo.toUpperCase()}: </strong>${dados[campo]}</label>`
            })

            divs += `
                <div style="display: flex; flex-direction: column; aling-items: start; justify-content: left;">
                    <label style="font-size: 1.5em;">${pessoa.toUpperCase()}</label>
                    ${elementos}
                </div>
        `}
    })

    let cabecalho = `
        <div style="display: flex; align-items: start; justify-content: left; gap: 10vw;">
            ${divs}
        </div>
    `

    let pecas = manutencao.pecas
    let linhas = ''
    for (pc in pecas) {
        let peca = pecas[pc]
        linhas += `
        <tr>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario}</td>
            <td>${peca.descricao}</td>
        </tr>
        `
    }

    let tabela = `
        <label style="font-size: 1.5em;">REQUISIÇÃO ${manutencao.chamado}</label>
        <table>
            <thead>
                <th>Quantidade</th>
                <th>Comentário</th>
                <th>Descrição</th>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    `

    let html = `
        <html>

        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    justify-content: start;
                    align-items: start;
                    padding: 3vw;
                    gap: 10px;    
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.0em;
                }

                table {
                    font-size: 1.0em;
                    border-collapse: collapse;
                }
                
                th {
                    background-color: #d2d2d2;
                }

                th, td {
                    border: 1px solid #222;
                    padding: 3px;
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
            <div style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 20px;">
                <img src="https://i.imgur.com/qZLbNfb.png" style="width: 20vw; border-radius: 3px;">
                <label style="font-size: 2.0em;">Requisição de Materiais <br> Manutenção/Avulso</label>
            </div>
            <hr style="width: 90%;">
            ${cabecalho}
            <hr style="width: 90%;">
            ${tabela}
        </body>

        </html>
    `;

    let nome = `REQUISICAO ${manutencao.chamado}`

    await gerar_pdf_online(html, nome);

    remover_popup()
    await abrir_manutencao(id)
}

async function criar_manutencao(id) {
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {};
    let dados_manutencao = await recuperarDados('dados_manutencao') || {};

    let termo = 'Editar';
    let botao = 'Atualizar';
    let pdf = `
        <div onclick="capturar_html_pdf('${id}')" class="contorno_botoes" style="background-color: #B12425; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <img src="imagens/pdf.png" style="cursor: pointer; width: 40px;">
            <label>PDF</label>
        </div>`;

    if (!id) { // Se id for undefined, significa que estamos criando um novo registro
        termo = 'Criar';
        botao = 'Enviar para Logística';
        pdf = '';
        id = gerar_id_5_digitos(); // Gera um novo ID
    }

    let acumulado = `
        <img src="imagens/BG.png" style="height: 70px; position: absolute; top: 0; left: 0;">

        <label>${termo} <strong> Requisição de Materiais </strong></label>

        <div style="position: relative;" id="tela">

            <div id="div_geral" style="background-color: white; border-radius: 3px; padding: 5px; font-size: 0.9vw; width: 70vw;">
                <div style="position: relative; display: flex; align-items: center; justify-content: start; color: #222; background-color: #d2d2d2; padding: 5px; border-radius: 3px;">
                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                        <label style="font-size: 1.2vw;">Cliente | Loja</label>
                        <label id="codigo_cliente" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="cliente" oninput="sugestoes(this, 'sug_cliente', 'clientes')" placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_cliente"></div>
                        </div>
                        <div id="endereco_cliente" style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;"></div>
                    </div>

                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                        <label style="font-size: 1.2vw;">TÉCNICO</label>
                        <label id="codigo_tecnico" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="tecnico" oninput="sugestoes(this, 'sug_tecnico', 'clientes')" placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_tecnico"></div>
                        </div>
                        <div id="endereco_tecnico" style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;"></div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: start; gap: 5px;">
                        <div style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: start; gap: 20px;">
                            <label style="font-size: 1.2vw;">Status Manutenção</label>
                            <select id="status_manutencao" style="padding: 5px; border-radius: 3px; cursor: pointer; width: 10vw; font-size: 0.8vw;">
                                <option>MANUTENÇÃO</option>
                                <option>REQUISIÇÃO AVULSA</option>
                                <option>MATERIAL SEPARADO</option>
                                <option>MATERIAL ENVIADO</option>
                                <option>MATERIAL RECEBIDO</option>
                                <option>REPROVADO</option>
                            </select>
                        </div>
                        <div style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Kit Técnico</label>
                            <input id="kit" type="checkbox" style="width: 2vw; height: 2vw; cursor: pointer;" onclick="alterar_kit(this)">
                        </div>
                        <div id="div_chamado" style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Chamado</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text" placeholder="..." id="chamado">
                        </div>
                        <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                            <label style="font-size: 1.2vw;">Comentário</label>
                            <textarea type="text" placeholder="..." id="comentario"></textarea>
                        </div>
                    </div>
                </div>

                <div class="tabela_manutencao">
                    <div class="linha"
                        style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px;">
                        <div style="width: 25vw;">
                            <label>Descrição</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Quantidade</label>
                        </div>
                        <div style="width: 20vw;">
                            <label>Comentário</label>
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

                <div style="display: flex; align-items: start; justify-content: left; gap: 5px;">
                    <div onclick="adicionar_linha_manut()" class="contorno_botoes" style="background-color: #151749; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/chamados.png" style="cursor: pointer; width: 40px;">
                        <label>Adicionar Peça</label>
                    </div>
                    <div onclick="enviar_manutencao('${id}')" class="contorno_botoes" style="background-color: green; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/estoque.png" style="cursor: pointer; width: 40px;">
                        <label>${botao}</label>
                    </div>
                    ${pdf}`;

    // Verifica se o botão de exclusão deve ser exibido
    if (id && dados_manutencao[id] && (acesso.permissao === "adm" || acesso.usuario === dados_manutencao[id].usuario)) {
        acumulado += `
            <div class="contorno_botoes"
                style="background-color: red; display: flex; align-items: center; justify-content: center; gap: 10px;"
                onclick="excluir_manutencao('${id}')">
                <img src="imagens/excluir.png" style="cursor: pointer; width: 40px;">
                <label>Excluir</label>
            </div>`;
    }

    acumulado += `
            <div class="contorno_botoes"
                style="background-color: brown; display: flex; align-items: center; justify-content: center; gap: 10px;"
                onclick="atualizar_base_clientes_manutencao()">
                <img src="imagens/atualizar_2.png" style="cursor: pointer; width: 40px;">
                <label>Atualizar Base Clientes</label>
            </div>
                </div>
            </div>
        </div>

        <div id="historico"></div>

        <label id="data" style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8vw;">${data_atual('completa')}</label>
    `;

    openPopup_v2(acumulado);
}

async function atualizar_base_clientes_manutencao() {

    var div_geral = document.getElementById('div_geral')
    div_geral.insertAdjacentHTML("beforebegin", overlay_aguarde())
    let aguarde = document.getElementById("aguarde")

    if (div_geral) {

        await recuperar_clientes()

    }

    if(aguarde){

        aguarde.remove()

    }

}

async function excluir_manutencao(idManutencao) {
    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <label style="font-size: 1.2vw;">Tem certeza que deseja excluir esta manutenção?</label>
            <div style="display: flex; gap: 20px;">
                <button onclick="confirmar_exclusao('${idManutencao}')" 
                    style="background-color: red; color: white; padding: 10px 20px; border: none; cursor: pointer; font-size: 1vw;">
                    Sim, excluir
                </button>
                <button onclick="fecharPopup()" 
                    style="background-color: gray; color: white; padding: 10px 20px; border: none; cursor: pointer; font-size: 1vw;">
                    Cancelar
                </button>
            </div>
        </div>
    `);
}

async function confirmar_exclusao(idManutencao) {
    await deletar(`dados_manutencao/${idManutencao}`);

    // Remove localmente se necessário
    let dados_manutencao = await recuperarDados("dados_manutencao") || {};
    delete dados_manutencao[idManutencao];
    await inserirDados(dados_manutencao, "dados_manutencao");
    f5()
}


function alterar_kit(checkbox) {
    let chamado = document.getElementById('chamado')
    let div_chamado = document.getElementById('div_chamado')

    if (checkbox.checked) {
        chamado.value = 'KIT TÉCNICO'
        div_chamado.style.display = 'none'
    } else {
        chamado.value = ''
        div_chamado.style.display = 'flex'
    }
}

async function carregar_manutencoes() {
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}

    if (Object.keys(dados_manutencao).length == 0) {
        await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')
        dados_manutencao = await recuperarDados('dados_manutencao') || {}
    }

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    let linhas = ''

    for (id in dados_manutencao) {
        let manutencao = dados_manutencao[id]
        let dados_clientes = dados_clientes_omie[manutencao.codigo_cliente] || {}
        let dados_tecnicos = dados_clientes_omie[manutencao.codigo_tecnico] || {}
        let cor
        let exibir = false

        switch (manutencao.status_manutencao) {
            case 'MANUTENÇÃO':
                cor = '#ffc584'
                exibir = (modulo == 'LOGÍSTICA' || modulo == 'RELATÓRIOS') ? true : exibir
                break
            case 'REQUISIÇÃO AVULSA':
                cor = '#b3b3b3'
                exibir = (modulo == 'LOGÍSTICA' || modulo == 'RELATÓRIOS') ? true : exibir
                break
            case 'MATERIAL SEPARADO':
                cor = '#09e6d9'
                exibir = (modulo == 'LOGÍSTICA' || modulo == 'RELATÓRIOS') ? true : exibir
                break
            case 'MATERIAL ENVIADO':
                cor = '#80bbef'
                exibir = (modulo == 'LOGÍSTICA' || modulo == 'RELATÓRIOS') ? true : exibir
                break
            case 'MATERIAL RECEBIDO':
                cor = '#4CAF50'
                modulo == 'RELATÓRIOS' ? exibir = true : ''
                break
            case 'REPROVADO':
                cor = '#ff7777'
                modulo == 'CHAMADOS' ? exibir = true : ''
                break
            default:
                cor = '#ff7777'
                exibir = true
        }

        if (!exibir) {
            continue
        }

        linhas += `
            <tr style="background-color: ${cor};">
                <td>${manutencao.data}</td>
                <td>${manutencao.status_manutencao}</td>
                <td>${manutencao.chamado || 'SEM CHAMADO'}</td>
                <td>${dados_clientes.nome || '--'}</td>
                <td>${dados_tecnicos.nome || '--'}</td>
                <td>${dados_clientes.cidade || '--'}</td>
                <td>${manutencao.analista}</td>
                <td style="text-align: center;">
                    <img onclick="abrir_manutencao('${id}')" src="imagens/pesquisar3.png" style="width: 2vw; cursor: pointer;">
                </td>
            </tr>
            `
    }

    let colunas = ['Última alteração', 'Status', 'Chamado', 'Loja', 'Técnico', 'Cidade', 'Analista', 'Ações']
    let ths = ''
    let tsh = ''
    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`

        if (col == 'Ações') {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input placeholder="..." style="text-align: left;" oninput="pesquisar_generico('${i}', this.value, filtro_manutencao, 'manutencoes')">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>      
        `}
    })

    let toolbar = document.getElementById('toolbar')
    let visibilidade = toolbar.length > 0 ? 'none' : 'table'

    let tabela = `
        <table id="chamados" class="tabela" style="display: ${visibilidade}; font-size: 0.8vw; background-color: #151749;">
            <thead>
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="manutencoes">${linhas}</tbody>
        </table>
    `
    let div_chamados = document.getElementById('chamados')

    if (linhas !== '') {
        let toolbar = document.getElementById('toolbar')
        let label = `
        <label style="background-color: #151749;" onclick="mostrar_tabela('chamados')">REQUISIÇÕES</label>
        `
        toolbar.insertAdjacentHTML('beforeend', label)
        div_chamados.innerHTML = tabela

        mostrar_tabela('orcamentos_')
    }
}

function mostrar_tabela(tabela) {
    let chamados = document.getElementById('chamados')
    let orcamentos = document.getElementById('orcamentos')

    let a_tabela = document.getElementById(tabela)

    if (a_tabela) {
        chamados ? chamados.style.display = 'none' : ''
        orcamentos ? orcamentos_.style.display = 'none' : ''

        a_tabela ? a_tabela.style.display = 'table' : ''
    }
}

async function enviar_manutencao(id) {

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let campos = ['codigo_tecnico', 'codigo_cliente', 'comentario', 'status_manutencao', 'data', 'chamado']
    let manutencao = {}
    manutencao.usuario = acesso.usuario
    manutencao.analista = acesso.nome_completo

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}

    if (dados_manutencao[id]) {
        manutencao.historico = {}

        if (dados_manutencao[id].historico) {
            manutencao.historico = dados_manutencao[id].historico
            delete dados_manutencao[id].historico
        }

        manutencao.historico[gerar_id_5_digitos()] = dados_manutencao[id]
    }

    let tabela = document.getElementById('linhas_manutencao')
    let linhas = tabela.querySelectorAll('.linha')

    let pecas = {}
    linhas.forEach(linha => {
        let celulas = linha.querySelectorAll('input, textarea')
        if (celulas.length > 0) {
            pecas[gerar_id_5_digitos()] = {
                descricao: celulas[0].value,
                codigo: celulas[1].value,
                quantidade: celulas[2].value,
                comentario: celulas[3].value
            }
        }
    })

    manutencao.pecas = pecas

    campos.forEach(campo => {
        let elemento = document.getElementById(campo)
        if (elemento) {
            manutencao[campo] = elemento.value || elemento.textContent
        }
    })

    let kit = document.getElementById('kit')
    if (kit.checked) {
        manutencao.chamado = 'KIT TÉCNICO'
    }

    enviar(`dados_manutencao/${id}`, manutencao)
    dados_manutencao[id] = manutencao

    await inserirDados(dados_manutencao, 'dados_manutencao')

    let chamados = document.getElementById('chamados')
    if (chamados) {
        chamados.remove()
    }

    await preencher_orcamentos_v2()

    remover_popup()

}

function adicionar_linha_manut() {
    let tbody = document.getElementById('linhas_manutencao')
    let aleatorio = gerar_id_5_digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
        <div class="linha_completa">
            <div class="linha">
                <div style="position: relative; width: 25vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;" type="text" id="${aleatorio}" oninput="sugestoes(this, 'sug_${aleatorio}', 'estoque')"></textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div>
                    <input id="input_${aleatorio}" style="display: none;">
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="number">
                </div>

                <div style="width: 20vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;"></textarea>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 5vw;">
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
        let dados_endereco;
        let cod_omie;

        if (base == 'clientes') {
            cod_omie = item.omie
            info = String(item.nome)
            dados_endereco = `
            <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
            <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
            <label><strong>CEP:</strong> ${item.cep}</label>
            <label><strong>Cidade:</strong> ${item.cidade}</label>
            <label><strong>Estado:</strong> ${item.estado}</label>
        `.replace(/'/g, "&apos;")
                .replace(/"/g, "&quot;")
                .replace(/\r?\n|\r/g, "");

        } else if (base == 'estoque') {
            info = String(item.descricao)
        }

        if (info.includes(query)) {
            opcoes += `
                    <div onclick="definir_campo(this, '${div}', '${dados_endereco}', '${cod_omie}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
                `
        }
    }

    div_sugestoes.innerHTML = opcoes

}

async function definir_campo(elemento, div, string_html, omie, id) {

    let campo = String(div).split('_')[1]

    if (campo == 'tecnico' || campo == 'cliente') {

        let endereco = document.getElementById(`endereco_${campo}`)
        endereco.innerHTML = string_html.replace(/&apos;/g, "'").replace(/&quot;/g, '"');

    } else {

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

            let inputs = div_linha.querySelectorAll('input, textarea')

            inputs[4].value = dic_quantidades.estoque
            inputs[5].value = dic_quantidades.estoque_usado

        })

    }

    let codigo = document.getElementById(`codigo_${campo}`)
    if (codigo) {
        codigo.textContent = omie
    }
    document.getElementById(campo).value = elemento.textContent
    document.getElementById(div).innerHTML = '' // Sugestões
}

async function rir(id_orcam) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    var orcamento = dados_orcamentos[id_orcam];

    orcamento = await conversor_composicoes_orcamento(orcamento)

    var estado = orcamento.dados_orcam.estado;
    var icms = estado == 'BA' ? 0.205 : 0.12;

    var dados = {
        'SERVIÇO': [],
        'VENDA': []
    };

    var itens = orcamento.dados_composicoes

    Object.keys(itens).forEach(it => {
        var item = itens[it]

        item.descricao_carrefour = dados_composicoes[item.codigo].descricaocarrefour
        if (dados_composicoes[item.codigo].substituto !== '') {
            var substituto = dados_composicoes[item.codigo].substituto
            item.descricao_carrefour = dados_composicoes[substituto].descricaocarrefour
        }

        item.tipo = dados_composicoes[item.codigo].tipo
        item.descricao = dados_composicoes[item.codigo].descricao
        item.custo = 0

        if (dados_composicoes[item.codigo]['lpu carrefour']) {
            var ativo = dados_composicoes[item.codigo]['lpu carrefour'].ativo
            var historico = dados_composicoes[item.codigo]['lpu carrefour'].historico
            item.custo = historico[ativo].valor
        }

        var custo_sem_icms = item.custo - (icms * item.custo)
        var total_sem_icms = conversor(item.qtde) * custo_sem_icms
        var total = item.custo * conversor(item.qtde)

        if (item.tipo == 'VENDA') {
            dados[item.tipo].push([
                item.codigo,
                item.descricao_carrefour,
                item.descricao,
                item.tipo,
                item.qtde,
                custo_sem_icms,
                total_sem_icms,
                item.custo,
                total
            ])
        } else {
            dados[item.tipo].push([
                item.codigo,
                item.descricao_carrefour,
                item.descricao,
                item.tipo,
                item.qtde,
                item.custo,
                total
            ])
        }

    })

    var nome_arquivo = `RELAÇÃO ITENS REAIS - ${orcamento.dados_orcam.cliente_selecionado} - ${orcamento.dados_orcam.contrato}`;

    rir_excel(dados, nome_arquivo);
}

async function editar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = await conversor_composicoes_orcamento(orcamento_v2)

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'

}

async function duplicar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let acesso = JSON.parse(localStorage.getItem('acesso'))

    var orcamento_v2 = dados_orcamentos[orcam_]

    orcamento_v2 = await conversor_composicoes_orcamento(orcamento_v2)

    delete orcamento_v2.id

    orcamento_v2.dados_orcam.contrato = ''
    orcamento_v2.dados_orcam.analista = acesso.nome_completo
    orcamento_v2.dados_orcam.email_analista = acesso.email
    orcamento_v2.dados_orcam.telefone_analista = acesso.telefone

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'
}

function salvar_dados_em_excel() {
    var tabela = orcamento_.querySelectorAll('tr');
    var dados = [];

    // Processa o cabeçalho (primeira linha da tabela)
    var cabecalho = tabela[0].querySelectorAll('th');
    var linhaCabecalho = [];
    cabecalho.forEach(th => {
        linhaCabecalho.push(th.textContent);
    });

    dados.push(linhaCabecalho); // Adiciona o cabeçalho ao array 'dados'

    // Processa o restante das linhas (linhas com dados)
    tabela.forEach((tr, index) => {
        if (index === 0) return; // Ignora o cabeçalho

        var tds = tr.querySelectorAll('td');
        var linha = [];
        tds.forEach(td => {
            linha.push(td.textContent);
        });

        dados.push(linha); // Adiciona a linha de dados ao array 'dados'
    });

    // Gera o arquivo Excel com ExcelJS
    var workbook = new ExcelJS.Workbook();
    var worksheet = workbook.addWorksheet('Orcamento');

    // Adiciona os dados ao worksheet
    dados.forEach((linha, index) => {
        worksheet.addRow(linha);
    });

    // Define a largura automática para as colunas
    worksheet.columns.forEach(column => {
        var maxLength = 0;
        column.eachCell({ includeEmpty: true }, function (cell) {
            var columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : 20;
    });

    workbook.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'dados_orcamento.xlsx');
    });
}

function ultimoStatus(historicos) {

    let status = []

    for (chave2 in historicos) {
        let cartao = historicos[chave2]

        status.push(cartao.status)

    }

    let cronologia = Object.keys(fluxograma);

    for (let i = cronologia.length - 1; i >= 0; i--) {
        if (status.includes(cronologia[i])) {
            return cronologia[i];
        }
    }

    return '';
}

// Função usada para reorganizar os dados_orcamentos; 13-02-2025
async function alteracoes_status() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    for (id in dados_orcamentos) {
        let orcamento = dados_orcamentos[id]

        if (orcamento.levantamentos) {
            let novo_levantamentos = {};

            for (let lev in orcamento.levantamentos) {
                let adentro = orcamento.levantamentos[lev];

                while (adentro && typeof adentro[lev] === 'object') {
                    adentro = adentro[lev];
                }

                novo_levantamentos[lev] = adentro;
            }

            orcamento.levantamentos = novo_levantamentos;
        }

        if (orcamento.status) {

            let chaves = orcamento.status

            let novas_chaves = {}

            for (chave1 in chaves) {
                let pedido = chaves[chave1]
                let historicos = pedido.historico

                if (!novas_chaves[chave1]) {
                    novas_chaves[chave1] = {}
                }

                if (pedido.status == 'FINALIZADO') {
                    novas_chaves[chave1].finalizado = true
                }

                for (chave2 in historicos) {
                    let his = historicos[chave2]
                    his.status = atualizar_status(his.status)

                    if (his.status == 'PEDIDO') {
                        his.pedido = pedido.pedido
                        his.valor = pedido.valor
                        his.tipo = pedido.tipo
                    }

                    if (!novas_chaves[chave1].historico) {
                        novas_chaves[chave1].historico = {}
                    }

                    novas_chaves[chave1].historico[chave2] = his
                }

            }

            orcamento.status = novas_chaves

        }
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
}

function atualizar_status(st) {

    switch (true) {
        case st.includes('ANEXADO'):
            st = 'PEDIDO'
            break
        case st.includes('FATURAMENTO PEDIDO DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('REMESSA DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('FATURADO'):
            st = 'FATURADO'
            break
        case st == '':
            st = 'PEDIDO'
            break
        default:
            st = st
    }

    return st
}
